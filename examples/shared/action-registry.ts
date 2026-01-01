/**
 * Shared Action Registry - Declarative approach
 * Eliminates code duplication across examples
 */

export type ActionHandler = (...args: any[]) => any;

export interface ActionDefinition {
  name: string;
  handler: ActionHandler;
  description?: string;
}

export class ActionRegistry {
  protected handlers: Map<string, ActionHandler> = new Map();

  register(def: ActionDefinition): void {
    this.handlers.set(def.name, def.handler);
  }

  execute(name: string, ...args: any[]): any {
    const handler = this.handlers.get(name);
    if (!handler) {
      throw new Error(`Action not found: ${name}`);
    }
    return handler(...args);
  }

  list(): string[] {
    return Array.from(this.handlers.keys());
  }

  has(name: string): boolean {
    return this.handlers.has(name);
  }

  clear(): void {
    this.handlers.clear();
  }
}

// Declarative action definitions
export const createActionRegistry = () => new ActionRegistry();

export const defineActions = (category: string, actions: ActionDefinition[]) => {
  return {
    category,
    actions,
    register: (registry: ActionRegistry) => {
      actions.forEach(action => registry.register(action));
    }
  };
};

// Common action categories
export const mathActions = defineActions('math', [
  { name: 'sum', handler: (a: number, b: number) => a + b },
  { name: 'multiply', handler: (a: number, b: number) => a * b },
  { name: 'power', handler: (base: number, exp: number) => Math.pow(base, exp) },
  { name: 'sqrt', handler: (n: number) => Math.sqrt(n) }
]);

export const textActions = defineActions('text', [
  { name: 'uppercase', handler: (text: string) => text.toUpperCase() },
  { name: 'lowercase', handler: (text: string) => text.toLowerCase() },
  { name: 'reverse', handler: (text: string) => text.split('').reverse().join('') },
  { name: 'capitalize', handler: (text: string) => text.charAt(0).toUpperCase() + text.slice(1).toLowerCase() }
]);

export const utilityActions = defineActions('utility', [
  { name: 'random', handler: (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min },
  { name: 'timestamp', handler: () => Date.now() },
  { name: 'delay', handler: async (ms: number) => {
    await new Promise(resolve => setTimeout(resolve, ms));
    return `Delayed ${ms}ms`;
  }}
]);

export const validationActions = defineActions('validation', [
  { name: 'isEmail', handler: (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) },
  { name: 'isNumber', handler: (value: any) => !isNaN(parseFloat(value)) && isFinite(value) },
  { name: 'minLength', handler: (text: string, min: number) => text.length >= min },
  { name: 'maxLength', handler: (text: string, max: number) => text.length <= max }
]);
