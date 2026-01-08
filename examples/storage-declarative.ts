/**
 * Declarative Storage Example
 * 
 * This example demonstrates a clean, declarative approach to building
 * plugins with storage using shared utilities.
 */

import { PluginManager } from "../src/PluginManager";
import { createPlugin, runDemo } from "./shared/plugin-builder";

// Storage operation definitions
const storageOperations = {
  counter: {
    get: { key: "counter", defaultValue: 0 },
    increment: (current: number) => ({ key: "counter", value: current + 1 }),
    log: (value: number) => `Counter: ${value}`
  },
  
  userData: {
    template: {
      name: "John Doe",
      email: "john@example.com",
      lastLogin: new Date().toISOString()
    },
    save: (data: any) => ({ key: "userData", value: data }),
    log: (data: any) => `User: ${data.name} (${data.email})`
  },
  
  metadata: {
    save: (version: string) => ({ 
      key: "metadata", 
      value: { 
        version, 
        createdAt: new Date().toISOString(),
        plugin: "declarative-storage"
      }
    }),
    log: (meta: any) => `Metadata: v${meta.version} created at ${meta.createdAt}`
  }
};

// Declarative counter plugin
const createCounterPlugin = () => createPlugin({
  name: "declarative-counter",
  version: "1.0.0",
  description: "Counter plugin using declarative storage operations",
  defaultConfig: { startValue: 0 },
  
  onLoad: async (context) => {
    const { storage, config, log } = context;
    
    // Get current counter
    const counter = await storage.get<number>(
      storageOperations.counter.get.key,
      config.startValue
    ) ?? config.startValue;
    log.info(storageOperations.counter.log(counter));
    
    // Increment and save
    const { key, value } = storageOperations.counter.increment(counter);
    await storage.set(key, value);
    log.info(`Updated ${key} to ${value}`);
    
    // Save metadata
    const metaOp = storageOperations.metadata.save("1.0.0");
    await storage.set(metaOp.key, metaOp.value);
    log.info(storageOperations.metadata.log(metaOp.value));
  }
});

// Declarative user management plugin
const createUserPlugin = () => createPlugin({
  name: "declarative-user",
  version: "1.0.0",
  description: "User management with declarative storage",
  
  onLoad: async (context) => {
    const { storage, log } = context;
    
    // Initialize user data
    const userData = storageOperations.userData.template;
    const saveOp = storageOperations.userData.save(userData);
    await storage.set(saveOp.key, saveOp.value);
    log.info(storageOperations.userData.log(userData));
    
    // Store session info
    await storage.set("session", {
      sessionId: `sess_${Date.now()}`,
      userId: "user_123",
      createdAt: new Date().toISOString()
    });
    
    // Complex data structure
    const preferences = {
      theme: "dark",
      language: "en",
      notifications: {
        email: true,
        push: false,
        frequency: "daily"
      }
    };
    await storage.set("preferences", preferences);
    log.info("User preferences saved");
  }
});

// Declarative analytics plugin
const createAnalyticsPlugin = () => createPlugin({
  name: "declarative-analytics",
  version: "1.0.0",
  description: "Analytics tracking with declarative storage",
  
  onLoad: async (context) => {
    const { storage, log } = context;
    
    // Initialize analytics data
    const analytics = {
      pageViews: 0,
      userSessions: 0,
      events: [] as any[],
      lastActivity: new Date().toISOString()
    };
    
    await storage.set("analytics", analytics);
    log.info("Analytics initialized");
    
    // Simulate some activity
    analytics.pageViews += 1;
    analytics.userSessions += 1;
    analytics.events.push({
      type: "page_view",
      timestamp: new Date().toISOString(),
      data: { page: "/home" }
    });
    
    await storage.set("analytics", analytics);
    log.info("Analytics updated");
    
    // Store configuration
    await storage.set("config", {
      trackingEnabled: true,
      sampleRate: 1.0,
      excludedPaths: ["/admin", "/health"]
    });
  }
});

// Declarative CRUD operations plugin
const createCrudPlugin = () => createPlugin({
  name: "declarative-crud",
  version: "1.0.0",
  description: "CRUD operations demonstration",
  
  onLoad: async (context) => {
    const { storage, log } = context;
    
    // Define a data model
    interface Todo {
      id: number;
      text: string;
      completed: boolean;
      createdAt: string;
    }
    
    // Initialize data
    const todos: Todo[] = [
      { id: 1, text: "Learn declarative plugins", completed: false, createdAt: new Date().toISOString() }
    ];
    
    await storage.set("todos", todos);
    log.info(`Created ${todos.length} todo items`);
    
    // CRUD operations
    const operations = {
      create: async (text: string) => {
        const current = await storage.get<Todo[]>("todos", []);
        const newTodo: Todo = {
          id: Date.now(),
          text,
          completed: false,
          createdAt: new Date().toISOString()
        };
        current?.push(newTodo);
        await storage.set("todos", current);
        return newTodo;
      },
      
      read: async () => {
        return await storage.get<Todo[]>("todos", []) ?? [];
      },
      
      update: async (id: number, updates: Partial<Todo>) => {
        const current = await storage.get<Todo[]>("todos", []) ?? [];
        const index = current.findIndex(t => t.id === id);
        if (index !== -1) {
          current[index] = { ...current[index], ...updates } as Todo;
          await storage.set("todos", current);
          return current[index];
        }
        return null;
      },
      
      delete: async (id: number) => {
        const current = await storage.get<Todo[]>("todos", []) ?? [];
        const filtered = current.filter(t => t.id !== id);
        await storage.set("todos", filtered);
        return filtered.length < current.length;
      }
    };
    
    // Demonstrate CRUD
    const newTodo = await operations.create("Test declarative CRUD");
    log.info(`Created: ${newTodo.text}`);
    
    const allTodos = await operations.read();
    log.info(`Total todos: ${allTodos.length}`);
    
    await operations.update(newTodo.id, { completed: true });
    log.info(`Updated todo ${newTodo.id} to completed`);
    
    const deleted = await operations.delete(newTodo.id);
    log.info(`Deleted todo: ${deleted}`);
  }
});

// Main demonstration
const demonstrateDeclarativeStorage = async () => {
  const manager = new PluginManager();
  
  // Register all plugins
  await manager.register(createCounterPlugin());
  await manager.register(createUserPlugin());
  await manager.register(createAnalyticsPlugin());
  await manager.register(createCrudPlugin());
  
  console.log("\n📊 Storage Demo Complete");
  console.log("Storage files created:");
  console.log("  - storage/plugins/declarative-counter/storage.json");
  console.log("  - storage/plugins/declarative-user/storage.json");
  console.log("  - storage/plugins/declarative-analytics/storage.json");
  console.log("  - storage/plugins/declarative-crud/storage.json");
};

// Export for use
export {
  createCounterPlugin,
  createUserPlugin,
  createAnalyticsPlugin,
  createCrudPlugin,
  demonstrateDeclarativeStorage
};

// Run if called directly
if (import.meta.main) {
  runDemo("Declarative Storage Demo", demonstrateDeclarativeStorage);
}