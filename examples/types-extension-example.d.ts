/**
 * Ejemplo de cómo extender los tipos de plugins en tu proyecto
 * 
 * Crea este archivo en tu proyecto (ej: src/types/plugins.d.ts o en la raíz como plugins.d.ts)
 * y TypeScript extenderá automáticamente los tipos de la librería bun_plugins.
 */

import type { BasePluginApi } from "bun_plugins/src/types/plugin-registry-base";

// Define las interfaces de API para tus plugins
export interface MathPluginApi extends BasePluginApi {
  add(a: number, b: number): number;
  multiply(a: number, b: number): number;
  divide(a: number, b: number): number;
  subtract(a: number, b: number): number;
}

export interface TextPluginApi extends BasePluginApi {
  toUpperCase(text: string): string;
  toLowerCase(text: string): string;
  reverse(text: string): string;
}

export interface ActionRegistryApi extends BasePluginApi {
  registerAction(name: string, handler: Function): void;
  executeAction(name: string, ...args: any[]): any;
  listActions(): string[];
}

// Extiende el PluginFactory de bun_plugins con tus plugins
declare module "bun_plugins" {
  export interface PluginFactory {
    "math-plugin": {
      name: "math-plugin";
      version: "1.0.0";
      class: MathPluginApi; // La clase del plugin
      api: MathPluginApi;
    };
    "text-plugin": {
      name: "text-plugin";
      version: "1.0.0";
      class: TextPluginApi;
      api: TextPluginApi;
    };
    "action-registry": {
      name: "action-registry";
      version: "1.0.0";
      class: ActionRegistryApi;
      api: ActionRegistryApi;
    };
  }
}

// Ahora puedes usar context.getPlugin() con autocompletado completo:
/*
const mathPlugin = await context.getPlugin('math-plugin');
if (mathPlugin) {
  mathPlugin.add(1, 2); // ✅ Autocompletado y type safety
  mathPlugin.multiply(3, 4); // ✅ Autocompletado y type safety
}

const textPlugin = await context.getPlugin('text-plugin');
if (textPlugin) {
  textPlugin.toUpperCase('hello'); // ✅ Autocompletado y type safety
}
*/
