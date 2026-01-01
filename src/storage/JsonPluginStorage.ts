import { join, dirname } from "node:path";
import { mkdir } from "node:fs/promises";
import type { IPluginStorage } from "../types";
import { logger } from "../logger";

export class JsonPluginStorage implements IPluginStorage {
  private filePath: string;
  private data: Record<string, any> | null = null;
  private lastModified: number = 0;

  constructor(basePath: string, pluginName: string) {
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
}
