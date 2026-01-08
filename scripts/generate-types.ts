import { generatePluginTypes } from "../src/types/generator";
import { join } from "node:path";

async function main() {
  const pluginsDir = join(process.cwd(), "plugins");
  const outputDir = join(process.cwd(), "plugin-types");
  
  console.log("Generating dynamic plugin types...");
  console.log(`Plugins directory: ${pluginsDir}`);
  console.log(`Output directory: ${outputDir}`);
  console.log("");
  
  const plugins = await generatePluginTypes(pluginsDir, outputDir);
  
  console.log(`\nGenerated types for ${plugins.length} plugins:`);
  for (const plugin of plugins) {
    console.log(`  - ${plugin.name} (${plugin.className})`);
    if (plugin.apiInterface) {
      console.log(`    API: ${plugin.apiInterface}`);
    }
  }
  
  console.log("\n✓ Dynamic autocomplete enabled!");
  console.log("  Plugin names are automatically discovered from the plugins directory.");
  console.log("  No static KnownPluginNames type needed.");
}

main().catch(console.error);
