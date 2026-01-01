import type { IPlugin, PluginContext } from "../../../src/types";

export class SimplePlugin implements IPlugin {
  name = "simple-valid-plugin";
  version = "1.0.0";

  onLoad(ctx: PluginContext) {
    ctx.log.info("Simple plugin loaded");
  }

  onUnload() {}
}
