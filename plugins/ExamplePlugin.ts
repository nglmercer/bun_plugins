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
        
        // mathPlugin ya es la API del plugin, no es necesario llamar a getApi()
        context.log.info(`Math API version: ${mathPlugin.version}`);
    },
    
    onUnload() {}
});
