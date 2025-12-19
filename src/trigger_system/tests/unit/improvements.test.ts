
import { describe, expect, test, afterAll, beforeAll } from "bun:test";
import { RuleEngine } from "../../src/core/rule-engine";
import { FilePersistence } from "../../src/core/persistence-file";
import { StateManager } from "../../src/core/state-manager";
import type { TriggerRule } from "../../src/types";
import { unlinkSync, existsSync } from "node:fs";
import * as path from "path";

describe("Robustness & Improvements", () => {
    
    test("Safe Numeric Comparisons: Null should not be treated as 0", async () => {
        const rule: TriggerRule = {
            id: "null_safe_check",
            on: "TEST_EVENT",
            if: {
                field: "data.level",
                operator: "GTE",
                value: 0
            },
            do: { type: "LOG" }
        };

        const engine = new RuleEngine({
            rules: [rule],
            globalSettings: { evaluateAll: true }
        });

        // Case 1: Real 0
        const result1 = await engine.evaluateContext({
            event: "TEST_EVENT",
            data: { level: 0 },
            id: "1", timestamp: Date.now()
        });
        expect(result1.length).toBe(1); // 0 >= 0 is true

        // Case 2: Null
        const result2 = await engine.evaluateContext({
            event: "TEST_EVENT",
            data: { level: null },
            id: "2", timestamp: Date.now()
        });
        expect(result2.length).toBe(0); // null >= 0 should be false in safe mode

        // Case 3: Undefined
        const result3 = await engine.evaluateContext({
            event: "TEST_EVENT",
            data: { level: undefined },
            id: "3", timestamp: Date.now()
        });
        expect(result3.length).toBe(0); // undefined >= 0 should be false
    });

    test("Strict Actions Mode: Should fail on unknown actions", async () => {
        const rule: TriggerRule = {
            id: "strict_action_check",
            on: "TEST_EVENT",
            do: { type: "UNKNOWN_ACTION" } // Not registered
        };

        const engine1 = new RuleEngine({
            rules: [rule],
            globalSettings: { evaluateAll: true, strictActions: false } // Default
        });
        //@ts-expect-error
        const res1 = await engine1.evaluateContext({
            event: "TEST_EVENT",
            id: "1", timestamp: Date.now()
        });
        // Should have a warning result, but not explicit error in top level outcome logic (just logged)
        // But the action result should contain 'warning'
        expect(res1[0]!.executedActions[0]!.result).toHaveProperty('warning');

        const engine2 = new RuleEngine({
            rules: [rule],
            globalSettings: { evaluateAll: true, strictActions: true } // Strict
        });
        //@ts-expect-error
        const validContext = {
            event: "TEST_EVENT",
            id: "2", timestamp: Date.now()
        };

        // Should throw error in strict mode
        // Note: rule engine evaluates actions partially in sequence or parallel depending on mode ('ALL' default).
        // If it throws, the whole evaluateContext might throw if unhandled? 
        // RuleEngine.evaluateContext -> executeRuleActions -> executeSingleAction
        // executeSingleAction throws Error in strict mode.
        // executeRuleActions doesn't catch it. 
        // So evaluateContext throws.
        
        const res2 = await engine2.evaluateContext(validContext);
        
        const actionResult = res2[0]!.executedActions[0];
        // The error is a top-level property of the action execution result, not inside 'result'
        expect(actionResult).toHaveProperty('error'); 
        expect(actionResult.error).toContain("Tipo de acción genérica o desconocida");
    });

    const TEST_FILE = path.resolve(process.cwd(), "test_state.json");

    test("File Persistence: Should save and load state", async () => {
        if (existsSync(TEST_FILE)) unlinkSync(TEST_FILE);

        const persistence = new FilePersistence(TEST_FILE);
        const stateManager = StateManager.getInstance();
        
        // We need to inject the persistence adapter manually or via some method
        // But StateManager is a Singleton. Let's see if we can reset it or access it.
        // The StateManager code wasn't fully shown but assuming we can set adapter or use it directly.
        // Actually, let's test FilePersistence class directly to avoid singleton pollution for now.
        
        await persistence.saveState("users.visits", 5);
        await persistence.saveState("last_seen", "2023-01-01");

        // Verify file exists
        expect(existsSync(TEST_FILE)).toBe(true);

        // New Instance
        const persistence2 = new FilePersistence(TEST_FILE);
        const state = await persistence2.loadState();

        expect(state.get("users.visits")).toBe(5);
        expect(state.get("last_seen")).toBe("2023-01-01");

        // Cleanup
        unlinkSync(TEST_FILE);
    });

});
