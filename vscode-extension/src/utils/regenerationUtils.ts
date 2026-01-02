/**
 * Type Regeneration Utilities
 * Handles automatic regeneration logic and state management
 */

import * as fs from 'fs';
import * as path from 'path';
import { PluginInfo } from './types';
import { fileExists } from './fileUtils';

export interface RegenerationState {
  lastRegeneration: Date | null;
  plugins: Map<string, { info: PluginInfo; timestamp: Date }>;
  isRegenerating: boolean;
  pendingChanges: Set<string>;
}

export interface RegenerationOptions {
  debounceMs?: number;
  maxRetries?: number;
  retryDelayMs?: number;
  onBeforeRegenerate?: () => void;
  onAfterRegenerate?: (success: boolean, duration: number) => void;
  onError?: (error: Error) => void;
}

export class TypeRegenerationManager {
  private state: RegenerationState;
  private regenerateFn: (plugins: PluginInfo[]) => Promise<void>;
  private debounceTimer: NodeJS.Timeout | null = null;
  private retryCount: number = 0;
  private options: RegenerationOptions;

  constructor(
    regenerateFn: (plugins: PluginInfo[]) => Promise<void>,
    options: RegenerationOptions = {}
  ) {
    this.regenerateFn = regenerateFn;
    this.options = options;
    this.state = {
      lastRegeneration: null,
      plugins: new Map(),
      isRegenerating: false,
      pendingChanges: new Set()
    };
  }

  /**
   * Triggers type regeneration with debouncing
   */
  async triggerRegeneration(
    plugins: PluginInfo[],
    options: RegenerationOptions = {}
  ): Promise<void> {
    const opts: Required<RegenerationOptions> = {
      debounceMs: 300,
      maxRetries: 3,
      retryDelayMs: 1000,
      onBeforeRegenerate: () => {},
      onAfterRegenerate: () => {},
      onError: (error) => console.error('Regeneration error:', error),
      ...options
    };

    // Clear existing debounce timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    // Set new debounce timer
    return new Promise((resolve, reject) => {
      this.debounceTimer = setTimeout(async () => {
        try {
          await this.performRegeneration(plugins, opts);
          resolve();
        } catch (error) {
          reject(error);
        }
      }, opts.debounceMs);
    });
  }

  /**
   * Performs the actual regeneration with retry logic
   */
  private async performRegeneration(
    plugins: PluginInfo[],
    options: Required<RegenerationOptions>
  ): Promise<void> {
    if (this.state.isRegenerating) {
      console.log('⏳ Regeneration already in progress, queuing...');
      return;
    }

    const startTime = Date.now();
    this.state.isRegenerating = true;
    this.retryCount = 0;

    options.onBeforeRegenerate();

    try {
      await this.regenerateWithRetry(plugins, options);
      
      const duration = Date.now() - startTime;
      this.state.lastRegeneration = new Date();
      
      // Update plugin state
      this.state.plugins.clear();
      plugins.forEach(plugin => {
        this.state.plugins.set(plugin.name, {
          info: plugin,
          timestamp: new Date()
        });
      });

      this.state.pendingChanges.clear();
      options.onAfterRegenerate(true, duration);
      
      console.log(`✅ Types regenerated successfully in ${duration}ms`);
    } catch (error) {
      const duration = Date.now() - startTime;
      options.onAfterRegenerate(false, duration);
      options.onError(error instanceof Error ? error : new Error(String(error)));
      throw error;
    } finally {
      this.state.isRegenerating = false;
    }
  }

  /**
   * Regenerates with retry logic
   */
  private async regenerateWithRetry(
    plugins: PluginInfo[],
    options: Required<RegenerationOptions>
  ): Promise<void> {
    while (this.retryCount < options.maxRetries) {
      try {
        await this.regenerateFn(plugins);
        return;
      } catch (error) {
        this.retryCount++;
        
        if (this.retryCount >= options.maxRetries) {
          throw new Error(
            `Failed to regenerate types after ${options.maxRetries} attempts: ` +
            (error instanceof Error ? error.message : String(error))
          );
        }

        console.warn(
          `⚠️  Regeneration attempt ${this.retryCount} failed, retrying in ${options.retryDelayMs}ms...`
        );
        
        await new Promise(resolve => setTimeout(resolve, options.retryDelayMs));
      }
    }
  }

  /**
   * Marks a plugin file as changed (pending regeneration)
   */
  markPluginChanged(pluginName: string): void {
    this.state.pendingChanges.add(pluginName);
  }

  /**
   * Gets the current regeneration state
   */
  getState(): Readonly<RegenerationState> {
    return {
      lastRegeneration: this.state.lastRegeneration,
      plugins: new Map(this.state.plugins),
      isRegenerating: this.state.isRegenerating,
      pendingChanges: new Set(this.state.pendingChanges)
    };
  }

  /**
   * Gets the last regeneration time
   */
  getLastRegenerationTime(): Date | null {
    return this.state.lastRegeneration;
  }

