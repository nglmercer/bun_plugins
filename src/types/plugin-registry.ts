// Re-export types from the base plugin registry
// This file bridges the generated types with the plugin system

export type {
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
