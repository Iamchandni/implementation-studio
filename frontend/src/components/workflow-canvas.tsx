'use client';

import { useCallback, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type Connection,
  type EdgeProps,
  Handle,
  Position,
  BackgroundVariant,
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';
import {
  Bot,
  Wrench,
  GitBranch,
  User,
  Users,
  ArrowRight,
  Repeat,
  Clock,
  Layers,
  Search,
  X,
  Plus,
  Check,
  Loader2,
  Zap,
  Play,
  LayoutGrid,
  Sparkles,
} from 'lucide-react';
import { BrandIcon, BRAND_ICON_MAP, brandKeyFromToolName } from './brand-icons';
import { cn } from '@/lib/utils';

export type NodeStatus = 'idle' | 'running' | 'success' | 'failed';

export interface AcpNodeData extends Record<string, unknown> {
  label: string;
  subtitle?: string;
  kind: NodeKind;
  status?: NodeStatus;
  agentId?: string;
  agentVersionId?: string;
  mcpServerId?: string;
  mcpToolName?: string;
  connectionType?: string;
  systemPrompt?: string;
  model?: string;
  temperature?: number;
  toolIds?: string[];
  expression?: string;
  message?: string;
}

export type NodeKind =
  | 'user_prompt'
  | 'agent'
  | 'sub_agent'
  | 'mcp'
  | 'condition'
  | 'router'
  | 'transform'
  | 'delay'
  | 'aggregator';

interface KindMeta {
  label: string;
  icon: any;
  color: string;      // small hint used for the icon tint
}

export const KIND_META: Record<NodeKind, KindMeta> = {
  user_prompt: { label: 'User Prompt', icon: User, color: '#10b981' },
  agent: { label: 'Agent', icon: Bot, color: '#a78bfa' },
  sub_agent: { label: 'Sub Agent', icon: Users, color: '#ec4899' },
  mcp: { label: 'MCP', icon: Wrench, color: '#3b82f6' },
  condition: { label: 'Condition', icon: GitBranch, color: '#f59e0b' },
  router: { label: 'Router', icon: ArrowRight, color: '#eab308' },
  transform: { label: 'Transform', icon: Repeat, color: '#14b8a6' },
  delay: { label: 'Delay', icon: Clock, color: '#64748b' },
  aggregator: { label: 'Aggregator', icon: Layers, color: '#8b5cf6' },
};

// nodeTypes / edgeTypes are declared at module level, but the referenced
// component functions live below. Function declarations are hoisted so this
// works — however some Next.js Fast Refresh cycles trip on partial reloads.
// Using explicit references + a stable module-scope object keeps them stable
// (must not be recreated per-render — that would remount every node).
const nodeTypes: Record<string, any> = {};
const edgeTypes: Record<string, any> = {};

export interface CanvasProps {
  initialNodes?: Node[];
  initialEdges?: Edge[];
  onChange?: (nodes: Node<AcpNodeData>[], edges: Edge[]) => void;
  onNodeClick?: (node: Node<AcpNodeData>) => void;
  selectedNodeId?: string;
  readOnly?: boolean;
  /** In readOnly mode, callers pass the current node state (used for replay). */
  nodes?: Node<AcpNodeData>[];
  edges?: Edge[];
  /** Fired when the user clicks the floating center-bottom Run pill. */
  onRun?: () => void;
  /** Text on the Run pill (defaults to "Execute workflow"). */
  runLabel?: string;
  /** Optional disable state for the Run pill. */
  runDisabled?: boolean;
  /** When set, shows a sparkle AI-suggest button that opens a dialog. */
  onAiSuggest?: () => void;
}

let idCounter = 1;
const nextId = (prefix: string) => `${prefix}-${Date.now()}-${idCounter++}`;

export function WorkflowCanvas({
  initialNodes = [],
  initialEdges = [],
  onChange,
  onNodeClick,
  selectedNodeId,
  readOnly,
  nodes: controlledNodes,
  edges: controlledEdges,
  onRun,
  runLabel = 'Execute workflow',
  runDisabled,
  onAiSuggest,
}: CanvasProps) {
  const [internalNodes, setNodes, onNodesChange] = useNodesState<Node<AcpNodeData>>(initialNodes as Node<AcpNodeData>[]);
  const [internalEdges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const nodes = controlledNodes ?? internalNodes;
  const edges = controlledEdges ?? internalEdges;
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [search, setSearch] = useState('');
  /** When set, the palette is anchored to append AFTER this node. */
  const [appendAfterNodeId, setAppendAfterNodeId] = useState<string | null>(null);
  /** Right-click context menu state. */
  const [contextMenu, setContextMenu] = useState<{ nodeId: string; x: number; y: number } | null>(null);

  const notify = useCallback(
    (n: Node<AcpNodeData>[], e: Edge[]) => onChange?.(n, e),
    [onChange],
  );

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) => {
        const next = addEdge({ ...params, animated: false }, eds);
        notify(nodes, next);
        return next;
      });
    },
    [nodes, setEdges, notify],
  );

  const addNode = useCallback(
    (kind: NodeKind, extra?: Partial<AcpNodeData>) => {
      const meta = KIND_META[kind];
      // If we're appending after an existing node, place the new node to its
      // right and auto-connect right→left.
      const source = appendAfterNodeId ? nodes.find((n) => n.id === appendAfterNodeId) : null;
      const position = source
        ? { x: source.position.x + 220, y: source.position.y }
        : { x: 240 + Math.random() * 200, y: 100 + Math.random() * 300 };

      const newNode: Node<AcpNodeData> = {
        id: nextId(kind),
        type: 'acp',
        position,
        data: {
          label: extra?.label ?? meta.label,
          kind,
          status: 'idle',
          ...extra,
        },
      };
      const nextNodes = [...nodes, newNode];
      let nextEdges = edges;
      if (source) {
        nextEdges = addEdge(
          { source: source.id, target: newNode.id, sourceHandle: 'r-source', targetHandle: 'l-target', animated: false },
          edges,
        );
      }
      setNodes(nextNodes);
      setEdges(nextEdges);
      notify(nextNodes, nextEdges);
      setPaletteOpen(false);
      setAppendAfterNodeId(null);
    },
    [nodes, edges, setNodes, setEdges, notify, appendAfterNodeId],
  );

  /** Called from the AcpNode `+` button on the right handle. */
  const openAppendPalette = useCallback((nodeId: string) => {
    setAppendAfterNodeId(nodeId);
    setPaletteOpen(true);
    setSearch('');
  }, []);

  const runAutoLayout = useCallback(() => {
    const g = new dagre.graphlib.Graph();
    g.setGraph({ rankdir: 'LR', nodesep: 40, ranksep: 100 });
    g.setDefaultEdgeLabel(() => ({}));
    for (const n of nodes) g.setNode(n.id, { width: 100, height: 90 });
    for (const e of edges) g.setEdge(e.source, e.target);
    dagre.layout(g);
    const laidOut = nodes.map((n) => {
      const p = g.node(n.id);
      if (!p) return n;
      return { ...n, position: { x: p.x - 50, y: p.y - 45 } };
    });
    setNodes(laidOut);
    notify(laidOut, edges);
  }, [nodes, edges, setNodes, notify]);

  const openContext = useCallback((nodeId: string, x: number, y: number) => {
    setContextMenu({ nodeId, x, y });
  }, []);

  const duplicateNode = useCallback(
    (nodeId: string) => {
      const src = nodes.find((n) => n.id === nodeId);
      if (!src) return;
      const clone: Node<AcpNodeData> = {
        ...src,
        id: nextId(src.data.kind),
        position: { x: src.position.x + 40, y: src.position.y + 40 },
        selected: false,
        data: { ...src.data, status: 'idle' },
      };
      const next = [...nodes, clone];
      setNodes(next);
      notify(next, edges);
      setContextMenu(null);
    },
    [nodes, edges, setNodes, notify],
  );

  const deleteNodeById = useCallback(
    (nodeId: string) => {
      const nextNodes = nodes.filter((n) => n.id !== nodeId);
      const nextEdges = edges.filter((e) => e.source !== nodeId && e.target !== nodeId);
      setNodes(nextNodes);
      setEdges(nextEdges);
      notify(nextNodes, nextEdges);
      setContextMenu(null);
    },
    [nodes, edges, setNodes, setEdges, notify],
  );

  const renameNodeById = useCallback(
    (nodeId: string) => {
      const src = nodes.find((n) => n.id === nodeId);
      if (!src) return;
      const name = window.prompt('New label:', src.data.label);
      if (!name?.trim()) return;
      const next = nodes.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, label: name.trim() } } : n));
      setNodes(next);
      notify(next, edges);
      setContextMenu(null);
    },
    [nodes, edges, setNodes, notify],
  );

  return (
    <div className="h-full w-full relative">
      {/* Floating top-left toolbar */}
      {!readOnly && (
        <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
          <button
            onClick={() => setPaletteOpen(true)}
            className="w-9 h-9 rounded-md bg-card border border-border shadow-sm hover:bg-accent flex items-center justify-center"
            title="Add node"
          >
            <Plus className="w-4 h-4" />
          </button>
          {onAiSuggest && (
            <button
              onClick={onAiSuggest}
              className="h-9 px-3 rounded-md bg-gradient-to-r from-brand-indigo to-brand-green text-white shadow-sm hover:shadow-md hover:from-brand-indigo/90 hover:to-brand-green/90 flex items-center gap-1.5 text-xs font-medium"
              title="Generate workflow with AI"
            >
              <Sparkles className="w-3.5 h-3.5" />
              AI Build
            </button>
          )}
        </div>
      )}

      {/* Palette popover */}
      {paletteOpen && (
        <>
          <div
            className="absolute inset-0 z-20"
            onClick={() => setPaletteOpen(false)}
          />
          <div className="absolute top-14 left-3 z-30 w-64 max-h-[70vh] rounded-lg border border-border bg-popover shadow-xl overflow-hidden flex flex-col">
            <div className="p-2 border-b border-border/60 flex items-center justify-between">
              <div className="text-xs font-semibold px-1">Add Node</div>
              <button onClick={() => setPaletteOpen(false)} className="p-1 rounded hover:bg-accent">
                <X className="w-3 h-3" />
              </button>
            </div>
            <div className="p-2 border-b border-border/60">
              <div className="relative">
                <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  autoFocus
                  placeholder="Search nodes..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-7 pr-2 py-1.5 rounded border border-border bg-background text-xs"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-3">
              <PaletteSection title="Agents">
                <PaletteItem kind="user_prompt" onAdd={addNode} search={search} />
                <PaletteItem kind="agent" onAdd={addNode} search={search} />
                <PaletteItem kind="sub_agent" onAdd={addNode} search={search} />
              </PaletteSection>

              <PaletteSection title="MCP Servers">
                <McpPaletteItems onAdd={(type, name) => addNode('mcp', { connectionType: type, label: name, subtitle: 'MCP tool' })} search={search} />
              </PaletteSection>

              <PaletteSection title="Flow">
                <PaletteItem kind="condition" onAdd={addNode} search={search} />
                <PaletteItem kind="router" onAdd={addNode} search={search} />
                <PaletteItem kind="transform" onAdd={addNode} search={search} />
                <PaletteItem kind="delay" onAdd={addNode} search={search} />
                <PaletteItem kind="aggregator" onAdd={addNode} search={search} />
              </PaletteSection>
            </div>
          </div>
        </>
      )}

      <ReactFlow
        nodes={nodes.map((n, idx) => ({
          ...n,
          selected: n.id === selectedNodeId,
          data: {
            ...n.data,
            isSelected: n.id === selectedNodeId,
            // Mark the leftmost node in each connected sequence as the "entry"
            // so it gets the trigger badge + rounded corner treatment.
            isEntry: !edges.some((e) => e.target === n.id),
            onAppend: readOnly ? undefined : () => openAppendPalette(n.id),
            onContext: readOnly ? undefined : openContext,
          },
        }))}
        edges={edges.map((e) => ({ ...e, type: e.type ?? 'labeled' }))}
        onNodesChange={readOnly ? undefined : (changes) => {
          onNodesChange(changes);
          setTimeout(() => notify(nodes, edges), 0);
        }}
        onEdgesChange={readOnly ? undefined : (changes) => {
          onEdgesChange(changes);
          setTimeout(() => notify(nodes, edges), 0);
        }}
        onConnect={readOnly ? undefined : onConnect}
        nodesDraggable={!readOnly}
        nodesConnectable={!readOnly}
        elementsSelectable={!readOnly}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={(_, node) => onNodeClick?.(node as Node<AcpNodeData>)}
        onPaneClick={() => setPaletteOpen(false)}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="hsl(var(--border))" />
        <Controls showInteractive={false} className="!bottom-3 !left-3" />
        <MiniMap
          pannable
          zoomable
          className="!bg-card !border !border-border !rounded"
          nodeColor={(n) => {
            const kind = (n.data as any)?.kind as NodeKind | undefined;
            return kind ? KIND_META[kind]?.color ?? '#64748b' : '#64748b';
          }}
        />
      </ReactFlow>

      {/* Auto-layout button — bottom-left toolbar */}
      {!readOnly && nodes.length > 1 && (
        <button
          onClick={runAutoLayout}
          className="absolute bottom-3 left-[128px] z-10 w-9 h-9 rounded-md bg-card border border-border shadow-sm hover:bg-accent flex items-center justify-center"
          title="Auto-layout (left-to-right)"
        >
          <LayoutGrid className="w-4 h-4" />
        </button>
      )}

      {/* Big center-bottom Execute workflow pill */}
      {!readOnly && onRun && (
        <button
          onClick={onRun}
          disabled={runDisabled}
          className={cn(
            'absolute bottom-4 left-1/2 -translate-x-1/2 z-10 h-10 px-5 rounded-full font-medium text-sm flex items-center gap-2 shadow-lg transition-all',
            runDisabled
              ? 'bg-muted text-muted-foreground cursor-not-allowed'
              : 'bg-brand-green text-white hover:bg-brand-green/90 hover:shadow-xl',
          )}
        >
          <Play className="w-4 h-4" fill="currentColor" />
          {runLabel}
        </button>
      )}

      {/* Right-click context menu */}
      {contextMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} />
          <div
            className="fixed z-50 w-40 rounded-md border border-border bg-popover shadow-xl overflow-hidden"
            style={{ top: contextMenu.y, left: contextMenu.x }}
          >
            <button
              onClick={() => renameNodeById(contextMenu.nodeId)}
              className="w-full text-left px-3 py-1.5 text-xs hover:bg-accent flex items-center gap-2"
            >
              <span>Rename</span>
            </button>
            <button
              onClick={() => duplicateNode(contextMenu.nodeId)}
              className="w-full text-left px-3 py-1.5 text-xs hover:bg-accent flex items-center gap-2"
            >
              <span>Duplicate</span>
            </button>
            <div className="h-px bg-border/60" />
            <button
              onClick={() => deleteNodeById(contextMenu.nodeId)}
              className="w-full text-left px-3 py-1.5 text-xs hover:bg-destructive/10 text-destructive flex items-center gap-2"
            >
              <span>Delete</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function PaletteSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-1 mb-1">{title}</div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function PaletteItem({ kind, onAdd, search }: { kind: NodeKind; onAdd: (kind: NodeKind) => void; search: string }) {
  const meta = KIND_META[kind];
  if (search && !meta.label.toLowerCase().includes(search.toLowerCase())) return null;
  const Icon = meta.icon;
  return (
    <button
      onClick={() => onAdd(kind)}
      className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent transition-colors text-left text-xs"
    >
      <div className="w-6 h-6 rounded flex items-center justify-center bg-muted" style={{ color: meta.color }}>
        <Icon className="w-3.5 h-3.5" />
      </div>
      <span>{meta.label}</span>
    </button>
  );
}

