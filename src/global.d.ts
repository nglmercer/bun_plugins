// Global type definitions for the application
// Importar tipos generados por el LSP
import type { PluginTypeRegistry as GeneratedPluginTypeRegistry } from "../plugin-types/index";

declare global {
    // Registro de tipos de plugins para el sistema LSP
    // Usar los tipos generados automáticamente por el LSP
    interface PluginTypeRegistry extends GeneratedPluginTypeRegistry {}

    // Define global interfaces and types here
    interface Window {
        // Example: myGlobalVar: string;
    }

    // ProcessEnv interface extension
    namespace NodeJS {
        interface ProcessEnv {
            NODE_ENV: 'development' | 'production' | 'test';
            // Add other environment variables here
        }
    }
}

export {};
