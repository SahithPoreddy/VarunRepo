/**
 * OpenAI-based RAG Service
 * Uses OpenAI embeddings + persistent JSON store + Cohere reranking
 * No LangChain dependencies - direct OpenAI SDK usage
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import OpenAI from 'openai';
import { 
  RAGResponse, 
  RAGSource, 
  IRAGService, 
  LangchainRAGConfig,
  CodeChunk,
  CodeChunkMetadata 
} from './types';
import { CodeChunker, getCodeChunker } from './codeChunker';
import { Reranker, createReranker } from './reranker';
import { CodeGraph } from '../types/types';

interface VectorDocument {
  id: string;
  content: string;
  embedding: number[];
  metadata: CodeChunkMetadata;
}

interface VectorStore {
  documents: VectorDocument[];
  indexedAt: string;
  embeddingModel: string;
}

/**
 * OpenAI-based RAG service with persistent vector storage
 */
export class LangchainRagService implements IRAGService {
  private config: LangchainRAGConfig;
  private openai: OpenAI | null = null;
  private vectorStore: VectorDocument[] = [];
  private reranker: Reranker | null = null;
  private chunker: CodeChunker;
  private workspaceRoot: string = '';
  private initialized: boolean = false;
  private vectorStorePath: string = '';
  
  constructor() {
    this.chunker = getCodeChunker();
    this.config = {
      openaiApiKey: '',
      cohereApiKey: undefined,
      embeddingModel: 'text-embedding-3-large',
      persistPath: '',
      collectionName: 'mindframe_codebase',
      topK: 20,
      rerankTopK: 5
    };
  }
  
  /**
   * Initialize the RAG service
   */
  async initialize(workspaceUri: vscode.Uri): Promise<boolean> {
    this.workspaceRoot = workspaceUri.fsPath;
    
    try {
      // Load environment variables
      await this.loadEnvFile();
      
      // Get API keys
      const openaiKey = this.getOpenAIKey();
      if (!openaiKey) {
        console.error('LangchainRagService: OPENAI_API_KEY not found');
        vscode.window.showErrorMessage(
          'OpenAI API key not found. Please set OPENAI_API_KEY in .env file or VS Code settings.'
        );
        return false;
      }
      
      this.config.openaiApiKey = openaiKey;
      this.config.cohereApiKey = this.getCohereKey();
      
      // Setup persistence path
      this.config.persistPath = path.join(this.workspaceRoot, '.mindframe', 'vectors');
      this.vectorStorePath = path.join(this.config.persistPath, 'vectors.json');
      
      // Ensure vectors directory exists
      if (!fs.existsSync(this.config.persistPath)) {
        fs.mkdirSync(this.config.persistPath, { recursive: true });
      }
      
      // Initialize OpenAI client
      this.openai = new OpenAI({
        apiKey: this.config.openaiApiKey
      });
      
      // Load existing vector store if exists
      await this.loadVectorStore();
      
      // Initialize reranker
      this.reranker = createReranker(this.config.cohereApiKey);
      
      this.initialized = true;
      console.log(`LangchainRagService initialized`);
      console.log(`  - Embeddings: ${this.config.embeddingModel}`);
      console.log(`  - Reranker: ${this.reranker.isRerankerAvailable() ? 'Cohere' : 'Fallback'}`);
      console.log(`  - Persist path: ${this.config.persistPath}`);
      console.log(`  - Loaded documents: ${this.vectorStore.length}`);
      
      return true;
      
    } catch (error) {
      console.error('LangchainRagService initialization failed:', error);
      return false;
    }
  }
  
