import { Plugin, PluginContext } from "../src";

export class MathPlugin extends Plugin {
  name = "math-plugin";
  version = "0.5.0";

  onLoad(context: PluginContext) {
    context.log.info("Math capabilities ready");
  }

  // Custom method exposed by this plugin
  add(a: number, b: number): number {
    return a + b;
  }
  
  multiply(a: number, b: number): number {
    return a * b;
  }

  // onUnload is optional in base class, removing empty cleanup
}
