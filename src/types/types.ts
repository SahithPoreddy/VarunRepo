/**
 * Represents different personas for documentation generation
 */
export type Persona = 'developer' | 'product-manager' | 'architect' | 'business-analyst';

/**
 * Represents a node in the code graph
 */
export interface CodeNode {
  id: string;
  label: string;
  type: 'class' | 'function' | 'method' | 'component' | 'module' | 'interface' | 'decorator';
  language: 'java' | 'typescript' | 'javascript' | 'python';
  filePath: string;
  startLine: number;
  endLine: number;
  
  // Metadata
  visibility?: 'public' | 'private' | 'protected';
  isAsync?: boolean;
  isStatic?: boolean;
  isEntryPoint?: boolean;  // Mark if this is an entry point
  isPrimaryEntry?: boolean; // True if this is THE main root (e.g., index.tsx for React)
  parameters?: Parameter[];
  returnType?: string;
  
  // For React components
  props?: string[];
  hooks?: string[];
  
  // Documentation
  documentation?: Documentation;
  
  // Source code
  sourceCode: string;
}

export interface Parameter {
  name: string;
  type: string;
  optional?: boolean;
  defaultValue?: string;
}

export interface Documentation {
  summary: string;
  description: string;
  persona: Record<Persona, string>;
  tags?: string[];
}

/**
 * Represents an edge (relationship) in the code graph
 */
export interface CodeEdge {
  from: string; // source node id
  to: string;   // target node id
  type: 'calls' | 'extends' | 'implements' | 'imports' | 'uses' | 'contains';
  label?: string;
}

/**
 * Complete graph representation
 */
export interface CodeGraph {
  nodes: CodeNode[];
  edges: CodeEdge[];
  metadata: GraphMetadata;
}

export interface GraphMetadata {
  totalFiles: number;
  totalNodes: number;
  languages: string[];
  rootPath: string;
  analyzedAt: Date;
  entryPoints?: string[];  // Entry point file paths
}

/**
 * Result from workspace analysis
 */
export interface AnalysisResult {
  graph: CodeGraph;
  errors: AnalysisError[];
  warnings: string[];
}

export interface AnalysisError {
  file: string;
  line?: number;
  message: string;
  type: 'parse-error' | 'file-error' | 'analysis-error';
}

/**
 * Configuration for graph layout
 */
export interface GraphLayout {
  type: 'hierarchical' | 'force-directed' | 'circular';
  options?: any;
}

/**
 * Context provided to Cline for code modifications
 */
export interface ClineContext {
  nodeId: string;
  nodeName: string;
  nodeType: string;
  sourceCode: string;
  filePath: string;
  startLine: number;
  endLine: number;
  dependencies: string[];
  usedBy: string[];
  query: string;
}

/**
 * Response from Cline modification
 */
export interface ClineResponse {
  success: boolean;
  modifiedCode?: string;
  error?: string;
  explanation?: string;
}
