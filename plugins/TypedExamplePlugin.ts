/**
 * Ejemplo de plugin que usa el sistema de tipos para tener autocompletado
 * al acceder a otros plugins.
 * 
 * Este plugin demuestra cómo usar context.getPlugin() con type safety
 * gracias al archivo plugins/types.d.ts que extiende PluginFactory.
 */

import { definePlugin } from "../src";

export default definePlugin({
  name: "typed-example",
  version: "1.0.0",
  description: "Ejemplo de plugin con type safety",

  async onLoad(context) {
    context.log.info("Typed example plugin loading...");

    // ✅ TypeScript conoce el tipo exacto de MathPluginApi
    const mathPlugin = await context.getPlugin('math-plugin');
    
    if (!mathPlugin) {
      context.log.error("Math plugin not found");
      return;
    }
    
    // ✅ Autocompletado completo y type safety
    const sum = mathPlugin.add(10, 20);
    context.log.info(`Sum: ${sum}`); // Sum: 30
    
    const product = mathPlugin.multiply(5, 6);
    context.log.info(`Product: ${product}`); // Product: 30
    
    const difference = mathPlugin.subtract(100, 25);
    context.log.info(`Difference: ${difference}`); // Difference: 75
    
    const quotient = mathPlugin.divide(100, 4);
    context.log.info(`Quotient: ${quotient}`); // Quotient: 25

    // ✅ Puedes acceder a otros plugins también
    const textPlugin = await context.getPlugin('text-plugin');
    
    if (textPlugin) {
      const upper = textPlugin.toUpperCase('hello world');
      context.log.info(`Uppercase: ${upper}`); // Uppercase: HELLO WORLD
      
      const lower = textPlugin.toLowerCase('HELLO WORLD');
      context.log.info(`Lowercase: ${lower}`); // Lowercase: hello world
      
      const reversed = textPlugin.reverse('hello');
      context.log.info(`Reversed: ${reversed}`); // Reversed: olleh
    }

    // ✅ TypeScript mostrará error si intentas usar un método que no existe
    // mathPlugin.nonExistentMethod(); // ❌ Error: Property 'nonExistentMethod' does not exist

    // ✅ También puedes usar el plugin de action registry
    const actionRegistry = await context.getPlugin('action-registry');
    
    if (actionRegistry) {
      // Registrar una acción personalizada
      actionRegistry.registerAction('custom-math', (a: number, b: number) => {
        return a * b + a + b;
      });
      
      // Listar todas las acciones disponibles
      const actions = actionRegistry.listActions();
      context.log.info(`Available actions: ${actions.join(', ')}`);
      
      // Ejecutar la acción personalizada
      const result = actionRegistry.executeAction('custom-math', 5, 3);
      context.log.info(`Custom math result: ${result}`); // Custom math result: 23
    }
  },

  onUnload() {
    // Cleanup si es necesario
  }
});
