import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { LiteLLMService, getLiteLLMService } from '../llm/litellmService';

// In-memory ChromaDB types (simplified for in-memory use)
interface InMemoryDocument {
  id: string;
  content: string;
  metadata: Record<string, any>;
  embedding?: number[];
}

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
 * RAG Service with In-Memory ChromaDB for vector-based semantic search
 * Uses a pure in-memory implementation - no external server required
 * Integrates with LiteLLM for AI-powered answer generation
 */
export class RAGService {
  private isInitialized: boolean = false;
  private workspaceRoot: string = '';
  private localDocsCache: Map<string, RAGDocument> = new Map();
  private invertedIndex: Map<string, Set<string>> = new Map(); // word -> document IDs
  
  // In-Memory ChromaDB
  private inMemoryCollection: Map<string, InMemoryDocument> = new Map();
  private collectionName: string = 'codebase_docs';
  private useInMemoryChroma: boolean = true;
  
  // LiteLLM for AI-powered answers
  private litellm: LiteLLMService;

  constructor() {
    this.litellm = getLiteLLMService();
  }

  /**
   * Initialize the RAG service with in-memory ChromaDB
   * @param workspaceUri The workspace URI
   */
  async initialize(workspaceUri: vscode.Uri): Promise<boolean> {
    this.workspaceRoot = workspaceUri.fsPath;
    
    // Create unique collection name based on workspace
    const workspaceName = path.basename(this.workspaceRoot).replace(/[^a-zA-Z0-9]/g, '_');
    this.collectionName = `codebase_${workspaceName}`;
    
    // Initialize in-memory ChromaDB collection
    this.initializeInMemoryChroma();
    
    // Load documents into in-memory store
    await this.loadLocalDocsCache();
    this.isInitialized = true;
    
    console.log(`RAG Service initialized with In-Memory ChromaDB (collection: ${this.collectionName})`);
    return true;
  }

  /**
   * Initialize in-memory ChromaDB collection
   */
  private initializeInMemoryChroma(): void {
    this.inMemoryCollection = new Map();
    this.useInMemoryChroma = true;
    console.log(`In-Memory ChromaDB initialized: collection "${this.collectionName}"`);
  }

  /**
   * Generate simple embedding for text (TF-IDF inspired vector)
   * This is a lightweight embedding for in-memory semantic search
   */
  private generateEmbedding(text: string): number[] {
    const words = this.tokenize(text);
    const wordFreq = new Map<string, number>();
    
    // Calculate word frequencies
    words.forEach(word => {
      wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
    });
    
    // Create a fixed-size embedding vector (256 dimensions using hash)
    const embeddingSize = 256;
    const embedding = new Array(embeddingSize).fill(0);
    
    wordFreq.forEach((freq, word) => {
      // Hash word to get position in embedding
      let hash = 0;
      for (let i = 0; i < word.length; i++) {
        hash = ((hash << 5) - hash) + word.charCodeAt(i);
        hash = hash & hash;
      }
      const position = Math.abs(hash) % embeddingSize;
      
      // Add weighted frequency to embedding
      embedding[position] += freq * Math.log(word.length + 1);
    });
    
    // Normalize embedding
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    if (magnitude > 0) {
      for (let i = 0; i < embedding.length; i++) {
        embedding[i] /= magnitude;
      }
    }
    
    return embedding;
  }

