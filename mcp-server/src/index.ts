#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import * as fs from 'fs';
import * as path from 'path';

// Types for the codebase data
interface CodeNode {
  id: string;
  label: string;
  type: string;
  filePath?: string;
  description?: string;
  parentId?: string;
  sourceCode?: string;
  startLine?: number;
  endLine?: number;
  metadata?: Record<string, any>;
}

interface CodeEdge {
  source: string;
  target: string;
  type?: string;
  label?: string;
}

interface GraphData {
  nodes: CodeNode[];
  edges: CodeEdge[];
  metadata?: {
    analyzedAt?: string;
    workspacePath?: string;
    totalFiles?: number;
  };
}

interface DocsData {
  version: string;
  projectName: string;
  generatedAt: string;
  architecture: {
    overview: string;
    layers: string[];
    patterns: string[];
  };
  nodes: Record<string, any>;
  generatedWithAI: boolean;
}

interface SearchResult {
  id: string;
  name: string;
  type: string;
  summary: string;
  filePath: string;
  score: number;
}

class CodebaseMCPServer {
  private server: Server;
  private workspacePath: string;
  private graphData: GraphData | null = null;
  private docsData: DocsData | null = null;
  private invertedIndex: Map<string, Set<string>> = new Map();

  constructor() {
    this.workspacePath = process.env.WORKSPACE_PATH || process.cwd();
    
    this.server = new Server(
      {
        name: 'codebase-visualizer-mcp',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
          resources: {},
        },
      }
    );

