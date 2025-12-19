
import { describe, expect, test } from "bun:test";
import { ExpressionEngine } from "../../src/core/expression-engine";
import type { TriggerContext } from "../../src/types";

describe("Robustness & Error Handling", () => {
    
    test("Should handle null/undefined data safely in interpolation", () => {
        const context: TriggerContext = {
            event: "TEST",
            timestamp: Date.now(),
            data: { user: null } // Explicit null
        };
        
        // Case A: Accessing null property directly
        // ${data.user} -> "undefined" or "null" (if json null) -> null stays null?
        // getNestedValue("data.user") returns null.
        // Interpolate converts result to string safely.
        
        let result = ExpressionEngine.interpolate("Hello ${data.user}", context);
        expect(result).toBe("Hello undefined"); // Our code returns "undefined" string for null/undefined
    });

    test("Should handle deeply nested missing data", () => {
        const context: TriggerContext = {
            event: "TEST",
            timestamp: Date.now(),
            data: {} // Empty
        };
        
        // Case B: Accessing missing deep property
        // ${data.user.name} -> data.user is undefined.
        // getNestedValue returns undefined using safety check.
        // interpolate gets undefined -> returns "undefined".
        
        let result = ExpressionEngine.interpolate("Hello ${data.user.name}", context);
        expect(result).toBe("Hello undefined");
    });
    
    test("Should support default values using JS expression fallback", () => {
         const context: TriggerContext = {
            event: "TEST",
            timestamp: Date.now(),
            data: { existing: "Values" }
        };
        
        // This relies on `evaluateExpression` falling back to JS `new Function`.
        // However, `data.missing` will throw ReferenceError if `data` is in context but `missing` isn't? 
        // No, `data.missing` is undefined in JS.
        // But `missingTopLevel.field` throws ReferenceError.
        
        // Note: The expression engine tries `getNestedValue` first. 
        // "data.existing || 'Default'" is NOT a valid path, so getNestedValue returns undefined.
        // It falls back to JS eval.
        
        const result = ExpressionEngine.interpolate("${data.existing || 'Default'}", context);
        expect(result).toBe("Values");
        
        // Now missing
        // This might fail if 'data' is not safe, but let's test.
        const result2 = ExpressionEngine.interpolate("${data.missing || 'Default'}", context);
        expect(result2).toBe("Default");
    });
});
