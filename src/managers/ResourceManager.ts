
import { type PluginResource } from "../types";
import { logger } from "../logger";

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
                logger.getLogger("ResourceManager").info(`Terminating worker for plugin ${pluginName}`);
                worker.terminate();
            }
            for (const timer of res.timers) {
                if (timer.type === 'timeout') clearTimeout(timer.id as number);
                if (timer.type === 'interval') clearInterval(timer.id as number);
            }
            if (eventEmitter) {
                for (const listener of res.eventListeners) {
                    eventEmitter.off(listener.event, listener.listener);
                }
            }
            this.resources.delete(pluginName);
        }
    }

    getUsageSummary() {
        let totalWorkers = 0;
        let totalTimers = 0;
        let totalListeners = 0;

        for (const res of Array.from(this.resources.values())) {
            totalWorkers += res.workers.length;
            totalTimers += res.timers.length;
            totalListeners += res.eventListeners.length;
        }

        return {
            totalWorkers,
            totalTimers,
            totalListeners,
            pluginCount: this.resources.size
        };
    }
}
