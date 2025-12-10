import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

interface RAGDocument {
  id: string;
  content: string;
  metadata: Record<string, any>;
}

interface SearchResult {
  id: string;
  content: string;
  metadata: Record<string, any>;
  score: number;
}

/**
 * RAG Service using local file-based storage for document retrieval
 * This is a lightweight implementation that doesn't require external dependencies
 */
export class RAGService {
  private isInitialized: boolean = false;
  private workspaceRoot: string = '';
  private localDocsCache: Map<string, RAGDocument> = new Map();
  private invertedIndex: Map<string, Set<string>> = new Map(); // word -> document IDs

  /**
   * Initialize the RAG service
   */
  async initialize(workspaceUri: vscode.Uri): Promise<boolean> {
    this.workspaceRoot = workspaceUri.fsPath;
    
    // Load local docs cache
    await this.loadLocalDocsCache();
    this.isInitialized = true;
    
    console.log('RAG Service initialized with local storage');
    return true;
  }

  /**
   * Load documents from the local RAG chunks file
   */
  private async loadLocalDocsCache(): Promise<void> {
    const chunksPath = path.join(this.workspaceRoot, '.doc_sync', 'search.json');
    
    if (fs.existsSync(chunksPath)) {
      try {
        const content = fs.readFileSync(chunksPath, 'utf-8');
        const chunks: RAGDocument[] = JSON.parse(content);
        
        this.localDocsCache.clear();
        this.invertedIndex.clear();
        
        chunks.forEach(chunk => {
          this.localDocsCache.set(chunk.id, chunk);
          this.indexDocument(chunk);
        });
        
        console.log(`Loaded ${chunks.length} documents into local cache`);
      } catch (error) {
        console.error('Error loading local docs cache:', error);
      }
    }
  }

  /**
   * Build inverted index for a document
   */
  private indexDocument(doc: RAGDocument): void {
    const words = this.tokenize(doc.content + ' ' + (doc.metadata.name || ''));
    
    words.forEach(word => {
      if (!this.invertedIndex.has(word)) {
        this.invertedIndex.set(word, new Set());
      }
      this.invertedIndex.get(word)!.add(doc.id);
    });
  }

