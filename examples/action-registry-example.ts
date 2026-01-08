/**
 * Action Registry Example - Simple implementation for testing
 */

import type { IPlugin, PluginContext } from "../src/types";

type EngineActionHandler = (...args: any[]) => any;

class ActionRegistry {
  protected actionHandlers: Map<string, EngineActionHandler> = new Map();

  registerAction(type: string, handler: EngineActionHandler): void {
    this.actionHandlers.set(type, handler);
  }

  executeAction(type: string, ...args: any[]): any {
    const handler = this.actionHandlers.get(type);
    if (!handler) {
      throw new Error(`Acción no encontrada: ${type}`);
    }
    return handler(...args);
  }

  listActions(): string[] {
    return Array.from(this.actionHandlers.keys());
  }

  hasAction(type: string): boolean {
    return this.actionHandlers.has(type);
  }
}

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

export class MathActionsPlugin implements IPlugin {
  name = "math-actions";
  version = "1.0.0";
  dependencies = {
    "action-registry": "1.0.0"
  };

  async onLoad(context: PluginContext) {
    const actionRegistry = await context.getPlugin("action-registry") as any;
    
    if (actionRegistry) {
      actionRegistry.registerAction("sum", (a: number, b: number) => a + b);
      actionRegistry.registerAction("multiply", (a: number, b: number) => a * b);
      actionRegistry.registerAction("power", (base: number, exp: number) => Math.pow(base, exp));
      context.log.info("Math actions registered");
    }
  }

  onUnload() {
    // Cleanup is handled by the plugin manager
  }
}

export class TextActionsPlugin implements IPlugin {
  name = "text-actions";
  version = "1.0.0";
  dependencies = {
    "action-registry": "1.0.0"
  };

  async onLoad(context: PluginContext) {
    const actionRegistry = await context.getPlugin("action-registry") as any;
    
    if (actionRegistry) {
      actionRegistry.registerAction("uppercase", (text: string) => text.toUpperCase());
      actionRegistry.registerAction("lowercase", (text: string) => text.toLowerCase());
      actionRegistry.registerAction("reverse", (text: string) => text.split('').reverse().join(''));
      actionRegistry.registerAction("wordCount", (text: string) => text.trim().split(/\s+/).filter(word => word.length > 0).length);
      context.log.info("Text actions registered");
    }
  }

  onUnload() {
    // Cleanup is handled by the plugin manager
  }
}