function McpPaletteItems({ onAdd, search }: { onAdd: (type: string, name: string) => void; search: string }) {
  const mcpServers = [
    { type: 'github', name: 'GitHub' },
    { type: 'slack', name: 'Slack' },
    { type: 'postgres', name: 'Postgres' },
    { type: 'notion', name: 'Notion' },
    { type: 'gdrive', name: 'Google Drive' },
    { type: 'jira', name: 'Jira' },
  ];
  return (
    <>
      {mcpServers
        .filter((s) => !search || s.name.toLowerCase().includes(search.toLowerCase()))
        .map((s) => (
          <button
            key={s.type}
            onClick={() => onAdd(s.type, s.name)}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent transition-colors text-left text-xs"
          >
            <div className="w-6 h-6 rounded flex items-center justify-center bg-muted">
              <BrandIcon type={s.type} size={14} />
            </div>
            <span>{s.name}</span>
          </button>
        ))}
    </>
  );
}

/* ============================================================
 * Compact icon-first node — label lives BELOW the shape (n8n-style)
 * Entry nodes get a lightning-bolt trigger badge + rounded left edge.
 * On hover, a `+` button appears on the right side to append a new node.
 * ============================================================ */
function AcpNode({ data, id }: { id: string; data: AcpNodeData & { isSelected?: boolean; isEntry?: boolean; onAppend?: (fromHandle?: string) => void; onContext?: (id: string, x: number, y: number) => void } }) {
  const meta = KIND_META[data.kind];
  const isSelected = data.isSelected;
  const isEntry = data.isEntry;
  // Prefer explicit connectionType, then derive from mcpToolName like "gmail_send_email".
  const brandKey =
    (data.connectionType && BRAND_ICON_MAP[data.connectionType.toLowerCase()] ? data.connectionType.toLowerCase() : null) ??
    (data.kind === 'mcp' ? brandKeyFromToolName(data.mcpToolName) : null);
  const hasBrand = !!brandKey;

  // Validation: highlight nodes that are missing required config so the user
  // knows to click in and fill them out. Warning border trumps the normal ring.
  const missingConfig =
    (data.kind === 'mcp' && !data.mcpToolName && !data.mcpToolId) ||
    ((data.kind === 'agent' || data.kind === 'sub_agent') && !data.systemPrompt && !data.agentId) ||
    (data.kind === 'condition' && !data.expression);

  const ringClass =
    data.status === 'running' ? 'ring-2 ring-primary/60 shadow-lg shadow-primary/20' :
    data.status === 'success' ? 'ring-1 ring-brand-green/70' :
    data.status === 'failed' ? 'ring-2 ring-destructive/70' :
    isSelected ? 'ring-2 ring-primary' :
    missingConfig ? 'ring-2 ring-amber-500/60' :
    'ring-1 ring-border/70';

  const shapeClass = isEntry ? 'rounded-l-3xl rounded-r-lg' : 'rounded-lg';
  const isCondition = data.kind === 'condition';

  const Icon = meta.icon;

  return (
    <div
      className="group flex flex-col items-center"
      style={{ width: 80 }}
      onContextMenu={(e) => {
        e.preventDefault();
        data.onContext?.(id, e.clientX, e.clientY);
      }}
    >
      {/* Trigger badge (lightning) on the LEFT of entry nodes */}
      {isEntry && (
        <div
          className="absolute -left-4 top-1/2 -translate-y-8 z-10 w-6 h-6 rounded-full bg-destructive flex items-center justify-center shadow-md"
          title="Trigger"
        >
          <Zap className="w-3 h-3 text-white" fill="currentColor" />
        </div>
      )}

      {/* Missing-config warning badge */}
      {missingConfig && (
        <div
          className="absolute -left-4 top-1/2 translate-y-0 z-10 w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center shadow-md"
          title="Missing configuration — click node to configure"
        >
          <span className="text-white text-[10px] font-bold">!</span>
        </div>
      )}

      {/* Hover `+` button on the RIGHT to append the next node */}
      {data.onAppend && !isCondition && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            data.onAppend?.();
          }}
          className="absolute -right-6 top-1/2 -translate-y-8 z-10 w-6 h-6 rounded-md bg-card border border-border shadow-sm hover:bg-brand-green hover:border-brand-green hover:text-white text-muted-foreground opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center"
          title="Add next node"
        >
          <Plus className="w-3 h-3" strokeWidth={2.5} />
        </button>
      )}

      {/* The tile itself — handles anchored to this box */}
      <div
        className={cn(
          'w-16 h-16 bg-card border border-border/40 flex items-center justify-center transition-all relative',
          shapeClass,
          ringClass,
        )}
      >
        {/* Top */}
        <Handle id="t-target" type="target" position={Position.Top} className="!bg-muted-foreground/50" />
        <Handle id="t-source" type="source" position={Position.Top} className="!bg-muted-foreground/50 !opacity-0 hover:!opacity-100" />
        {/* Left target — how you connect INTO this node */}
        <Handle id="l-target" type="target" position={Position.Left} className="!bg-muted-foreground/50" />
        <Handle id="l-source" type="source" position={Position.Left} className="!bg-muted-foreground/50 !opacity-0 hover:!opacity-100" />
        {/* Bottom */}
        <Handle id="b-source" type="source" position={Position.Bottom} className="!bg-muted-foreground/50" />
        <Handle id="b-target" type="target" position={Position.Bottom} className="!bg-muted-foreground/50 !opacity-0 hover:!opacity-100" />

        {/* Right side — condition nodes get TWO named source handles (true/false).
           Everything else gets the standard single r-source. */}
        {isCondition ? (
          <>
            <Handle
              id="true-source"
              type="source"
              position={Position.Right}
              style={{ top: '30%' }}
              className="!bg-brand-green !w-2.5 !h-2.5"
            />
            <Handle
              id="false-source"
              type="source"
              position={Position.Right}
              style={{ top: '70%' }}
              className="!bg-destructive !w-2.5 !h-2.5"
            />
            <span className="absolute right-[-30px] top-[16%] text-[9px] font-medium text-brand-green pointer-events-none">true</span>
            <span className="absolute right-[-32px] top-[62%] text-[9px] font-medium text-destructive pointer-events-none">false</span>
            <Handle id="r-target" type="target" position={Position.Right} className="!bg-muted-foreground/50 !opacity-0 hover:!opacity-100" />
          </>
        ) : (
          <>
            <Handle id="r-target" type="target" position={Position.Right} className="!bg-muted-foreground/50" />
            <Handle id="r-source" type="source" position={Position.Right} className="!bg-muted-foreground/50 !opacity-0 hover:!opacity-100" />
          </>
        )}

        {hasBrand ? (
          <BrandIcon type={brandKey!} size={32} />
        ) : (
          <Icon className="w-7 h-7" style={{ color: meta.color }} />
        )}

        {data.status === 'success' && (
          <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-brand-green flex items-center justify-center border-2 border-background">
            <Check className="w-3 h-3 text-white" strokeWidth={3} />
          </div>
        )}
        {data.status === 'running' && (
          <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center border-2 border-background">
            <Loader2 className="w-3 h-3 text-white animate-spin" strokeWidth={3} />
          </div>
        )}
        {data.status === 'failed' && (
          <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-destructive flex items-center justify-center border-2 border-background">
            <X className="w-3 h-3 text-white" strokeWidth={3} />
          </div>
        )}
      </div>

      <div className="mt-2 flex flex-col items-center text-center max-w-[140px]">
        <div className="text-[12px] font-medium leading-tight truncate w-full">{data.label}</div>
        {(() => {
          const auto = deriveSubtitle(data);
          const shown = data.subtitle ?? auto;
          return shown ? (
            <div className="text-[10px] text-muted-foreground leading-tight mt-0.5 truncate w-full">{shown}</div>
          ) : null;
        })()}
      </div>
    </div>
  );
}

