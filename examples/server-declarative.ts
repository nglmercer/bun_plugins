/**
 * Declarative Server Example
 * 
 * A clean, declarative approach to building a plugin-powered server
 * with minimal boilerplate and maximum clarity.
 */

import { serve } from "bun";
import { PluginManager } from "../src/PluginManager";

// Server configuration
interface ServerConfig {
  port: number;
  host: string;
  routes: RouteDefinition[];
  middleware: MiddlewareDefinition[];
}

interface RouteDefinition {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  handler: string; // Plugin action name
  description?: string;
}

interface MiddlewareDefinition {
  name: string;
  priority: number;
  handler: string;
}

// Declarative route definitions
const routes: RouteDefinition[] = [
  {
    method: 'GET',
    path: '/health',
    handler: 'health_check',
    description: 'Health check endpoint'
  },
  {
    method: 'POST',
    path: '/plugins',
    handler: 'list_plugins',
    description: 'List all loaded plugins'
  },
  {
    method: 'POST',
    path: '/plugins/register',
    handler: 'register_plugin',
    description: 'Register a new plugin'
  },
  {
    method: 'POST',
    path: '/plugins/unregister',
    handler: 'unregister_plugin',
    description: 'Unregister a plugin'
  },
  {
    method: 'GET',
    path: '/actions',
    handler: 'list_actions',
    description: 'List available actions'
  },
  {
    method: 'POST',
    path: '/actions/execute',
    handler: 'execute_action',
    description: 'Execute a specific action'
  }
];

// Declarative server plugin
const createServerPlugin = () => ({
  name: "declarative-server",
  version: "1.0.0",
  description: "Server plugin with declarative route handling",
  
  async onLoad(context: any) {
    const { log } = context;
    log.info("Server plugin loaded");
    
    // Register server actions
    const actions = {
      health_check: async () => ({ status: 'healthy', timestamp: new Date().toISOString() }),
      list_plugins: async () => context.manager.listPlugins(),
      register_plugin: async (data: any) => {
        // Plugin registration logic
        return { success: true, plugin: data.name };
      },
      unregister_plugin: async (data: any) => {
        // Plugin unregistration logic
        return { success: true, plugin: data.name };
      },
      list_actions: async () => {
        const registry = context.manager.getPlugin('action-registry')?.getApi();
        return registry ? registry.list() : [];
      },
      execute_action: async (data: any) => {
        const registry = context.manager.getPlugin('action-registry')?.getApi();
        if (!registry) throw new Error('Action registry not found');
        return registry.execute(data.action, ...data.args);
      }
    };
    
    // Make actions available
    context.serverActions = actions;
    log.info("Server actions registered");
  },
  
  async onUnload() {
    console.log("Server plugin unloaded");
  }
});

// Declarative server factory
const createDeclarativeServer = (config: ServerConfig) => {
  const pluginManager = new PluginManager();
  
  return {
    pluginManager,
    
    async start() {
      // Register server plugin
      await pluginManager.register(createServerPlugin());
      
      // Create and start server
      const server = serve({
        port: config.port,
        hostname: config.host,
        
        async fetch(req) {
          const url = new URL(req.url);
          const route = config.routes.find(r => 
            r.method === req.method && r.path === url.pathname
          );
          
          if (!route) {
            return new Response(JSON.stringify({ error: 'Not found' }), {
              status: 404,
              headers: { 'Content-Type': 'application/json' }
            });
          }
          
          try {
            const serverPlugin = pluginManager.getPlugin('declarative-server');
            if (!serverPlugin || !(serverPlugin as any).serverActions) {
              throw new Error('Server plugin not available');
            }
            
            const actions = (serverPlugin as any).serverActions;
            const handler = actions[route.handler];
            
            if (!handler) {
              throw new Error(`Handler ${route.handler} not found`);
            }
            
            let data = {};
            if (req.method !== 'GET') {
              data = await req.json().catch(() => ({}));
            }
            
            const result = await handler(data);
            
            return new Response(JSON.stringify(result), {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            });
            
          } catch (error) {
            return new Response(JSON.stringify({ 
              error: (error as Error).message 
            }), {
              status: 500,
              headers: { 'Content-Type': 'application/json' }
            });
          }
        }
      });
      
      console.log(`🚀 Server running on http://${config.host}:${config.port}`);
      console.log('Available endpoints:');
      config.routes.forEach(route => {
        console.log(`  ${route.method} ${route.path} - ${route.description}`);
      });
      
      return server;
    }
  };
};

// Action registry plugin for the server
const createActionRegistryPlugin = () => ({
  name: "action-registry",
  version: "1.0.0",
  description: "Action registry for server operations",
  
  async onLoad(context: any) {
    const { ActionRegistry } = await import("./shared/action-registry");
    const registry = new ActionRegistry();
    
    // Register some example actions
    registry.register({
      name: 'greet',
      handler: (name: string) => `Hello, ${name}!`
    });
    
    registry.register({
      name: 'calculate',
      handler: (a: number, b: number, op: string) => {
        switch (op) {
          case 'add': return a + b;
          case 'subtract': return a - b;
          case 'multiply': return a * b;
          case 'divide': return b !== 0 ? a / b : 'Error: Division by zero';
          default: return 'Error: Unknown operation';
        }
      }
    });
    
    context.registry = registry;
  },
  
  async onUnload() {
    console.log("Action registry plugin unloaded");
  },
  
  getApi() {
    return (this as any).context?.registry;
  }
});

// Main demonstration
const demonstrateDeclarativeServer = async () => {
  const config: ServerConfig = {
    port: 3000,
    host: 'localhost',
    routes: routes,
    middleware: []
  };
  
  const server = createDeclarativeServer(config);
  
  // Register action registry
  await server.pluginManager.register(createActionRegistryPlugin());
  
  // Start server
  const instance = await server.start();
  
  console.log("\n🎯 Example requests:");
  console.log("  curl http://localhost:3000/health");
  console.log("  curl -X POST http://localhost:3000/actions/execute -H 'Content-Type: application/json' -d '{\"action\":\"greet\",\"args\":[\"World\"]}'");
  console.log("  curl -X POST http://localhost:3000/actions/execute -H 'Content-Type: application/json' -d '{\"action\":\"calculate\",\"args\":[10,5,\"add\"]}'");
  
  console.log("\nPress Ctrl+C to stop the server");
  
  return instance;
};

// Export for use
export {
  createDeclarativeServer,
  createServerPlugin,
  createActionRegistryPlugin,
  routes,
  demonstrateDeclarativeServer
};

// Run if called directly
if (import.meta.main) {
  demonstrateDeclarativeServer().catch(console.error);
}