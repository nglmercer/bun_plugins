/**
 * Utility functions for TypeScript type generation
 */

/**
 * Converts a plugin name to a TypeScript interface name
 * Examples: "math-plugin" -> "MathPluginApi", "edge-tts" -> "EdgeTtsApi"
 */
export function pluginNameToInterfaceName(pluginName: string): string {
  return pluginName
    .split(/[-_]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('') + 'Api';
}

/**
 * Validates if an interface name follows the expected pattern
 */
export function isValidApiInterface(interfaceName: string): boolean {
  return interfaceName.endsWith('PluginApi') || interfaceName.endsWith('Api');
}

/**
 * Extracts the plugin name from an interface name
 * Examples: "MathPluginApi" -> "math-plugin", "EdgeTtsApi" -> "edge-tts"
 */
export function interfaceNameToPluginName(interfaceName: string): string {
  // Remove 'Api' suffix
  const nameWithoutApi = interfaceName.replace(/Api$/, '');
  
  // Convert camelCase to kebab-case
  return nameWithoutApi
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
}

/**
 * Generates a type-safe import statement for a plugin interface
 */
export function generateImportStatement(pluginName: string, interfaceName: string, filePath: string): string {
  const relativePath = getRelativeTypePath(filePath);
  return `export { ${interfaceName} } from '${relativePath}';`;
}

/**
 * Gets the relative path for type imports from a plugin file
 */
export function getRelativeTypePath(filePath: string): string {
  const pathParts = filePath.split(/[/\\]/);
  const fileName = pathParts[pathParts.length - 1].replace(/\.(ts|js)$/, '');
  
  // Check if there's a subdirectory structure
  const pluginsIndex = pathParts.lastIndexOf('plugins');
  if (pluginsIndex !== -1 && pluginsIndex < pathParts.length - 2) {
    // Plugin is in a subdirectory
    const subPath = pathParts.slice(pluginsIndex + 1, -1).join('/');
    return `./${subPath}/${fileName}`;
  }
  
  return `./${fileName}`;
}

/**
 * Formats TypeScript type with proper escaping
 */
export function formatType(type: string): string {
  return type.trim() || 'any';
}

/**
 * Formats a method signature for TypeScript
 */
export function formatMethodSignature(name: string, params: string[], returnType: string): string {
  const formattedParams = params.map(formatType).join(', ');
  return `${name}(${formattedParams}): ${formatType(returnType)};`;
}

/**
 * Formats a property signature for TypeScript
 */
export function formatPropertySignature(name: string, type: string, optional: boolean = false): string {
  return `${name}${optional ? '?' : ''}: ${formatType(type)};`;
}

/**
 * Validates if a method name is a lifecycle method that should be excluded
 */
export function isLifecycleMethod(methodName: string): boolean {
  const lifecycleMethods = ['onLoad', 'onUnload', 'setup', 'onReload', 'onStarted', 'configure'];
  return lifecycleMethods.includes(methodName);
}

/**
 * Generates JSDoc comment from documentation text
 */
export function generateJsDoc(doc?: string, indent: string = ''): string {
  if (!doc || !doc.trim()) return '';
  
  const lines = doc.trim().split('\n');
  if (lines.length === 1) {
    return `${indent}/** ${lines[0]} */\n`;
  }
  
  return `${indent}/**\n${indent} * ${lines.join(`\n${indent} * `)}\n${indent} */\n`;
}

/**
 * Validates plugin name format
 */
export function validatePluginName(name: string): boolean {
  return /^[a-z][a-z0-9-_]*$/i.test(name);
}

/**
 * Sanitizes a plugin name for use in code
 */
export function sanitizePluginName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, '');
}
