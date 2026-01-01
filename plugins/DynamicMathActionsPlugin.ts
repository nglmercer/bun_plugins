/**
 * Plugin dinámico de acciones matemáticas
 * Se carga automáticamente y registra acciones en ActionRegistry
 */

import type { IPlugin, PluginContext } from "../src";

export class DynamicMathActionsPlugin implements IPlugin {
  name = "dynamic-math-actions";
  version = "1.0.0";

  dependencies = {
    "action-registry": "1.0.0"
  };

  onLoad(context: PluginContext) {
    this.registerActions(context);
  }

  private registerActions(context: PluginContext) {
    try {
      // Obtener el ActionRegistry del contexto compartido
      const actionRegistry = context.getPlugin("action-registry") as any;
      
      if (actionRegistry) {
        // Registrar acciones matemáticas
        actionRegistry.registerAction("sum", (a: number, b: number) => {
          return a + b;
        });
        
        actionRegistry.registerAction("multiply", (a: number, b: number) => {
          return a * b;
        });
        
        actionRegistry.registerAction("power", (base: number, exponent: number) => {
          return Math.pow(base, exponent);
        });
        
        actionRegistry.registerAction("factorial", (n: number) => {
          if (n < 0) return NaN;
          if (n === 0) return 1;
          let result = 1;
          for (let i = 1; i <= n; i++) {
            result *= i;
          }
          return result;
        });
        
        context.log.info("Math actions registered");
      } else {
        context.log.error("ActionRegistry not available, actions will not be registered");
      }
    } catch (error) {
      context.log.error("Error registering math actions:", error);
    }
  }

  onUnload() {
    // Cleanup is handled by the plugin manager
  }

  // Informar qué acciones proporciona este plugin
  getSharedApi() {
    return {
      name: this.name,
      actions: ["sum", "multiply", "power", "factorial"],
      type: "math-actions",
      loaded: "dynamically"
    };
  }
}
