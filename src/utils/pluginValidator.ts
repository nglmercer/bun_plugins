import { z } from "zod";
import type { IPlugin } from "../types";

export const PluginSchema = z.object({
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
  getSharedApi: z.function().optional(),
  setup: z.function().optional(),
});

// We can have a stricter schema for the full IPlugin
export const StrictPluginSchema = z.object({
  name: z.string(),
  version: z.string(),
  onLoad: z.function(),
  onUnload: z.function(),
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
            return { valid: false, error: "Failed to instantiate plugin class: " + String(e) };
        }
    }

    return validatePluginInstance(candidate);
  } catch (error) {
    return { valid: false, error: "Unexpected validation error: " + String(error) };
  }
}

function validatePluginInstance(obj: unknown): ValidationResult {
  const result = PluginSchema.safeParse(obj);

  if (!result.success) {
    return { 
        valid: false, 
        error: result.error.issues.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', ') 
    };
  }

  // Cast to IPlugin (fill in missing optional methods if needed)
  const plugin = result.data as IPlugin;
  
  // Shim onUnload if missing (since we made it optional in schema but it is required in IPlugin interface usually, 
  // though we can be lenient)
  if (!plugin.onUnload) {
    plugin.onUnload = () => {};
  }

  return { valid: true, plugin };
}
