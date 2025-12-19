// -----------------------------------------------------------------------------
// MOTOR DE EXPRESIONES MATEMÁTICAS Y VARIABLES
// -----------------------------------------------------------------------------

import type { TriggerContext } from "../types";

export class ExpressionEngine {
  /**
   * Evalúa una expresión matemática simple o una interpolación de variables
   * Soporta operadores: +, -, *, /, %, **, y funciones matemáticas básicas
   */

  static evaluate(expression: string, context: TriggerContext): any {
    try {
      // Check for template string interpolation first
      if (expression.includes("${")) {
        const interpolated = this.interpolate(expression, context);
        // If the result is a number-like string, convert it, unless it was a partial interpolation intended to be text
        if (!isNaN(Number(interpolated)) && interpolated.trim() !== "") {
            return Number(interpolated);
        }
        return interpolated;
      }

      // Si la expresión contiene solo variables y no operadores matemáticos
      if (!/[\+\-\*\/\%\(\)\[\]]/.test(expression)) {
        // Simple variable or value lookup (no math ops)
        // If it looks like a path, resolve it.
        return this.evaluateExpression(expression, context);
      }

      // Preprocesar la expresión para manejar variables y funciones
      let processedExpression = this.preprocessExpression(expression, context);

      // Evaluar la expresión procesada
      return this.evaluateMathExpression(processedExpression);
    } catch (error) {
      console.error(`Error evaluando expresión: ${expression}`, error);
      return null;
    }
  }

  /**
   * Realiza interpolación de variables en una plantilla de texto
   * Ejemplo: "Hola ${data.username}, hoy es ${new Date().toLocaleDateString()}"
   */
  static interpolate(template: string, context: TriggerContext): string {
    return template.replace(/\$\{([^}]+)\}/g, (match, expression) => {
      try {
        const result = this.evaluateExpression(expression, context);
        return String(result);
      } catch (error) {
        console.error(`Error en interpolación: ${match}`, error);
        return match; // Devuelve la expresión original si hay error
      }
    });
  }

  /**
   * Preprocesa la expresión para reemplazar variables con sus valores reales
   */
  private static preprocessExpression(
    expression: string,
    context: TriggerContext,
  ): string {
    // Reemplazar propiedades del contexto (data.field, globals.var, etc.)
    let processed = expression.replace(
      /(?:data|globals|request|computed)\.[a-zA-Z0-9_\.]+/g,
      (match) => {
        const value = this.getNestedValue(match, context);
        return typeof value === "string" ? `"${value}"` : String(value);
      },
    );

    // Procesar funciones matemáticas básicas
    processed = processed.replace(
      /Math\.(random|floor|ceil|round|sqrt|abs|pow|min|max|sin|cos|tan)\(/g,
      (match) => {
        return match;
      },
    );

    return processed;
  }

  /**
   * Evalúa una expresión matemática segura usando Function constructor
   */
  private static evaluateMathExpression(expression: string): any {
    try {
      // Crear una función segura que solo permita operaciones matemáticas básicas
      const mathFunction = new Function("Math", `return ${expression}`);
      return mathFunction(Math);
    } catch (error) {
      throw new Error(`Error evaluando expresión matemática: ${expression}`);
    }
  }

  /**
   * Evalúa una expresión individual en el contexto
   */
  private static evaluateExpression(
    expression: string,
    context: TriggerContext,
  ): any {
    // Intentar obtener un valor del contexto
    if (/^(data|globals|request|computed)\./.test(expression)) {
      return this.getNestedValue(expression, context);
    }

    // Intentar evaluar como expresión de JavaScript
    try {
      return new Function(
        "context",
        "with(context) { return " + expression + " }",
      )(context);
    } catch (error) {
      // Si falla, devolver la expresión original
      return expression;
    }
  }

  /**
   * Obtiene un valor anidado de un objeto usando notación de puntos
   * Ejemplo: getNestedValue("data.user.profile.name", context)
   */
  static getNestedValue(path: string, context: TriggerContext): any {
    const parts = path.split(".");
    let current: any = context;

    for (const part of parts) {
      if (current === null || current === undefined || !(part in current)) {
        return undefined;
      }
      current = current[part];
    }

    return current;
  }

  /**
   * Ejecuta una expresión matemática específica (como "1 + 2")
   */
  static evaluateMath(expression: string, context: TriggerContext): number {
    // Extraer variables de la expresión
    let processedExpression = expression;

    // Reemplazar variables de contexto en la expresión
    processedExpression = processedExpression.replace(
      /\b[a-zA-Z_][a-zA-Z0-9_]*\b/g,
      (match) => {
        // Verificar si es una palabra reservada de JavaScript o función Math
        if (
          [
            "Math",
            "random",
            "floor",
            "ceil",
            "round",
            "sqrt",
            "abs",
            "pow",
            "min",
            "max",
            "sin",
            "cos",
            "tan",
          ].includes(match)
        ) {
          return match;
        }

        // Intentar obtener valor del contexto
        const value = this.getNestedValue(match, context);
        if (value !== undefined) {
          return typeof value === "string" ? `"${value}"` : String(value);
        }

        return match;
      },
    );

    try {
      // Evaluar la expresión matemática
      return this.evaluateMathExpression(processedExpression);
    } catch (error) {
      console.error(`Error en evaluación matemática: ${expression}`, error);
      return NaN;
    }
  }
}
