import { generatePluginTypes } from "../src/types/generator";
import { join } from "node:path";

async function main() {
  const pluginsDir = join(process.cwd(), "plugins");
  const outputDir = join(process.cwd(), ".bun-plugins-types");
  
  console.log("Generating plugin types...");
  console.log(`Plugins directory: ${pluginsDir}`);
  console.log(`Output directory: ${outputDir}`);
  
  const plugins = await generatePluginTypes(pluginsDir, outputDir);
  
  console.log(`\nGenerated types for ${plugins.length} plugins:`);
  for (const plugin of plugins) {
    console.log(`  - ${plugin.name} (${plugin.className})`);
  }
}

main().catch(console.error);
