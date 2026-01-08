/**
 * Archivo de tipos para extender el registro de plugins en este proyecto
 * 
 * Este archivo define las APIs de los plugins existentes en este proyecto
 * para que context.getPlugin() tenga autocompletado y type safety.
 */

import type { BasePluginApi } from "../src/types/plugin-registry-base";

// Define las interfaces de API para los plugins de este proyecto
export interface MathPluginApi extends BasePluginApi {
  add(a: number, b: number): number;
  multiply(a: number, b: number): number;
  divide(a: number, b: number): number;
  subtract(a: number, b: number): number;
}

export interface ActionRegistryApi extends BasePluginApi {
  registerAction(name: string, handler: Function): void;
  executeAction(name: string, ...args: any[]): any;
  listActions(): string[];
}

export interface TextPluginApi extends BasePluginApi {
  toUpperCase(text: string): string;
  toLowerCase(text: string): string;
  reverse(text: string): string;
}

export interface UtilityPluginApi extends BasePluginApi {
  formatDate(date: Date): string;
  generateId(): string;
}

// Extiende el PluginFactory de bun_plugins con los plugins de este proyecto
declare module "bun_plugins" {
  export interface PluginFactory {
    "math-plugin": {
      name: "math-plugin";
      version: "1.0.0";
      class: any;
      api: MathPluginApi;
    };
    "action-registry": {
      name: "action-registry";
      version: "1.0.0";
      class: any;
      api: ActionRegistryApi;
    };
    "text-plugin": {
      name: "text-plugin";
      version: "1.0.0";
      class: any;
      api: TextPluginApi;
    };
    "utility-plugin": {
      name: "utility-plugin";
      version: "1.0.0";
      class: any;
      api: UtilityPluginApi;
    };
  }
}
