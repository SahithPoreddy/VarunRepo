/**
 * Reranker - Improves search quality using Cohere reranking
 * Falls back gracefully when Cohere API key is not available
 */

import { CodeChunkMetadata, RAGSource } from './types';

// Simple document interface (no LangChain dependency)
interface SimpleDocument {
  pageContent: string;
  metadata: CodeChunkMetadata;
}

/**
 * Reranker service for improving retrieval quality
 */
export class Reranker {
  private cohereApiKey: string | null;
  private isAvailable: boolean = false;
  
  constructor(cohereApiKey?: string) {
    this.cohereApiKey = cohereApiKey || null;
    this.isAvailable = !!this.cohereApiKey;
    
    if (!this.isAvailable) {
      console.log('Reranker: Cohere API key not provided, using score-based fallback');
    }
  }
  
  /**
   * Rerank documents for a query
   * @param query The search query
   * @param documents Documents with similarity scores
   * @param topK Number of results to return
   */
  async rerank(
    query: string,
    documents: Array<{ document: SimpleDocument; score: number }>,
    topK: number = 5
  ): Promise<Array<{ document: SimpleDocument; score: number }>> {
    
    if (documents.length === 0) {
      return [];
    }
    
    if (documents.length <= topK) {
      return documents;
    }
    
    // Try Cohere reranking if available
    if (this.isAvailable && this.cohereApiKey) {
      try {
        return await this.cohereRerank(query, documents, topK);
      } catch (error) {
        console.error('Cohere reranking failed, using fallback:', error);
        this.isAvailable = false;
      }
    }
    
    // Fallback: Use enhanced scoring
    return this.fallbackRerank(query, documents, topK);
  }
  
  /**
   * Rerank using Cohere API
   */
  private async cohereRerank(
    query: string,
    documents: Array<{ document: SimpleDocument; score: number }>,
    topK: number
  ): Promise<Array<{ document: SimpleDocument; score: number }>> {
    
    // Dynamic import to avoid issues if cohere is not installed
    const { CohereClient } = await import('cohere-ai');
    
    const cohere = new CohereClient({
      token: this.cohereApiKey!
    });
    
    // Prepare documents for Cohere
    const texts = documents.map(d => d.document.pageContent);
    
    const response = await cohere.rerank({
      model: 'rerank-english-v3.0',
      query: query,
      documents: texts,
      topN: topK,
      returnDocuments: false
    });
    
    // Map results back to our documents
    const reranked: Array<{ document: SimpleDocument; score: number }> = [];
    
    for (const result of response.results) {
      const originalDoc = documents[result.index];
      reranked.push({
        document: originalDoc.document,
        score: result.relevanceScore
      });
    }
    
    return reranked;
  }
  
  /**
   * Fallback reranking using enhanced scoring
   * Combines vector similarity with keyword matching and code-specific signals
   */
  private fallbackRerank(
    query: string,
    documents: Array<{ document: SimpleDocument; score: number }>,
    topK: number
  ): Array<{ document: SimpleDocument; score: number }> {
    
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);
    
    const scored = documents.map(({ document, score }) => {
      let enhancedScore = score;
      const content = document.pageContent.toLowerCase();
      const metadata = document.metadata;
      const name = metadata.name?.toLowerCase() || '';
      
      // Boost for name matches
      if (queryWords.some(word => name.includes(word))) {
        enhancedScore += 0.3;
      }
      
      // Boost for exact name match
      if (queryWords.includes(name)) {
        enhancedScore += 0.5;
      }
      
      // Boost for keyword density
      const keywordMatches = queryWords.filter(word => content.includes(word)).length;
      enhancedScore += (keywordMatches / Math.max(queryWords.length, 1)) * 0.2;
      
      // Boost for type relevance
      if (query.toLowerCase().includes('class') && metadata.type === 'class') {
        enhancedScore += 0.2;
      }
      if (query.toLowerCase().includes('function') && (metadata.type === 'function' || metadata.type === 'method')) {
        enhancedScore += 0.2;
      }
      
      // Slight penalty for very long content (likely less focused)
      if (content.length > 2000) {
        enhancedScore -= 0.1;
      }
      
      return { document, score: enhancedScore };
    });
    
    // Sort by enhanced score
    scored.sort((a, b) => b.score - a.score);
    
    return scored.slice(0, topK);
  }
  
  /**
   * Convert reranked documents to RAGSource format
   */
  toSources(
    results: Array<{ document: SimpleDocument; score: number }>
  ): RAGSource[] {
    return results.map(({ document, score }) => ({
      filePath: document.metadata.filePath,
      startLine: document.metadata.startLine,
      endLine: document.metadata.endLine,
      snippet: document.pageContent.substring(0, 150) + (document.pageContent.length > 150 ? '...' : ''),
      relevanceScore: Math.min(score, 1), // Normalize to 0-1
      name: document.metadata.name,
      type: document.metadata.type
    }));
  }
  
  /**
   * Check if Cohere reranking is available
   */
  isRerankerAvailable(): boolean {
    return this.isAvailable;
  }
}

// Factory function
export function createReranker(cohereApiKey?: string): Reranker {
  return new Reranker(cohereApiKey);
}
