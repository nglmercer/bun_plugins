import type { IPlugin, PluginContext } from "../src";

export class MathPlugin implements IPlugin {
  name = "math-plugin";
  version = "0.5.0";

  onLoad(context: PluginContext) {
    console.log("Math capabilities ready.");
  }

  onUnload() {
    // cleanup
  }

  // Custom method exposed by this plugin
  add(a: number, b: number): number {
    return a + b;
  }
  
  multiply(a: number, b: number): number {
    return a * b;
  }
}
