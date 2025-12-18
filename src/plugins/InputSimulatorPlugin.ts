import type { IPlugin, PluginContext } from "../types";

export class InputSimulatorPlugin implements IPlugin {
  name = "input-simulator";
  version = "1.0.0";

  onLoad(context: PluginContext) {
    console.log("[InputSimulator] Loaded.");
    // Simulate some activity or just be present
  }

  onUnload() {
    console.log("[InputSimulator] Unloaded.");
  }
}
