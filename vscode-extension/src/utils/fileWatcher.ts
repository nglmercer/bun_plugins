/**
 * File Watcher for Automatic Type Regeneration
 * Monitors plugin files and directories for changes
 */

import * as fs from 'fs';
import * as path from 'path';
import { watchDirectory, fileExists } from './fileUtils';
import { PluginInfo } from './types';

export interface WatchOptions {
  debounceMs?: number;
  ignorePatterns?: RegExp[];
  onPluginsChanged?: (plugins: PluginInfo[]) => void | Promise<void>;
  onError?: (error: Error) => void;
  logger?: {
    info: (message: string) => void;
    warn: (message: string) => void;
    error: (message: string) => void;
  };
}

export interface WatcherHandle {
  stop: () => void;
  isWatching: () => boolean;
}

export class PluginFileWatcher {
  private watchers: Map<string, fs.FSWatcher> = new Map();
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private isRunning: boolean = false;
  private scanPluginsFn: (workspaceRoot: string) => Promise<PluginInfo[]>;

  constructor(
    scanPluginsFn: (workspaceRoot: string) => Promise<PluginInfo[]>
  ) {
    this.scanPluginsFn = scanPluginsFn;
  }

  /**
   * Starts watching a directory for plugin changes
   */
  startWatching(
    workspaceRoot: string,
    options: WatchOptions = {}
  ): WatcherHandle {
    const silentLogger = {
      info: () => {},
      warn: () => {},
      error: () => {}
    };
    
    const opts: Required<WatchOptions> = {
      debounceMs: 300,
      ignorePatterns: [
        /node_modules/,
        /\.git/,
        /dist/,
        /build/,
        /\.vscode/,
        /coverage/,
        /\.d\.ts$/,
        /\.test\./,
        /\.spec\./
      ],
      onPluginsChanged: async () => {},
      onError: (error) => (options.logger || silentLogger).error(`File watcher error: ${error.message}`),
      logger: options.logger || silentLogger,
      ...options
    };

    this.isRunning = true;

    // Watch plugins directory
    const pluginsDir = path.join(workspaceRoot, 'plugins');
    if (fileExists(pluginsDir)) {
      this.watchDirectory(pluginsDir, workspaceRoot, opts);
    } else {
      // Create plugins directory if it doesn't exist
      try {
        fs.mkdirSync(pluginsDir, { recursive: true });
        opts.logger.info(`Created plugins directory: ${pluginsDir}`);
        this.watchDirectory(pluginsDir, workspaceRoot, opts);
      } catch (error) {
        opts.onError(new Error(`Failed to create plugins directory: ${error instanceof Error ? error.message : String(error)}`));
      }
    }

    // Watch for tsconfig.json changes (optional)
    const tsconfigPath = path.join(workspaceRoot, 'tsconfig.json');
    if (fileExists(tsconfigPath)) {
      this.watchFile(tsconfigPath, workspaceRoot, opts);
    }

    return {
      stop: () => this.stopWatching(),
      isWatching: () => this.isRunning
    };
  }

  /**
   * Watches a directory recursively
   */
  private watchDirectory(
    dirPath: string,
    workspaceRoot: string,
    options: Required<WatchOptions>
  ): void {
    try {
      const watcher = watchDirectory(
        dirPath,
        (eventType, filename) => this.handleFileChange(dirPath, filename, workspaceRoot, options),
        true
      );

      if (watcher) {
        this.watchers.set(dirPath, watcher);
        options.logger.info(`👀 Watching directory: ${dirPath}`);
      }
    } catch (error) {
      options.onError(new Error(`Failed to watch ${dirPath}: ${error instanceof Error ? error.message : String(error)}`));
    }
  }

  /**
   * Watches a single file
   */
  private watchFile(
    filePath: string,
    workspaceRoot: string,
    options: Required<WatchOptions>
  ): void {
    try {
      const dir = path.dirname(filePath);
      const watcher = fs.watch(dir, (eventType, filename) => {
        if (filename === path.basename(filePath)) {
          this.handleFileChange(dir, filename, workspaceRoot, options);
        }
      });

      this.watchers.set(filePath, watcher);
      options.logger.info(`👀 Watching file: ${filePath}`);
    } catch (error) {
      options.onError(new Error(`Failed to watch ${filePath}: ${error instanceof Error ? error.message : String(error)}`));
    }
  }

