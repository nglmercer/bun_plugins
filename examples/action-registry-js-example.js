/**
 * Ejemplo de Action Registry con Plugin JavaScript
 * 
 * Este ejemplo demuestra cómo usar el sistema de plugins con archivos JavaScript
 * para registrar acciones en un mapa de funciones.
 */

import { PluginManager } from "../src/PluginManager.js";

// Clase que maneja el registro de acciones
class ActionRegistry {
  constructor() {
    this.actionHandlers = new Map();
  }

  // Método para registrar acciones
  registerAction(type, handler) {
    this.actionHandlers.set(type, handler);
    console.log(`[ActionRegistry] Acción JS registrada: ${type}`);
  }

  // Método para ejecutar acciones
  executeAction(type, ...args) {
    const handler = this.actionHandlers.get(type);
    if (!handler) {
      throw new Error(`Acción JS no encontrada: ${type}`);
    }
    console.log(`[ActionRegistry] Ejecutando acción JS: ${type}`);
    return handler(...args);
  }

  // Método para listar acciones registradas
  listActions() {
    return Array.from(this.actionHandlers.keys());
  }

  // Método para verificar si una acción existe
  hasAction(type) {
    return this.actionHandlers.has(type);
  }
}

// Plugin JS que registra acciones de cálculo
export class CalculatorActionsPlugin {
  name = "calculator-actions-js";
  version = "1.0.0";

  onLoad(context) {
    // Obtenemos el registro de acciones del contexto compartido
    const actionRegistry = context.getPlugin("action-registry-js");
    
    if (actionRegistry) {
      // Registramos acciones de cálculo
      actionRegistry.registerAction("add", (a, b) => a + b);
      actionRegistry.registerAction("subtract", (a, b) => a - b);
      actionRegistry.registerAction("divide", (a, b) => {
        if (b === 0) throw new Error("División por cero");
        return a / b;
      });
      actionRegistry.registerAction("modulo", (a, b) => a % b);
      
      context.log.info("Acciones de calculadora JS registradas");
    } else {
      context.log.error("ActionRegistry JS no encontrado");
    }
  }

  onUnload() {
    console.log("CalculatorActionsPlugin JS: Limpiando acciones");
  }

  // Exponemos el API compartida
  getSharedApi() {
    return {
      name: this.name,
      actions: ["add", "subtract", "divide", "modulo"],
      language: "JavaScript"
    };
  }
}

// Plugin JS que registra acciones de transformación
export class TransformActionsPlugin {
  name = "transform-actions-js";
  version = "1.0.0";

  onLoad(context) {
    const actionRegistry = context.getPlugin("action-registry-js");
    
    if (actionRegistry) {
      // Registramos acciones de transformación
      actionRegistry.registerAction("capitalize", (text) => {
        return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
      });
      
      actionRegistry.registerAction("slugify", (text) => {
        return text.toLowerCase()
          .replace(/[^\w\s-]/g, '')
          .replace(/[\s_-]+/g, '-')
          .replace(/^-+|-+$/g, '');
      });
      
      actionRegistry.registerAction("repeat", (text, times) => {
        return text.repeat(times);
      });
      
      actionRegistry.registerAction("truncate", (text, maxLength) => {
        return text.length > maxLength ? text.slice(0, maxLength) + "..." : text;
      });
      
      context.log.info("Acciones de transformación JS registradas");
    }
  }

  onUnload() {
    console.log("TransformActionsPlugin JS: Limpiando acciones");
  }

  getSharedApi() {
    return {
      name: this.name,
      actions: ["capitalize", "slugify", "repeat", "truncate"],
      language: "JavaScript"
    };
  }
}

// Plugin JS que registra acciones de validación
export class ValidationActionsPlugin {
  name = "validation-actions-js";
  version = "1.0.0";

  onLoad(context) {
    const actionRegistry = context.getPlugin("action-registry-js");
    
    if (actionRegistry) {
      // Registramos acciones de validación
      actionRegistry.registerAction("isEmail", (email) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
      });
      
      actionRegistry.registerAction("isNumber", (value) => {
        return !isNaN(parseFloat(value)) && isFinite(value);
      });
      
      actionRegistry.registerAction("minLength", (text, minLength) => {
        return text.length >= minLength;
      });
      
      actionRegistry.registerAction("maxLength", (text, maxLength) => {
        return text.length <= maxLength;
      });
      
      context.log.info("Acciones de validación JS registradas");
    }
  }

  onUnload() {
    console.log("ValidationActionsPlugin JS: Limpiando acciones");
  }

  getSharedApi() {
    return {
      name: this.name,
      actions: ["isEmail", "isNumber", "minLength", "maxLength"],
      language: "JavaScript"
    };
  }
}

// Plugin principal JS que proporciona el ActionRegistry
export class ActionRegistryJSPlugin {
  name = "action-registry-js";
  version = "1.0.0";

  constructor() {
    this.actionRegistry = new ActionRegistry();
  }

  onLoad(context) {
    context.log.info("ActionRegistry JS inicializado");
  }

  onUnload() {
    console.log("ActionRegistryJSPlugin: Limpiando registro de acciones JS");
    // Limpiar todas las acciones
    this.actionRegistry.listActions().forEach(action => {
      this.actionRegistry.registerAction(action, () => {
        throw new Error(`Acción JS ${action} no disponible - plugin desactivado`);
      });
    });
  }

