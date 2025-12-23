/**
 * Plugin principal ActionRegistry para carga dinámica
 * Este plugin proporciona el registro de acciones compartido
 */

import type { IPlugin, PluginContext } from "../src";

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
export class ActionRegistryPlugin implements IPlugin {
  name = "action-registry";
  version = "1.0.0";
  private actionRegistry: ActionRegistry;

  constructor() {
    this.actionRegistry = new ActionRegistry();
    console.log("ActionRegistryPlugin: Constructor ejecutado, ActionRegistry creado");
    
    // Enlazar el método getSharedApi para mantener el contexto correcto
    this.getSharedApi = this.getSharedApi.bind(this);
  }

  onLoad(context: PluginContext) {
    context.log.info("ActionRegistry dinámico inicializado");
    console.log("🎯 ActionRegistry listo para recibir acciones de otros plugins");
    console.log("ActionRegistryPlugin: onLoad ejecutado, getSharedApi debería estar disponible");
  }

  onUnload() {
    console.log("ActionRegistryPlugin: Limpiando registro de acciones");
  }

  // Exponemos el ActionRegistry como API compartida
  getSharedApi() {
    console.log("ActionRegistryPlugin: getSharedApi() llamado, retornando:", this.actionRegistry);
    return {
      registerAction: this.actionRegistry.registerAction.bind(this.actionRegistry),
      executeAction: this.actionRegistry.executeAction.bind(this.actionRegistry),
      listActions: this.actionRegistry.listActions.bind(this.actionRegistry),
      hasAction: this.actionRegistry.hasAction.bind(this.actionRegistry),
      actions: this.actionRegistry.listActions()
    };
  }
}