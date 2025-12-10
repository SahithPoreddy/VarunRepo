import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Hook types supported by the GitHooksManager
 */
export type GitHookType = 
  | 'pre-commit'
  | 'post-commit'
  | 'post-checkout'
  | 'post-merge'
  | 'pre-push';

/**
 * Configuration for a git hook
 */
export interface GitHookConfig {
  type: GitHookType;
  enabled: boolean;
  script: string;
}

/**
 * GitHooksManager - Manages Git hooks for the Codebase Visualizer extension
 * 
 * This manager:
 * 1. Can install hooks in the user's .git/hooks folder
 * 2. Supports post-commit, post-checkout, post-merge hooks
 * 3. Notifies the extension when git operations occur
 * 4. Uses VS Code's file system to detect hook triggers
 */
export class GitHooksManager {
  private workspaceRoot: string = '';
  private gitPath: string = '';
  private hooksPath: string = '';
  private isInitialized: boolean = false;
  private hookMarker: string = '# Codebase-Visualizer-Hook';
  
  // Event emitter for hook triggers
  private onHookTriggeredEmitter = new vscode.EventEmitter<{ type: GitHookType; files?: string[] }>();
  public readonly onHookTriggered = this.onHookTriggeredEmitter.event;

  /**
   * Initialize the hooks manager
   */
  async initialize(workspaceRoot: string): Promise<boolean> {
    this.workspaceRoot = workspaceRoot;
    this.gitPath = path.join(workspaceRoot, '.git');
    this.hooksPath = path.join(this.gitPath, 'hooks');

    // Check if this is a git repository
    if (!fs.existsSync(this.gitPath)) {
      console.log('Not a git repository, hooks manager disabled');
      return false;
    }

    // Create hooks directory if it doesn't exist
    if (!fs.existsSync(this.hooksPath)) {
      try {
        fs.mkdirSync(this.hooksPath, { recursive: true });
      } catch (error) {
        console.error('Failed to create hooks directory:', error);
        return false;
      }
    }

    this.isInitialized = true;
    console.log('GitHooksManager initialized');
    return true;
  }

  /**
   * Install a git hook
   */
  async installHook(hookType: GitHookType): Promise<boolean> {
    if (!this.isInitialized) {
      console.error('GitHooksManager not initialized');
      return false;
    }

    const hookPath = path.join(this.hooksPath, hookType);
    const hookScript = this.generateHookScript(hookType);

    try {
      // Check if hook already exists
      let existingContent = '';
      if (fs.existsSync(hookPath)) {
        existingContent = fs.readFileSync(hookPath, 'utf8');
        
        // Check if our hook is already installed
        if (existingContent.includes(this.hookMarker)) {
          console.log(`Hook ${hookType} already installed`);
          return true;
        }
        
        // Append our hook to existing content
        const newContent = existingContent.trim() + '\n\n' + hookScript;
        fs.writeFileSync(hookPath, newContent, { mode: 0o755 });
      } else {
        // Create new hook file
        fs.writeFileSync(hookPath, hookScript, { mode: 0o755 });
      }

      console.log(`Installed ${hookType} hook`);
      return true;
    } catch (error) {
      console.error(`Failed to install ${hookType} hook:`, error);
      return false;
    }
  }

  /**
   * Uninstall a git hook
   */
  async uninstallHook(hookType: GitHookType): Promise<boolean> {
    if (!this.isInitialized) {
      return false;
    }

    const hookPath = path.join(this.hooksPath, hookType);

    try {
      if (!fs.existsSync(hookPath)) {
        return true; // Already uninstalled
      }

      let content = fs.readFileSync(hookPath, 'utf8');
      
      // Remove our hook section
      const startMarker = this.hookMarker;
      const endMarker = `${this.hookMarker}-end`;
      
      const startIdx = content.indexOf(startMarker);
      if (startIdx === -1) {
        return true; // Our hook isn't installed
      }

      const endIdx = content.indexOf(endMarker);
      if (endIdx !== -1) {
        content = content.slice(0, startIdx) + content.slice(endIdx + endMarker.length);
      } else {
        // Remove from marker to end
        content = content.slice(0, startIdx);
      }

      content = content.trim();

      if (content === '#!/bin/sh' || content === '#!/bin/bash' || !content) {
        // Remove empty hook file
        fs.unlinkSync(hookPath);
      } else {
        fs.writeFileSync(hookPath, content, { mode: 0o755 });
      }

      console.log(`Uninstalled ${hookType} hook`);
      return true;
    } catch (error) {
      console.error(`Failed to uninstall ${hookType} hook:`, error);
      return false;
    }
  }

  /**
   * Install all recommended hooks
   */
  async installAllHooks(): Promise<{ success: GitHookType[]; failed: GitHookType[] }> {
    const hooks: GitHookType[] = ['post-commit', 'post-checkout', 'post-merge'];
    const success: GitHookType[] = [];
    const failed: GitHookType[] = [];

    for (const hook of hooks) {
      const result = await this.installHook(hook);
      if (result) {
        success.push(hook);
      } else {
        failed.push(hook);
      }
    }

    return { success, failed };
  }

