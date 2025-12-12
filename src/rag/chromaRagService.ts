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
 * ChromaDB-based RAG Service for semantic document retrieval
 * Uses vector embeddings for better search quality
 */
export class ChromaRAGService {
  private client: ChromaClient | null = null;
  private collection: Collection | null = null;
  private isInitialized: boolean = false;
  private workspaceRoot: string = '';
  private collectionName: string = 'codebase_docs';
  
  // Fallback to local cache if ChromaDB is unavailable
  private useLocalFallback: boolean = false;
  private localDocsCache: Map<string, RAGDocument> = new Map();
  private invertedIndex: Map<string, Set<string>> = new Map();

  /**
   * Initialize the ChromaDB RAG service
   * @param workspaceUri The workspace URI
   * @param chromaUrl ChromaDB server URL (default: http://localhost:8000)
   */
  async initialize(workspaceUri: vscode.Uri, chromaUrl: string = 'http://localhost:8000'): Promise<boolean> {
    this.workspaceRoot = workspaceUri.fsPath;
    
    // Create a unique collection name based on workspace
    const workspaceName = path.basename(this.workspaceRoot).replace(/[^a-zA-Z0-9]/g, '_');
    this.collectionName = `codebase_${workspaceName}`;

    try {
      // Try to connect to ChromaDB
      this.client = new ChromaClient({ path: chromaUrl });
      
      // Test connection by listing collections
      await this.client.listCollections();
      
      // Get or create collection
      this.collection = await this.client.getOrCreateCollection({
        name: this.collectionName,
        metadata: { 
          workspace: this.workspaceRoot,
          created: new Date().toISOString()
        }
      });
      
      this.useLocalFallback = false;
      this.isInitialized = true;
      console.log(`ChromaDB RAG Service initialized with collection: ${this.collectionName}`);
      
      return true;
    } catch (error) {
      console.warn('ChromaDB connection failed, falling back to local storage:', error);
      this.useLocalFallback = true;
      await this.loadLocalDocsCache();
      this.isInitialized = true;
      return true;
    }
  }

  /**
   * Load documents from local cache (fallback mode)
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
          this.indexDocumentLocally(chunk);
        });
        
        console.log(`Loaded ${chunks.length} documents into local cache (fallback mode)`);
      } catch (error) {
        console.error('Error loading local docs cache:', error);
      }
    }
  }

  /**
   * Build inverted index for local fallback
   */
  private indexDocumentLocally(doc: RAGDocument): void {
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
   * Index documents into ChromaDB
   */
  async indexDocuments(documents: RAGDocument[]): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('RAG service not initialized');
    }

    if (this.useLocalFallback) {
      // Fallback to local indexing
      documents.forEach(doc => {
        this.localDocsCache.set(doc.id, doc);
        this.indexDocumentLocally(doc);
      });
      
      // Save to disk
      await this.saveLocalCache();
      console.log(`Indexed ${documents.length} documents in local cache`);
      return;
    }

    if (!this.collection) {
      throw new Error('ChromaDB collection not available');
    }

    try {
      // Prepare documents for ChromaDB
      const ids: string[] = [];
      const contents: string[] = [];
      const metadatas: Record<string, any>[] = [];

      for (const doc of documents) {
        // Sanitize ID for ChromaDB (must be valid string)
        const sanitizedId = doc.id.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 100);
        
        ids.push(sanitizedId);
        contents.push(doc.content);
        metadatas.push({
          ...doc.metadata,
          originalId: doc.id
        });
      }

      // Delete existing documents with same IDs
      try {
        await this.collection.delete({ ids });
      } catch (e) {
        // Ignore deletion errors
      }

      // Add documents in batches
      const batchSize = 100;
      for (let i = 0; i < ids.length; i += batchSize) {
        const batchIds = ids.slice(i, i + batchSize);
        const batchContents = contents.slice(i, i + batchSize);
        const batchMetadatas = metadatas.slice(i, i + batchSize);

        await this.collection.add({
          ids: batchIds,
          documents: batchContents,
          metadatas: batchMetadatas
        });
      }

