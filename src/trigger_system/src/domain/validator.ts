// src/trigger_system/validator.ts
import { z } from "zod";

// --- Zod Schemas ---

export const ComparisonOperatorSchema = z.enum([
  'EQ', '==',
  'NEQ', '!=',
  'GT', '>',
  'GTE', '>=',
  'LT', '<',
  'LTE', '<=',
  'IN',
  'NOT_IN',
  'CONTAINS',
  'MATCHES',
  'RANGE'
]);

export const ConditionSchema = z.object({
  field: z.string().describe("The field path to check (e.g. data.amount)"),
  operator: ComparisonOperatorSchema,
  value: z.any().describe("The value to compare against")
});

export const ConditionGroupSchema = z.object({
  operator: z.enum(['AND', 'OR']),
  conditions: z.array(z.lazy(() => z.union([ConditionSchema, ConditionGroupSchema])))
});

// Recursive union for conditions
export const RuleConditionSchema = z.union([ConditionSchema, ConditionGroupSchema]);

export const ActionSchema = z.object({
  type: z.string().describe("The action type identifier"),
  params: z.record(z.any()).optional().default({}),
  delay: z.number().optional().min(0),
  probability: z.number().min(0).max(1).optional()
});

export const ActionGroupSchema = z.object({
  mode: z.enum(['ALL', 'EITHER', 'SEQUENCE']).default('ALL'),
  actions: z.array(ActionSchema)
});

export const TriggerRuleSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  description: z.string().optional(),
  priority: z.number().optional().default(0),
  enabled: z.boolean().optional().default(true),
  cooldown: z.number().min(0).optional(),
  tags: z.array(z.string()).optional(),
  
  on: z.string({
    invalid_type_error: "Event name 'on' must be a string. If using YAML, ensure it is quoted: 'on': \"EventName\""
  }),
  
  if: z.union([
    RuleConditionSchema, 
    z.array(RuleConditionSchema)
  ]).optional(),
  
  do: z.union([
    ActionSchema, 
    z.array(ActionSchema), 
    ActionGroupSchema
  ])
});

// --- Validation Result Types ---

export interface ValidationSuccess {
  valid: true;
  rule: z.infer<typeof TriggerRuleSchema>;
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
    const result = TriggerRuleSchema.safeParse(data);

    if (result.success) {
      // Additional Logic Checks can go here (warns)
      return { valid: true, rule: result.data };
    } else {
      const issues: ValidationIssue[] = result.error.errors.map(err => {
        const path = err.path.join(".");
        
        let message = err.message;
        let suggestion = undefined;

        // Custom Error Enhancements
        if (path.endsWith("on") && err.code === "invalid_type") {
            message = "The 'on' field is incorrect.";
            suggestion = "In YAML, 'on' is a boolean keyword (true). Quote it: \"on\": \"EventName\"";
        }
        
        return {
          path,
          message,
          suggestion,
          severity: "error"
        };
      });

      return { valid: false, issues };
    }
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
