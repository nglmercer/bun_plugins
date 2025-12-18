import { z } from "zod";

// Define a global map of events for type safety
// Users can use declaration merging to extend this interface
export interface AppEvents {
  "log": { level: "info" | "error" | "warn"; message: string };
  "cmd:input": { command: string; args: string[] };
  [key: string]: any; // Allow loose typing for flexibility if needed, or remove for strictness
}

export type EventCallback<T> = (payload: T) => void | Promise<void>;

export interface IPluginStorage {
  get<T>(key: string, defaultValue?: T): Promise<T | undefined>;
  set<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
}

export interface Logger {
    info(msg: string, ...args: any[]): void;
    warn(msg: string, ...args: any[]): void;
    error(msg: string, ...args: any[]): void;
}

export interface PluginContext {
  // Method to emit events to the system
  emit<K extends keyof AppEvents>(event: K, payload: AppEvents[K]): void;
  // Method to listen to events from the system
  on<K extends keyof AppEvents>(event: K, callback: EventCallback<AppEvents[K]>): void;
  
  storage: IPluginStorage;
  config: Record<string, any>;
  manager: any; // Using any to avoid circular dependency issues in types, though interface retrieval is better
  
  // Access to other plugins' shared APIs
  getPlugin(name: string): unknown | undefined;

  // Scoped Logger
  log: Logger;

  // Worker Management
  createWorker(url: string | URL, options?: WorkerOptions): Worker;
  
  // Security / Capabilities
  network: {
      fetch: (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
  };
  env: Record<string, string | undefined>;
}

export class AccessDeniedError extends Error {
    constructor(permission: string, pluginName: string) {
        super(`Plugin '${pluginName}' tried to access '${permission}' but does not have permission.`);
        this.name = "AccessDeniedError";
    }
}

// Validation schema for a basic plugin structure if needed
export const PluginSchema = z.object({
  name: z.string(),
  version: z.string(),
  // We can't validate functions easily with Zod schema for types, 
  // but we can check if they exist in runtime validator
});

export interface IPlugin {
  name: string;
  version: string;
  description?: string;
  author?: string;
  
  configSchema?: z.ZodSchema;
  defaultConfig?: Record<string, any>;

  // Dependency Management
  dependencies?: Record<string, string>; // e.g. { "other-plugin": "^1.0.0" }

  // Permissions (Placeholder for future implementation)
  permissions?: ('network' | 'filesystem' | 'env')[];

  onLoad(context: PluginContext): Promise<void> | void;
  onUnload(): Promise<void> | void;
  
  // Method to expose a shared API to other plugins
  getSharedApi?: () => unknown;

  // 4. System Configuration Hook (Bun/esbuild style)
  setup?: (build: PluginBuilder) => void | Promise<void>;
}

export type OnResolveArgs = { path: string; importer?: string; namespace?: string };
export type OnResolveResult = { path: string; namespace?: string } | undefined | null;
export type OnResolveCallback = (args: OnResolveArgs) => OnResolveResult | Promise<OnResolveResult>;

export type OnLoadArgs = { path: string; namespace?: string };
export type OnLoadResult = { contents: string; loader?: string } | undefined | null;
export type OnLoadCallback = (args: OnLoadArgs) => OnLoadResult | Promise<OnLoadResult>;

export interface PluginBuilder {
  onResolve(filter: RegExp, callback: OnResolveCallback): void;
  onLoad(filter: RegExp, callback: OnLoadCallback): void;
}
