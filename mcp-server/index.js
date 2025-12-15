#!/usr/bin/env node

/**
 * Doc-Sync MCP Server
 * 
 * Exposes .doc_sync documentation to AI agents via MCP protocol.
 * 
 * Usage:
 *   node index.js /path/to/project
 * 
 * Cline Config Example:
 *   {
 *     "mcpServers": {
 *       "backend-docs": {
 *         "command": "node",
 *         "args": ["/path/to/mcp-server/index.js", "/path/to/backend/project"]
 *       }
 *     }
 *   }
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
    ListResourcesRequestSchema,
    ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import fs from "fs";
import path from "path";

// Get project path from command line args
const projectPath = process.argv[2];

if (!projectPath) {
    console.error("Usage: node index.js <project-path>");
    console.error("Example: node index.js /path/to/backend/project");
    process.exit(1);
}

const docSyncPath = path.join(projectPath, ".doc_sync");

if (!fs.existsSync(docSyncPath)) {
    console.error(`Error: .doc_sync folder not found at ${docSyncPath}`);
    console.error("Please run 'Sync Docs' in the project first.");
    process.exit(1);
}

// Helper functions to read .doc_sync data
function readJsonFile(filePath) {
    try {
        if (fs.existsSync(filePath)) {
            return JSON.parse(fs.readFileSync(filePath, "utf-8"));
        }
    } catch (error) {
        console.error(`Error reading ${filePath}:`, error.message);
    }
    return null;
}

function getGraph() {
    return readJsonFile(path.join(docSyncPath, "graph", "graph.json"));
}

function getDocs() {
    return readJsonFile(path.join(docSyncPath, "docs.json"));
}

function getMetadata() {
    return readJsonFile(path.join(docSyncPath, "metadata.json"));
}

function getNodeIndex() {
    return readJsonFile(path.join(docSyncPath, "nodes", "_index.json"));
}

function getNode(nodeId) {
    // Sanitize nodeId for filesystem
    const sanitizedId = nodeId.replace(/[^a-zA-Z0-9_-]/g, "_");
    return readJsonFile(path.join(docSyncPath, "nodes", `${sanitizedId}.json`));
}

function searchDocs(query) {
    const docs = getDocs();
    if (!docs || !docs.components) return [];

    const queryLower = query.toLowerCase();
    const results = [];

    for (const [id, component] of Object.entries(docs.components)) {
        const score = calculateRelevance(component, queryLower);
        if (score > 0) {
            results.push({
                id,
                name: component.name,
                type: component.type,
                filePath: component.filePath,
                summary: component.aiSummary || component.description || "",
                score,
            });
        }
    }

    // Sort by relevance
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, 10); // Top 10 results
}

function calculateRelevance(component, query) {
    let score = 0;
    const fields = [
        { value: component.name, weight: 10 },
        { value: component.aiSummary, weight: 5 },
        { value: component.description, weight: 5 },
        { value: component.type, weight: 3 },
        { value: component.filePath, weight: 2 },
        { value: JSON.stringify(component.keywords), weight: 3 },
    ];

    for (const field of fields) {
        if (field.value && String(field.value).toLowerCase().includes(query)) {
            score += field.weight;
        }
    }

    return score;
}

function listNodes(type = null) {
    const graph = getGraph();
    if (!graph || !graph.nodes) return [];

    let nodes = graph.nodes;
    if (type) {
        nodes = nodes.filter((n) => n.type === type);
    }

    return nodes.map((n) => ({
        id: n.id,
        name: n.label,
        type: n.type,
        filePath: n.filePath,
    }));
}

function getProjectSummary() {
    const metadata = getMetadata();
    const docs = getDocs();
    const graph = getGraph();

    const nodeTypes = {};
    if (graph && graph.nodes) {
        for (const node of graph.nodes) {
            nodeTypes[node.type] = (nodeTypes[node.type] || 0) + 1;
        }
    }

    return {
        projectName: metadata?.projectName || path.basename(projectPath),
        generatedAt: metadata?.generatedAt || docs?.generatedAt,
        totalNodes: graph?.nodes?.length || 0,
        totalEdges: graph?.edges?.length || 0,
        nodeTypes,
        entryPoints: metadata?.entryPoints || [],
        frameworks: metadata?.frameworks || [],
    };
}

// Create MCP Server
const server = new Server(
    {
        name: "doc-sync-mcp-server",
        version: "1.0.0",
    },
    {
        capabilities: {
            tools: {},
            resources: {},
        },
    }
);

// Define Tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: "search_docs",
                description:
                    "Search the project documentation for relevant code components. Use this to find functions, classes, or modules related to a topic.",
                inputSchema: {
                    type: "object",
                    properties: {
                        query: {
                            type: "string",
                            description: "Search query (e.g., 'authentication', 'user api', 'database connection')",
                        },
                    },
                    required: ["query"],
                },
            },
            {
                name: "get_node",
                description:
                    "Get detailed information about a specific code component by its ID. Includes description, parameters, dependencies, and usage examples.",
                inputSchema: {
                    type: "object",
                    properties: {
                        nodeId: {
                            type: "string",
                            description: "The ID of the node to retrieve",
                        },
                    },
                    required: ["nodeId"],
                },
            },
            {
                name: "list_nodes",
                description:
                    "List all code components in the project, optionally filtered by type (function, class, file, component, etc.)",
                inputSchema: {
                    type: "object",
                    properties: {
                        type: {
                            type: "string",
                            description: "Filter by node type: 'function', 'class', 'method', 'file', 'component', 'module'",
                            enum: ["function", "class", "method", "file", "component", "module", "interface", "variable"],
                        },
                    },
                },
            },
            {
                name: "get_graph",
                description:
                    "Get the full code structure graph showing all nodes and their relationships (dependencies, calls, imports).",
                inputSchema: {
                    type: "object",
                    properties: {},
                },
            },
            {
                name: "get_project_summary",
                description:
                    "Get a high-level summary of the project including entry points, frameworks used, and code statistics.",
                inputSchema: {
                    type: "object",
                    properties: {},
                },
            },
        ],
    };
});

// Handle Tool Calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
        switch (name) {
            case "search_docs": {
                const query = args?.query;
                if (!query) {
                    return { content: [{ type: "text", text: "Error: query parameter is required" }] };
                }
                const results = searchDocs(query);
                if (results.length === 0) {
                    return {
                        content: [{ type: "text", text: `No results found for "${query}"` }],
                    };
                }
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(results, null, 2),
                        },
                    ],
                };
            }

            case "get_node": {
                const nodeId = args?.nodeId;
                if (!nodeId) {
                    return { content: [{ type: "text", text: "Error: nodeId parameter is required" }] };
                }
                const node = getNode(nodeId);
                if (!node) {
                    // Try to get from docs.json components
                    const docs = getDocs();
                    const component = docs?.components?.[nodeId];
                    if (component) {
                        return {
                            content: [{ type: "text", text: JSON.stringify(component, null, 2) }],
                        };
                    }
                    return {
                        content: [{ type: "text", text: `Node "${nodeId}" not found` }],
                    };
                }
                return {
                    content: [{ type: "text", text: JSON.stringify(node, null, 2) }],
                };
            }

            case "list_nodes": {
                const type = args?.type || null;
                const nodes = listNodes(type);
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(nodes, null, 2),
                        },
                    ],
                };
            }

            case "get_graph": {
                const graph = getGraph();
                if (!graph) {
                    return {
                        content: [{ type: "text", text: "Graph not found. Run 'Sync Docs' first." }],
                    };
                }
                // Return summarized graph to avoid overwhelming the AI
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(
                                {
                                    nodeCount: graph.nodes?.length || 0,
                                    edgeCount: graph.edges?.length || 0,
                                    nodes: graph.nodes?.slice(0, 50), // First 50 nodes
                                    edges: graph.edges?.slice(0, 100), // First 100 edges
                                    note: graph.nodes?.length > 50 ? "Truncated. Use list_nodes or search_docs for specific queries." : undefined,
                                },
                                null,
                                2
                            ),
                        },
                    ],
                };
            }

            case "get_project_summary": {
                const summary = getProjectSummary();
                return {
                    content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
                };
            }

            default:
                return {
                    content: [{ type: "text", text: `Unknown tool: ${name}` }],
                };
        }
    } catch (error) {
        return {
            content: [{ type: "text", text: `Error: ${error.message}` }],
        };
    }
});

// Define Resources
server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return {
        resources: [
            {
                uri: "docs://graph",
                name: "Code Graph",
                description: "The full code structure graph with nodes and edges",
                mimeType: "application/json",
            },
            {
                uri: "docs://metadata",
                name: "Project Metadata",
                description: "Project metadata including name, frameworks, and entry points",
                mimeType: "application/json",
            },
            {
                uri: "docs://summary",
                name: "Project Summary",
                description: "High-level project summary and statistics",
                mimeType: "application/json",
            },
        ],
    };
});

// Handle Resource Reads
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;

    switch (uri) {
        case "docs://graph": {
            const graph = getGraph();
            return {
                contents: [
                    {
                        uri,
                        mimeType: "application/json",
                        text: JSON.stringify(graph, null, 2),
                    },
                ],
            };
        }

        case "docs://metadata": {
            const metadata = getMetadata();
            return {
                contents: [
                    {
                        uri,
                        mimeType: "application/json",
                        text: JSON.stringify(metadata, null, 2),
                    },
                ],
            };
        }

        case "docs://summary": {
            const summary = getProjectSummary();
            return {
                contents: [
                    {
                        uri,
                        mimeType: "application/json",
                        text: JSON.stringify(summary, null, 2),
                    },
                ],
            };
        }

        default:
            throw new Error(`Unknown resource: ${uri}`);
    }
});

// Start the server
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error(`Doc-Sync MCP Server started for: ${projectPath}`);
}

main().catch((error) => {
    console.error("Server error:", error);
    process.exit(1);
});
