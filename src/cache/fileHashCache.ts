import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

/**
 * File hash entry for tracking changes
 */
export interface FileHashEntry {
  filePath: string;
  relativePath: string;
  hash: string;
  lastModified: number;
  size: number;
  nodeIds: string[]; // IDs of nodes generated from this file
}

/**
 * Change detection result
 */
export interface ChangeDetectionResult {
  added: string[];      // New files
  modified: string[];   // Changed files
  deleted: string[];    // Removed files
  unchanged: string[];  // Files with no changes
  totalFiles: number;
  changedCount: number;
}

/**
 * Cache metadata
 */
interface CacheMetadata {
  version: string;
  createdAt: string;
  lastUpdated: string;
  workspaceRoot: string;
  totalFiles: number;
}

/**
 * FileHashCache - Efficient change detection using content hashing
 * 
 * This system uses MD5 hashing to detect file changes efficiently:
 * - Only rehashes files if modification time has changed
 * - Stores hash cache in .doc_sync/cache/
 * - Supports incremental updates
 */
export class FileHashCache {
  private cacheDir: string = '';
  private hashCachePath: string = '';
  private metadataPath: string = '';
  private hashCache: Map<string, FileHashEntry> = new Map();
  private workspaceRoot: string = '';
  private isInitialized: boolean = false;

  private static readonly CACHE_VERSION = '1.0.0';
  private static readonly HASH_ALGORITHM = 'md5';

  /**
   * Initialize the cache for a workspace
   */
  async initialize(workspaceRoot: string): Promise<void> {
    this.workspaceRoot = workspaceRoot;
    this.cacheDir = path.join(workspaceRoot, '.doc_sync', 'cache');
    this.hashCachePath = path.join(this.cacheDir, 'file_hashes.json');
    this.metadataPath = path.join(this.cacheDir, 'cache_metadata.json');

    // Ensure cache directory exists
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }

