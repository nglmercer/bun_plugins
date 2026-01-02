
import { PluginInfo } from './types';

export class PluginRegistry {
    private static instance: PluginRegistry;
    private plugins: Map<string, PluginInfo> = new Map();

    private constructor() {}

    static getInstance(): PluginRegistry {
        if (!PluginRegistry.instance) {
            PluginRegistry.instance = new PluginRegistry();
        }
        return PluginRegistry.instance;
    }

    update(plugins: PluginInfo[]) {
        this.plugins.clear();
        plugins.forEach(p => {
            this.plugins.set(p.name, p);
        });
    }

    set(plugin: PluginInfo) {
        this.plugins.set(plugin.name, plugin);
    }

    getAll(): PluginInfo[] {
        return Array.from(this.plugins.values());
    }

    get(name: string): PluginInfo | undefined {
        return this.plugins.get(name);
    }
}
