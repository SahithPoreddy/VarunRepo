import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { CodeGraph, AnalysisResult } from '../types/types';
import { getFileHashCache, FileHashCache } from '../cache/fileHashCache';
import { getIncrementalUpdater, IncrementalGraphUpdater } from '../cache/incrementalUpdater';

/**
 * Branch state information
 */
export interface BranchState {
  branchName: string;
  lastCommitHash: string;
  lastUpdateTime: string;
  fileHashes: Map<string, string>;
  graphSnapshot?: string; // Path to cached graph JSON
  nodeCount: number;
  edgeCount: number;
}

/**
 * Change event types for centralized handling
 */
export type ChangeEventType = 
  | 'file-modified'
  | 'file-created'
  | 'file-deleted'
  | 'branch-switch'
  | 'commit'
  | 'merge'
  | 'rebase'
  | 'stash-apply'
  | 'cherry-pick';

/**
 * Centralized change event
 */
export interface ChangeEvent {
  type: ChangeEventType;
  files: string[];
  fromBranch?: string;
  toBranch?: string;
  commitHash?: string;
  timestamp: Date;
  requiresFullRefresh: boolean;
}

/**
 * Callback for change events
 */
export type ChangeEventCallback = (event: ChangeEvent) => void;

/**
 * Update strategy for different scenarios
 */
export type UpdateStrategy = 'incremental' | 'full-refresh' | 'branch-cache' | 'no-update';

/**
 * BranchAwareGraphManager - Centralized mechanism for handling all git-related changes
 * 
 * This manager:
 * 1. Maintains per-branch graph caches
 * 2. Detects branch switches and restores cached state
 * 3. Handles incremental updates within a branch
 * 4. Provides intelligent update strategies based on change type
 * 5. Centralizes all git change detection
 */
export class BranchAwareGraphManager {
  private workspaceRoot: string = '';
  private cacheDir: string = '';
  private branchStatesPath: string = '';
  private branchStates: Map<string, BranchState> = new Map();
  private currentBranch: string = '';
  private previousBranch: string = '';
  private currentGraph: CodeGraph | null = null;
  
  private hashCache: FileHashCache;
  private incrementalUpdater: IncrementalGraphUpdater;
  
  private gitExtension: vscode.Extension<any> | undefined;
  private gitApi: any;
  private headWatcher: vscode.FileSystemWatcher | undefined;
  private branchWatcher: vscode.FileSystemWatcher | undefined;
  
  private callbacks: ChangeEventCallback[] = [];
  private isInitialized: boolean = false;
  private debounceTimer: NodeJS.Timeout | undefined;
  
  private static readonly DEBOUNCE_MS = 500;
  private static readonly CACHE_VERSION = '1.0.0';

  constructor() {
    this.hashCache = getFileHashCache();
    this.incrementalUpdater = getIncrementalUpdater();
  }

  /**
   * Initialize the manager for a workspace
   */
  async initialize(workspaceRoot: string): Promise<boolean> {
    this.workspaceRoot = workspaceRoot;
    this.cacheDir = path.join(workspaceRoot, '.mindframe', 'branch_cache');
    this.branchStatesPath = path.join(this.cacheDir, 'branch_states.json');
    
    const gitPath = path.join(workspaceRoot, '.git');
    if (!fs.existsSync(gitPath)) {
      console.log('Not a git repository');
      return false;
    }

    // Ensure cache directory exists
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }

    // Initialize hash cache
    await this.hashCache.initialize(workspaceRoot);
    await this.incrementalUpdater.initialize(workspaceRoot);

    // Load existing branch states
    await this.loadBranchStates();

    // Get VS Code Git extension
    this.gitExtension = vscode.extensions.getExtension('vscode.git');
    if (this.gitExtension?.isActive) {
      this.gitApi = this.gitExtension.exports.getAPI(1);
    }

    // Get current branch
    this.currentBranch = await this.getCurrentBranchName();
    
    // Set up watchers
    this.setupWatchers();

    this.isInitialized = true;
    console.log(`BranchAwareGraphManager initialized on branch: ${this.currentBranch}`);
    