  /**
   * Calculate cosine similarity between two embeddings
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    return magnitude > 0 ? dotProduct / magnitude : 0;
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
        this.inMemoryCollection.clear();
        
        chunks.forEach(chunk => {
          this.localDocsCache.set(chunk.id, chunk);
          this.indexDocument(chunk);
        });
        
        // Also populate in-memory ChromaDB collection for vector search
        if (this.useInMemoryChroma && chunks.length > 0) {
          this.indexToInMemoryChroma(chunks);
        }
        
        console.log(`Loaded ${chunks.length} documents into local cache and in-memory ChromaDB`);
      } catch (error) {
        console.error('Error loading local docs cache:', error);
      }
    } else {
      console.log('No search.json found, RAG will be populated during analysis');
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

    // Also index in in-memory ChromaDB
    if (this.useInMemoryChroma) {
      this.indexToInMemoryChroma(documents);
    }
    
    console.log(`Indexed ${documents.length} documents (In-Memory ChromaDB: ${this.useInMemoryChroma})`);
  }

  /**
   * Index documents into in-memory ChromaDB
   */
  private indexToInMemoryChroma(documents: RAGDocument[]): void {
    for (const doc of documents) {
      const sanitizedId = doc.id.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 100);
      const embedding = this.generateEmbedding(doc.content + ' ' + (doc.metadata.name || ''));
      
      this.inMemoryCollection.set(sanitizedId, {
        id: sanitizedId,
        content: doc.content,
        metadata: { ...doc.metadata, originalId: doc.id },
        embedding
      });
    }
  }

  /**
   * Search for similar documents using in-memory ChromaDB
   */
  async search(query: string, topK: number = 5): Promise<SearchResult[]> {
    if (!this.isInitialized) {
      throw new Error('RAG service not initialized');
    }

    console.log(`RAG search: "${query}" - inMemory: ${this.inMemoryCollection.size}, localCache: ${this.localDocsCache.size}`);

    // Try in-memory ChromaDB vector search first
    if (this.useInMemoryChroma && this.inMemoryCollection.size > 0) {
      const results = this.searchInMemoryChroma(query, topK);
      if (results.length > 0) {
        return results;
      }
    }

    // Fallback to local TF-IDF search if vector search returns nothing
    if (this.localDocsCache.size > 0) {
      return this.searchLocal(query, topK);
    }

    console.log('RAG search: No documents indexed');
    return [];
  }

  /**
   * Search across local docs AND all connected MCP servers
   * Returns combined results from current project + external projects
   */
  async searchWithExternal(query: string, topK: number = 5): Promise<{
    local: SearchResult[];
    external: Array<{ source: string; results: any[] }>;
  }> {
    // Import dynamically to avoid circular dependency
    const { getMCPClientManager } = await import('../mcp/mcpClientManager');
    const mcpManager = getMCPClientManager();

    // Search local docs
    let localResults: SearchResult[] = [];
    try {
      if (this.isInitialized) {
        localResults = await this.search(query, topK);
      }
    } catch (error) {
      console.log('Local search error:', error);
    }

    // Search external MCP servers (if connected)
    const externalResults: Array<{ source: string; results: any[] }> = [];
    
    if (mcpManager.isConnected()) {
      try {
        const mcpResults = await mcpManager.searchAll(query);
        
        // Group by source
        const bySource = new Map<string, any[]>();
        for (const result of mcpResults) {
          const source = result.source || 'Unknown';
          if (!bySource.has(source)) {
            bySource.set(source, []);
          }
          bySource.get(source)!.push(result);
        }
        
        bySource.forEach((results, source) => {
          externalResults.push({ source, results });
        });
      } catch (error) {
        console.log('MCP search error:', error);
      }
    }

    return { local: localResults, external: externalResults };
  }

  /**
   * Search using in-memory ChromaDB vector similarity
   */
  private searchInMemoryChroma(query: string, topK: number): SearchResult[] {
    const queryEmbedding = this.generateEmbedding(query);
    
    // Calculate similarity scores for all documents
    const scores: Array<{ doc: InMemoryDocument; score: number }> = [];
    
    this.inMemoryCollection.forEach(doc => {
      if (doc.embedding) {
        const similarity = this.cosineSimilarity(queryEmbedding, doc.embedding);
        scores.push({ doc, score: similarity });
      }
    });
    
    // Sort by score descending and take top K
    scores.sort((a, b) => b.score - a.score);
    const topResults = scores.slice(0, topK);

    return topResults.map(({ doc, score }) => ({
      id: (doc.metadata as any).originalId || doc.id,
      content: doc.content,
      metadata: doc.metadata,
      score
    }));
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
   * Answer a question about the project using RAG search + LLM
   * Returns relevant context and an AI-generated answer
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
    aiGenerated: boolean;
  }> {
    if (!this.isInitialized) {
      return {
        answer: 'RAG service is not initialized. Please analyze the workspace first.',
        relevantNodes: [],
        confidence: 'low',
        aiGenerated: false
      };
    }

    // Search for relevant documents
    const results = await this.search(question, 8);
    
    if (results.length === 0) {
      return {
        answer: 'No relevant information found in the codebase. Try rephrasing your question or use more specific terms.',
        relevantNodes: [],
        confidence: 'low',
        aiGenerated: false
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

    // Determine confidence based on search scores
    const topScore = results[0].score;
    const confidence: 'high' | 'medium' | 'low' = 
      topScore > 1.0 ? 'high' : 
      topScore > 0.5 ? 'medium' : 'low';

    // Try to use LLM for intelligent answer generation
    let answer: string;
    let aiGenerated = false;

    if (this.litellm.isReady()) {
      try {
        answer = await this.generateLLMAnswer(question, results);
        aiGenerated = true;
      } catch (error: any) {
        console.error('LLM answer generation failed, using fallback:', error);
        // Check if it's an API key error
        const errorMessage = error?.message || String(error);
        if (errorMessage.includes('401') || errorMessage.includes('Unauthorized') || errorMessage.includes('API key')) {
          answer = `⚠️ **API Key Error**\n\nThe AI service returned an authentication error. Your API key may be invalid or expired.\n\n**To fix this:**\n1. Click the "Setup API" button in the toolbar\n2. Enter a valid API key from your provider (OpenAI, Anthropic, etc.)\n3. Try your question again\n\n---\n\n*Meanwhile, here's what I found using basic search:*\n\n${this.synthesizeAnswer(question, results)}`;
        } else {
          answer = `⚠️ **AI Service Unavailable**\n\nCould not generate an AI-powered answer. Using basic search results instead.\n\n---\n\n${this.synthesizeAnswer(question, results)}`;
        }
      }
    } else {
      // No API key configured
      answer = `🔑 **API Key Required for AI Answers**\n\nTo get intelligent, context-aware answers, please configure an API key:\n\n1. Click the "Setup API" button in the toolbar\n2. Enter your API key (OpenAI, Anthropic, or LiteLLM)\n3. Try your question again\n\n---\n\n*Here's what I found using basic search:*\n\n${this.synthesizeAnswer(question, results)}`;
    }

    return {
      answer,
      relevantNodes,
      confidence,
      aiGenerated
    };
  }

  /**
   * Generate an intelligent answer using LLM with RAG context
   */
  private async generateLLMAnswer(question: string, results: SearchResult[]): Promise<string> {
    // Build context from search results
    const contextParts = results.slice(0, 5).map((r, i) => {
      const name = r.metadata.name || r.id;
      const type = r.metadata.type || 'unknown';
      const filePath = r.metadata.filePath || '';
      const summary = r.metadata.summary || '';
      const content = r.content.substring(0, 800);
      
      return `### ${i + 1}. ${name} (${type})
**File**: ${filePath}
**Summary**: ${summary}

\`\`\`
${content}
\`\`\``;
    });

    const context = contextParts.join('\n\n---\n\n');

    // Call LLM with the context
    const answer = await this.litellm.generateRAGAnswer(question, context);
    return answer;
  }

  /**
   * Synthesize a human-readable answer from search results (fallback)
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