      console.log(`Indexed ${documents.length} documents in ChromaDB`);
    } catch (error) {
      console.error('ChromaDB indexing error, falling back to local:', error);
      this.useLocalFallback = true;
      
      // Fallback to local indexing
      documents.forEach(doc => {
        this.localDocsCache.set(doc.id, doc);
        this.indexDocumentLocally(doc);
      });
      await this.saveLocalCache();
    }
  }

  /**
   * Save local cache to disk
   */
  private async saveLocalCache(): Promise<void> {
    const chunksPath = path.join(this.workspaceRoot, '.doc_sync', 'search.json');
    const chunks = Array.from(this.localDocsCache.values());
    
    try {
      fs.mkdirSync(path.dirname(chunksPath), { recursive: true });
      fs.writeFileSync(chunksPath, JSON.stringify(chunks, null, 2));
    } catch (error) {
      console.error('Error saving local cache:', error);
    }
  }

  /**
   * Search for similar documents using ChromaDB vector search
   */
  async search(query: string, topK: number = 5): Promise<SearchResult[]> {
    if (!this.isInitialized) {
      throw new Error('RAG service not initialized');
    }

    if (this.useLocalFallback) {
      return this.searchLocal(query, topK);
    }

    if (!this.collection) {
      throw new Error('ChromaDB collection not available');
    }

    try {
      const results = await this.collection.query({
        queryTexts: [query],
        nResults: topK
      });

      if (!results.ids || results.ids.length === 0 || !results.ids[0]) {
        return [];
      }

      const searchResults: SearchResult[] = [];
      
      for (let i = 0; i < results.ids[0].length; i++) {
        const id = results.ids[0][i];
        const document = results.documents?.[0]?.[i] || '';
        const metadata = results.metadatas?.[0]?.[i] || {};
        const distance = results.distances?.[0]?.[i] || 0;
        
        // Convert distance to similarity score (ChromaDB uses L2 distance by default)
        // Lower distance = more similar, so we invert it
        const score = 1 / (1 + distance);

        searchResults.push({
          id: (metadata as any).originalId || id,
          content: document,
          metadata: metadata as Record<string, any>,
          score
        });
      }

      return searchResults;
    } catch (error) {
      console.error('ChromaDB search error, falling back to local:', error);
      return this.searchLocal(query, topK);
    }
  }

  /**
   * Local TF-IDF-like search (fallback)
   */
  private searchLocal(query: string, topK: number): SearchResult[] {
    const queryWords = this.tokenize(query);
    const scores = new Map<string, number>();
    
    // Calculate scores based on word matches
    queryWords.forEach(word => {
      const matchingDocs = this.invertedIndex.get(word);
      if (matchingDocs) {
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
        score: score / 100
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

    if (this.useLocalFallback) {
      return this.localDocsCache.get(id) || null;
    }

    if (!this.collection) {
      return null;
    }

    try {
      const sanitizedId = id.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 100);
      const result = await this.collection.get({ ids: [sanitizedId] });
      
      if (result.ids.length === 0) {
        return null;
      }

      return {
        id: (result.metadatas?.[0] as any)?.originalId || result.ids[0],
        content: result.documents?.[0] || '',
        metadata: (result.metadatas?.[0] as Record<string, any>) || {}
      };
    } catch (error) {
      console.error('ChromaDB get error:', error);
      return null;
    }
  }

  /**
   * Answer a question using RAG
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
      throw new Error('RAG service not initialized');
    }

    // Search for relevant documents
    const results = await this.search(question, 10);
    
    if (results.length === 0) {
      return {
        answer: "I couldn't find any relevant information in the codebase for your question.",
        relevantNodes: [],
        confidence: 'low'
      };
    }

    // Determine confidence based on scores
    const topScore = results[0]?.score || 0;
    let confidence: 'high' | 'medium' | 'low' = 'low';
    if (topScore > 0.7) confidence = 'high';
    else if (topScore > 0.4) confidence = 'medium';

    // Build relevant nodes list
    const relevantNodes = results.slice(0, 5).map(r => ({
      name: r.metadata.name || r.id,
      type: r.metadata.type || 'unknown',
      summary: r.metadata.summary || r.content.substring(0, 200),
      filePath: r.metadata.filePath || '',
      score: r.score
    }));

    // Synthesize answer
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
    
    const isWhatQuestion = questionLower.startsWith('what') || questionLower.includes('what is');
    const isHowQuestion = questionLower.startsWith('how') || questionLower.includes('how to');
    const isWhereQuestion = questionLower.startsWith('where') || questionLower.includes('where is');
    const isListQuestion = questionLower.includes('list') || questionLower.includes('all') || questionLower.includes('show me');

    const topResults = results.slice(0, 5);
    
    if (isListQuestion) {
      const items = topResults.map(r => 
        `• **${r.metadata.name || r.id}** (${r.metadata.type || 'unknown'}): ${r.metadata.summary || r.content.substring(0, 100)}`
      );
      return `Found ${results.length} relevant items:\n\n${items.join('\n\n')}`;
    }

    if (isWhereQuestion) {
      const locations = topResults.map(r => 
        `• **${r.metadata.name || r.id}** is in \`${r.metadata.filePath || 'unknown location'}\``
      );
      return `Here's where you can find relevant code:\n\n${locations.join('\n')}`;
    }

    if (isHowQuestion) {
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

    // Default answer
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
    if (this.useLocalFallback) {
      this.localDocsCache.clear();
      this.invertedIndex.clear();
      return;
    }

    if (this.client && this.collection) {
      try {
        await this.client.deleteCollection({ name: this.collectionName });
        this.collection = await this.client.createCollection({
          name: this.collectionName,
          metadata: { workspace: this.workspaceRoot }
        });
      } catch (error) {
        console.error('Error clearing ChromaDB collection:', error);
      }
    }
  }

  /**
   * Check if using local fallback
   */
  isUsingLocalFallback(): boolean {
    return this.useLocalFallback;
  }

  /**
   * Re-index from saved documents
   */
  async reindexFromDocs(): Promise<void> {
    if (this.useLocalFallback) {
      await this.loadLocalDocsCache();
    }
  }

  /**
   * Get statistics about indexed documents
   */
  async getStats(): Promise<{ documentCount: number; mode: string }> {
    if (this.useLocalFallback) {
      return {
        documentCount: this.localDocsCache.size,
        mode: 'local'
      };
    }

    if (this.collection) {
      const count = await this.collection.count();
      return {
        documentCount: count,
        mode: 'chromadb'
      };
    }

    return { documentCount: 0, mode: 'unknown' };
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
   * Load individual node details
   */
  async loadNodeDetails(nodeId: string): Promise<any | null> {
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
   * Check if .doc_sync exists
   */
  hasDocSync(): boolean {
    return fs.existsSync(path.join(this.workspaceRoot, '.doc_sync'));
  }

  /**
   * Get .doc_sync path
   */
  getDocSyncPath(): string {
    return path.join(this.workspaceRoot, '.doc_sync');
  }
}
