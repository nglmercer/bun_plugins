// -----------------------------------------------------------------------------
// MOTOR DE REGLAS PARA TRIGGERS
// -----------------------------------------------------------------------------

import type {
  TriggerRule,
  TriggerCondition,
  ConditionGroup,
  RuleCondition,
  TriggerAction,
  ActionGroup,
  TriggerContext,
  TriggerResult,
  RuleEngineConfig,
} from "../types";
import { ExpressionEngine } from "../core/expression-engine";

export class RuleEngine {
  private rules: TriggerRule[] = [];
  private config: RuleEngineConfig;
  private lastExecutionTimes: Map<string, number> = new Map();

  constructor(config: RuleEngineConfig) {
    this.config = config;
    this.rules = [...config.rules];
    // Ordenar reglas por prioridad
    this.rules.sort((a, b) => (b.priority || 0) - (a.priority || 0));
  }

  /**
   * Evalúa todas las reglas contra el contexto proporcionado
   */
  async evaluateContext(context: TriggerContext): Promise<TriggerResult[]> {
    const results: TriggerResult[] = [];

    if (this.config.globalSettings.debugMode) {
      console.log(
        `[RuleEngine] Evaluando contexto con ${this.rules.length} reglas para evento: ${context.event}`,
      );
    }

    for (const rule of this.rules) {
      if (rule.enabled === false) continue;
      
      // Check event type match
      if (rule.on !== context.event) continue;

      // Verificar cooldown
      if (rule.cooldown && !this.checkCooldown(rule.id, rule.cooldown)) {
        if (this.config.globalSettings.debugMode) {
          console.log(`[RuleEngine] Regla ${rule.id} en cooldown`);
        }
        continue;
      }

      // Evaluar condiciones
      // rule.if can be undefined (always true), a single condition, or an array
      const conditionMet = this.evaluateRuleConditions(rule.if, context);

      if (conditionMet) {
        if (this.config.globalSettings.debugMode) {
          console.log(
            `[RuleEngine] Ejecutando regla: ${rule.name || rule.id}`,
          );
        }

        // Ejecutar acciones
        const executedActions = await this.executeRuleActions(rule.do, context);

        results.push({
          ruleId: rule.id,
          executedActions: executedActions,
          success: true,
        });

        // Actualizar tiempo de última ejecución
        this.lastExecutionTimes.set(rule.id, Date.now());

        // Si no se deben evaluar todas las reglas, salir después de la primera coincidencia
        if (!this.config.globalSettings.evaluateAll) {
          break;
        }
      }
    }

    return results;
  }

  // --- Condition Evaluation ---

  private evaluateRuleConditions(
    conditions: RuleCondition | RuleCondition[] | undefined,
    context: TriggerContext
  ): boolean {
    if (!conditions) return true; // No conditions = always trigger if event matches

    if (Array.isArray(conditions)) {
      // Implicit AND for array of conditions at root
      return conditions.every(c => this.evaluateRecursiveCondition(c, context));
    } else {
      return this.evaluateRecursiveCondition(conditions, context);
    }
  }

  private evaluateRecursiveCondition(
    condition: RuleCondition,
    context: TriggerContext
  ): boolean {
    // Check if it's a group
    if ('conditions' in condition && 'operator' in condition) {
      return this.evaluateConditionGroup(condition as ConditionGroup, context);
    } else {
      return this.evaluateSingleCondition(condition as TriggerCondition, context);
    }
  }

  private evaluateConditionGroup(group: ConditionGroup, context: TriggerContext): boolean {
    if (group.operator === 'OR') {
      return group.conditions.some(c => this.evaluateRecursiveCondition(c, context));
    } else {
      // AND
      return group.conditions.every(c => this.evaluateRecursiveCondition(c, context));
    }
  }

  /**
   * Evalúa una condición individual
   */
  private evaluateSingleCondition(
    condition: TriggerCondition,
    context: TriggerContext,
  ): boolean {
    try {
      // Obtener el valor del campo especificado
      const fieldValue = ExpressionEngine.getNestedValue(
        condition.field,
        context,
      );

      // Evaluar según el operador
      switch (condition.operator) {
        case "EQ":
        case "==":
          return fieldValue === condition.value;

        case "NEQ":
        case "!=":
          return fieldValue !== condition.value;

        case "GT":
        case ">":
          return Number(fieldValue) > Number(condition.value);

        case "GTE":
        case ">=":
          return Number(fieldValue) >= Number(condition.value);

        case "LT":
        case "<":
          return Number(fieldValue) < Number(condition.value);

        case "LTE":
        case "<=":
          return Number(fieldValue) <= Number(condition.value);

        case "CONTAINS":
          return String(fieldValue).includes(String(condition.value));
        
        case "MATCHES":
          return new RegExp(condition.value).test(String(fieldValue));
        
        case "IN":
          return Array.isArray(condition.value) && condition.value.includes(fieldValue);

        case "NOT_IN":
          return Array.isArray(condition.value) && !condition.value.includes(fieldValue);

        default:
          console.error(`Operador desconocido: ${condition.operator}`);
          return false;
      }
    } catch (error) {
      console.error(`Error evaluando condición:`, condition, error);
      return false;
    }
  }

  // --- Action Execution ---

