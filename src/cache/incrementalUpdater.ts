import * as vscode from 'vscode';
import * as path from 'path';
import { CodeGraph, CodeNode, CodeEdge, AnalysisResult } from '../types/types';
import { FileHashCache, getFileHashCache, ChangeDetectionResult } from '../cache/fileHashCache';
import { WorkspaceAnalyzer } from '../analyzers/workspaceAnalyzer';

/**
 * Result of an incremental update
 */
export interface IncrementalUpdateResult {
  success: boolean;
  nodesAdded: number;
  nodesModified: number;
  nodesRemoved: number;
  edgesUpdated: number;
  processingTimeMs: number;
  skippedFiles: number;
  message: string;
}

/**
 * IncrementalGraphUpdater - Efficiently updates only changed nodes
 * 
 * This system:
 * 1. Uses FileHashCache to detect which files changed
 * 2. Only re-parses changed files
 * 3. Updates affected nodes and edges
 * 4. Preserves unchanged parts of the graph
 */
export class IncrementalGraphUpdater {
  private hashCache: FileHashCache;
  private workspaceAnalyzer: WorkspaceAnalyzer;
  private currentGraph: CodeGraph | null = null;
  private workspaceRoot: string = '';

  constructor() {
    this.hashCache = getFileHashCache();
    this.workspaceAnalyzer = new WorkspaceAnalyzer();
  }

  /**
   * Initialize the updater with workspace and existing graph
   */
  async initialize(workspaceRoot: string, existingGraph?: CodeGraph): Promise<void> {
    this.workspaceRoot = workspaceRoot;
    await this.hashCache.initialize(workspaceRoot);
    this.currentGraph = existingGraph || null;
  }

  /**
   * Check if there are any changes that need processing
   */
  async hasChanges(): Promise<boolean> {
    const allFiles = await this.getAllSourceFiles();
    const changes = await this.hashCache.detectChanges(allFiles);
    return changes.changedCount > 0;
  }

  /**
   * Get pending changes without applying them
   */
  async getPendingChanges(): Promise<ChangeDetectionResult> {
    const allFiles = await this.getAllSourceFiles();
    return this.hashCache.detectChanges(allFiles);
  }

