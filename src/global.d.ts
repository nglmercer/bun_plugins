// Global type definitions for the application
// Importar tipos generados por el LSP
import type { 
  PluginNames,
  PluginApiType,
  PluginClassType,
  GetPluginApi,
  GetPluginClass,
  IsValidPlugin,
  PluginFromFactory,
  PluginFactory,
  BasePluginApi
} from "../plugin-types/index";

declare global {
  // Registro global de tipos de plugins
  // Los tipos están disponibles globalmente sin necesidad de imports
  namespace BunPlugins {
    type PluginNames = PluginNames;
    type PluginApiType<T extends PluginNames> = PluginApiType<T>;
    type PluginClassType<T extends PluginNames> = PluginClassType<T>;
    type GetPluginApi<T extends PluginNames> = GetPluginApi<T>;
    type GetPluginClass<T extends PluginNames> = GetPluginClass<T>;
    type IsValidPlugin<T extends string> = IsValidPlugin<T>;
    type PluginFromFactory<T extends PluginNames> = PluginFromFactory<T>;
    type PluginFactory = PluginFactory;
    type BasePluginApi = BasePluginApi;
  }

  // Extender el contexto del plugin con tipos dinámicos
  interface PluginContext {
    // Tipo de retorno dinámico para getPlugin
    getPlugin<T extends BunPlugins.PluginNames>(
      name: T
    ): BunPlugins.PluginClassType<T> | undefined;
  }

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
