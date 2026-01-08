import type {
  PluginContext,
  IPlugin,
  AppEvents,
  EventCallback,
} from "../types";
import type { PluginManager } from "../PluginManager";
import type { ResourceManager } from "./ResourceManager";
import { type IPluginStorage } from "../types";
import {
  checkNetworkPermission,
  checkPermission as checkGeneralPermission,
} from "../utils/security";
import { logger } from "../logger";

export function createPluginContext(
  manager: PluginManager,
  plugin: IPlugin,
  resources: ResourceManager,
  storage: IPluginStorage,
): PluginContext {
  // We get the resource container directly.
  const pluginResources = resources.get(plugin.name);
  if (!pluginResources) throw new Error("Resources not initialized for plugin");

  const checkPermission = (
    perm: "network" | "filesystem" | "env",
    url?: string,
  ) => {
    if (perm === "network" && url) {
      checkNetworkPermission(
        plugin.name,
        plugin.permissions,
        plugin.allowedDomains,
        url,
      );
    } else if (perm === "filesystem" || perm === "env") {
      checkGeneralPermission(plugin.name, plugin.permissions, perm);
    }
  };

  return {
    manager: manager,
    storage,
    get config() {
      return manager.getPluginConfig(plugin.name);
    },
    // Legacy support
    emit: <K extends keyof AppEvents>(event: K, payload: AppEvents[K]) =>
      manager.emit(event, payload),
    on: <K extends keyof AppEvents>(
      event: K,
      callback: EventCallback<AppEvents[K]>,
    ) => {
      manager.on(event as string, callback);
      pluginResources.eventListeners.push({
        event: event as string,
        listener: callback,
      });
    },

    events: {
      emit: <K extends keyof AppEvents>(event: K, payload: AppEvents[K]) =>
        manager.emit(event, payload),
      on: <K extends keyof AppEvents>(
        event: K,
        callback: EventCallback<AppEvents[K]>,
      ) => {
        manager.on(event as string, callback);
        pluginResources.eventListeners.push({
          event: event as string,
          listener: callback,
        });
      },
    },

    getPlugin: (<TName extends string>(name: TName) => {
      const p = manager.getPlugin(name);
      if (!p) return undefined;

      // Si el plugin tiene getApi, retornar la API compartida
      if (
        typeof p === "object" &&
        "getApi" in p &&
        typeof p.getApi === "function"
      ) {
        return p.getApi();
      }

      // Si es un plugin directo (no API compartida), retornar el plugin completo
      return p;
    }) as PluginContext["getPlugin"],
    log: logger.getLogger(plugin.name),
    createWorker: (url, options?) => {
      // Use the manager's worker factory to allow proper mocking in tests
      const workerFactory = manager.getWorkerFactory();
      const w = workerFactory(
        url,
        options,
      ) as unknown as import("../types").BunWorker;

      // Auto-cleanup when worker closes
      w.addEventListener?.("close", () => {
        const res = resources.get(plugin.name);
        if (res) {
          const index = res.workers.indexOf(w);
          if (index > -1) {
            res.workers.splice(index, 1);
          }
        }
      });

      // Also listen for exit event (Bun specific)
      w.addEventListener?.("exit", () => {
        const res = resources.get(plugin.name);
        if (res) {
          const index = res.workers.indexOf(w);
          if (index > -1) {
            res.workers.splice(index, 1);
          }
        }
      });

      w.addEventListener?.("error", (err: any) => {
        logger.getLogger(plugin.name).error(`Worker error:`, err.message);
      });

      resources.get(plugin.name)?.workers.push(w);
      return w;
    },
    setTimeout: (
      callback: (...args: any[]) => void,
      delay?: number,
      ...args: any[]
    ) => {
      const id = setTimeout(callback, delay, ...args);
      resources.get(plugin.name)?.timers.push({ id, type: "timeout" });
      return id;
    },
    setInterval: (
      callback: (...args: any[]) => void,
      delay?: number,
      ...args: any[]
    ) => {
      const id = setInterval(callback, delay, ...args);
      resources.get(plugin.name)?.timers.push({ id, type: "interval" });
      return id;
    },
    clearTimeout: (id: number | Timer) => {
      clearTimeout(id);
      // Removing from list logic omitted for speed, cleanup handles remainder
    },
    clearInterval: (id: number | Timer) => {
      clearInterval(id);
    },
    network: {
      fetch: (input, init) => {
        const urlStr =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.toString()
              : (input as Request).url;
        checkPermission("network", urlStr);
        return fetch(input, init);
      },
    },
    file: (path: string) => {
      checkPermission("filesystem");
      return Bun.file(path);
    },
    get env() {
      checkPermission("env");
      return new Proxy(process.env, {
        get(target, prop) {
          return Reflect.get(target, prop);
        },
        set() {
          throw new Error("Plugins cannot modify environment variables.");
        },
      });
    },
  };
}
