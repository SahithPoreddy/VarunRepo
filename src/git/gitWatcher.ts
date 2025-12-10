import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { IncrementalGraphUpdater, getIncrementalUpdater } from '../cache/incrementalUpdater';
import { BranchAwareGraphManager, getBranchManager, ChangeEvent, ChangeEventType } from './branchManager';

/**
 * Git change event types
 */
export type GitChangeType = 'stage' | 'commit' | 'file-change' | 'branch-switch';

/**
 * Git change event
 */
export interface GitChangeEvent {
  type: GitChangeType;
  files: string[];
  branch?: string;
  timestamp: Date;
}

/**
 * Callback for git change events
 */
export type GitChangeCallback = (event: GitChangeEvent) => void;

/**
 * GitWatcher - Monitors Git operations and file changes
 * 
 * This watcher:
 * 1. Monitors the .git folder for changes (commits, staging)
 * 2. Uses VS Code's built-in Git extension API
 * 3. Integrates with BranchAwareGraphManager for centralized handling
 * 4. Triggers incremental updates when changes are detected
 * 5. Supports manual "sync" trigger for on-demand updates
 */
export class GitWatcher {
  private workspaceRoot: string = '';
  private gitPath: string = '';
  private fileWatcher: vscode.FileSystemWatcher | undefined;
  private gitWatcher: vscode.FileSystemWatcher | undefined;
  private gitExtension: vscode.Extension<any> | undefined;
  private callbacks: GitChangeCallback[] = [];
  private incrementalUpdater: IncrementalGraphUpdater;
  private branchManager: BranchAwareGraphManager;
  private isWatching: boolean = false;
  private debounceTimer: NodeJS.Timeout | undefined;
  private pendingChanges: Set<string> = new Set();
  private branchManagerDisposable: vscode.Disposable | undefined;
  
  // Debounce delay in milliseconds
  private static readonly DEBOUNCE_DELAY = 1000;
  
  // File patterns to watch
  private static readonly WATCH_PATTERNS = [
    '**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx',
    '**/*.java', '**/*.py'
  ];

  constructor() {
    this.incrementalUpdater = getIncrementalUpdater();
    this.branchManager = getBranchManager();
  }

  /**
   * Initialize the watcher for a workspace
   */
  async initialize(workspaceRoot: string): Promise<boolean> {
    this.workspaceRoot = workspaceRoot;
    this.gitPath = path.join(workspaceRoot, '.git');

    // Check if this is a git repository
    if (!fs.existsSync(this.gitPath)) {
      console.log('Not a git repository, git watching disabled');
      return false;
    }

    // Try to get VS Code's Git extension
    this.gitExtension = vscode.extensions.getExtension('vscode.git');
    
    // Initialize branch manager for centralized handling
    const branchInitialized = await this.branchManager.initialize(workspaceRoot);
    if (branchInitialized) {
      // Subscribe to branch manager events for centralized handling
      this.branchManagerDisposable = this.branchManager.onChangeEvent((event) => {
        this.handleBranchManagerEvent(event);
      });
      console.log('Branch manager integration enabled');
    }
    
    return true;
  }

  /**
   * Handle events from the centralized BranchManager
   */
  private handleBranchManagerEvent(event: ChangeEvent): void {
    // Convert ChangeEvent to GitChangeEvent for backward compatibility
    const gitEvent: GitChangeEvent = {
      type: this.mapChangeEventType(event.type),
      files: event.files,
      branch: event.toBranch || this.branchManager.getBranch(),
      timestamp: event.timestamp
    };

    // If this is a branch switch and requires full refresh, notify specially
    if (event.type === 'branch-switch') {
      console.log(`Branch switch detected: ${event.fromBranch} -> ${event.toBranch}`);
      if (event.requiresFullRefresh) {
        console.log('Full refresh required for new branch');
      } else {
        console.log('Using cached graph for branch');
      }
    }

    this.notifyCallbacks(gitEvent);
  }

  /**
   * Map ChangeEventType to GitChangeType
   */
  private mapChangeEventType(type: ChangeEventType): GitChangeType {
    switch (type) {
      case 'branch-switch':
        return 'branch-switch';
      case 'commit':
        return 'commit';
      case 'file-modified':
      case 'file-created':
      case 'file-deleted':
        return 'file-change';
      default:
        return 'file-change';
    }
  }

  /**
   * Start watching for changes
   */
  startWatching(): void {
    if (this.isWatching) return;

    // Watch source files for changes
    const pattern = new vscode.RelativePattern(
      this.workspaceRoot,
      `{${GitWatcher.WATCH_PATTERNS.join(',')}}`
    );

    this.fileWatcher = vscode.workspace.createFileSystemWatcher(pattern);
    
    this.fileWatcher.onDidCreate(uri => this.handleFileChange(uri, 'create'));
    this.fileWatcher.onDidChange(uri => this.handleFileChange(uri, 'modify'));
    this.fileWatcher.onDidDelete(uri => this.handleFileChange(uri, 'delete'));

    // Watch git index for staging changes
    if (fs.existsSync(this.gitPath)) {
      const gitIndexPattern = new vscode.RelativePattern(
        this.gitPath,
        'index'
      );
      this.gitWatcher = vscode.workspace.createFileSystemWatcher(gitIndexPattern);
      this.gitWatcher.onDidChange(() => this.handleGitIndexChange());
    }

    this.isWatching = true;
    console.log('GitWatcher started monitoring changes');
  }

