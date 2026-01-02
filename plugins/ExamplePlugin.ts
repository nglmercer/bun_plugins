
import { definePlugin } from "../src";

export default definePlugin({
    name: "edge",
    version: "1.0.0",

    async onLoad(context) {
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
        const result = mathApi.add(1, 2);
        context.log.info(`Math result: ${result}`);
        
        // Or use direct methods on the plugin instance:
        const result2 = mathPlugin.multiply(3, 4);
        context.log.info(`Multiplication result: ${result2}`);
    },
    
    onUnload() {}
});
