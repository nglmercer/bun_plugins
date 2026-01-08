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

/**
 * Example usage:
 * 
 * // Convert class to arktype schema
 * const schema = await PluginTypeGenerator.convertClassToArkType("./plugins/MyPlugin.ts");
 * console.log(schema.schemaDefinition);
 * 
 * // Convert schema to TypeScript
 * const tsType = PluginTypeGenerator.convertArkTypeToTypeScript(schema);
 * console.log(tsType);
 */
