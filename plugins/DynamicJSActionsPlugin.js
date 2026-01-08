/**
 * Plugin dinámico de JavaScript que registra acciones en ActionRegistry
 * Se carga automáticamente y registra acciones usando loadPluginsFromDirectory
 */

export class DynamicJSActionsPlugin {
  constructor() {
    this.name = "dynamic-js-actions";
    this.version = "1.0.0";
    this.dependencies = {
      "action-registry": "1.0.0"
    };
  }

  async onLoad(context) {
    await this.registerActions(context);
  }

  async registerActions(context) {
    try {
      // Obtener el ActionRegistry del contexto compartido
      const actionRegistry = await context.getPlugin("action-registry");
      
      if (actionRegistry) {
        // Registrar acciones de JavaScript
        actionRegistry.registerAction("js-greet", (name) => {
          return `¡Hola ${name} desde JavaScript!`;
        });
        
        actionRegistry.registerAction("js-random-int", (min, max) => {
          return Math.floor(Math.random() * (max - min + 1)) + min;
        });
        
        actionRegistry.registerAction("js-reverse-words", (text) => {
          return text.split(' ').reverse().join(' ');
        });
        
        actionRegistry.registerAction("js-count-vowels", (text) => {
          return (text.match(/[aeiouáéíóú]/gi) || []).length;
        });
        
        context.log.info("JavaScript actions registered");
      } else {
        context.log.error("ActionRegistry not available, actions will not be registered");
      }
    } catch (error) {
      context.log.error("Error registering JavaScript actions:", error);
    }
  }

  onUnload() {
    // Cleanup is handled by the plugin manager
  }

  // Informar qué acciones proporciona este plugin
  getApi() {
    return {
      name: this.name,
      actions: ["js-greet", "js-random-int", "js-reverse-words", "js-count-vowels"],
      type: "javascript-actions",
      loaded: "dynamically"
    };
  }
}
