
import { describe, expect, test } from "bun:test";
import { RuleEngine } from "../src/core/rule-engine";
import { ActionRegistry } from "../src/core/action-registry";
import { ExpressionEngine } from "../src/core/expression-engine";
import type { TriggerRule, TriggerContext } from "../src/types";

describe("Verification V2: New Features", () => {
    
    // 1. Test Action Registry
    test("Should support custom registered actions", async () => {
        const registry = ActionRegistry.getInstance();
        let customActionExecuted = false;

        registry.register("TEST_CUSTOM", (action, context) => {
            customActionExecuted = true;
            return { processed: true, data: context.data.value };
        });

        const rule: TriggerRule = {
            id: "custom-action-test",
            on: "TEST_EVENT",
            do: { type: "TEST_CUSTOM" }
        };

        const engine = new RuleEngine({ rules: [rule], globalSettings: {} });
        const context: TriggerContext = {
            event: "TEST_EVENT",
            timestamp: Date.now(),
            data: { value: 123 }
        };

        const results = await engine.evaluateContext(context);
        
        expect(results).toHaveLength(1);
        expect(results[0]!.success).toBe(true);
        expect(results[0]!.executedActions[0]!.type).toBe("TEST_CUSTOM");
        expect(customActionExecuted).toBe(true);
    });

    // 2. Test Dynamic Values in Conditions
    test("Should compare against dynamic values in conditions", async () => {
        const rule: TriggerRule = {
            id: "dynamic-condition",
            on: "CHECK_LIMIT",
            if: {
                field: "data.amount",
                operator: "GT",
                value: "${globals.dailyLimit}" // Dynamic value
            },
            do: { type: "log", params: { message: "Limit Exceeded" } }
        };

        const engine = new RuleEngine({ rules: [rule], globalSettings: {} });
        
        // Context where amount > limit
        const contextSuccess: TriggerContext = {
            event: "CHECK_LIMIT",
            timestamp: Date.now(),
            data: { amount: 500 },
            globals: { dailyLimit: 100 }
        };

        const resultsSuccess = await engine.evaluateContext(contextSuccess);
        expect(resultsSuccess).toHaveLength(1);

        // Context where amount < limit
        const contextFail: TriggerContext = {
            event: "CHECK_LIMIT",
            timestamp: Date.now(),
            data: { amount: 50 },
            globals: { dailyLimit: 100 }
        };
        
        const resultsFail = await engine.evaluateContext(contextFail);
        expect(resultsFail).toHaveLength(0);
    });

    // 3. Test Date Operators (SINCE / BEFORE)
    test("Should handle date operators (SINCE / BEFORE)", async () => {
        const now = Date.now();
        const oneHourAgo = now - 3600000;
        const oneHourFuture = now + 3600000;

        const rule: TriggerRule = {
            id: "date-check",
            on: "TIME_EVENT",
            if: {
                operator: "AND",
                conditions: [
                    { field: "data.createdAt", operator: "SINCE", value: oneHourAgo }, // Should be true (created after 1h ago)
                    { field: "data.createdAt", operator: "BEFORE", value: oneHourFuture } // Should be true (created before 1h future)
                ]
            },
            do: { type: "log" }
        };

        const engine = new RuleEngine({ rules: [rule], globalSettings: {} });
        
        const context: TriggerContext = {
            event: "TIME_EVENT",
            timestamp: now,
            data: { createdAt: now }
        };

        const results = await engine.evaluateContext(context);
        expect(results).toHaveLength(1);
    });

    // 4. Test Regex Match
    test("Should handle MATCHES operator", async () => {
        const rule: TriggerRule = {
            id: "regex-test",
            on: "MSG",
            if: {
                field: "data.text",
                operator: "MATCHES",
                value: "^Hello.*World$"
            },
            do: { type: "log" }
        };

        const engine = new RuleEngine({ rules: [rule], globalSettings: {} });
        const context: TriggerContext = {
            event: "MSG",
            timestamp: Date.now(),
            data: { text: "Hello Beautiful World" }
        };

        const results = await engine.evaluateContext(context);
        expect(results).toHaveLength(1);
    });
});
