import { definePlugin } from "../src";
// Con la nueva solución de tipos extensibles, los tipos están disponibles directamente
// desde bun_plugins/plugin-registry-base y pueden ser extendidos por usuarios

export default definePlugin({
    name: "edge",
    version: "1.0.0",

    async onLoad(context) {
        // getPlugin ahora es asíncrono y tiene type safety
        const mathPlugin = await context.getPlugin('math-plugin');
        
        if (!mathPlugin) {
            context.log.error("Math plugin not found");
            return;
        }
        
        // ✅ Type safety automático - TypeScript conoce los métodos disponibles
        const result = mathPlugin.add(1, 2);
        context.log.info(`Math result: ${result}`);
        
        const multiplyResult = mathPlugin.multiply(3, 4);
        context.log.info(`Multiplication result: ${multiplyResult}`);
        
        // También puedes usar getApi() para una API más encapsulada
        const mathApi = mathPlugin.getApi?.();
        if (mathApi) {
            // mathApi tiene el tipo MathPluginApi
            context.log.info(`Math API version: ${mathApi.version}`);
        }
    },
    
    onUnload() {}
});
