/**
 * RAG Types for LangChain-based semantic search
 */

/**
 * Represents a source reference that users can click to navigate
 */
export interface RAGSource {
  filePath: string;
  startLine: number;
  endLine: number;
  snippet: string;        // First ~150 chars of the content
  relevanceScore: number; // 0-1 score from retrieval/reranking
  name: string;           // Function/class name
  type: string;           // 'function' | 'class' | 'method' etc.
}

/**
 * Response from RAG query with sources for attribution
 */
export interface RAGResponse {
  answer: string;
  sources: RAGSource[];
  tokensUsed?: number;
  model?: string;
}

/**
 * Code chunk for vectorization
 */
export interface CodeChunk {
  id: string;             // e.g., "src/auth.ts::AuthService::login"
  content: string;        // docstring + function/class source
  metadata: CodeChunkMetadata;
}

/**
 * Metadata attached to each chunk for filtering and source linking
 */
export interface CodeChunkMetadata {
  filePath: string;
  startLine: number;
  endLine: number;
  type: 'function' | 'class' | 'method' | 'component' | 'module' | 'interface';
  name: string;
  language: string;
  parentName?: string;    // For methods: the class name
  docstring?: string;     // Extracted docstring/JSDoc
  signature?: string;     // Function signature for quick reference
}

/**
 * Search result from vector store before reranking
 */
export interface VectorSearchResult {
  chunk: CodeChunk;
  score: number;          // Similarity score from vector search
}

/**
 * Configuration for LangChain RAG service
 */
export interface LangchainRAGConfig {
  openaiApiKey: string;
  cohereApiKey?: string;  // Optional for reranking
  embeddingModel: string; // Default: text-embedding-3-large
  persistPath: string;    // Path to ChromaDB persistence
  collectionName: string;
  topK: number;           // Initial retrieval count
  rerankTopK: number;     // Final count after reranking
}

/**
 * Interface for RAG services (both old and new implementations)
 */
export interface IRAGService {
  initialize(workspaceUri: import('vscode').Uri): Promise<boolean>;
  indexDocuments(documents: any[]): Promise<void>;
  query(question: string): Promise<RAGResponse>;
  search(query: string, topK?: number): Promise<RAGSource[]>;
  isReady(): boolean;
}
