import type { PluginContext } from "../../../src/types";

export const ObjectPlugin = {
  name: "object-plugin",
  version: "0.9.0",
  onLoad: (ctx: PluginContext) => {
    ctx.log.info("Object plugin loaded");
  }
  // Missing onUnload, should be auto-shimmed by validator
};
