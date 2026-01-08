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
  }

  // Método para ejecutar acciones
  executeAction(type: string, ...args: any[]): any {
    const handler = this.actionHandlers.get(type);
    if (!handler) {
      throw new Error(`Acción no encontrada: ${type}`);
    }
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
  }

  onLoad(context: PluginContext) {
    context.log.info("ActionRegistry initialized");
    
    // Register the API manually using the new system
    context.registerApi({
      registerAction: this.actionRegistry.registerAction.bind(this.actionRegistry),
      executeAction: this.actionRegistry.executeAction.bind(this.actionRegistry),
      listActions: this.actionRegistry.listActions.bind(this.actionRegistry),
      hasAction: this.actionRegistry.hasAction.bind(this.actionRegistry),
      actions: this.actionRegistry.listActions()
    });
  }

  onUnload() {
    // Cleanup is handled by the plugin manager
  }
}
