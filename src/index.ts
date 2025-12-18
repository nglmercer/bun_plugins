import { PluginManager } from "./PluginManager";
import { join } from "node:path";

async function main() {
  const manager = new PluginManager();
  
  console.log("Starting Plugin System...");

  // Load plugins from the plugins directory
  const pluginsDir = join(import.meta.dir, "plugins");
  await manager.loadPluginsFromDirectory(pluginsDir);

  console.log("Loaded plugins:", manager.listPlugins());

  // Keep alive for a bit to see the simulation
  setTimeout(async () => {
    console.log("Shutting down...");
    for (const p of manager.listPlugins()) {
      await manager.unregister(p);
    }
  }, 10000);
}

main().catch(console.error);