    // Load existing cache
    await this.loadCache();
    this.isInitialized = true;
  }

  /**
   * Load cache from disk
   */
  private async loadCache(): Promise<void> {
    try {
      if (fs.existsSync(this.hashCachePath)) {
        const data = JSON.parse(fs.readFileSync(this.hashCachePath, 'utf-8'));
        
        // Check version compatibility
        if (data.version === FileHashCache.CACHE_VERSION) {
          this.hashCache = new Map(Object.entries(data.entries));
          console.log(`Loaded ${this.hashCache.size} cached file hashes`);
        } else {
          console.log('Cache version mismatch, rebuilding...');
          this.hashCache = new Map();
        }
      }
    } catch (error) {
      console.error('Failed to load hash cache:', error);
      this.hashCache = new Map();
    }
  }

  /**
   * Save cache to disk
   */
  async saveCache(): Promise<void> {
    try {
      const cacheData = {
        version: FileHashCache.CACHE_VERSION,
        entries: Object.fromEntries(this.hashCache)
      };
      fs.writeFileSync(this.hashCachePath, JSON.stringify(cacheData, null, 2));

      // Update metadata
      const metadata: CacheMetadata = {
        version: FileHashCache.CACHE_VERSION,
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        workspaceRoot: this.workspaceRoot,
        totalFiles: this.hashCache.size
      };
      fs.writeFileSync(this.metadataPath, JSON.stringify(metadata, null, 2));

      console.log(`Saved ${this.hashCache.size} file hashes to cache`);
    } catch (error) {
      console.error('Failed to save hash cache:', error);
    }
  }

  /**
   * Calculate MD5 hash of file content
   */
  private calculateFileHash(filePath: string): string {
    try {
      const content = fs.readFileSync(filePath);
      return crypto.createHash(FileHashCache.HASH_ALGORITHM).update(content).digest('hex');
    } catch (error) {
      console.error(`Failed to hash file ${filePath}:`, error);
      return '';
    }
  }

  /**
   * Get file stats
   */
  private getFileStats(filePath: string): { mtime: number; size: number } | null {
    try {
      const stats = fs.statSync(filePath);
      return {
        mtime: stats.mtimeMs,
        size: stats.size
      };
    } catch {
      return null;
    }
  }

  /**
   * Check if file has changed based on quick stat check
   */
  private hasFileChangedQuick(filePath: string, cached: FileHashEntry): boolean {
    const stats = this.getFileStats(filePath);
    if (!stats) return true; // File might have been deleted

    // Quick check using mtime and size
    return stats.mtime !== cached.lastModified || stats.size !== cached.size;
  }

  /**
   * Detect changes between current files and cached state
   */
  async detectChanges(currentFiles: string[]): Promise<ChangeDetectionResult> {
    const result: ChangeDetectionResult = {
      added: [],
      modified: [],
      deleted: [],
      unchanged: [],
      totalFiles: currentFiles.length,
      changedCount: 0
    };

    const currentFileSet = new Set(currentFiles);
    const cachedFilePaths = new Set(this.hashCache.keys());

    // Check for added and modified files
    for (const filePath of currentFiles) {
      const relativePath = path.relative(this.workspaceRoot, filePath);
      const cached = this.hashCache.get(filePath);

      if (!cached) {
        // New file
        result.added.push(filePath);
      } else if (this.hasFileChangedQuick(filePath, cached)) {
        // Might be modified - verify with hash
        const newHash = this.calculateFileHash(filePath);
        if (newHash !== cached.hash) {
          result.modified.push(filePath);
        } else {
          // Stats changed but content is same (e.g., touched)
          result.unchanged.push(filePath);
          // Update stats in cache
          const stats = this.getFileStats(filePath);
          if (stats) {
            cached.lastModified = stats.mtime;
            cached.size = stats.size;
          }
        }
      } else {
        result.unchanged.push(filePath);
      }
    }

    // Check for deleted files
    for (const cachedPath of cachedFilePaths) {
      if (!currentFileSet.has(cachedPath)) {
        result.deleted.push(cachedPath);
      }
    }

    result.changedCount = result.added.length + result.modified.length + result.deleted.length;
    return result;
  }

  /**
   * Update cache with new file entries
   */
  updateEntry(filePath: string, nodeIds: string[]): void {
    const stats = this.getFileStats(filePath);
    if (!stats) return;

    const hash = this.calculateFileHash(filePath);
    const relativePath = path.relative(this.workspaceRoot, filePath);

    this.hashCache.set(filePath, {
      filePath,
      relativePath,
      hash,
      lastModified: stats.mtime,
      size: stats.size,
      nodeIds
    });
  }

  /**
   * Remove entries for deleted files
   */
  removeEntry(filePath: string): string[] {
    const entry = this.hashCache.get(filePath);
    const nodeIds = entry?.nodeIds || [];
    this.hashCache.delete(filePath);
    return nodeIds;
  }

  /**
   * Get node IDs associated with a file
   */
  getNodeIds(filePath: string): string[] {
    return this.hashCache.get(filePath)?.nodeIds || [];
  }

  /**
   * Get hash for a specific file
   */
  async getFileHash(filePath: string): Promise<string | null> {
    const entry = this.hashCache.get(filePath);
    return entry?.hash || null;
  }

  /**
   * Set hash for a specific file (used for cache restoration)
   */
  async setFileHash(filePath: string, hash: string): Promise<void> {
    const stats = this.getFileStats(filePath);
    const relativePath = path.relative(this.workspaceRoot, filePath);
    
    const entry: FileHashEntry = {
      filePath,
      relativePath,
      hash,
      lastModified: stats?.mtime || Date.now(),
      size: stats?.size || 0,
      nodeIds: this.hashCache.get(filePath)?.nodeIds || []
    };
    
    this.hashCache.set(filePath, entry);
  }

  /**
   * Clear all cache
   */
  clearCache(): void {
    this.hashCache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): { totalFiles: number; cacheSize: number } {
    return {
      totalFiles: this.hashCache.size,
      cacheSize: this.hashCachePath && fs.existsSync(this.hashCachePath) 
        ? fs.statSync(this.hashCachePath).size 
        : 0
    };
  }

  /**
   * Check if cache is initialized
   */
  isReady(): boolean {
    return this.isInitialized;
  }
}

// Singleton instance
let cacheInstance: FileHashCache | null = null;

export function getFileHashCache(): FileHashCache {
  if (!cacheInstance) {
    cacheInstance = new FileHashCache();
  }
  return cacheInstance;
}
