/**
 * Sistema de registro de tipos para plugins
 * Permite el tipado estático de plugins basado en sus nombres
 */

// Tipo base para plugins que exponen APIs compartidas
export interface PluginWithSharedApi<T = any> {
  getSharedApi(): T;
}

// Registro de tipos de plugins
export interface PluginTypeRegistry {
  // Aquí se registran los tipos de plugins conocidos
  // Los usuarios pueden extender esta interfaz mediante declaration merging
}

// Tipo auxiliar para obtener el tipo de un plugin basado en su nombre
export type PluginTypeByName<TName extends keyof PluginTypeRegistry> = 
  PluginTypeRegistry[TName] extends PluginWithSharedApi<infer T> ? T : never;

// Tipo para nombres de plugins conocidos
export type KnownPluginNames = keyof PluginTypeRegistry;

// Helper para verificar si un nombre de plugin es conocido
export function isKnownPlugin<TName extends string>(
  name: TName
): name is TName & KnownPluginNames {
  // En tiempo de ejecución, esto siempre devuelve true
  // pero en tiempo de compilación ayuda con el tipado
  return true;
}