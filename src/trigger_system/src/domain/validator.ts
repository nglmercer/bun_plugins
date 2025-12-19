// src/domain/validator.ts
import { type, scope } from "arktype";
import type { TriggerRule } from "../types";

// --- ArkType Scope & Schemas ---

// Define a Validation Scope to handle recursive types and mutual dependencies
const types = scope({

    // List of allowed operators
    Operator: "'EQ' | '==' | 'NEQ' | '!=' | 'GT' | '>' | 'GTE' | '>=' | 'LT' | '<' | 'LTE' | '<=' | 'IN' | 'NOT_IN' | 'CONTAINS' | 'MATCHES' | 'RANGE' | 'SINCE' | 'AFTER' | 'BEFORE' | 'UNTIL'",
    
    Condition: {
        field: "string > 0", // Must not be empty
        operator: "Operator",
        value: "unknown"
    },
    
    ConditionGroup: {
        operator: "'AND' | 'OR'",
        // Recursive reference to Condition or ConditionGroup
        conditions: "(Condition | ConditionGroup)[] >= 1" // Must have at least 1 condition
    },
    
    RuleCondition: "Condition | ConditionGroup",

    Action: {
        type: "string > 0", // Must define a type
        "params?": "object", // Must be an object if present
        "delay?": "number.integer >= 0", // Integer check for milliseconds
        "probability?": "0 <= number <= 1"
    },

    ActionGroup: {
        "mode?": "'ALL' | 'EITHER' | 'SEQUENCE'",
        actions: "Action[] >= 1" // Empty group is useless
    },

    TriggerRule: {
        id: "string > 0",
        "name?": "string",
        "description?": "string",
        "priority?": "number.integer", // Priority is integer
        "enabled?": "boolean",
        "cooldown?": "number.integer >= 0", // Milliseconds
        "tags?": "string[]",
        on: "string > 0", // Non-empty event name
        
        "if?": "RuleCondition | RuleCondition[]",
        
        do: "Action | Action[] | ActionGroup",
        "comment?": "string"
    }
}).export();

// Export individual schemas for external usage if needed
export const ComparisonOperatorSchema = types.Operator;
export const ConditionSchema = types.Condition;
export const ConditionGroupSchema = types.ConditionGroup;
export const RuleConditionSchema = types.RuleCondition;
export const ActionSchema = types.Action;
export const ActionGroupSchema = types.ActionGroup;
export const TriggerRuleSchema = types.TriggerRule;

// --- Validation Result Types ---

export interface ValidationSuccess {
  valid: true;
  rule: TriggerRule;
}

export interface ValidationIssue {
  path: string;
  message: string;
  suggestion?: string;
  severity: "error" | "warning";
}

export interface ValidationFailure {
  valid: false;
  issues: ValidationIssue[];
}

export type ValidationResult = ValidationSuccess | ValidationFailure;

// --- Validator Class ---

export class TriggerValidator {
  
  static validate(data: any): ValidationResult {
    // ArkType validation
    const out = TriggerRuleSchema(data);

    if (out instanceof type.errors) {
      const issues: ValidationIssue[] = [];
      
      // Iterate over problems (ArkType specific)
      for (const problem of out) {
          const path = problem.path.join(".");
          let message = problem.message;
          let suggestion = undefined;

          // Custom Error Enhancements (replicating Zod logic)
          // ArkType error for missing string might differ, typically says "must be a string"
          if (path.endsWith("on") && (message.includes("string") || message.includes("must be"))) {
               // Heuristic check if it failed because it was interpretted as boolean 'true' in YAML
               // We can't see the original value easily here without checking 'data' at path
               // But we can just suggest it generally.
               if (typeof data === 'object' && data && data.on === true) {
                   message = "The 'on' field is incorrect (boolean true found).";
                   suggestion = "In YAML, 'on' is a boolean keyword (true). Quote it: \"on\": \"EventName\"";
               } else {
                   // Generic suggestion
                   suggestion = "Ensure 'on' is a string event name.";
               }
          }

          issues.push({
              path,
              message,
              suggestion,
              severity: "error"
          });
      }

      return { valid: false, issues };
    }
    
    // Structural validation passed. Now perform Semantic Validation (Value Types)
    const rule = out as TriggerRule;
    const semanticIssues: ValidationIssue[] = [];
    
    this.validateConditionsRecursive(rule.if, semanticIssues, 'if');

    if (semanticIssues.length > 0) {
        return { valid: false, issues: semanticIssues };
    }

    return { valid: true, rule };
  }

