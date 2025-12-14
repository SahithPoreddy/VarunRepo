#!/usr/bin/env node

/**
 * Codebase Visualizer MCP Server
 * 
 * Exposes codebase documentation tools to AI agents via Model Context Protocol.
 * Allows agents to search and query documentation across multiple projects.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';

import { ConfigLoader, DataLoader } from './config.js';
import { NodeData } from './types.js';

// Initialize config and data loaders
const configLoader = new ConfigLoader();
const dataLoader = new DataLoader(configLoader);

// Create MCP server
const server = new Server(
  {
    name: 'codebase-visualizer-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

/**
 * Format node for output
 */
function formatNode(node: NodeData, includeCode = false): Record<string, unknown> {
  const result: Record<string, unknown> = {
    id: node.id,
    label: node.label,
    type: node.type,
    filePath: node.filePath,
    description: node.description,
  };

  if (node.metadata) {
    if (node.metadata.startLine) result.startLine = node.metadata.startLine;
    if (node.metadata.endLine) result.endLine = node.metadata.endLine;
    if (node.metadata.parameters) result.parameters = node.metadata.parameters;
    if (node.metadata.returnType) result.returnType = node.metadata.returnType;
    if (node.metadata.docstring) result.docstring = node.metadata.docstring;
    if (node.metadata.aiSummary) result.aiSummary = node.metadata.aiSummary;
    if (node.metadata.aiDescription) result.aiDescription = node.metadata.aiDescription;
    if (node.metadata.patterns) result.patterns = node.metadata.patterns;
    if (node.metadata.keywords) result.keywords = node.metadata.keywords;
    if (includeCode && node.metadata.sourceCode) {
      result.sourceCode = node.metadata.sourceCode;
    }
  }

  return result;
}

