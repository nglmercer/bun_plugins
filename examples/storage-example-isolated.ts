/**
 * Example: Isolated Plugin Using Storage
 * 
 * This example shows how to use storage in a plugin that runs in isolation
 * (in a separate worker thread). The API is identical to non-isolated plugins,
 * but the storage operations are performed via RPC (Remote Procedure Calls).
 * 
 * IMPORTANT: Isolated plugins are registered differently:
 * - Non-isolated: manager.register(plugin)
 * - Isolated: manager.registerIsolated(pluginPath, pluginName)
 */

import type { IPlugin, PluginContext } from "../src/types";

// Simple counter plugin that works in isolation
export const IsolatedCounterPlugin: IPlugin = {
    name: "isolated-counter-plugin",
    version: "1.0.0",
    description: "Counter plugin running in isolation with storage",
    author: "Example Author",

    defaultConfig: {
        startValue: 0
    },

    async onLoad(context: PluginContext) {
        const { storage, config, log } = context;

        // The storage API is EXACTLY the same as in non-isolated plugins!
        // The difference is transparent: these operations are sent via RPC
        // to the main thread where the actual storage is managed.

        // Get counter value (RPC call to main thread)
        const counter = await storage.get<number>("counter") ?? config.startValue;
        log.info(`[Isolated] Initial counter value: ${counter}`);

        // Save value (RPC call to main thread)
        await storage.set("counter", counter + 1);
        
        // Retrieve updated value (RPC call to main thread)
        const newCounter = await storage.get<number>("counter");
        log.info(`[Isolated] Counter incremented to: ${newCounter}`);

        // Store complex data (still RPC calls, but you don't need to know!)
        const pluginState = {
            runs: 1,
            lastRun: new Date().toISOString(),
            isolated: true
        };
        await storage.set("state", pluginState);

        // Read back complex data
        const state = await storage.get<any>("state");
        log.info(`[Isolated] Plugin state:`, state);
    },

    async onUnload() {
        console.log("[Isolated] Counter plugin is unloading...");
    }
};

// Advanced example: Persistent Cache Plugin
export const IsolatedCachePlugin: IPlugin = {
    name: "isolated-cache-plugin",
    version: "1.0.0",
    description: "Cache plugin in isolation demonstrating storage patterns",
    author: "Example Author",

    defaultConfig: {
        maxSize: 100,
        ttl: 3600 // 1 hour in seconds
    },

    async onLoad(context: PluginContext) {
        const { storage, config, log } = context;

        // Initialize cache storage
        const cache = await storage.get<Record<string, any>>("cache") ?? {};
        const metadata = await storage.get<any>("metadata") ?? {
            hits: 0,
            misses: 0,
            created: new Date().toISOString()
        };

        log.info(`[Isolated] Cache initialized with ${Object.keys(cache).length} items`);
        log.info(`[Isolated] Cache stats: ${metadata.hits} hits, ${metadata.misses} misses`);

        // Simulate cache operations
        const cacheKey = "user:123";
        const cacheValue = {
            id: 123,
            name: "Jane Doe",
            email: "jane@example.com",
            cachedAt: new Date().toISOString()
        };

        // Set cache item (RPC call)
        cache[cacheKey] = cacheValue;
        await storage.set("cache", cache);

        // Get cache item (RPC call - simulating cache hit)
        const cachedData = cache[cacheKey];
        if (cachedData) {
            metadata.hits++;
            log.info(`[Isolated] Cache hit for ${cacheKey}`);
        } else {
            metadata.misses++;
            log.info(`[Isolated] Cache miss for ${cacheKey}`);
        }

        // Get non-existent item (simulating cache miss)
        const missingKey = "user:999";
        if (!cache[missingKey]) {
            metadata.misses++;
            log.info(`[Isolated] Cache miss for ${missingKey}`);
        }

        // Save updated metadata
        await storage.set("metadata", metadata);

        // Clean up old cache items (simple eviction policy)
        const maxItems = config.maxSize || 100;
        const cacheKeys = Object.keys(cache);
        if (cacheKeys.length > maxItems) {
            log.info(`[Isolated] Evicting ${cacheKeys.length - maxItems} old cache items`);
            // Keep only the most recent items
            const sortedKeys = cacheKeys.slice(-maxItems);
            const newCache: any = {};
            sortedKeys.forEach(key => {
                newCache[key] = cache[key];
            });
            await storage.set("cache", newCache);
        }

        // Example of storing analytics separately
        const analytics = {
            operations: {
                gets: 5,
                sets: 2,
                deletes: 0
            },
            lastUpdated: new Date().toISOString()
        };
        await storage.set("analytics", analytics);

        log.info("[Isolated] Cache plugin loaded successfully");
    },

    async onUnload() {
        console.log("[Isolated] Cache plugin is unloading...");
    }
};

