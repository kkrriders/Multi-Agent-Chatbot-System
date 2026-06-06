'use client'

import { useCallback, useRef } from 'react'
import {
  ReactFlow,
  addEdge,
  useNodesState,
  useEdgesState,
  Background,
  Controls,
  MiniMap,
  type Connection,
  type Node,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

// ── Node palette definitions ─────────────────────────────────────────────────

export const NODE_TYPES = [
  { type: 'client',        label: 'Client / Browser',   color: '#e8f5e9', border: '#4caf50' },
  { type: 'mobile',        label: 'Mobile App',         color: '#e8f5e9', border: '#4caf50' },
  { type: 'api_gateway',   label: 'API Gateway',        color: '#e3f2fd', border: '#2196f3' },
  { type: 'load_balancer', label: 'Load Balancer',      color: '#e3f2fd', border: '#2196f3' },
  { type: 'service',       label: 'Microservice',       color: '#fff3e0', border: '#ff9800' },
  { type: 'worker',        label: 'Worker / Cron',      color: '#fff3e0', border: '#ff9800' },
  { type: 'cdn',           label: 'CDN',                color: '#f3e5f5', border: '#9c27b0' },
  { type: 'cache',         label: 'Cache (Redis)',       color: '#fce4ec', border: '#e91e63' },
  { type: 'queue',         label: 'Queue (Kafka/SQS)',  color: '#fce4ec', border: '#e91e63' },
  { type: 'sql_db',        label: 'SQL Database',       color: '#e0f2f1', border: '#009688' },
  { type: 'nosql_db',      label: 'NoSQL Database',     color: '#e0f2f1', border: '#009688' },
  { type: 'storage',       label: 'Object Storage (S3)',color: '#e0f2f1', border: '#009688' },
  { type: 'search',        label: 'Search (Elastic)',   color: '#fff8e1', border: '#ffc107' },
  { type: 'dns',           label: 'DNS',                color: '#f5f5f5', border: '#9e9e9e' },
] as const

let nodeId = 100

interface Props {
  initialDiagram?: string   // JSON string (React Flow state from templateDiagram)
  onChange?: (json: string) => void
  readonly?: boolean
}

export default function SystemDesignCanvas({ initialDiagram, onChange, readonly = false }: Props) {
  const initialState = (() => {
    try { return initialDiagram ? JSON.parse(initialDiagram) : { nodes: [], edges: [] } }
    catch { return { nodes: [], edges: [] } }
  })()

  const [nodes, setNodes, onNodesChange] = useNodesState(initialState.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialState.edges)
  const reactFlowWrapper = useRef<HTMLDivElement>(null)

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges(eds => addEdge({ ...connection, animated: false }, eds))
    },
    [setEdges]
  )

  // Notify parent of every change so it can snapshot for submission
  const notifyChange = useCallback((newNodes: Node[], newEdges: typeof edges) => {
    if (onChange) {
      onChange(JSON.stringify({ nodes: newNodes, edges: newEdges }))
    }
  }, [onChange])

  const handleNodesChange = useCallback((changes: Parameters<typeof onNodesChange>[0]) => {
    onNodesChange(changes)
    setNodes(nds => { notifyChange(nds, edges); return nds })
  }, [onNodesChange, setNodes, notifyChange, edges])

  const handleEdgesChange = useCallback((changes: Parameters<typeof onEdgesChange>[0]) => {
    onEdgesChange(changes)
    setEdges(eds => { notifyChange(nodes, eds); return eds })
  }, [onEdgesChange, setEdges, notifyChange, nodes])

  const addNode = (type: string, label: string, color: string, border: string) => {
    const id = String(++nodeId)
    const newNode: Node = {
      id,
      type: 'default',
      position: { x: 100 + Math.random() * 200, y: 100 + Math.random() * 200 },
      data: { label },
      style: { background: color, border: `2px solid ${border}`, borderRadius: 8, padding: '8px 12px', fontSize: 12, fontWeight: 600, minWidth: 120 },
    }
    setNodes(nds => {
      const updated = [...nds, newNode]
      notifyChange(updated, edges)
      return updated
    })
  }

  return (
    <div className="flex h-full gap-3">
      {/* Node palette */}
      {!readonly && (
        <div className="w-44 shrink-0 flex flex-col gap-1 overflow-y-auto">
          <p className="text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wide">Components</p>
          {NODE_TYPES.map(nt => (
            <button
              key={nt.type}
              onClick={() => addNode(nt.type, nt.label, nt.color, nt.border)}
              className="text-left text-xs px-3 py-2 rounded-lg border transition-all hover:scale-[1.02] hover:shadow-sm font-medium"
              style={{ background: nt.color, borderColor: nt.border, color: '#1a1a1a' }}
            >
              {nt.label}
            </button>
          ))}
          <p className="text-xs text-slate-400 mt-2">Drag nodes to reposition. Connect by dragging from a node handle.</p>
        </div>
      )}

      {/* Canvas */}
      <div ref={reactFlowWrapper} className="flex-1 rounded-xl border border-outline-variant/20 overflow-hidden" style={{ minHeight: 480 }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={readonly ? undefined : handleNodesChange}
          onEdgesChange={readonly ? undefined : handleEdgesChange}
          onConnect={readonly ? undefined : onConnect}
          fitView
          nodesDraggable={!readonly}
          nodesConnectable={!readonly}
          elementsSelectable={!readonly}
        >
          <Background gap={16} color="#e5e7eb" />
          <Controls />
          <MiniMap nodeColor={n => (n.style?.background as string) || '#eee'} />
        </ReactFlow>
      </div>
    </div>
  )
}
