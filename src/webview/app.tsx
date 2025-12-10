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
  type: 'file' | 'class' | 'function' | 'method' | 'component' | 'module' | 'entry' | 'package';
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
    background: 'linear-gradient(135deg, #0f0f23 0%, #1a1a2e 50%, #16213e 100%)',
    position: 'relative' as const,
    overflow: 'hidden',
  },
  loading: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    color: '#8892b0',
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
    cursor: 'pointer',
    userSelect: 'none' as const,
  },
  statsPanelHeaderCollapsed: {
    borderRadius: '12px',
    borderBottom: '1px solid rgba(100, 255, 218, 0.2)',
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
const CustomNode = ({ data }: { data: { 
  label: string; 
  type: string; 
  isExpanded?: boolean;
  hasChildren?: boolean;
  childCount?: number;
  depth?: number;
  isRoot?: boolean;
  nodeId?: string;
} }) => {
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

// ============ Popup Component ============
const NodePopup = ({ 
  data, 
  onClose, 
  onSendToCline,
  onOpenFile,
  allNodes 
}: { 
  data: PopupData; 
  onClose: () => void;
  onSendToCline: (nodeId: string, query: string) => void;
  onOpenFile: (filePath: string, line?: number) => void;
  allNodes: NodeData[];
}) => {
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'details' | 'cline'>('overview');
  
  // Safe access to colors
  const colors = nodeColors[data?.type] || nodeColors.file;
  const icon = typeIcons[data?.type] || '📄';

  // Safely get metadata
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

  // Get arrays safely
  const parameters = Array.isArray(metadata.parameters) ? metadata.parameters : [];
  const imports = Array.isArray(metadata.imports) ? metadata.imports : [];
  const exports = Array.isArray(metadata.exports) ? metadata.exports : [];
  const patterns = Array.isArray(metadata.patterns) ? metadata.patterns : [];
  const usageExamples = Array.isArray(metadata.usageExamples) ? metadata.usageExamples : [];
  const keywords = Array.isArray(metadata.keywords) ? metadata.keywords : [];
  const returnType = safeString(metadata.returnType);
  const docstring = safeString(metadata.docstring);
  const aiSummary = safeString(metadata.aiSummary);
  const aiDescription = safeString(metadata.aiDescription);
  const technicalDetails = safeString(metadata.technicalDetails);

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
          {['overview', 'details', 'cline'].map((tab) => (
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
              {tab === 'details' && '🔍 Details'}
              {tab === 'cline' && '🤖 Cline'}
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
                <p style={{ margin: 0, color: '#e2e8f0', fontSize: '14px', lineHeight: 1.6 }}>
                  {aiSummary || aiDescription || data?.description || data?.content || docstring || 'No description available.'}
                </p>
              </div>

              {/* AI Documentation - if available */}
              {(aiDescription || technicalDetails) && (
                <div style={{
                  background: 'linear-gradient(135deg, rgba(100, 255, 218, 0.05) 0%, rgba(139, 92, 246, 0.05) 100%)',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  border: '1px solid rgba(100, 255, 218, 0.3)',
                }}>
                  <div style={{ 
                    fontSize: '11px', 
                    color: '#64ffda', 
                    marginBottom: '10px', 
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <span>🤖</span> AI DOCUMENTATION
                  </div>
                  {aiDescription && (
                    <p style={{ margin: '0 0 12px 0', color: '#e2e8f0', fontSize: '14px', lineHeight: 1.6 }}>
                      {aiDescription}
                    </p>
                  )}
                  {technicalDetails && (
                    <pre style={{ 
                      margin: 0, 
                      color: '#94a3b8', 
                      fontSize: '12px', 
                      whiteSpace: 'pre-wrap',
                      fontFamily: 'inherit',
                      background: 'rgba(0,0,0,0.2)',
                      padding: '10px',
                      borderRadius: '6px',
                    }}>
                      {technicalDetails}
                    </pre>
                  )}
                </div>
              )}

              {/* Keywords / Tags */}
              {keywords.length > 0 && (
                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '6px',
                }}>
                  {keywords.map((keyword, i) => (
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

          {/* Details Tab */}
          {activeTab === 'details' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* Parameters */}
              {parameters.length > 0 && (
                <div style={{
                  background: '#1e293b',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  border: '1px solid #334155',
                }}>
                  <div style={{ fontSize: '11px', color: '#64ffda', marginBottom: '8px', fontWeight: 600 }}>
                    📥 PARAMETERS ({parameters.length})
                  </div>
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

              {/* Return Type */}
              {returnType && (
                <div style={{
                  background: '#1e293b',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  border: '1px solid #334155',
                }}>
                  <div style={{ fontSize: '11px', color: '#64ffda', marginBottom: '8px', fontWeight: 600 }}>
                    📤 RETURN TYPE
                  </div>
                  <code style={{ color: '#fbbf24', fontSize: '14px' }}>{returnType}</code>
                </div>
              )}

              {/* Imports */}
              {imports.length > 0 && (
                <div style={{
                  background: '#1e293b',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  border: '1px solid #334155',
                }}>
                  <div style={{ fontSize: '11px', color: '#64ffda', marginBottom: '8px', fontWeight: 600 }}>
                    📦 IMPORTS ({imports.length})
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {imports.slice(0, 10).map((imp: any, i: number) => (
                      <span key={i} style={{
                        background: 'rgba(59, 130, 246, 0.1)',
                        color: '#60a5fa',
                        padding: '4px 10px',
                        borderRadius: '4px',
                        fontSize: '12px',
                      }}>
                        {safeString(imp)}
                      </span>
                    ))}
                    {imports.length > 10 && (
                      <span style={{
                        background: 'rgba(239, 68, 68, 0.1)',
                        color: '#f87171',
                        padding: '4px 10px',
                        borderRadius: '4px',
                        fontSize: '12px',
                      }}>
                        +{imports.length - 10} more
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Exports */}
              {exports.length > 0 && (
                <div style={{
                  background: '#1e293b',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  border: '1px solid #334155',
                }}>
                  <div style={{ fontSize: '11px', color: '#64ffda', marginBottom: '8px', fontWeight: 600 }}>
                    🚀 EXPORTS ({exports.length})
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {exports.map((exp: any, i: number) => (
                      <span key={i} style={{
                        background: 'rgba(16, 185, 129, 0.1)',
                        color: '#34d399',
                        padding: '4px 10px',
                        borderRadius: '4px',
                        fontSize: '12px',
                      }}>
                        {safeString(exp)}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Documentation */}
              {docstring && (
                <div style={{
                  background: '#1e293b',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  border: '1px solid #334155',
                }}>
                  <div style={{ fontSize: '11px', color: '#64ffda', marginBottom: '8px', fontWeight: 600 }}>
                    📖 DOCUMENTATION
                  </div>
                  <pre style={{ 
                    margin: 0, 
                    color: '#e2e8f0', 
                    fontSize: '13px', 
                    whiteSpace: 'pre-wrap',
                    fontFamily: 'inherit',
                  }}>
                    {docstring}
                  </pre>
                </div>
              )}

              {/* Patterns / Design Patterns */}
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

              {/* Usage Examples */}
              {usageExamples.length > 0 && (
                <div style={{
                  background: 'linear-gradient(135deg, rgba(100, 255, 218, 0.05) 0%, rgba(139, 92, 246, 0.05) 100%)',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  border: '1px solid rgba(100, 255, 218, 0.3)',
                }}>
                  <div style={{ fontSize: '11px', color: '#64ffda', marginBottom: '10px', fontWeight: 600 }}>
                    💡 USAGE EXAMPLES
                  </div>
                  {usageExamples.map((example: any, i: number) => (
                    <pre key={i} style={{
                      margin: i === 0 ? 0 : '8px 0 0 0',
                      padding: '10px',
                      background: 'rgba(0,0,0,0.3)',
                      borderRadius: '6px',
                      color: '#e2e8f0',
                      fontSize: '12px',
                      whiteSpace: 'pre-wrap',
                      fontFamily: 'Monaco, Consolas, monospace',
                    }}>
                      {safeString(example)}
                    </pre>
                  ))}
                </div>
              )}

              {/* Empty State */}
              {parameters.length === 0 && !returnType && imports.length === 0 && exports.length === 0 && !docstring && patterns.length === 0 && usageExamples.length === 0 && (
                <div style={{ 
                  textAlign: 'center', 
                  padding: '40px 20px',
                  color: '#64748b',
                }}>
                  <div style={{ fontSize: '40px', marginBottom: '12px' }}>📭</div>
                  <p style={{ margin: 0 }}>No additional details available for this node.</p>
                </div>
              )}
            </div>
          )}

          {/* Cline Tab */}
          {activeTab === 'cline' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{
                background: '#1e293b',
                padding: '12px 16px',
                borderRadius: '8px',
                border: '1px solid #334155',
              }}>
                <p style={{ margin: 0, color: '#94a3b8', fontSize: '13px' }}>
                  Describe what changes you want Cline to make to <strong style={{ color: '#64ffda' }}>{label}</strong>.
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
                  background: query.trim() ? '#64ffda' : '#334155',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '12px 20px',
                  color: query.trim() ? '#0f172a' : '#64748b',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: query.trim() ? 'pointer' : 'not-allowed',
                }}
              >
                🚀 Send to Cline
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
  const [searchTerm, setSearchTerm] = useState('');
  const [isGeneratingDocs, setIsGeneratingDocs] = useState(false);
  const [docsGenerated, setDocsGenerated] = useState(false);
  const [apiKeyConfigured, setApiKeyConfigured] = useState<boolean | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingChanges, setPendingChanges] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [currentBranch, setCurrentBranch] = useState<string | null>(null);
  const [statsPanelOpen, setStatsPanelOpen] = useState(true);
  
  // Track expanded nodes for collapsible tree
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  
  // Prevent duplicate requests and re-renders
  const isRequestingGraphRef = React.useRef(false);
  const hasInitializedRef = React.useRef(false);

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

  // Get root nodes - prioritize SINGLE entry point for clean hierarchy
  // Order of priority: index.js/main.tsx > App component > entry type > no parents
  const rootNodes = useMemo(() => {
    if (!graphData) return [];
    
    // Priority 1: Look for index.js, index.tsx, main.tsx, main.js, main.py, App.java
    const primaryEntries = graphData.nodes.filter(n => {
      const label = n.label.toLowerCase();
      return label === 'index' || label === 'main' || label === 'app' ||
             label.includes('index.') || label.includes('main.') ||
             n.type === 'entry' || n.type === 'module';
    });
    
    // Sort to prioritize: index > main > app > module > entry
    const sortedEntries = primaryEntries.sort((a, b) => {
      const aLabel = a.label.toLowerCase();
      const bLabel = b.label.toLowerCase();
      const priority = (label: string, type: string) => {
        if (label.includes('index')) return 1;
        if (label.includes('main')) return 2;
        if (label.includes('app')) return 3;
        if (type === 'module') return 4;
        if (type === 'entry') return 5;
        return 6;
      };
      return priority(aLabel, a.type) - priority(bLabel, b.type);
    });
    
    // Return ONLY the single best entry point if found
    if (sortedEntries.length > 0) {
      console.log('Primary root node:', sortedEntries[0].label);
      return [sortedEntries[0]];
    }
    
    // Priority 2: Nodes that are not children of any other node
    const nonChildNodes = graphData.nodes.filter(node => !childNodeIds.has(node.id));
    if (nonChildNodes.length > 0) {
      // If too many roots, try to pick just one (first component or class)
      if (nonChildNodes.length > 3) {
        const bestRoot = nonChildNodes.find(n => 
          n.type === 'component' || n.type === 'class' || n.type === 'module'
        ) || nonChildNodes[0];
        console.log('Single root from non-children:', bestRoot.label);
        return [bestRoot];
      }
      return nonChildNodes;
    }
    
    // Priority 3: Nodes without parentId
    const noParentNodes = graphData.nodes.filter(node => !node.parentId);
    if (noParentNodes.length > 0) {
      return noParentNodes.length > 3 ? [noParentNodes[0]] : noParentNodes;
    }
    
    // Final fallback: first node
    console.log('Fallback to first node');
    return graphData.nodes.length > 0 ? [graphData.nodes[0]] : [];
  }, [graphData, childNodeIds]);

  // Get visible nodes based on expanded state (collapsible tree logic)
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
          visible.add(childId);
          addChildren(childId); // Recurse for nested children
        });
      }
    };
    
    rootNodes.forEach(node => addChildren(node.id));
    
    return visible;
  }, [graphData, rootNodes, expandedNodes, childrenMap]);

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
          break;

        case 'docsGenerationError':
          setIsGeneratingDocs(false);
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

  // Handle generate documentation
  const handleGenerateDocs = useCallback(() => {
    vscode.postMessage({ command: 'generateDocs' });
  }, []);

  // Handle configure API key
  const handleConfigureApiKey = useCallback(() => {
    vscode.postMessage({ command: 'configureApiKey' });
  }, []);

  // Handle sync changes (incremental update)
  const handleSyncChanges = useCallback(() => {
    vscode.postMessage({ command: 'syncChanges' });
  }, []);

  // Filter nodes based on search
  const filteredNodes = useMemo(() => {
    if (!searchTerm.trim()) return nodes;
    const term = searchTerm.toLowerCase();
    return nodes.filter(node => 
      node.data.label.toLowerCase().includes(term) ||
      node.data.type.toLowerCase().includes(term)
    );
  }, [nodes, searchTerm]);

  // Filter edges based on visible nodes
  const filteredEdges = useMemo(() => {
    const nodeIds = new Set(filteredNodes.map(n => n.id));
    return edges.filter(edge => 
      nodeIds.has(edge.source) && nodeIds.has(edge.target)
    );
  }, [edges, filteredNodes]);

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
        nodes={searchTerm ? filteredNodes : nodes}
        edges={searchTerm ? filteredEdges : edges}
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

        {/* Stats Panel */}
        <Panel position="top-left">
          <div style={styles.statsPanelContainer}>
            {/* Collapsible Header */}
            <div 
              style={{
                ...styles.statsPanelHeader,
                ...(statsPanelOpen ? {} : styles.statsPanelHeaderCollapsed),
              }}
              onClick={() => setStatsPanelOpen(!statsPanelOpen)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ color: '#64ffda', fontWeight: 600 }}>📊 Stats</span>
                {currentBranch && (
                  <span style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '4px',
                    background: 'rgba(167, 139, 250, 0.15)',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '11px',
                  }}>
                    <span>🌿</span>
                    <span style={{ color: '#a78bfa', fontWeight: 600 }}>{currentBranch}</span>
                  </span>
                )}
                <span style={{ color: '#94a3b8', fontSize: '12px' }}>
                  {stats.visible}/{stats.nodes} nodes
                </span>
              </div>
              <button
                style={{
                  ...styles.statsPanelToggle,
                  transform: statsPanelOpen ? 'rotate(0deg)' : 'rotate(180deg)',
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setStatsPanelOpen(!statsPanelOpen);
                }}
              >
                ▲
              </button>
            </div>
            
            {/* Collapsible Content */}
            <div style={{
              ...styles.statsPanel,
              ...(statsPanelOpen ? styles.statsPanelExpanded : styles.statsPanelCollapsed),
            }}>
              <div style={styles.statItem}>
                <span style={styles.statValue}>{stats.visible}/{stats.nodes}</span>
                <span style={styles.statLabel}>Visible/Total</span>
              </div>
              <div style={styles.statItem}>
                <span style={styles.statValue}>{stats.edges}</span>
                <span style={styles.statLabel}>Connections</span>
              </div>
              <div style={{ 
                borderLeft: '1px solid rgba(100, 255, 218, 0.2)', 
                paddingLeft: '15px',
                marginLeft: '5px',
              }}>
                <input
                  type="text"
                  placeholder="🔍 Search nodes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    background: 'rgba(15, 23, 42, 0.8)',
                    border: '1px solid rgba(100, 255, 218, 0.2)',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    color: '#e2e8f0',
                    fontSize: '13px',
                    width: '180px',
                    outline: 'none',
                  }}
                />
              </div>
              {/* Generate Docs Button */}
            <div style={{ 
              borderLeft: '1px solid rgba(100, 255, 218, 0.2)', 
              paddingLeft: '15px',
              marginLeft: '5px',
              display: 'flex',
              gap: '10px',
            }}>
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
                title={docsGenerated ? "Regenerate AI Documentation" : "Generate AI Documentation for all nodes"}
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
                  <>✅ Regenerate Docs</>
                ) : (
                  <>📝 Generate AI Docs</>
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
        </Panel>

        {/* Sync Status Indicator */}
        {lastSyncTime && (
          <Panel position="top-right">
            <div style={{
              background: 'rgba(30, 41, 59, 0.95)',
              backdropFilter: 'blur(10px)',
              borderRadius: '8px',
              padding: '6px 10px',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
              border: '1px solid rgba(100, 255, 218, 0.2)',
              color: '#94a3b8',
              fontSize: '11px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}>
              <span style={{ color: '#10b981' }}>●</span>
              Synced: {lastSyncTime}
            </div>
          </Panel>
        )}


      </ReactFlow>

      {/* Node Popup */}
      {popupData && (
        <NodePopup
          data={popupData}
          onClose={() => setPopupData(null)}
          onSendToCline={handleSendToCline}
          onOpenFile={handleOpenFile}
          allNodes={graphData?.nodes || []}
        />
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