  private async executeRuleActions(
    actions: TriggerAction | TriggerAction[] | ActionGroup,
    context: TriggerContext
  ): Promise<TriggerResult['executedActions']> {
    const enactedActions: TriggerResult['executedActions'] = [];

    let actionList: TriggerAction[] = [];
    let mode: 'ALL' | 'SEQUENCE' | 'EITHER' = 'ALL';

    if (this.isActionGroup(actions)) {
      actionList = actions.actions;
      mode = actions.mode;
    } else if (Array.isArray(actions)) {
      actionList = actions;
    } else {
      actionList = [actions];
    }

    if (mode === 'EITHER' && actionList.length > 0) {
      // Pick one randomly
      // Support probability later, for now uniform
      const randomIndex = Math.floor(Math.random() * actionList.length);
      const selectedAction = actionList[randomIndex];
      if (selectedAction) {
          actionList = [selectedAction];
      }
    }

    // Execute
    if (mode === 'SEQUENCE') {
       for (const action of actionList) {
         const result = await this.executeSingleAction(action, context);
         enactedActions.push(result);
       }
    } else {
      // ALL (Parallel-ish)
      // Note: We await them sequentially here to simplify, but logically they are "all". 
      // If true parallel is needed, Promise.all could be used, but side-effects might clash.
      for (const action of actionList) {
         const result = await this.executeSingleAction(action, context);
         enactedActions.push(result);
      }
    }

    return enactedActions;
  }

  private isActionGroup(action: any): action is ActionGroup {
    return 'mode' in action && 'actions' in action;
  }

  private async executeSingleAction(
    action: TriggerAction,
    context: TriggerContext,
  ): Promise<TriggerResult['executedActions'][0]> {
    
    // Check probability
    if (action.probability !== undefined && Math.random() > action.probability) {
       return {
         type: action.type,
         timestamp: Date.now(),
         result: { skipped: "probability check failed" }
       };
    }

    // Check delay
    if (action.delay && action.delay > 0) {
      await new Promise(resolve => setTimeout(resolve, action.delay));
    }

    try {
        let result;

        switch (action.type) {
          case "response":
            result = this.executeResponseAction(action, context);
            break;

          case "log":
            result = this.executeLogAction(action, context);
            break;

          case "execute":
            result = await this.executeExecuteAction(action, context);
            break;

          case "forward":
            result = await this.executeForwardAction(action, context);
            break;

          default:
            // Generic handler or error
            console.warn(`Tipo de acción genérica o desconocida: ${action.type}`);
            result = { warning: `Generic action executed: ${action.type}` };
        }

        return {
          type: action.type,
          result,
          timestamp: Date.now()
        };
      } catch (error) {
        console.error(`Error ejecutando acción:`, action, error);
        return {
          type: action.type,
          error: String(error),
          timestamp: Date.now()
        };
      }
  }

  /**
   * Ejecuta una acción de tipo respuesta
   */
  private executeResponseAction(
    action: TriggerAction,
    context: TriggerContext,
  ): any {
    // Interpolar variables en el contenido
    // Assuming params has content for legacy or new structure
    const contentTemplate = action.params?.content || action.params?.body || "";
    const content = ExpressionEngine.interpolate(contentTemplate, context);

    return {
      type: "response",
      statusCode: action.params?.statusCode || 200,
      headers: action.params?.headers || {
        "Content-Type": "application/json",
      },
      body: content,
    };
  }

  /**
   * Ejecuta una acción de tipo log
   */
  private executeLogAction(
    action: TriggerAction,
    context: TriggerContext,
  ): any {
    const messageTemplate = action.params?.message || action.params?.content || "Log Trigger";
    const message = ExpressionEngine.interpolate(messageTemplate, context);

    console.log(`[TriggerLog] ${message}`);

    return {
      type: "log",
      message,
    };
  }

  /**
   * Ejecuta una acción de tipo ejecución de comando
   */
  private async executeExecuteAction(
    action: TriggerAction,
    context: TriggerContext,
  ): Promise<any> {
    const commandTemplate = action.params?.command || action.params?.content || "";
    const command = ExpressionEngine.interpolate(commandTemplate, context);

    if (!action.params?.safe) {
      console.warn(`[Trigger] Ejecutando comando no seguro: ${command}`);
    }

    try {
      const proc = Bun.spawn(command.split(" "), {
        stdout: "pipe",
        stderr: "pipe",
      });

      const [stdout, stderr] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
      ]);

      return {
        type: "execute",
        command,
        stdout,
        stderr,
        exitCode: await proc.exited,
      };
    } catch (error) {
      return {
        type: "execute",
        command,
        error: String(error),
      };
    }
  }

  /**
   * Ejecuta una acción de tipo reenvío a otro endpoint
   */
  private async executeForwardAction(
    action: TriggerAction,
    context: TriggerContext,
  ): Promise<any> {
    const urlTemplate = action.params?.url || "";
    const url = ExpressionEngine.interpolate(urlTemplate, context);
    const method = action.params?.method || "POST";

    try {
      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...action.params?.headers,
        },
        body: JSON.stringify(context.data),
      });

      const body = await response.text();

      return {
        type: "forward",
        url,
        method,
        status: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        body,
      };
    } catch (error) {
      return {
        type: "forward",
        url,
        method,
        error: String(error),
      };
    }
  }

  /**
   * Verifica si una regla está en cooldown
   */
  private checkCooldown(ruleId: string, cooldownMs: number): boolean {
    const lastExecution = this.lastExecutionTimes.get(ruleId);

    if (!lastExecution) return true;

    return Date.now() - lastExecution > cooldownMs;
  }

  /**
   * Actualiza las reglas del motor
   */
  updateRules(newRules: TriggerRule[]): void {
    this.rules = [...newRules];
    this.rules.sort((a, b) => (b.priority || 0) - (a.priority || 0));
  }

  /**
   * Obtiene todas las reglas
   */
  getRules(): TriggerRule[] {
    return [...this.rules];
  }
}
