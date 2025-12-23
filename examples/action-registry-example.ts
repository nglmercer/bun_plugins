/**
 * Ejemplo de Action Registry con el sistema de plugins
 * 
 * Este ejemplo demuestra cómo usar el sistema de plugins para registrar
 * acciones en un mapa de funciones, donde cada plugin puede registrar
 * sus propios manejadores de acciones.
 */

import { PluginManager } from "../src/PluginManager";
import type { IPlugin, PluginContext } from "../src/types";

// Definimos el tipo para los manejadores de acciones
type EngineActionHandler = (...args: any[]) => any;

// Clase que maneja el registro de acciones
class ActionRegistry {
  protected actionHandlers: Map<string, EngineActionHandler> = new Map();

  // Método para registrar acciones
  registerAction(type: string, handler: EngineActionHandler): void {
    this.actionHandlers.set(type, handler);
    console.log(`[ActionRegistry] Acción registrada: ${type}`);
  }

  // Método para ejecutar acciones
  executeAction(type: string, ...args: any[]): any {
    const handler = this.actionHandlers.get(type);
    if (!handler) {
      throw new Error(`Acción no encontrada: ${type}`);
    }
    console.log(`[ActionRegistry] Ejecutando acción: ${type}`);
    return handler(...args);
  }

  // Método para listar acciones registradas
  listActions(): string[] {
    return Array.from(this.actionHandlers.keys());
  }

  // Método para verificar si una acción existe
  hasAction(type: string): boolean {
    return this.actionHandlers.has(type);
  }
}

// Plugin que registra acciones de matemáticas
class MathActionsPlugin implements IPlugin {
  name = "math-actions";
  version = "1.0.0";

  onLoad(context: PluginContext) {
    // Obtenemos el registro de acciones del contexto compartido
    const actionRegistry = context.getPlugin("action-registry") as ActionRegistry;
    
    if (actionRegistry) {
      // Registramos acciones matemáticas
      actionRegistry.registerAction("sum", (a: number, b: number) => a + b);
      actionRegistry.registerAction("multiply", (a: number, b: number) => a * b);
      actionRegistry.registerAction("power", (base: number, exponent: number) => Math.pow(base, exponent));
      
      context.log.info("Acciones matemáticas registradas");
    } else {
      context.log.error("ActionRegistry no encontrado");
    }
  }

  onUnload() {
    console.log("MathActionsPlugin: Limpiando acciones matemáticas");
  }

  // Exponemos el API compartido
  getSharedApi() {
    return {
      name: this.name,
      actions: ["sum", "multiply", "power"]
    };
  }
}

// Plugin que registra acciones de texto
class TextActionsPlugin implements IPlugin {
  name = "text-actions";
  version = "1.0.0";

  onLoad(context: PluginContext) {
    const actionRegistry = context.getPlugin("action-registry") as ActionRegistry;
    
    if (actionRegistry) {
      // Registramos acciones de texto
      actionRegistry.registerAction("uppercase", (text: string) => text.toUpperCase());
      actionRegistry.registerAction("lowercase", (text: string) => text.toLowerCase());
      actionRegistry.registerAction("reverse", (text: string) => text.split('').reverse().join(''));
      actionRegistry.registerAction("wordCount", (text: string) => text.split(/\s+/).length);
      
      context.log.info("Acciones de texto registradas");
    }
  }

  onUnload() {
    console.log("TextActionsPlugin: Limpiando acciones de texto");
  }

  getSharedApi() {
    return {
      name: this.name,
      actions: ["uppercase", "lowercase", "reverse", "wordCount"]
    };
  }
}

// Plugin que registra acciones de utilidad
class UtilityActionsPlugin implements IPlugin {
  name = "utility-actions";
  version = "1.0.0";

  onLoad(context: PluginContext) {
    const actionRegistry = context.getPlugin("action-registry") as ActionRegistry;
    
    if (actionRegistry) {
      // Registramos acciones de utilidad
      actionRegistry.registerAction("random", (min: number, max: number) => 
        Math.floor(Math.random() * (max - min + 1)) + min
      );
      actionRegistry.registerAction("timestamp", () => Date.now());
      actionRegistry.registerAction("delay", async (ms: number) => {
        await new Promise(resolve => setTimeout(resolve, ms));
        return `Esperado ${ms}ms`;
      });
      
      context.log.info("Acciones de utilidad registradas");
    }
  }

  onUnload() {
    console.log("UtilityActionsPlugin: Limpiando acciones de utilidad");
  }

  getSharedApi() {
    return {
      name: this.name,
      actions: ["random", "timestamp", "delay"]
    };
  }
}

// Plugin principal que proporciona el ActionRegistry
class ActionRegistryPlugin implements IPlugin {
  name = "action-registry";
  version = "1.0.0";
  private actionRegistry: ActionRegistry;

  constructor() {
    this.actionRegistry = new ActionRegistry();
  }

  onLoad(context: PluginContext) {
    context.log.info("ActionRegistry inicializado");
    
    // Hacemos el registro disponible para otros plugins
    // Los otros plugins pueden acceder a través de context.getPlugin("action-registry")
  }

