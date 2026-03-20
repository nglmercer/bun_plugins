import { join, dirname } from "node:path";
import { mkdir } from "node:fs/promises";
import { watch, existsSync } from "node:fs";
import type { IPluginStorage } from "../types";
import { logger } from "../logger";

/**
 * JsonPluginStorage con soporte singleton para evitar múltiples instancias del mismo plugin.
 * Usa un Map estático para almacenar las instancias por nombre de plugin y basePath.
 */
export class JsonPluginStorage implements IPluginStorage {
  private static instances: Map<string, JsonPluginStorage> = new Map();
  
  private filePath: string;
  private data: Record<string, any> | null = null;
  private lastModified: number = 0;
  private watcher: ReturnType<typeof watch> | null = null;
  private watchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private onDataChangeCallbacks: Array<(data: Record<string, any>) => void> = [];

  /**
   * Obtiene una instancia singleton de JsonPluginStorage.
   * Si la instancia ya existe para el plugin dado, la reutiliza.
   * @param basePath Ruta base del storage
   * @param pluginName Nombre del plugin
   * @returns Instancia de JsonPluginStorage
   */
  static getInstance(basePath: string, pluginName: string): JsonPluginStorage {
    const key = `${basePath}:${pluginName}`;
    
    if (!JsonPluginStorage.instances.has(key)) {
      const instance = new JsonPluginStorage(basePath, pluginName);
      JsonPluginStorage.instances.set(key, instance);
      if (logger){
        logger.getLogger!("JsonPluginStorage").debug!(`Created new storage instance for ${pluginName}`);
      }
    }
    
    return JsonPluginStorage.instances.get(key)!;
  }

  /**
   * Obtiene todas las instancias registradas.
   */
  static getAllInstances(): Map<string, JsonPluginStorage> {
    return new Map(JsonPluginStorage.instances);
  }

  /**
   * Obtiene una instancia específica por nombre de plugin.
   * @param pluginName Nombre del plugin
   * @returns Instancia o undefined si no existe
   */
  static getInstanceByName(pluginName: string): JsonPluginStorage | undefined {
    for (const [key, instance] of JsonPluginStorage.instances) {
      if (key.endsWith(`:${pluginName}`)) {
        return instance;
      }
    }
    return undefined;
  }

  /**
   * Elimina una instancia específica.
   * @param basePath Ruta base del storage
   * @param pluginName Nombre del plugin
   */
  static removeInstance(basePath: string, pluginName: string): void {
    const key = `${basePath}:${pluginName}`;
    const instance = JsonPluginStorage.instances.get(key);
    if (instance) {
      instance.stopWatching(); // Limpiar watcher al eliminar
      JsonPluginStorage.instances.delete(key);
      if (logger){
        logger.getLogger!("JsonPluginStorage").debug!(`Removed storage instance for ${pluginName}`);
      }
    }
  }

  /**
   * Limpia todas las instancias (útil para testing).
   */
  static clearAllInstances(): void {
    for (const [key, instance] of JsonPluginStorage.instances) {
      instance.stopWatching();
    }
    JsonPluginStorage.instances.clear();
    if (!logger) return;
    logger.getLogger!("JsonPluginStorage").debug!(`Cleared all storage instances`);
  }

  private constructor(basePath: string, pluginName: string) {
    this.filePath = join(basePath, "plugins", pluginName, "storage.json");
  }

  private async ensureLoaded(force: boolean = false) {
    try {
      const file = Bun.file(this.filePath);
      const exists = await file.exists();
      
      if (!exists) {
        this.data = this.data || {};
        this.lastModified = 0;
        return;
      }

      const stats = await import("node:fs/promises").then(fs => fs.stat(this.filePath));
      const mtime = stats.mtimeMs;

      if (force || this.data === null || mtime > this.lastModified) {
        this.data = await file.json();
        this.lastModified = mtime;
      }
    } catch (e) {
      if (this.data === null) {
        logger.getLogger("JsonPluginStorage").error(`Failed to load storage for ${this.filePath}`, e);
        this.data = {};
      }
    }
  }

