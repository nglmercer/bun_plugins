// Re-export types from the base plugin registry
// This file bridges the generated types with the plugin system

export type {
  BasePluginApi,
  PluginNames,
  PluginApiType,
  PluginClassType,
  GetPluginApi,
  GetPluginClass,
  IsValidPlugin,
  PluginFromFactory,
  PluginInstanceType,
  PluginFactory
} from "./plugin-registry-base";