    this.setupHandlers();
    this.loadData();
  }

  private loadData() {
    const docSyncPath = path.join(this.workspacePath, '.doc_sync');
    
    // Load graph data
    const graphPath = path.join(docSyncPath, 'graph', 'graph.json');
    if (fs.existsSync(graphPath)) {
      try {
        const content = fs.readFileSync(graphPath, 'utf-8');
        this.graphData = JSON.parse(content);
        console.error(`Loaded graph with ${this.graphData?.nodes?.length || 0} nodes`);
        this.buildSearchIndex();
      } catch (error) {
        console.error('Error loading graph:', error);
      }
    }

    // Load docs data
    const docsPath = path.join(docSyncPath, 'docs.json');
    if (fs.existsSync(docsPath)) {
      try {
        const content = fs.readFileSync(docsPath, 'utf-8');
        this.docsData = JSON.parse(content);
        console.error(`Loaded docs for project: ${this.docsData?.projectName}`);
      } catch (error) {
        console.error('Error loading docs:', error);
      }
    }
  }

  private buildSearchIndex() {
    if (!this.graphData) return;
    
    this.invertedIndex.clear();
    
    this.graphData.nodes.forEach(node => {
      const text = `${node.label} ${node.type} ${node.description || ''} ${node.filePath || ''}`;
      const words = this.tokenize(text);
      
      words.forEach(word => {
        if (!this.invertedIndex.has(word)) {
          this.invertedIndex.set(word, new Set());
        }
        this.invertedIndex.get(word)!.add(node.id);
      });
    });
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2);
  }

  private search(query: string, topK: number = 10): SearchResult[] {
    if (!this.graphData) return [];
    
    const queryWords = this.tokenize(query);
    const scores = new Map<string, number>();
    
    queryWords.forEach(word => {
      const matchingIds = this.invertedIndex.get(word);
      if (matchingIds) {
        const idf = Math.log(this.graphData!.nodes.length / matchingIds.size + 1);
        matchingIds.forEach(id => {
          scores.set(id, (scores.get(id) || 0) + idf);
        });
      }
    });

    // Boost exact name matches
    this.graphData.nodes.forEach(node => {
      const nameLower = node.label.toLowerCase();
      const queryLower = query.toLowerCase();
      if (nameLower === queryLower) {
        scores.set(node.id, (scores.get(node.id) || 0) + 100);
      } else if (nameLower.includes(queryLower)) {
        scores.set(node.id, (scores.get(node.id) || 0) + 50);
      }
    });

    const sorted = Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, topK);

    return sorted.map(([id, score]) => {
      const node = this.graphData!.nodes.find(n => n.id === id)!;
      const docs = this.docsData?.nodes?.[id];
      return {
        id,
        name: node.label,
        type: node.type,
        summary: docs?.aiSummary || docs?.description || node.description || '',
        filePath: node.filePath || '',
        score: score / 100,
      };
    });
  }

  private setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'search_codebase',
          description: 'Search for classes, functions, components, or any code element in the codebase. Use natural language queries.',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Search query (e.g., "user authentication", "UserService", "database connection")',
              },
              limit: {
                type: 'number',
                description: 'Maximum number of results (default: 10)',
              },
            },
            required: ['query'],
          },
        },
        {
          name: 'get_node_info',
          description: 'Get detailed information about a specific code node (class, function, component) by its name or ID.',
          inputSchema: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
                description: 'Name or ID of the node to look up',
              },
            },
            required: ['name'],
          },
        },
        {
          name: 'get_dependencies',
          description: 'Get all dependencies (what a node imports/uses) for a specific class, function, or component.',
          inputSchema: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
                description: 'Name of the node to get dependencies for',
              },
            },
            required: ['name'],
          },
        },
        {
          name: 'get_dependents',
          description: 'Get all dependents (what uses this node) for a specific class, function, or component.',
          inputSchema: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
                description: 'Name of the node to get dependents for',
              },
            },
            required: ['name'],
          },
        },
        {
          name: 'get_architecture',
          description: 'Get the overall project architecture, including layers, patterns, and high-level overview.',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'list_classes',
          description: 'List all classes and interfaces in the codebase.',
          inputSchema: {
            type: 'object',
            properties: {
              filter: {
                type: 'string',
                description: 'Optional filter to match class names',
              },
            },
          },
        },
        {
          name: 'list_functions',
          description: 'List all functions and methods in the codebase.',
          inputSchema: {
            type: 'object',
            properties: {
              filter: {
                type: 'string',
                description: 'Optional filter to match function names',
              },
            },
          },
        },
        {
          name: 'list_components',
          description: 'List all React/UI components in the codebase.',
          inputSchema: {
            type: 'object',
            properties: {
              filter: {
                type: 'string',
                description: 'Optional filter to match component names',
              },
            },
          },
        },
        {
          name: 'ask_question',
          description: 'Ask a natural language question about the codebase. Returns a synthesized answer based on code analysis.',
          inputSchema: {
            type: 'object',
            properties: {
              question: {
                type: 'string',
                description: 'Your question about the codebase (e.g., "How does authentication work?", "What is the main entry point?")',
              },
            },
            required: ['question'],
          },
        },
        {
          name: 'get_file_structure',
          description: 'Get the file structure and organization of the codebase.',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
      ],
    }));

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'search_codebase':
            return this.handleSearch(args as { query: string; limit?: number });
          
          case 'get_node_info':
            return this.handleGetNodeInfo(args as { name: string });
          
          case 'get_dependencies':
            return this.handleGetDependencies(args as { name: string });
          
          case 'get_dependents':
            return this.handleGetDependents(args as { name: string });
          
          case 'get_architecture':
            return this.handleGetArchitecture();
          
          case 'list_classes':
            return this.handleListNodes('class', (args as { filter?: string })?.filter);
          
          case 'list_functions':
            return this.handleListNodes('function', (args as { filter?: string })?.filter);
          
          case 'list_components':
            return this.handleListNodes('component', (args as { filter?: string })?.filter);
          
          case 'ask_question':
            return this.handleAskQuestion(args as { question: string });
          
          case 'get_file_structure':
            return this.handleGetFileStructure();
          
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
        };
      }
    });

    // List resources
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => ({
      resources: [
        {
          uri: 'codebase://graph',
          name: 'Codebase Graph',
          description: 'The complete code graph with all nodes and relationships',
          mimeType: 'application/json',
        },
        {
          uri: 'codebase://docs',
          name: 'Project Documentation',
          description: 'AI-generated documentation for the project',
          mimeType: 'application/json',
        },
        {
          uri: 'codebase://architecture',
          name: 'Architecture Overview',
          description: 'High-level architecture and patterns',
          mimeType: 'text/markdown',
        },
      ],
    }));

    // Read resources
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;

      switch (uri) {
        case 'codebase://graph':
          return {
            contents: [
              {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify(this.graphData, null, 2),
              },
            ],
          };
        
        case 'codebase://docs':
          return {
            contents: [
              {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify(this.docsData, null, 2),
              },
            ],
          };
        
        case 'codebase://architecture':
          const arch = this.docsData?.architecture;
          const markdown = arch
            ? `# ${this.docsData?.projectName || 'Project'} Architecture\n\n## Overview\n${arch.overview}\n\n## Layers\n${arch.layers.map(l => `- ${l}`).join('\n')}\n\n## Patterns\n${arch.patterns.map(p => `- ${p}`).join('\n')}`
            : 'No architecture documentation available. Run "Generate AI Docs" in the extension first.';
          return {
            contents: [
              {
                uri,
                mimeType: 'text/markdown',
                text: markdown,
              },
            ],
          };
        
        default:
          throw new Error(`Unknown resource: ${uri}`);
      }
    });
  }

  private handleSearch(args: { query: string; limit?: number }) {
    const results = this.search(args.query, args.limit || 10);
    
    if (results.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: `No results found for "${args.query}". Try different keywords or check if the codebase has been analyzed.`,
          },
        ],
      };
    }

    const formatted = results.map((r, i) => 
      `${i + 1}. **${r.name}** (${r.type})\n   📁 ${r.filePath}\n   ${r.summary.substring(0, 150)}...`
    ).join('\n\n');

    return {
      content: [
        {
          type: 'text',
          text: `Found ${results.length} results for "${args.query}":\n\n${formatted}`,
        },
      ],
    };
  }

  private handleGetNodeInfo(args: { name: string }) {
    if (!this.graphData) {
      return { content: [{ type: 'text', text: 'Codebase not loaded. Make sure .doc_sync exists.' }] };
    }

    const node = this.graphData.nodes.find(n => 
      n.label.toLowerCase() === args.name.toLowerCase() || 
      n.id === args.name
    );

    if (!node) {
      // Try fuzzy search
      const results = this.search(args.name, 1);
      if (results.length > 0) {
        const foundNode = this.graphData.nodes.find(n => n.id === results[0].id);
        if (foundNode) {
          return this.formatNodeInfo(foundNode);
        }
      }
      return { content: [{ type: 'text', text: `Node "${args.name}" not found.` }] };
    }

    return this.formatNodeInfo(node);
  }

  private formatNodeInfo(node: CodeNode) {
    const docs = this.docsData?.nodes?.[node.id];
    
    let info = `# ${node.label}\n\n`;
    info += `**Type:** ${node.type}\n`;
    info += `**File:** ${node.filePath || 'N/A'}\n`;
    if (node.startLine) info += `**Lines:** ${node.startLine}-${node.endLine || node.startLine}\n`;
    info += '\n';
    
    if (docs?.aiSummary) {
      info += `## Summary\n${docs.aiSummary}\n\n`;
    } else if (node.description) {
      info += `## Description\n${node.description}\n\n`;
    }

    if (docs?.aiDescription) {
      info += `## Detailed Description\n${docs.aiDescription}\n\n`;
    }

    if (docs?.parameters && docs.parameters.length > 0) {
      info += `## Parameters\n${docs.parameters.map((p: any) => `- \`${p.name}\`: ${p.type || 'any'}`).join('\n')}\n\n`;
    }

    if (docs?.returnType) {
      info += `## Returns\n\`${docs.returnType}\`\n\n`;
    }

    if (node.sourceCode) {
      info += `## Source Code\n\`\`\`\n${node.sourceCode.substring(0, 500)}${node.sourceCode.length > 500 ? '...' : ''}\n\`\`\`\n`;
    }

    return { content: [{ type: 'text', text: info }] };
  }

  private handleGetDependencies(args: { name: string }) {
    if (!this.graphData) {
      return { content: [{ type: 'text', text: 'Codebase not loaded.' }] };
    }

    const node = this.graphData.nodes.find(n => 
      n.label.toLowerCase() === args.name.toLowerCase() || n.id === args.name
    );

    if (!node) {
      return { content: [{ type: 'text', text: `Node "${args.name}" not found.` }] };
    }

    const deps = this.graphData.edges
      .filter(e => e.source === node.id)
      .map(e => {
        const target = this.graphData!.nodes.find(n => n.id === e.target);
        return target ? `- **${target.label}** (${target.type}) - ${e.type || 'uses'}` : null;
      })
      .filter(Boolean);

    if (deps.length === 0) {
      return { content: [{ type: 'text', text: `${node.label} has no dependencies.` }] };
    }

    return {
      content: [
        {
          type: 'text',
          text: `# Dependencies of ${node.label}\n\n${deps.join('\n')}`,
        },
      ],
    };
  }

  private handleGetDependents(args: { name: string }) {
    if (!this.graphData) {
      return { content: [{ type: 'text', text: 'Codebase not loaded.' }] };
    }

    const node = this.graphData.nodes.find(n => 
      n.label.toLowerCase() === args.name.toLowerCase() || n.id === args.name
    );

    if (!node) {
      return { content: [{ type: 'text', text: `Node "${args.name}" not found.` }] };
    }

    const dependents = this.graphData.edges
      .filter(e => e.target === node.id)
      .map(e => {
        const source = this.graphData!.nodes.find(n => n.id === e.source);
        return source ? `- **${source.label}** (${source.type}) - ${e.type || 'uses'}` : null;
      })
      .filter(Boolean);

    if (dependents.length === 0) {
      return { content: [{ type: 'text', text: `Nothing depends on ${node.label}.` }] };
    }

    return {
      content: [
        {
          type: 'text',
          text: `# Dependents of ${node.label}\n\nThese nodes use/import ${node.label}:\n\n${dependents.join('\n')}`,
        },
      ],
    };
  }

  private handleGetArchitecture() {
    if (!this.docsData?.architecture) {
      // Generate basic architecture from graph
      if (this.graphData) {
        const types: Record<string, number> = {};
        this.graphData.nodes.forEach(n => {
          types[n.type] = (types[n.type] || 0) + 1;
        });

        const layers = Object.entries(types)
          .sort((a, b) => b[1] - a[1])
          .map(([type, count]) => `${type}: ${count} nodes`);

        return {
          content: [
            {
              type: 'text',
              text: `# Project Architecture\n\n## Node Types\n${layers.map(l => `- ${l}`).join('\n')}\n\n## Stats\n- Total Nodes: ${this.graphData.nodes.length}\n- Total Edges: ${this.graphData.edges.length}\n\n*Run "Generate AI Docs" in the extension for detailed architecture analysis.*`,
            },
          ],
        };
      }
      return { content: [{ type: 'text', text: 'No architecture data available. Run "Generate AI Docs" first.' }] };
    }

    const arch = this.docsData.architecture;
    return {
      content: [
        {
          type: 'text',
          text: `# ${this.docsData.projectName} Architecture\n\n## Overview\n${arch.overview}\n\n## Layers\n${arch.layers.map(l => `- ${l}`).join('\n')}\n\n## Patterns\n${arch.patterns.map(p => `- ${p}`).join('\n')}`,
        },
      ],
    };
  }

  private handleListNodes(type: string, filter?: string) {
    if (!this.graphData) {
      return { content: [{ type: 'text', text: 'Codebase not loaded.' }] };
    }

    let nodes = this.graphData.nodes.filter(n => {
      if (type === 'class') return n.type === 'class' || n.type === 'interface';
      if (type === 'function') return n.type === 'function' || n.type === 'method';
      if (type === 'component') return n.type === 'component';
      return n.type === type;
    });

    if (filter) {
      const filterLower = filter.toLowerCase();
      nodes = nodes.filter(n => n.label.toLowerCase().includes(filterLower));
    }

    if (nodes.length === 0) {
      return { content: [{ type: 'text', text: `No ${type}s found${filter ? ` matching "${filter}"` : ''}.` }] };
    }

    const list = nodes
      .slice(0, 50)
      .map(n => `- **${n.label}** (${n.filePath || 'N/A'})`)
      .join('\n');

    return {
      content: [
        {
          type: 'text',
          text: `# ${type.charAt(0).toUpperCase() + type.slice(1)}s${filter ? ` matching "${filter}"` : ''}\n\nFound ${nodes.length} ${type}s:\n\n${list}${nodes.length > 50 ? `\n\n... and ${nodes.length - 50} more` : ''}`,
        },
      ],
    };
  }

  private handleAskQuestion(args: { question: string }) {
    const results = this.search(args.question, 5);
    
    if (results.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: `I couldn't find relevant information for your question. Try rephrasing or being more specific.`,
          },
        ],
      };
    }

    const questionLower = args.question.toLowerCase();
    const isHow = questionLower.startsWith('how');
    const isWhat = questionLower.startsWith('what');
    const isWhere = questionLower.startsWith('where');

    let answer = '';
    const topResult = results[0];
    const node = this.graphData?.nodes.find(n => n.id === topResult.id);
    const docs = this.docsData?.nodes?.[topResult.id];

    if (isWhere) {
      answer = `**${topResult.name}** is located in:\n\n📁 \`${topResult.filePath}\`\n\n`;
      if (results.length > 1) {
        answer += `Related locations:\n${results.slice(1).map(r => `- ${r.name}: \`${r.filePath}\``).join('\n')}`;
      }
    } else if (isWhat) {
      answer = `**${topResult.name}** (${topResult.type})\n\n`;
      answer += docs?.aiSummary || docs?.aiDescription || topResult.summary || 'No detailed description available.';
      answer += `\n\n📁 \`${topResult.filePath}\``;
    } else if (isHow) {
      answer = `Based on the codebase analysis:\n\n`;
      answer += `**${topResult.name}** appears to be relevant.\n\n`;
      answer += docs?.aiDescription || topResult.summary || node?.description || '';
      
      // Add dependencies for context
      if (this.graphData) {
        const deps = this.graphData.edges
          .filter(e => e.source === topResult.id)
          .slice(0, 5)
          .map(e => this.graphData!.nodes.find(n => n.id === e.target)?.label)
          .filter(Boolean);
        if (deps.length > 0) {
          answer += `\n\nIt uses: ${deps.join(', ')}`;
        }
      }
    } else {
      // General question
      answer = `Here's what I found:\n\n`;
      results.slice(0, 3).forEach((r, i) => {
        const nodeDocs = this.docsData?.nodes?.[r.id];
        answer += `**${i + 1}. ${r.name}** (${r.type})\n`;
        answer += `${nodeDocs?.aiSummary || r.summary || 'No description'}\n`;
        answer += `📁 \`${r.filePath}\`\n\n`;
      });
    }

    return { content: [{ type: 'text', text: answer }] };
  }

  private handleGetFileStructure() {
    if (!this.graphData) {
      return { content: [{ type: 'text', text: 'Codebase not loaded.' }] };
    }

    const files = new Map<string, string[]>();
    
    this.graphData.nodes.forEach(node => {
      if (node.filePath) {
        const dir = path.dirname(node.filePath);
        if (!files.has(dir)) {
          files.set(dir, []);
        }
        files.get(dir)!.push(`${node.label} (${node.type})`);
      }
    });

    const structure = Array.from(files.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([dir, nodes]) => `📁 **${dir}**\n${nodes.map(n => `   - ${n}`).join('\n')}`)
      .join('\n\n');

    return {
      content: [
        {
          type: 'text',
          text: `# File Structure\n\n${structure}`,
        },
      ],
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Codebase Visualizer MCP Server running on stdio');
  }
}

const server = new CodebaseMCPServer();
server.run().catch(console.error);
