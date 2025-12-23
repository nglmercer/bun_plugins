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

  onLoad(context) {
    this.registerActions(context);
  }

  registerActions(context) {
    try {
      // Obtener el ActionRegistry del contexto compartido
      const actionRegistry = context.getPlugin("action-registry");
      
      if (actionRegistry) {
        // Registrar acciones de JavaScript
        actionRegistry.registerAction("js-greet", (name) => {
          console.log(`[DynamicJS] Saludando a: ${name}`);
          return `¡Hola ${name} desde JavaScript!`;
        });
        
        actionRegistry.registerAction("js-random-int", (min, max) => {
          console.log(`[DynamicJS] Generando número aleatorio entre ${min} y ${max}`);
          return Math.floor(Math.random() * (max - min + 1)) + min;
        });
        
        actionRegistry.registerAction("js-reverse-words", (text) => {
          console.log(`[DynamicJS] Invirtiendo palabras en: "${text}"`);
          return text.split(' ').reverse().join(' ');
        });
        
        actionRegistry.registerAction("js-count-vowels", (text) => {
          console.log(`[DynamicJS] Contando vocales en: "${text}"`);
          return (text.match(/[aeiouáéíóú]/gi) || []).length;
        });
        
        context.log.info("Acciones JavaScript dinámicas registradas");
        console.log("🟨 Plugin de acciones JavaScript cargado dinámicamente");
      } else {
        console.error("ActionRegistry no disponible, las acciones no se registrarán");
      }
    } catch (error) {
      console.error("Error registrando acciones JavaScript:", error);
    }
  }

  onUnload() {
    console.log("DynamicJSActionsPlugin: Desactivando acciones JavaScript");
  }

  // Informar qué acciones proporciona este plugin
  getSharedApi() {
    return {
      name: this.name,
      actions: ["js-greet", "js-random-int", "js-reverse-words", "js-count-vowels"],
      type: "javascript-actions",
      loaded: "dynamically"
    };
  }
}
