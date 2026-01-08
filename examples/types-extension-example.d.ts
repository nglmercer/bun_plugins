/**
 * Ejemplo de cómo extender los tipos de bun_plugins para obtener autocompletado
 * 
 * Este archivo demuestra cómo usar declaration merging para que el LSP
 * pueda inferir los tipos de tus plugins automáticamente.
 * 
 * Coloca este archivo en la raíz de tu proyecto (o en una carpeta types/)
 * y asegúrate de que esté incluido en tu tsconfig.json.
 */

/**
 * Extiende la interfaz PluginFactory para incluir tus plugins personalizados.
 * 
 * Esto permite que cuando uses:
 * - `context.getPlugin("mi-plugin")` - Retorna any
 * - `context.getPlugin<MiPluginApi>("mi-plugin")` - Retorna MiPluginApi
 * 
 * El LSP inferirá automáticamente el tipo de retorno cuando uses declaration merging.
 */
declare module "bun_plugins" {
  export interface PluginFactory {
    /**
     * Agrega tu plugin aquí. El nombre debe coincidir con la propiedad `name` de tu plugin.
     * 
     * Ejemplo:
     * ```typescript
     * "mi-plugin": {
     *   name: "mi-plugin";
     *   version: "1.0.0";
     *   class: MiPlugin;
     *   api: MiPluginApi;
     * };
     * ```
     */
    // "mi-plugin": {
    //   name: "mi-plugin";
    //   version: "1.0.0";
    //   class: MiPlugin;
    //   api: MiPluginApi;
    // };
  }
}

/**
 * Si tu plugin tiene una interfaz API personalizada, puedes extenderla aquí.
 * 
 * Ejemplo:
 * ```typescript
 * declare module "bun_plugins" {
 *   export interface MiPluginApi {
 *     miMetodoPersonalizado(): void;
 *   }
 * }
 * ```
 */
// declare module "bun_plugins" {
//   export interface MiPluginApi {
//     miMetodoPersonalizado(): void;
//   }
// }

/**
 * Ejemplo de cómo usar los tipos extendidos en tu código:
 * 
 * ## Opción 1: Sin type assertion (retorna any)
 * ```typescript
 * import { PluginManager, PluginContext } from "bun_plugins";
 * 
 * // El LSP inferirá que `api` es de tipo `any`
 * const api = await context.getPlugin("mi-plugin");
 * 
 * // No hay autocompletado de métodos específicos del plugin
 * ```
 * 
 * ## Opción 2: Con type assertion (recomendado)
 * ```typescript
 * import { PluginManager, PluginContext } from "bun_plugins";
 * 
 * // El LSP inferirá que `api` es de tipo `MiPluginApi`
 * const api = await context.getPlugin<MiPluginApi>("mi-plugin");
 * 
 * // Autocompletado funcionará:
 * api.miMetodoPersonalizado();
 * ```
 * 
 * ## Opción 3: Con declaration merging (mejor experiencia)
 * ```typescript
 * import { PluginManager, PluginContext } from "bun_plugins";
 * 
 * // Si has extendido PluginFactory en este archivo, el LSP inferirá
 * // automáticamente el tipo correcto sin necesidad de type assertion:
 * const api = await context.getPlugin("mi-plugin");
 * 
 * // Autocompletado funcionará porque el LSP sabe que "mi-plugin" existe en PluginFactory
 * api.miMetodoPersonalizado();
 * ```
 */
