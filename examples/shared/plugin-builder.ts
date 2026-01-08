/**
 * Declarative Plugin Builder
 * Provides a functional approach to create plugins without boilerplate
 */

import type { IPlugin, PluginContext } from "../../src/types";
import { ActionRegistry } from "./action-registry";

export interface PluginDefinition {
  name: string;
  version: string;
  description?: string;
  author?: string;
  defaultConfig?: Record<string, any>;
  actions?: any[];
  onLoad?: (context: PluginContext) => void | Promise<void>;
  onUnload?: () => void | Promise<void>;
  sharedApi?: any;
}

export interface ActionPluginDefinition extends PluginDefinition {
  registryName: string;
  actionCategories?: any[];
  customActions?: any[];
}

export interface StoragePluginDefinition extends PluginDefinition {
  storageOperations?: StorageOperation[];
}

export interface StorageOperation {
  type: 'get' | 'set' | 'delete' | 'clear';
  key: string;
  value?: any;
  defaultValue?: any;
  description?: string;
}

// Generic plugin builder
export const createPlugin = (def: PluginDefinition): IPlugin => ({
  name: def.name,
  version: def.version,
  description: def.description,
  author: def.author,
  defaultConfig: def.defaultConfig,

  async onLoad(context: PluginContext) {
    if (def.onLoad) {
      await def.onLoad(context);
    }
  },

  async onUnload() {
    if (def.onUnload) {
      await def.onUnload();
    }
  },

  getApi() {
    return def.sharedApi || { name: def.name, version: def.version };
  }
});

// Specialized builder for action registry plugins
export const createActionPlugin = (def: ActionPluginDefinition): IPlugin => {
  const registry = new ActionRegistry();
  
  return createPlugin({
    ...def,
    onLoad: async (context: PluginContext) => {
      // Register with central registry
      const centralRegistry = context.getPlugin(def.registryName) as ActionRegistry;
      if (centralRegistry) {
        // Register action categories
        def.actionCategories?.forEach(category => category.register(centralRegistry));
        
        // Register custom actions
        def.customActions?.forEach(action => centralRegistry.register(action));
        
        context.log.info(`Registered ${def.actionCategories?.length || 0} action categories`);
      }
      
      // Call custom onLoad if provided
      if (def.onLoad) {
        await def.onLoad(context);
      }
    },
    sharedApi: {
      name: def.name,
      version: def.version,
      actions: [
        ...(def.actionCategories?.flatMap(cat => cat.actions.map((a: any) => a.name)) || []),
        ...(def.customActions?.map(a => a.name) || [])
      ]
    }
  });
};

// Storage operation helpers
export const storageOps = {
  get: (key: string, defaultValue?: any): StorageOperation => ({
    type: 'get', key, defaultValue, description: `Get ${key}`
  }),
  set: (key: string, value: any): StorageOperation => ({
    type: 'set', key, value, description: `Set ${key}`
  }),
  delete: (key: string): StorageOperation => ({
    type: 'delete', key, description: `Delete ${key}`
  }),
  clear: (): StorageOperation => ({
    type: 'clear', key: '*', description: 'Clear all storage'
  })
};

// Demo runner utility
export const runDemo = async (name: string, demoFn: () => Promise<void>) => {
  console.log(`\n🚀 ${name}\n`);
  try {
    await demoFn();
    console.log(`\n✅ ${name} completed\n`);
  } catch (error) {
    console.error(`\n❌ ${name} failed:`, error);
  }
};