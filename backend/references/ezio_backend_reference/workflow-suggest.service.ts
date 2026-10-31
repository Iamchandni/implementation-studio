import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { LlmRouter } from '../llm/llm-router.service';

interface SuggestedNode {
  id: string;
  type: 'acp';
  position: { x: number; y: number };
  data: {
    kind: string;
    label: string;
    subtitle?: string;
    mcpToolName?: string;
    systemPrompt?: string;
    model?: string;
    temperature?: number;
    expression?: string;
  };
}

interface SuggestedEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  data?: { label?: string };
}

export interface SuggestedWorkflow {
  name: string;
  description: string;
  canvas: { nodes: SuggestedNode[]; edges: SuggestedEdge[] };
  reasoning?: string;
}

@Injectable()
export class WorkflowSuggestService {
  private readonly logger = new Logger(WorkflowSuggestService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmRouter,
  ) {}

  async suggest(organizationId: string, prompt: string, model = 'gpt-4.1'): Promise<SuggestedWorkflow> {
    const tools = await this.prisma.mcpTool.findMany({
      where: {
        mcpServer: {
          connection: {
            status: 'connected',
            environment: { project: { workspace: { organizationId } } },
          },
        },
        hiddenFromAgents: false,
      },
      select: { toolName: true, description: true },
      take: 200,
    });

    const toolListing = tools
      .map((t) => `- ${t.toolName}${t.description ? `: ${t.description.slice(0, 100)}` : ''}`)
      .join('\n');

    const systemPrompt = SYSTEM_PROMPT;
    const userPrompt = `The user wants this workflow:\n\n"${prompt}"\n\nAvailable MCP tools:\n${toolListing || '(none — use agent nodes only)'}\n\nRespond with ONLY a JSON object in the format specified. No prose, no fences.`;

    const provider = this.llm.forModel(model);
    this.logger.log(`AI-suggesting workflow for: "${prompt.slice(0, 80)}..." with ${tools.length} tools available`);

    const res = await provider.chat({
      model,
      systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      temperature: 0.4,
      maxTokens: 3000,
    });

    const raw = res.text.trim();
    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/i, '')
      .trim();

    let parsed: any;
    try {
      parsed = JSON.parse(cleaned);
    } catch (err) {
      throw new Error(`LLM returned invalid JSON. First 200 chars: ${cleaned.slice(0, 200)}`);
    }

    // Basic shape validation with sensible fallbacks so a slightly-malformed
    // response still renders something on the canvas.
    const nodes: SuggestedNode[] = Array.isArray(parsed.nodes)
      ? parsed.nodes.map((n: any, idx: number) => ({
          id: String(n.id ?? `n${idx}`),
          type: 'acp',
          position: { x: n.position?.x ?? idx * 240, y: n.position?.y ?? 200 },
          data: {
            kind: String(n.data?.kind ?? 'agent'),
            label: String(n.data?.label ?? n.id ?? `Step ${idx + 1}`),
            subtitle: n.data?.subtitle,
            mcpToolName: n.data?.mcpToolName,
            systemPrompt: n.data?.systemPrompt,
            model: n.data?.model ?? 'gpt-4.1',
            temperature: n.data?.temperature,
            expression: n.data?.expression,
          },
        }))
      : [];

    const edges: SuggestedEdge[] = Array.isArray(parsed.edges)
      ? parsed.edges.map((e: any, idx: number) => ({
          id: String(e.id ?? `e${idx}`),
          source: String(e.source),
          target: String(e.target),
          sourceHandle: e.sourceHandle ?? 'r-source',
          targetHandle: e.targetHandle ?? 'l-target',
          data: e.data,
        }))
      : [];

    return {
      name: String(parsed.name ?? 'AI-Generated Workflow'),
      description: String(parsed.description ?? prompt),
      reasoning: parsed.reasoning ? String(parsed.reasoning) : undefined,
      canvas: { nodes, edges },
    };
  }
}

const SYSTEM_PROMPT = `You are a workflow architect for the Agent Control Plane platform. You design visual workflows that get executed as directed acyclic graphs.

# Canvas schema
A workflow is a JSON object with { name, description, nodes, edges, reasoning? }.

## Node shape
{
  "id": "<unique short id>",
  "type": "acp",
  "position": { "x": <number>, "y": <number> },
  "data": {
    "kind": "user_prompt" | "agent" | "sub_agent" | "mcp" | "condition" | "aggregator",
    "label": "<Short display name>",
    "subtitle": "<optional one-liner>",
    // agent/sub_agent nodes:
    "systemPrompt": "<system message>",
    "model": "gpt-4.1",
    "temperature": 0.1..1.0,
    // mcp nodes: reference an available tool by name
    "mcpToolName": "gmail_send_email",
    // condition nodes:
    "expression": "$parents.foo.severity === 'high'"
  }
}

## Edge shape
{
  "id": "e1",
  "source": "<source node id>",
  "target": "<target node id>",
  "sourceHandle": "r-source" | "true-source" | "false-source",
  "targetHandle": "l-target",
  "data": { "label": "optional pill label" }
}

# Layout rules (VERY important — layout is your responsibility)
- Left-to-right flow. Increment x by 240 per column, keep y ≈ 220 for sequential nodes.
- Parallel branches share the same x but stagger y by ±140.
- The FIRST node must be kind="user_prompt" (the trigger) at x=0.
- Every non-trigger node must have at least one incoming edge.
- Every non-terminal node must have at least one outgoing edge.
- Aggregator nodes merge multiple parents (fan-in) — position them at the same x as the merge point.

# Handle rules
- Sequential edges: sourceHandle="r-source", targetHandle="l-target"
- Condition edges: sourceHandle="true-source" or "false-source"

# Tool selection
- Prefer real MCP tools from the available list over generic agent nodes when the action is concrete (send email, create issue, find events).
- For decisions, insight, or transformation, use an agent node with a focused systemPrompt.
- Use condition nodes for branching logic based on prior outputs.

# Output format
Return ONLY a raw JSON object. No markdown fences, no explanation prose outside the "reasoning" field. The "reasoning" field (optional, ≤200 chars) briefly explains the workflow shape.

# Example
For "email me daily GitHub PRs":
{
  "name": "Daily PR Digest",
  "description": "Fetches open PRs each morning and emails a ranked summary",
  "reasoning": "Simple 3-step pipeline: fetch → summarize → email",
  "nodes": [
    { "id": "trigger", "type": "acp", "position": { "x": 0, "y": 220 }, "data": { "kind": "user_prompt", "label": "Trigger", "subtitle": "Cron 8 AM" } },
    { "id": "prs", "type": "acp", "position": { "x": 240, "y": 220 }, "data": { "kind": "mcp", "label": "Fetch Open PRs", "mcpToolName": "list_pull_requests" } },
    { "id": "summarize", "type": "acp", "position": { "x": 480, "y": 220 }, "data": { "kind": "agent", "label": "Summarize", "systemPrompt": "Rank PRs by staleness and importance", "model": "gpt-4.1", "temperature": 0.2 } },
    { "id": "email", "type": "acp", "position": { "x": 720, "y": 220 }, "data": { "kind": "mcp", "label": "Email Digest", "mcpToolName": "gmail_send_email" } }
  ],
  "edges": [
    { "id": "e1", "source": "trigger", "target": "prs", "sourceHandle": "r-source", "targetHandle": "l-target" },
    { "id": "e2", "source": "prs", "target": "summarize", "sourceHandle": "r-source", "targetHandle": "l-target" },
    { "id": "e3", "source": "summarize", "target": "email", "sourceHandle": "r-source", "targetHandle": "l-target" }
  ]
}`;
