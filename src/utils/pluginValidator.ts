import { z } from "zod";
import type { IPlugin } from "../types";
import { errorParser } from "../utils/errorParser";

// Internal schemas - NOT exported to avoid Zod type leakage
const pluginSchemaDefinition = z.object({
  name: z.string().min(1, "Plugin name is required"),
  version: z.string().min(1, "Plugin version is required").default("1.0.0"),
  description: z.string().optional(),
  author: z.string().optional(),
  
  configSchema: z.any().optional(), // We accept any Zod-like object here
  defaultConfig: z.record(z.string(), z.any()).optional(),
  
  dependencies: z.record(z.string(), z.string()).optional(),
  permissions: z.array(z.enum(['network', 'filesystem', 'env'])).optional(),
  allowedDomains: z.array(z.string()).optional(),
  
  engines: z.object({
      host: z.string().optional(),
  }).optional(),
  
  onLoad: z.function(),
  onStarted: z.function().optional(),
  onUnload: z.function().optional(),
  getApi: z.function().optional(),
  setup: z.function().optional(),
});

export type ValidationResult = 
  | { valid: true; plugin: IPlugin }
  | { valid: false; error: string };

/**
 * Validates if an unknown object is a valid plugin.
 * Handles:
 * 1. Class instances (Standard)
 * 2. Plain objects
 * 3. Class Constructors (instantiates them) // TODO if we want to move that logic here
 */
export function validatePlugin(candidate: unknown): ValidationResult {
  try {
    // If it's a class constructor (function), try to instantiate it
    if (typeof candidate === 'function' && candidate.prototype) {
        // We can't easily instantiate it without knowing if it needs args, 
        // but our convention is 0-arg constructor for plugins.
        try {
            // @ts-ignore
            const instance = new candidate();
            return validatePluginInstance(instance);
        } catch (e) {
            const errorplugin = errorParser(e, `Failed to instantiate plugin class:`);
            return { valid: false, error: errorplugin.message };
        }
    }

    return validatePluginInstance(candidate);
  } catch (error) {
    const errorplugin = errorParser(error, `Unexpected validation error:`);
    return { valid: false, error: errorplugin.message };
  }
}

function validatePluginInstance(obj: unknown): ValidationResult {
  const result = pluginSchemaDefinition.safeParse(obj);

  if (!result.success) {
    return { 
        valid: false, 
        error: result.error.issues.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', ') 
    };
  }

  // Use the original object to preserve prototype and 'this' context,
  // but we can use the parsed data to ensure defaults are applied if we want.
  // For now, let's just return the original object casted to IPlugin.
  const plugin = obj as IPlugin;
  
  // Apply defaults/formatting from Zod if needed (optional)
  if (!plugin.version && result.data.version) plugin.version = result.data.version;

  // Shim onUnload if missing
  if (!plugin.onUnload) {
    plugin.onUnload = () => {};
  }

  return { valid: true, plugin };
}
