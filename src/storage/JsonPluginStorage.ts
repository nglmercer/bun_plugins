import { join, dirname } from "node:path";
import { mkdir } from "node:fs/promises";
import type { IPluginStorage } from "../types";

export class JsonPluginStorage implements IPluginStorage {
  private filePath: string;
  private data: Record<string, any> | null = null;
  private basePath: string;

  constructor(basePath: string, pluginName: string) {
    this.basePath = basePath;
    this.filePath = join(basePath, "plugins", pluginName, "storage.json");
  }

  private async ensureLoaded() {
    if (this.data !== null) return;
    try {
      const file = Bun.file(this.filePath);
      if (await file.exists()) {
        this.data = await file.json();
      } else {
        this.data = {};
      }
    } catch (e) {
      console.error(`Failed to load storage for ${this.filePath}`, e);
      this.data = {};
    }
  }

  private async save() {
    if (this.data === null) return;
    try {
        // Ensure directory exists
        await mkdir(dirname(this.filePath), { recursive: true });
        await Bun.write(this.filePath, JSON.stringify(this.data, null, 2));
    } catch (e) {
        console.error(`Failed to save storage for ${this.filePath}`, e);
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
}