  private static validateConditionsRecursive(
      condition: any, 
      issues: ValidationIssue[], 
      path: string
  ): void {
      if (!condition) return;

      if (Array.isArray(condition)) {
          condition.forEach((c, idx) => {
              this.validateConditionsRecursive(c, issues, `${path}.${idx}`);
          });
          return;
      }

      // Check if it's a ConditionGroup (has 'conditions')
      if ('conditions' in condition && Array.isArray(condition.conditions)) {
          condition.conditions.forEach((c: any, idx: number) => {
               this.validateConditionsRecursive(c, issues, `${path}.conditions.${idx}`);
          });
          return;
      }

      // It must be a Condition
      if ('operator' in condition && 'value' in condition) {
          this.validateConditionValue(condition, issues, path);
      }
  }

  private static validateConditionValue(
      condition: any, 
      issues: ValidationIssue[], 
      path: string
  ): void {
      const { operator, value } = condition;
      
      // 1. List Operators (IN, NOT_IN, RANGE)
      if (['IN', 'NOT_IN', 'RANGE'].includes(operator)) {
          if (!Array.isArray(value)) {
              issues.push({
                  path: `${path}.value`,
                  message: `Operator '${operator}' requires a list/array value.`,
                  suggestion: operator === 'RANGE' ? "Use format [min, max]" : "Use format [item1, item2]",
                  severity: "error"
              });
              return;
          }

          if (operator === 'RANGE') {
              if (value.length !== 2) {
                  issues.push({
                      path: `${path}.value`,
                      message: `Operator 'RANGE' requires exactly 2 values (min and max).`,
                      suggestion: "Use format [min, max]",
                      severity: "error"
                  });
              } else if (typeof value[0] !== 'number' || typeof value[1] !== 'number') {
                   // Range usually implies numbers, but could be dates? 
                   // Sticking to numbers for strictness unless 'SINCE' logic applies.
                   // The user provided example implies generic RANGE. 
                   // If they use non-numbers, we warn.
                   if (typeof value[0] !== 'number' && typeof value[0] !== 'string') {
                        issues.push({
                            path: `${path}.value`,
                            message: `Range values must be numbers or strings.`,
                            severity: "error"
                        });
                   }
              }
          }
      } 
      // 2. Regex
      else if (operator === 'MATCHES') {
          if (typeof value !== 'string') {
               issues.push({
                  path: `${path}.value`,
                  message: `Operator 'MATCHES' requires a string regex pattern.`,
                  severity: "error"
              });
          } else {
              try {
                  new RegExp(value);
              } catch (e) {
                  issues.push({
                      path: `${path}.value`,
                      message: `Invalid Regex pattern: ${(e as Error).message}`,
                      severity: "error"
                  });
              }
          }
      }
      // 3. Numeric Comparisons (GT, LT, etc)
      else if (['GT', 'GTE', 'LT', 'LTE', '>', '>=', '<', '<='].includes(operator)) {
           if (typeof value !== 'number' && typeof value !== 'string') {
               // We allow strings for dynamic refs or dates
               issues.push({
                   path: `${path}.value`,
                   message: `Operator '${operator}' requires a comparable value (number or string).`,
                   severity: "error"
               });
           }
      }
  }
}
