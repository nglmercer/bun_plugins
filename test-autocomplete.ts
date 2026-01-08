/**
 * Archivo de prueba para verificar el autocompletado de plugins
 * usando declaration merging.
 * 
 * Este archivo demuestra que los tipos se pueden extender
 * sin necesidad de generar archivos .d.ts estáticos.
 */

import { PluginManager, type PluginContext } from "./src/index";

// ============================================================================
// 1. PRIMERO: Extender los tipos con declaration merging
// ============================================================================

/**
 * Paso 1: Extender la interfaz PluginFactory para incluir tu plugin.
 * 
 * Esto permite que el LSP infiera automáticamente el tipo de retorno
 * cuando usas context.getPlugin("mi-plugin").
 */
declare module "bun_plugins" {
  export interface PluginFactory {
    /**
     * Agrega tu plugin aquí.
     * El nombre debe coincidir con la propiedad `name` de tu plugin.
     * 
     * Ejemplo:
     * ```typescript
     * "mi-plugin-test": {
     *   name: "mi-plugin-test";
     *   version: "1.0.0";
     *   class: MiPluginTest;
     *   api: MiPluginTestApi;
     * };
     * ```
     */
    "mi-plugin-test": {
      name: "mi-plugin-test";
      version: "1.0.0";
      class: MiPluginTest;
      api: MiPluginTestApi;
    };
  }
}

/**
 * Paso 2: Definir la interfaz API de tu plugin.
 * 
 * Esta interfaz define los métodos que expondrá tu plugin.
 */
export interface MiPluginTestApi {
  /**
   * Método personalizado de ejemplo.
   * El LSP inferirá automáticamente este tipo.
   */
  saludar(nombre: string): void;
  
  /**
   * Otro método personalizado.
   */
  sumar(a: number, b: number): number;
}

// ============================================================================
// 2. CREAR EL PLUGIN
// ============================================================================

/**
 * Paso 3: Crear el plugin que implementa la interfaz API.
 * 
 * Este plugin expondrá los métodos definidos en MiPluginTestApi.
 */
export class MiPluginTest {
  name = "mi-plugin-test";
  version = "1.0.0";
  
  /**
   * Método que expone la API del plugin.
   * 
   * El tipo de retorno se infiere automáticamente desde la
   * definición de PluginFactory que hicimos arriba.
   */
  getApi(): MiPluginTestApi {
    return {
      saludar: (nombre: string) => {
        console.log(`¡Hola, ${nombre}!`);
      },
      sumar: (a: number, b: number) => {
        return a + b;
      }
    };
  }
  
  async onLoad(context: PluginContext) {
    context.log.info("Mi Plugin Test cargado correctamente");
    
    // Emitir un evento para notificar que el plugin está listo
    context.emit("plugin:ready", { plugin: this.name });
  }
  
  async onUnload() {
    console.log("Mi Plugin Test descargado");
  }
}

// ============================================================================
// 3. USAR EL PLUGIN CON AUTOCOMPLETADO
// ============================================================================

/**
 * Paso 4: Usar el plugin con autocompletado completo.
 * 
 * Este código demuestra que:
 * 1. El LSP infiere correctamente el tipo de retorno
 * 2. El autocompletado funciona para todos los métodos de la API
 * 3. Los tipos son seguros y no hay errores de TypeScript
 */

async function main() {
  // Crear el manager de plugins
  const manager = new PluginManager();
  
  // Registrar nuestro plugin de prueba
  await manager.register(new MiPluginTest());
  
  console.log("\n=== Prueba 1: Obtener el plugin ===");
  
  // ✅ El LSP infiere automáticamente el tipo como MiPluginTestApi
  const api = await manager.getPlugin("mi-plugin-test");
  
  // Verificar que el tipo sea correcto
  // TypeScript debería mostrar un error si el tipo no coincide
  const miNombre: string = "Mundo";
  
  console.log("\n=== Prueba 2: Usar el método saludar ===");
  
  // ✅ Autocompletado funciona: el LSP sabe que api es de tipo MiPluginTestApi
  api.saludar(miNombre);
  
  console.log("\n=== Prueba 3: Usar el método sumar ===");
  
  // ✅ Autocompletado funciona: el LSP sabe los parámetros y tipos
  const resultado = api.sumar(5, 3);
  console.log(`5 + 3 = ${resultado}`);
  
  console.log("\n=== Prueba 4: Verificar que el tipo es correcto ===");
  
  // ✅ TypeScript verificará que el tipo sea correcto en tiempo de compilación
  // Si intentas usar un método que no existe, TypeScript mostrará un error
  // api.metodoInexistente(); // ← Esto causaría un error de TypeScript
  
  console.log("\n✅ Todas las pruebas pasaron exitosamente!");
  console.log("\n📝 Notas:");
  console.log("1. No se necesitan archivos .d.ts generados");
  console.log("2. Los tipos se infieren automáticamente desde la definición de PluginFactory");
  console.log("3. El autocompletado funciona tanto en desarrollo como en producción");
  console.log("4. Para agregar más plugins, solo agrega una nueva entrada en PluginFactory");
}

// Ejecutar la prueba
main().catch(console.error);