  /**
   * Checks if a plugin has been regenerated since a given time
   */
  isPluginFresh(pluginName: string, since: Date): boolean {
    const pluginState = this.state.plugins.get(pluginName);
    if (!pluginState) return false;
    return pluginState.timestamp >= since;
  }

  /**
   * Gets pending changes count
   */
  getPendingChangesCount(): number {
    return this.state.pendingChanges.size;
  }

  /**
   * Clears the state
   */
  clearState(): void {
    this.state.lastRegeneration = null;
    this.state.plugins.clear();
    this.state.pendingChanges.clear();
    this.retryCount = 0;
  }
}

/**
 * Loads regeneration state from a file
 */
export function loadRegenerationState(
  workspaceRoot: string,
  typesDir: string = '.bun-plugins-types'
): RegenerationState | null {
  const statePath = path.join(workspaceRoot, typesDir, '.regeneration-state.json');
  
  if (!fileExists(statePath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(statePath, 'utf-8');
    const data = JSON.parse(content);
    
    return {
      lastRegeneration: data.lastRegeneration ? new Date(data.lastRegeneration) : null,
      plugins: new Map(
        Object.entries(data.plugins || {}).map(([name, value]: [string, any]) => [
          name,
          { info: value.info, timestamp: new Date(value.timestamp) }
        ])
      ),
      isRegenerating: false,
      pendingChanges: new Set(data.pendingChanges || [])
    };
  } catch (error) {
    console.error('Error loading regeneration state:', error);
    return null;
  }
}

/**
 * Saves regeneration state to a file
 */
export function saveRegenerationState(
  workspaceRoot: string,
  state: RegenerationState,
  typesDir: string = '.bun-plugins-types'
): boolean {
  const typesPath = path.join(workspaceRoot, typesDir);
  const statePath = path.join(typesPath, '.regeneration-state.json');

  try {
    if (!fs.existsSync(typesPath)) {
      fs.mkdirSync(typesPath, { recursive: true });
    }

    const data = {
      lastRegeneration: state.lastRegeneration?.toISOString() || null,
      plugins: Object.fromEntries(
        Array.from(state.plugins.entries()).map(([name, value]) => [
          name,
          {
            info: value.info,
            timestamp: value.timestamp.toISOString()
          }
        ])
      ),
      pendingChanges: Array.from(state.pendingChanges)
    };

    fs.writeFileSync(statePath, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error('Error saving regeneration state:', error);
    return false;
  }
}

/**
 * Checks if types need to be regenerated based on file modification times
 */
export function needsRegeneration(
  workspaceRoot: string,
  plugins: PluginInfo[],
  typesDir: string = '.bun-plugins-types'
): boolean {
  const typesPath = path.join(workspaceRoot, typesDir);
  
  // No types directory exists - need to regenerate
  if (!fs.existsSync(typesPath)) {
    console.log('📝 Types directory does not exist');
    return true;
  }

  // Check if required files exist
  const requiredFiles = [
    path.join(typesPath, 'plugin-types.d.ts'),
    path.join(typesPath, 'global.d.ts')
  ];
  
  for (const requiredFile of requiredFiles) {
    if (!fs.existsSync(requiredFile)) {
      console.log(`📝 Required type file missing: ${path.basename(requiredFile)}`);
      return true;
    }
  }

  const lastRegeneration = loadRegenerationState(workspaceRoot, typesDir);

  // No previous regeneration state - need to regenerate
  if (!lastRegeneration || !lastRegeneration.lastRegeneration) {
    console.log('📝 No previous regeneration state found');
    return true;
  }

  const lastRegenTime = lastRegeneration.lastRegeneration.getTime();

  // Check if any plugin file was modified after last regeneration
  for (const plugin of plugins) {
    try {
      const stats = fs.statSync(plugin.filePath);
      if (stats.mtime.getTime() > lastRegenTime) {
        console.log(`📝 Plugin file modified: ${plugin.name}`);
        return true;
      }
    } catch (error) {
      // File doesn't exist, should regenerate
      console.log(`📝 Plugin file missing: ${plugin.name}`);
      return true;
    }
  }

  return false;
}

/**
 * Creates a regeneration manager with state persistence
 */
export function createPersistentRegenerationManager(
  workspaceRoot: string,
  regenerateFn: (plugins: PluginInfo[]) => Promise<void>,
  options: RegenerationOptions = {}
): TypeRegenerationManager {
  const originalAfterRegenerate = options.onAfterRegenerate;

  // Create manager with modified options to save state
  const manager = new TypeRegenerationManager(regenerateFn, {
    ...options,
    onAfterRegenerate: (success: boolean, duration: number) => {
      if (success) {
        const state = manager.getState();
        saveRegenerationState(workspaceRoot, state);
      }
      if (originalAfterRegenerate) {
        originalAfterRegenerate(success, duration);
      }
    }
  });

  // Load initial state
  const savedState = loadRegenerationState(workspaceRoot);
  if (savedState) {
    console.log('📂 Loaded previous regeneration state');
  }

  return manager;
}
