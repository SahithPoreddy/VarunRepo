import React, { useCallback, useMemo } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
  Position,
} from 'reactflow';
import 'reactflow/dist/style.css';

// CodeNode and CodeEdge types
interface CodeNode {
  id: string;
  label: string;
  type: string;
  language: string;
  filePath: string;
  startLine: number;
  endLine: number;
  isEntryPoint?: boolean;
  isPrimaryEntry?: boolean; // THE main root (e.g., index.tsx for React)
  sourceCode: string;
}

interface CodeEdge {
  from: string;
  to: string;
  type: string;
  label?: string;
}

interface CodeFlowProps {
  nodes: CodeNode[];
  edges: CodeEdge[];
  onNodeClick: (nodeId: string) => void;
  expandedNodes: Set<string>;
  onExpandedNodesChange: (nodes: Set<string>) => void;
}

export const CodeFlow: React.FC<CodeFlowProps> = ({ nodes, edges, onNodeClick, expandedNodes, onExpandedNodesChange }) => {
  console.log('CodeFlow rendering with:', { 
    nodesCount: nodes.length, 
    edgesCount: edges.length,
    sampleEdges: edges.slice(0, 5).map(e => ({ from: e.from, to: e.to, type: e.type })),
    nodeIds: nodes.map(n => n.id).slice(0, 5)
  });
  
  console.log('🔍 First node details:', nodes[0] ? {
    id: nodes[0].id,
    filePath: nodes[0].filePath,
    label: nodes[0].label
  } : 'No nodes');
  
  console.log('🔍 Edge analysis:', {
    totalEdges: edges.length,
    edgesFromApp: edges.filter(e => e.from.includes('App.tsx')).length,
    edgesToApp: edges.filter(e => e.to.includes('App.tsx')).length,
    sampleFrom: edges.slice(0, 3).map(e => e.from),
    sampleTo: edges.slice(0, 3).map(e => e.to)
  });
  
  // Use the expandedNodes from props
  const setExpandedNodes = onExpandedNodesChange;
  
  // Get children for each node - by matching node's filePath with edge's from
  const getChildNodes = useCallback((nodeId: string): string[] => {
    // Find the node object to get its filePath
    const node = nodes.find(n => n.id === nodeId);
    if (!node) {
      console.log(`❌ Node not found for id: ${nodeId}`);
      return [];
    }
    
    const nodeFilePath = node.filePath;
    
    console.log(`🔍 getChildNodes called for:`, {
      nodeId: nodeId.substring(0, 60),
      nodeFilePath: nodeFilePath,
      totalEdges: edges.length,
    });
    
    // Find all edges where 'from' matches the node's file path
    const matchingEdges = edges.filter(e => e.from === nodeFilePath);
    
    console.log(`📊 Matching edges:`, {
      matchCount: matchingEdges.length,
      sampleTargets: matchingEdges.slice(0, 3).map(e => e.to)
    });
    
    // Map edge targets to node IDs
    const childIds = matchingEdges.map(e => {
      // Find the node that has this file path
      const targetNode = nodes.find(n => n.filePath === e.to);
      return targetNode ? targetNode.id : null;
    }).filter((id): id is string => id !== null);
    
    console.log(`✅ Final children for "${node.label}":`, {
      count: childIds.length,
      sample: childIds.slice(0, 3).map(id => nodes.find(n => n.id === id)?.label)
    });
    
    return childIds;
  }, [edges, nodes]);
  
  // Get parent nodes - by matching node's filePath with edge's to
  const getParentNodes = useCallback((nodeId: string): string[] => {
    // Find the node object to get its filePath
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return [];
    
    const nodeFilePath = node.filePath;
    
    // Find all edges where 'to' matches the node's file path
    return edges
      .filter(e => e.to === nodeFilePath)
      .map(e => {
        // Find the node that has this file path as 'from'
        const sourceNode = nodes.find(n => n.filePath === e.from);
        return sourceNode ? sourceNode.id : null;
      })
      .filter((id): id is string => id !== null);
  }, [edges, nodes]);
  
  // Determine which nodes should be visible
  // NEW: Support duplicate nodes - each parent gets its own instance of shared children
  // Instance ID format: "originalNodeId" for roots, "originalNodeId@parentInstanceId" for children
  
  interface NodeInstance {
    originalId: string;      // Original node ID
    instanceId: string;      // Unique instance ID (includes parent path)
    parentInstanceId: string | null;  // Parent's instance ID
    node: CodeNode;          // Reference to original node data
  }
  
  const { visibleInstances, instanceEdges } = useMemo(() => {
    const instances: NodeInstance[] = [];
    const instEdges: { sourceInstanceId: string; targetInstanceId: string; type: string }[] = [];
    
    // Find primary entry or first entry point
    const primaryEntry = nodes.find(n => n.isPrimaryEntry);
    const rootNode = primaryEntry || nodes.find(n => n.isEntryPoint) || nodes[0];
    
    if (!rootNode) {
      return { visibleInstances: [], instanceEdges: [] };
    }
    
    // Add root as first instance
    const rootInstance: NodeInstance = {
      originalId: rootNode.id,
      instanceId: rootNode.id,  // Root uses original ID
      parentInstanceId: null,
      node: rootNode
    };
    instances.push(rootInstance);
    
    // Recursively add children for expanded nodes
    // Each child gets a unique instance ID based on its parent
    const addChildInstances = (parentInstance: NodeInstance) => {
      if (!expandedNodes.has(parentInstance.originalId)) {
        return;  // Parent not expanded, don't add children
      }
      
      const children = getChildNodes(parentInstance.originalId);
      
      children.forEach(childOriginalId => {
        const childNode = nodes.find(n => n.id === childOriginalId);
        if (!childNode) return;
        
        // Create unique instance ID: childId@parentInstanceId
        const childInstanceId = `${childOriginalId}@${parentInstance.instanceId}`;
        
        const childInstance: NodeInstance = {
          originalId: childOriginalId,
          instanceId: childInstanceId,
          parentInstanceId: parentInstance.instanceId,
          node: childNode
        };
        
        instances.push(childInstance);
        
        // Add edge from parent instance to child instance
        instEdges.push({
          sourceInstanceId: parentInstance.instanceId,
          targetInstanceId: childInstanceId,
          type: 'imports'
        });
        
        // Recursively add this child's children if it's expanded
        addChildInstances(childInstance);
      });
    };
    
    // Start from root
    addChildInstances(rootInstance);
    
    console.log('Node instances:', { 
      total: instances.length, 
      edges: instEdges.length,
      samples: instances.slice(0, 5).map(i => ({ label: i.node.label, instanceId: i.instanceId.substring(0, 40) }))
    });
    
    return { visibleInstances: instances, instanceEdges: instEdges };
  }, [nodes, expandedNodes, getChildNodes]);
  
  // Convert instances to ReactFlow Nodes with tree layout
  const flowNodes: Node[] = useMemo(() => {
    console.log('Converting instances:', visibleInstances.length);
    
    if (visibleInstances.length === 0) return [];
    
    // Build parent-children map from instances
    const instanceChildren = new Map<string, string[]>();
    visibleInstances.forEach(inst => {
      if (inst.parentInstanceId) {
        const siblings = instanceChildren.get(inst.parentInstanceId) || [];
        siblings.push(inst.instanceId);
        instanceChildren.set(inst.parentInstanceId, siblings);
      }
    });
    
    // Calculate levels
    const instanceLevels = new Map<string, number>();
    const rootInstance = visibleInstances.find(i => i.parentInstanceId === null);
    
    if (!rootInstance) return [];
    
    // BFS to assign levels
    const queue: { instanceId: string; level: number }[] = [{ instanceId: rootInstance.instanceId, level: 0 }];
    instanceLevels.set(rootInstance.instanceId, 0);
    
    while (queue.length > 0) {
      const { instanceId, level } = queue.shift()!;
      const children = instanceChildren.get(instanceId) || [];
      
      children.forEach(childId => {
        if (!instanceLevels.has(childId)) {
          instanceLevels.set(childId, level + 1);
          queue.push({ instanceId: childId, level: level + 1 });
        }
      });
    }
    
    // Find root instances (should be just one)
    const rootInstances = visibleInstances.filter(i => i.parentInstanceId === null);
    
    // Base layout parameters for LEFT-TO-RIGHT graph layout
    const nodeWidth = 200;
    const nodeHeight = 80;
    const minVerticalGap = 30;
    const minHorizontalGap = 280;
    const maxHorizontalGap = 400;
    
    // Helper: Get children instance IDs for a given instance
    const getInstanceChildren = (instanceId: string): string[] => {
      return instanceChildren.get(instanceId) || [];
    };
    
    // Calculate dynamic spacing based on number of children
    const getVerticalSpacing = (numChildren: number): number => {
      if (numChildren <= 2) return nodeHeight + 50;
      if (numChildren <= 4) return nodeHeight + 35;
      if (numChildren <= 6) return nodeHeight + 25;
      return nodeHeight + minVerticalGap;
    };
    
    const getHorizontalSpacing = (numChildren: number): number => {
      if (numChildren <= 1) return minHorizontalGap;
      if (numChildren <= 3) return minHorizontalGap + 30;
      if (numChildren <= 6) return minHorizontalGap + 60;
      return maxHorizontalGap;
    };
    
    // Calculate positions for LEFT-TO-RIGHT layout
    const instancePositions = new Map<string, { x: number; y: number }>();
    const instanceSubtreeHeight = new Map<string, number>();
    
    // First pass: Calculate subtree height for each instance
    const calculateSubtreeHeight = (instanceId: string): number => {
      if (instanceSubtreeHeight.has(instanceId)) {
        return instanceSubtreeHeight.get(instanceId)!;
      }
      
      const children = getInstanceChildren(instanceId);
      
      if (children.length === 0) {
        instanceSubtreeHeight.set(instanceId, nodeHeight);
        return nodeHeight;
      }
      
      const vSpacing = getVerticalSpacing(children.length);
      const childrenHeight = children.reduce((sum, childId) => {
        return sum + calculateSubtreeHeight(childId);
      }, 0);
      
      const totalHeight = childrenHeight + (children.length - 1) * (vSpacing - nodeHeight);
      const height = Math.max(nodeHeight, totalHeight);
      instanceSubtreeHeight.set(instanceId, height);
      return height;
    };
    
    // Calculate heights starting from roots
    rootInstances.forEach(ri => calculateSubtreeHeight(ri.instanceId));
    
    // Second pass: Position instances LEFT-TO-RIGHT
    const positionInstance = (instanceId: string, xPosition: number, centerY: number) => {
      instancePositions.set(instanceId, {
        x: xPosition,
        y: centerY - nodeHeight / 2
      });
      
      const children = getInstanceChildren(instanceId);
      if (children.length === 0) return;
      
      const vSpacing = getVerticalSpacing(children.length);
      const hSpacing = getHorizontalSpacing(children.length);
      
      const childrenTotalHeight = children.reduce((sum, childId) => {
        return sum + (instanceSubtreeHeight.get(childId) || nodeHeight);
      }, 0) + (children.length - 1) * (vSpacing - nodeHeight);
      
      let currentY = centerY - childrenTotalHeight / 2;
      const childX = xPosition + nodeWidth + hSpacing;
      
      children.forEach(childId => {
        const childHeight = instanceSubtreeHeight.get(childId) || nodeHeight;
        const childCenterY = currentY + childHeight / 2;
        positionInstance(childId, childX, childCenterY);
        currentY += childHeight + (vSpacing - nodeHeight);
      });
    };
    
    // Position root instances
    const rootVSpacing = getVerticalSpacing(rootInstances.length);
    const rootTotalHeight = rootInstances.reduce((sum, ri) => {
      return sum + (instanceSubtreeHeight.get(ri.instanceId) || nodeHeight);
    }, 0) + (rootInstances.length - 1) * rootVSpacing;
    
    let rootStartY = -rootTotalHeight / 2;
    
    rootInstances.forEach(ri => {
      const subtreeHeight = instanceSubtreeHeight.get(ri.instanceId) || nodeHeight;
      const centerY = rootStartY + subtreeHeight / 2;
      positionInstance(ri.instanceId, 0, centerY);
      rootStartY += subtreeHeight + rootVSpacing;
    });
    
    // Convert instances to ReactFlow nodes
    return visibleInstances.map((instance) => {
      const node = instance.node;
      const isEntryPoint = node.isEntryPoint || false;
      const children = getChildNodes(instance.originalId);
      const hasChildren = children.length > 0;
      const isExpanded = expandedNodes.has(instance.originalId);
      
      const position = instancePositions.get(instance.instanceId) || { x: 0, y: 0 };
      
      return {
        id: instance.instanceId,  // Use instance ID for unique identification
        type: 'default',
        position: position,
        data: { 
          label: (
            <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'visible !important' }}>
              <div style={{ padding: '10px', textAlign: 'center', paddingBottom: hasChildren ? '20px' : '10px' }}>
                {isEntryPoint && <div style={{ fontSize: '11px', color: '#16a34a', fontWeight: 'bold', marginBottom: '4px' }}>⭐ ENTRY</div>}
                <div style={{ 
                  fontWeight: '700', 
                  fontSize: '14px',
                  marginBottom: '4px',
                  color: '#1f2937',
                  wordBreak: 'break-word'
                }}>
                  {node.label}
                </div>
                <div style={{ 
                  fontSize: '10px', 
                  color: '#6b7280',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  {node.type}
                </div>
                {hasChildren && (
                  <div 
                    style={{ 
                      marginTop: '8px',
                      display: 'inline-block',
                      cursor: 'pointer',
                      background: isExpanded ? '#dc2626' : '#2563eb',
                      color: 'white',
                      border: '2px solid white',
                      borderRadius: '50%',
                      width: '28px',
                      height: '28px',
                      lineHeight: '24px',
                      textAlign: 'center',
                      fontSize: '18px',
                      fontWeight: '900',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                      transition: 'all 0.2s ease',
                      userSelect: 'none',
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      const newSet = new Set(expandedNodes);
                      if (isExpanded) {
                        newSet.delete(instance.originalId);
                      } else {
                        newSet.add(instance.originalId);
                      }
                      setExpandedNodes(newSet);
                    }}
                    title={isExpanded ? `Collapse` : `Expand (${children.length})`}
                  >
                    {isExpanded ? '−' : '+'}
                  </div>
                )}
              </div>
            </div>
          ),
          codeNode: node,
          originalId: instance.originalId,
          hasChildren
        },
        style: {
          background: isEntryPoint ? '#dcfce7' : getNodeColor(node.type),
          border: isEntryPoint ? '3px solid #16a34a' : hasChildren ? '2px solid #2563eb' : '1px solid #d1d5db',
          borderRadius: '10px',
          padding: 0,
          fontSize: '13px',
          width: nodeWidth,
          minHeight: nodeHeight,
          boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
          overflow: 'visible',
        },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
      };
    });
  }, [visibleInstances, expandedNodes, getChildNodes, setExpandedNodes]);

  // Convert instanceEdges to ReactFlow Edge format
  const flowEdges: Edge[] = useMemo(() => {
    console.log('📊 Converting instance edges:', instanceEdges.length);
    
    return instanceEdges.map((edge, index) => ({
      id: `edge-${index}-${edge.sourceInstanceId}-${edge.targetInstanceId}`,
      source: edge.sourceInstanceId,
      target: edge.targetInstanceId,
      type: 'straight',
      animated: false,
      style: { 
        stroke: '#1e293b',
        strokeWidth: 1.5,
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: '#1e293b',
        width: 10,
        height: 10,
      },
    }));
  }, [instanceEdges]);

  const [nodesState, setNodes, onNodesChange] = useNodesState(flowNodes);
  const [edgesState, setEdges, onEdgesChange] = useEdgesState(flowEdges);

  // Update nodes and edges when props change
  React.useEffect(() => {
    setNodes(flowNodes);
  }, [flowNodes, setNodes]);

  React.useEffect(() => {
    setEdges(flowEdges);
  }, [flowEdges, setEdges]);

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      const codeNode = node.data.codeNode as CodeNode;
      if (codeNode) {
        onNodeClick(codeNode.id);
      }
    },
    [onNodeClick]
  );

  return (
    <div style={{ width: '100%', height: '100%', background: '#ffffff' }}>
      <ReactFlow
        nodes={nodesState}
        edges={edgesState}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        fitView
        fitViewOptions={{ padding: 0.4, maxZoom: 1.0 }}
        attributionPosition="bottom-left"
        defaultEdgeOptions={{
          type: 'default',
          animated: false,
        }}
        minZoom={0.1}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        nodesDraggable={true}
        nodesConnectable={false}
        elementsSelectable={true}
      >
        <Background color="#f0f0f0" gap={16} />
        <Controls />
        <MiniMap
          nodeColor={(node) => {
            const codeNode = node.data.codeNode as CodeNode;
            return codeNode?.isEntryPoint ? '#16a34a' : '#94a3b8';
          }}
          maskColor="rgba(0, 0, 0, 0.1)"
        />
      </ReactFlow>
    </div>
  );
};

function getNodeColor(type: string): string {
  const colors: Record<string, string> = {
    class: '#dbeafe',      // blue
    function: '#dcfce7',    // green
    method: '#fef3c7',      // yellow
    component: '#fed7aa',   // orange
    module: '#e9d5ff',      // purple
    interface: '#d1fae5',   // emerald
  };
  return colors[type] || '#f1f5f9';
}

function getEdgeColor(type: string): string {
  const colors: Record<string, string> = {
    calls: '#1e293b',        // Very dark blue-gray
    extends: '#1e40af',      // Dark blue
    implements: '#065f46',   // Dark green
    imports: '#581c87',      // Dark purple
    uses: '#4338ca',         // Dark indigo
    contains: '#374151',     // Dark gray
  };
  return colors[type] || '#1e293b';
}
