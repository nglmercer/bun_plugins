
import { definePlugin } from "../src";
import * as types from "../plugin-types"
export default definePlugin({
    name: "edge",
    version: "1.0.0",

    async onLoad(context) {
        // Validar datos del plugin con ArkType

        // As tts is no longer in context, we use the singleton from the example lib
        context.log.info("EdgeTTS Provider registered via plugin");
        
        // Get the math plugin - types are inferred automatically from PluginTypeRegistry
        const mathPlugin = context.getPlugin('math-plugin');
        
        if (!mathPlugin) {
            context.log.error("Math plugin not found");
            return;
        }

        // Using getSharedApi() is recommended for better encapsulation:
        const mathApi = mathPlugin.getSharedApi();
        const mathResult = mathApi.add(1, 2);
        context.log.info(`Math result: ${mathResult}`);
        
        // Or use direct methods on the plugin instance:
        const multiplyResult = mathPlugin.multiply(3, 4);
        context.log.info(`Multiplication result: ${multiplyResult}`);
    },
    
    onUnload() {}
});
