/**
 * Type definitions for MCP Server
 */

export interface ProjectConfig {
  /** Display name for the project */
  name?: string;
  /** Absolute path to the project root */
  path: string;
  /** Path to .doc_sync folder (defaults to {path}/.doc_sync) */
  docSyncPath?: string;
  /** Project description */
  description?: string;
  /** Technology stack tags */
  tags?: string[];
}

export interface MCPConfig {
  /** Map of project ID to project configuration */
  projects: Record<string, ProjectConfig>;
  /** Server settings */
  server?: {
    /** Log level */
    logLevel?: 'debug' | 'info' | 'warn' | 'error';
  };
}

/** Node data from .doc_sync */
export interface NodeData {
  id: string;
  label: string;
  type: 'file' | 'class' | 'function' | 'method' | 'variable' | 'import' | 'export' | 'module';
  filePath?: string;
  description?: string;
  parentId?: string;
  metadata?: NodeMetadata;
}

export interface NodeMetadata {
  startLine?: number;
  endLine?: number;
  parameters?: ParameterInfo[];
  returnType?: string;
  docstring?: string;
  imports?: string[];
  exports?: string[];
  patterns?: string[];
  keywords?: string[];
  sourceCode?: string;
  aiSummary?: string;
  aiDescription?: string;
  technicalDetails?: string;
}

export interface ParameterInfo {
  name: string;
  type?: string;
  optional?: boolean;
  defaultValue?: string;
}

export interface EdgeData {
  source: string;
  target: string;
  label?: string;
}

export interface GraphData {
  nodes: NodeData[];
  edges: EdgeData[];
}

export interface ProjectMetadata {
  projectName: string;
  generatedAt: string;
  totalNodes: number;
  totalEdges: number;
  entryPoints?: string[];
  technologies?: string[];
  patterns?: string[];
}

export interface SearchResult {
  nodeId: string;
  label: string;
  type: string;
  filePath?: string;
  snippet?: string;
  score?: number;
}
