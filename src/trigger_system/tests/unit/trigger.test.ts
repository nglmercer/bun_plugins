import { describe, expect, test, mock, beforeAll } from "bun:test";
import { TriggerEngine } from "../../src/core/engine";
import * as path from "path";

describe("Trigger System", () => {
    let engine: TriggerEngine;

    beforeAll(async () => {
        engine = new TriggerEngine();
        
        // Register generic actions
        engine.registerAction("LOG", async (params) => {
            console.log("Logged:", params.message);
            return params.message;
        });

        engine.registerAction("REWARD", async (params) => {
            return { rewarded: params.amount };
        });
        
        // Load the sample rules
        await engine.loadRules(path.join(import.meta.dir, "rules"));
    });

    test("Should trigger action when user matches", async () => {
        const results = await engine.processEvent({
            event: "USER_LOGIN",
            timestamp: Date.now(),
            data: { username: "admin" }
        });

        expect(results).toHaveLength(1);
        expect(results[0]!.success).toBe(true);
        expect(results[0]!.executedActions[0]!.result).toBe("Admin loaded: admin");
    });

    test("Should NOT trigger when user does not match", async () => {
        const results = await engine.processEvent({
            event: "USER_LOGIN",
            timestamp: Date.now(),
            data: { username: "guest" }
        });

        expect(results).toHaveLength(0);
    });

    test("Should trigger range condition", async () => {
        const results = await engine.processEvent({
            event: "GAME_OVER",
            timestamp: Date.now(),
            data: { score: 500 }
        });

        expect(results).toHaveLength(1);
        expect(results[0]!.executedActions[0]!.type).toBe("REWARD");
        expect(results[0]!.executedActions[0]!.result).toEqual({ rewarded: 50 });
    });

    test("Should NOT trigger range condition if out of range", async () => {
        const results = await engine.processEvent({
            event: "GAME_OVER",
            timestamp: Date.now(),
            data: { score: 50 } // < 100
        });

        expect(results).toHaveLength(0);
    });
});
