import type { IPlugin, PluginContext } from "../../src";
import { type } from "arktype";

export class ArkTypePlugin implements IPlugin {
    name = "arktype-plugin";
    version = "1.0.0";

    async onLoad(context: PluginContext) {
        context.log.info("ArkTypePlugin loading...");
        
        // Define a schema using ArkType
        const user = type({
            id: "number",
            name: "string",
            age: "number"
        });

        const testData = {
            id: 1,
            name: "John Doe",
            age: 30
        };

        const result = user(testData);

        context.log.info("result", result)
    }

    async onUnload() {
        console.log("ArkTypePlugin unloading...");
    }
}
