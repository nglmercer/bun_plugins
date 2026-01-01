/**
 * Plugin dinámico de acciones de texto
 * Se carga automáticamente y registra acciones en ActionRegistry
 */

import type { IPlugin, PluginContext } from "../src";

export class DynamicTextActionsPlugin implements IPlugin {
  name = "dynamic-text-actions";
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
        // Registrar acciones de texto
        actionRegistry.registerAction("uppercase", (text: string) => {
          return text.toUpperCase();
        });
        
        actionRegistry.registerAction("lowercase", (text: string) => {
          return text.toLowerCase();
        });
        
        actionRegistry.registerAction("reverse", (text: string) => {
          return text.split('').reverse().join('');
        });
        
        actionRegistry.registerAction("wordCount", (text: string) => {
          return text.trim().split(/\s+/).filter(word => word.length > 0).length;
        });
        
        actionRegistry.registerAction("capitalizeWords", (text: string) => {
          return text.replace(/\b\w/g, char => char.toUpperCase());
        });
        
        context.log.info("Text actions registered");
      } else {
        context.log.error("ActionRegistry not available, actions will not be registered");
      }
    } catch (error) {
      context.log.error("Error registering text actions:", error);
    }
  }

  onUnload() {
    // Cleanup is handled by the plugin manager
  }

  // Informar qué acciones proporciona este plugin
  getSharedApi() {
    return {
      name: this.name,
      actions: ["uppercase", "lowercase", "reverse", "wordCount", "capitalizeWords"],
      type: "text-actions",
      loaded: "dynamically"
    };
  }
}
