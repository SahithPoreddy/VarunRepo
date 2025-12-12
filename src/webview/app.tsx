import React, { useCallback, useEffect, useState, useMemo } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  MarkerType,
  BackgroundVariant,
  NodeMouseHandler,
  MiniMap,
  Panel,
  Handle,
  Position,
} from 'reactflow';
import 'reactflow/dist/style.css';
import dagre from 'dagre';
import { createRoot } from 'react-dom/client';
import { marked } from 'marked';

// Configure marked for safe rendering
marked.setOptions({
  breaks: true,
  gfm: true,
});

// Markdown CSS styles to inject
const markdownStyles = `
.markdown-content {
  font-size: 14px;
  line-height: 1.6;
  color: #e2e8f0;
}
.markdown-content h1, .markdown-content h2, .markdown-content h3, 
.markdown-content h4, .markdown-content h5, .markdown-content h6 {
  color: #64ffda;
  margin: 12px 0 8px 0;
  font-weight: 600;
}
.markdown-content h1 { font-size: 1.4em; }
.markdown-content h2 { font-size: 1.25em; }
.markdown-content h3 { font-size: 1.1em; }
.markdown-content p {
  margin: 8px 0;
}
.markdown-content code {
  background: rgba(100, 255, 218, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 0.9em;
  color: #64ffda;
}
.markdown-content pre {
  background: rgba(0, 0, 0, 0.3);
  padding: 12px;
  border-radius: 8px;
  overflow-x: auto;
  margin: 10px 0;
  border: 1px solid rgba(100, 255, 218, 0.1);
}
.markdown-content pre code {
  background: transparent;
  padding: 0;
  color: #cbd5e1;
}
.markdown-content ul, .markdown-content ol {
  margin: 8px 0;
  padding-left: 24px;
}
.markdown-content li {
  margin: 4px 0;
}
.markdown-content blockquote {
  border-left: 3px solid #64ffda;
  margin: 10px 0;
  padding-left: 12px;
  color: #94a3b8;
  font-style: italic;
}
.markdown-content a {
  color: #64ffda;
  text-decoration: none;
}
.markdown-content a:hover {
  text-decoration: underline;
}
.markdown-content table {
  border-collapse: collapse;
  width: 100%;
  margin: 10px 0;
}
.markdown-content th, .markdown-content td {
  border: 1px solid #334155;
  padding: 8px 12px;
  text-align: left;
}
.markdown-content th {
  background: rgba(100, 255, 218, 0.1);
  color: #64ffda;
}
.markdown-content hr {
  border: none;
  border-top: 1px solid #334155;
  margin: 16px 0;
}
`;

// Declare VS Code API type
declare const acquireVsCodeApi: () => {
  postMessage: (message: unknown) => void;
  getState: () => unknown;
  setState: (state: unknown) => void;
};

const vscode = acquireVsCodeApi();

// ============ Types ============
interface GraphData {
  nodes: NodeData[];
  edges: EdgeData[];
}

interface NodeData {
  id: string;
  label: string;
  type: 'file' | 'class' | 'function' | 'method' | 'component' | 'module' | 'entry' | 'package' | 'interface' | 'enum' | 'field' | 'decorator';
  filePath?: string;
  description?: string;
  parentId?: string;
  metadata?: {
    lineStart?: number;
    lineEnd?: number;
    parameters?: string[];
    returnType?: string;
    complexity?: number;
    docstring?: string;
    imports?: string[];
    exports?: string[];
  };
}

interface EdgeData {
  source: string;
  target: string;
  label?: string;
  type?: string;
}

interface PopupData {
  nodeId: string;
  label: string;
  type: string;
  filePath?: string;
  description?: string;
  content?: string;
  parentId?: string;
  parentLabel?: string;
  hierarchy?: string[];
  metadata?: {
    lineStart?: number;
    lineEnd?: number;
    parameters?: string[];
    returnType?: string;
    complexity?: number;
    docstring?: string;
    imports?: string[];
    exports?: string[];
    // AI-generated fields
    aiSummary?: string;
    aiDescription?: string;
    technicalDetails?: string;
    patterns?: string[];
    usageExamples?: string[];
    keywords?: string[];
  };
}

// ============ Styles ============
const styles = {
  container: {
    width: '100vw',
    height: '100vh',
    background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 50%, #cbd5e1 100%)',
    position: 'relative' as const,
    overflow: 'hidden',
  },
  loading: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    color: '#475569',
    gap: '20px',
  },
  spinner: {
    width: '50px',
    height: '50px',
    border: '3px solid rgba(100, 255, 218, 0.1)',
    borderTop: '3px solid #64ffda',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  error: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    color: '#ff6b6b',
    gap: '15px',
    padding: '20px',
    textAlign: 'center' as const,
  },
  statsPanelContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'stretch',
  },
  statsPanelHeader: {
    background: 'rgba(30, 41, 59, 0.95)',
    backdropFilter: 'blur(10px)',
    borderRadius: '12px 12px 0 0',
    padding: '10px 16px',
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
    border: '1px solid rgba(100, 255, 218, 0.2)',
    borderBottom: 'none',
    color: '#e2e8f0',
    fontSize: '13px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    userSelect: 'none' as const,
  },
  statsPanelHeaderCollapsed: {
    borderRadius: '12px',
    borderBottom: '1px solid rgba(100, 255, 218, 0.2)',
  },
  statsCloseButton: {
    background: 'rgba(239, 68, 68, 0.1)',
    border: 'none',
    borderRadius: '4px',
    padding: '4px 6px',
    color: '#ef4444',
    cursor: 'pointer',
    fontSize: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease',
  },
  statsOpenButton: {
    background: 'rgba(30, 41, 59, 0.95)',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(100, 255, 218, 0.2)',
    borderRadius: '8px',
    padding: '8px 12px',
    color: '#64ffda',
    cursor: 'pointer',
    fontSize: '14px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
    transition: 'all 0.2s ease',
  },
  copilotButton: {
    background: 'linear-gradient(135deg, #f472b6 0%, #ec4899 100%)',
    border: 'none',
    borderRadius: '12px',
    padding: '10px 16px',
    color: '#ffffff',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    boxShadow: '0 4px 16px rgba(236, 72, 153, 0.4)',
    transition: 'all 0.2s ease',
  },
  statsPanelToggle: {
    background: 'transparent',
    border: 'none',
    color: '#64ffda',
    fontSize: '14px',
    cursor: 'pointer',
    padding: '4px 8px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    transition: 'transform 0.3s ease',
  },
  statsPanel: {
    background: 'rgba(30, 41, 59, 0.95)',
    backdropFilter: 'blur(10px)',
    borderRadius: '0 0 12px 12px',
    padding: '16px 20px',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
    border: '1px solid rgba(100, 255, 218, 0.2)',
    borderTop: 'none',
    color: '#e2e8f0',
    fontSize: '13px',
    display: 'flex',
    gap: '20px',
    alignItems: 'center',
    overflow: 'hidden',
    transition: 'max-height 0.3s ease, padding 0.3s ease, opacity 0.3s ease',
  },
  statsPanelCollapsed: {
    maxHeight: '0',
    padding: '0 20px',
    opacity: 0,
    border: 'none',
  },
  statsPanelExpanded: {
    maxHeight: '300px',
    opacity: 1,
  },
  statItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  statValue: {
    color: '#64ffda',
    fontWeight: 600,
    fontSize: '16px',
  },
  statLabel: {
    color: '#94a3b8',
  },
};

// ============ Node Colors ============
const nodeColors: Record<string, { bg: string; border: string; text: string }> = {
  entry: { bg: '#7c3aed', border: '#a78bfa', text: '#ffffff' },
  file: { bg: '#3b82f6', border: '#60a5fa', text: '#ffffff' },
  class: { bg: '#10b981', border: '#34d399', text: '#ffffff' },
  function: { bg: '#f59e0b', border: '#fbbf24', text: '#1a1a2e' },
  method: { bg: '#ef4444', border: '#f87171', text: '#ffffff' },
  component: { bg: '#ec4899', border: '#f472b6', text: '#ffffff' },
  module: { bg: '#06b6d4', border: '#22d3ee', text: '#1a1a2e' },
  package: { bg: '#8b5cf6', border: '#a78bfa', text: '#ffffff' },
};

// ============ Type Icons ============
const typeIcons: Record<string, string> = {
  entry: '🚀',
  file: '📄',
  class: '🏛️',
  function: '⚡',
  method: '🔧',
  component: '⚛️',
  module: '📦',
  package: '📚',
};

// ============ Layout Helper - Horizontal (LR = Left to Right) ============
const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'LR') => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({
    rankdir: direction,
    nodesep: 80,      // Vertical spacing between nodes in same rank
    ranksep: 200,     // Horizontal spacing between ranks (parent-child distance)
    marginx: 50,
    marginy: 50,
    acyclicer: 'greedy',
    ranker: 'network-simplex'
  });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: 250, height: 70 });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  return {
    nodes: nodes.map((node) => {
      const nodeWithPosition = dagreGraph.node(node.id);
      return {
        ...node,
        position: {
          x: nodeWithPosition.x - 125,
          y: nodeWithPosition.y - 35,
        },
      };
    }),
    edges,
  };
};

// ============ Custom Node Component with Expand/Collapse ============
const CustomNode = ({ data }: {
  data: {
    label: string;
    type: string;
    isExpanded?: boolean;
    hasChildren?: boolean;
    childCount?: number;
    depth?: number;
    isRoot?: boolean;
    nodeId?: string;
  }
}) => {
  const colors = nodeColors[data.type] || nodeColors.file;
  const icon = typeIcons[data.type] || '📄';
  const depth = data.depth || 0;

  // Calculate glow intensity based on depth
  const glowIntensity = Math.max(0.15, 0.4 - (depth * 0.08));
  const nodeScale = Math.max(0.85, 1 - (depth * 0.03));

  // Handle expand button click - prevent event bubbling and dispatch toggle event
  const handleExpandClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    e.nativeEvent.stopImmediatePropagation();
    console.log('Expand button clicked for node:', data.nodeId, 'current expanded:', data.isExpanded);
    // Dispatch custom event that the parent can listen to
    if (data.nodeId) {
      window.dispatchEvent(new CustomEvent('nodeExpandToggle', {
        detail: { nodeId: data.nodeId }
      }));
    }
  };

  // Stop propagation on pointer/mouse down to prevent ReactFlow from handling
  const handlePointerDown = (e: React.PointerEvent | React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <>
      {/* Left Handle - for incoming edges from parent */}
      <Handle
        type="target"
        position={Position.Left}
        style={{
          background: colors.border,
          border: '2px solid #0f172a',
          width: '10px',
          height: '10px',
          borderRadius: '50%',
        }}
      />

      <div
        style={{
          background: `linear-gradient(145deg, ${colors.bg}ee 0%, ${colors.bg}cc 50%, ${colors.bg}aa 100%)`,
          border: `2px solid ${colors.border}`,
          borderRadius: '14px',
          padding: '14px 18px',
          color: colors.text,
          fontSize: `${13 * nodeScale}px`,
          fontWeight: 600,
          minWidth: `${180 * nodeScale}px`,
          maxWidth: `${260 * nodeScale}px`,
          textAlign: 'center',
          boxShadow: `
            0 4px 20px ${colors.bg}${Math.round(glowIntensity * 255).toString(16).padStart(2, '0')},
            0 0 40px ${colors.border}${Math.round(glowIntensity * 0.5 * 255).toString(16).padStart(2, '0')},
            inset 0 1px 0 rgba(255,255,255,0.1)
          `,
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          cursor: 'pointer',
          position: 'relative' as const,
        }}
      >
        {/* Header with icon and type */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          marginBottom: data.hasChildren ? '8px' : '0',
        }}>
          {/* Icon */}
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            background: 'rgba(0,0,0,0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '18px',
            flexShrink: 0,
          }}>
            {icon}
          </div>

          {/* Label */}
          <div style={{
            flex: 1,
            textAlign: 'left',
            overflow: 'hidden',
          }}>
            <div style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontWeight: 700,
              letterSpacing: '0.02em',
            }}>
              {data.label}
            </div>
            <div style={{
              fontSize: '10px',
              opacity: 0.7,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              marginTop: '2px',
            }}>
              {data.type}
            </div>
          </div>
        </div>

        {/* Expand/Collapse button - click to toggle, pointer down to stop propagation */}
        {data.hasChildren && (
          <div
            onClick={handleExpandClick}
            onPointerDown={handlePointerDown}
            onMouseDown={handlePointerDown}
            className="expand-button"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '8px',
              background: data.isExpanded
                ? 'rgba(239, 68, 68, 0.25)'
                : 'rgba(34, 197, 94, 0.25)',
              border: `1px solid ${data.isExpanded ? 'rgba(239, 68, 68, 0.5)' : 'rgba(34, 197, 94, 0.5)'}`,
              fontSize: '11px',
              fontWeight: 600,
              transition: 'all 0.2s ease',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            <span style={{ fontSize: '14px', fontWeight: 800 }}>
              {data.isExpanded ? '−' : '+'}
            </span>
            <span>
              {data.isExpanded ? 'Collapse' : `Expand (${data.childCount})`}
            </span>
          </div>
        )}

        {/* Child count badge - shown when collapsed */}
        {data.hasChildren && !data.isExpanded && data.childCount && data.childCount > 0 && (
          <div
            style={{
              position: 'absolute',
              top: '-10px',
              right: '-10px',
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
              color: '#fff',
              borderRadius: '12px',
              padding: '3px 8px',
              fontSize: '11px',
              fontWeight: 700,
              minWidth: '20px',
              textAlign: 'center',
              boxShadow: '0 2px 10px rgba(99, 102, 241, 0.5)',
              border: '2px solid #0f172a',
            }}
          >
            {data.childCount}
          </div>
        )}

        {/* Root indicator */}
        {data.isRoot && (
          <div
            style={{
              position: 'absolute',
              top: '-10px',
              left: '-10px',
              background: 'linear-gradient(135deg, #f59e0b 0%, #f97316 100%)',
              color: '#fff',
              borderRadius: '6px',
              padding: '2px 6px',
              fontSize: '9px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              boxShadow: '0 2px 8px rgba(245, 158, 11, 0.5)',
              border: '2px solid #0f172a',
            }}
          >
            ROOT
          </div>
        )}
      </div>

      {/* Right Handle - for outgoing edges to children */}
      <Handle
        type="source"
        position={Position.Right}
        style={{
          background: colors.border,
          border: '2px solid #0f172a',
          width: '10px',
          height: '10px',
          borderRadius: '50%',
        }}
      />
    </>
  );
};

