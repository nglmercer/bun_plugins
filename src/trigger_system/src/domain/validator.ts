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
        
        do: "Action | Action[] | ActionGroup"
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

    return { valid: true, rule: out as TriggerRule };
  }

  /**
   * Generates a JSON Schema for VSCode Autocomplete
   */
  static generateJsonSchema(): any {
    // Basic conversion logic or strictly defining the schema
    // Since we don't have zod-to-json-schema installed, we'll manually construct a decent schema
    // or return a simplified one.
    // Ideally we'd return a full JSON Schema Draft 7 object.
    
    return {
      "$schema": "http://json-schema.org/draft-07/schema#",
      "type": "object",
      "properties": {
        "id": { "type": "string" },
        "on": { "type": "string", "description": "Event name" },
        "if": { 
             "oneOf": [
                 { "$ref": "#/definitions/Condition" },
                 { "type": "array", "items": { "$ref": "#/definitions/Condition" } }
             ]
        },
        "do": {
            "oneOf": [
                { "$ref": "#/definitions/Action" },
                { "type": "array", "items": { "$ref": "#/definitions/Action" } },
                { "$ref": "#/definitions/ActionGroup" }
            ]
        }
      },
      "required": ["id", "on", "do"],
      "definitions": {
          "Condition": {
              "type": "object",
              "properties": {
                  "field": { "type": "string" },
                  "operator": { "type": "string", "enum": ["EQ", "GT", "LT", "matches", "contains"] }, // Simplified
                  "value": { "description": "Comparison value" }
              }
          },
          "Action": {
              "type": "object",
              "properties": {
                  "type": { "type": "string" },
                  "params": { "type": "object" },
                  "delay": { "type": "number" }
              },
              "required": ["type"]
          },
          "ActionGroup": {
              "type": "object",
              "properties": {
                  "mode": { "type": "string", "enum": ["ALL", "EITHER", "SEQUENCE"] },
                  "actions": { "type": "array", "items": { "$ref": "#/definitions/Action" } }
              }
          }
      }
    };
  }
}
