/**
 * Configuration loader for MCP Server
 * Loads project configurations from config file or auto-discovers .doc_sync folders
 */
import { MCPConfig, ProjectConfig, GraphData, NodeData, ProjectMetadata } from './types.js';
export declare class ConfigLoader {
    private config;
    private configPath;
    /**
     * Load configuration from file or create default
     */
    loadConfig(): Promise<MCPConfig>;
    /**
     * Get the current configuration
     */
    getConfig(): MCPConfig;
    /**
     * Get list of all configured projects
     */
    getProjects(): Array<{
        id: string;
        config: ProjectConfig;
    }>;
    /**
     * Get a specific project by ID
     */
    getProject(projectId: string): ProjectConfig | null;
    /**
     * Check if a project's .doc_sync exists and has data
     */
    projectHasData(projectId: string): boolean;
    /**
     * Add a project to the configuration
     */
    addProject(projectId: string, projectConfig: ProjectConfig): void;
    /**
     * Remove a project from the configuration
     */
    removeProject(projectId: string): boolean;
    /**
     * Save the current configuration to file
     */
    private saveConfig;
}
/**
 * Data loader for reading .doc_sync files
 */
export declare class DataLoader {
    private configLoader;
    constructor(configLoader: ConfigLoader);
    /**
     * Get the .doc_sync path for a project
     */
    private getDocSyncPath;
    /**
     * Load the full graph for a project
     */
    loadGraph(projectId: string): GraphData | null;
    /**
     * Load a specific node's documentation
     */
    loadNode(projectId: string, nodeId: string): NodeData | null;
    /**
     * Load project metadata
     */
    loadMetadata(projectId: string): ProjectMetadata | null;
    /**
     * Load search index for a project
     */
    loadSearchIndex(projectId: string): any[];
    /**
     * Load docs.json (component documentation)
     */
    loadDocs(projectId: string): Record<string, any> | null;
    /**
     * Search across a project's documentation
     */
    searchCodebase(projectId: string, query: string): Array<{
        nodeId: string;
        label: string;
        type: string;
        filePath?: string;
        snippet?: string;
        score: number;
    }>;
    /**
     * Get dependencies of a node (what it uses/calls)
     */
    getDependencies(projectId: string, nodeId: string): NodeData[];
    /**
     * Get dependents of a node (what uses/calls it)
     */
    getDependents(projectId: string, nodeId: string): NodeData[];
    /**
     * Get entry points for a project
     */
    getEntryPoints(projectId: string): NodeData[];
}
//# sourceMappingURL=config.d.ts.map