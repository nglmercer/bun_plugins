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
 * - `context.getPlugin("mi-plugin")`
 * - `context.getPlugin<PluginNames>("mi-plugin")`
 * 
 * El LSP pueda inferir automáticamente el tipo de retorno.
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
 * ```typescript
 * import { PluginManager, PluginContext } from "bun_plugins";
 * 
 * // El LSP inferirá automáticamente que `api` es de tipo `MiPluginApi`
 * const api = await context.getPlugin("mi-plugin");
 * 
 * // Autocompletado funcionará:
 * api.miMetodoPersonalizado();
 * ```
 */