const nodeTypes = { custom: CustomNode };

// ============ API Key Configuration Modal ============
const ApiKeyConfigModal = ({
  onClose,
  onConfigure,
}: {
  onClose: () => void;
  onConfigure: () => void;
}) => {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(8px)',
        zIndex: 3000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        animation: 'fadeIn 0.2s ease',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)',
          borderRadius: '20px',
          padding: '32px',
          maxWidth: '480px',
          width: '90%',
          border: '1px solid rgba(100, 255, 218, 0.2)',
          boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5)',
          animation: 'slideUp 0.3s ease',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Icon */}
        <div style={{
          width: '72px',
          height: '72px',
          borderRadius: '20px',
          background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.2) 0%, rgba(245, 158, 11, 0.2) 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 20px',
          border: '1px solid rgba(251, 191, 36, 0.3)',
        }}>
          <span style={{ fontSize: '36px' }}>🔑</span>
        </div>

        {/* Title */}
        <h2 style={{
          margin: '0 0 12px 0',
          textAlign: 'center',
          color: '#f1f5f9',
          fontSize: '22px',
          fontWeight: 600,
        }}>
          API Key Required
        </h2>

        {/* Description */}
        <p style={{
          margin: '0 0 24px 0',
          textAlign: 'center',
          color: '#94a3b8',
          fontSize: '14px',
          lineHeight: 1.6,
        }}>
          To use <strong style={{ color: '#64ffda' }}>AI-powered documentation</strong>, <strong style={{ color: '#64ffda' }}>RAG search</strong>, and <strong style={{ color: '#64ffda' }}>intelligent answers</strong>, you need to configure an API key.
        </p>

        {/* Features List */}
        <div style={{
          background: 'rgba(100, 255, 218, 0.05)',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '24px',
          border: '1px solid rgba(100, 255, 218, 0.1)',
        }}>
          <p style={{ margin: '0 0 12px 0', color: '#64ffda', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Features Unlocked with API Key
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[
              { icon: '📝', text: 'AI-Generated Documentation', desc: 'Rich, detailed docs for all code components' },
              { icon: '🧠', text: 'Intelligent RAG Answers', desc: 'Ask questions and get smart, context-aware answers' },
              { icon: '📚', text: 'View Full Docs Panel', desc: 'Browse comprehensive project documentation' },
              { icon: '🎭', text: 'Persona-Based Views', desc: 'Developer, Architect, PM, and BA perspectives' },
            ].map((feature, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <span style={{ fontSize: '16px' }}>{feature.icon}</span>
                <div>
                  <span style={{ color: '#e2e8f0', fontSize: '13px', fontWeight: 500 }}>{feature.text}</span>
                  <p style={{ margin: '2px 0 0 0', color: '#64748b', fontSize: '11px' }}>{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Supported Providers */}
        <div style={{
          background: 'rgba(139, 92, 246, 0.05)',
          borderRadius: '12px',
          padding: '12px 16px',
          marginBottom: '24px',
          border: '1px solid rgba(139, 92, 246, 0.1)',
        }}>
          <p style={{ margin: '0 0 8px 0', color: '#a78bfa', fontSize: '11px', fontWeight: 600 }}>
            Supported Providers
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {['OpenAI', 'Anthropic', 'Azure OpenAI', 'LiteLLM Proxy', 'Ollama'].map((provider, i) => (
              <span
                key={i}
                style={{
                  padding: '4px 10px',
                  borderRadius: '12px',
                  background: 'rgba(139, 92, 246, 0.1)',
                  color: '#c4b5fd',
                  fontSize: '11px',
                }}
              >
                {provider}
              </span>
            ))}
          </div>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: '14px 20px',
              borderRadius: '12px',
              border: '1px solid rgba(100, 116, 139, 0.3)',
              background: 'rgba(100, 116, 139, 0.1)',
              color: '#94a3b8',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            Maybe Later
          </button>
          <button
            onClick={onConfigure}
            style={{
              flex: 1,
              padding: '14px 20px',
              borderRadius: '12px',
              border: 'none',
              background: 'linear-gradient(135deg, #64ffda 0%, #38bdf8 100%)',
              color: '#0f172a',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
              boxShadow: '0 4px 15px rgba(100, 255, 218, 0.3)',
            }}
          >
            🔑 Configure API Key
          </button>
        </div>
      </div>
    </div>
  );
};

// ============ Full Documentation Panel - Right Side Slide ============
const DocsPanel = ({
  docsData,
  personaFormattedDocs,
  onClose,
  onNodeClick,
  persona
}: {
  docsData: {
    version: string;
    projectName: string;
    generatedAt: string;
    architecture: { overview: string; layers: string[]; patterns: string[] };
    nodes: Record<string, any>;
    generatedWithAI: boolean;
  } | null;
  personaFormattedDocs: string | null;
  onClose: () => void;
  onNodeClick: (nodeId: string) => void;
  persona: 'developer' | 'product-manager' | 'architect' | 'business-analyst';
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');

  const personaDisplayNames: Record<string, string> = {
    'developer': '👨‍💻 Developer',
    'architect': '🏗️ Architect',
    'product-manager': '📋 Product Manager',
    'business-analyst': '📊 Business Analyst',
  };

  // If we have persona formatted docs from LLM, show that instead
  if (personaFormattedDocs) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(8px)',
        zIndex: 3000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        animation: 'fadeIn 0.2s ease',
      }}>
        <div style={{
          width: '90%',
          maxWidth: '900px',
          maxHeight: '90vh',
          background: 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)',
          borderRadius: '20px',
          border: '1px solid rgba(100, 255, 218, 0.2)',
          boxShadow: '0 25px 80px rgba(0, 0, 0, 0.6)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            padding: '20px 24px',
            borderBottom: '1px solid rgba(100, 255, 218, 0.1)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'rgba(100, 255, 218, 0.05)',
          }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '18px', color: '#fff', display: 'flex', alignItems: 'center', gap: '10px' }}>
                📚 {docsData?.projectName || 'Project'} Documentation
              </h2>
              <p style={{ margin: '4px 0 0 0', color: '#94a3b8', fontSize: '12px' }}>
                {personaDisplayNames[persona]} View
              </p>
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '8px',
                width: '36px',
                height: '36px',
                cursor: 'pointer',
                color: '#ef4444',
                fontSize: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              ✕
            </button>
          </div>

          {/* Content */}
          <div style={{
            flex: 1,
            overflow: 'auto',
            padding: '24px 32px',
          }}>
            <div
              className="markdown-content"
              style={{
                color: '#e2e8f0',
                fontSize: '14px',
                lineHeight: 1.8,
              }}
              dangerouslySetInnerHTML={{ __html: marked(personaFormattedDocs) as string }}
            />
          </div>
        </div>
      </div>
    );
  }

  // Original DocsPanel logic for node-based docs
  if (!docsData) return null;

  const nodeList = Object.values(docsData.nodes || {});
  const nodeTypes = Array.from(new Set(nodeList.map((n: any) => n.type)));

  // Get persona-specific content for a node
  const getPersonaContent = (node: any) => {
    switch (persona) {
      case 'developer':
        return {
          primary: node.aiDescription || node.aiSummary || 'No description available',
          secondary: node.technicalDetails || '',
          badge: node.aiComplexity || 'medium',
          badgeLabel: 'Complexity',
          focusFields: ['signature', 'dependencies', 'codeSnippet'],
        };
      case 'architect':
        return {
          primary: node.technicalDetails || node.aiSummary || 'No architecture details',
          secondary: (node.patterns || []).join(', ') || 'No patterns detected',
          badge: node.type,
          badgeLabel: 'Type',
          focusFields: ['patterns', 'layers', 'dependencies'],
        };
      case 'product-manager':
        return {
          primary: node.aiSummary || 'No summary available',
          secondary: (node.aiKeyFeatures || []).slice(0, 3).join(' • ') || 'No features listed',
          badge: node.type === 'function' ? 'Feature' : node.type === 'class' ? 'Module' : 'Component',
          badgeLabel: 'Category',
          focusFields: ['aiKeyFeatures', 'aiSummary'],
        };
      case 'business-analyst':
        return {
          primary: node.aiSummary || 'No business context',
          secondary: `Located in ${node.relativePath || node.filePath || 'unknown location'}`,
          badge: node.type,
          badgeLabel: 'Asset Type',
          focusFields: ['aiSummary', 'relativePath'],
        };
      default:
        return {
          primary: node.aiSummary || 'No description',
          secondary: '',
          badge: node.type,
          badgeLabel: 'Type',
          focusFields: [],
        };
    }
  };

  // Persona-specific overview content
  const getPersonaOverview = () => {
    switch (persona) {
      case 'developer':
        return {
          title: '💻 Technical Overview',
          description: 'Detailed technical documentation for developers including code structure, dependencies, and implementation details.',
        };
      case 'architect':
        return {
          title: '🏗️ Architecture Overview',
          description: 'High-level system architecture, design patterns, and component relationships for architectural decision-making.',
        };
      case 'product-manager':
        return {
          title: '📋 Product Overview',
          description: 'Feature-focused documentation highlighting capabilities, modules, and user-facing functionality.',
        };
      case 'business-analyst':
        return {
          title: '📊 Business Overview',
          description: 'Business context and asset inventory for stakeholder communication and requirement mapping.',
        };
      default:
        return {
          title: '📚 Project Overview',
          description: 'General project documentation.',
        };
    }
  };

  // Filter nodes based on search and type
  const filteredNodes = nodeList.filter((node: any) => {
    const matchesSearch = !searchTerm ||
      node.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      node.aiSummary?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = selectedType === 'all' || node.type === selectedType;
    return matchesSearch && matchesType;
  });

  // Persona display names
  const personaLabels: Record<string, string> = {
    'developer': '👨‍💻 Developer',
    'product-manager': '📋 Product Manager',
    'architect': '🏗️ Architect',
    'business-analyst': '📊 Business Analyst',
  };

  // Render markdown content safely
  const renderMarkdown = (content: string): string => {
    if (!content) return '';
    try {
      return marked(content) as string;
    } catch {
      return content;
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: '600px',
        background: 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)',
        borderLeft: '1px solid rgba(100, 255, 218, 0.2)',
        zIndex: 1100,
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '-10px 0 40px rgba(0, 0, 0, 0.5)',
        animation: 'slideInRight 0.3s ease',
      }}
    >
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(100, 255, 218, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%)',
        padding: '16px 20px',
        borderBottom: '1px solid rgba(100, 255, 218, 0.2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '16px', color: '#fff', display: 'flex', alignItems: 'center', gap: '10px' }}>
            📚 {docsData.projectName} Documentation
          </h2>
          <p style={{ margin: '4px 0 0 0', color: '#94a3b8', fontSize: '11px' }}>
            {personaLabels[persona]} View • {nodeList.length} components
          </p>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '8px',
            width: '32px',
            height: '32px',
            cursor: 'pointer',
            color: '#ef4444',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          ✕
        </button>
      </div>

      {/* Unified Content - Single Scrollable Overview */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
        {/* Warning Banner if No AI */}
        {!docsData.generatedWithAI && (
          <div style={{
            background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.1) 0%, rgba(245, 158, 11, 0.1) 100%)',
            border: '1px solid rgba(251, 191, 36, 0.3)',
            borderRadius: '12px',
            padding: '14px 16px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
          }}>
            <span style={{ fontSize: '20px' }}>🔑</span>
            <div>
              <p style={{ margin: '0 0 6px 0', color: '#fbbf24', fontSize: '13px', fontWeight: 600 }}>
                Basic Documentation Mode
              </p>
              <p style={{ margin: 0, color: '#94a3b8', fontSize: '12px', lineHeight: 1.5 }}>
                This documentation was generated without AI. For richer, more detailed docs with insights and examples, 
                configure an API key and regenerate.
              </p>
            </div>
          </div>
        )}

        {/* Persona-Specific Header */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(100, 255, 218, 0.15) 0%, rgba(139, 92, 246, 0.15) 100%)',
          padding: '16px',
          borderRadius: '12px',
          border: '1px solid rgba(100, 255, 218, 0.3)',
          marginBottom: '16px',
        }}>
          <h3 style={{ margin: '0 0 8px 0', color: '#64ffda', fontSize: '16px' }}>
            {getPersonaOverview().title}
          </h3>
          <p style={{ margin: 0, color: '#e2e8f0', fontSize: '12px', lineHeight: 1.6 }}>
            {getPersonaOverview().description}
          </p>
        </div>

        {/* Project Overview Section */}
        <div style={{
          background: 'rgba(100, 255, 218, 0.05)',
          padding: '16px',
          borderRadius: '10px',
          border: '1px solid rgba(100, 255, 218, 0.2)',
          marginBottom: '16px',
        }}>
          <h3 style={{ margin: '0 0 12px 0', color: '#64ffda', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            📊 Project Summary
          </h3>
          <div
            className="markdown-content"
            style={{ color: '#e2e8f0', lineHeight: 1.7, fontSize: '13px' }}
            dangerouslySetInnerHTML={{ __html: renderMarkdown(docsData.architecture?.overview || 'No overview available. Configure an API key in settings for AI-generated documentation.') }}
          />
        </div>

        {/* Quick Stats */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '10px',
          marginBottom: '16px',
        }}>
          <div style={{
            background: '#1e293b',
            padding: '14px',
            borderRadius: '10px',
            textAlign: 'center',
            border: '1px solid rgba(100, 255, 218, 0.1)',
          }}>
            <div style={{ color: '#64ffda', fontSize: '24px', fontWeight: 700 }}>{nodeList.length}</div>
            <div style={{ color: '#94a3b8', fontSize: '11px' }}>Components</div>
          </div>
          <div style={{
            background: '#1e293b',
            padding: '14px',
            borderRadius: '10px',
            textAlign: 'center',
            border: '1px solid rgba(139, 92, 246, 0.1)',
          }}>
            <div style={{ color: '#a78bfa', fontSize: '24px', fontWeight: 700 }}>{nodeTypes.length}</div>
            <div style={{ color: '#94a3b8', fontSize: '11px' }}>Types</div>
          </div>
          <div style={{
            background: '#1e293b',
            padding: '14px',
            borderRadius: '10px',
            textAlign: 'center',
            border: '1px solid rgba(251, 191, 36, 0.1)',
          }}>
            <div style={{ color: '#fbbf24', fontSize: '24px', fontWeight: 700 }}>{docsData.architecture?.patterns?.length || 0}</div>
            <div style={{ color: '#94a3b8', fontSize: '11px' }}>Patterns</div>
          </div>
        </div>

        {/* Architecture Layers */}
        {docsData.architecture?.layers?.length > 0 && (
          <div style={{
            background: '#1e293b',
            padding: '16px',
            borderRadius: '10px',
            marginBottom: '16px',
            border: '1px solid rgba(100, 255, 218, 0.1)',
          }}>
            <h4 style={{ margin: '0 0 12px 0', color: '#64ffda', fontSize: '13px' }}>🏢 Architecture Layers</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {docsData.architecture.layers.slice(0, 8).map((layer: string, i: number) => (
                <div key={i} style={{
                  background: 'rgba(100, 255, 218, 0.08)',
                  padding: '10px 14px',
                  borderRadius: '6px',
                  color: '#e2e8f0',
                  fontSize: '12px',
                  borderLeft: '3px solid #64ffda',
                }}>
                  {layer}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Design Patterns */}
        {docsData.architecture?.patterns?.length > 0 && (
          <div style={{
            background: '#1e293b',
            padding: '16px',
            borderRadius: '10px',
            marginBottom: '16px',
            border: '1px solid rgba(139, 92, 246, 0.1)',
          }}>
            <h4 style={{ margin: '0 0 12px 0', color: '#a78bfa', fontSize: '13px' }}>🎯 Detected Patterns</h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {docsData.architecture.patterns.map((pattern: string, i: number) => (
                <span key={i} style={{
                  background: 'rgba(139, 92, 246, 0.15)',
                  color: '#a78bfa',
                  padding: '6px 12px',
                  borderRadius: '16px',
                  fontSize: '11px',
                  fontWeight: 500,
                }}>
                  ✓ {pattern}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Component Search & List */}
        <div style={{
          background: '#1e293b',
          padding: '16px',
          borderRadius: '10px',
          border: '1px solid rgba(100, 255, 218, 0.1)',
        }}>
          <h4 style={{ margin: '0 0 12px 0', color: '#64ffda', fontSize: '13px' }}>🧩 Components</h4>
          
          {/* Search */}
          <input
            type="text"
            placeholder="🔍 Search components..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: '8px',
              border: '1px solid rgba(100, 255, 218, 0.2)',
              background: 'rgba(15, 23, 42, 0.8)',
              color: '#e2e8f0',
              fontSize: '12px',
              outline: 'none',
              marginBottom: '10px',
              boxSizing: 'border-box',
            }}
          />

          {/* Type Filter */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
            <button
              onClick={() => setSelectedType('all')}
              style={{
                padding: '5px 12px',
                borderRadius: '14px',
                border: 'none',
                background: selectedType === 'all' ? '#64ffda' : 'rgba(100, 255, 218, 0.1)',
                color: selectedType === 'all' ? '#0f172a' : '#64ffda',
                fontSize: '10px',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              All ({nodeList.length})
            </button>
            {nodeTypes.map((type: string) => (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                style={{
                  padding: '5px 12px',
                  borderRadius: '14px',
                  border: 'none',
                  background: selectedType === type ? '#64ffda' : 'rgba(100, 255, 218, 0.1)',
                  color: selectedType === type ? '#0f172a' : '#64ffda',
                  fontSize: '10px',
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                {type} ({nodeList.filter((n: any) => n.type === type).length})
              </button>
            ))}
          </div>

          {/* Component List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '400px', overflow: 'auto' }}>
            {filteredNodes.slice(0, 30).map((node: any, i: number) => {
              const personaContent = getPersonaContent(node);
              return (
                <div
                  key={i}
                  onClick={() => onNodeClick(node.id || node.name)}
                  style={{
                    background: 'rgba(15, 23, 42, 0.6)',
                    padding: '12px 14px',
                    borderRadius: '8px',
                    border: '1px solid rgba(100, 255, 218, 0.1)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ color: '#64ffda', fontWeight: 600, fontSize: '13px' }}>{node.name}</span>
                    <span style={{
                      fontSize: '9px',
                      padding: '2px 8px',
                      borderRadius: '10px',
                      background: personaContent.badge === 'high' ? 'rgba(239, 68, 68, 0.2)' :
                                 personaContent.badge === 'low' ? 'rgba(34, 197, 94, 0.2)' :
                                 'rgba(100, 255, 218, 0.1)',
                      color: personaContent.badge === 'high' ? '#ef4444' :
                             personaContent.badge === 'low' ? '#22c55e' : '#64ffda',
                      fontWeight: 600,
                    }}>
                      {personaContent.badge}
                    </span>
                  </div>
                  <p style={{ margin: '0 0 4px 0', color: '#e2e8f0', fontSize: '11px', lineHeight: 1.5 }}>
                    {personaContent.primary.substring(0, 150)}{personaContent.primary.length > 150 ? '...' : ''}
                  </p>
                  {personaContent.secondary && (
                    <p style={{ margin: 0, color: '#64748b', fontSize: '10px', fontStyle: 'italic' }}>
                      {personaContent.secondary.substring(0, 100)}{personaContent.secondary.length > 100 ? '...' : ''}
                    </p>
                  )}
                </div>
              );
            })}
            {filteredNodes.length > 30 && (
              <div style={{ textAlign: 'center', color: '#64748b', fontSize: '11px', padding: '10px' }}>
                +{filteredNodes.length - 30} more components • Use search to filter
              </div>
            )}
            {filteredNodes.length === 0 && (
              <div style={{ textAlign: 'center', color: '#64748b', fontSize: '12px', padding: '20px' }}>
                No components match your search
              </div>
            )}
          </div>
        </div>

        {/* AI Notice */}
        {!docsData.generatedWithAI && (
          <div style={{
            background: 'rgba(251, 191, 36, 0.1)',
            border: '1px solid rgba(251, 191, 36, 0.3)',
            borderRadius: '10px',
            padding: '14px',
            marginTop: '16px',
          }}>
            <p style={{ margin: 0, color: '#fbbf24', fontSize: '11px', lineHeight: 1.6 }}>
              ⚠️ <strong>Rule-Based Documentation</strong>: This documentation was generated using pattern matching. 
              For richer, more detailed AI-generated docs, configure your API key in VS Code settings 
              (codebaseVisualizer.litellm.apiKey).
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

// ============ Popup Component ============
const NodePopup = ({
  data,
  onClose,
  onSendToCline,
  onOpenFile,
  allNodes,
  nodeDocs
}: {
  data: PopupData;
  onClose: () => void;
  onSendToCline: (nodeId: string, query: string) => void;
  onOpenFile: (filePath: string, line?: number) => void;
  allNodes: NodeData[];
  nodeDocs?: any; // Docs from docs.json
}) => {
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'details' | 'agentassist'>('overview');

  // Safe access to colors
  const colors = nodeColors[data?.type] || nodeColors.file;
  const icon = typeIcons[data?.type] || '📄';

  // Safely get metadata - merge with nodeDocs if available
  const metadata = data?.metadata || {};
  const filePath = data?.filePath || '';
  const label = data?.label || 'Unknown';
  const nodeType = data?.type || 'unknown';

  const handleSendToCline = () => {
    if (!query.trim() || !data?.nodeId) return;
    onSendToCline(data.nodeId, query);
    setQuery('');
  };

  // Safe parameter formatting
  const formatParam = (param: any): string => {
    if (!param) return 'unknown';
    if (typeof param === 'string') return param;
    if (typeof param === 'object') {
      const name = param.name || 'param';
      const optional = param.optional ? '?' : '';
      const type = param.type ? `: ${param.type}` : '';
      return `${name}${optional}${type}`;
    }
    return String(param);
  };

  // Safe string conversion
  const safeString = (val: any): string => {
    if (!val) return '';
    if (typeof val === 'string') return val;
    try {
      return JSON.stringify(val);
    } catch {
      return String(val);
    }
  };

  // Render markdown content safely
  const renderMarkdown = (content: string): string => {
    if (!content) return '';
    try {
      return marked(content) as string;
    } catch {
      return content;
    }
  };

  // Get arrays safely - merge metadata with nodeDocs (nodeDocs takes priority for AI content)
  const parameters = Array.isArray(nodeDocs?.parameters) ? nodeDocs.parameters :
    Array.isArray(metadata.parameters) ? metadata.parameters : [];
  const imports = Array.isArray(nodeDocs?.dependencies) ? nodeDocs.dependencies :
    Array.isArray(metadata.imports) ? metadata.imports : [];
  const exports = Array.isArray(nodeDocs?.dependents) ? nodeDocs.dependents :
    Array.isArray(metadata.exports) ? metadata.exports : [];
  const patterns = Array.isArray(nodeDocs?.patterns) ? nodeDocs.patterns :
    Array.isArray(metadata.patterns) ? metadata.patterns : [];
  const usageExamples = Array.isArray(nodeDocs?.usageExamples) ? nodeDocs.usageExamples :
    Array.isArray(metadata.usageExamples) ? metadata.usageExamples : [];
  const keywords = Array.isArray(nodeDocs?.keywords) ? nodeDocs.keywords :
    Array.isArray(metadata.keywords) ? metadata.keywords : [];
  const aiKeyFeatures = Array.isArray(nodeDocs?.aiKeyFeatures) ? nodeDocs.aiKeyFeatures : [];
  const returnType = safeString(nodeDocs?.returnType || metadata.returnType);
  const docstring = safeString(metadata.docstring);

  // AI documentation - prioritize nodeDocs (from docs.json)
  const aiSummary = safeString(nodeDocs?.aiSummary || metadata.aiSummary);
  const aiDescription = safeString(nodeDocs?.aiDescription || metadata.aiDescription);
  const technicalDetails = safeString(nodeDocs?.technicalDetails || metadata.technicalDetails);
  const aiPurpose = safeString(nodeDocs?.aiPurpose);
  const aiComplexity = nodeDocs?.aiComplexity || 'medium';

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#1e293b',
          borderRadius: '12px',
          width: '90%',
          maxWidth: '600px',
          maxHeight: '80vh',
          overflow: 'hidden',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
          border: '1px solid #334155',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          background: colors.bg,
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #334155',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '24px' }}>{icon}</span>
            <div>
              <h2 style={{
                margin: 0,
                fontSize: '18px',
                fontWeight: 600,
                color: '#fff'
              }}>
                {label}
              </h2>
              <span style={{
                fontSize: '12px',
                color: 'rgba(255,255,255,0.7)',
                textTransform: 'uppercase',
              }}>
                {nodeType}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              borderRadius: '8px',
              width: '32px',
              height: '32px',
              cursor: 'pointer',
              color: '#fff',
              fontSize: '16px',
            }}
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid #334155',
          background: '#0f172a',
        }}>
          {['overview', 'details', 'agentassist'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              style={{
                flex: 1,
                padding: '12px',
                border: 'none',
                background: activeTab === tab ? 'rgba(100, 255, 218, 0.1)' : 'transparent',
                color: activeTab === tab ? '#64ffda' : '#94a3b8',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 500,
                borderBottom: activeTab === tab ? '2px solid #64ffda' : '2px solid transparent',
              }}
            >
              {tab === 'overview' && '📋 Overview'}
              {tab === 'details' && '🤖 AI Docs'}
              {tab === 'agentassist' && '🔧 AgentAssist'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{
          padding: '20px',
          overflowY: 'auto',
          maxHeight: 'calc(80vh - 140px)',
          background: '#0f172a',
        }}>

          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {/* File Path */}
              {filePath && (
                <div
                  onClick={() => onOpenFile(filePath, metadata.lineStart)}
                  style={{
                    background: '#1e293b',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    border: '1px solid #334155',
                  }}
                >
                  <div style={{ fontSize: '11px', color: '#64ffda', marginBottom: '4px', fontWeight: 600 }}>
                    📁 FILE (Click to open)
                  </div>
                  <code style={{ color: '#fbbf24', fontSize: '13px', wordBreak: 'break-all' }}>
                    {filePath}
                  </code>
                  {metadata.lineStart && (
                    <div style={{ color: '#94a3b8', fontSize: '12px', marginTop: '4px' }}>
                      Line {metadata.lineStart}{metadata.lineEnd ? ` - ${metadata.lineEnd}` : ''}
                    </div>
                  )}
                </div>
              )}

              {/* Description */}
              <div style={{
                background: '#1e293b',
                padding: '12px 16px',
                borderRadius: '8px',
                border: '1px solid #334155',
              }}>
                <div style={{ fontSize: '11px', color: '#64ffda', marginBottom: '8px', fontWeight: 600 }}>
                  📝 DESCRIPTION
                </div>
                <div
                  style={{ margin: 0, color: '#e2e8f0', fontSize: '14px', lineHeight: 1.6 }}
                  className="markdown-content"
                  dangerouslySetInnerHTML={{
                    __html: renderMarkdown(aiSummary || aiDescription || data?.description || data?.content || docstring || 'No description available.')
                  }}
                />
              </div>

              {/* AI Documentation - if available */}
              {(aiDescription || technicalDetails) && (
                <div style={{
                  background: 'linear-gradient(135deg, rgba(100, 255, 218, 0.05) 0%, rgba(139, 92, 246, 0.05) 100%)',
                  padding: '16px',
                  borderRadius: '12px',
                  border: '1px solid rgba(100, 255, 218, 0.3)',
                }}>
                  <div style={{
                    fontSize: '12px',
                    color: '#64ffda',
                    marginBottom: '12px',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    borderBottom: '1px solid rgba(100, 255, 218, 0.2)',
                    paddingBottom: '8px'
                  }}>
                    <span>🤖</span> AI DOCUMENTATION
                  </div>
                  {aiDescription && (
                    <div
                      style={{
                        margin: '0 0 12px 0',
                        color: '#e2e8f0',
                        fontSize: '14px',
                        lineHeight: 1.7
                      }}
                      className="markdown-content"
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(aiDescription) }}
                    />
                  )}
                  {technicalDetails && (
                    <div style={{
                      background: 'rgba(0,0,0,0.3)',
                      padding: '12px',
                      borderRadius: '8px',
                      marginTop: '8px',
                      border: '1px solid rgba(100, 255, 218, 0.1)',
                    }}>
                      <div style={{
                        fontSize: '11px',
                        color: '#94a3b8',
                        marginBottom: '8px',
                        fontWeight: 600
                      }}>
                        📋 Technical Details
                      </div>
                      <div
                        style={{
                          color: '#cbd5e1',
                          fontSize: '13px',
                          lineHeight: 1.6
                        }}
                        className="markdown-content"
                        dangerouslySetInnerHTML={{ __html: renderMarkdown(technicalDetails) }}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Usage Examples */}
              {usageExamples.length > 0 && (
                <div style={{
                  background: 'rgba(59, 130, 246, 0.1)',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                }}>
                  <div style={{ fontSize: '11px', color: '#60a5fa', marginBottom: '8px', fontWeight: 600 }}>
                    💡 USAGE EXAMPLES
                  </div>
                  {usageExamples.map((example: any, i: number) => (
                    <div
                      key={i}
                      style={{
                        background: 'rgba(0,0,0,0.2)',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        marginBottom: i < usageExamples.length - 1 ? '8px' : 0,
                        fontSize: '13px',
                        color: '#e2e8f0',
                        fontFamily: 'monospace'
                      }}
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(safeString(example)) }}
                    />
                  ))}
                </div>
              )}

              {/* Keywords / Tags */}
              {keywords.length > 0 && (
                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '6px',
                }}>
                  {keywords.map((keyword: any, i: number) => (
                    <span key={i} style={{
                      background: 'rgba(139, 92, 246, 0.2)',
                      color: '#a78bfa',
                      padding: '4px 10px',
                      borderRadius: '12px',
                      fontSize: '11px',
                      fontWeight: 500,
                    }}>
                      {safeString(keyword)}
                    </span>
                  ))}
                </div>
              )}

              {/* Quick Info */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '12px',
              }}>
                <div style={{
                  background: '#1e293b',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  border: '1px solid #334155',
                }}>
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>Type</div>
                  <div style={{ color: '#fff', fontSize: '14px' }}>{icon} {nodeType}</div>
                </div>
                {metadata.complexity && (
                  <div style={{
                    background: '#1e293b',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    border: '1px solid #334155',
                  }}>
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>Complexity</div>
                    <div style={{ color: '#fff', fontSize: '14px' }}>
                      {metadata.complexity <= 5 ? '🟢' : metadata.complexity <= 10 ? '🟡' : '🔴'} {metadata.complexity}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Details Tab - AI Documentation & Sample Code */}
          {activeTab === 'details' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {/* AI Documentation - Primary */}
              {(aiSummary || aiDescription || technicalDetails) ? (
                <div style={{
                  background: 'linear-gradient(135deg, rgba(100, 255, 218, 0.08) 0%, rgba(139, 92, 246, 0.08) 100%)',
                  padding: '16px',
                  borderRadius: '12px',
                  border: '1px solid rgba(100, 255, 218, 0.3)',
                }}>
                  <div style={{
                    fontSize: '12px',
                    color: '#64ffda',
                    marginBottom: '12px',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    borderBottom: '1px solid rgba(100, 255, 218, 0.2)',
                    paddingBottom: '8px'
                  }}>
                    <span>🤖</span> AI-GENERATED DOCUMENTATION
                  </div>

                  {aiSummary && (
                    <div style={{ marginBottom: aiDescription || technicalDetails ? '12px' : 0 }}>
                      <div style={{
                        fontSize: '11px',
                        color: '#94a3b8',
                        marginBottom: '6px',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em'
                      }}>
                        Summary
                      </div>
                      <div
                        style={{
                          color: '#e2e8f0',
                          fontSize: '14px',
                          lineHeight: 1.7
                        }}
                        className="markdown-content"
                        dangerouslySetInnerHTML={{ __html: renderMarkdown(aiSummary) }}
                      />
                    </div>
                  )}

                  {aiDescription && (
                    <div style={{ marginBottom: technicalDetails ? '12px' : 0 }}>
                      <div style={{
                        fontSize: '11px',
                        color: '#94a3b8',
                        marginBottom: '6px',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em'
                      }}>
                        Description
                      </div>
                      <div
                        style={{
                          color: '#e2e8f0',
                          fontSize: '14px',
                          lineHeight: 1.7
                        }}
                        className="markdown-content"
                        dangerouslySetInnerHTML={{ __html: renderMarkdown(aiDescription) }}
                      />
                    </div>
                  )}

                  {technicalDetails && (
                    <div style={{
                      background: 'rgba(0,0,0,0.3)',
                      padding: '12px',
                      borderRadius: '8px',
                      border: '1px solid rgba(100, 255, 218, 0.1)',
                    }}>
                      <div style={{
                        fontSize: '11px',
                        color: '#94a3b8',
                        marginBottom: '8px',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em'
                      }}>
                        📋 Technical Details
                      </div>
                      <div
                        style={{
                          color: '#cbd5e1',
                          fontSize: '13px',
                          lineHeight: 1.6
                        }}
                        className="markdown-content"
                        dangerouslySetInnerHTML={{ __html: renderMarkdown(technicalDetails) }}
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div style={{
                  background: 'rgba(59, 130, 246, 0.1)',
                  padding: '16px',
                  borderRadius: '12px',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: '24px', marginBottom: '8px' }}>🤖</div>
                  <p style={{ margin: 0, color: '#60a5fa', fontSize: '13px' }}>
                    No AI documentation generated yet.
                  </p>
                  <p style={{ margin: '4px 0 0 0', color: '#94a3b8', fontSize: '11px' }}>
                    Click "Generate" in the stats panel to create AI documentation.
                  </p>
                </div>
              )}

              {/* Sample Code / Usage Examples */}
              {usageExamples.length > 0 && (
                <div style={{
                  background: 'rgba(139, 92, 246, 0.1)',
                  padding: '16px',
                  borderRadius: '12px',
                  border: '1px solid rgba(139, 92, 246, 0.3)',
                }}>
                  <div style={{ fontSize: '12px', color: '#a78bfa', marginBottom: '12px', fontWeight: 600 }}>
                    💡 SAMPLE CODE & USAGE
                  </div>
                  {usageExamples.map((example: any, i: number) => (
                    <pre key={i} style={{
                      margin: i === 0 ? 0 : '8px 0 0 0',
                      padding: '12px',
                      background: 'rgba(0,0,0,0.4)',
                      borderRadius: '8px',
                      color: '#e2e8f0',
                      fontSize: '12px',
                      whiteSpace: 'pre-wrap',
                      fontFamily: 'Monaco, Consolas, "JetBrains Mono", monospace',
                      overflowX: 'auto',
                      border: '1px solid rgba(139, 92, 246, 0.2)',
                    }}>
                      {safeString(example)}
                    </pre>
                  ))}
                </div>
              )}

              {/* Parameters & Return Type */}
              {(parameters.length > 0 || returnType) && (
                <div style={{
                  background: '#1e293b',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  border: '1px solid #334155',
                }}>
                  <div style={{ fontSize: '11px', color: '#64ffda', marginBottom: '8px', fontWeight: 600 }}>
                    📥 SIGNATURE
                  </div>
                  {parameters.length > 0 && (
                    <div style={{ marginBottom: returnType ? '8px' : 0 }}>
                      <div style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '4px' }}>Parameters:</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {parameters.map((p: any, i: number) => (
                          <span key={i} style={{
                            background: 'rgba(100, 255, 218, 0.1)',
                            color: '#64ffda',
                            padding: '4px 10px',
                            borderRadius: '4px',
                            fontSize: '12px',
                            fontFamily: 'monospace',
                          }}>
                            {formatParam(p)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {returnType && (
                    <div>
                      <div style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '4px' }}>Returns:</div>
                      <code style={{ color: '#fbbf24', fontSize: '13px' }}>{returnType}</code>
                    </div>
                  )}
                </div>
              )}

              {/* Patterns Detected */}
              {patterns.length > 0 && (
                <div style={{
                  background: '#1e293b',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  border: '1px solid #334155',
                }}>
                  <div style={{ fontSize: '11px', color: '#64ffda', marginBottom: '8px', fontWeight: 600 }}>
                    🎯 PATTERNS DETECTED
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {patterns.map((pattern: any, i: number) => (
                      <span key={i} style={{
                        background: 'rgba(251, 191, 36, 0.1)',
                        color: '#fbbf24',
                        padding: '4px 10px',
                        borderRadius: '4px',
                        fontSize: '12px',
                      }}>
                        {safeString(pattern)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* AgentAssist Tab */}
          {activeTab === 'agentassist' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{
                background: '#1e293b',
                padding: '12px 16px',
                borderRadius: '8px',
                border: '1px solid #334155',
              }}>
                <p style={{ margin: 0, color: '#94a3b8', fontSize: '13px' }}>
                  Describe what changes you want AgentAssist to make to <strong style={{ color: '#64ffda' }}>{label}</strong>.
                </p>
              </div>

              <textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="E.g., Add error handling, refactor to async/await..."
                style={{
                  width: '100%',
                  minHeight: '100px',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid #334155',
                  background: '#1e293b',
                  color: '#e2e8f0',
                  fontSize: '14px',
                  resize: 'vertical',
                  fontFamily: 'inherit',
                }}
              />

              <button
                onClick={handleSendToCline}
                disabled={!query.trim()}
                style={{
                  background: query.trim() 
                    ? 'linear-gradient(135deg, #64ffda 0%, #4fd1c5 100%)' 
                    : '#334155',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '12px 20px',
                  color: query.trim() ? '#0f172a' : '#64748b',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: query.trim() ? 'pointer' : 'not-allowed',
                  boxShadow: query.trim() ? '0 4px 12px rgba(100, 255, 218, 0.3)' : 'none',
                  transition: 'all 0.2s ease',
                }}
              >
                🚀 Send to AgentAssist
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============ Main App ============
const App = () => {
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [popupData, setPopupData] = useState<PopupData | null>(null);
  const [isGeneratingDocs, setIsGeneratingDocs] = useState(false);
  const [docsGenerated, setDocsGenerated] = useState(false);
  const [apiKeyConfigured, setApiKeyConfigured] = useState<boolean | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingChanges, setPendingChanges] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [currentBranch, setCurrentBranch] = useState<string | null>(null);
  const [statsPanelOpen, setStatsPanelOpen] = useState(true);

  // Docs state - loaded from docs.json for instant access
  const [docsData, setDocsData] = useState<{
    version: string;
    projectName: string;
    generatedAt: string;
    architecture: { overview: string; layers: string[]; patterns: string[] };
    nodes: Record<string, any>;
    generatedWithAI: boolean;
  } | null>(null);
  const [showDocsPanel, setShowDocsPanel] = useState(false);
  const [showCopilotPanel, setShowCopilotPanel] = useState(false);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [showViewDocsPersonaModal, setShowViewDocsPersonaModal] = useState(false);
  const [viewDocsLoading, setViewDocsLoading] = useState(false);
  const [selectedPersona, setSelectedPersona] = useState<'developer' | 'product-manager' | 'architect' | 'business-analyst'>('developer');
  const [personaFormattedDocs, setPersonaFormattedDocs] = useState<string | null>(null);
  const [qaQuestion, setQaQuestion] = useState('');
  const [qaAnswer, setQaAnswer] = useState<{
    answer: string;
    relevantNodes: Array<{ name: string; type: string; summary: string; filePath: string; score: number }>;
    confidence: 'high' | 'medium' | 'low';
  } | null>(null);
  const [qaLoading, setQaLoading] = useState(false);
  const [qaHistory, setQaHistory] = useState<Array<{ question: string; answer: string; timestamp: Date }>>([]);

  // Track expanded nodes for collapsible tree
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  // Prevent duplicate requests and re-renders
  const isRequestingGraphRef = React.useRef(false);
  const hasInitializedRef = React.useRef(false);

  // Helper: Get docs for a specific node from docsData
  const getNodeDocs = useCallback((nodeId: string) => {
    if (!docsData?.nodes) return null;
    return docsData.nodes[nodeId] || null;
  }, [docsData]);

  // Build parent-children map for efficient lookup
  // Uses BOTH node.parentId AND edges with type 'contains' or 'calls'
  const childrenMap = useMemo(() => {
    if (!graphData) return new Map<string, string[]>();
    const map = new Map<string, string[]>();
    const nodeIds = new Set(graphData.nodes.map(n => n.id));

    // Method 1: From node.parentId (if set)
    graphData.nodes.forEach(node => {
      if (node.parentId && nodeIds.has(node.parentId)) {
        const children = map.get(node.parentId) || [];
        if (!children.includes(node.id)) {
          children.push(node.id);
          map.set(node.parentId, children);
        }
      }
    });

    // Method 2: From edges - 'contains' means parent contains child
    // Also consider 'calls' edges for function call hierarchy
    graphData.edges.forEach(edge => {
      if (edge.type === 'contains' || edge.type === 'uses') {
        if (nodeIds.has(edge.source) && nodeIds.has(edge.target)) {
          const children = map.get(edge.source) || [];
          if (!children.includes(edge.target)) {
            children.push(edge.target);
            map.set(edge.source, children);
          }
        }
      }
    });

    // Debug logging
    console.log('Children map built:', {
      totalParents: map.size,
      entries: Array.from(map.entries()).slice(0, 5)
    });

    return map;
  }, [graphData]);

  // Compute which nodes are children (targets of containment)
  const childNodeIds = useMemo(() => {
    const childIds = new Set<string>();
    childrenMap.forEach(children => {
      children.forEach(childId => childIds.add(childId));
    });
    return childIds;
  }, [childrenMap]);

  // Get set of all node IDs that have at least one connection (not dangling)
  const connectedNodeIds = useMemo(() => {
    if (!graphData) return new Set<string>();
    const connected = new Set<string>();
    graphData.edges.forEach(e => {
      connected.add(e.source);
      connected.add(e.target);
    });
    return connected;
  }, [graphData]);

  // Filter out dangling nodes (nodes with no connections)
  const nonDanglingNodes = useMemo(() => {
    if (!graphData) return [];
    // Keep only nodes that have at least one edge connection
    const filtered = graphData.nodes.filter(n => connectedNodeIds.has(n.id));
    console.log(`Filtered ${graphData.nodes.length - filtered.length} dangling nodes, showing ${filtered.length} connected nodes`);
    return filtered;
  }, [graphData, connectedNodeIds]);

  // COLLAPSED BY DEFAULT: Only show root nodes initially
  // Root nodes = nodes that are NOT the target of any 'contains' edge and are not children
  const rootNodes = useMemo(() => {
    if (!graphData || nonDanglingNodes.length === 0) return [];
    
    // Find nodes that are contained by other nodes
    const containedIds = new Set<string>();
    graphData.edges.forEach(e => {
      if (e.type === 'contains') {
        containedIds.add(e.target);
      }
    });
    // Also check parentId
    nonDanglingNodes.forEach(n => {
      if (n.parentId) containedIds.add(n.id);
    });
    
    // Root nodes are those not contained by anything
    const roots = nonDanglingNodes.filter(n => !containedIds.has(n.id));
    
    // If no roots found (all nodes have parents), show all non-dangling nodes
    if (roots.length === 0) {
      console.log(`No root nodes found, showing all ${nonDanglingNodes.length} connected nodes`);
      return nonDanglingNodes;
    }
    
    console.log(`Showing ${roots.length} root nodes (collapsed by default)`);
    return roots;
  }, [graphData, nonDanglingNodes]);

  // COLLAPSED BY DEFAULT: Only show root nodes + expanded children
  const visibleNodeIds = useMemo(() => {
    if (!graphData) return new Set<string>();
    
    const visible = new Set<string>();
    
    // Add all root nodes
    rootNodes.forEach(node => visible.add(node.id));
    
    // Recursively add children of expanded nodes
    const addChildren = (parentId: string) => {
      if (expandedNodes.has(parentId)) {
        const children = childrenMap.get(parentId) || [];
        children.forEach(childId => {
          // Only add if not a dangling node
          if (connectedNodeIds.has(childId)) {
            visible.add(childId);
            addChildren(childId); // Recurse for nested children
          }
        });
      }
    };
    
    rootNodes.forEach(node => addChildren(node.id));
    
    return visible;
  }, [graphData, rootNodes, expandedNodes, childrenMap, connectedNodeIds]);

  // Keep projectType for potential future use but don't use it for filtering
  const projectType = useMemo(() => {
    if (!graphData) return 'unknown';

    // Check for React/JS project indicators
    const hasReactIndicators = graphData.nodes.some(n => {
      const label = n.label.toLowerCase();
      return n.type === 'component' ||
        label.includes('index') ||
        label.includes('.tsx') ||
        label.includes('.jsx') ||
        n.type === 'module';
    });

    // Check for Java project indicators
    const hasJavaIndicators = graphData.nodes.some(n =>
      n.type === 'class' || n.type === 'interface' || n.type === 'enum'
    );

    // Check for Python project indicators
    const hasPythonIndicators = graphData.nodes.some(n => {
      const label = n.label.toLowerCase();
      return label.includes('.py') || n.type === 'module';
    });

    if (hasReactIndicators && !hasJavaIndicators) return 'react';
    if (hasJavaIndicators) return 'java';
    if (hasPythonIndicators) return 'python';
    return 'unknown';
  }, [graphData]);

  // Toggle node expansion
  const toggleNodeExpansion = useCallback((nodeId: string) => {
    console.log('toggleNodeExpansion called for:', nodeId);
    setExpandedNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        console.log('Collapsing node:', nodeId);
        newSet.delete(nodeId);
      } else {
        console.log('Expanding node:', nodeId);
        newSet.add(nodeId);
      }
      console.log('New expanded nodes:', Array.from(newSet));
      return newSet;
    });
  }, []);

  // Calculate depth for each node
  const nodeDepthMap = useMemo(() => {
    if (!graphData) return new Map<string, number>();
    const depthMap = new Map<string, number>();
    const nodeIds = new Set(graphData.nodes.map(n => n.id));

    const calculateDepth = (nodeId: string, visited: Set<string> = new Set()): number => {
      if (visited.has(nodeId)) return 0;
      if (depthMap.has(nodeId)) return depthMap.get(nodeId)!;

      visited.add(nodeId);
      const node = graphData.nodes.find(n => n.id === nodeId);

      if (!node || !node.parentId || !nodeIds.has(node.parentId)) {
        depthMap.set(nodeId, 0);
        return 0;
      }

      const parentDepth = calculateDepth(node.parentId, visited);
      const depth = parentDepth + 1;
      depthMap.set(nodeId, depth);
      return depth;
    };

    graphData.nodes.forEach(node => calculateDepth(node.id));
    return depthMap;
  }, [graphData]);

  // Get root node IDs set
  const rootNodeIds = useMemo(() => {
    return new Set(rootNodes.map(n => n.id));
  }, [rootNodes]);

  // Stats
  const stats = useMemo(() => {
    if (!graphData) return { nodes: 0, edges: 0, types: {}, visible: 0 };
    const types: Record<string, number> = {};
    graphData.nodes.forEach(n => {
      types[n.type] = (types[n.type] || 0) + 1;
    });
    return {
      nodes: graphData.nodes.length,
      edges: graphData.edges.length,
      types,
      visible: visibleNodeIds.size,
    };
  }, [graphData, visibleNodeIds]);

  // Build flow nodes with children info for collapsible UI
  const buildFlowNodes = useCallback((
    data: GraphData,
    visibleIds: Set<string>,
    expanded: Set<string>,
    childMap: Map<string, string[]>,
    depthMap: Map<string, number>,
    rootIds: Set<string>
  ): Node[] => {
    return data.nodes
      .filter(node => visibleIds.has(node.id))
      .map((node) => {
        const children = childMap.get(node.id) || [];
        const hasChildren = children.length > 0;
        const isExpanded = expanded.has(node.id);
        const depth = depthMap.get(node.id) || 0;
        const isRoot = rootIds.has(node.id);

        return {
          id: node.id,
          type: 'custom',
          position: { x: 0, y: 0 },
          data: {
            nodeId: node.id, // Pass nodeId for expand button
            label: node.label,
            type: node.type,
            parentId: node.parentId,
            hasChildren,
            isExpanded,
            childCount: children.length,
            depth,
            isRoot,
          },
        };
      });
  }, []);

  // Build flow edges for visible nodes only - with smooth bezier curves
  const buildFlowEdges = useCallback((data: GraphData, visibleIds: Set<string>): Edge[] => {
    return data.edges
      .filter(edge => visibleIds.has(edge.source) && visibleIds.has(edge.target))
      .map((edge, index) => ({
        id: `e-${edge.source}-${edge.target}-${index}`,
        source: edge.source,
        target: edge.target,
        type: 'smoothstep', // Smooth curved edges for hierarchy
        label: edge.label,
        animated: false,
        style: {
          stroke: 'url(#edge-gradient)',
          strokeWidth: 2.5,
          strokeLinecap: 'round' as const,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: '#64ffda',
          width: 18,
          height: 18,
        },
        labelStyle: {
          fill: '#e2e8f0',
          fontSize: 11,
          fontWeight: 600,
          background: '#1e293b',
        },
        labelBgStyle: {
          fill: 'rgba(30, 41, 59, 0.95)',
          fillOpacity: 0.95,
          rx: 4,
          ry: 4,
        },
        labelBgPadding: [6, 4] as [number, number],
      }));
  }, []);

  // Track previous state to prevent unnecessary re-renders
  const prevStateHashRef = React.useRef<string>('');

  // Update graph when visible nodes or expanded state changes (collapsible tree)
  useEffect(() => {
    if (!graphData || visibleNodeIds.size === 0) return;

    // Create a hash of visible node IDs AND expanded nodes to compare
    const visibleIdsHash = Array.from(visibleNodeIds).sort().join(',');
    const expandedHash = Array.from(expandedNodes).sort().join(',');
    const stateHash = `${visibleIdsHash}|${expandedHash}`;

    // Only update if state actually changed
    if (prevStateHashRef.current === stateHash) {
      return;
    }
    prevStateHashRef.current = stateHash;

    const flowNodes = buildFlowNodes(graphData, visibleNodeIds, expandedNodes, childrenMap, nodeDepthMap, rootNodeIds);
    const flowEdges = buildFlowEdges(graphData, visibleNodeIds);

    const layouted = getLayoutedElements(flowNodes, flowEdges);
    setNodes(layouted.nodes);
    setEdges(layouted.edges);
  }, [graphData, visibleNodeIds, expandedNodes, childrenMap, nodeDepthMap, rootNodeIds, buildFlowNodes, buildFlowEdges, setNodes, setEdges]);

  // Track if graph has been initialized to avoid resetting on reloads
  const graphInitializedRef = React.useRef<string | null>(null);

  // Initialize graph - only reset expandedNodes on NEW graph data
  const initializeGraph = useCallback((data: GraphData) => {
    // Create a simple hash of the graph to detect if it's actually new data
    const graphHash = `${data.nodes.length}-${data.edges.length}-${data.nodes[0]?.id || 'empty'}`;

    // Only reset expandedNodes if this is actually different graph data
    if (graphInitializedRef.current !== graphHash) {
      console.log('New graph detected, resetting expanded state');
      graphInitializedRef.current = graphHash;
      setExpandedNodes(new Set());
    } else {
      console.log('Same graph data, preserving expanded state');
    }
    setLoading(false);
  }, []);

  // Handle messages from extension
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      console.log('Message received:', message.command);

      switch (message.command) {
        case 'loadGraph':
          // Guard against duplicate processing
          if (isRequestingGraphRef.current) {
            console.log('loadGraph ignored - already processing');
            break;
          }
          isRequestingGraphRef.current = true;
          console.log('loadGraph received, nodes:', message.data?.nodes?.length);
          setGraphData(message.data);
          initializeGraph(message.data);
          // Reset guard after a short delay
          setTimeout(() => { isRequestingGraphRef.current = false; }, 500);
          break;

        case 'nodeDetails':
          setPopupData(prev => prev ? {
            ...prev,
            content: message.content,
            description: message.description,
            metadata: message.metadata,
            parentId: message.parentId,
            parentLabel: message.parentLabel,
            hierarchy: message.hierarchy,
          } : null);
          break;

        case 'docsGenerationStarted':
          setIsGeneratingDocs(true);
          break;

        case 'docsGenerationComplete':
          setIsGeneratingDocs(false);
          setDocsGenerated(true);
          // If viewDocsLoading is true, this was triggered by View Docs
          setViewDocsLoading(false);
          break;

        case 'docsGenerationError':
          setIsGeneratingDocs(false);
          setViewDocsLoading(false);
          break;

        case 'docsLoaded':
          // Receive docs.json data for React rendering
          if (message.docs) {
            console.log('Docs loaded:', Object.keys(message.docs.nodes || {}).length, 'nodes');
            setDocsData(message.docs);
            setDocsGenerated(true);
            // Auto-show docs panel when loaded via View Docs flow
            setShowDocsPanel(true);
            setViewDocsLoading(false);
          }
          break;

        case 'personaDocsReady':
          // Receive LLM-formatted persona documentation
          setPersonaFormattedDocs(message.content);
          setViewDocsLoading(false);
          setShowDocsPanel(true);
          break;

        case 'personaDocsError':
          setViewDocsLoading(false);
          break;

        case 'apiKeyStatus':
          setApiKeyConfigured(message.configured);
          break;

        case 'syncStarted':
          setIsSyncing(true);
          break;

        case 'syncComplete':
          setIsSyncing(false);
          setLastSyncTime(new Date().toLocaleTimeString());
          setPendingChanges(0);
          break;

        case 'syncError':
          setIsSyncing(false);
          break;

        case 'pendingChangesUpdate':
        case 'changesDetected':
          setPendingChanges(message.count);
          break;

        case 'branchSwitch':
          // Branch switch detected - need to refresh graph with new branch data
          console.log('Branch switched to:', message.branch);
          setCurrentBranch(message.branch);
          // Reset the graph hash so new graph data is recognized as different
          graphInitializedRef.current = null;
          // Also update last sync time to indicate fresh data
          setLastSyncTime(new Date().toLocaleTimeString());
          // DON'T request getGraph here - the extension will send updated graph via loadGraph
          // after the refresh command completes. Requesting here causes a loop.
          break;

        case 'error':
          setError(message.message);
          setLoading(false);
          break;

        case 'questionLoading':
          console.log('questionLoading received:', message.loading);
          setQaLoading(message.loading);
          break;

        case 'questionAnswer':
          console.log('questionAnswer received:', message.answer?.substring(0, 100));
          setQaLoading(false);
          setQaAnswer({
            answer: message.answer,
            relevantNodes: message.relevantNodes || [],
            confidence: message.confidence || 'low'
          });
          // Add to history
          if (qaQuestion.trim()) {
            setQaHistory(prev => [...prev, {
              question: qaQuestion,
              answer: message.answer,
              timestamp: new Date()
            }]);
          }
          break;
      }
    };

    window.addEventListener('message', handleMessage);

    // Request initial data only once on mount
    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true;
      vscode.postMessage({ command: 'getGraph' });
      vscode.postMessage({ command: 'checkApiKey' });
      vscode.postMessage({ command: 'getPendingChanges' });
    }

    return () => window.removeEventListener('message', handleMessage);
  }, []); // Remove initializeGraph from dependencies to prevent re-mounting

  // Listen for expand toggle events from CustomNode
  useEffect(() => {
    const handleExpandToggle = (event: Event) => {
      const customEvent = event as CustomEvent<{ nodeId: string }>;
      console.log('nodeExpandToggle event received:', customEvent.detail);
      if (customEvent.detail?.nodeId) {
        toggleNodeExpansion(customEvent.detail.nodeId);
      }
    };

    window.addEventListener('nodeExpandToggle', handleExpandToggle);
    console.log('Expand toggle listener attached');
    return () => {
      window.removeEventListener('nodeExpandToggle', handleExpandToggle);
      console.log('Expand toggle listener removed');
    };
  }, [toggleNodeExpansion]);

  // Track if expand button was clicked (to prevent popup on expand)
  const expandClickedRef = React.useRef(false);

  useEffect(() => {
    const handleExpandFlag = () => {
      expandClickedRef.current = true;
      // Reset after a short delay
      setTimeout(() => { expandClickedRef.current = false; }, 100);
    };
    window.addEventListener('nodeExpandToggle', handleExpandFlag);
    return () => window.removeEventListener('nodeExpandToggle', handleExpandFlag);
  }, []);

  // Handle node click - show popup unless expand button was clicked
  const handleNodeClick: NodeMouseHandler = useCallback((event, node) => {
    // Check if this was an expand button click (the button will set this flag)
    if (expandClickedRef.current) {
      expandClickedRef.current = false;
      return; // Don't show popup if expand was clicked
    }

    const nodeData = graphData?.nodes.find(n => n.id === node.id);
    if (!nodeData) return;

    // Show popup when clicking on the node
    setPopupData({
      nodeId: node.id,
      label: nodeData.label,
      type: nodeData.type,
      filePath: nodeData.filePath,
      description: nodeData.description,
      parentId: nodeData.parentId,
      metadata: nodeData.metadata,
    });
    // Request additional details from extension
    vscode.postMessage({ command: 'getNodeDetails', nodeId: node.id });
  }, [graphData]);

  // Handle double-click - same as single click now (show popup)
  const handleNodeDoubleClick: NodeMouseHandler = useCallback((event, node) => {
    const nodeData = graphData?.nodes.find(n => n.id === node.id);
    if (nodeData) {
      setPopupData({
        nodeId: node.id,
        label: nodeData.label,
        type: nodeData.type,
        filePath: nodeData.filePath,
        description: nodeData.description,
        parentId: nodeData.parentId,
        metadata: nodeData.metadata,
      });
      // Request additional details from extension
      vscode.postMessage({ command: 'getNodeDetails', nodeId: node.id });
    }
  }, [graphData]);

  // Handle send to Cline - FIXED: Now sends nodeId and query correctly
  const handleSendToCline = useCallback((nodeId: string, query: string) => {
    vscode.postMessage({
      command: 'sendToCline',
      nodeId: nodeId,
      query: query,
    });
    setPopupData(null);
  }, []);

  // Handle opening file in editor
  const handleOpenFile = useCallback((filePath: string, line?: number) => {
    vscode.postMessage({
      command: 'openFile',
      filePath: filePath,
      line: line || 1,
    });
  }, []);

  // Handle generate documentation with persona - requires API key
  const handleGenerateDocs = useCallback(() => {
    if (!apiKeyConfigured) {
      setShowApiKeyModal(true);
      return;
    }
    vscode.postMessage({ command: 'generateDocs', persona: selectedPersona });
  }, [selectedPersona, apiKeyConfigured]);

  // Handle view docs - requires API key, shows persona selection first
  const handleViewDocs = useCallback(() => {
    if (!apiKeyConfigured) {
      setShowApiKeyModal(true);
      return;
    }
    setShowViewDocsPersonaModal(true);
  }, [apiKeyConfigured]);

  // Handle persona selection for View Docs - sends existing data to LLM for persona formatting
  const handleViewDocsWithPersona = useCallback((persona: 'developer' | 'product-manager' | 'architect' | 'business-analyst') => {
    setSelectedPersona(persona);
    setShowViewDocsPersonaModal(false);
    setViewDocsLoading(true);
    setPersonaFormattedDocs(null);
    
    // Prepare summary of the codebase from existing graph data
    const codebaseSummary = graphData ? {
      totalNodes: graphData.nodes.length,
      nodeTypes: graphData.nodes.reduce((acc, n) => {
        acc[n.type] = (acc[n.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      nodes: graphData.nodes.slice(0, 50).map(n => ({
        name: n.label,
        type: n.type,
        file: n.filePath,
        description: n.description || n.metadata?.docstring || ''
      })),
      architecture: docsData?.architecture
    } : null;
    
    // Send to backend for LLM formatting
    vscode.postMessage({ 
      command: 'viewDocsWithPersona', 
      persona,
      codebaseSummary
    });
  }, [graphData, docsData]);

  // Handle open Ask AI panel - requires API key  
  const handleOpenAskAI = useCallback(() => {
    if (!apiKeyConfigured) {
      setShowApiKeyModal(true);
      return;
    }
    setShowCopilotPanel(true);
  }, [apiKeyConfigured]);

  // Handle configure API key
  const handleConfigureApiKey = useCallback(() => {
    setShowApiKeyModal(false);
    vscode.postMessage({ command: 'configureApiKey' });
  }, []);

  // Handle sync changes (incremental update)
  const handleSyncChanges = useCallback(() => {
    vscode.postMessage({ command: 'syncChanges' });
  }, []);

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>
          <div style={styles.spinner} />
          <div>Loading codebase visualization...</div>
          <div style={{ fontSize: '12px', color: '#64748b' }}>
            Analyzing your code structure
          </div>
        </div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.error}>
          <span style={{ fontSize: '48px' }}>⚠️</span>
          <h2 style={{ margin: 0 }}>Unable to Load Graph</h2>
          <p style={{ maxWidth: '400px', color: '#f87171' }}>{error}</p>
          <button
            onClick={() => {
              setError(null);
              setLoading(true);
              vscode.postMessage({ command: 'getGraph' });
            }}
            style={{
              background: '#64ffda',
              border: 'none',
              borderRadius: '8px',
              padding: '12px 24px',
              color: '#0f172a',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Inject markdown styles */}
      <style>{markdownStyles}</style>

      {/* SVG Definitions for gradients */}
      <svg style={{ position: 'absolute', width: 0, height: 0 }}>
        <defs>
          <linearGradient id="edge-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#64ffda" stopOpacity="0.4" />
            <stop offset="50%" stopColor="#64ffda" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#64ffda" stopOpacity="0.4" />
          </linearGradient>
        </defs>
      </svg>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onNodeDoubleClick={handleNodeDoubleClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.1}
        maxZoom={2}
        defaultViewport={{ x: 0, y: 0, zoom: 0.7 }}
        proOptions={{ hideAttribution: true }}
        connectionLineStyle={{ stroke: '#64ffda', strokeWidth: 2 }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={25}
          size={1.5}
          color="rgba(100, 255, 218, 0.08)"
        />
        <Controls
          style={{
            background: 'rgba(30, 41, 59, 0.95)',
            border: '1px solid rgba(100, 255, 218, 0.3)',
            borderRadius: '12px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
          }}
        />
        <MiniMap
          style={{
            background: 'rgba(30, 41, 59, 0.95)',
            border: '1px solid rgba(100, 255, 218, 0.3)',
            borderRadius: '12px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
          }}
          nodeColor={(node) => nodeColors[node.data?.type]?.bg || '#3b82f6'}
          maskColor="rgba(15, 23, 42, 0.8)"
        />

        {/* Stats Panel - Collapsible */}
        <Panel position="top-left">
          {statsPanelOpen ? (
            <div style={styles.statsPanelContainer}>
              {/* Header with collapse button */}
              <div style={styles.statsPanelHeader}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ color: '#64ffda', fontWeight: 600 }}>📊 Stats</span>
                  <span style={{ color: '#94a3b8', fontSize: '12px' }}>
                    {stats.visible}/{stats.nodes} nodes
                  </span>
                  {lastSyncTime && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#94a3b8', fontSize: '11px', marginLeft: '6px' }}>
                      <span style={{ color: '#10b981' }}>✓</span>
                      <span>{lastSyncTime}</span>
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <button
                    onClick={() => setStatsPanelOpen(false)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#94a3b8',
                      cursor: 'pointer',
                      fontSize: '16px',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      transition: 'all 0.2s',
                    }}
                    title="Collapse panel"
                  >
                    ▲
                  </button>
                </div>
              </div>

              {/* Content */}
              <div style={{
                ...styles.statsPanel,
                ...styles.statsPanelExpanded,
              }}>
                <div style={styles.statItem}>
                  <span style={styles.statValue}>{stats.visible}/{stats.nodes}</span>
                  <span style={styles.statLabel}>Visible/Total</span>
                </div>
                <div style={styles.statItem}>
                  <span style={styles.statValue}>{stats.edges}</span>
                  <span style={styles.statLabel}>Connections</span>
                </div>
                {/* Action Buttons */}
                <div style={{
                  borderLeft: '1px solid rgba(100, 255, 218, 0.2)',
                  paddingLeft: '15px',
                  marginLeft: '5px',
                  display: 'flex',
                  gap: '10px',
                  alignItems: 'center',
                }}>
                  {/* API Key Status Indicator */}
                  <button
                    onClick={() => setShowApiKeyModal(true)}
                    style={{
                      background: apiKeyConfigured 
                        ? 'rgba(16, 185, 129, 0.15)' 
                        : 'rgba(251, 191, 36, 0.15)',
                      border: `1px solid ${apiKeyConfigured ? 'rgba(16, 185, 129, 0.4)' : 'rgba(251, 191, 36, 0.4)'}`,
                      borderRadius: '8px',
                      padding: '8px 12px',
                      color: apiKeyConfigured ? '#10b981' : '#fbbf24',
                      fontSize: '12px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'all 0.2s',
                    }}
                    title={apiKeyConfigured ? 'API key configured - Click to reconfigure' : 'Click to configure API key'}
                  >
                    <span style={{ fontSize: '14px' }}>{apiKeyConfigured ? '✓' : '🔑'}</span>
                    {apiKeyConfigured ? 'API Ready' : 'Setup API'}
                  </button>
                  
                  {/* Generate Docs Button */}
                  <button
                    onClick={handleGenerateDocs}
                    disabled={isGeneratingDocs}
                    style={{
                      background: isGeneratingDocs
                        ? 'rgba(100, 255, 218, 0.3)'
                        : docsGenerated
                          ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                          : 'linear-gradient(135deg, #64ffda 0%, #4fd1c5 100%)',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '8px 14px',
                      color: isGeneratingDocs ? '#64ffda' : '#0f172a',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: isGeneratingDocs ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'all 0.2s ease',
                      boxShadow: isGeneratingDocs ? 'none' : '0 2px 8px rgba(100, 255, 218, 0.3)',
                    }}
                    title={apiKeyConfigured ? `Generate ${selectedPersona} documentation` : 'Configure API key first'}
                  >
                    {isGeneratingDocs ? (
                      <>
                        <span style={{
                          width: '14px',
                          height: '14px',
                          border: '2px solid rgba(100, 255, 218, 0.3)',
                          borderTop: '2px solid #64ffda',
                          borderRadius: '50%',
                          animation: 'spin 1s linear infinite',
                        }} />
                        Generating...
                      </>
                    ) : docsGenerated ? (
                      <>✅ Regenerate</>
                    ) : (
                      <>
                        📝 Generate
                        {!apiKeyConfigured && <span style={{ fontSize: '10px', marginLeft: '4px' }}>🔑</span>}
                      </>
                    )}
                  </button>

                  {/* View Full Documentation Button */}
                  <button
                    onClick={handleViewDocs}
                    disabled={viewDocsLoading}
                    style={{
                      background: viewDocsLoading 
                        ? 'rgba(139, 92, 246, 0.3)'
                        : 'linear-gradient(135deg, #a78bfa 0%, #8b5cf6 100%)',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '8px 14px',
                      color: viewDocsLoading ? '#a78bfa' : '#ffffff',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: viewDocsLoading ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'all 0.2s ease',
                      boxShadow: viewDocsLoading ? 'none' : '0 2px 8px rgba(139, 92, 246, 0.3)',
                    }}
                    title={!apiKeyConfigured ? 'Configure API key first' : viewDocsLoading ? 'Generating documentation...' : 'View AI-powered documentation'}
                  >
                    {viewDocsLoading ? (
                      <>
                        <span style={{
                          width: '12px',
                          height: '12px',
                          border: '2px solid rgba(139, 92, 246, 0.3)',
                          borderTop: '2px solid #a78bfa',
                          borderRadius: '50%',
                          animation: 'spin 1s linear infinite',
                        }} />
                        Generating...
                      </>
                    ) : (
                      <>
                        📚 View Docs
                        {!apiKeyConfigured && <span style={{ fontSize: '10px', marginLeft: '4px' }}>🔑</span>}
                      </>
                    )}
                  </button>

                  {/* Sync Changes Button */}
                  <button
                    onClick={handleSyncChanges}
                    disabled={isSyncing}
                    style={{
                      background: isSyncing
                        ? 'rgba(139, 92, 246, 0.3)'
                        : pendingChanges > 0
                          ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
                          : 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '8px 14px',
                      color: isSyncing ? '#a78bfa' : '#ffffff',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: isSyncing ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'all 0.2s ease',
                      boxShadow: isSyncing ? 'none' : '0 2px 8px rgba(139, 92, 246, 0.3)',
                      position: 'relative' as const,
                    }}
                    title="Sync graph with file changes (incremental update)"
                  >
                    {isSyncing ? (
                      <>
                        <span style={{
                          width: '14px',
                          height: '14px',
                          border: '2px solid rgba(139, 92, 246, 0.3)',
                          borderTop: '2px solid #a78bfa',
                          borderRadius: '50%',
                          animation: 'spin 1s linear infinite',
                        }} />
                        Syncing...
                      </>
                    ) : pendingChanges > 0 ? (
                      <>
                        🔄 Sync ({pendingChanges})
                      </>
                    ) : (
                      <>🔄 Sync Changes</>
                    )}
                    {pendingChanges > 0 && !isSyncing && (
                      <span style={{
                        position: 'absolute',
                        top: '-6px',
                        right: '-6px',
                        background: '#ef4444',
                        color: '#fff',
                        borderRadius: '50%',
                        width: '18px',
                        height: '18px',
                        fontSize: '10px',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                        {pendingChanges}
                      </span>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Collapsed state - just show icon button */
            <button
              onClick={() => setStatsPanelOpen(true)}
              style={{
                ...styles.statsOpenButton,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
              title="Expand stats panel"
            >
              📊 Stats ▼
            </button>
          )}
        </Panel>

        {/* Ask AI Button - Top Right - offset to avoid collision */}
        <Panel position="top-right">
          <button
            onClick={handleOpenAskAI}
            style={{
              ...styles.copilotButton,
              marginRight: showCopilotPanel ? '500px' : '0',
              transition: 'margin-right 0.3s ease',
            }}
            title="Ask questions about the codebase"
          >
            <span style={{ fontSize: '16px' }}>✨</span>
            Ask AI
            {!apiKeyConfigured && (
              <span style={{
                marginLeft: '6px',
                background: 'rgba(251, 191, 36, 0.2)',
                color: '#fbbf24',
                padding: '2px 6px',
                borderRadius: '8px',
                fontSize: '9px',
                fontWeight: 600,
              }}>
                🔑
              </span>
            )}
          </button>
        </Panel>


      </ReactFlow>

      {/* Node Popup */}
      {popupData && (
        <NodePopup
          data={popupData}
          onClose={() => setPopupData(null)}
          onSendToCline={handleSendToCline}
          onOpenFile={handleOpenFile}
          allNodes={graphData?.nodes || []}
          nodeDocs={getNodeDocs(popupData.nodeId)}
        />
      )}

      {/* Full Documentation Panel */}
      {showDocsPanel && (docsData || personaFormattedDocs) && (
        <DocsPanel
          docsData={docsData}
          personaFormattedDocs={personaFormattedDocs}
          onClose={() => {
            setShowDocsPanel(false);
            setPersonaFormattedDocs(null);
          }}
          persona={selectedPersona}
          onNodeClick={(nodeId) => {
            const node = graphData?.nodes.find(n => n.id === nodeId);
            if (node) {
              setPopupData({
                nodeId: node.id,
                label: node.label,
                type: node.type,
                filePath: node.filePath,
                description: node.description,
                parentId: node.parentId,
                metadata: node.metadata,
              });
              vscode.postMessage({ command: 'getNodeDetails', nodeId: node.id });
            }
          }}
        />
      )}

      {/* Copilot Side Panel - Slides in from right */}
      {showCopilotPanel && (
        <div style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '480px',
          background: 'linear-gradient(180deg, #0f172a 0%, #020617 100%)',
          borderLeft: '1px solid rgba(100, 255, 218, 0.15)',
          zIndex: 2000,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-20px 0 60px rgba(0, 0, 0, 0.6)',
          animation: 'slideInRight 0.3s ease',
        }}>
          {/* Header - Glassmorphism style */}
          <div style={{
            padding: '20px 24px',
            borderBottom: '1px solid rgba(100, 255, 218, 0.1)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'linear-gradient(180deg, rgba(100, 255, 218, 0.08) 0%, rgba(100, 255, 218, 0.02) 100%)',
            backdropFilter: 'blur(10px)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '14px',
                background: 'linear-gradient(135deg, rgba(100, 255, 218, 0.2) 0%, rgba(56, 189, 248, 0.2) 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid rgba(100, 255, 218, 0.2)',
              }}>
                <span style={{ fontSize: '22px' }}>🧠</span>
              </div>
              <div>
                <h2 style={{ margin: 0, color: '#f1f5f9', fontSize: '17px', fontWeight: 600 }}>
                  Ask AI
                </h2>
                <p style={{ margin: '3px 0 0 0', color: '#64748b', fontSize: '12px' }}>
                  ✨ AI-powered code assistant
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowCopilotPanel(false)}
              style={{
                background: 'rgba(100, 116, 139, 0.15)',
                border: '1px solid rgba(100, 116, 139, 0.2)',
                borderRadius: '10px',
                padding: '10px 14px',
                color: '#94a3b8',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)';
                e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.3)';
                e.currentTarget.style.color = '#f87171';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = 'rgba(100, 116, 139, 0.15)';
                e.currentTarget.style.borderColor = 'rgba(100, 116, 139, 0.2)';
                e.currentTarget.style.color = '#94a3b8';
              }}
            >
              Close
            </button>
          </div>

          {/* Conversation Area */}
          <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
            {/* Welcome State */}
            {!qaAnswer && !qaLoading && (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                textAlign: 'center',
                padding: '20px',
              }}>
                <div style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '24px',
                  background: 'linear-gradient(135deg, rgba(100, 255, 218, 0.15) 0%, rgba(56, 189, 248, 0.15) 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '20px',
                  border: '1px solid rgba(100, 255, 218, 0.2)',
                }}>
                  <span style={{ fontSize: '40px' }}>💬</span>
                </div>
                <h3 style={{ color: '#f1f5f9', margin: '0 0 8px 0', fontSize: '18px', fontWeight: 600 }}>
                  Ask About Your Code
                </h3>
                <p style={{ color: '#64748b', margin: '0 0 24px 0', fontSize: '13px', lineHeight: '1.6' }}>
                  I can help you understand your codebase,<br />find specific components, and explain logic
                </p>

                {/* Suggested Questions */}
                <div style={{ width: '100%', maxWidth: '320px' }}>
                  <p style={{ color: '#475569', fontSize: '11px', margin: '0 0 10px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Try asking
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {[
                      '📦 What are the main components?',
                      '🔗 How does the API layer work?',
                      '🔐 Explain the authentication flow',
                      '📊 List all services and their purposes',
                    ].map((q, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          const cleanQ = q.replace(/^[\u{1F300}-\u{1F9FF}]\s+/u, '');
                          setQaQuestion(cleanQ);
                          vscode.postMessage({ command: 'askQuestion', question: cleanQ });
                        }}
                        style={{
                          padding: '12px 16px',
                          borderRadius: '12px',
                          border: '1px solid rgba(100, 255, 218, 0.15)',
                          background: 'rgba(30, 41, 59, 0.6)',
                          color: '#cbd5e1',
                          fontSize: '13px',
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'all 0.2s',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                        }}
                        onMouseOver={(e) => {
                          e.currentTarget.style.background = 'rgba(100, 255, 218, 0.1)';
                          e.currentTarget.style.borderColor = 'rgba(100, 255, 218, 0.3)';
                          e.currentTarget.style.color = '#64ffda';
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.background = 'rgba(30, 41, 59, 0.6)';
                          e.currentTarget.style.borderColor = 'rgba(100, 255, 218, 0.15)';
                          e.currentTarget.style.color = '#cbd5e1';
                        }}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Loading State */}
            {qaLoading && (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '60px 20px',
              }}>
                <div style={{
                  width: '60px',
                  height: '60px',
                  position: 'relative',
                  marginBottom: '24px',
                }}>
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    border: '3px solid rgba(100, 255, 218, 0.1)',
                    borderRadius: '50%',
                  }} />
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    border: '3px solid transparent',
                    borderTopColor: '#64ffda',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                  }} />
                  <div style={{
                    position: 'absolute',
                    inset: '8px',
                    border: '3px solid transparent',
                    borderTopColor: '#38bdf8',
                    borderRadius: '50%',
                    animation: 'spin 1.5s linear infinite reverse',
                  }} />
                </div>
                <p style={{ margin: 0, fontSize: '15px', color: '#f1f5f9', fontWeight: 500 }}>
                  Analyzing your codebase...
                </p>
                <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                  Searching through files and understanding context
                </p>
              </div>
            )}

            {/* Answer Display */}
            {qaAnswer && !qaLoading && (
              <div style={{ animation: 'fadeIn 0.3s ease' }}>
                {/* User Question Bubble */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  marginBottom: '16px',
                }}>
                  <div style={{
                    maxWidth: '85%',
                    padding: '12px 16px',
                    borderRadius: '16px 16px 4px 16px',
                    background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                    color: '#ffffff',
                    fontSize: '13px',
                    lineHeight: '1.5',
                    boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
                  }}>
                    {qaQuestion || qaHistory[qaHistory.length - 1]?.question || 'Your question'}
                  </div>
                </div>

                {/* AI Response */}
                <div style={{
                  display: 'flex',
                  gap: '12px',
                  marginBottom: '16px',
                }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, rgba(100, 255, 218, 0.2) 0%, rgba(56, 189, 248, 0.2) 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    border: '1px solid rgba(100, 255, 218, 0.2)',
                  }}>
                    <span style={{ fontSize: '18px' }}>🧠</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    {/* Answer Content */}
                    <div
                      className="markdown-content"
                      style={{
                        background: 'rgba(30, 41, 59, 0.6)',
                        padding: '16px 18px',
                        borderRadius: '4px 16px 16px 16px',
                        border: '1px solid rgba(100, 255, 218, 0.1)',
                        fontSize: '13px',
                        lineHeight: '1.7',
                        color: '#e2e8f0',
                      }}
                      dangerouslySetInnerHTML={{ __html: marked(qaAnswer.answer) as string }}
                    />
                  </div>
                </div>

                {/* Related Code Section */}
                {qaAnswer.relevantNodes.length > 0 && (
                  <div style={{
                    marginTop: '20px',
                    padding: '16px',
                    borderRadius: '14px',
                    background: 'rgba(30, 41, 59, 0.4)',
                    border: '1px solid rgba(100, 255, 218, 0.1)',
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginBottom: '14px',
                    }}>
                      <span style={{ fontSize: '14px' }}>📍</span>
                      <h4 style={{ color: '#94a3b8', margin: 0, fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Related Code ({qaAnswer.relevantNodes.length})
                      </h4>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {qaAnswer.relevantNodes.slice(0, 5).map((node, i) => (
                        <div
                          key={i}
                          onClick={() => {
                            const graphNode = graphData?.nodes.find(n => n.label === node.name);
                            if (graphNode) {
                              setPopupData({
                                nodeId: graphNode.id,
                                label: graphNode.label,
                                type: graphNode.type,
                                filePath: graphNode.filePath,
                                description: graphNode.description,
                                parentId: graphNode.parentId,
                                metadata: graphNode.metadata,
                              });
                              vscode.postMessage({ command: 'getNodeDetails', nodeId: graphNode.id });
                              setShowCopilotPanel(false);
                            }
                          }}
                          style={{
                            padding: '12px 14px',
                            borderRadius: '10px',
                            background: 'rgba(15, 23, 42, 0.6)',
                            border: '1px solid rgba(100, 255, 218, 0.08)',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                          }}
                          onMouseOver={(e) => {
                            e.currentTarget.style.background = 'rgba(100, 255, 218, 0.08)';
                            e.currentTarget.style.borderColor = 'rgba(100, 255, 218, 0.2)';
                          }}
                          onMouseOut={(e) => {
                            e.currentTarget.style.background = 'rgba(15, 23, 42, 0.6)';
                            e.currentTarget.style.borderColor = 'rgba(100, 255, 218, 0.08)';
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: '#64ffda', fontWeight: 600, fontSize: '13px' }}>{node.name}</span>
                            <span style={{
                              fontSize: '10px',
                              padding: '3px 8px',
                              borderRadius: '6px',
                              background: 'rgba(100, 255, 218, 0.1)',
                              color: '#64ffda',
                              fontWeight: 500,
                            }}>
                              {node.type}
                            </span>
                          </div>
                          {node.filePath && (
                            <div style={{ color: '#64748b', fontSize: '11px', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span>📁</span> {node.filePath}
                            </div>
                          )}
                          {node.score > 0 && (
                            <div style={{
                              marginTop: '6px',
                              height: '3px',
                              borderRadius: '2px',
                              background: 'rgba(100, 255, 218, 0.1)',
                              overflow: 'hidden',
                            }}>
                              <div style={{
                                height: '100%',
                                width: `${Math.min(100, node.score * 50)}%`,
                                background: 'linear-gradient(90deg, #64ffda 0%, #38bdf8 100%)',
                                borderRadius: '2px',
                              }} />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Ask Another Button */}
                <div style={{ marginTop: '20px', textAlign: 'center' }}>
                  <button
                    onClick={() => {
                      setQaAnswer(null);
                      setQaQuestion('');
                    }}
                    style={{
                      padding: '10px 20px',
                      borderRadius: '10px',
                      border: '1px solid rgba(100, 255, 218, 0.2)',
                      background: 'rgba(100, 255, 218, 0.08)',
                      color: '#64ffda',
                      fontSize: '13px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.background = 'rgba(100, 255, 218, 0.15)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.background = 'rgba(100, 255, 218, 0.08)';
                    }}
                  >
                    ✨ Ask Another Question
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Input Area - Fixed at bottom */}
          <div style={{
            padding: '16px 20px 20px',
            borderTop: '1px solid rgba(100, 255, 218, 0.1)',
            background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.95) 0%, rgba(15, 23, 42, 1) 100%)',
          }}>
            {/* History Pills */}
            {qaHistory.length > 0 && (
              <div style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {qaHistory.slice(-3).reverse().map((h, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setQaQuestion(h.question);
                        vscode.postMessage({ command: 'askQuestion', question: h.question });
                      }}
                      style={{
                        padding: '5px 10px',
                        borderRadius: '14px',
                        border: '1px solid rgba(100, 116, 139, 0.2)',
                        background: 'rgba(100, 116, 139, 0.1)',
                        color: '#94a3b8',
                        fontSize: '11px',
                        cursor: 'pointer',
                        maxWidth: '140px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        transition: 'all 0.2s',
                      }}
                      title={h.question}
                      onMouseOver={(e) => {
                        e.currentTarget.style.background = 'rgba(100, 255, 218, 0.1)';
                        e.currentTarget.style.borderColor = 'rgba(100, 255, 218, 0.2)';
                        e.currentTarget.style.color = '#64ffda';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.background = 'rgba(100, 116, 139, 0.1)';
                        e.currentTarget.style.borderColor = 'rgba(100, 116, 139, 0.2)';
                        e.currentTarget.style.color = '#94a3b8';
                      }}
                    >
                      🕐 {h.question}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Input Field */}
            <div style={{
              display: 'flex',
              gap: '10px',
              padding: '6px',
              borderRadius: '16px',
              border: '1px solid rgba(100, 255, 218, 0.2)',
              background: 'rgba(30, 41, 59, 0.6)',
            }}>
              <input
                type="text"
                value={qaQuestion}
                onChange={(e) => setQaQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && qaQuestion.trim() && !qaLoading) {
                    vscode.postMessage({ command: 'askQuestion', question: qaQuestion });
                  }
                }}
                placeholder="Ask about your codebase..."
                style={{
                  flex: 1,
                  padding: '12px 14px',
                  borderRadius: '12px',
                  border: 'none',
                  background: 'transparent',
                  color: '#f1f5f9',
                  fontSize: '14px',
                  outline: 'none',
                }}
              />
              <button
                onClick={() => {
                  if (qaQuestion.trim() && !qaLoading) {
                    vscode.postMessage({ command: 'askQuestion', question: qaQuestion });
                  }
                }}
                disabled={!qaQuestion.trim() || qaLoading}
                style={{
                  padding: '12px 20px',
                  borderRadius: '12px',
                  border: 'none',
                  background: qaQuestion.trim() && !qaLoading
                    ? 'linear-gradient(135deg, #64ffda 0%, #38bdf8 100%)'
                    : 'rgba(100, 116, 139, 0.2)',
                  color: qaQuestion.trim() && !qaLoading ? '#0f172a' : '#64748b',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: qaQuestion.trim() && !qaLoading ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.2s',
                  boxShadow: qaQuestion.trim() && !qaLoading ? '0 4px 12px rgba(100, 255, 218, 0.3)' : 'none',
                }}
              >
                {qaLoading ? (
                  <span style={{
                    width: '16px',
                    height: '16px',
                    border: '2px solid rgba(100, 255, 218, 0.3)',
                    borderTop: '2px solid #64ffda',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                  }} />
                ) : (
                  <>
                    <span>Send</span>
                    <span>➤</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* API Key Configuration Modal */}
      {showApiKeyModal && (
        <ApiKeyConfigModal
          onClose={() => setShowApiKeyModal(false)}
          onConfigure={handleConfigureApiKey}
        />
      )}

      {/* View Docs Persona Selection Modal */}
      {showViewDocsPersonaModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          animation: 'fadeIn 0.2s ease',
        }}>
          <div style={{
            background: 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)',
            borderRadius: '20px',
            border: '1px solid rgba(100, 255, 218, 0.2)',
            padding: '32px',
            maxWidth: '500px',
            width: '90%',
            boxShadow: '0 25px 80px rgba(0, 0, 0, 0.6)',
            animation: 'slideUp 0.3s ease',
          }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '14px',
                  background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.3) 0%, rgba(167, 139, 250, 0.3) 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '24px',
                }}>
                  📚
                </div>
                <div>
                  <h2 style={{ margin: 0, color: '#f8fafc', fontSize: '20px', fontWeight: 700 }}>
                    View Documentation
                  </h2>
                  <p style={{ margin: '4px 0 0', color: '#94a3b8', fontSize: '13px' }}>
                    Select your perspective for AI-generated docs
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowViewDocsPersonaModal(false)}
                style={{
                  background: 'rgba(100, 116, 139, 0.2)',
                  border: 'none',
                  borderRadius: '10px',
                  width: '36px',
                  height: '36px',
                  cursor: 'pointer',
                  color: '#94a3b8',
                  fontSize: '18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s ease',
                }}
              >
                ✕
              </button>
            </div>

            {/* Persona Options */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[
                { id: 'developer', icon: '👨‍💻', label: 'Developer', desc: 'Technical implementation details, code patterns, and architecture' },
                { id: 'architect', icon: '🏗️', label: 'Architect', desc: 'System design, component relationships, and scalability' },
                { id: 'product-manager', icon: '📋', label: 'Product Manager', desc: 'Feature overview, user flows, and business capabilities' },
                { id: 'business-analyst', icon: '📊', label: 'Business Analyst', desc: 'Process flows, data models, and requirements mapping' },
              ].map((persona) => (
                <button
                  key={persona.id}
                  onClick={() => handleViewDocsWithPersona(persona.id as any)}
                  disabled={viewDocsLoading}
                  style={{
                    background: 'rgba(30, 41, 59, 0.6)',
                    border: '1px solid rgba(100, 255, 218, 0.15)',
                    borderRadius: '14px',
                    padding: '16px 20px',
                    cursor: viewDocsLoading ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    transition: 'all 0.2s ease',
                    opacity: viewDocsLoading ? 0.5 : 1,
                    textAlign: 'left' as const,
                  }}
                  onMouseEnter={(e) => {
                    if (!viewDocsLoading) {
                      e.currentTarget.style.background = 'rgba(139, 92, 246, 0.15)';
                      e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.4)';
                      e.currentTarget.style.transform = 'translateX(4px)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(30, 41, 59, 0.6)';
                    e.currentTarget.style.borderColor = 'rgba(100, 255, 218, 0.15)';
                    e.currentTarget.style.transform = 'translateX(0)';
                  }}
                >
                  <div style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(167, 139, 250, 0.2) 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '22px',
                    flexShrink: 0,
                  }}>
                    {persona.icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: '#f8fafc', fontSize: '15px', fontWeight: 600, marginBottom: '4px' }}>
                      {persona.label}
                    </div>
                    <div style={{ color: '#94a3b8', fontSize: '12px', lineHeight: 1.4 }}>
                      {persona.desc}
                    </div>
                  </div>
                  <div style={{ color: '#a78bfa', fontSize: '18px' }}>→</div>
                </button>
              ))}
            </div>

            {/* Loading State */}
            {viewDocsLoading && (
              <div style={{
                marginTop: '20px',
                padding: '16px',
                background: 'rgba(139, 92, 246, 0.1)',
                borderRadius: '12px',
                border: '1px solid rgba(139, 92, 246, 0.2)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}>
                <div style={{
                  width: '20px',
                  height: '20px',
                  border: '2px solid rgba(139, 92, 246, 0.3)',
                  borderTop: '2px solid #a78bfa',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                }} />
                <span style={{ color: '#a78bfa', fontSize: '13px', fontWeight: 500 }}>
                  Generating AI documentation...
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Global Styles */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { 
            opacity: 0; 
            transform: translateY(20px); 
          }
          to { 
            opacity: 1; 
            transform: translateY(0); 
          }
        }
        @keyframes slideInRight {
          from { 
            opacity: 0; 
            transform: translateX(100%); 
          }
          to { 
            opacity: 1; 
            transform: translateX(0); 
          }
        }
        .react-flow__node:hover {
          z-index: 100 !important;
        }
        .react-flow__node:hover > div {
          transform: scale(1.05);
          box-shadow: 0 8px 30px rgba(100, 255, 218, 0.3) !important;
        }
        .react-flow__controls-button {
          background: rgba(30, 41, 59, 0.95) !important;
          border: 1px solid rgba(100, 255, 218, 0.2) !important;
          color: #64ffda !important;
        }
        .react-flow__controls-button:hover {
          background: rgba(100, 255, 218, 0.1) !important;
        }
        .react-flow__controls-button svg {
          fill: #64ffda !important;
        }
      `}</style>
    </div>
  );
};

// ============ Mount App ============
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}

export default App;