/**
 * List available tools
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'list_projects',
        description: 'List all configured codebase projects available for querying',
        inputSchema: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
      {
        name: 'search_codebase',
        description: 'Search across a project\'s codebase documentation. Returns relevant functions, classes, and files matching the query.',
        inputSchema: {
          type: 'object',
          properties: {
            project: {
              type: 'string',
              description: 'Project ID to search in (use list_projects to see available projects)',
            },
            query: {
              type: 'string',
              description: 'Search query - can be function names, concepts, or natural language',
            },
          },
          required: ['project', 'query'],
        },
      },
      {
        name: 'get_node',
        description: 'Get detailed documentation for a specific function, class, or file by its node ID',
        inputSchema: {
          type: 'object',
          properties: {
            project: {
              type: 'string',
              description: 'Project ID',
            },
            nodeId: {
              type: 'string',
              description: 'Node ID (e.g., "src/auth/login.ts::authenticateUser")',
            },
            includeCode: {
              type: 'boolean',
              description: 'Include source code in response (default: false)',
            },
          },
          required: ['project', 'nodeId'],
        },
      },
      {
        name: 'get_graph',
        description: 'Get the full codebase graph with all nodes and their relationships',
        inputSchema: {
          type: 'object',
          properties: {
            project: {
              type: 'string',
              description: 'Project ID',
            },
            nodeTypes: {
              type: 'array',
              items: { type: 'string' },
              description: 'Filter by node types (e.g., ["function", "class"]). Leave empty for all.',
            },
          },
          required: ['project'],
        },
      },
      {
        name: 'get_dependencies',
        description: 'Get what a node depends on (what it imports, calls, or uses)',
        inputSchema: {
          type: 'object',
          properties: {
            project: {
              type: 'string',
              description: 'Project ID',
            },
            nodeId: {
              type: 'string',
              description: 'Node ID to get dependencies for',
            },
          },
          required: ['project', 'nodeId'],
        },
      },
      {
        name: 'get_dependents',
        description: 'Get what depends on a node (what imports, calls, or uses it)',
        inputSchema: {
          type: 'object',
          properties: {
            project: {
              type: 'string',
              description: 'Project ID',
            },
            nodeId: {
              type: 'string',
              description: 'Node ID to get dependents for',
            },
          },
          required: ['project', 'nodeId'],
        },
      },
      {
        name: 'get_architecture',
        description: 'Get high-level architecture overview of a project including entry points, patterns, and statistics',
        inputSchema: {
          type: 'object',
          properties: {
            project: {
              type: 'string',
              description: 'Project ID',
            },
          },
          required: ['project'],
        },
      },
      {
        name: 'find_entry_points',
        description: 'Find entry points of a project (files/functions that are not called by anything else)',
        inputSchema: {
          type: 'object',
          properties: {
            project: {
              type: 'string',
              description: 'Project ID',
            },
          },
          required: ['project'],
        },
      },
      {
        name: 'add_project',
        description: 'Add a new project to the MCP server configuration',
        inputSchema: {
          type: 'object',
          properties: {
            projectId: {
              type: 'string',
              description: 'Unique identifier for the project (e.g., "frontend", "backend-api")',
            },
            path: {
              type: 'string',
              description: 'Absolute path to the project root directory',
            },
            name: {
              type: 'string',
              description: 'Display name for the project',
            },
            description: {
              type: 'string',
              description: 'Brief description of the project',
            },
          },
          required: ['projectId', 'path'],
        },
      },
      {
        name: 'remove_project',
        description: 'Remove a project from the MCP server configuration',
        inputSchema: {
          type: 'object',
          properties: {
            projectId: {
              type: 'string',
              description: 'Project ID to remove',
            },
          },
          required: ['projectId'],
        },
      },
    ],
  };
});

/**
 * Handle tool calls
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'list_projects': {
        const projects = configLoader.getProjects();
        const projectList = projects.map(p => ({
          id: p.id,
          name: p.config.name || p.id,
          path: p.config.path,
          description: p.config.description,
          tags: p.config.tags,
          hasData: configLoader.projectHasData(p.id),
        }));

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(projectList, null, 2),
            },
          ],
        };
      }

      case 'search_codebase': {
        const { project, query } = args as { project: string; query: string };
        
        if (!configLoader.getProject(project)) {
          throw new McpError(ErrorCode.InvalidParams, `Project "${project}" not found`);
        }

        const results = dataLoader.searchCodebase(project, query);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                project,
                query,
                resultCount: results.length,
                results,
              }, null, 2),
            },
          ],
        };
      }

      case 'get_node': {
        const { project, nodeId, includeCode = false } = args as { 
          project: string; 
          nodeId: string; 
          includeCode?: boolean 
        };

        if (!configLoader.getProject(project)) {
          throw new McpError(ErrorCode.InvalidParams, `Project "${project}" not found`);
        }

        const node = dataLoader.loadNode(project, nodeId);
        if (!node) {
          throw new McpError(ErrorCode.InvalidParams, `Node "${nodeId}" not found in project "${project}"`);
        }

        // Also get dependencies and dependents
        const dependencies = dataLoader.getDependencies(project, nodeId);
        const dependents = dataLoader.getDependents(project, nodeId);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                ...formatNode(node, includeCode),
                dependencies: dependencies.map(n => ({ id: n.id, label: n.label, type: n.type })),
                dependents: dependents.map(n => ({ id: n.id, label: n.label, type: n.type })),
              }, null, 2),
            },
          ],
        };
      }

      case 'get_graph': {
        const { project, nodeTypes } = args as { project: string; nodeTypes?: string[] };

        if (!configLoader.getProject(project)) {
          throw new McpError(ErrorCode.InvalidParams, `Project "${project}" not found`);
        }

        const graph = dataLoader.loadGraph(project);
        if (!graph) {
          throw new McpError(ErrorCode.InvalidParams, `No graph data found for project "${project}". Run "Sync Docs" in VS Code first.`);
        }

        let nodes = graph.nodes;
        if (nodeTypes && nodeTypes.length > 0) {
          nodes = nodes.filter(n => nodeTypes.includes(n.type));
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                project,
                nodeCount: nodes.length,
                edgeCount: graph.edges.length,
                nodes: nodes.map(n => formatNode(n)),
                edges: graph.edges,
              }, null, 2),
            },
          ],
        };
      }

      case 'get_dependencies': {
        const { project, nodeId } = args as { project: string; nodeId: string };

        if (!configLoader.getProject(project)) {
          throw new McpError(ErrorCode.InvalidParams, `Project "${project}" not found`);
        }

        const dependencies = dataLoader.getDependencies(project, nodeId);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                nodeId,
                dependencyCount: dependencies.length,
                dependencies: dependencies.map(n => formatNode(n)),
              }, null, 2),
            },
          ],
        };
      }

      case 'get_dependents': {
        const { project, nodeId } = args as { project: string; nodeId: string };

        if (!configLoader.getProject(project)) {
          throw new McpError(ErrorCode.InvalidParams, `Project "${project}" not found`);
        }

        const dependents = dataLoader.getDependents(project, nodeId);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                nodeId,
                dependentCount: dependents.length,
                dependents: dependents.map(n => formatNode(n)),
              }, null, 2),
            },
          ],
        };
      }

      case 'get_architecture': {
        const { project } = args as { project: string };

        if (!configLoader.getProject(project)) {
          throw new McpError(ErrorCode.InvalidParams, `Project "${project}" not found`);
        }

        const metadata = dataLoader.loadMetadata(project);
        const graph = dataLoader.loadGraph(project);
        const entryPoints = dataLoader.getEntryPoints(project);

        // Count nodes by type
        const nodesByType: Record<string, number> = {};
        if (graph) {
          for (const node of graph.nodes) {
            nodesByType[node.type] = (nodesByType[node.type] || 0) + 1;
          }
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                project,
                projectName: metadata?.projectName || project,
                generatedAt: metadata?.generatedAt,
                statistics: {
                  totalNodes: metadata?.totalNodes || graph?.nodes.length || 0,
                  totalEdges: metadata?.totalEdges || graph?.edges.length || 0,
                  nodesByType,
                },
                entryPoints: entryPoints.slice(0, 10).map(n => ({
                  id: n.id,
                  label: n.label,
                  type: n.type,
                  filePath: n.filePath,
                })),
                patterns: metadata?.patterns || [],
                technologies: metadata?.technologies || [],
              }, null, 2),
            },
          ],
        };
      }

      case 'find_entry_points': {
        const { project } = args as { project: string };

        if (!configLoader.getProject(project)) {
          throw new McpError(ErrorCode.InvalidParams, `Project "${project}" not found`);
        }

        const entryPoints = dataLoader.getEntryPoints(project);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                project,
                entryPointCount: entryPoints.length,
                entryPoints: entryPoints.map(n => formatNode(n)),
              }, null, 2),
            },
          ],
        };
      }

      case 'add_project': {
        const { projectId, path, name, description } = args as {
          projectId: string;
          path: string;
          name?: string;
          description?: string;
        };

        configLoader.addProject(projectId, {
          path,
          name,
          description,
        });

        return {
          content: [
            {
              type: 'text',
              text: `Successfully added project "${projectId}" at path: ${path}`,
            },
          ],
        };
      }

      case 'remove_project': {
        const { projectId } = args as { projectId: string };

        const removed = configLoader.removeProject(projectId);
        if (!removed) {
          throw new McpError(ErrorCode.InvalidParams, `Project "${projectId}" not found`);
        }

        return {
          content: [
            {
              type: 'text',
              text: `Successfully removed project "${projectId}"`,
            },
          ],
        };
      }

      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
  } catch (error) {
    if (error instanceof McpError) throw error;
    throw new McpError(
      ErrorCode.InternalError,
      `Error executing tool ${name}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
});

/**
 * List available resources
 */
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  const projects = configLoader.getProjects();
  const resources = [];

  for (const project of projects) {
    if (configLoader.projectHasData(project.id)) {
      resources.push(
        {
          uri: `codebase://${project.id}/graph`,
          name: `${project.config.name || project.id} - Graph`,
          description: `Full codebase graph for ${project.config.name || project.id}`,
          mimeType: 'application/json',
        },
        {
          uri: `codebase://${project.id}/metadata`,
          name: `${project.config.name || project.id} - Metadata`,
          description: `Project metadata and statistics for ${project.config.name || project.id}`,
          mimeType: 'application/json',
        }
      );
    }
  }

  return { resources };
});

