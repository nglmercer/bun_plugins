/**
 * Example: Non-Isolated Plugin Using Storage
 * 
 * This example shows how to use storage in a plugin that runs directly
 * in the main thread (non-isolated mode). Storage is accessed directly
 * through the context object.
 */

import type { IPlugin, PluginContext } from "../src/types";

// Define a user data type for type safety
interface UserData {
    name: string;
    email: string;
    lastLogin: string;
}

// Counter example with simple key-value storage
export const CounterPlugin: IPlugin = {
    name: "counter-plugin",
    version: "1.0.0",
    description: "A simple counter plugin that persists state using storage",
    author: "Example Author",

    // Optional: Define default configuration
    defaultConfig: {
        startValue: 0,
        maxIncrements: 100
    },

    // Required: onLoad method receives the context
    async onLoad(context: PluginContext) {
        const { storage, config, log } = context;

        // Get the current counter value from storage, or use default
        const counter = await storage.get<number>("counter") ?? config.startValue;
        log.info(`Initial counter value: ${counter}`);

        // Save the initial value to storage
        await storage.set("counter", counter);
        await storage.set("lastUpdated", new Date().toISOString());

        // Increment the counter
        const newCounter = counter + 1;
        await storage.set("counter", newCounter);
        log.info(`Counter incremented to: ${newCounter}`);

        // Get all stored data
        const allData = {
            counter: await storage.get<number>("counter"),
            lastUpdated: await storage.get<string>("lastUpdated"),
            startValue: config.startValue
        };
        log.info("All stored data:", allData);

        // Example of storing complex objects
        const userData: UserData = {
            name: "John Doe",
            email: "john@example.com",
            lastLogin: new Date().toISOString()
        };
        await storage.set("userData", userData);

        // Retrieve and log user data
        const storedUser = await storage.get<UserData>("userData");
        log.info("User data:", storedUser);

        // Example of deleting a key
        await storage.delete("tempData");
        log.info("Deleted temporary data");

        // Example of clearing all storage (use with caution!)
        // await storage.clear();
        // log.info("Storage cleared");
    },

    async onUnload() {
        console.log("Counter plugin is unloading...");
    }
};

// Advanced example: Todo List Plugin with CRUD operations
export const TodoListPlugin: IPlugin = {
    name: "todo-list-plugin",
    version: "1.0.0",
    description: "A todo list plugin demonstrating full storage usage",
    author: "Example Author",

    async onLoad(context: PluginContext) {
        const { storage, log } = context;

        // Initialize todo list if it doesn't exist
        const todos = await storage.get<any[]>("todos") ?? [];
        log.info(`Loaded ${todos.length} todos`);

        // Add a new todo
        const newTodo = {
            id: Date.now(),
            text: "Learn about plugin storage",
            completed: false,
            createdAt: new Date().toISOString()
        };
        todos.push(newTodo);
        await storage.set("todos", todos);
        log.info("Added new todo:", newTodo);

        // Mark a todo as completed
        const updatedTodos = todos.map(todo => 
            todo.id === newTodo.id ? { ...todo, completed: true } : todo
        );
        await storage.set("todos", updatedTodos);
        log.info("Marked todo as completed");

        // Get statistics
        const stats = {
            total: updatedTodos.length,
            completed: updatedTodos.filter(t => t.completed).length,
            pending: updatedTodos.filter(t => !t.completed).length
        };
        await storage.set("stats", stats);
        log.info("Todo statistics:", stats);

        // Example of using nested data structures
        const todoSettings = {
            notifications: {
                enabled: true,
                time: "09:00"
            },
            sorting: "date"
        };
        await storage.set("settings", todoSettings);
        log.info("Settings saved");
    },

    async onUnload() {
        console.log("Todo list plugin is unloading...");
    }
};

// Example showing storage with configuration integration
export const ConfiguredStoragePlugin: IPlugin = {
    name: "configured-storage-plugin",
    version: "1.0.0",
    description: "Plugin showing integration of config and storage",
    author: "Example Author",

    defaultConfig: {
        dataRetentionDays: 30,
        maxItems: 100,
        autoSave: true
    },

    async onLoad(context: PluginContext) {
        const { storage, config, log } = context;

        // Store configuration in storage for persistence
        await storage.set("config", config);
        log.info("Configuration saved to storage");

        // Check if this is the first run
        const isFirstRun = await storage.get<boolean>("firstRun", true);
        if (isFirstRun) {
            log.info("First run - initializing storage");
            await storage.set("firstRun", false);
            await storage.set("initializedAt", new Date().toISOString());
            
            // Initialize default data
            await storage.set("data", []);
            await storage.set("metadata", {
                version: this.version,
                createdAt: new Date().toISOString()
            });
        } else {
            const metadata = await storage.get<any>("metadata");
            log.info(`Plugin initialized on: ${metadata?.createdAt}`);
        }

        // Read and update usage statistics
        const usageStats = await storage.get<any>("usageStats", {
            loadCount: 0,
            lastLoad: null
        });
        
        usageStats.loadCount++;
        usageStats.lastLoad = new Date().toISOString();
        await storage.set("usageStats", usageStats);
        
        log.info(`Usage statistics: ${usageStats.loadCount} loads`);
    },

    async onUnload() {
        console.log("Configured storage plugin is unloading...");
    }
};

// Export a function to demonstrate usage
export async function demonstrateNonIsolatedStorage() {
    const { PluginManager } = await import("../src/index");
    
    const manager = new PluginManager();
    
    // Register the plugins (they will run in non-isolated mode)
    await manager.register(CounterPlugin);
    await manager.register(TodoListPlugin);
    await manager.register(ConfiguredStoragePlugin);
    
    console.log("\n=== Non-Isolated Storage Demo Complete ===\n");
    
    // Storage is persisted in: storage/plugins/{plugin-name}/storage.json
    console.log("Storage files created:");
    console.log("  - storage/plugins/counter-plugin/storage.json");
    console.log("  - storage/plugins/todo-list-plugin/storage.json");
    console.log("  - storage/plugins/configured-storage-plugin/storage.json");
}
