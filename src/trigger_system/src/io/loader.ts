import { Glob } from "bun";
import * as path from "path";
import { watch } from "fs";
import type { TriggerRule } from "../types";
import { TriggerValidator } from "../domain/validator";

export class TriggerLoader {
  /**
   * Loads all YAML rule files from a directory
   * @param dirPath Absolute path to the directory containing rule definitions
   */
  static async loadRulesFromDir(dirPath: string): Promise<TriggerRule[]> {
    const rules: TriggerRule[] = [];
    // Glob for .yaml and .yml files
    const glob = new Glob("**/*.{yaml,yml}");

    for await (const file of glob.scan({ cwd: dirPath, absolute: true })) {
      try {
        const loadedRules = await this.loadRule(file);
        rules.push(...loadedRules);
      } catch (err) {
        console.error(`Failed to load rule from ${file}:`, err);
      }
    }

    return rules;
  }

  /**
   * Loads rules from a YAML file (supports multi-document)
   */
  static async loadRule(filePath: string): Promise<TriggerRule[]> {
    try {
      const file = Bun.file(filePath);
      const content = await file.text();
      
      const data = Bun.YAML.parse(content);
      const docs = Array.isArray(data) ? data : [data];
      const rules: TriggerRule[] = [];

      docs.forEach((doc, index) => {
        // Normalize 'actions' to 'do' alias
        if (doc && typeof doc === 'object' && doc.actions && !doc.do) {
            doc.do = doc.actions;
        }

        const validation = TriggerValidator.validate(doc);
        
        if (validation.valid) {
          const rule = validation.rule;
           // Assign ID from filename if missing, with index suffix if multidoc
          if (!rule.id) {
            const base = path.basename(filePath, path.extname(filePath));
            rule.id = docs.length > 1 ? `${base}-${index}` : base;
          }
          rules.push(rule);
        } else {
             console.warn(`\n[TriggerLoader] ⚠️ Validation Problem in ${filePath} (doc #${index + 1})`);
             validation.issues.forEach(issue => {
                 console.warn(`  - [${issue.path}] ${issue.message}`);
                 if (issue.suggestion) {
                     console.warn(`    💡 Suggestion: ${issue.suggestion}`);
                 }
             });
        }
      });

      return rules;
    } catch (error) {
      console.error(`Error parsing YAML file ${filePath}:`, error);
      throw error;
    }
  }
  /**
   * Watches a directory for changes and reloads rules automatically.
   * @param dirPath Directory to watch
   * @param onUpdate Callback function that receives the updated list of rules
   * @returns FSWatcher instance (call .close() to stop watching)
   */
  static watchRules(dirPath: string, onUpdate: (rules: TriggerRule[]) => void) {
    // Initial load
    this.loadRulesFromDir(dirPath).then(onUpdate);

    console.log(`[TriggerLoader] Watching for changes in ${dirPath}...`);

    const watcher = watch(dirPath, { recursive: true }, async (event, filename) => {
      // Check if it's a YAML file
      if (filename && (filename.endsWith('.yaml') || filename.endsWith('.yml'))) {
        console.log(`[TriggerLoader] Detected change in ${filename} (${event}). Reloading rules...`);
        
        try {
          const rules = await this.loadRulesFromDir(dirPath);
          onUpdate(rules);
          console.log(`[TriggerLoader] Reloaded ${rules.length} rules.`);
        } catch (err) {
          console.error("[TriggerLoader] Failed to reload rules:", err);
        }
      }
    });


    return watcher;
  }
}