  // Exponemos el ActionRegistry como API compartida
  getSharedApi() {
    return this.actionRegistry;
  }

  // Método helper para obtener el registro
  getRegistry() {
    return this.actionRegistry;
  }
}

// Función principal de demostración
async function demonstrateJSActionRegistry() {
  console.log("\n🚀 Iniciando demostración de Action Registry con Plugins JavaScript\n");

  // Crear el PluginManager
  const manager = new PluginManager();

  // Registrar el plugin principal del ActionRegistry
  const registryPlugin = new ActionRegistryJSPlugin();
  await manager.register(registryPlugin);

  // Registrar los plugins de acciones JS
  await manager.register(new CalculatorActionsPlugin());
  await manager.register(new TransformActionsPlugin());
  await manager.register(new ValidationActionsPlugin());

  console.log("\n📋 Acciones JS disponibles:");
  const registry = registryPlugin.getRegistry();
  const actions = registry.listActions();
  actions.forEach(action => {
    console.log(`  - ${action}`);
  });

  console.log("\n🧪 Ejecutando acciones JavaScript:\n");

  // Ejecutar algunas acciones de cálculo
  try {
    console.log("🧮 Acciones de calculadora:");
    console.log(`  add(15, 25) = ${registry.executeAction("add", 15, 25)}`);
    console.log(`  subtract(100, 30) = ${registry.executeAction("subtract", 100, 30)}`);
    console.log(`  divide(20, 4) = ${registry.executeAction("divide", 20, 4)}`);
    console.log(`  modulo(17, 5) = ${registry.executeAction("modulo", 17, 5)}`);
  } catch (error) {
    console.error("Error en acciones de calculadora:", error);
  }

  // Ejecutar algunas acciones de transformación
  try {
    console.log("\n🔄 Acciones de transformación:");
    console.log(`  capitalize("hola mundo") = "${registry.executeAction("capitalize", "hola mundo")}"`);
    console.log(`  slugify("Hola Mundo Desde JS!") = "${registry.executeAction("slugify", "Hola Mundo Desde JS!")}"`);
    console.log(`  repeat("JS", 3) = "${registry.executeAction("repeat", "JS", 3)}"`);
    console.log(`  truncate("Este es un texto muy largo", 20) = "${registry.executeAction("truncate", "Este es un texto muy largo", 20)}"`);
  } catch (error) {
    console.error("Error en acciones de transformación:", error);
  }

  // Ejecutar algunas acciones de validación
  try {
    console.log("\n✅ Acciones de validación:");
    console.log(`  isEmail("test@example.com") = ${registry.executeAction("isEmail", "test@example.com")}`);
    console.log(`  isEmail("invalid-email") = ${registry.executeAction("isEmail", "invalid-email")}`);
    console.log(`  isNumber("123.45") = ${registry.executeAction("isNumber", "123.45")}`);
    console.log(`  isNumber("not-a-number") = ${registry.executeAction("isNumber", "not-a-number")}`);
    console.log(`  minLength("hello", 3) = ${registry.executeAction("minLength", "hello", 3)}`);
    console.log(`  maxLength("hello", 10) = ${registry.executeAction("maxLength", "hello", 10)}`);
  } catch (error) {
    console.error("Error en acciones de validación:", error);
  }

  // Probar manejo de errores
  console.log("\n❌ Prueba de manejo de errores:");
  try {
    registry.executeAction("divide", 10, 0); // División por cero
  } catch (error) {
    console.log(`  Error de división por cero capturado: ${error.message}`);
  }

  try {
    registry.executeAction("accion-inexistente");
  } catch (error) {
    console.log(`  Error de acción no encontrada capturado: ${error.message}`);
  }

  // Verificar acciones individuales por plugin
  console.log("\n🔍 Acciones por plugin JS:");
  const calcPlugin = manager.getPlugin("calculator-actions-js");
  const transformPlugin = manager.getPlugin("transform-actions-js");
  const validationPlugin = manager.getPlugin("validation-actions-js");

  if (calcPlugin?.getSharedApi) {
    const calcApi = calcPlugin.getSharedApi();
    console.log(`  ${calcApi.name} (${calcApi.language}): ${calcApi.actions.join(", ")}`);
  }

  if (transformPlugin?.getSharedApi) {
    const transformApi = transformPlugin.getSharedApi();
    console.log(`  ${transformApi.name} (${transformApi.language}): ${transformApi.actions.join(", ")}`);
  }

  if (validationPlugin?.getSharedApi) {
    const validationApi = validationPlugin.getSharedApi();
    console.log(`  ${validationApi.name} (${validationApi.language}): ${validationApi.actions.join(", ")}`);
  }

  console.log("\n👋 Desactivando plugins JS...\n");

  // Desactivar plugins en orden inverso
  await manager.unregister("validation-actions-js");
  await manager.unregister("transform-actions-js");
  await manager.unregister("calculator-actions-js");
  await manager.unregister("action-registry-js");

  console.log("✅ Demostración JS completada\n");
}

// Ejecutar la demostración si se corre directamente
if (import.meta.main) {
  demonstrateJSActionRegistry().catch(console.error);
}

// Las clases ya están exportadas arriba, solo exportamos la función de demostración
export { demonstrateJSActionRegistry };