  /**
   * Load .env file from workspace
   */
  private async loadEnvFile(): Promise<void> {
    const envPath = path.join(this.workspaceRoot, '.env');
    
    if (fs.existsSync(envPath)) {
      try {
        const content = fs.readFileSync(envPath, 'utf-8');
        const lines = content.split('\n');
        for (const line of lines) {
          const match = line.match(/^([^=]+)=(.*)$/);
          if (match) {
            const key = match[1].trim();
            const value = match[2].trim().replace(/^["']|["']$/g, '');
            if (!process.env[key]) {
              process.env[key] = value;
            }
          }
        }
        console.log('Loaded .env file from workspace');
      } catch (error) {
        console.log('Error loading .env:', error);
      }
    }
  }
  
  /**
   * Get OpenAI API key from various sources
   */
  private getOpenAIKey(): string | undefined {
    if (process.env.OPENAI_API_KEY) {
      return process.env.OPENAI_API_KEY;
    }
    
    const config = vscode.workspace.getConfiguration('mindframe');
    const litellmKey = config.get<string>('litellm.apiKey');
    if (litellmKey && litellmKey.startsWith('sk-')) {
      return litellmKey;
    }
    
    return undefined;
  }
  
  /**
   * Get Cohere API key
   */
  private getCohereKey(): string | undefined {
    if (process.env.COHERE_API_KEY) {
      return process.env.COHERE_API_KEY;
    }
    
    const config = vscode.workspace.getConfiguration('mindframe');
    return config.get<string>('rag.cohereApiKey') || undefined;
  }
  
  /**
   * Load vector store from disk
   */
  private async loadVectorStore(): Promise<void> {
    if (fs.existsSync(this.vectorStorePath)) {
      try {
        const content = fs.readFileSync(this.vectorStorePath, 'utf-8');
        const store: VectorStore = JSON.parse(content);
        this.vectorStore = store.documents || [];
        console.log(`Loaded ${this.vectorStore.length} vectors from disk`);
      } catch (error) {
        console.error('Error loading vector store:', error);
        this.vectorStore = [];
      }
    }
  }
  
  /**
   * Save vector store to disk
   */
  private async saveVectorStore(): Promise<void> {
    try {
      const store: VectorStore = {
        documents: this.vectorStore,
        indexedAt: new Date().toISOString(),
        embeddingModel: this.config.embeddingModel
      };
      fs.writeFileSync(this.vectorStorePath, JSON.stringify(store, null, 2));
      console.log(`Saved ${this.vectorStore.length} vectors to disk`);
    } catch (error) {
      console.error('Error saving vector store:', error);
    }
  }
  
  /**
   * Generate embeddings using OpenAI
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    if (!this.openai) {
      throw new Error('OpenAI client not initialized');
    }
    
    const response = await this.openai.embeddings.create({
      model: this.config.embeddingModel,
      input: text.substring(0, 8000) // Limit to 8000 chars
    });
    
    return response.data[0].embedding;
  }
  
  /**
   * Generate embeddings for multiple texts (batched)
   */
  private async generateEmbeddings(texts: string[]): Promise<number[][]> {
    if (!this.openai) {
      throw new Error('OpenAI client not initialized');
    }
    
    // OpenAI allows batching up to 2048 inputs
    const batchSize = 100;
    const allEmbeddings: number[][] = [];
    
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize).map(t => t.substring(0, 8000));
      
      const response = await this.openai.embeddings.create({
        model: this.config.embeddingModel,
        input: batch
      });
      
      allEmbeddings.push(...response.data.map(d => d.embedding));
      
      // Small delay to avoid rate limiting
      if (i + batchSize < texts.length) {
        await new Promise(r => setTimeout(r, 100));
      }
    }
    
    return allEmbeddings;
  }
  
  /**
   * Calculate cosine similarity
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
   * Index documents (compatibility method)
   */
  async indexDocuments(documents: any[]): Promise<void> {
    console.log(`indexDocuments called with ${documents.length} documents`);
  }
  
  /**
   * Index a code graph
   */
  async indexGraph(graph: CodeGraph): Promise<void> {
    if (!this.openai) {
      throw new Error('RAG service not initialized');
    }
    
    // Convert graph to chunks
    const chunks = this.chunker.chunkGraph(graph);
    
    if (chunks.length === 0) {
      console.log('No chunks to index');
      return;
    }
    
    console.log(`Indexing ${chunks.length} code chunks with OpenAI embeddings...`);
    
    // Generate embeddings for all chunks
    const texts = chunks.map(c => `${c.metadata.name} ${c.metadata.type}\n${c.content}`);
    
    try {
      const embeddings = await this.generateEmbeddings(texts);
      
      // Build vector documents
      this.vectorStore = chunks.map((chunk, i) => ({
        id: chunk.id,
        content: chunk.content,
        embedding: embeddings[i],
        metadata: chunk.metadata
      }));
      
      // Save to disk
      await this.saveVectorStore();
      
      console.log(`Successfully indexed ${chunks.length} chunks`);
    } catch (error) {
      console.error('Error indexing documents:', error);
      throw error;
    }
  }
  
