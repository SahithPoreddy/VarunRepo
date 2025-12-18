/**
 * Code Chunker - Converts parsed code nodes into chunks for embedding
 * Chunks are based on function/class boundaries with docstrings included
 */

import { CodeNode, CodeGraph } from '../types/types';
import { CodeChunk, CodeChunkMetadata } from './types';

/**
 * Converts code graph nodes into chunks suitable for vectorization
 */
export class CodeChunker {
  
  /**
   * Convert a CodeGraph into code chunks for embedding
   */
  chunkGraph(graph: CodeGraph): CodeChunk[] {
    const chunks: CodeChunk[] = [];
    
    for (const node of graph.nodes) {
      // Skip nodes without meaningful content
      if (!node.sourceCode || node.sourceCode.trim().length < 10) {
        continue;
      }
      
      // Only chunk functions, methods, classes, and components
      if (!this.isChunkableNode(node)) {
        continue;
      }
      
      const chunk = this.nodeToChunk(node, graph);
      if (chunk) {
        chunks.push(chunk);
      }
    }
    
    return chunks;
  }
  
  /**
   * Check if a node should be chunked
   */
  private isChunkableNode(node: CodeNode): boolean {
    const chunkableTypes = ['function', 'method', 'class', 'component', 'interface'];
    return chunkableTypes.includes(node.type);
  }
  
  /**
   * Convert a CodeNode to a CodeChunk
   */
  private nodeToChunk(node: CodeNode, graph: CodeGraph): CodeChunk | null {
    // Build content: docstring + source code
    let content = '';
    
    // Extract docstring from documentation if available
    const docstring = node.documentation?.summary || '';
    if (docstring) {
      content += `/**\n * ${docstring}\n */\n`;
    }
    
    // For classes, include method signatures for context
    if (node.type === 'class') {
      content += this.buildClassContent(node, graph);
    } else {
      content += node.sourceCode;
    }
    
    // Build chunk ID
    const parentNode = node.parentId 
      ? graph.nodes.find(n => n.id === node.parentId) || null
      : null;
    
    const id = this.buildChunkId(node, parentNode);
    
    // Build signature
    const signature = this.extractSignature(node);
    
    return {
      id,
      content: content.trim(),
      metadata: {
        filePath: node.filePath,
        startLine: node.startLine,
        endLine: node.endLine,
        type: node.type as CodeChunkMetadata['type'],
        name: node.label,
        language: node.language,
        parentName: parentNode?.label,
        docstring: docstring || undefined,
        signature
      }
    };
  }
  
  /**
   * Build content for a class: include docstring + method signatures
   */
  private buildClassContent(node: CodeNode, graph: CodeGraph): string {
    let content = node.sourceCode;
    
    // Find all methods of this class
    const methods = graph.nodes.filter(n => 
      n.parentId === node.id && 
      (n.type === 'method' || n.type === 'function')
    );
    
    if (methods.length > 0) {
      content += '\n\n// Methods:\n';
      for (const method of methods) {
        const sig = this.extractSignature(method);
        const doc = method.documentation?.summary || '';
        if (doc) {
          content += `// ${doc}\n`;
        }
        content += `${sig}\n`;
      }
    }
    
    return content;
  }
  
  /**
   * Build a unique chunk ID
   */
  private buildChunkId(node: CodeNode, parent: CodeNode | null): string {
    const parts = [node.filePath.replace(/\\/g, '/')];
    if (parent) {
      parts.push(parent.label);
    }
    parts.push(node.label);
    return parts.join('::');
  }
  
  /**
   * Extract function/method signature
   */
  private extractSignature(node: CodeNode): string {
    if (!node.sourceCode) return node.label;
    
    // Try to extract just the signature line(s)
    const lines = node.sourceCode.split('\n');
    
    // For Python
    if (node.language === 'python') {
      const defLine = lines.find(l => l.trim().startsWith('def ') || l.trim().startsWith('async def '));
      if (defLine) {
        const colonIdx = defLine.indexOf(':');
        return colonIdx > 0 ? defLine.substring(0, colonIdx + 1).trim() : defLine.trim();
      }
    }
    
    // For TypeScript/JavaScript
    if (node.language === 'typescript' || node.language === 'javascript') {
      for (const line of lines.slice(0, 5)) {
        if (line.includes('function ') || line.includes('=>') || line.match(/^\s*(async\s+)?[a-zA-Z_]\w*\s*\(/)) {
          const braceIdx = line.indexOf('{');
          return braceIdx > 0 ? line.substring(0, braceIdx).trim() : line.trim();
        }
      }
    }
    
    // For Java
    if (node.language === 'java') {
      for (const line of lines.slice(0, 5)) {
        if (line.match(/^\s*(public|private|protected)?\s*(static)?\s*\w+\s+\w+\s*\(/)) {
          const braceIdx = line.indexOf('{');
          return braceIdx > 0 ? line.substring(0, braceIdx).trim() : line.trim();
        }
      }
    }
    
    // Fallback: first non-empty line
    return lines[0]?.trim() || node.label;
  }
}

// Singleton instance
let chunkerInstance: CodeChunker | null = null;

export function getCodeChunker(): CodeChunker {
  if (!chunkerInstance) {
    chunkerInstance = new CodeChunker();
  }
  return chunkerInstance;
}