  onUnload() {
    console.log("ActionRegistryPlugin: Limpiando registro de acciones");
    this.actionRegistry.listActions().forEach(action => {
      this.actionRegistry.registerAction(action, () => {
        throw new Error(`Acción ${action} no disponible - plugin desactivado`);
      });
    });
  }

  // Exponemos el ActionRegistry como API compartida
  getSharedApi() {
    return this.actionRegistry;
  }

  // Método helper para obtener el registro (usado internamente)
  getRegistry() {
    return this.actionRegistry;
  }
}

// Función principal de demostración
async function demonstrateActionRegistry() {
  console.log("\n🚀 Iniciando demostración de Action Registry con Plugins\n");

  // Crear el PluginManager
  const manager = new PluginManager();

  // Registrar el plugin principal del ActionRegistry
  const registryPlugin = new ActionRegistryPlugin();
  await manager.register(registryPlugin);

  // Registrar los plugins de acciones
  await manager.register(new MathActionsPlugin());
  await manager.register(new TextActionsPlugin());
  await manager.register(new UtilityActionsPlugin());

  console.log("\n📋 Acciones disponibles:");
  const registry = registryPlugin.getRegistry();
  const actions = registry.listActions();
  actions.forEach(action => {
    console.log(`  - ${action}`);
  });

  console.log("\n🧪 Ejecutando acciones:\n");

  // Ejecutar algunas acciones matemáticas
  try {
    console.log("🔢 Acciones matemáticas:");
    console.log(`  sum(5, 3) = ${registry.executeAction("sum", 5, 3)}`);
    console.log(`  multiply(4, 7) = ${registry.executeAction("multiply", 4, 7)}`);
    console.log(`  power(2, 8) = ${registry.executeAction("power", 2, 8)}`);
  } catch (error) {
    console.error("Error en acciones matemáticas:", error);
  }

  // Ejecutar algunas acciones de texto
  try {
    console.log("\n📝 Acciones de texto:");
    console.log(`  uppercase("hola mundo") = "${registry.executeAction("uppercase", "hola mundo")}"`);
    console.log(`  reverse("javascript") = "${registry.executeAction("reverse", "javascript")}"`);
    console.log(`  wordCount("hola mundo desde plugin") = ${registry.executeAction("wordCount", "hola mundo desde plugin")}`);
  } catch (error) {
    console.error("Error en acciones de texto:", error);
  }

  // Ejecutar algunas acciones de utilidad
  try {
    console.log("\n🛠️ Acciones de utilidad:");
    console.log(`  random(1, 100) = ${registry.executeAction("random", 1, 100)}`);
    console.log(`  timestamp() = ${registry.executeAction("timestamp")}`);
    
    // Acción asíncrona
    console.log("  delay(1000ms)...");
    const delayResult = await registry.executeAction("delay", 1000);
    console.log(`  delay result: ${delayResult}`);
  } catch (error) {
    console.error("Error en acciones de utilidad:", error);
  }

  // Verificar acciones individuales por plugin
  console.log("\n🔍 Acciones por plugin:");
  const mathPlugin = manager.getPlugin("math-actions");
  const textPlugin = manager.getPlugin("text-actions");
  const utilityPlugin = manager.getPlugin("utility-actions");

  if (mathPlugin?.getSharedApi) {
    const mathApi = mathPlugin.getSharedApi() as any;
    console.log(`  ${mathApi.name}: ${mathApi.actions.join(", ")}`);
  }

  if (textPlugin?.getSharedApi) {
    const textApi = textPlugin.getSharedApi() as any;
    console.log(`  ${textApi.name}: ${textApi.actions.join(", ")}`);
  }

  if (utilityPlugin?.getSharedApi) {
    const utilityApi = utilityPlugin.getSharedApi() as any;
    console.log(`  ${utilityApi.name}: ${utilityApi.actions.join(", ")}`);
  }

  // Probar manejo de errores
  console.log("\n❌ Prueba de manejo de errores:");
  try {
    registry.executeAction("non-existent-action");
  } catch (error) {
    console.log(`  Error capturado correctamente: ${(error as Error).message}`);
  }

  // Verificar si existen acciones específicas
  console.log("\n✅ Verificación de acciones:");
  console.log(`  ¿Existe 'sum'? ${registry.hasAction("sum")}`);
  console.log(`  ¿Existe 'non-existent'? ${registry.hasAction("non-existent")}`);

  console.log("\n👋 Desactivando plugins...\n");

  // Desactivar plugins en orden inverso
  await manager.unregister("utility-actions");
  await manager.unregister("text-actions");
  await manager.unregister("math-actions");
  await manager.unregister("action-registry");

  console.log("✅ Demostración completada\n");
}

// Ejecutar la demostración si se corre directamente
if (import.meta.main) {
  demonstrateActionRegistry().catch(console.error);
}

export { 
  ActionRegistry, 
  ActionRegistryPlugin, 
  MathActionsPlugin, 
  TextActionsPlugin, 
  UtilityActionsPlugin,
  demonstrateActionRegistry 
};