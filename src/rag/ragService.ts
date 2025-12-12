import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ChromaClient, Collection } from 'chromadb';

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
 * RAG Service with ChromaDB support for vector-based semantic search
 * Falls back to local TF-IDF search if ChromaDB is unavailable
 */
export class RAGService {
  private isInitialized: boolean = false;
  private workspaceRoot: string = '';
  private localDocsCache: Map<string, RAGDocument> = new Map();
  private invertedIndex: Map<string, Set<string>> = new Map(); // word -> document IDs
  
  // ChromaDB
  private chromaClient: ChromaClient | null = null;
  private chromaCollection: Collection | null = null;
  private useChromaDB: boolean = false;
  private collectionName: string = 'codebase_docs';

  /**
   * Initialize the RAG service
   * @param workspaceUri The workspace URI
   * @param chromaUrl Optional ChromaDB server URL (default: http://localhost:8000)
   */
  async initialize(workspaceUri: vscode.Uri, chromaUrl?: string): Promise<boolean> {
    this.workspaceRoot = workspaceUri.fsPath;
    
    // Create unique collection name based on workspace
    const workspaceName = path.basename(this.workspaceRoot).replace(/[^a-zA-Z0-9]/g, '_');
    this.collectionName = `codebase_${workspaceName}`;
    
    // Try to connect to ChromaDB if URL is provided
    if (chromaUrl) {
      try {
        await this.initializeChromaDB(chromaUrl);
      } catch (error) {
        console.warn('ChromaDB initialization failed, using local fallback:', error);
      }
    }
    
    // Always load local cache as fallback
    await this.loadLocalDocsCache();
    this.isInitialized = true;
    
    console.log(`RAG Service initialized (ChromaDB: ${this.useChromaDB ? 'enabled' : 'disabled'})`);
    return true;
  }

  /**
   * Initialize ChromaDB connection
   */
  private async initializeChromaDB(chromaUrl: string): Promise<void> {
    this.chromaClient = new ChromaClient({ path: chromaUrl });
    
    // Test connection
    await this.chromaClient.listCollections();
    
    // Get or create collection
    this.chromaCollection = await this.chromaClient.getOrCreateCollection({
      name: this.collectionName,
      metadata: { 
        workspace: this.workspaceRoot,
        created: new Date().toISOString()
      }
    });
    
    this.useChromaDB = true;
    console.log(`ChromaDB connected: collection "${this.collectionName}"`);
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
   * Index documents into ChromaDB or local cache
   */
  async indexDocuments(documents: RAGDocument[]): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('RAG service not initialized');
    }

    // Always index locally for fallback
    documents.forEach(doc => {
      this.localDocsCache.set(doc.id, doc);
      this.indexDocument(doc);
    });

    // Also index in ChromaDB if available
    if (this.useChromaDB && this.chromaCollection) {
      try {
        await this.indexToChromaDB(documents);
      } catch (error) {
        console.error('ChromaDB indexing failed:', error);
      }
    }
    