/**
 * Read a resource
 */
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  // Parse URI: codebase://{project}/{resource}
  const match = uri.match(/^codebase:\/\/([^/]+)\/(.+)$/);
  if (!match) {
    throw new McpError(ErrorCode.InvalidParams, `Invalid resource URI: ${uri}`);
  }

  const [, projectId, resource] = match;

  if (!configLoader.getProject(projectId)) {
    throw new McpError(ErrorCode.InvalidParams, `Project "${projectId}" not found`);
  }

  switch (resource) {
    case 'graph': {
      const graph = dataLoader.loadGraph(projectId);
      if (!graph) {
        throw new McpError(ErrorCode.InvalidParams, `No graph data for project "${projectId}"`);
      }
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(graph, null, 2),
          },
        ],
      };
    }

    case 'metadata': {
      const metadata = dataLoader.loadMetadata(projectId);
      if (!metadata) {
        throw new McpError(ErrorCode.InvalidParams, `No metadata for project "${projectId}"`);
      }
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(metadata, null, 2),
          },
        ],
      };
    }

    default: {
      // Check if it's a node resource: codebase://{project}/node/{nodeId}
      if (resource.startsWith('node/')) {
        const nodeId = resource.substring(5);
        const node = dataLoader.loadNode(projectId, nodeId);
        if (!node) {
          throw new McpError(ErrorCode.InvalidParams, `Node "${nodeId}" not found`);
        }
        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(formatNode(node, true), null, 2),
            },
          ],
        };
      }

      throw new McpError(ErrorCode.InvalidParams, `Unknown resource: ${resource}`);
    }
  }
});

/**
 * Start the server
 */
async function main() {
  // Load configuration
  await configLoader.loadConfig();

  // Start server with stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('[MCP] Codebase Visualizer MCP Server started');
}

main().catch((error) => {
  console.error('[MCP] Fatal error:', error);
  process.exit(1);
});
