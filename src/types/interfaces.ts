/**
 * Type definitions for the plugin type generator system.
 */

/**
 * Information about a plugin's type metadata.
 */
export interface PluginTypeInfo {
  name: string;
  version: string;
  className: string;
  filePath: string;
  isTypeScript: boolean;
  apiInterface?: string;
  dependencies?: Record<string, string>;
  arkTypeSchema?: ArkTypeSchemaInfo;
}

/**
 * Information about an ArkType schema derived from a class.
 */
export interface ArkTypeSchemaInfo {
  schemaName: string;
  schemaDefinition: string;
  typeDefinition: string;
  properties: PropertyInfo[];
}

/**
 * Information about a property extracted from a class.
 */
export interface PropertyInfo {
  name: string;
  type: string;
  isOptional: boolean;
  isArray: boolean;
  nestedType?: ArkTypeSchemaInfo;
  isMethod?: boolean;
  params?: MethodParamInfo[];
}

/**
 * Information about a method parameter.
 */
export interface MethodParamInfo {
  name: string;
  type: string;
  isOptional: boolean;
}

/**
 * Options for the generator.
 */
export interface GeneratorOptions {
  pluginsDir: string;
  outputDir: string;
  baseApiInterface?: string;
  packageName?: string;
}
