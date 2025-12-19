// C:/Users/mm/Documents/bun proyects/bun_plugins/src/trigger_system/enhanced-types.ts

/**
 * Representa los tipos de eventos soportados por el sistema.
 * Basado en los ejemplos: Donation, Twitch Subscription, Twitch Follow, etc.
 */
export type TriggerEventType =
  | 'Donation'
  | 'Custom Event'
  | 'Command'
  | string;

/**
 * Operadores lógicos para condiciones complejas.
 */
export type LogicalOperator = 'AND' | 'OR' | 'BOTH' | 'EITHER';

/**
 * Estructura de un rango de valores.
 */
export interface ValueRange {
  min: number;
  max: number;
}

/**
 * Define una condición específica para un trigger.
 * Ejemplo: "amount IN RANGE [0,20]" o "months >= 2"
 */
export interface EnhancedCondition {
  field: string;
  operator: '==' | '!=' | '>' | '>=' | '<' | '<=' | 'IN RANGE' | 'CONTAINS';
  value: any | ValueRange;
}

/**
 * Tipos de acciones que el sistema puede ejecutar.
 */
export type ActionType =
  | 'DROP'
  | 'SUMMON'
  | 'EXECUTE'
  | 'THROW'
  | 'DISPLAY'
  | 'SOUND'
  | 'LOG';

/**
 * Representa una acción individual.
 * Ejemplo: DROP minecraft:stick 2
 */
export interface EnhancedAction {
  type: ActionType;
  item?: string;      // ID del item (ej: minecraft:stick)
  amount?: number;    // Cantidad
  nbt?: string;       // Datos NBT en formato string (ej: {display:{...}})
  command?: string;   // Para EXECUTE
  coordinates?: string; // Para SUMMON (~ ~10 ~)
  message?: string | any[]; // Para DISPLAY (soporta JSON de Minecraft)
  instant?: boolean;  // Si se ejecuta instantáneamente (BOTH INSTANTLY)
}

/**
 * Estructura de una Regla Completa (Trigger).
 * Soporta la lógica de "EITHER" (selección aleatoria) o "BOTH" (ejecución múltiple).
 */
export interface EnhancedTriggerRule {
  id: string;
  description?: string;

  // Evento que dispara la regla
  on: TriggerEventType;

  // Condiciones que deben cumplirse
  conditions: EnhancedCondition[];

  // Lógica de ejecución de acciones
  executionMode: 'SINGLE' | 'EITHER' | 'BOTH';

  // Lista de acciones
  actions: EnhancedAction[];

  // Mensaje global para este trigger (ALL DISPLAYING ...)
  globalDisplay?: string | any[];

  // Metadatos adicionales
  priority?: number;
  enabled: boolean;
  cooldownMs?: number;
}

/**
 * Contexto del evento recibido.
 */
export interface EventContext {
  event: TriggerEventType;
  actor: string;        // Quién generó el evento (streamer, donor, etc)
  amount?: number;      // Valor numérico asociado (donación, meses)
  message?: string;     // Mensaje del chat o donación
  rawPayload: any;      // Datos brutos del webhook/API
  timestamp: number;
}

/**
 * Resultado del procesamiento de un trigger.
 */
export interface TriggerProcessResult {
  ruleId: string;
  triggered: boolean;
  executedActions: ActionType[];
  errors?: string[];
}
