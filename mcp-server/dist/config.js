/**
 * Configuration loader for MCP Server
 * Loads project configurations from config file or auto-discovers .doc_sync folders
 */
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
// Default config locations
const CONFIG_LOCATIONS = [
    path.join(os.homedir(), '.codebase-visualizer', 'mcp-config.json'),
    path.join(os.homedir(), '.config', 'codebase-visualizer', 'mcp-config.json'),
    './mcp-config.json'
];
export class ConfigLoader {
    config = null;
    configPath = null;
    /**
     * Load configuration from file or create default
     */
    async loadConfig() {
        // Try each config location
        for (const configPath of CONFIG_LOCATIONS) {
            if (fs.existsSync(configPath)) {
                try {
                    const content = fs.readFileSync(configPath, 'utf-8');
                    this.config = JSON.parse(content);
                    this.configPath = configPath;
                    console.error(`[MCP] Loaded config from: ${configPath}`);
                    return this.config;
                }
                catch (error) {
                    console.error(`[MCP] Error loading config from ${configPath}:`, error);
                }
            }
        }
        // No config found - create default empty config
        console.error('[MCP] No config found, using empty configuration');
        console.error('[MCP] Create a config file at:', CONFIG_LOCATIONS[0]);
        this.config = { projects: {} };
        return this.config;
    }
    /**
     * Get the current configuration
     */
    getConfig() {
        if (!this.config) {
            throw new Error('Config not loaded. Call loadConfig() first.');
        }
        return this.config;
    }
    /**
     * Get list of all configured projects
     */
    getProjects() {
        const config = this.getConfig();
        return Object.entries(config.projects).map(([id, projectConfig]) => ({
            id,
            config: {
                ...projectConfig,
                docSyncPath: projectConfig.docSyncPath || path.join(projectConfig.path, '.doc_sync')
            }
        }));
    }
    /**
     * Get a specific project by ID
     */
    getProject(projectId) {
        const config = this.getConfig();
        const project = config.projects[projectId];
        if (!project)
            return null;
        return {
            ...project,
            docSyncPath: project.docSyncPath || path.join(project.path, '.doc_sync')
        };
    }
    /**
     * Check if a project's .doc_sync exists and has data
     */
    projectHasData(projectId) {
        const project = this.getProject(projectId);
        if (!project)
            return false;
        const docSyncPath = project.docSyncPath || path.join(project.path, '.doc_sync');
        const graphPath = path.join(docSyncPath, 'graph', 'graph.json');
        return fs.existsSync(graphPath);
    }
    /**
     * Add a project to the configuration
     */
    addProject(projectId, projectConfig) {
        const config = this.getConfig();
        config.projects[projectId] = projectConfig;
        this.saveConfig();
    }
    /**
     * Remove a project from the configuration
     */
    removeProject(projectId) {
        const config = this.getConfig();
        if (config.projects[projectId]) {
            delete config.projects[projectId];
            this.saveConfig();
            return true;
        }
        return false;
    }
    /**
     * Save the current configuration to file
     */
    saveConfig() {
        if (!this.config)
            return;
        const configPath = this.configPath || CONFIG_LOCATIONS[0];
        const configDir = path.dirname(configPath);
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }
        fs.writeFileSync(configPath, JSON.stringify(this.config, null, 2));
        console.error(`[MCP] Saved config to: ${configPath}`);
    }
}
/**
 * Data loader for reading .doc_sync files
 */