    console.log(`Indexed ${documents.length} documents (ChromaDB: ${this.useChromaDB})`);
  }

  /**
   * Index documents into ChromaDB
   */
  private async indexToChromaDB(documents: RAGDocument[]): Promise<void> {
    if (!this.chromaCollection) return;

    const ids: string[] = [];
    const contents: string[] = [];
    const metadatas: Record<string, any>[] = [];

    for (const doc of documents) {
      const sanitizedId = doc.id.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 100);
      ids.push(sanitizedId);
      contents.push(doc.content);
      metadatas.push({ ...doc.metadata, originalId: doc.id });
    }

    // Delete existing then add
    try {
      await this.chromaCollection.delete({ ids });
    } catch (e) { /* ignore */ }

    // Add in batches
    const batchSize = 100;
    for (let i = 0; i < ids.length; i += batchSize) {
      await this.chromaCollection.add({
        ids: ids.slice(i, i + batchSize),
        documents: contents.slice(i, i + batchSize),
        metadatas: metadatas.slice(i, i + batchSize)
      });
    }
  }

  /**
   * Search for similar documents using ChromaDB or TF-IDF
   */
  async search(query: string, topK: number = 5): Promise<SearchResult[]> {
    if (!this.isInitialized) {
      throw new Error('RAG service not initialized');
    }

    // Try ChromaDB first if available
    if (this.useChromaDB && this.chromaCollection) {
      try {
        return await this.searchChromaDB(query, topK);
      } catch (error) {
        console.error('ChromaDB search failed, falling back to local:', error);
      }
    }

    // Fallback to local TF-IDF search
    return this.searchLocal(query, topK);
  }

  /**
   * Search using ChromaDB vector similarity
   */
  private async searchChromaDB(query: string, topK: number): Promise<SearchResult[]> {
    if (!this.chromaCollection) return [];

    const results = await this.chromaCollection.query({
      queryTexts: [query],
      nResults: topK
    });

    if (!results.ids?.[0]) return [];

    const searchResults: SearchResult[] = [];
    for (let i = 0; i < results.ids[0].length; i++) {
      const id = results.ids[0][i];
      const document = results.documents?.[0]?.[i] || '';
      const metadata = results.metadatas?.[0]?.[i] || {};
      const distance = results.distances?.[0]?.[i] || 0;
      
      // Convert distance to similarity score
      const score = 1 / (1 + distance);

      searchResults.push({
        id: (metadata as any).originalId || id,
        content: document,
        metadata: metadata as Record<string, any>,
        score
      });
    }

    return searchResults;
  }

  /**
   * Local TF-IDF search (fallback)
   */
  private searchLocal(query: string, topK: number): SearchResult[] {
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
   * Answer a question about the project using RAG search
   * Returns relevant context and a synthesized answer
   */
  async answerQuestion(question: string): Promise<{
    answer: string;
    relevantNodes: Array<{
      name: string;
      type: string;
      summary: string;
      filePath: string;
      score: number;
    }>;
    confidence: 'high' | 'medium' | 'low';
  }> {
    if (!this.isInitialized) {
      return {
        answer: 'RAG service is not initialized. Please analyze the workspace first.',
        relevantNodes: [],
        confidence: 'low'
      };
    }

    // Search for relevant documents
    const results = await this.search(question, 8);
    
    if (results.length === 0) {
      return {
        answer: 'No relevant information found in the codebase. Try rephrasing your question or use more specific terms.',
        relevantNodes: [],
        confidence: 'low'
      };
    }

    // Build relevant nodes list
    const relevantNodes = results.map(r => ({
      name: r.metadata.name || r.id,
      type: r.metadata.type || 'unknown',
      summary: r.metadata.summary || r.content.substring(0, 200),
      filePath: r.metadata.filePath || '',
      score: r.score
    }));

    // Synthesize an answer based on the results
    const topScore = results[0].score;
    const confidence: 'high' | 'medium' | 'low' = 
      topScore > 1.0 ? 'high' : 
      topScore > 0.5 ? 'medium' : 'low';

    // Build answer from top results
    let answer = this.synthesizeAnswer(question, results);

    return {
      answer,
      relevantNodes,
      confidence
    };
  }

  /**
   * Synthesize a human-readable answer from search results
   */
  private synthesizeAnswer(question: string, results: SearchResult[]): string {
    const questionLower = question.toLowerCase();
    
    // Detect question type
    const isWhatQuestion = questionLower.startsWith('what') || questionLower.includes('what is') || questionLower.includes('what does');
    const isHowQuestion = questionLower.startsWith('how') || questionLower.includes('how to') || questionLower.includes('how does');
    const isWhereQuestion = questionLower.startsWith('where') || questionLower.includes('where is');
    const isWhyQuestion = questionLower.startsWith('why');
    const isListQuestion = questionLower.includes('list') || questionLower.includes('all') || questionLower.includes('show me');

    const topResults = results.slice(0, 5);
    
    if (isListQuestion) {
      // List relevant components
      const items = topResults.map(r => 
        `• **${r.metadata.name || r.id}** (${r.metadata.type || 'unknown'}): ${r.metadata.summary || r.content.substring(0, 100)}`
      );
      return `Found ${results.length} relevant items:\n\n${items.join('\n\n')}`;
    }

    if (isWhereQuestion) {
      // Location-focused answer
      const locations = topResults.map(r => 
        `• **${r.metadata.name || r.id}** is in \`${r.metadata.filePath || 'unknown location'}\``
      );
      return `Here's where you can find relevant code:\n\n${locations.join('\n')}`;
    }

    if (isHowQuestion) {
      // Process/implementation focused
      const top = topResults[0];
      let answer = `Based on the codebase analysis:\n\n`;
      answer += `**${top.metadata.name || top.id}** (${top.metadata.type || 'unknown'})\n\n`;
      answer += top.metadata.summary || top.content.substring(0, 300);
      
      if (topResults.length > 1) {
        answer += `\n\n**Related components:**\n`;
        topResults.slice(1, 4).forEach(r => {
          answer += `• ${r.metadata.name || r.id}: ${(r.metadata.summary || r.content).substring(0, 100)}...\n`;
        });
      }
      return answer;
    }

    // Default: What/general question
    const top = topResults[0];
    let answer = `**${top.metadata.name || top.id}**`;
    if (top.metadata.type) answer += ` (${top.metadata.type})`;
    answer += `\n\n`;
    answer += top.metadata.summary || top.content.substring(0, 400);
    
    if (top.metadata.filePath) {
      answer += `\n\n📁 Location: \`${top.metadata.filePath}\``;
    }

    if (topResults.length > 1) {
      answer += `\n\n**See also:**\n`;
      topResults.slice(1, 4).forEach(r => {
        answer += `• ${r.metadata.name || r.id}`;
        if (r.metadata.filePath) answer += ` (\`${r.metadata.filePath}\`)`;
        answer += `\n`;
      });
    }

    return answer;
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
