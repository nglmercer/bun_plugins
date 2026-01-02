/**
 * Validation utilities for plugin type generation
 */

import { PluginInfo, PluginMethod, PluginProperty } from './types';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validates plugin information
 */
export function validatePluginInfo(plugin: PluginInfo): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate plugin name
  if (!plugin.name || plugin.name.trim().length === 0) {
    errors.push('Plugin name is required');
  } else if (!/^[a-z][a-z0-9-_]*$/i.test(plugin.name)) {
    errors.push(`Invalid plugin name: "${plugin.name}". Must start with a letter and contain only alphanumeric, hyphen, or underscore characters`);
  }

  // Validate file path
  if (!plugin.filePath || plugin.filePath.trim().length === 0) {
    errors.push('Plugin file path is required');
  }

  // Validate class name
  if (!plugin.className || plugin.className.trim().length === 0) {
    warnings.push('Plugin class name is missing');
  }

  // Validate methods
  if (plugin.methods && plugin.methods.length > 0) {
    plugin.methods.forEach((method, index) => {
      const methodErrors = validatePluginMethod(method);
      methodErrors.forEach(error => {
        errors.push(`Method [${index}]: ${error}`);
      });
    });
  }

  // Validate properties
  if (plugin.properties && plugin.properties.length > 0) {
    plugin.properties.forEach((property, index) => {
      const propErrors = validatePluginProperty(property);
      propErrors.forEach(error => {
        errors.push(`Property [${index}]: ${error}`);
      });
    });
  }

  // Check if plugin has any API (methods or properties)
  if (plugin.methods.length === 0 && (!plugin.properties || plugin.properties.length === 0)) {
    warnings.push(`Plugin "${plugin.name}" has no public methods or properties`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validates a plugin method
 */
export function validatePluginMethod(method: PluginMethod): string[] {
  const errors: string[] = [];

  if (!method.name || method.name.trim().length === 0) {
    errors.push('Method name is required');
  } else if (!/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(method.name)) {
    errors.push(`Invalid method name: "${method.name}"`);
  }

  if (!method.params || !Array.isArray(method.params)) {
    errors.push('Method params must be an array');
  }

  if (!method.returnType || method.returnType.trim().length === 0) {
    errors.push(`Method "${method.name}" has no return type`);
  }

  return errors;
}

/**
 * Validates a plugin property
 */
export function validatePluginProperty(property: PluginProperty): string[] {
  const errors: string[] = [];

  if (!property.name || property.name.trim().length === 0) {
    errors.push('Property name is required');
  } else if (!/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(property.name)) {
    errors.push(`Invalid property name: "${property.name}"`);
  }

  if (!property.type || property.type.trim().length === 0) {
    errors.push(`Property "${property.name}" has no type`);
  }

  return errors;
}

/**
 * Validates a list of plugins
 */
export function validatePlugins(plugins: PluginInfo[]): {
  valid: boolean;
  errors: string[];
  warnings: string[];
  pluginResults: Map<string, ValidationResult>;
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  const pluginResults = new Map<string, ValidationResult>();

  let hasValidPlugin = false;

  plugins.forEach((plugin, index) => {
    const result = validatePluginInfo(plugin);
    pluginResults.set(plugin.name, result);

    if (result.valid) {
      hasValidPlugin = true;
    }

    result.errors.forEach(error => {
      errors.push(`Plugin [${index}] "${plugin.name}": ${error}`);
    });

    result.warnings.forEach(warning => {
      warnings.push(`Plugin [${index}] "${plugin.name}": ${warning}`);
    });
  });

  if (!hasValidPlugin) {
    errors.push('No valid plugins found');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    pluginResults
  };
}

/**
 * Checks for duplicate plugin names
 */
export function findDuplicatePluginNames(plugins: PluginInfo[]): Map<string, PluginInfo[]> {
  const duplicates = new Map<string, PluginInfo[]>();
  const nameMap = new Map<string, PluginInfo[]>();

  plugins.forEach(plugin => {
    const name = plugin.name.toLowerCase();
    if (!nameMap.has(name)) {
      nameMap.set(name, []);
    }
    nameMap.get(name)!.push(plugin);
  });

  nameMap.forEach((pluginList, name) => {
    if (pluginList.length > 1) {
      duplicates.set(name, pluginList);
    }
  });

  return duplicates;
}

/**
 * Validates TypeScript type names
 */
export function isValidTypeName(name: string): boolean {
  return /^[A-Z][a-zA-Z0-9_$]*$/.test(name);
}

/**
 * Sanitizes a string for use in TypeScript
 */
export function sanitizeForTs(str: string): string {
  return str.replace(/[^a-zA-Z0-9_$]/g, '_');
}

/**
 * Checks if a method signature is valid TypeScript
 */
export function isValidMethodSignature(params: string[], returnType: string): boolean {
  // Check return type
  if (!isValidType(returnType)) {
    return false;
  }

  // Check each parameter
  for (const param of params) {
    const parts = param.split(':').map(p => p.trim());
    if (parts.length < 2) {
      return false;
    }
    if (!isValidType(parts[1])) {
      return false;
    }
  }

  return true;
}

/**
 * Validates a TypeScript type
 */
export function isValidType(type: string): boolean {
  const trimmed = type.trim();
  if (trimmed.length === 0) return false;

  // Basic type validation - can be extended
  const validTypes = [
    'any', 'void', 'never', 'unknown',
    'string', 'number', 'boolean', 'object', 'symbol',
    'null', 'undefined'
  ];

  if (validTypes.includes(trimmed)) return true;

  // Check for array types
  if (trimmed.endsWith('[]')) {
    const baseType = trimmed.slice(0, -2);
    return isValidType(baseType);
  }

  // Check for Array<T> syntax
  const arrayMatch = trimmed.match(/^Array<(.+)>$/);
  if (arrayMatch) {
    return isValidType(arrayMatch[1]);
  }

  // Check for Record<K, V> syntax
  const recordMatch = trimmed.match(/^Record<.+?,.+?>$/);
  if (recordMatch) return true;

  // Check for Map<K, V> syntax
  const mapMatch = trimmed.match(/^Map<.+?,.+?>$/);
  if (mapMatch) return true;

  // Check for Set<T> syntax
  const setMatch = trimmed.match(/^Set<(.+)>$/);
  if (setMatch) {
    return isValidType(setMatch[1]);
  }

  // Check for Promise<T> syntax
  const promiseMatch = trimmed.match(/^Promise<(.+)>$/);
  if (promiseMatch) {
    return isValidType(promiseMatch[1]);
  }

  // Assume it's a valid interface or class name
  return /^[A-Z][a-zA-Z0-9_$]*(<.+>)?$/.test(trimmed);
}
