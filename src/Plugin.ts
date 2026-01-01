
import type { IPlugin, PluginContext, PluginBuilder, PluginPermission } from "./types";
import { z } from "zod";

/**
 * Abstract base class for Plugins to extend.
 * Provides default implementations for optional methods.
 */
export abstract class Plugin implements IPlugin {
    abstract name: string;
    abstract version: string;
    
    description?: string;
    author?: string;
    dependencies?: Record<string, string>;
    permissions?: PluginPermission[];
    allowedDomains?: string[];
    configSchema?: z.ZodSchema;
    defaultConfig?: Record<string, any>;

    onLoad(context: PluginContext): Promise<void> | void {
        // Default no-op
    }

    onUnload(): Promise<void> | void {
        // Default no-op
    }

    onStarted(): Promise<void> | void {
        // Default no-op
    }

    onReload(context: PluginContext): Promise<void> | void {
        // Default no-op defined but not enforced by interface strictly if optional
    }

    setup(build: PluginBuilder): void | Promise<void> {
        // Default no-op
    }
}

/**
 * Helper function to define a plugin object with type inference.
 * Useful for functional-style plugin definitions.
 */
export function definePlugin(plugin: IPlugin): IPlugin {
    return plugin;
}
