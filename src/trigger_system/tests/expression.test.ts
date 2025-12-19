import { describe, expect, test } from "bun:test";
import { ExpressionEngine } from "../src/core/expression-engine";

describe("Expression Engine Tests", () => {
    
    // --- Basic Interpolation ---
    
    test("Should interpolate simple variables", () => {
        const context = {
            event: "test",
            timestamp: 123456789,
            data: { name: "Alice" }
        } as any;
        
        const result = ExpressionEngine.interpolate("Hello ${data.name}", context);
        expect(result).toBe("Hello Alice");
    });

    // --- Math Evaluation ---

    test("Should evaluate expressions with math", () => {
        const context = {
            event: "test",
            timestamp: 0,
            data: { a: 10, b: 5 }
        } as any;

        const result = ExpressionEngine.evaluate("data.a + data.b", context);
        expect(result).toBe(15);
    });

    test("Should handle Math functions", () => {
        const context = {
            data: { val: 16 }
        } as any;
        
        // Assuming implementation allows "Math.sqrt()" calls inside evaluate or similar logic
        // The current implementation preprocesses "Math.sqrt" tokens.
        const result = ExpressionEngine.evaluate("Math.sqrt(data.val)", context);
        expect(result).toBe(4);
    });

    test("Should safely return NaN or error for bad expressions", () => {
        const result = ExpressionEngine.evaluate("10 / 'apple'", {} as any);
        // JS evaluation might be NaN for 10/"apple"
        expect(result).toBeNaN();
    });

    // --- Nested Access ---

    test("Should access deeply nested properties", () => {
        const context = {
            data: { user: { profile: { age: 30 } } }
        } as any;
        
        const val = ExpressionEngine.getNestedValue("data.user.profile.age", context);
        expect(val).toBe(30);
    });

    test("Should return undefined for missing paths", () => {
        const context = { data: {} } as any;
        const val = ExpressionEngine.getNestedValue("data.user.missing", context);
        expect(val).toBeUndefined();
    });
});