  /**
   * Perform an incremental update
   */
  async performIncrementalUpdate(
    fullAnalysisResult: AnalysisResult,
    onProgress?: (message: string, percent: number) => void
  ): Promise<IncrementalUpdateResult> {
    const startTime = Date.now();
    
    try {
      onProgress?.('Detecting changes...', 0);

      // Get all current source files
      const allFiles = await this.getAllSourceFiles();
      
      // Detect changes
      const changes = await this.hashCache.detectChanges(allFiles);
      
      if (changes.changedCount === 0) {
        return {
          success: true,
          nodesAdded: 0,
          nodesModified: 0,
          nodesRemoved: 0,
          edgesUpdated: 0,
          processingTimeMs: Date.now() - startTime,
          skippedFiles: changes.unchanged.length,
          message: 'No changes detected. Graph is up to date.'
        };
      }

      onProgress?.(`Processing ${changes.changedCount} changed files...`, 10);

      // Initialize the current graph if not set
      if (!this.currentGraph) {
        this.currentGraph = fullAnalysisResult.graph;
      }

      let nodesAdded = 0;
      let nodesModified = 0;
      let nodesRemoved = 0;
      let edgesUpdated = 0;

      // Process deleted files
      onProgress?.('Removing deleted nodes...', 20);
      for (const deletedFile of changes.deleted) {
        const removedNodeIds = this.hashCache.removeEntry(deletedFile);
        nodesRemoved += this.removeNodesForFile(deletedFile, removedNodeIds);
      }

      // Process added files
      onProgress?.('Adding new nodes...', 40);
      for (const addedFile of changes.added) {
        const newNodes = this.getNodesForFile(fullAnalysisResult.graph, addedFile);
        nodesAdded += this.addNodes(newNodes);
        this.hashCache.updateEntry(addedFile, newNodes.map(n => n.id));
      }

      // Process modified files
      onProgress?.('Updating modified nodes...', 60);
      for (const modifiedFile of changes.modified) {
        const updatedNodes = this.getNodesForFile(fullAnalysisResult.graph, modifiedFile);
        nodesModified += this.updateNodes(modifiedFile, updatedNodes);
        this.hashCache.updateEntry(modifiedFile, updatedNodes.map(n => n.id));
      }

      // Rebuild edges for affected files
      onProgress?.('Rebuilding edges...', 80);
      const affectedFiles = [...changes.added, ...changes.modified];
      edgesUpdated = this.rebuildEdges(fullAnalysisResult.graph, affectedFiles);

      // Save cache
      onProgress?.('Saving cache...', 95);
      await this.hashCache.saveCache();

      onProgress?.('Complete!', 100);

      return {
        success: true,
        nodesAdded,
        nodesModified,
        nodesRemoved,
        edgesUpdated,
        processingTimeMs: Date.now() - startTime,
        skippedFiles: changes.unchanged.length,
        message: `Updated ${changes.changedCount} files (${nodesAdded} added, ${nodesModified} modified, ${nodesRemoved} removed)`
      };

    } catch (error) {
      console.error('Incremental update failed:', error);
      return {
        success: false,
        nodesAdded: 0,
        nodesModified: 0,
        nodesRemoved: 0,
        edgesUpdated: 0,
        processingTimeMs: Date.now() - startTime,
        skippedFiles: 0,
        message: `Update failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Get all source files in the workspace
   */
  private async getAllSourceFiles(): Promise<string[]> {
    const patterns = [
      '**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx',
      '**/*.java', '**/*.py'
    ];
    const excludePatterns = [
      '**/node_modules/**', '**/dist/**', '**/build/**',
      '**/.git/**', '**/coverage/**', '**/*.test.*', '**/*.spec.*'
    ];

    const files: string[] = [];
    
    for (const pattern of patterns) {
      const foundFiles = await vscode.workspace.findFiles(
        new vscode.RelativePattern(this.workspaceRoot, pattern),
        `{${excludePatterns.join(',')}}`
      );
      files.push(...foundFiles.map(f => f.fsPath));
    }

    return files;
  }

  /**
   * Get nodes from the full analysis that belong to a specific file
   */
  private getNodesForFile(graph: CodeGraph, filePath: string): CodeNode[] {
    return graph.nodes.filter(node => node.filePath === filePath);
  }

  /**
   * Remove nodes for a deleted file
   */
  private removeNodesForFile(filePath: string, nodeIds: string[]): number {
    if (!this.currentGraph) return 0;

    const nodeIdSet = new Set(nodeIds);
    const originalCount = this.currentGraph.nodes.length;

    // Remove nodes
    this.currentGraph.nodes = this.currentGraph.nodes.filter(
      node => !nodeIdSet.has(node.id) && node.filePath !== filePath
    );

    // Remove associated edges
    this.currentGraph.edges = this.currentGraph.edges.filter(
      edge => !nodeIdSet.has(edge.from) && !nodeIdSet.has(edge.to)
    );

    return originalCount - this.currentGraph.nodes.length;
  }

  /**
   * Add new nodes to the graph
   */
  private addNodes(nodes: CodeNode[]): number {
    if (!this.currentGraph) return 0;

    // Check for duplicates
    const existingIds = new Set(this.currentGraph.nodes.map(n => n.id));
    const newNodes = nodes.filter(n => !existingIds.has(n.id));

    this.currentGraph.nodes.push(...newNodes);
    return newNodes.length;
  }

  /**
   * Update existing nodes for a modified file
   */
  private updateNodes(filePath: string, updatedNodes: CodeNode[]): number {
    if (!this.currentGraph) return 0;

    // Remove old nodes for this file
    const oldNodes = this.currentGraph.nodes.filter(n => n.filePath === filePath);
    const oldNodeIds = new Set(oldNodes.map(n => n.id));
    
    this.currentGraph.nodes = this.currentGraph.nodes.filter(n => n.filePath !== filePath);

    // Add updated nodes
    this.currentGraph.nodes.push(...updatedNodes);

    // Remove old edges for these nodes
    this.currentGraph.edges = this.currentGraph.edges.filter(
      edge => !oldNodeIds.has(edge.from) && !oldNodeIds.has(edge.to)
    );

    return updatedNodes.length;
  }

  /**
   * Rebuild edges for affected files
   */
  private rebuildEdges(fullGraph: CodeGraph, affectedFiles: string[]): number {
    if (!this.currentGraph) return 0;

    const affectedFileSet = new Set(affectedFiles);
    
    // Get edges that involve affected files
    const newEdges = fullGraph.edges.filter(edge => {
      const fromNode = fullGraph.nodes.find(n => n.filePath === edge.from);
      const toNode = fullGraph.nodes.find(n => n.filePath === edge.to);
      return (fromNode && affectedFileSet.has(fromNode.filePath)) ||
             (toNode && affectedFileSet.has(toNode.filePath));
    });

    // Add new edges that don't already exist
    const existingEdgeKeys = new Set(
      this.currentGraph.edges.map(e => `${e.from}->${e.to}`)
    );

    let addedCount = 0;
    for (const edge of newEdges) {
      const key = `${edge.from}->${edge.to}`;
      if (!existingEdgeKeys.has(key)) {
        this.currentGraph.edges.push(edge);
        addedCount++;
      }
    }

    return addedCount;
  }

  /**
   * Get the current graph
   */
  getCurrentGraph(): CodeGraph | null {
    return this.currentGraph;
  }

  /**
   * Force a full refresh (clear cache and rebuild)
   */
  async forceFullRefresh(): Promise<void> {
    this.hashCache.clearCache();
    this.currentGraph = null;
    await this.hashCache.saveCache();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { totalFiles: number; cacheSize: number } {
    return this.hashCache.getStats();
  }
}

// Singleton instance
let updaterInstance: IncrementalGraphUpdater | null = null;

export function getIncrementalUpdater(): IncrementalGraphUpdater {
  if (!updaterInstance) {
    updaterInstance = new IncrementalGraphUpdater();
  }
  return updaterInstance;
}
