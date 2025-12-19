
/**
 * State Manager
 * Handles persistent state across rule executions.
 * Allows for "Stateful Triggers" like counters, sequences, and goals.
 */
export class StateManager {
  private static instance: StateManager;
  private state: Map<string, any>;

  private constructor() {
    this.state = new Map();
  }

  static getInstance(): StateManager {
    if (!StateManager.instance) {
      StateManager.instance = new StateManager();
    }
    return StateManager.instance;
  }

  /**
   * Get a value from the state. Supports nested paths? 
   * For now, flat keys or simple dot notation could be supported by the caller,
   * but here we store raw values.
   */
  get(key: string): any {
    return this.state.get(key);
  }

  /**
   * Set a value in the state.
   */
  set(key: string, value: any): void {
    this.state.set(key, value);
  }

  /**
   * Increment a numeric value in the state.
   * Initialize to 0 if not exists.
   */
  increment(key: string, amount: number = 1): number {
    const current = this.get(key) || 0;
    const newVal = Number(current) + amount;
    this.set(key, newVal);
    return newVal;
  }
  
    /**
   * Decrement a numeric value.
   */
  decrement(key: string, amount: number = 1): number {
      return this.increment(key, -amount);
  }


  /**
   * Delete a key from state.
   */
  delete(key: string): boolean {
    return this.state.delete(key);
  }

  /**
   * Clear all state.
   */
  clear(): void {
    this.state.clear();
  }

  /**
   * Export state as a plain object (for Context injection).
   */
  getAll(): Record<string, any> {
    return Object.fromEntries(this.state);
  }
}
