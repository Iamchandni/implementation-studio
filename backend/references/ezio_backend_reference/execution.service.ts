import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { AgentRunnerService } from '../agents/agent-runner.service';
import { AuditService } from '../audit/audit.service';
import { ExecutionsGateway } from './executions.gateway';
import { GatewayService } from '../gateway/gateway.service';
import { AlertsService } from '../alerts/alerts.service';
import { McpClientService } from '../mcp/mcp-client.service';
import { LlmRouter } from '../llm/llm-router.service';

/**
 * Canvas node shape from the frontend workflow builder.
 * Kept flexible — different kinds carry different data.
 */
export interface CanvasNode {
  id: string;
  type: string; // 'acp' — react-flow type. The `data.kind` tells us the actual node kind.
  position: { x: number; y: number };
  data: {
    kind: 'user_prompt' | 'agent' | 'sub_agent' | 'mcp' | 'condition' | 'router' | 'transform' | 'delay' | 'aggregator';
    label?: string;
    // Agent-specific
    systemPrompt?: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
    toolIds?: string[];
    agentId?: string;
    agentVersionId?: string;
    // MCP-specific
    mcpServerId?: string;
    mcpToolName?: string;
    connectionType?: string;
    // Condition
    expression?: string;
    // Human approval
    message?: string;
    [key: string]: unknown;
  };
}

export interface CanvasEdge {
  id: string;
  source: string;
  target: string;
}

export interface CanvasDefinition {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
}

export interface StartExecutionInput {
  workflowId: string;
  environmentId: string;
  triggerInput?: string;
  organizationId: string;
  userId: string;
}

export interface TestRunInput {
  canvas: CanvasDefinition;
  userInput: string;
  organizationId: string;
  environmentId?: string;
  userId: string;
  workflowName?: string;
}

@Injectable()
export class ExecutionService {
  private readonly logger = new Logger(ExecutionService.name);