  /**
   * Stop watching for changes
   */
  stopWatching(): void {
    this.fileWatcher?.dispose();
    this.gitWatcher?.dispose();
    this.isWatching = false;
    console.log('GitWatcher stopped');
  }

  /**
   * Handle file change (create/modify/delete)
   */
  private handleFileChange(uri: vscode.Uri, action: 'create' | 'modify' | 'delete'): void {
    const filePath = uri.fsPath;
    
    // Ignore node_modules, dist, etc.
    if (this.shouldIgnore(filePath)) return;

    this.pendingChanges.add(filePath);
    this.debouncedNotify('file-change');
  }

  /**
   * Handle git index change (staging)
   */
  private handleGitIndexChange(): void {
    this.debouncedNotify('stage');
  }

  /**
   * Check if file should be ignored
   */
  private shouldIgnore(filePath: string): boolean {
    const ignorePaths = [
      'node_modules', 'dist', 'build', '.git', 
      'coverage', '.doc_sync', '__pycache__'
    ];
    return ignorePaths.some(p => filePath.includes(p));
  }

  /**
   * Debounced notification to prevent too many updates
   */
  private debouncedNotify(type: GitChangeType): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      const files = Array.from(this.pendingChanges);
      this.pendingChanges.clear();

      const event: GitChangeEvent = {
        type,
        files,
        timestamp: new Date()
      };

      this.notifyCallbacks(event);
    }, GitWatcher.DEBOUNCE_DELAY);
  }

  /**
   * Notify all registered callbacks
   */
  private notifyCallbacks(event: GitChangeEvent): void {
    for (const callback of this.callbacks) {
      try {
        callback(event);
      } catch (error) {
        console.error('Callback error:', error);
      }
    }
  }

  /**
   * Register a callback for git change events
   */
  onGitChange(callback: GitChangeCallback): vscode.Disposable {
    this.callbacks.push(callback);
    return new vscode.Disposable(() => {
      const index = this.callbacks.indexOf(callback);
      if (index >= 0) {
        this.callbacks.splice(index, 1);
      }
    });
  }

  /**
   * Get staged files from Git
   */
  async getStagedFiles(): Promise<string[]> {
    try {
      if (this.gitExtension?.isActive) {
        const git = this.gitExtension.exports.getAPI(1);
        const repo = git.repositories[0];
        if (repo) {
          const stagedChanges = repo.state.indexChanges;
          return stagedChanges.map((change: any) => change.uri.fsPath);
        }
      }
    } catch (error) {
      console.error('Failed to get staged files:', error);
    }
    return [];
  }

  /**
   * Get modified (unstaged) files from Git
   */
  async getModifiedFiles(): Promise<string[]> {
    try {
      if (this.gitExtension?.isActive) {
        const git = this.gitExtension.exports.getAPI(1);
        const repo = git.repositories[0];
        if (repo) {
          const workingChanges = repo.state.workingTreeChanges;
          return workingChanges.map((change: any) => change.uri.fsPath);
        }
      }
    } catch (error) {
      console.error('Failed to get modified files:', error);
    }
    return [];
  }

  /**
   * Get all changed files (staged + unstaged)
   */
  async getAllChangedFiles(): Promise<string[]> {
    const staged = await this.getStagedFiles();
    const modified = await this.getModifiedFiles();
    return [...new Set([...staged, ...modified])];
  }

  /**
   * Manually trigger a sync (on-demand update)
   */
  async triggerManualSync(): Promise<{
    success: boolean;
    changedFiles: number;
    message: string;
  }> {
    const changedFiles = await this.getAllChangedFiles();
    
    if (changedFiles.length === 0) {
      const pending = await this.incrementalUpdater.getPendingChanges();
      if (pending.changedCount === 0) {
        return {
          success: true,
          changedFiles: 0,
          message: 'No changes detected. Graph is up to date.'
        };
      }
    }

    // Notify about the changes
    this.notifyCallbacks({
      type: 'file-change',
      files: changedFiles,
      timestamp: new Date()
    });

    return {
      success: true,
      changedFiles: changedFiles.length,
      message: `Sync triggered for ${changedFiles.length} changed files.`
    };
  }

  /**
   * Check if watcher is active
   */
  isActive(): boolean {
    return this.isWatching;
  }

  /**
   * Get the branch manager instance
   */
  getBranchManager(): BranchAwareGraphManager {
    return this.branchManager;
  }

  /**
   * Get current branch name
   */
  async getCurrentBranch(): Promise<string> {
    return this.branchManager.getBranch();
  }

  /**
   * Get cached branches
   */
  getCachedBranches(): string[] {
    return this.branchManager.getCachedBranches();
  }

  /**
   * Save current branch state (for manual caching)
   */
  async saveBranchState(): Promise<void> {
    const branch = this.branchManager.getBranch();
    await this.branchManager.saveBranchState(branch);
  }

  /**
   * Dispose the watcher
   */
  dispose(): void {
    this.stopWatching();
    this.branchManagerDisposable?.dispose();
    this.branchManager.dispose();
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
  }
}

// Singleton instance
let watcherInstance: GitWatcher | null = null;

export function getGitWatcher(): GitWatcher {
  if (!watcherInstance) {
    watcherInstance = new GitWatcher();
  }
  return watcherInstance;
}