/** Compact one-liner shown under a node's label. Pulls from config so users
 *  see what the node will do without having to click into it. */
function deriveSubtitle(data: AcpNodeData): string | null {
  switch (data.kind) {
    case 'mcp':
      return data.mcpToolName ?? null;
    case 'agent':
    case 'sub_agent':
      return data.model ?? null;
    case 'condition':
      return data.expression ? `if ${data.expression.slice(0, 32)}${data.expression.length > 32 ? '…' : ''}` : null;
    case 'delay':
      return null;
    default:
      return null;
  }
}

/**
 * Bezier edge that renders an optional pill label in the middle.
 * Set `data.label` on the edge (e.g. "true", "false", "1 item") to activate.
 */
function LabeledEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style, markerEnd, data, sourceHandleId }: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });
  const explicitLabel = (data as any)?.label as string | undefined;
  // Auto-derive a label for condition true/false handles.
  const autoLabel =
    sourceHandleId === 'true-source' ? 'true' :
    sourceHandleId === 'false-source' ? 'false' :
    undefined;
  const label = explicitLabel ?? autoLabel;
  const tone =
    label === 'true' ? 'text-brand-green bg-brand-green/10 border-brand-green/40' :
    label === 'false' ? 'text-destructive bg-destructive/10 border-destructive/40' :
    'text-muted-foreground bg-card border-border';
  return (
    <>
      <BaseEdge id={id} path={edgePath} style={style} markerEnd={markerEnd} />
      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
            className={cn('nodrag nopan px-1.5 py-0.5 rounded text-[10px] border font-medium pointer-events-none', tone)}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

// Wire up the type registries now that the components are declared.
nodeTypes.acp = AcpNode;
edgeTypes.labeled = LabeledEdge;