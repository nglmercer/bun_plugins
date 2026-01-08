/**
 * Plugin dinámico de acciones de utilidad
 * Se carga automáticamente y registra acciones en ActionRegistry
 */

import type { IPlugin, PluginContext } from "../src";

export class DynamicUtilityActionsPlugin implements IPlugin {
  name = "dynamic-utility-actions";
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
        // Registrar acciones de utilidad
        actionRegistry.registerAction("random", (min: number, max: number) => {
          return Math.floor(Math.random() * (max - min + 1)) + min;
        });
        
        actionRegistry.registerAction("timestamp", () => {
          return Date.now();
        });
        
        actionRegistry.registerAction("delay", async (ms: number) => {
          await new Promise(resolve => setTimeout(resolve, ms));
          return `Delayed ${ms}ms`;
        });
        
        actionRegistry.registerAction("uuid", () => {
          return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
          });
        });
        
        actionRegistry.registerAction("formatDate", (date: Date, format: string) => {
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          const hours = String(date.getHours()).padStart(2, '0');
          const minutes = String(date.getMinutes()).padStart(2, '0');
          const seconds = String(date.getSeconds()).padStart(2, '0');
          
          return format
            .replace('YYYY', year.toString())
            .replace('MM', month)
            .replace('DD', day)
            .replace('HH', hours)
            .replace('mm', minutes)
            .replace('ss', seconds);
        });
        
        context.log.info("Utility actions registered");
      } else {
        context.log.error("ActionRegistry not available, actions will not be registered");
      }
    } catch (error) {
      context.log.error("Error registering utility actions:", error);
    }
  }

  onUnload() {
    // Cleanup is handled by the plugin manager
  }

  // Informar qué acciones proporciona este plugin
  getApi() {
    return {
      name: this.name,
      actions: ["random", "timestamp", "delay", "uuid", "formatDate"],
      type: "utility-actions",
      loaded: "dynamically"
    };
  }
}