export class DataLoader {
    configLoader;
    constructor(configLoader) {
        this.configLoader = configLoader;
    }
    /**
     * Get the .doc_sync path for a project
     */
    getDocSyncPath(projectId) {
        const project = this.configLoader.getProject(projectId);
        if (!project)
            return null;
        return project.docSyncPath || path.join(project.path, '.doc_sync');
    }
    /**
     * Load the full graph for a project
     */
    loadGraph(projectId) {
        const docSyncPath = this.getDocSyncPath(projectId);
        if (!docSyncPath)
            return null;
        const graphPath = path.join(docSyncPath, 'graph', 'graph.json');
        if (!fs.existsSync(graphPath))
            return null;
        try {
            const content = fs.readFileSync(graphPath, 'utf-8');
            return JSON.parse(content);
        }
        catch (error) {
            console.error(`[MCP] Error loading graph for ${projectId}:`, error);
            return null;
        }
    }
    /**
     * Load a specific node's documentation
     */
    loadNode(projectId, nodeId) {
        const docSyncPath = this.getDocSyncPath(projectId);
        if (!docSyncPath)
            return null;
        // Sanitize nodeId for filename
        const sanitizedId = nodeId.replace(/[<>:"/\\|?*]/g, '_');
        const nodePath = path.join(docSyncPath, 'nodes', `${sanitizedId}.json`);
        if (fs.existsSync(nodePath)) {
            try {
                const content = fs.readFileSync(nodePath, 'utf-8');
                return JSON.parse(content);
            }
            catch (error) {
                console.error(`[MCP] Error loading node ${nodeId}:`, error);
            }
        }
        // Fallback: find node in graph
        const graph = this.loadGraph(projectId);
        if (graph) {
            return graph.nodes.find(n => n.id === nodeId) || null;
        }
        return null;
    }
    /**
     * Load project metadata
     */
    loadMetadata(projectId) {
        const docSyncPath = this.getDocSyncPath(projectId);
        if (!docSyncPath)
            return null;
        const metadataPath = path.join(docSyncPath, 'metadata.json');
        if (!fs.existsSync(metadataPath))
            return null;
        try {
            const content = fs.readFileSync(metadataPath, 'utf-8');
            return JSON.parse(content);
        }
        catch (error) {
            console.error(`[MCP] Error loading metadata for ${projectId}:`, error);
            return null;
        }
    }
    /**
     * Load search index for a project
     */
    loadSearchIndex(projectId) {
        const docSyncPath = this.getDocSyncPath(projectId);
        if (!docSyncPath)
            return [];
        const searchPath = path.join(docSyncPath, 'search.json');
        if (!fs.existsSync(searchPath))
            return [];
        try {
            const content = fs.readFileSync(searchPath, 'utf-8');
            return JSON.parse(content);
        }
        catch (error) {
            console.error(`[MCP] Error loading search index for ${projectId}:`, error);
            return [];
        }
    }
    /**
     * Load docs.json (component documentation)
     */
    loadDocs(projectId) {
        const docSyncPath = this.getDocSyncPath(projectId);
        if (!docSyncPath)
            return null;
        const docsPath = path.join(docSyncPath, 'docs.json');
        if (!fs.existsSync(docsPath))
            return null;
        try {
            const content = fs.readFileSync(docsPath, 'utf-8');
            return JSON.parse(content);
        }
        catch (error) {
            console.error(`[MCP] Error loading docs for ${projectId}:`, error);
            return null;
        }
    }
    /**
     * Search across a project's documentation
     */
    searchCodebase(projectId, query) {
        const graph = this.loadGraph(projectId);
        if (!graph)
            return [];
        const docs = this.loadDocs(projectId);
        const queryLower = query.toLowerCase();
        const queryTerms = queryLower.split(/\s+/).filter(t => t.length > 1);
        const results = [];
        for (const node of graph.nodes) {
            let score = 0;
            let snippet = '';
            // Check label match
            const labelLower = node.label.toLowerCase();
            if (labelLower.includes(queryLower)) {
                score += 10;
            }
            for (const term of queryTerms) {
                if (labelLower.includes(term))
                    score += 2;
            }
            // Check description match
            if (node.description) {
                const descLower = node.description.toLowerCase();
                if (descLower.includes(queryLower)) {
                    score += 5;
                    snippet = node.description.slice(0, 200);
                }
                for (const term of queryTerms) {
                    if (descLower.includes(term))
                        score += 1;
                }
            }
            // Check AI documentation
            const nodeDoc = docs?.[node.id];
            if (nodeDoc) {
                const aiSummary = nodeDoc.aiSummary?.toLowerCase() || '';
                const aiDescription = nodeDoc.aiDescription?.toLowerCase() || '';
                if (aiSummary.includes(queryLower) || aiDescription.includes(queryLower)) {
                    score += 8;
                    snippet = nodeDoc.aiSummary || snippet;
                }
                for (const term of queryTerms) {
                    if (aiSummary.includes(term) || aiDescription.includes(term))
                        score += 1;
                }
            }
            // Check file path match
            if (node.filePath) {
                const pathLower = node.filePath.toLowerCase();
                for (const term of queryTerms) {
                    if (pathLower.includes(term))
                        score += 1;
                }
            }
            // Check metadata
            if (node.metadata) {
                const keywords = node.metadata.keywords || [];
                for (const keyword of keywords) {
                    if (keyword.toLowerCase().includes(queryLower))
                        score += 3;
                }
            }
            if (score > 0) {
                results.push({
                    nodeId: node.id,
                    label: node.label,
                    type: node.type,
                    filePath: node.filePath,
                    snippet,
                    score
                });
            }
        }
        // Sort by score descending
        results.sort((a, b) => b.score - a.score);
        return results.slice(0, 20); // Return top 20 results
    }
    /**
     * Get dependencies of a node (what it uses/calls)
     */
    getDependencies(projectId, nodeId) {
        const graph = this.loadGraph(projectId);
        if (!graph)
            return [];
        // Find edges where this node is the source
        const depIds = graph.edges
            .filter(e => e.source === nodeId)
            .map(e => e.target);
        return graph.nodes.filter(n => depIds.includes(n.id));
    }
    /**
     * Get dependents of a node (what uses/calls it)
     */
    getDependents(projectId, nodeId) {
        const graph = this.loadGraph(projectId);
        if (!graph)
            return [];
        // Find edges where this node is the target
        const depIds = graph.edges
            .filter(e => e.target === nodeId)
            .map(e => e.source);
        return graph.nodes.filter(n => depIds.includes(n.id));
    }
    /**
     * Get entry points for a project
     */
    getEntryPoints(projectId) {
        const graph = this.loadGraph(projectId);
        if (!graph)
            return [];
        // Entry points are nodes that have no incoming edges (nothing calls them)
        const nodesWithIncoming = new Set(graph.edges.map(e => e.target));
        return graph.nodes.filter(n => !nodesWithIncoming.has(n.id) &&
            (n.type === 'file' || n.type === 'function' || n.type === 'class'));
    }
}
//# sourceMappingURL=config.js.map