  /**
   * Uninstall all hooks
   */
  async uninstallAllHooks(): Promise<void> {
    const hooks: GitHookType[] = ['post-commit', 'post-checkout', 'post-merge', 'pre-commit', 'pre-push'];
    
    for (const hook of hooks) {
      await this.uninstallHook(hook);
    }
  }

  /**
   * Check which hooks are installed
   */
  getInstalledHooks(): GitHookType[] {
    if (!this.isInitialized) {
      return [];
    }

    const installedHooks: GitHookType[] = [];
    const hookTypes: GitHookType[] = ['pre-commit', 'post-commit', 'post-checkout', 'post-merge', 'pre-push'];

    for (const hookType of hookTypes) {
      const hookPath = path.join(this.hooksPath, hookType);
      if (fs.existsSync(hookPath)) {
        const content = fs.readFileSync(hookPath, 'utf8');
        if (content.includes(this.hookMarker)) {
          installedHooks.push(hookType);
        }
      }
    }

    return installedHooks;
  }

  /**
   * Generate hook script content
   */
  private generateHookScript(hookType: GitHookType): string {
    const shebang = '#!/bin/sh';
    const timestamp = new Date().toISOString();
    
    // Different actions based on hook type
    let action = '';
    switch (hookType) {
      case 'post-commit':
        action = `
# Notify extension about the commit
if [ -n "\${VSCODE_GIT_HOOK_NOTIFIER:-}" ]; then
  echo "codebase-visualizer:post-commit:$(git rev-parse HEAD)" > "$VSCODE_GIT_HOOK_NOTIFIER"
fi
`;
        break;
        
      case 'post-checkout':
        action = `
# Notify extension about branch/file checkout
# $1 = previous HEAD, $2 = new HEAD, $3 = flag (1 if branch checkout)
if [ "$3" = "1" ]; then
  current_branch=$(git branch --show-current)
  echo "Branch checkout detected: $current_branch"
  if [ -n "\${VSCODE_GIT_HOOK_NOTIFIER:-}" ]; then
    echo "codebase-visualizer:post-checkout:$current_branch" > "$VSCODE_GIT_HOOK_NOTIFIER"
  fi
fi
`;
        break;
        
      case 'post-merge':
        action = `
# Notify extension about merge
merge_head=$(cat .git/MERGE_HEAD 2>/dev/null || echo "none")
if [ -n "\${VSCODE_GIT_HOOK_NOTIFIER:-}" ]; then
  echo "codebase-visualizer:post-merge:$merge_head" > "$VSCODE_GIT_HOOK_NOTIFIER"
fi
`;
        break;
        
      case 'pre-commit':
        action = `
# Run before commit - extension can validate files
echo "Codebase Visualizer: Pre-commit hook running..."
`;
        break;
        
      case 'pre-push':
        action = `
# Run before push - extension can perform final checks
echo "Codebase Visualizer: Pre-push hook running..."
`;
        break;
    }

    return `${shebang}
${this.hookMarker}
# Installed by Codebase Visualizer extension on ${timestamp}
# This hook notifies the extension about git operations
${action}
${this.hookMarker}-end
`;
  }

  /**
   * Watch for hook trigger file changes (alternative notification method)
   */
  startWatchingHookTriggers(): vscode.Disposable {
    // Create a trigger file that hooks can write to
    const triggerFile = path.join(this.gitPath, '.codebase-visualizer-trigger');
    
    // Set up environment variable for hook scripts
    process.env.VSCODE_GIT_HOOK_NOTIFIER = triggerFile;
    
    // Watch for trigger file changes
    const watcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(this.gitPath, '.codebase-visualizer-trigger')
    );
    
    watcher.onDidChange(async () => {
      await this.processTriggerFile(triggerFile);
    });
    
    watcher.onDidCreate(async () => {
      await this.processTriggerFile(triggerFile);
    });
    
    return watcher;
  }

  /**
   * Process the trigger file written by hooks
   */
  private async processTriggerFile(triggerFile: string): Promise<void> {
    try {
      if (!fs.existsSync(triggerFile)) return;
      
      const content = fs.readFileSync(triggerFile, 'utf8').trim();
      
      // Parse trigger: format is "codebase-visualizer:hook-type:data"
      const match = content.match(/^codebase-visualizer:([\w-]+):(.*)$/);
      if (match) {
        const hookType = match[1] as GitHookType;
        const data = match[2];
        
        console.log(`Hook triggered: ${hookType} with data: ${data}`);
        this.onHookTriggeredEmitter.fire({ type: hookType });
      }
      
      // Clean up trigger file
      fs.unlinkSync(triggerFile);
    } catch (error) {
      // Ignore errors reading trigger file
    }
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.onHookTriggeredEmitter.dispose();
  }
}

// Singleton instance
let hooksManagerInstance: GitHooksManager | undefined;

export function getHooksManager(): GitHooksManager {
  if (!hooksManagerInstance) {
    hooksManagerInstance = new GitHooksManager();
  }
  return hooksManagerInstance;
}