  private async save() {
    if (this.data === null) return;
    try {
        await mkdir(dirname(this.filePath), { recursive: true });
        const content = JSON.stringify(this.data, null, 2);
        await Bun.write(this.filePath, content);
        
        // Update local mtime to avoid immediate reload
        const stats = await import("node:fs/promises").then(fs => fs.stat(this.filePath));
        this.lastModified = stats.mtimeMs;
    } catch (e) {
        logger.getLogger("JsonPluginStorage").error(`Failed to save storage for ${this.filePath}`, e);
    }
  }

  async get<T>(key: string, defaultValue?: T): Promise<T | undefined> {
    await this.ensureLoaded();
    return (this.data?.[key] as T) ?? defaultValue;
  }

  async set<T>(key: string, value: T): Promise<void> {
    await this.ensureLoaded();
    if (this.data) {
        this.data[key] = value;
        await this.save();
    }
  }

  async delete(key: string): Promise<void> {
    await this.ensureLoaded();
    if (this.data) {
        delete this.data[key];
        await this.save();
    }
  }

  async clear(): Promise<void> {
    this.data = {};
    await this.save();
  }

  async reload(): Promise<void> {
      await this.ensureLoaded(true);
  }

  /**
   * init watch for storage file changes
   * When the file changes externally, the data will be reloaded automatically.
   * @param debounceMs Time to wait in ms before reloading (default: 100ms)
   */
  startWatching(debounceMs: number = 100): void {
    if (this.watcher) {
      logger.getLogger("JsonPluginStorage").warn(`Already watching ${this.filePath}`);
      return;
    }

    const dir = dirname(this.filePath);
    if (!existsSync(dir)) {
      logger.getLogger("JsonPluginStorage").warn(`Cannot watch non-existent directory: ${dir}`);
      return;
    }

    try {
      this.watcher = watch(dir, { persistent: false }, async (eventType, filename) => {
        if (filename && filename.endsWith('.json')) {
          // Debounce para evitar múltiples recargas rápidas
          if (this.watchDebounceTimer) {
            clearTimeout(this.watchDebounceTimer);
          }
          
          this.watchDebounceTimer = setTimeout(async () => {
            try {
              const oldData = this.data ? { ...this.data } : null;
              await this.ensureLoaded(true);
              
              // Notificar a los suscriptores si los datos cambiaron
              if (oldData && this.data && JSON.stringify(oldData) !== JSON.stringify(this.data)) {
                this.notifyDataChange(this.data);
                logger.getLogger("JsonPluginStorage").info(`Storage auto-reloaded for ${this.filePath}`);
              }
            } catch (e) {
              logger.getLogger("JsonPluginStorage").error(`Error auto-reloading storage:`, e);
            }
          }, debounceMs);
        }
      });
      
      logger.getLogger("JsonPluginStorage").info(`Started watching ${this.filePath}`);
    } catch (e) {
      logger.getLogger("JsonPluginStorage").error(`Failed to start watching ${this.filePath}:`, e);
    }
  }

  /**
   * stop watching for storage file changes
   */
  stopWatching(): void {
    if (this.watchDebounceTimer) {
      clearTimeout(this.watchDebounceTimer);
      this.watchDebounceTimer = null;
    }
    
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
      logger.getLogger("JsonPluginStorage").info(`Stopped watching ${this.filePath}`);
    }
  }

  /**
   * register a callback that will be called when the storage data changes.
   * @param callback function to call when the data changes
   * @returns function to cancel the subscription
   */
  onDataChange(callback: (data: Record<string, any>) => void): () => void {
    this.onDataChangeCallbacks.push(callback);
    
    return () => {
      const index = this.onDataChangeCallbacks.indexOf(callback);
      if (index > -1) {
        this.onDataChangeCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * notify all subscribers about data changes.
   */
  private notifyDataChange(data: Record<string, any>): void {
    for (const callback of this.onDataChangeCallbacks) {
      try {
        callback(data);
      } catch (e) {
        logger.getLogger("JsonPluginStorage").error(`Error in data change callback:`, e);
      }
    }
  }

  /**
   * check if the storage is being watched.
   */
  isWatching(): boolean {
    return this.watcher !== null;
  }
}
