import { PluginManager } from "./src/PluginManager";
import { join } from "node:path";
import type { MathPlugin }from "./src/plugins/MathPlugin";
async function main() {
  const manager = new PluginManager();

  // Load plugins dynamically from directory
  const pluginsDir = join(import.meta.dir, "src", "plugins");
  await manager.loadPluginsFromDirectory(pluginsDir);

  // List loaded plugins
  console.log("\n--- Active Plugins ---");
  console.log(manager.listPlugins());

  console.log("\n--- Event System Demo ---");

  // Listen to system logs at the top level
  manager.on("log", (data) => {
    // This catches logs emitted by plugins
    // We can rely on 'EventBridgePlugin' to print them, so maybe we don't print here to avoid duplicates,
    // or we print only critical errors.
    if (data.level === "error") {
      console.error(`!!!! SYSTEM ERROR: ${data.message}`);
    }
  });

  // Emit a command event
  console.log("-> Emitting 'echo' command...");
  manager.emit("cmd:input", { command: "echo", args: ["Hello", "World", "from", "Zod!"] });

  // Emit an invalid command to see Zod validation error
  console.log("-> Emitting invalid command payload...");
  // @ts-ignore - Demonstrating runtime validation catching bad types even if TS is ignored/bypassed
  manager.emit("cmd:input", { command: "fail", args: "not-an-array" });

  console.log("\n--- Unloading ---");
  // manager.unregister("command-plugin"); // if we wanted to

  await manager.unregister("math-plugin");
  await manager.unregister("logger-plugin");
}

main().catch(console.error);