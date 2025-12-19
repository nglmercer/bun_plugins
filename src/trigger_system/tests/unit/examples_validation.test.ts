import { describe, it, expect } from "bun:test";
import { TriggerValidator } from "../../src/domain/validator";
import { TriggerLoader } from "../../src/io/loader";
import path from "path";
import fs from "fs";

describe("YAML Examples Validation", () => {
    const examplesDir = path.join(import.meta.dir, "../rules/examples");
    const files = fs.readdirSync(examplesDir).filter(f => f.endsWith(".yaml") || f.endsWith(".yml"));

    files.forEach(file => {
        it(`should validate ${file} correctly`, async () => {
            const filePath = path.join(examplesDir, file);
            // We use loader to parse the file first (it returns an array if it's a list)
            const rules = await TriggerLoader.loadRule(filePath);
            
            expect(rules.length).toBeGreaterThan(0);

            rules.forEach((rule, index) => {
                const result = TriggerValidator.validate(rule);
                if (!result.valid) {
                    console.error(`Validation failed for ${file} at rule index ${index}:`, JSON.stringify(result.issues, null, 2));
                }
                expect(result.valid).toBe(true);
            });
        });
    });
});