  /**
   * Search for relevant code chunks
   */
  async search(queryText: string, topK?: number): Promise<RAGSource[]> {
    if (!this.openai || !this.reranker) {
      throw new Error('RAG service not initialized');
    }
    
    if (this.vectorStore.length === 0) {
      return [];
    }
    
    const k = topK || this.config.rerankTopK;
    
    try {
      // Generate query embedding
      const queryEmbedding = await this.generateEmbedding(queryText);
      
      // Calculate similarity scores
      const scored = this.vectorStore.map(doc => ({
        doc,
        score: this.cosineSimilarity(queryEmbedding, doc.embedding)
      }));
      
      // Sort by score and take top K for reranking
      scored.sort((a, b) => b.score - a.score);
      const topResults = scored.slice(0, this.config.topK);
      
      // Convert to reranker format
      const forReranking = topResults.map(({ doc, score }) => ({
        document: {
          pageContent: doc.content,
          metadata: doc.metadata
        },
        score
      }));
      
      // Rerank
      const reranked = await this.reranker.rerank(queryText, forReranking as any, k);
      
      // Convert to sources
      return reranked.map(({ document, score }) => ({
        filePath: (document.metadata as CodeChunkMetadata).filePath,
        startLine: (document.metadata as CodeChunkMetadata).startLine,
        endLine: (document.metadata as CodeChunkMetadata).endLine,
        snippet: document.pageContent.substring(0, 150) + (document.pageContent.length > 150 ? '...' : ''),
        relevanceScore: Math.min(score, 1),
        name: (document.metadata as CodeChunkMetadata).name,
        type: (document.metadata as CodeChunkMetadata).type
      }));
      
    } catch (error) {
      console.error('Search error:', error);
      return [];
    }
  }
  
  /**
   * Query with answer generation
   */
  async query(question: string): Promise<RAGResponse> {
    if (!this.initialized || !this.openai) {
      return {
        answer: 'RAG service not initialized. Please ensure OPENAI_API_KEY is set.',
        sources: []
      };
    }
    
    try {
      // Get relevant sources
      const sources = await this.search(question, this.config.rerankTopK);
      
      if (sources.length === 0) {
        return {
          answer: 'No relevant code found for your question. Try rephrasing or ensure the codebase has been indexed.',
          sources: []
        };
      }
      
      // Build context from sources
      const context = sources.map((source, i) => 
        `### Source ${i + 1}: ${source.name} (${source.type})\nFile: ${source.filePath}:${source.startLine}\n\`\`\`\n${source.snippet}\n\`\`\``
      ).join('\n\n');
      
      // Generate answer using OpenAI
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0.3,
        messages: [
          {
            role: 'system',
            content: 'You are a helpful code assistant. Answer questions based ONLY on the provided code context. Reference specific files and line numbers when relevant. Be concise but thorough.'
          },
          {
            role: 'user',
            content: `## Code Context\n${context}\n\n## Question\n${question}`
          }
        ]
      });
      
      const answer = response.choices[0]?.message?.content || 'Unable to generate answer';
      
      return {
        answer,
        sources,
        model: 'gpt-4o-mini',
        tokensUsed: response.usage?.total_tokens
      };
      
    } catch (error) {
      console.error('Query error:', error);
      return {
        answer: `Error generating answer: ${error}`,
        sources: []
      };
    }
  }
  
  /**
   * Check if the service is ready
   */
  isReady(): boolean {
    return this.initialized && this.openai !== null;
  }
  
  /**
   * Get collection stats
   */
  async getStats(): Promise<{ documentCount: number; isReady: boolean }> {
    return { 
      documentCount: this.vectorStore.length, 
      isReady: this.initialized 
    };
  }
}

// Singleton instance
let langchainRagServiceInstance: LangchainRagService | null = null;

export function getLangchainRagService(): LangchainRagService {
  if (!langchainRagServiceInstance) {
    langchainRagServiceInstance = new LangchainRagService();
  }
  return langchainRagServiceInstance;
}

/**
 * Check if LangChain RAG should be used based on config
 */
export function shouldUseLangchainRag(): boolean {
  const config = vscode.workspace.getConfiguration('mindframe');
  return config.get<boolean>('rag.useLangchain', false);
}
