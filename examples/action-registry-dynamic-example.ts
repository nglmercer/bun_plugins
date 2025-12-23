/**
 * Ejemplo DINÁMICO de Action Registry con el sistema de plugins
 * 
 * Este ejemplo demuestra cómo usar loadPluginsFromDirectory para cargar
 * plugins dinámicamente que registran acciones en un mapa de funciones.
 * No requiere registro manual de plugins - todo es automático.
 */

import { PluginManager } from "../src/PluginManager";
import { join } from "node:path";

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

// Plugin principal que proporciona el ActionRegistry
// Este plugin debe estar en el directorio de plugins para ser cargado automáticamente
export class ActionRegistryPlugin {
  name = "action-registry";
  version = "1.0.0";
  private actionRegistry: ActionRegistry;

  constructor() {
    this.actionRegistry = new ActionRegistry();
  }

  onLoad(context: any) {
    context.log.info("ActionRegistry dinámico inicializado");
    console.log("\n🎯 ActionRegistry listo para recibir acciones de otros plugins");
  }

  onUnload() {
    console.log("ActionRegistryPlugin: Limpiando registro de acciones");
  }

  // Exponemos el ActionRegistry como API compartida
  getSharedApi() {
    return this.actionRegistry;
  }
}

// Función principal de demostración DINÁMICA
async function demonstrateDynamicActionRegistry() {
  console.log("\n🚀 Iniciando demostración DINÁMICA de Action Registry\n");
  console.log("📂 Cargando plugins automáticamente desde el directorio...\n");

  // Crear el PluginManager
  const manager = new PluginManager();

  // Cargar plugins automáticamente desde el directorio
  const pluginsDir = join(process.cwd(), "plugins");
  await manager.loadPluginsFromDirectory(pluginsDir);
  
  // Nota: El orden de carga depende del sistema de dependencias y el orden de archivos
  // Si los plugins de acciones necesitan ActionRegistry, deberían manejar
  // la situación donde no esté disponible aún (por ejemplo, reintentar más tarde)

  console.log("\n✅ Plugins cargados dinámicamente:");
  const loadedPlugins = manager.listPlugins();
  loadedPlugins.forEach(pluginName => {
    console.log(`  - ${pluginName}`);
  });

  // Buscar el ActionRegistryPlugin entre los plugins cargados
  const registryPlugin = manager.getPlugin("action-registry") as any;
  
  if (!registryPlugin) {
    console.error("❌ ActionRegistryPlugin no encontrado en los plugins cargados");
    console.log("💡 Asegúrate de que ActionRegistryPlugin esté en el directorio de plugins");
    return;
  }

  console.log("\n🔧 ActionRegistry encontrado y funcionando");

  // Obtener el registro de acciones
  const registry = registryPlugin.getSharedApi() as ActionRegistry;
  
  if (!registry) {
    console.error("❌ ActionRegistry no disponible en getSharedApi()");
    return;
  }

  console.log("\n📋 Acciones disponibles dinámicamente:");
  const actions = registry.listActions();
  if (actions.length === 0) {
    console.log("  (No hay acciones registradas aún)");
  } else {
    actions.forEach(action => {
      console.log(`  - ${action}`);
    });
  }

  console.log("\n🧪 Ejecutando acciones registradas dinámicamente:\n");

  // Ejecutar acciones si existen
  if (actions.length > 0) {
    // Intentar ejecutar algunas acciones comunes que podrían estar registradas
    const testActions = ["sum", "multiply", "uppercase", "reverse", "random", "timestamp"];
    
    for (const action of testActions) {
      if (registry.hasAction(action)) {
        try {
          let result;
          switch (action) {
            case "sum":
              result = registry.executeAction("sum", 10, 20);
              console.log(`  sum(10, 20) = ${result}`);
              break;
            case "multiply":
              result = registry.executeAction("multiply", 5, 6);
              console.log(`  multiply(5, 6) = ${result}`);
              break;
            case "uppercase":
              result = registry.executeAction("uppercase", "hola dinámico");
              console.log(`  uppercase("hola dinámico") = "${result}"`);
              break;
            case "reverse":
              result = registry.executeAction("reverse", "javascript");
              console.log(`  reverse("javascript") = "${result}"`);
              break;
            case "random":
              result = registry.executeAction("random", 1, 100);
              console.log(`  random(1, 100) = ${result}`);
              break;
            case "timestamp":
              result = registry.executeAction("timestamp");
              console.log(`  timestamp() = ${result}`);
              break;
          }
        } catch (error) {
          console.error(`  Error ejecutando ${action}:`, error);
        }
      }
    }
  } else {
    console.log("  ℹ️  No hay acciones registradas para demostrar");
    console.log("  💡 Los plugins de acciones deben estar en el directorio de plugins");
  }

  // Verificar qué plugins tienen acciones registradas
  console.log("\n🔍 Plugins con acciones registradas:");
  let hasActions = false;
  for (const pluginName of loadedPlugins) {
    const plugin = manager.getPlugin(pluginName);
    if (plugin?.getSharedApi) {
      const api = plugin.getSharedApi() as any;
      if (api && api.actions && Array.isArray(api.actions)) {
        console.log(`  - ${pluginName}: ${api.actions.join(", ")}`);
        hasActions = true;
      }
    }
  }
  
  if (!hasActions) {
    console.log("  (Ningún plugin ha registrado acciones)");
  }

  // Probar manejo de errores con acciones inexistentes
  console.log("\n❌ Prueba de manejo de errores:");
  try {
    registry.executeAction("accion-inexistente");
  } catch (error) {
    console.log(`  Error capturado correctamente: ${(error as Error).message}`);
  }

  // Verificar disponibilidad de acciones específicas
  console.log("\n✅ Verificación de acciones:");
  console.log(`  ¿Existe 'sum'? ${registry.hasAction("sum")}`);
  console.log(`  ¿Existe 'non-existent'? ${registry.hasAction("non-existent")}`);

  // Mostrar métricas del sistema
  console.log("\n📊 Métricas del sistema:");
  const metrics = manager.getMetrics();
  console.log(`  Total de plugins: ${metrics.totalPlugins}`);
  console.log(`  Plugins activos: ${metrics.activePlugins.join(", ")}`);
  console.log(`  Acciones registradas: ${actions.length}`);

  console.log("\n👋 Demostración dinámica completada");
  console.log("✅ El sistema ha cargado y ejecutado plugins automáticamente");
  console.log("✅ El ActionRegistry ha funcionado con carga dinámica");
}

// Ejecutar la demostración si se corre directamente
if (import.meta.main) {
  demonstrateDynamicActionRegistry().catch(console.error);
}

export { ActionRegistry, demonstrateDynamicActionRegistry };