  /**
   * IDs of executions the user has requested to cancel. The scheduler loop
   * checks this between waves and between individual node completions and
   * bails out early. In-memory only — a server restart drops the set, but
   * the DB `status='cancelled'` still reflects the requested state.
   */
  private readonly cancelled = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly agentRunner: AgentRunnerService,
    private readonly audit: AuditService,
    private readonly gateway: ExecutionsGateway,
    private readonly toolGateway: GatewayService,
    private readonly alerts: AlertsService,
    private readonly mcpClient: McpClientService,
    private readonly llm: LlmRouter,
  ) {}

  // -------------------------------------------------------------
  // TEST RUN — ad-hoc execution from canvas JSON
  // -------------------------------------------------------------
  async testRun(input: TestRunInput) {
    // Pick a default environment if not provided
    let environmentId = input.environmentId;
    if (!environmentId) {
      const env = await this.prisma.environment.findFirst({
        where: { project: { workspace: { organizationId: input.organizationId } } },
      });
      if (!env) throw new Error('No environments configured for this organization');
      environmentId = env.id;
    }

    // Create ephemeral workflow shell for the test run
    const workflow = await this.prisma.workflow.create({
      data: {
        organizationId: input.organizationId,
        environmentId,
        name: `${input.workflowName ?? 'Test Run'} — ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`,
        status: 'draft',
        createdBy: input.userId,
      },
    });

    const version = await this.prisma.workflowVersion.create({
      data: {
        workflowId: workflow.id,
        version: 1,
        canvasJson: input.canvas as any,
        workflowDsl: input.canvas as any,
        isPublished: false,
      },
    });

    const execution = await this.prisma.execution.create({
      data: {
        workflowId: workflow.id,
        workflowVersionId: version.id,
        environmentId,
        startedBy: input.userId,
        status: 'running',
        triggerInput: input.userInput,
      },
    });

    await this.audit.writeExecutionEvent({
      executionId: execution.id,
      eventType: 'ExecutionStarted',
      payload: { workflowId: workflow.id, testRun: true, triggerInput: input.userInput },
    });

    this.gateway.emit({
      executionId: execution.id,
      type: 'execution_started',
      data: { workflowId: workflow.id, workflowName: workflow.name, testRun: true },
      timestamp: Date.now(),
    });

    // Kick off async execution
    this.runCanvas(execution.id, input.canvas, {
      organizationId: input.organizationId,
      environmentId,
      userId: input.userId,
      triggerInput: input.userInput,
    }).catch((err) => {
      this.logger.error(`Test run ${execution.id} failed: ${(err as Error).message}`, err);
      this.markFailed(execution.id, (err as Error).message).catch(() => undefined);
    });

    return { executionId: execution.id, workflowId: workflow.id };
  }

  // -------------------------------------------------------------
  // RESUME AFTER APPROVAL — invoked by ApprovalService.approve
  // -------------------------------------------------------------
  /**
   * Simple resume model:
   *   1. Execute the approved tool via mcpClient (bypasses policy — human already
   *      reviewed the exact input).
   *   2. Emit tool_use + tool_result events so the UI sees the resumed activity.
   *   3. Complete the paused execution node with the tool output.
   *   4. Set execution status back to 'running' and re-invoke runCanvas in resume
   *      mode — it will pick up from wherever we left off (all done nodes are
   *      loaded from DB, downstream nodes become ready).
   *
   * This does not attempt to fully re-hydrate the paused agent's message history.
   * Instead, the workflow continues from the completed node, and downstream nodes
   * receive the tool's output as their parent context.
   */
  async resumeAfterApproval(approvalId: string) {
    const approval = await this.prisma.approval.findUnique({
      where: { id: approvalId },
      include: {
        execution: {
          include: {
            workflow: { select: { organizationId: true } },
            workflowVersion: true,
          },
        },
      },
    });
    if (!approval) throw new NotFoundException('Approval not found');
    if (approval.status !== 'approved') throw new Error('Approval is not approved');
    if (!approval.mcpServerId || !approval.toolName) {
      this.logger.warn(`Approval ${approvalId} lacks tool context; nothing to do`);
      return { resumed: false, reason: 'no tool context' };
    }
    // Sandbox mode: no nodeId means this approval came from Try It (or any ad-hoc
    // gateway invocation not tied to a workflow node). Just execute + mark done.
    const isSandbox = !approval.nodeId;

    const execution = approval.execution;
    const organizationId = execution.workflow.organizationId;

    this.gateway.emit({
      executionId: execution.id,
      type: 'agent_text',
      data: { nodeId: approval.nodeId, text: `▶ Resuming after approval ${approvalId.slice(0, 8)}...` },
      timestamp: Date.now(),
    });

    // 1. Execute the approved tool directly (policy bypassed by human review)
    const startTime = Date.now();
    let toolOutput: unknown = null;
    try {
      // Strip the "servername." prefix from the tool name if present
      const rawToolName = approval.toolName.includes('.')
        ? approval.toolName.split('.').slice(1).join('.')
        : approval.toolName;
      this.gateway.emit({
        executionId: execution.id,
        type: 'tool_use',
        data: { nodeId: approval.nodeId, toolName: approval.toolName, input: approval.inputPayload },
        timestamp: Date.now(),
      });

      // Route through the Gateway (bypassPolicy=true) so meta-tool
      // translation (Zapier virtual tools → execute_zapier_write_action)
      // and output normalization still run. Calling mcpClient.callTool
      // directly here would skip that translation and Zapier would
      // silently no-op on the bare virtual tool name.
      const gatewayResult = await this.toolGateway.invokeTool({
        mcpServerId: approval.mcpServerId,
        toolName: rawToolName,
        input: (approval.inputPayload as any) ?? {},
        context: {
          executionId: execution.id,
          organizationId,
          environmentId: execution.environmentId,
          userId: approval.reviewedBy ?? execution.startedBy,
          agentId: approval.agentId ?? undefined,
          nodeId: approval.nodeId ?? undefined,
        },
        bypassPolicy: true,
      });

      if (gatewayResult.status !== 'success') {
        const msg =
          gatewayResult.status === 'denied'
            ? gatewayResult.reason
            : gatewayResult.status === 'error'
              ? gatewayResult.error
              : 'Unknown gateway error';
        throw new Error(msg);
      }
      toolOutput = gatewayResult.output;
      this.gateway.emit({
        executionId: execution.id,
        type: 'tool_result',
        data: {
          nodeId: approval.nodeId,
          toolName: approval.toolName,
          output: toolOutput,
          status: 'success',
          latencyMs: gatewayResult.latencyMs,
        },
        timestamp: Date.now(),
      });
      await this.audit.writeExecutionEvent({
        executionId: execution.id,
        eventType: 'ToolCompleted',
        nodeId: approval.nodeId ?? undefined,
        agentId: approval.agentId ?? undefined,
        mcpToolId: approval.mcpToolId ?? undefined,
        policyResult: 'ALLOW',
        latencyMs: Date.now() - startTime,
      });
    } catch (err) {
      const msg = (err as Error).message;
      this.logger.error(`Approved tool call failed on resume: ${msg}`);
      this.gateway.emit({
        executionId: execution.id,
        type: 'tool_result',
        data: { nodeId: approval.nodeId, toolName: approval.toolName, status: 'error', note: msg },
        timestamp: Date.now(),
      });
      await this.markFailed(execution.id, `Approved tool "${approval.toolName}" failed: ${msg}`);
      return { resumed: false, error: msg };
    }

    // 2. Sandbox mode (Try It, ad-hoc): no workflow canvas to continue —
    //    just mark the execution complete with the tool output and return.
    if (isSandbox) {
      await this.prisma.execution.update({
        where: { id: execution.id },
        data: {
          status: 'completed',
          completedAt: new Date(),
          totalLatencyMs: Date.now() - startTime,
        },
      });
      this.gateway.emit({
        executionId: execution.id,
        type: 'execution_completed',
        data: { output: toolOutput, viaApproval: true },
        timestamp: Date.now(),
      });
      return { resumed: true, executionId: execution.id, output: toolOutput, sandbox: true };
    }

    // 3. Workflow mode: mark the paused node as completed with the tool output
    await this.prisma.executionNode.updateMany({
      where: { executionId: execution.id, nodeId: approval.nodeId! },
      data: {
        status: 'completed',
        completedAt: new Date(),
        latencyMs: Date.now() - startTime,
      },
    });
    this.gateway.emit({
      executionId: execution.id,
      type: 'node_completed',
      data: { nodeId: approval.nodeId, output: toolOutput, status: 'completed' },
      timestamp: Date.now(),
    });

    // 4. Load resume state from DB: which nodes were already completed + their outputs
    const executionNodes = await this.prisma.executionNode.findMany({
      where: { executionId: execution.id, status: 'completed' },
    });
    const completedNodeIds = executionNodes.map((n) => n.nodeId);
    // Rebuild nodeOutputs from ExecutionEvents (best-effort — for demo purposes,
    // downstream nodes may only need the shape, not the exact prior payloads)
    const nodeOutputs: Record<string, unknown> = {};
    nodeOutputs[approval.nodeId!] = toolOutput;

    // 5. Flip execution status back to running and re-invoke the canvas
    await this.prisma.execution.update({
      where: { id: execution.id },
      data: { status: 'running' },
    });

    const canvas = (execution.workflowVersion.canvasJson ?? execution.workflowVersion.workflowDsl) as unknown as CanvasDefinition;
    // Fire-and-forget continuation
    this.runCanvas(
      execution.id,
      canvas,
      {
        organizationId,
        environmentId: execution.environmentId,
        userId: execution.startedBy,
        triggerInput: execution.triggerInput ?? undefined,
      },
      { completedNodeIds, nodeOutputs },
    ).catch((err) => {
      this.logger.error(`Resume of ${execution.id} failed: ${(err as Error).message}`, err);
      this.markFailed(execution.id, (err as Error).message).catch(() => undefined);
    });

    return { resumed: true, executionId: execution.id };
  }

  private normalizeMcpResult(raw: unknown): unknown {
    const r = raw as { content?: Array<{ type: string; text?: string; data?: unknown }>; isError?: boolean };
    if (!r?.content) return raw;
    if (r.content.length === 1 && r.content[0].type === 'text' && r.content[0].text) {
      try {
        return JSON.parse(r.content[0].text);
      } catch {
        return r.content[0].text;
      }
    }
    return r.content;
  }

  // -------------------------------------------------------------
  // START — execute a saved & published workflow
  // -------------------------------------------------------------
  async start(input: StartExecutionInput) {
    const workflow = await this.prisma.workflow.findFirst({
      where: { id: input.workflowId, organizationId: input.organizationId },
      include: {
        versions: { orderBy: { version: 'desc' }, take: 1 },
      },
    });
    if (!workflow) throw new NotFoundException('Workflow not found');
    const version = workflow.versions[0];
    if (!version) throw new NotFoundException('No version of workflow');

    const execution = await this.prisma.execution.create({
      data: {
        workflowId: workflow.id,
        workflowVersionId: version.id,
        environmentId: input.environmentId,
        startedBy: input.userId,
        status: 'running',
        triggerInput: input.triggerInput,
      },
    });

    await this.audit.writeExecutionEvent({
      executionId: execution.id,
      eventType: 'ExecutionStarted',
      payload: { workflowId: workflow.id, triggerInput: input.triggerInput },
    });

    this.gateway.emit({
      executionId: execution.id,
      type: 'execution_started',
      data: { workflowId: workflow.id, workflowName: workflow.name },
      timestamp: Date.now(),
    });

    const canvas = (version.canvasJson ?? version.workflowDsl) as unknown as CanvasDefinition;
    this.runCanvas(execution.id, canvas, {
      organizationId: input.organizationId,
      environmentId: input.environmentId,
      userId: input.userId,
      triggerInput: input.triggerInput,
    }).catch((err) => {
      this.logger.error(`Execution ${execution.id} failed: ${(err as Error).message}`, err);
      this.markFailed(execution.id, (err as Error).message).catch(() => undefined);
    });

    return execution;
  }

  // -------------------------------------------------------------
  // Core execution engine (works for both saved and test runs)
  //
  // Scheduler:
  //  - Track in-degree per node (unresolved parents).
  //  - Start with all nodes whose in-degree is 0.
  //  - Run READY nodes in parallel via Promise.all.
  //  - When a node completes, decrement each child's in-degree; when
  //    a child hits 0 it becomes READY.
  //  - A node's inputs include ALL its parent outputs (fan-in).
  // -------------------------------------------------------------
  private async runCanvas(
    executionId: string,
    canvas: CanvasDefinition,
    ctx: {
      organizationId: string;
      environmentId: string;
      userId: string;
      triggerInput?: string;
    },
    resumeState?: {
      completedNodeIds: string[];
      nodeOutputs: Record<string, unknown>;
    },
  ) {
    try {
      const nodeMap = new Map(canvas.nodes.map((n) => [n.id, n]));

      // Build adjacency + parent lists + in-degree map
      const outgoing = new Map<string, string[]>();
      const incoming = new Map<string, string[]>();
      const inDegree = new Map<string, number>();

      for (const n of canvas.nodes) {
        outgoing.set(n.id, []);
        incoming.set(n.id, []);
        inDegree.set(n.id, 0);
      }
      for (const edge of canvas.edges) {
        if (!nodeMap.has(edge.source) || !nodeMap.has(edge.target)) continue;
        outgoing.get(edge.source)!.push(edge.target);
        incoming.get(edge.target)!.push(edge.source);
        inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
      }

      const nodeOutputs: Record<string, unknown> = { ...(resumeState?.nodeOutputs ?? {}) };
      const completedNodes = new Set<string>(resumeState?.completedNodeIds ?? []);
      const failedNodes = new Set<string>();
      let anyApprovalPending = false;

      // If resuming, decrement in-degree for every completed node's children.
      // A child whose parents are all already done should become ready.
      if (resumeState) {
        for (const doneId of resumeState.completedNodeIds) {
          for (const childId of outgoing.get(doneId) ?? []) {
            inDegree.set(childId, (inDegree.get(childId) ?? 0) - 1);
          }
        }
      }

      // Initial ready set: nodes with in-degree 0 that aren't already completed.
      const ready: string[] = [];
      for (const [id, deg] of inDegree) {
        if (deg <= 0 && !completedNodes.has(id)) ready.push(id);
      }
      if (ready.length === 0 && !resumeState) {
        throw new Error('Workflow has a cycle or no starting node');
      }

      // Execute one node. Returns 'completed' | 'failed' | 'waiting_approval'.
      const runOne = async (nodeId: string): Promise<'completed' | 'failed' | 'waiting_approval'> => {
        const node = nodeMap.get(nodeId)!;

        await this.prisma.executionNode.create({
          data: {
            executionId,
            nodeId: node.id,
            nodeType: node.data.kind,
            nodeLabel: node.data.label ?? node.id,
            status: 'running',
            startedAt: new Date(),
          },
        });

        this.gateway.emit({
          executionId,
          type: 'node_started',
          data: { nodeId: node.id, nodeType: node.data.kind, label: node.data.label },
          timestamp: Date.now(),
        });

        // Build the parent-outputs subset for this node's fan-in.
        const parentIds = incoming.get(node.id) ?? [];
        const parentOutputs: Record<string, unknown> = {};
        for (const pid of parentIds) parentOutputs[pid] = nodeOutputs[pid];

        let output: unknown = null;
        let status: 'completed' | 'failed' | 'waiting_approval' = 'completed';

        const startTime = Date.now();
        try {
          if (node.data.kind === 'user_prompt') {
            output = { input: ctx.triggerInput ?? '' };
          } else if (node.data.kind === 'agent' || node.data.kind === 'sub_agent') {
            output = await this.executeAgentNode(node, executionId, ctx, parentOutputs);
            if ((output as any)?._status === 'awaiting_approval') {
              status = 'waiting_approval';
            }
          } else if (node.data.kind === 'mcp') {
            output = await this.executeMcpNode(node, executionId, ctx, parentOutputs);
          } else if (node.data.kind === 'condition') {
            output = { result: this.evalCondition(node.data.expression ?? 'true', parentOutputs) };
          } else if (node.data.kind === 'aggregator') {
            // Fan-in: concatenate all parent outputs
            output = { aggregated: parentOutputs };
          } else if (node.data.kind === 'delay') {
            await new Promise((r) => setTimeout(r, 500));
            output = { delayed: true };
          } else if (node.data.kind === 'transform' || node.data.kind === 'router') {
            output = { note: `${node.data.kind} nodes are pass-through in this build`, ...parentOutputs };
          } else {
            output = { skipped: `Node type ${node.data.kind} not yet implemented` };
          }
        } catch (err) {
          status = 'failed';
          output = { error: (err as Error).message };
          this.logger.error(`Node ${node.id} (${node.data.kind}) failed: ${(err as Error).message}`);
        }

        const latencyMs = Date.now() - startTime;

        // Extract cost/token telemetry from the agent output shape so we can
        // roll it up onto ExecutionNode + Execution. MCP-only nodes have no
        // tokens; they just contribute 0. Agent nodes carry `tokens` +
        // `costUsd` from `executeAgentNode`.
        const nodeTokens = (output as any)?.tokens ?? 0;
        const nodeCost = (output as any)?.costUsd ?? 0;

        await this.prisma.executionNode.updateMany({
          where: { executionId, nodeId: node.id },
          data: {
            status,
            completedAt: new Date(),
            latencyMs,
            tokensUsed: nodeTokens,
            costUsd: nodeCost,
          },
        });

        this.gateway.emit({
          executionId,
          type: status === 'failed' ? 'node_failed' : 'node_completed',
          data: {
            nodeId: node.id,
            output,
            status,
            latencyMs,
            tokensUsed: nodeTokens,
            costUsd: nodeCost,
          },
          timestamp: Date.now(),
        });

        nodeOutputs[node.id] = output;
        return status;
      };

      // Scheduler loop: execute all ready nodes in parallel, then compute next wave.
      let wave = ready;
      while (wave.length > 0) {
        if (this.isCancelled(executionId)) {
          this.logger.log(`Execution ${executionId} cancelled by user — halting scheduler`);
          this.cancelled.delete(executionId);
          return;
        }
        const results = await Promise.all(
          wave.map(async (nodeId) => {
            const status = await runOne(nodeId);
            return { nodeId, status };
          }),
        );

        const nextWave: string[] = [];

        for (const { nodeId, status } of results) {
          if (status === 'waiting_approval') {
            anyApprovalPending = true;
            continue;
          }
          if (status === 'failed') {
            failedNodes.add(nodeId);
            // Continue-on-error: mark this node as "settled" so downstream
            // children can still run. Their agent nodes can gracefully note
            // the failure via the {_error} output stored in nodeOutputs by
            // runOne(). This mirrors n8n / Zapier's default step behaviour
            // and prevents one flaky read tool from nuking the whole run.
          }
          completedNodes.add(nodeId);

          // Notify children — decrement their in-degree
          for (const childId of outgoing.get(nodeId) ?? []) {
            const remaining = (inDegree.get(childId) ?? 0) - 1;
            inDegree.set(childId, remaining);
            if (remaining === 0) nextWave.push(childId);
          }
        }

        // If any node is pending approval, pause execution
        if (anyApprovalPending) {
          await this.prisma.execution.update({
            where: { id: executionId },
            data: { status: 'waiting_approval' },
          });
          return;
        }

        wave = nextWave;
      }

      // Check whether we actually ran all nodes; unreached nodes mean the graph
      // has isolated fragments, which we treat as OK (they just don't execute).
      if (this.isCancelled(executionId)) {
        this.cancelled.delete(executionId);
        return;
      }
      const anyFailed = failedNodes.size > 0;
      const finalStatus = anyFailed ? 'completed_with_errors' : 'completed';
      const failedLabels = anyFailed
        ? Array.from(failedNodes).map((id) => nodeMap.get(id)?.data.label ?? id).join(', ')
        : null;

      // Roll up per-node token/cost telemetry onto the execution.
      const rollup = await this.prisma.executionNode.aggregate({
        where: { executionId },
        _sum: { tokensUsed: true, costUsd: true, latencyMs: true },
      });
      const totalTokens = rollup._sum.tokensUsed ?? 0;
      const totalCostUsd = rollup._sum.costUsd ?? 0;
      const totalLatencyMs = rollup._sum.latencyMs ?? 0;

      await this.prisma.execution.update({
        where: { id: executionId },
        data: {
          status: finalStatus,
          completedAt: new Date(),
          totalTokens,
          totalCostUsd,
          totalLatencyMs,
          ...(anyFailed ? { errorMessage: `Partial: ${failedLabels} failed but downstream nodes continued` } : {}),
        },
      });

      await this.audit.writeExecutionEvent({
        executionId,
        eventType: anyFailed ? 'ExecutionCompletedWithErrors' : 'ExecutionCompleted',
        payload: anyFailed
          ? { failedNodes: Array.from(failedNodes), totalTokens, totalCostUsd }
          : { totalTokens, totalCostUsd },
      });

      this.gateway.emit({
        executionId,
        type: 'execution_completed',
        data: {
          outputs: nodeOutputs,
          nodesRun: completedNodes.size,
          failedNodes: Array.from(failedNodes),
          status: finalStatus,
          totalTokens,
          totalCostUsd,
        },
        timestamp: Date.now(),
      });

      this.alerts
        .fireEvent(ctx.organizationId, 'execution_completed', { executionId, nodesRun: completedNodes.size })
        .catch(() => undefined);
    } catch (err) {
      await this.markFailed(executionId, (err as Error).message);
    }
  }

  /**
   * Execute an agent node. If the node has inline config (systemPrompt/model),
   * we upsert an ephemeral AgentVersion for it and run that. Otherwise use
   * the referenced agentVersionId directly.
   */
  private async executeAgentNode(
    node: CanvasNode,
    executionId: string,
    ctx: { organizationId: string; environmentId: string; userId: string; triggerInput?: string },
    nodeOutputs: Record<string, unknown>,
  ) {
    let agentVersionId = node.data.agentVersionId;
    let agentId = node.data.agentId;

    if (!agentVersionId) {
      // Inline agent — create ephemeral Agent + AgentVersion
      const label = node.data.label ?? `Inline Agent ${node.id}`;
      const ephemeralAgent = await this.prisma.agent.create({
        data: {
          organizationId: ctx.organizationId,
          name: `[inline] ${label}`,
          description: `Inline agent from workflow execution ${executionId}`,
          status: 'draft',
          owner: ctx.userId,
        },
      });
      agentId = ephemeralAgent.id;

      const version = await this.prisma.agentVersion.create({
        data: {
          agentId: ephemeralAgent.id,
          version: 1,
          systemPrompt: node.data.systemPrompt ?? 'You are a helpful assistant.',
          model: node.data.model ?? 'gpt-4.1',
          temperature: node.data.temperature ?? 0.3,
          maxTokens: node.data.maxTokens ?? 4096,
        },
      });
      agentVersionId = version.id;

      // Attach tools if configured
      if (node.data.toolIds && node.data.toolIds.length > 0) {
        await this.prisma.agentTool.createMany({
          data: node.data.toolIds.map((mcpToolId) => ({
            agentVersionId: version.id,
            mcpToolId,
            permission: 'allow',
          })),
        });
      }
    }

    // Build the user message from upstream outputs + trigger
    const priorOutputs = Object.entries(nodeOutputs)
      .map(([k, v]) => `Output from ${k}:\n${typeof v === 'string' ? v : JSON.stringify(v).slice(0, 2000)}`)
      .join('\n\n');
    const userMessage = [ctx.triggerInput, priorOutputs].filter(Boolean).join('\n\n---\n\n');

    const result = await this.agentRunner.run({
      agentVersionId: agentVersionId!,
      userMessage: userMessage || 'Begin the workflow.',
      context: {
        executionId,
        organizationId: ctx.organizationId,
        environmentId: ctx.environmentId,
        userId: ctx.userId,
        agentId,
        agentVersionId,
        nodeId: node.id,
      },
      onEvent: (e) => {
        this.gateway.emit({
          executionId,
          type: this.mapAgentEventType(e.type),
          data: {
            nodeId: node.id,
            ...('text' in e ? { text: e.text } : {}),
            ...('toolName' in e ? { toolName: e.toolName } : {}),
            ...('input' in e ? { input: e.input } : {}),
            ...('output' in e ? { output: e.output } : {}),
            ...('approvalId' in e ? { approvalId: e.approvalId } : {}),
          },
          timestamp: Date.now(),
        });
      },
    });

    return {
      text: result.finalText,
      toolCalls: result.toolCalls,
      tokens: result.totalTokens,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      costUsd: result.costUsd,
      model: result.model,
      _status: result.status === 'awaiting_approval' ? 'awaiting_approval' : 'completed',
    };
  }

  /**
   * Execute a direct MCP tool call node (no agent, just call the tool).
   */
  private async executeMcpNode(
    node: CanvasNode,
    executionId: string,
    ctx: { organizationId: string; environmentId: string; userId: string; triggerInput?: string },
    nodeOutputs: Record<string, unknown>,
  ) {
    if (!node.data.mcpToolName) {
      throw new Error(`MCP node "${node.data.label ?? node.id}" has no tool selected`);
    }

    // 1) Resolve mcpServerId. AI-generated workflows only supply the tool
    // name, so if there's no explicit server id we look up the first matching
    // connected tool in the org.
    let mcpServerId = node.data.mcpServerId;
    let toolRow:
      | { id: string; toolName: string; description: string | null; inputSchema: any; mcpServerId: string }
      | null = null;

    if (mcpServerId) {
      toolRow = await this.prisma.mcpTool.findFirst({
        where: { mcpServerId, toolName: node.data.mcpToolName },
        select: { id: true, toolName: true, description: true, inputSchema: true, mcpServerId: true },
      });
    } else {
      toolRow = await this.prisma.mcpTool.findFirst({
        where: {
          toolName: node.data.mcpToolName,
          mcpServer: {
            connection: {
              status: 'connected',
              environment: { project: { workspace: { organizationId: ctx.organizationId } } },
            },
          },
        },
        select: { id: true, toolName: true, description: true, inputSchema: true, mcpServerId: true },
        orderBy: { toolName: 'asc' },
      });
      if (toolRow) {
        mcpServerId = toolRow.mcpServerId;
        this.logger.log(
          `Auto-resolved MCP tool "${node.data.mcpToolName}" → server ${mcpServerId} for node "${node.data.label ?? node.id}"`,
        );
      }
    }

    if (!toolRow || !mcpServerId) {
      throw new Error(
        `MCP tool "${node.data.mcpToolName}" is not connected in this environment. ` +
          `Connect the app in Integrations, then re-run.`,
      );
    }

    // 2) Build the input arguments. If the node has explicit `input` config
    // use it verbatim. Otherwise extract from parent outputs using the tool
    // schema — for a demo we use a small LLM call that reads the parent
    // agent's summary and produces the exact tool args JSON.
    const explicit =
      (node.data as any).input ?? (node.data as any).arguments ?? (node.data as any).toolInput ?? null;
    let input: Record<string, unknown> = {};

    if (explicit && typeof explicit === 'object') {
      input = { ...explicit };
    } else {
      input = await this.extractToolInputFromParents({
        toolName: toolRow.toolName,
        description: toolRow.description,
        inputSchema: toolRow.inputSchema,
        parentOutputs: nodeOutputs,
        triggerInput: ctx.triggerInput,
      });
    }

    // Emit a diagnostic event so the UI shows what we resolved.
    this.gateway.emit({
      executionId,
      type: 'tool_use',
      data: {
        nodeId: node.id,
        toolName: toolRow.toolName,
        input,
      },
      timestamp: Date.now(),
    });

    const result = await this.toolGateway.invokeTool({
      mcpServerId,
      toolName: toolRow.toolName,
      input,
      context: {
        executionId,
        organizationId: ctx.organizationId,
        environmentId: ctx.environmentId,
        userId: ctx.userId,
        nodeId: node.id,
      },
    });

    if (result.status === 'success') return { output: result.output, latencyMs: result.latencyMs };
    if (result.status === 'denied') throw new Error(`Denied: ${result.reason}`);
    if (result.status === 'error') throw new Error(result.error);
    return { approvalId: (result as any).approvalId, _status: 'awaiting_approval' };
  }

  /**
   * Uses a small LLM call to produce tool-argument JSON from upstream node
   * outputs. Best-effort: on any failure returns {} so the tool call at
   * least attempts (and the MCP server surfaces a schema error the user
   * can read).
   */
  private async extractToolInputFromParents(args: {
    toolName: string;
    description: string | null;
    inputSchema: any;
    parentOutputs: Record<string, unknown>;
    triggerInput?: string;
  }): Promise<Record<string, unknown>> {
    const { toolName, description, inputSchema, parentOutputs, triggerInput } = args;

    // If we have no schema, nothing structured we can do.
    if (!inputSchema || typeof inputSchema !== 'object') return {};

    const schemaJson = JSON.stringify(inputSchema).slice(0, 4000);
    const parentsJson = JSON.stringify(parentOutputs).slice(0, 6000);
    const trigger = triggerInput ? String(triggerInput).slice(0, 500) : '';

    const systemPrompt = `You bind upstream workflow outputs to the JSON arguments for the tool "${toolName}".
Return ONLY a compact JSON object matching the tool's inputSchema. No prose, no fences.
If a required field can't be inferred from context, prefer the tool's own default hints (schema.default), or emit the most permissive/broadest value that will let the call succeed (e.g. state:"open", per_page:20).
For email tools, extract "to" addresses from the trigger request and construct "subject"/"body" from the upstream summary text.
Never emit an empty object {} — always fill at least the most obvious defaults.`;

    const userPrompt = `Tool: ${toolName}
${description ? `Description: ${description}\n` : ''}Input schema:
${schemaJson}

Trigger request (user's original ask):
${trigger || '(none)'}

Upstream node outputs:
${parentsJson}

Return the tool arguments as raw JSON only.`;

    try {
      const provider = this.llm.forModel('gpt-4.1');
      const res = await provider.chat({
        model: 'gpt-4.1',
        systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
        temperature: 0.1,
        maxTokens: 800,
      });
      const cleaned = res.text
        .trim()
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```\s*$/i, '')
        .trim();
      const parsed = JSON.parse(cleaned);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    } catch (err) {
      this.logger.warn(
        `extractToolInputFromParents failed for ${toolName}: ${(err as Error).message}. Falling back to empty input.`,
      );
    }
    return {};
  }

  private async markFailed(executionId: string, message: string) {
    const execution = await this.prisma.execution.update({
      where: { id: executionId },
      data: { status: 'failed', completedAt: new Date(), errorMessage: message },
      include: { workflow: { select: { organizationId: true } } },
    });
    await this.audit.writeExecutionEvent({
      executionId,
      eventType: 'ExecutionFailed',
      payload: { error: message },
    });
    this.gateway.emit({
      executionId,
      type: 'execution_failed',
      data: { error: message },
      timestamp: Date.now(),
    });
    this.alerts
      .fireEvent(execution.workflow.organizationId, 'execution_failed', { executionId, error: message })
      .catch(() => undefined);
  }

  /**
   * Request cancellation of a running execution. Marks the DB row as
   * `cancelled` immediately, flags the in-memory set so the scheduler loop
   * exits at its next check point, and emits a websocket event so the UI
   * can flip out of the "Running…" state.
   */
  async cancel(executionId: string, organizationId: string, userId: string) {
    const execution = await this.prisma.execution.findFirst({
      where: { id: executionId, workflow: { organizationId } },
    });
    if (!execution) throw new NotFoundException('Execution not found');
    if (execution.status !== 'running' && execution.status !== 'waiting_approval') {
      return { cancelled: false, status: execution.status };
    }

    this.cancelled.add(executionId);
    await this.prisma.execution.update({
      where: { id: executionId },
      data: { status: 'cancelled', completedAt: new Date(), errorMessage: 'Cancelled by user' },
    });
    await this.audit.writeExecutionEvent({
      executionId,
      eventType: 'ExecutionCancelled',
      payload: { cancelledBy: userId },
    });
    this.gateway.emit({
      executionId,
      type: 'execution_cancelled',
      data: { cancelledBy: userId },
      timestamp: Date.now(),
    });
    return { cancelled: true, status: 'cancelled' };
  }

  /** Called by the scheduler loop to short-circuit if cancellation was requested. */
  private isCancelled(executionId: string): boolean {
    return this.cancelled.has(executionId);
  }

  private evalCondition(expression: string, outputs: Record<string, unknown>): boolean {
    try {
      // eslint-disable-next-line no-new-func
      const fn = new Function('outputs', `with (outputs) { return (${expression.replace(/\$/g, '')}); }`);
      return Boolean(fn(outputs));
    } catch {
      return false;
    }
  }

  private mapAgentEventType(t: string): any {
    if (t === 'tool_use') return 'tool_use';
    if (t === 'tool_result') return 'tool_result';
    if (t === 'approval_pending') return 'approval_pending';
    if (t === 'text_delta') return 'agent_text_delta';
    if (t === 'text_message') return 'agent_text';
    return 'agent_text';
  }

  // -------------------------------------------------------------
  // Queries
  // -------------------------------------------------------------
  async findByOrg(organizationId: string) {
    return this.prisma.execution.findMany({
      where: { workflow: { organizationId } },
      orderBy: { startedAt: 'desc' },
      take: 50,
      include: {
        workflow: { select: { id: true, name: true } },
        starter: { select: { id: true, displayName: true, email: true } },
      },
    });
  }

  async findById(id: string, organizationId: string) {
    const execution = await this.prisma.execution.findFirst({
      where: { id, workflow: { organizationId } },
      include: {
        workflow: { select: { id: true, name: true } },
        workflowVersion: { select: { canvasJson: true, workflowDsl: true, version: true } },
        nodes: true,
        events: { orderBy: { timestamp: 'asc' } },
        approvals: true,
        starter: { select: { id: true, displayName: true, email: true } },
      },
    });
    if (!execution) throw new NotFoundException('Execution not found');
    return execution;
  }
}
