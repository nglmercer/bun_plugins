// Re-export types from generated plugin registry
// This file bridges the generated types with the plugin system

import type { IPlugin } from "../types";

/**
 * Plugin name type - union of all discovered plugin names
 */
export type PluginNames = string;

/**
 * Get the instance type for a plugin by name
 */
export type PluginInstanceType<T extends PluginNames> = T extends T ? IPlugin : IPlugin;

/**
 * Plugin factory map type - maps plugin names to their instance types
 */
export interface PluginFactoryMap {
  [key: string]: {
    name: string;
    version: string;
    instance: IPlugin;
    api: unknown;
  };
}
