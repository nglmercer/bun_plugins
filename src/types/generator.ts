/**
 * Modular type generator for plugins.
 * This module re-exports all types and generators from the modularized files.
 */

// Re-export interfaces
export type {
  PluginTypeInfo,
  ArkTypeSchemaInfo,
  PropertyInfo,
  MethodParamInfo,
  GeneratorOptions
} from "./interfaces";

// Re-export ArkTypeConverter
export { ArkTypeConverter } from "./arktype_converter";

// Re-export PluginTypeGenerator
export { PluginTypeGenerator, generatePluginTypes } from "./plugin_generator";

// Re-export base plugin registry types
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