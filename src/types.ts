import { z } from "zod";
export interface PluginResource {
    workers: Worker[];
    timers: { id: number | Timer; type: 'timeout' | 'interval' }[];
    eventListeners: { event: string; listener: Function }[];
}

export interface HookRegistry<T> {
    filter: RegExp;
    callback: T;
    pluginName: string;
    order?: 'pre' | 'post';
}
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
  // Legacy/Direct event methods
  emit<K extends keyof AppEvents>(event: K, payload: AppEvents[K]): void;
  on<K extends keyof AppEvents>(event: K, callback: EventCallback<AppEvents[K]>): void;
  
  // Namespaced Event Bus
  events: {
    emit<K extends keyof AppEvents>(event: K, payload: AppEvents[K]): void;
    on<K extends keyof AppEvents>(event: K, callback: EventCallback<AppEvents[K]>): void;
  };

  storage: IPluginStorage;
  config: Record<string, any>;
  manager: any; 
  
  // Access to other plugins' shared APIs
  getPlugin(name: string): unknown | undefined;

  // Scoped Logger
  log: Logger;

  // Worker Management
  createWorker(url: string | URL, options?: BunWorkerOptions): BunWorker;
  
  // Security / Capabilities
  network: {
      fetch: (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
  };
  // Filesystem Proxy
  file: (path: string) => any; // Returns BunFile-like object

  env: Record<string, string | undefined>;

  // Timers
  setTimeout: (callback: (...args: any[]) => void, delay?: number, ...args: any[]) => number | Timer;
  setInterval: (callback: (...args: any[]) => void, delay?: number, ...args: any[]) => number | Timer;
  clearTimeout: (id: number | Timer) => void;
  clearInterval: (id: number | Timer) => void;
}

export interface BunWorkerOptions extends WorkerOptions {
    smol?: boolean;
    preload?: string[] | string;
    ref?: boolean;
    env?: Record<string, string>; // Support environment data
}

export interface BunWorker extends Worker {
    ref(): void;
    unref(): void;
}


export class AccessDeniedError extends Error {
    constructor(permission: string, pluginName: string) {
        super(`Plugin '${pluginName}' tried to access '${permission}' but does not have permission.`);
        this.name = "AccessDeniedError";
    }
}

// Validation schema for a basic plugin structure if needed
export const BasicPluginSchema = z.object({
  name: z.string(),
  version: z.string(),
});

export interface IPlugin {
  name: string;
  version: string;
  description?: string;
  author?: string;
  
  engines?: {
      host?: string; // Host application version
  };

  configSchema?: z.ZodSchema;
  defaultConfig?: Record<string, any>;

  // Dependency Management
  dependencies?: Record<string, string>; // e.g. { "other-plugin": "^1.0.0" }

  // Permissions
  permissions?: ('network' | 'filesystem' | 'env')[];
  allowedDomains?: string[]; // Whitelist for network access

  onLoad(context: PluginContext): Promise<void> | void;
  onStarted?: () => Promise<void> | void; // New Lifecycle Hook
  onUnload(): Promise<void> | void;
  
  // Method to expose a shared API to other plugins
  getSharedApi?: () => unknown;

  // 4. System Configuration Hook (Bun/esbuild style)
  setup?: (build: PluginBuilder) => void | Promise<void>;
}

export type OnResolveArgs = { path: string; importer?: string; namespace?: string };
export type OnResolveResult = { path: string; namespace?: string } | undefined | null;
export type OnResolveCallback = (args: OnResolveArgs) => OnResolveResult | Promise<OnResolveResult>;

export type OnLoadArgs = { path: string; namespace?: string; previousContents?: string };
export type OnLoadResult = { contents: string; loader?: string } | undefined | null;
export type OnLoadCallback = (args: OnLoadArgs) => OnLoadResult | Promise<OnLoadResult>;

export interface PluginBuilder {
  onResolve(filter: RegExp, callback: OnResolveCallback, options?: { order?: 'pre' | 'post' }): void;
  onLoad(filter: RegExp, callback: OnLoadCallback, options?: { order?: 'pre' | 'post' }): void;
}
