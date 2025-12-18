
import { type PluginResource } from "../types";

export class ResourceManager {
    private resources: Map<string, PluginResource> = new Map();

    init(pluginName: string): PluginResource {
        const res: PluginResource = { workers: [], timers: [], eventListeners: [] };
        this.resources.set(pluginName, res);
        return res;
    }

    get(pluginName: string): PluginResource | undefined {
        return this.resources.get(pluginName);
    }

    cleanup(pluginName: string, eventEmitter?: { off: (e: string, l: any) => void }) {
        const res = this.resources.get(pluginName);
        if (res) {
            for (const worker of res.workers) {
                console.log(`Terminating worker for plugin ${pluginName}`);
                worker.terminate();
            }
            for (const timer of res.timers) {
                if (timer.type === 'timeout') clearTimeout(timer.id as number);
                if (timer.type === 'interval') clearInterval(timer.id as number);
            }
            if (eventEmitter) {
                for (const listener of res.eventListeners) {
                    eventEmitter.off(listener.event, listener.listener as any);
                }
            }
            this.resources.delete(pluginName);
        }
    }
}
