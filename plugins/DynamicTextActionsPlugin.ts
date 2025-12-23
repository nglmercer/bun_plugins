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
          console.log(`[DynamicText] Convirtiendo a mayúsculas: "${text}"`);
          return text.toUpperCase();
        });
        
        actionRegistry.registerAction("lowercase", (text: string) => {
          console.log(`[DynamicText] Convirtiendo a minúsculas: "${text}"`);
          return text.toLowerCase();
        });
        
        actionRegistry.registerAction("reverse", (text: string) => {
          console.log(`[DynamicText] Invirtiendo texto: "${text}"`);
          return text.split('').reverse().join('');
        });
        
        actionRegistry.registerAction("wordCount", (text: string) => {
          console.log(`[DynamicText] Contando palabras en: "${text}"`);
          return text.trim().split(/\s+/).filter(word => word.length > 0).length;
        });
        
        actionRegistry.registerAction("capitalizeWords", (text: string) => {
          console.log(`[DynamicText] Capitalizando palabras: "${text}"`);
          return text.replace(/\b\w/g, char => char.toUpperCase());
        });
        
        context.log.info("Acciones de texto dinámicas registradas");
        console.log("📝 Plugin de acciones de texto cargado dinámicamente");
      } else {
        console.error("ActionRegistry no disponible, las acciones no se registrarán");
      }
    } catch (error) {
      console.error("Error registrando acciones de texto:", error);
    }
  }

  onUnload() {
    console.log("DynamicTextActionsPlugin: Desactivando acciones de texto");
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