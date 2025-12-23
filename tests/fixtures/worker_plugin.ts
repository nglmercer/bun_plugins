
import { type IPlugin, type PluginContext, PluginPermission } from "../../src/types";

const plugin: IPlugin = {
    name: "worker-plugin",
    version: "1.0.0",
    permissions: [PluginPermission.Env, PluginPermission.Network, PluginPermission.Filesystem], 
    onLoad: async (ctx: PluginContext) => {
        ctx.log.info("Worker plugin loaded");
        
        ctx.events.on("ping", (payload) => {
            ctx.log.info("Received ping in worker:", payload);
            ctx.events.emit("pong", { echo: payload });
        });
    },
    setup: (build) => {
        build.onResolve(/.*\.worker\.js/, (args) => {
            return { path: args.path + ".resolved", namespace: "worker-test" };
        });
    },
    onUnload: () => {}
};

export default plugin;
