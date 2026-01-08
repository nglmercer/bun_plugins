/**
 * Base types for plugin registry that can be extended by users using declaration merging.
 * This solves the issue where published libraries can't know about user's plugins.
 */

import type { IPlugin } from "../types";

/**
 * Base API interface that all plugins extend.
 * Users can extend this interface with their own plugin APIs.
 */
export interface BasePluginApi {
  name: string;
  version: string;
  actions?: string[];
  type?: string;
  loaded?: string;
}

/**
 * Plugin factory map - users can extend this with their own plugins.
 *
 * This interface is extended by:
 * 1. The generator (adds built-in plugins from the library)
 * 2. Users (adds their custom plugins via declaration merging)
 *
 * Example of how users extend this:
 * ```typescript
 * declare module "bun_plugins" {
 *   export interface PluginFactory {
 *     "my-custom-plugin": {
 *       name: "my-custom-plugin";
 *       version: "1.0.0";
 *       class: MyCustomPlugin;
 *       api: MyCustomPluginApi;
 *     };
 *   }
 * }
 * ```
 */
export interface PluginFactory {
  // This interface is extended by the generator and by users
  // It starts empty and gets populated via declaration merging
}

/**
 * Union type of all plugin names.
 * This is dynamically computed from PluginFactory keys.
 */
export type PluginNames = keyof PluginFactory;

/**
 * Get the API type for a specific plugin.
 * Falls back to BasePluginApi if the plugin is not found.
 */
export type PluginApiType<T extends string> = 
  T extends keyof PluginFactory 
    ? PluginFactory[T]["api"]
    : BasePluginApi;

/**
 * Get the class type for a specific plugin.
 * Falls back to IPlugin if the plugin is not found.
 */
export type PluginClassType<T extends string> = 
  T extends keyof PluginFactory 
    ? PluginFactory[T]["class"]
    : IPlugin;

/**
 * Get the API type for a specific plugin.
 */
export type GetPluginApi<T extends string> = PluginApiType<T>;

/**
 * Get the class type for a specific plugin.
 */
export type GetPluginClass<T extends string> = PluginClassType<T>;

/**
 * Helper to check if a plugin name is valid.
 * Returns true if the plugin is in PluginFactory.
 */
export type IsValidPlugin<T extends string> = T extends PluginNames ? true : false;

/**
 * Type-safe plugin retrieval from the factory.
 */
export type PluginFromFactory<T extends PluginNames> = PluginFactory[T];

/**
 * Plugin instance type - combines class and API types.
 */
export type PluginInstanceType<T extends string> = 
  T extends keyof PluginFactory 
    ? PluginFactory[T]["class"]
    : IPlugin;