// Example: User Session Plugin with Expiration
export const IsolatedSessionPlugin: IPlugin = {
    name: "isolated-session-plugin",
    version: "1.0.0",
    description: "Session management plugin in isolation",
    author: "Example Author",

    defaultConfig: {
        sessionTimeout: 1800 // 30 minutes
    },

    async onLoad(context: PluginContext) {
        const { storage, config, log } = context;

        // Get existing sessions
        const sessions = await storage.get<any[]>("sessions") ?? [];
        log.info(`[Isolated] Loaded ${sessions.length} sessions`);

        // Clean up expired sessions
        const now = Date.now();
        const timeoutMs = config.sessionTimeout * 1000;
        const activeSessions = sessions.filter((session: any) => {
            const sessionAge = now - new Date(session.createdAt).getTime();
            return sessionAge < timeoutMs;
        });

        if (activeSessions.length !== sessions.length) {
            log.info(`[Isolated] Cleaned up ${sessions.length - activeSessions.length} expired sessions`);
            await storage.set("sessions", activeSessions);
        }

        // Create a new session
        const newSession = {
            sessionId: `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            userId: "user_123",
            createdAt: new Date().toISOString(),
            lastActivity: new Date().toISOString(),
            data: {
                preferences: {
                    theme: "dark",
                    language: "en"
                }
            }
        };

        activeSessions.push(newSession);
        await storage.set("sessions", activeSessions);

        // Store session index for faster lookups
        const sessionIndex: Record<string, number> = {};
        activeSessions.forEach((session: any, index: number) => {
            sessionIndex[session.sessionId] = index;
        });
        await storage.set("sessionIndex", sessionIndex);

        // Store session statistics
        const stats = {
            totalSessions: activeSessions.length,
            createdThisSession: 1,
            cleanupCount: sessions.length - activeSessions.length
        };
        await storage.set("sessionStats", stats);

        log.info(`[Isolated] Active sessions: ${activeSessions.length}`);
    },

    async onUnload() {
        console.log("[Isolated] Session plugin is unloading...");
    }
};

// Export a function to demonstrate isolated plugin usage
export async function demonstrateIsolatedStorage() {
    const { PluginManager } = await import("../src/index");
    const { join } = await import("node:path");
    
    const manager = new PluginManager();
    
    // For isolated plugins, we need to:
    // 1. Save the plugin code to a file
    // 2. Register it using registerIsolated(path, name)
    
    // In a real scenario, your isolated plugins would be separate files
    // in your plugins/ directory. For this example, we'll show the pattern:
    
    console.log("\n=== Isolated Storage Demo ===\n");
    console.log("To run isolated plugins, follow these steps:\n");
    
    console.log("1. Create plugin files in your plugins directory:");
    console.log("   plugins/IsolatedCounterPlugin.ts");
    console.log("   plugins/IsolatedCachePlugin.ts");
    console.log("   plugins/IsolatedSessionPlugin.ts\n");
    
    console.log("2. Register them using registerIsolated():");
    console.log(`
    const { PluginManager } = require('./src/index');
    const manager = new PluginManager();
    
    await manager.registerIsolated(
        './plugins/IsolatedCounterPlugin.ts',
        'isolated-counter-plugin'
    );
    
    await manager.registerIsolated(
        './plugins/IsolatedCachePlugin.ts',
        'isolated-cache-plugin'
    );
    
    await manager.registerIsolated(
        './plugins/IsolatedSessionPlugin.ts',
        'isolated-session-plugin'
    );
    `);
    
    console.log("\n3. The storage API is IDENTICAL in both modes!");
    console.log("   The difference is transparent to the plugin developer.\n");
    
    console.log("Storage files created:");
    console.log("  - storage/plugins/isolated-counter-plugin/storage.json");
    console.log("  - storage/plugins/isolated-cache-plugin/storage.json");
    console.log("  - storage/plugins/isolated-session-plugin/storage.json\n");
    
    console.log("=== Key Difference: ===");
    console.log("Non-isolated: Direct access to storage in main thread");
    console.log("Isolated:    Storage operations via RPC calls to main thread");
    console.log("              (but API is exactly the same!)\n");
}

/**
 * This is what a standalone isolated plugin file would look like.
 * Save this as: plugins/IsolatedCounterPlugin.ts
 */
export const isolatedPluginTemplate = `
import type { IPlugin } from "../src/types";

export default {
    name: "isolated-counter-plugin",
    version: "1.0.0",
    description: "Counter plugin running in isolation",
    author: "Example Author",

    async onLoad(context) {
        const { storage, log } = context;

        // Storage API is exactly the same!
        const counter = await storage.get<number>("counter") ?? 0;
        log.info(\`Initial counter: \${counter}\`);

        await storage.set("counter", counter + 1);
        
        const newCounter = await storage.get<number>("counter");
        log.info(\`New counter: \${newCounter}\`);

        await storage.set("lastRun", new Date().toISOString());
    },

    async onUnload() {
        console.log("Plugin unloaded");
    }
} satisfies IPlugin;
`;
