import type { IPlugin, PluginContext } from "../types";

// --- Dynamic Type Definition ---
// This Augmentation adds 'cmd:execute' and 'cmd:result' to the global AppEvents interface.
// Any file importing types from "../types" after this file is loaded (or if this file is in the compilation context)
// will see these new events.
declare module "../types" {
  interface AppEvents {
    "cmd:execute": { command: string; args: string[]; id: string };
    "cmd:result": { id: string; success: boolean; output: string };
  }
}

export class CommandPlugin implements IPlugin {
  name = "command-plugin";
  version = "1.0.0";

  onLoad(context: PluginContext) {
    console.log("[CommandPlugin] Loaded and listening for commands.");

    // Strong typing here for 'cmd:execute' thanks to the augmentation above
    context.on("cmd:execute", (payload) => {
      console.log(`[CommandPlugin] Received command request: ${payload.command} with args [${payload.args.join(", ")}]`);

      // Stimulate execution logic
      const output = this.executeCommand(payload.command, payload.args);
      
      // Emit result back
      context.emit("cmd:result", {
        id: payload.id,
        success: true,
        output: output
      });
    });

    // Handle base 'cmd:input' from system/type definitions
    context.on("cmd:input", (payload) => {
       console.log(`[CommandPlugin] Received input: ${payload.command}`);
       const output = this.executeCommand(payload.command, payload.args);
       console.log(`[CommandPlugin] Input Executed: ${output}`);
    });
  }

  onUnload() {
    console.log("[CommandPlugin] Unloading.");
  }

  private executeCommand(cmd: string, args: string[]): string {
    // Simple mock execution
    if (cmd === "echo") return args.join(" ");
    if (cmd === "version") return "v1.0.0";
    return "Unknown command";
  }
}
