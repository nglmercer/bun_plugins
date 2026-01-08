/**
 * Declarative Action Registry Example
 *
 * This example demonstrates a clean, declarative approach to building
 * plugins with action registries using shared utilities.
 */

import { PluginManager } from "../src/PluginManager";
import {
  ActionRegistry,
  mathActions,
  textActions,
  utilityActions,
  createActionRegistry
} from "./shared/action-registry";
import { createPlugin, createActionPlugin, runDemo } from "./shared/plugin-builder";

// Central registry plugin - declarative definition
const createRegistryPlugin = () => createPlugin({
  name: "action-registry",
  version: "1.0.0",
  description: "Central action registry for all plugins",
  
  onLoad: async (context) => {
    context.log.info("ActionRegistry initialized");
  },
  
  sharedApi: createActionRegistry()
});

// Action plugins - declarative definitions
const createMathPlugin = () => createActionPlugin({
  name: "math-actions",
  version: "1.0.0",
  description: "Mathematical operations",
  registryName: "action-registry",
  actionCategories: [mathActions]
});

const createTextPlugin = () => createActionPlugin({
  name: "text-actions",
  version: "1.0.0",
  description: "Text transformation operations",
  registryName: "action-registry",
  actionCategories: [textActions]
});

const createUtilityPlugin = () => createActionPlugin({
  name: "utility-actions",
  version: "1.0.0",
  description: "Utility functions",
  registryName: "action-registry",
  actionCategories: [utilityActions]
});

interface TestCase {
  action: string;
  args: any[];
  expected?: any;
  validator?: (result: any) => boolean;
}

// Demo runner with declarative test cases
const runActionTests = async (registry: ActionRegistry) => {
  const testCases = [
    { category: "Math", tests: [
      { action: "sum", args: [5, 3], expected: 8 },
      { action: "multiply", args: [4, 7], expected: 28 },
      { action: "power", args: [2, 8], expected: 256 }
    ] as TestCase[]},
    { category: "Text", tests: [
      { action: "uppercase", args: ["hello world"], expected: "HELLO WORLD" },
      { action: "reverse", args: ["javascript"], expected: "tpircsavaj" }
    ] as TestCase[]},
    { category: "Utility", tests: [
      { action: "timestamp", args: [], validator: (result: number) => result > 0 }
    ] as TestCase[]}
  ];

  for (const { category, tests } of testCases) {
    console.log(`\n${category} Operations:`);
    for (const test of tests) {
      try {
        const result = registry.execute(test.action, ...test.args);
        if ('expected' in test && test.expected !== undefined) {
          console.log(`  ${test.action}(${test.args.join(', ')}) = ${result}`);
        } else if ('validator' in test && test.validator) {
          console.log(`  ${test.action}() = ${test.validator(result) ? '✓' : '✗'}`);
        }
      } catch (error) {
        console.error(`  ${test.action} failed:`, error);
      }
    }
  }
};

// Main demonstration
const demonstrateDeclarativeActionRegistry = async () => {
  const manager = new PluginManager();
  
  // Create plugin instances
  const registryPlugin = createRegistryPlugin();
  const mathPlugin = createMathPlugin();
  const textPlugin = createTextPlugin();
  const utilityPlugin = createUtilityPlugin();
  
  // Register plugins in dependency order
  await manager.register(registryPlugin);
  await manager.register(mathPlugin);
  await manager.register(textPlugin);
  await manager.register(utilityPlugin);
  
  // Get the registry
  const registryPluginInstance = manager.getPlugin("action-registry");
  if (!registryPluginInstance || !registryPluginInstance.getApi) {
    throw new Error("Registry plugin not found");
  }
  const registry = registryPluginInstance.getApi() as ActionRegistry;
  
  console.log("\nAvailable Actions:");
  registry.list().forEach(action => console.log(`  - ${action}`));
  
  // Run tests
  await runActionTests(registry);
  
  // Error handling demo
  console.log("\nError Handling:");
  try {
    registry.execute("non-existent-action");
  } catch (error) {
    console.log(`  Caught error: ${(error as Error).message}`);
  }
  
  // Plugin info
  console.log("\nPlugin Information:");
  ["math-actions", "text-actions", "utility-actions"].forEach(pluginName => {
    const plugin = manager.getPlugin(pluginName);
    if (plugin && plugin.getApi) {
      const api = plugin.getApi() as any;
      if (api?.actions) {
        console.log(`  ${pluginName}: ${api.actions.join(", ")}`);
      }
    }
  });
};

// Dynamic loading example
const demonstrateDynamicLoading = async () => {
  const { join } = await import("node:path");
  const manager = new PluginManager();
  
  console.log("\nLoading plugins dynamically from directory...");
  await manager.loadPluginsFromDirectory(join(process.cwd(), "plugins"));
  
  const loaded = manager.listPlugins();
  console.log(`Loaded ${loaded.length} plugins: ${loaded.join(", ")}`);
};

// Export for use
export {
  createRegistryPlugin,
  createMathPlugin,
  createTextPlugin,
  createUtilityPlugin,
  demonstrateDeclarativeActionRegistry,
  demonstrateDynamicLoading
};

// Run if called directly
if (import.meta.main) {
  runDemo("Declarative Action Registry Demo", demonstrateDeclarativeActionRegistry);
}
