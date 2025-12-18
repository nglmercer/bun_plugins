import type { IPlugin, PluginContext } from "../types";
import { PluginManager } from "../PluginManager";

export class LoggerPlugin implements IPlugin {
  name = "logger-plugin";
  version = "1.0.0";

  onLoad(context: PluginContext) {
    const manager = context.manager as PluginManager;
    
    // Register to a 'log' hook
    manager.on("log", (payload: { level: "info" | "error" | "warn"; message: string; }) => {
      console.log(`[LOGGER PLUGIN] ${new Date().toISOString()}: ${payload.message}`);
      return true; // Acknowledgement
    });
  }

  onUnload() {
    console.log("Logger plugin cleanup...");
  }
}