  /**
   * Handles file change events with debouncing
   */
  private async handleFileChange(
    dirPath: string,
    filename: string | null,
    workspaceRoot: string,
    options: Required<WatchOptions>
  ): Promise<void> {
    if (!filename || !this.isRunning) return;

    const fullPath = path.join(dirPath, filename);

    // Only process TypeScript and JavaScript files
    if (!filename.endsWith('.ts') && !filename.endsWith('.js')) {
      return;
    }

    // Check ignore patterns
    const shouldIgnore = options.ignorePatterns.some(pattern =>
      pattern.test(fullPath) || pattern.test(filename)
    );

    if (shouldIgnore) return;

    // Debounce the change
    const key = `${dirPath}:${filename}`;
    
    if (this.debounceTimers.has(key)) {
      clearTimeout(this.debounceTimers.get(key)!);
    }

    const timer = setTimeout(async () => {
      options.logger.info(`📝 File changed: ${fullPath}`);
      
      try {
        // Verify file still exists before scanning
        if (!fs.existsSync(fullPath)) {
          options.logger.info(`File ${fullPath} no longer exists, skipping scan`);
          return;
        }

        // Scan for plugins
        const plugins = await this.scanPluginsFn(workspaceRoot);
        
        // Trigger callback
        if (options.onPluginsChanged) {
          await options.onPluginsChanged(plugins);
        }
      } catch (error) {
        options.onError(new Error(`Error handling file change for ${fullPath}: ${error instanceof Error ? error.message : String(error)}`));
      }
    }, options.debounceMs);

    this.debounceTimers.set(key, timer);
  }

  /**
   * Stops all watchers
   */
  stopWatching(): void {
    this.isRunning = false;

    // Clear all debounce timers
    this.debounceTimers.forEach((timer) => clearTimeout(timer));
    this.debounceTimers.clear();

    // Close all watchers
    this.watchers.forEach((watcher, path) => {
      try {
        watcher.close();
        console.log(`🛑 Stopped watching: ${path}`);
      } catch (error) {
        console.error(`Error closing watcher for ${path}:`, error);
      }
    });

    this.watchers.clear();
    console.log('✅ All file watchers stopped');
  }

  /**
   * Checks if currently watching any paths
   */
  isWatching(): boolean {
    return this.isRunning && this.watchers.size > 0;
  }

  /**
   * Gets the number of active watchers
   */
  getWatcherCount(): number {
    return this.watchers.size;
  }
}

/**
 * Creates a file watcher for automatic type regeneration
 */
export function createPluginWatcher(
  scanPluginsFn: (workspaceRoot: string) => Promise<PluginInfo[]>
): PluginFileWatcher {
  return new PluginFileWatcher(scanPluginsFn);
}

/**
 * Starts watching with automatic type regeneration
 */
export function startAutoRegeneration(
  workspaceRoot: string,
  scanPluginsFn: (workspaceRoot: string) => Promise<PluginInfo[]>,
  regenerateTypesFn: (plugins: PluginInfo[]) => Promise<void>,
  options: WatchOptions = {}
): WatcherHandle {
  const watcher = new PluginFileWatcher(scanPluginsFn);
  const silentLogger = {
    info: () => {},
    warn: () => {},
    error: () => {}
  };
  const logger = options.logger || silentLogger;

  return watcher.startWatching(workspaceRoot, {
    ...options,
    onPluginsChanged: async (plugins) => {
      try {
        logger.info(`🔄 Regenerating types for ${plugins.length} plugins...`);
        await regenerateTypesFn(plugins);
        logger.info('✅ Type regeneration complete');
        
        if (options.onPluginsChanged) {
          await options.onPluginsChanged(plugins);
        }
      } catch (error) {
        const errorMsg = `❌ Error regenerating types: ${error instanceof Error ? error.message : String(error)}`;
        logger.error(errorMsg);
        if (options.onError) {
          options.onError(error instanceof Error ? error : new Error(String(error)));
        }
      }
    }
  });
}