  /**
   * Tokenize text into searchable words
   */
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2);
  }

  /**
   * Index documents into local cache
   */
  async indexDocuments(documents: RAGDocument[]): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('RAG service not initialized');
    }

    // Store in local cache and build index
    documents.forEach(doc => {
      this.localDocsCache.set(doc.id, doc);
      this.indexDocument(doc);
    });
    
    console.log(`Indexed ${documents.length} documents in local cache`);
  }

  /**
   * Search for similar documents using TF-IDF like scoring
   */
  async search(query: string, topK: number = 5): Promise<SearchResult[]> {
    if (!this.isInitialized) {
      throw new Error('RAG service not initialized');
    }

    const queryWords = this.tokenize(query);
    const scores = new Map<string, number>();
    
    // Calculate scores based on word matches
    queryWords.forEach(word => {
      const matchingDocs = this.invertedIndex.get(word);
      if (matchingDocs) {
        // IDF-like weighting: rarer words get higher scores
        const idf = Math.log(this.localDocsCache.size / matchingDocs.size + 1);
        
        matchingDocs.forEach(docId => {
          const currentScore = scores.get(docId) || 0;
          scores.set(docId, currentScore + idf);
        });
      }
    });

    // Boost scores for exact name matches
    this.localDocsCache.forEach((doc, docId) => {
      const name = (doc.metadata.name || '').toLowerCase();
      const queryLower = query.toLowerCase();
      
      if (name === queryLower) {
        scores.set(docId, (scores.get(docId) || 0) + 100);
      } else if (name.includes(queryLower)) {
        scores.set(docId, (scores.get(docId) || 0) + 50);
      } else if (queryLower.includes(name) && name.length > 3) {
        scores.set(docId, (scores.get(docId) || 0) + 30);
      }
    });

    // Sort and return top K results
    const sortedResults = Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, topK);

    return sortedResults.map(([docId, score]) => {
      const doc = this.localDocsCache.get(docId)!;
      return {
        id: docId,
        content: doc.content,
        metadata: doc.metadata,
        score: score / 100 // Normalize
      };
    });
  }

  /**
   * Get a specific document by ID
   */
  async getDocument(id: string): Promise<RAGDocument | null> {
    if (!this.isInitialized) {
      throw new Error('RAG service not initialized');
    }

    return this.localDocsCache.get(id) || null;
  }

  /**
   * Get component info by name or ID for popup display
   */
  async getComponentInfo(identifier: string): Promise<{
    name: string;
    type: string;
    summary: string;
    details: string;
    dependencies: string[];
    dependents: string[];
    patterns: string[];
    filePath: string;
    sourcePreview: string;
  } | null> {
    // First try direct ID lookup
    let doc = await this.getDocument(identifier);
    
    // If not found, search by name
    if (!doc) {
      const searchResults = await this.search(identifier, 1);
      if (searchResults.length > 0 && searchResults[0].score > 0.1) {
        doc = {
          id: searchResults[0].id,
          content: searchResults[0].content,
          metadata: searchResults[0].metadata
        };
      }
    }
    
    if (!doc) {
      return null;
    }

    // Parse dependencies and patterns from metadata
    const dependencies = this.parseArrayFromMetadata(doc.metadata.dependencies);
    const dependents = this.parseArrayFromMetadata(doc.metadata.dependents);
    const patterns = this.parseArrayFromMetadata(doc.metadata.patterns);

    // Get source code preview
    let sourcePreview = '';
    const sourceDoc = await this.getDocument(`${doc.id}-source`);
    if (sourceDoc) {
      sourcePreview = sourceDoc.content.replace(/^Source code for [^:]+:\n\n/, '');
      // Limit preview length
      if (sourcePreview.length > 1000) {
        sourcePreview = sourcePreview.substring(0, 1000) + '\n// ... (truncated)';
      }
    }

    return {
      name: doc.metadata.name || identifier,
      type: doc.metadata.componentType || doc.metadata.type || 'unknown',
      summary: doc.content,
      details: `File: ${doc.metadata.relativePath || doc.metadata.filePath || 'Unknown'}\nLanguage: ${doc.metadata.language || 'Unknown'}`,
      dependencies,
      dependents,
      patterns,
      filePath: doc.metadata.filePath || '',
      sourcePreview
    };
  }

  /**
   * Parse array from metadata (handles comma-separated strings)
   */
  private parseArrayFromMetadata(value: any): string[] {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
      return value.split(', ').filter(s => s.length > 0);
    }
    return [];
  }

  /**
   * Clear all indexed documents
   */
  async clearIndex(): Promise<void> {
    this.localDocsCache.clear();
    this.invertedIndex.clear();
  }

  /**
   * Check if the service is using local fallback (always true now)
   */
  isUsingLocalFallback(): boolean {
    return true;
  }

  /**
   * Re-index from saved documents
   */
  async reindexFromDocs(): Promise<void> {
    await this.loadLocalDocsCache();
  }

  /**
   * Get statistics about the indexed documents
   */
  getStats(): { documentCount: number; indexedWords: number } {
    return {
      documentCount: this.localDocsCache.size,
      indexedWords: this.invertedIndex.size
    };
  }

  /**
   * Load ReactFlow graph from .doc_sync/graph/graph.json
   */
  async loadGraph(): Promise<{ nodes: any[]; edges: any[]; metadata: any } | null> {
    const graphPath = path.join(this.workspaceRoot, '.doc_sync', 'graph', 'graph.json');
    
    if (fs.existsSync(graphPath)) {
      try {
        const content = fs.readFileSync(graphPath, 'utf-8');
        const graphData = JSON.parse(content);
        console.log(`Loaded graph with ${graphData.nodes?.length || 0} nodes and ${graphData.edges?.length || 0} edges`);
        return {
          nodes: graphData.nodes || [],
          edges: graphData.edges || [],
          metadata: graphData.metadata || {}
        };
      } catch (error) {
        console.error('Error loading graph:', error);
        return null;
      }
    }
    return null;
  }

  /**
   * Load individual node details from .doc_sync/nodes/<nodeId>.json
   */
  async loadNodeDetails(nodeId: string): Promise<any | null> {
    // Sanitize the node ID for file name
    const sanitizedId = nodeId
      .replace(/[^a-zA-Z0-9]/g, '_')
      .replace(/_+/g, '_')
      .substring(0, 100);
    
    const nodePath = path.join(this.workspaceRoot, '.doc_sync', 'nodes', `${sanitizedId}.json`);
    
    if (fs.existsSync(nodePath)) {
      try {
        const content = fs.readFileSync(nodePath, 'utf-8');
        return JSON.parse(content);
      } catch (error) {
        console.error(`Error loading node ${nodeId}:`, error);
        return null;
      }
    }
    return null;
  }

  /**
   * Load node index from .doc_sync/nodes/_index.json
   */
  async loadNodeIndex(): Promise<any[] | null> {
    const indexPath = path.join(this.workspaceRoot, '.doc_sync', 'nodes', '_index.json');
    
    if (fs.existsSync(indexPath)) {
      try {
        const content = fs.readFileSync(indexPath, 'utf-8');
        return JSON.parse(content);
      } catch (error) {
        console.error('Error loading node index:', error);
        return null;
      }
    }
    return null;
  }

  /**
   * Load project metadata from .doc_sync/metadata.json
   */
  async loadMetadata(): Promise<any | null> {
    const metadataPath = path.join(this.workspaceRoot, '.doc_sync', 'metadata.json');
    
    if (fs.existsSync(metadataPath)) {
      try {
        const content = fs.readFileSync(metadataPath, 'utf-8');
        return JSON.parse(content);
      } catch (error) {
        console.error('Error loading metadata:', error);
        return null;
      }
    }
    return null;
  }

  /**
   * Check if .doc_sync exists for this workspace
   */
  hasDocSync(): boolean {
    const docSyncPath = path.join(this.workspaceRoot, '.doc_sync');
    return fs.existsSync(docSyncPath);
  }

  /**
   * Get the .doc_sync folder path
   */
  getDocSyncPath(): string {
    return path.join(this.workspaceRoot, '.doc_sync');
  }
}
