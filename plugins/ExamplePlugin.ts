import { definePlugin } from "../src";

// Los tipos están disponibles globalmente gracias a src/global.d.ts
// No necesitas importar MathPlugin - el tipado es automático

export default definePlugin({
    name: "edge",
    version: "1.0.0",

    async onLoad(context) {
        // getPlugin ahora es asíncrono
        const mathPlugin = await context.getPlugin('math-plugin');
        
        if (!mathPlugin) {
            context.log.error("Math plugin not found");
            return;
        }
        // Experimental automatic types
        const result = mathPlugin.add(1, 2);
        context.log.info(`Math result via API: ${result}`);
        
        // recomendado
/*         // Usar getApi() - más seguro y encapsulado
        const mathApi = mathPlugin.getApi?.() as {
            add(a: number, b: number): number;
            multiply(a: number, b: number): number;
        };
        
        if (mathApi) {
            const mathResult = mathApi.add(1, 2);
            context.log.info(`Math result via API: ${mathResult}`);
            
            const multiplyResult = mathApi.multiply(3, 4);
            context.log.info(`Multiplication result via API: ${multiplyResult}`);
        }

        // Alternativa: cast directo al tipo del plugin (menos seguro pero funcional)
        const mathPluginDirect = mathPlugin as MathPlugin;
        if (mathPluginDirect) {
            const addResult = mathPluginDirect.add(5, 6);
            context.log.info(`Addition result direct: ${addResult}`);
        } */
    },
    
    onUnload() {}
});
