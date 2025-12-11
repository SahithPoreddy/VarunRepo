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

    // Populate hash cache from existing graph for files that still exist
    // This is needed for proper change detection
    if (existingGraph && existingGraph.nodes.length > 0) {
      await this.populateHashCacheFromGraph(existingGraph);
    }
  }

  /**
   * Populate hash cache from an existing graph
   * Only adds files that exist on disk (for hash calculation)
   */
  private async populateHashCacheFromGraph(graph: CodeGraph): Promise<void> {
    const fs = await import('fs');
    
    // Get unique file paths from the graph
    const filePaths = new Set<string>();
    for (const node of graph.nodes) {
      if (node.filePath) {
        filePaths.add(node.filePath);
      }
    }

    let addedCount = 0;
    for (const filePath of filePaths) {
      // Only add to cache if file exists AND not already cached
      if (fs.existsSync(filePath) && !this.hashCache.hasEntry(filePath)) {
        const nodeIds = graph.nodes
          .filter(n => n.filePath === filePath)
          .map(n => n.id);
        this.hashCache.updateEntry(filePath, nodeIds);
        addedCount++;
      }
    }

    if (addedCount > 0) {
      await this.hashCache.saveCache();
      console.log(`Added ${addedCount} files to hash cache`);
    }
  }

  /**
   * Detect files that exist in the graph but have been deleted from disk
   */
  private detectDeletedFilesFromGraph(): string[] {
    if (!this.currentGraph) return [];
    
    const fs = require('fs');
    const deletedFiles: string[] = [];
    
    // Get unique file paths from the current graph
    const graphFilePaths = new Set<string>();
    for (const node of this.currentGraph.nodes) {
      if (node.filePath) {
        graphFilePaths.add(node.filePath);
      }
    }

    // Check which files no longer exist on disk
    for (const filePath of graphFilePaths) {
      if (!fs.existsSync(filePath)) {
        deletedFiles.push(filePath);
      }
    }

    return deletedFiles;
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

      // ALWAYS use the provided graph as the current state
      // This ensures we're working with the latest graph from the visualization panel
      this.currentGraph = fullAnalysisResult.graph;
      console.log(`Initialized with graph: ${this.currentGraph.nodes.length} nodes, ${this.currentGraph.edges.length} edges`);

      // Get all current source files
      const allFiles = await this.getAllSourceFiles();
      
      // Detect changes from hash cache (for modified/added files)
      const changes = await this.hashCache.detectChanges(allFiles);
      
      // ALSO detect deleted files by comparing graph nodes to disk
      // This catches files that were never in the hash cache
      const deletedFromGraph = this.detectDeletedFilesFromGraph();
      
      // Merge deleted files (avoid duplicates)
      const allDeleted = new Set([...changes.deleted, ...deletedFromGraph]);
      changes.deleted = Array.from(allDeleted);
      changes.changedCount = changes.added.length + changes.modified.length + changes.deleted.length;
      
      console.log(`Change detection results: ${changes.added.length} added, ${changes.modified.length} modified, ${changes.deleted.length} deleted, ${changes.unchanged.length} unchanged`);
      if (changes.added.length > 0) {
        console.log(`Added files: ${changes.added.join(', ')}`);
      }
      if (changes.deleted.length > 0) {
        console.log(`Deleted files: ${changes.deleted.join(', ')}`);
      }
      if (changes.modified.length > 0) {
        console.log(`Modified files: ${changes.modified.join(', ')}`);
      }
      
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

      let nodesAdded = 0;
      let nodesModified = 0;
      let nodesRemoved = 0;
      let edgesUpdated = 0;

      // Process deleted files
      onProgress?.('Removing deleted nodes...', 20);
      if (changes.deleted.length > 0) {
        console.log(`Detected ${changes.deleted.length} deleted files: ${changes.deleted.join(', ')}`);
      }
      for (const deletedFile of changes.deleted) {
        const removedNodeIds = this.hashCache.removeEntry(deletedFile);
        console.log(`Removing nodes for deleted file ${deletedFile}: ${removedNodeIds.join(', ')}`);
        nodesRemoved += this.removeNodesForFile(deletedFile, removedNodeIds);
      }

      // Process added files - RE-ANALYZE each new file
      onProgress?.('Analyzing new files...', 40);
      if (changes.added.length > 0) {
        console.log(`Detected ${changes.added.length} added files: ${changes.added.join(', ')}`);
      }
      for (const addedFile of changes.added) {
        try {
          const fileUri = vscode.Uri.file(addedFile);
          const newNodes = await this.workspaceAnalyzer.analyzeFile(fileUri);
          console.log(`Parsed added file ${addedFile}: found ${newNodes.length} nodes`);
          newNodes.forEach(n => console.log(`  - ${n.type}: ${n.label} (${n.id})`));
          nodesAdded += this.addNodes(newNodes);
          this.hashCache.updateEntry(addedFile, newNodes.map(n => n.id));
        } catch (error) {
          console.error(`Failed to analyze new file ${addedFile}:`, error);
        }
      }

      // Process modified files - RE-ANALYZE each modified file
      onProgress?.('Analyzing modified files...', 60);
      for (const modifiedFile of changes.modified) {
        try {
          const fileUri = vscode.Uri.file(modifiedFile);
          const updatedNodes = await this.workspaceAnalyzer.analyzeFile(fileUri);
          console.log(`Parsed ${modifiedFile}: found ${updatedNodes.length} nodes`);
          updatedNodes.forEach(n => console.log(`  - ${n.type}: ${n.label} (${n.id})`));
          nodesModified += this.updateNodes(modifiedFile, updatedNodes);
          this.hashCache.updateEntry(modifiedFile, updatedNodes.map(n => n.id));
        } catch (error) {
          console.error(`Failed to analyze modified file ${modifiedFile}:`, error);
        }
      }

      // Rebuild edges for affected files
      onProgress?.('Rebuilding edges...', 80);
      const affectedFiles = [...changes.added, ...changes.modified];
      edgesUpdated = await this.rebuildEdgesForAffectedFiles(affectedFiles);

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

    // Get ALL node IDs for this file (in case nodeIds from cache is incomplete)
    const nodesInFile = this.currentGraph.nodes.filter(n => n.filePath === filePath);
    const allNodeIds = new Set([...nodeIds, ...nodesInFile.map(n => n.id)]);
    
    const originalCount = this.currentGraph.nodes.length;

    // Remove nodes by file path (most reliable)
    this.currentGraph.nodes = this.currentGraph.nodes.filter(
      node => node.filePath !== filePath
    );

    // Remove associated edges (using all node IDs we found)
    this.currentGraph.edges = this.currentGraph.edges.filter(
      edge => !allNodeIds.has(edge.from) && !allNodeIds.has(edge.to)
    );

    const removedCount = originalCount - this.currentGraph.nodes.length;
    console.log(`Removed ${removedCount} nodes for deleted file: ${filePath}`);
    return removedCount;
  }

  /**
   * Add new nodes to the graph
   */
  private addNodes(nodes: CodeNode[]): number {
    if (!this.currentGraph) return 0;

    // Check for duplicates
    const existingIds = new Set(this.currentGraph.nodes.map(n => n.id));
    const newNodes = nodes.filter(n => !existingIds.has(n.id));

    if (newNodes.length === 0) {
      console.log('No new nodes to add (all duplicates)');
      return 0;
    }

    this.currentGraph.nodes.push(...newNodes);
    console.log(`Added ${newNodes.length} new nodes to graph`);

    // IMPORTANT: Create parent-child 'contains' edges for the new nodes
    const newNodeIds = new Set(newNodes.map(n => n.id));
    let edgesCreated = 0;
    for (const node of newNodes) {
      if (node.parentId) {
        // Check if parent exists (either in new nodes or existing graph)
        const parentExists = newNodeIds.has(node.parentId) || 
                            this.currentGraph.nodes.some(n => n.id === node.parentId);
        if (parentExists) {
          const edgeExists = this.currentGraph.edges.some(
            e => e.from === node.parentId && e.to === node.id && e.type === 'contains'
          );
          if (!edgeExists) {
            this.currentGraph.edges.push({
              from: node.parentId,
              to: node.id,
              type: 'contains'
            });
            edgesCreated++;
          }
        }
      }
    }
    if (edgesCreated > 0) {
      console.log(`Created ${edgesCreated} parent-child edges for new nodes`);
    }

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
    
    console.log(`Updating file ${filePath}: removing ${oldNodes.length} old nodes, adding ${updatedNodes.length} new nodes`);
    console.log(`Old node IDs: ${Array.from(oldNodeIds).join(', ')}`);
    console.log(`New node IDs: ${updatedNodes.map(n => n.id).join(', ')}`);
    
    this.currentGraph.nodes = this.currentGraph.nodes.filter(n => n.filePath !== filePath);

    // Add updated nodes
    this.currentGraph.nodes.push(...updatedNodes);

    // Remove old edges that reference removed nodes
    const oldEdgeCount = this.currentGraph.edges.length;
    this.currentGraph.edges = this.currentGraph.edges.filter(
      edge => !oldNodeIds.has(edge.from) && !oldNodeIds.has(edge.to)
    );
    console.log(`Removed ${oldEdgeCount - this.currentGraph.edges.length} old edges`);

    // IMPORTANT: Rebuild parent-child 'contains' edges for the updated nodes
    const newNodeIds = new Set(updatedNodes.map(n => n.id));
    for (const node of updatedNodes) {
      if (node.parentId && newNodeIds.has(node.parentId)) {
        // Add contains edge from parent to child
        const edgeExists = this.currentGraph.edges.some(
          e => e.from === node.parentId && e.to === node.id && e.type === 'contains'
        );
        if (!edgeExists) {
          this.currentGraph.edges.push({
            from: node.parentId,
            to: node.id,
            type: 'contains'
          });
          console.log(`Added contains edge: ${node.parentId} -> ${node.id}`);
        }
      }
    }

    return updatedNodes.length;
  }

  /**
   * Rebuild edges for affected files by analyzing imports
   */
  private async rebuildEdgesForAffectedFiles(affectedFiles: string[]): Promise<number> {
    if (!this.currentGraph) return 0;

    const affectedFileSet = new Set(affectedFiles);
    let addedCount = 0;

    // Build a map of file paths to node IDs for quick lookup
    const fileToNodes = new Map<string, CodeNode[]>();
    for (const node of this.currentGraph.nodes) {
      if (!fileToNodes.has(node.filePath)) {
        fileToNodes.set(node.filePath, []);
      }
      fileToNodes.get(node.filePath)!.push(node);
    }

    // For each affected file, find edges to other files based on node relationships
    for (const filePath of affectedFiles) {
      const nodesInFile = fileToNodes.get(filePath) || [];
      
      for (const node of nodesInFile) {
        // Look for nodes that might reference this node (based on naming patterns)
        for (const [otherPath, otherNodes] of fileToNodes) {
          if (otherPath === filePath) continue;
          
          for (const otherNode of otherNodes) {
            // Check if other node might depend on this node (simple heuristic)
            // More sophisticated edge detection would require full import analysis
            const key = `${otherNode.id}->${node.id}`;
            const reverseKey = `${node.id}->${otherNode.id}`;
            
            const existingEdgeKeys = new Set(
              this.currentGraph!.edges.map(e => `${e.from}->${e.to}`)
            );
            
            // If nodes share similar naming or are in parent-child relationship
            if (node.parentId === otherNode.id || otherNode.parentId === node.id) {
              if (!existingEdgeKeys.has(key) && !existingEdgeKeys.has(reverseKey)) {
                this.currentGraph!.edges.push({
                  from: node.parentId === otherNode.id ? otherNode.id : node.id,
                  to: node.parentId === otherNode.id ? node.id : otherNode.id,
                  type: 'contains'
                });
                addedCount++;
              }
            }
          }
        }
      }
    }

    return addedCount;
  }

  /**
   * Rebuild edges for affected files (legacy method - kept for reference)
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