    return true;
  }

  /**
   * Set up file system watchers for git changes
   */
  private setupWatchers(): void {
    const gitPath = path.join(this.workspaceRoot, '.git');

    // Watch HEAD for branch switches
    const headPattern = new vscode.RelativePattern(gitPath, 'HEAD');
    this.headWatcher = vscode.workspace.createFileSystemWatcher(headPattern);
    this.headWatcher.onDidChange(() => this.handleHeadChange());

    // Watch refs/heads for branch updates
    const refsPattern = new vscode.RelativePattern(gitPath, 'refs/heads/**');
    this.branchWatcher = vscode.workspace.createFileSystemWatcher(refsPattern);
    this.branchWatcher.onDidChange(() => this.handleRefChange());
    this.branchWatcher.onDidCreate(() => this.handleRefChange());
    this.branchWatcher.onDidDelete(() => this.handleRefChange());
  }

  /**
   * Handle HEAD file change (branch switch or commit)
   */
  private async handleHeadChange(): Promise<void> {
    const newBranch = await this.getCurrentBranchName();
    
    if (newBranch !== this.currentBranch) {
      // Branch switch detected
      this.previousBranch = this.currentBranch;
      this.currentBranch = newBranch;
      
      console.log(`Branch switch: ${this.previousBranch} -> ${this.currentBranch}`);
      await this.handleBranchSwitch();
    } else {
      // Same branch, might be a commit
      const newCommit = await this.getCurrentCommitHash();
      const currentState = this.branchStates.get(this.currentBranch);
      
      if (currentState && newCommit !== currentState.lastCommitHash) {
        console.log(`New commit on ${this.currentBranch}: ${newCommit}`);
        await this.handleNewCommit(newCommit);
      }
    }
  }

  /**
   * Handle ref changes (branch updates, deletes)
   */
  private handleRefChange(): void {
    this.debouncedCheck();
  }

  /**
   * Debounced check for changes
   */
  private debouncedCheck(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    
    this.debounceTimer = setTimeout(async () => {
      await this.checkForChanges();
    }, BranchAwareGraphManager.DEBOUNCE_MS);
  }

  /**
   * Handle branch switch
   */
  private async handleBranchSwitch(): Promise<void> {
    // Save current branch state before switching
    if (this.previousBranch && this.currentGraph) {
      await this.saveBranchState(this.previousBranch);
    }

    // Check if we have a cached state for the new branch
    const cachedState = this.branchStates.get(this.currentBranch);
    
    let event: ChangeEvent;
    
    if (cachedState && cachedState.graphSnapshot) {
      // We have a cache for this branch
      event = {
        type: 'branch-switch',
        files: [],
        fromBranch: this.previousBranch,
        toBranch: this.currentBranch,
        timestamp: new Date(),
        requiresFullRefresh: false
      };
      
      // Restore from cache and check for delta
      await this.restoreBranchCache(cachedState);
    } else {
      // No cache for this branch, need full refresh
      event = {
        type: 'branch-switch',
        files: [],
        fromBranch: this.previousBranch,
        toBranch: this.currentBranch,
        timestamp: new Date(),
        requiresFullRefresh: true
      };
    }
    
    this.notifyCallbacks(event);
  }

  /**
   * Handle new commit on current branch
   */
  private async handleNewCommit(commitHash: string): Promise<void> {
    // Get files changed in this commit
    const changedFiles = await this.getCommitChangedFiles(commitHash);
    
    const event: ChangeEvent = {
      type: 'commit',
      files: changedFiles,
      commitHash,
      timestamp: new Date(),
      requiresFullRefresh: false
    };
    
    // Update branch state
    const state = this.branchStates.get(this.currentBranch);
    if (state) {
      state.lastCommitHash = commitHash;
      state.lastUpdateTime = new Date().toISOString();
    }
    
    await this.saveBranchStates();
    this.notifyCallbacks(event);
  }

  /**
   * Check for any changes (file modifications, etc.)
   */
  async checkForChanges(): Promise<ChangeEvent | null> {
    const changes = await this.hashCache.detectChanges(
      await this.getAllSourceFiles()
    );
    
    if (changes.changedCount === 0) {
      return null;
    }

    const allChangedFiles = [
      ...changes.added,
      ...changes.modified,
      ...changes.deleted
    ];

    const event: ChangeEvent = {
      type: changes.added.length > 0 ? 'file-created' : 
            changes.deleted.length > 0 ? 'file-deleted' : 'file-modified',
      files: allChangedFiles,
      timestamp: new Date(),
      requiresFullRefresh: false
    };

    return event;
  }

  /**
   * Determine the best update strategy for an event
   */
  determineUpdateStrategy(event: ChangeEvent): UpdateStrategy {
    switch (event.type) {
      case 'branch-switch':
        // Check if we have a usable cache
        const cachedState = this.branchStates.get(event.toBranch || '');
        if (cachedState?.graphSnapshot) {
          return 'branch-cache';
        }
        return 'full-refresh';
      
      case 'merge':
      case 'rebase':
      case 'cherry-pick':
        // These can have significant changes, often need full refresh
        return 'full-refresh';
      
      case 'commit':
      case 'file-modified':
      case 'file-created':
      case 'file-deleted':
        // Incremental update is usually sufficient
        if (event.files.length > 50) {
          // Too many files changed, full refresh is more efficient
          return 'full-refresh';
        }
        return 'incremental';
      
      case 'stash-apply':
        // Stash can affect many files
        if (event.files.length > 20) {
          return 'full-refresh';
        }
        return 'incremental';
      
      default:
        return 'incremental';
    }
  }

  /**
   * Save current branch state to cache
   */
  async saveBranchState(branchName: string): Promise<void> {
    if (!this.currentGraph) return;

    const commitHash = await this.getCurrentCommitHash();
    const graphSnapshotPath = path.join(this.cacheDir, `graph_${this.sanitizeBranchName(branchName)}.json`);
    
    // Save graph snapshot
    fs.writeFileSync(graphSnapshotPath, JSON.stringify(this.currentGraph, null, 2));
    
    // Save hash state
    const fileHashes = new Map<string, string>();
    const files = await this.getAllSourceFiles();
    for (const file of files) {
      const hash = await this.hashCache.getFileHash(file);
      if (hash) {
        fileHashes.set(file, hash);
      }
    }

    const state: BranchState = {
      branchName,
      lastCommitHash: commitHash,
      lastUpdateTime: new Date().toISOString(),
      fileHashes,
      graphSnapshot: graphSnapshotPath,
      nodeCount: this.currentGraph.nodes.length,
      edgeCount: this.currentGraph.edges.length
    };

    this.branchStates.set(branchName, state);
    await this.saveBranchStates();
    
    console.log(`Saved branch state for ${branchName}: ${state.nodeCount} nodes, ${state.edgeCount} edges`);
  }

  /**
   * Restore branch state from cache
   */
  private async restoreBranchCache(state: BranchState): Promise<void> {
    if (!state.graphSnapshot || !fs.existsSync(state.graphSnapshot)) {
      console.log(`No valid cache for branch ${state.branchName}`);
      return;
    }

    try {
      const graphJson = fs.readFileSync(state.graphSnapshot, 'utf-8');
      this.currentGraph = JSON.parse(graphJson);
      
      // Restore hash cache for this branch
      for (const [file, hash] of state.fileHashes) {
        await this.hashCache.setFileHash(file, hash);
      }
      
      console.log(`Restored cache for ${state.branchName}: ${state.nodeCount} nodes`);
      
      // Check if there are any new changes since the cache was saved
      const changes = await this.hashCache.detectChanges(
        await this.getAllSourceFiles()
      );
      
      if (changes.changedCount > 0) {
        console.log(`${changes.changedCount} files changed since cache, incremental update needed`);
        // These will be handled by the incremental updater
      }
    } catch (error) {
      console.error(`Failed to restore branch cache: ${error}`);
    }
  }

  /**
   * Load branch states from disk
   */
  private async loadBranchStates(): Promise<void> {
    if (!fs.existsSync(this.branchStatesPath)) {
      return;
    }

    try {
      const content = fs.readFileSync(this.branchStatesPath, 'utf-8');
      const data = JSON.parse(content);
      
      for (const [branch, state] of Object.entries(data.states || {})) {
        const typedState = state as any;
        this.branchStates.set(branch, {
          ...typedState,
          fileHashes: new Map(Object.entries(typedState.fileHashes || {}))
        });
      }
      
      console.log(`Loaded ${this.branchStates.size} branch states`);
    } catch (error) {
      console.error('Failed to load branch states:', error);
    }
  }

  /**
   * Save branch states to disk
   */
  private async saveBranchStates(): Promise<void> {
    const states: Record<string, any> = {};
    
    for (const [branch, state] of this.branchStates) {
      states[branch] = {
        ...state,
        fileHashes: Object.fromEntries(state.fileHashes)
      };
    }

    const data = {
      version: BranchAwareGraphManager.CACHE_VERSION,
      lastUpdated: new Date().toISOString(),
      states
    };

    fs.writeFileSync(this.branchStatesPath, JSON.stringify(data, null, 2));
  }

  /**
   * Get current branch name
   */
  async getCurrentBranchName(): Promise<string> {
    try {
      // Try VS Code Git API first
      if (this.gitApi?.repositories?.[0]) {
        const repo = this.gitApi.repositories[0];
        return repo.state.HEAD?.name || 'unknown';
      }

      // Fallback: read .git/HEAD directly
      const headPath = path.join(this.workspaceRoot, '.git', 'HEAD');
      if (fs.existsSync(headPath)) {
        const content = fs.readFileSync(headPath, 'utf-8').trim();
        const match = content.match(/ref: refs\/heads\/(.+)/);
        if (match) {
          return match[1];
        }
        // Detached HEAD state
        return content.substring(0, 8);
      }
    } catch (error) {
      console.error('Failed to get branch name:', error);
    }
    return 'unknown';
  }

  /**
   * Get current commit hash
   */
  async getCurrentCommitHash(): Promise<string> {
    try {
      if (this.gitApi?.repositories?.[0]) {
        const repo = this.gitApi.repositories[0];
        return repo.state.HEAD?.commit || '';
      }

      // Fallback: resolve HEAD
      const headPath = path.join(this.workspaceRoot, '.git', 'HEAD');
      if (fs.existsSync(headPath)) {
        let content = fs.readFileSync(headPath, 'utf-8').trim();
        
        if (content.startsWith('ref:')) {
          const refPath = path.join(this.workspaceRoot, '.git', content.replace('ref: ', ''));
          if (fs.existsSync(refPath)) {
            content = fs.readFileSync(refPath, 'utf-8').trim();
          }
        }
        
        return content;
      }
    } catch (error) {
      console.error('Failed to get commit hash:', error);
    }
    return '';
  }

  /**
   * Get files changed in a specific commit
   */
  private async getCommitChangedFiles(commitHash: string): Promise<string[]> {
    // This would ideally use git diff, but for now return empty
    // The incremental updater will detect actual file changes
    return [];
  }

  /**
   * Get all source files in the workspace
   */
  private async getAllSourceFiles(): Promise<string[]> {
    const patterns = ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx', '**/*.java', '**/*.py'];
    const excludes = ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**', '**/.mindframe/**'];
    
    const files: string[] = [];
    
    for (const pattern of patterns) {
      const uris = await vscode.workspace.findFiles(pattern, `{${excludes.join(',')}}`);
      files.push(...uris.map(u => u.fsPath));
    }
    
    return files;
  }

  /**
   * Sanitize branch name for use in file paths
   */
  private sanitizeBranchName(name: string): string {
    return name.replace(/[/\\:*?"<>|]/g, '_');
  }

  /**
   * Register a callback for change events
   */
  onChangeEvent(callback: ChangeEventCallback): vscode.Disposable {
    this.callbacks.push(callback);
    return new vscode.Disposable(() => {
      const index = this.callbacks.indexOf(callback);
      if (index >= 0) {
        this.callbacks.splice(index, 1);
      }
    });
  }

  /**
   * Notify all callbacks
   */
  private notifyCallbacks(event: ChangeEvent): void {
    for (const callback of this.callbacks) {
      try {
        callback(event);
      } catch (error) {
        console.error('Callback error:', error);
      }
    }
  }

  /**
   * Update the current graph reference
   */
  setCurrentGraph(graph: CodeGraph): void {
    this.currentGraph = graph;
  }

  /**
   * Get current branch
   */
  getBranch(): string {
    return this.currentBranch;
  }

  /**
   * Get all cached branches
   */
  getCachedBranches(): string[] {
    return Array.from(this.branchStates.keys());
  }

  /**
   * Clear cache for a specific branch
   */
  async clearBranchCache(branchName: string): Promise<void> {
    const state = this.branchStates.get(branchName);
    if (state?.graphSnapshot && fs.existsSync(state.graphSnapshot)) {
      fs.unlinkSync(state.graphSnapshot);
    }
    this.branchStates.delete(branchName);
    await this.saveBranchStates();
  }

  /**
   * Clear all branch caches
   */
  async clearAllCaches(): Promise<void> {
    for (const state of this.branchStates.values()) {
      if (state.graphSnapshot && fs.existsSync(state.graphSnapshot)) {
        fs.unlinkSync(state.graphSnapshot);
      }
    }
    this.branchStates.clear();
    await this.saveBranchStates();
  }

  /**
   * Dispose the manager
   */
  dispose(): void {
    this.headWatcher?.dispose();
    this.branchWatcher?.dispose();
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
  }
}

// Singleton instance
let managerInstance: BranchAwareGraphManager | null = null;

export function getBranchManager(): BranchAwareGraphManager {
  if (!managerInstance) {
    managerInstance = new BranchAwareGraphManager();
  }
  return managerInstance;
}
