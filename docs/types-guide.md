# Guía de Tipos para Plugins

Esta guía explica cómo obtener autocompletado y type safety al usar `context.getPlugin()` en tus plugins.

## El Problema

Cuando usas `context.getPlugin('math-plugin')`, TypeScript devuelve `any` porque la librería no conoce los plugins que crearás en tu proyecto. Esto significa que no tienes autocompletado ni validación de tipos.

## La Solución: Declaration Merging

La solución es usar **declaration merging** de TypeScript para extender el tipo `PluginFactory` en tu propio proyecto. Esto permite que TypeScript conozca las APIs de tus plugins.

## Paso 1: Crear un archivo de tipos

Crea un archivo `.d.ts` en tu proyecto. Puede estar en:
- La raíz del proyecto: `plugins.d.ts`
- En un directorio de tipos: `src/types/plugins.d.ts`
- En el directorio de plugins: `plugins/types.d.ts`

## Paso 2: Definir las interfaces de tus plugins

Define las interfaces que describen la API de cada plugin:

```typescript
// plugins/types.d.ts

import type { BasePluginApi } from "bun_plugins/src/types/plugin-registry-base";

// Define la API del plugin de matemáticas
export interface MathPluginApi extends BasePluginApi {
  add(a: number, b: number): number;
  multiply(a: number, b: number): number;
  divide(a: number, b: number): number;
  subtract(a: number, b: number): number;
}

// Define la API del plugin de texto
export interface TextPluginApi extends BasePluginApi {
  toUpperCase(text: string): string;
  toLowerCase(text: string): string;
  reverse(text: string): string;
}
```

## Paso 3: Extender PluginFactory

Usa declaration merging para registrar tus plugins:

```typescript
// plugins/types.d.ts (continuación)

declare module "bun_plugins" {
  export interface PluginFactory {
    "math-plugin": {
      name: "math-plugin";
      version: "1.0.0";
      class: any;
      api: MathPluginApi;
    };
    "text-plugin": {
      name: "text-plugin";
      version: "1.0.0";
      class: any;
      api: TextPluginApi;
    };
  }
}
```

## Paso 4: Registrar la API en tu plugin

En tu plugin, registra la API usando `context.registerApi()`:

```typescript
// plugins/MathPlugin.ts
import { Plugin, PluginContext } from "../src";

export class MathPlugin extends Plugin {
  name = "math-plugin";
  version = "1.0.0";

  override onLoad(context: PluginContext) {
    context.log.info("Math capabilities ready");
    
    // Registrar la API de este plugin
    context.registerApi({
      add: this.add.bind(this),
      multiply: this.multiply.bind(this),
      divide: this.divide.bind(this),
      subtract: this.subtract.bind(this)
    });
  }

  add(a: number, b: number): number {
    return a + b;
  }
  
  multiply(a: number, b: number): number {
    return a * b;
  }

  divide(a: number, b: number): number {
    return a / b;
  }

  subtract(a: number, b: number): number {
    return a - b;
  }
}

export default new MathPlugin();
```

## Paso 5: Usar context.getPlugin() con autocompletado

Ahora puedes usar `context.getPlugin()` con autocompletado completo:

```typescript
// plugins/ExamplePlugin.ts
import { definePlugin } from "../src";

export default definePlugin({
  name: "edge",
  version: "1.0.0",

  async onLoad(context) {
    // ✅ TypeScript conoce el tipo exacto
    const mathPlugin = await context.getPlugin('math-plugin');
    
    if (!mathPlugin) {
      context.log.error("Math plugin not found");
      return;
    }
    
    // ✅ Autocompletado y type safety
    const result = mathPlugin.add(1, 2);
    context.log.info(`Math result: ${result}`);
    
    const multiplyResult = mathPlugin.multiply(3, 4);
    context.log.info(`Multiplication result: ${multiplyResult}`);
    
    // ✅ TypeScript mostrará error si intentas usar un método que no existe
    // mathPlugin.nonExistentMethod(); // ❌ Error: Property 'nonExistentMethod' does not exist
  },
  
  onUnload() {}
});
```

## Ejemplo Completo

Aquí tienes un ejemplo completo del archivo `plugins/types.d.ts`:

```typescript
/**
 * Archivo de tipos para extender el registro de plugins en este proyecto
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
```

## Ventajas

1. **Autocompletado**: Tu IDE mostrará todos los métodos disponibles
2. **Type Safety**: TypeScript detectará errores en tiempo de compilación
3. **Documentación**: Las interfaces sirven como documentación de la API
4. **Refactorización**: Puedes renombrar métodos de forma segura
5. **Extensible**: Puedes agregar nuevos plugins fácilmente

## Plugins Externos

Si estás usando plugins externos (instalados via npm), puedes extender los tipos de la misma manera. Solo necesitas conocer la API del plugin externo y agregarla a tu archivo de tipos.

## Notas Importantes

1. El archivo `.d.ts` debe ser incluido en tu compilación de TypeScript
2. Asegúrate de que `tsconfig.json` incluya el directorio donde creaste el archivo
3. El nombre del plugin en `PluginFactory` debe coincidir exactamente con `plugin.name`
4. La interfaz de API debe coincidir con lo que registras en `context.registerApi()`

## Configuración de tsconfig.json

Asegúrate de que tu `tsconfig.json` incluya los archivos `.d.ts`:

```json
{
  "compilerOptions": {
    "include": [
      "src/**/*",
      "plugins/**/*",
      "**/*.d.ts"
    ]
  }
}
```

## Conclusión

Usar declaration merging para extender `PluginFactory` es la forma más flexible y type-safe de obtener autocompletado en tus plugins. Esta solución funciona tanto para plugins internos como externos y no requiere modificar la librería `bun_plugins`.
