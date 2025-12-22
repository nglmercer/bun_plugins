
import type { ITTSProvider } from "./provider";
import { LogTTSProvider } from "./providers/log";

export class TTSService {
    private static instance: TTSService;
    private providers: Map<string, ITTSProvider> = new Map();
    private currentProvider: ITTSProvider;

    private constructor() {
        const defaultProvider = new LogTTSProvider();
        this.providers.set(defaultProvider.name, defaultProvider);
        this.currentProvider = defaultProvider;
    }

    public static getInstance(): TTSService {
        if (!TTSService.instance) {
            TTSService.instance = new TTSService();
        }
        return TTSService.instance;
    }

    registerProvider(provider: ITTSProvider) {
        this.providers.set(provider.name, provider);
        console.log(`[System] Registered TTS Provider: ${provider.name}`);
    }

    setProvider(name: string) {
        const provider = this.providers.get(name);
        if (provider) {
            this.currentProvider = provider;
            console.log(`[System] Switched to TTS Provider: ${name}`);
        } else {
            console.warn(`[System] Provider ${name} not found. Available: ${this.getProviders().join(", ")}`);
        }
    }

    async speak(text: string, voice?: string) {
        await this.currentProvider.speak(text, voice);
    }

    getProviders(): string[] {
        return Array.from(this.providers.keys());
    }

    getCurrentProvider(): ITTSProvider {
        return this.currentProvider;
    }
}
