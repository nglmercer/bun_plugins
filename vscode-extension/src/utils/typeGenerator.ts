/**
 * Enhanced Type Generator for Bun Plugins
 * Creates .d.ts files dynamically for autocompletion with edge case handling
 * Supports automatic regeneration and modular architecture
 */

import * as fs from 'fs';
import * as path from 'path';
import { PluginInfo } from './types';
import {
  pluginNameToInterfaceName,
  getRelativeTypePath,
  formatMethodSignature,
  formatPropertySignature,
  isLifecycleMethod,
  generateJsDoc,
  isValidApiInterface
} from './typeUtils';
import {
  fileExists,
  ensureDirectory,
  writeFile,
  readJsonFile,
  writeJsonFile,
  findPluginFiles
} from './fileUtils';
import {
  validatePlugins,
  findDuplicatePluginNames
} from './validationUtils';

export interface GeneratedTypes {
  pluginTypes: string;
  globalTypes: string;
  pluginInterfaces: Map<string, string>;
}

export interface GenerationOptions {
  workspaceRoot: string;
  typesDir?: string;
  updateTsConfig?: boolean;
  validatePlugins?: boolean;
  generateDocs?: boolean;
  forceRegenerate?: boolean;
  verbose?: boolean;
}

export interface GenerationResult {
  success: boolean;
  errors: string[];
  warnings: string[];
  filesGenerated: string[];
  pluginCount: number;
  duration: number;
  typesDirCreated: boolean;
}

export class PluginTypeGenerator {
  private static instance: PluginTypeGenerator;
  private generatedTypes: Map<string, string> = new Map();
  private lastGenerationTime: Date | null = null;

  private constructor() {}

  static getInstance(): PluginTypeGenerator {
    if (!PluginTypeGenerator.instance) {
      PluginTypeGenerator.instance = new PluginTypeGenerator();
    }
    return PluginTypeGenerator.instance;
  }

  /**
   * Get the regeneration metadata file path
   */
  private getMetadataPath(workspaceRoot: string, typesDir: string): string {
    return path.join(workspaceRoot, typesDir, '.regeneration-metadata.json');
  }

  /**
   * Check if regeneration is needed by comparing plugin metadata
   */
  private needsRegeneration(
    workspaceRoot: string,
    plugins: PluginInfo[],
    typesDir: string
  ): boolean {
    try {
      const metadataPath = this.getMetadataPath(workspaceRoot, typesDir);
      
      // If no metadata exists, regeneration is needed
      if (!fileExists(metadataPath)) {
        console.log('[TypeGenerator] No metadata found, regeneration needed');
        return true;
      }

      const metadata = readJsonFile<{ plugins: any[]; lastGenerated: string }>(metadataPath);
      if (!metadata || !metadata.plugins) {
        console.log('[TypeGenerator] Invalid metadata found, regeneration needed');
        return true;
      }

      // Check if any plugin has changed
      for (const plugin of plugins) {
        const metaPlugin = metadata.plugins.find((p: any) => p.name === plugin.name);
        
        // New plugin or plugin metadata changed
        if (!metaPlugin || this.hasPluginChanged(plugin, metaPlugin)) {
          console.log(`[TypeGenerator] Plugin ${plugin.name} changed or is new, regeneration needed`);
          return true;
        }

        // Check if plugin file was modified
        try {
          const pluginStats = fs.statSync(plugin.filePath);
          if (metaPlugin.fileSize !== pluginStats.size ||
              metaPlugin.modifiedTime !== pluginStats.mtime.getTime()) {
            console.log(`[TypeGenerator] Plugin file ${plugin.filePath} modified, regeneration needed`);
            return true;
          }
        } catch (error) {
          console.log(`[TypeGenerator] Plugin file ${plugin.filePath} not accessible, regeneration needed`);
          return true;
        }
      }

      // Check if plugins were deleted
      if (metadata.plugins.length !== plugins.length) {
        console.log('[TypeGenerator] Plugin count changed, regeneration needed');
        return true;
      }

      console.log('[TypeGenerator] No changes detected, skipping regeneration');
      return false;
    } catch (error) {
      // On any error, regenerate
      console.warn('[TypeGenerator] Error checking regeneration status:', error);
      return true;
    }
  }

  /**
   * Check if plugin metadata has changed
   */
  private hasPluginChanged(plugin: PluginInfo, metaPlugin: any): boolean {
    return (
      plugin.methods.length !== metaPlugin.methodCount ||
      (plugin.properties?.length || 0) !== metaPlugin.propertyCount ||
      JSON.stringify(plugin.methods) !== JSON.stringify(metaPlugin.methods) ||
      JSON.stringify(plugin.properties) !== JSON.stringify(metaPlugin.properties)
    );
  }

  /**
   * Save regeneration metadata
   */
  private saveRegenerationMetadata(
    workspaceRoot: string,
    plugins: PluginInfo[],
    typesDir: string
  ): void {
    try {
      const metadataPath = this.getMetadataPath(workspaceRoot, typesDir);
      const pluginsMetadata = plugins.map(plugin => {
        const stats = fs.statSync(plugin.filePath);
        return {
          name: plugin.name,
          filePath: plugin.filePath,
          fileSize: stats.size,
          modifiedTime: stats.mtime.getTime(),
          methodCount: plugin.methods.length,
          propertyCount: plugin.properties?.length || 0,
          methods: plugin.methods,
          properties: plugin.properties
        };
      });

      const metadata = {
        lastGenerated: new Date().toISOString(),
        plugins: pluginsMetadata
      };

      writeJsonFile(metadataPath, metadata);
    } catch (error) {
      console.error('[TypeGenerator] Error saving regeneration metadata:', error);
    }
  }

  /**
   * Main entry point for generating types with validation and edge case handling
   */
  async generateTypesWithValidation(
    plugins: PluginInfo[],
    options: GenerationOptions
  ): Promise<GenerationResult> {
    const startTime = Date.now();
    const result: GenerationResult = {
      success: true,
      errors: [],
      warnings: [],
      filesGenerated: [],
      pluginCount: plugins.length,
      duration: 0,
      typesDirCreated: false
    };

    try {
      // Ensure types directory exists - CRITICAL FIX
      const typesDir = options.typesDir || '.bun-plugins-types';
      const typesPath = path.join(options.workspaceRoot, typesDir);
      
      // CRITICAL: Always create the directory, even if no plugins or errors
      try {
        if (!fs.existsSync(typesPath)) {
          fs.mkdirSync(typesPath, { recursive: true });
          result.typesDirCreated = true;
          if (options.verbose !== false) {
            console.log(`✅ Created types directory: ${typesPath}`);
          }
        }
      } catch (error) {
        result.success = false;
        result.errors.push(`Failed to create types directory: ${error instanceof Error ? error.message : String(error)}`);
        result.duration = Date.now() - startTime;
        return result;
      }

      // Check if regeneration is needed (unless forced)
      if (!options.forceRegenerate && !this.needsRegeneration(options.workspaceRoot, plugins, typesDir)) {
        result.warnings.push('Types are up to date. Use forceRegenerate to regenerate.');
        result.duration = Date.now() - startTime;
        return result;
      }

      // Validate plugins if requested
      if (options.validatePlugins !== false) {
        const validation = validatePlugins(plugins);
        
        // Check for duplicate plugin names
        const duplicates = findDuplicatePluginNames(plugins);
        if (duplicates.size > 0) {
          duplicates.forEach((dupPlugins, name) => {
            result.warnings.push(
              `Duplicate plugin name "${name}" found in: ${dupPlugins.map(p => p.filePath).join(', ')}`
            );
          });
        }

        // Add validation errors
        if (!validation.valid) {
          result.success = false;
          result.errors.push(...validation.errors);
        }
        result.warnings.push(...validation.warnings);
      }

      // Filter out invalid plugins with edge case handling
      const validPlugins = this.filterValidPlugins(plugins, result);
      
      if (validPlugins.length === 0) {
        result.warnings.push('No valid plugins found to generate types for');
        // Still create a minimal types file even if no plugins
        await this.createMinimalTypes(typesPath);
        result.duration = Date.now() - startTime;
        return result;
      }

      // Handle edge case: plugins with existing interfaces
      this.handleExistingInterfaces(validPlugins, result);

      // Generate types
      const types = this.generateTypes(validPlugins, options.generateDocs);

      // Save types to files
      const savedFiles = await this.saveTypes(options.workspaceRoot, types, typesDir);
      result.filesGenerated.push(...savedFiles);

      // Update tsconfig if requested
      if (options.updateTsConfig !== false) {
        await this.updateTsConfig(options.workspaceRoot, typesDir);
      }

      // Create README in types directory
      await this.createTypesReadme(typesPath, validPlugins);

      // Save regeneration metadata
      this.saveRegenerationMetadata(options.workspaceRoot, validPlugins, typesDir);

      this.lastGenerationTime = new Date();
      result.duration = Date.now() - startTime;
      
      if (options.verbose !== false) {
        console.log(`✅ Generated types for ${validPlugins.length} plugins in ${result.duration}ms`);
      }
    } catch (error) {
      result.success = false;
      result.errors.push(`Error generating types: ${error instanceof Error ? error.message : String(error)}`);
      result.duration = Date.now() - startTime;
      console.error('❌ Error generating types:', error);
    }

    return result;
  }

  /**
   * Handles plugins with existing API interfaces
   */
  private handleExistingInterfaces(plugins: PluginInfo[], result: GenerationResult): void {
    for (const plugin of plugins) {
      if (plugin.apiInterfaces && plugin.apiInterfaces.length > 0) {
        const interfaceName = plugin.apiInterfaces[0];
        
        // Edge case: interface name doesn't match expected pattern
        if (!isValidApiInterface(interfaceName)) {
          result.warnings.push(
            `Plugin "${plugin.name}" has existing interface "${interfaceName}" which doesn't follow the expected pattern`
          );
        }

        // Edge case: multiple API interfaces in same file
        if (plugin.apiInterfaces.length > 1) {
          result.warnings.push(
            `Plugin "${plugin.name}" has multiple API interfaces, using first one: ${interfaceName}`
          );
        }
      }
    }
  }

  /**
   * Filters plugins with edge case handling
   */
  private filterValidPlugins(plugins: PluginInfo[], result: GenerationResult): PluginInfo[] {
    const validPlugins: PluginInfo[] = [];

    for (const plugin of plugins) {
      // Edge case: plugin with no name
      if (!plugin.name || !plugin.name.trim()) {
        result.warnings.push(`Skipping plugin with no name: ${plugin.filePath}`);
        continue;
      }

      // Edge case: plugin file doesn't exist
      if (!fileExists(plugin.filePath)) {
        result.warnings.push(`Plugin file not found, skipping: ${plugin.filePath}`);
        continue;
      }

      // Edge case: plugin with invalid characters in name
      const sanitizedName = plugin.name.replace(/[^a-zA-Z0-9_-]/g, '');
      if (sanitizedName !== plugin.name) {
        result.warnings.push(`Plugin name contains invalid characters, sanitized: "${plugin.name}" -> "${sanitizedName}"`);
        // Create a new object to avoid mutating the original
        validPlugins.push({ ...plugin, name: sanitizedName });
      } else {
        validPlugins.push(plugin);
      }
    }

    return validPlugins;
  }

  /**
   * Creates minimal types file when no plugins exist
   */
  private async createMinimalTypes(typesPath: string): Promise<void> {
    const minimalPluginTypes = `// Types generated automatically by Bun Plugins LSP
// DO NOT EDIT MANUALLY - These types are regenerated automatically
// Last generated: ${new Date().toISOString()}
// No plugins found

export interface PluginTypeRegistry {
  // No plugins found
}

export type PluginNames = never;

export type PluginApi<TName extends keyof PluginTypeRegistry> = PluginTypeRegistry[TName];
`;

    const minimalGlobalTypes = `// Global types generated automatically by Bun Plugins LSP
// Last generated: ${new Date().toISOString()}
// No plugins found

declare global {
  interface PluginContext {
    /**
     * Gets a plugin by name with static typing
     * @param name Name of the plugin
     * @returns Plugin API or undefined if not found
     */
    getPlugin<TName extends never>(name: TName): undefined;
    getPlugin(name: string): unknown | undefined;
  }
}
`;

    writeFile(path.join(typesPath, 'plugin-types.d.ts'), minimalPluginTypes);
    writeFile(path.join(typesPath, 'global.d.ts'), minimalGlobalTypes);
  }

  /**
   * Generates TypeScript types for plugins
   */
  generateTypes(plugins: PluginInfo[], includeDocs: boolean = true): GeneratedTypes {
    const pluginInterfaces = new Map<string, string>();
    
    // Generate interfaces for each plugin
    plugins.forEach(plugin => {
      const interfaceCode = this.generatePluginInterface(plugin, includeDocs);
      pluginInterfaces.set(plugin.name, interfaceCode);
    });

    const pluginTypes = this.generatePluginTypesFile(plugins, pluginInterfaces);
    const globalTypes = this.generateGlobalTypesFile(plugins);

    return { pluginTypes, globalTypes, pluginInterfaces };
  }

  /**
   * Generates a single plugin interface with edge case handling
   */
  private generatePluginInterface(plugin: PluginInfo, includeDocs: boolean): string {
    const interfaceName = pluginNameToInterfaceName(plugin.name);

    // Edge case: plugin has existing API interfaces
    if (plugin.apiInterfaces && plugin.apiInterfaces.length > 0) {
      const existingInterface = plugin.apiInterfaces[0];
      const relativePath = getRelativeTypePath(plugin.filePath);
      
      return `// Using existing interface ${existingInterface} for plugin ${plugin.name}
export { ${existingInterface} } from '${relativePath}';
export type ${interfaceName} = ${existingInterface};`;
    }

    // Edge case: plugin has no methods and no properties
    const hasApi = plugin.methods.length > 0 || (plugin.properties && plugin.properties.length > 0);
    
    if (!hasApi) {
      return `// Interface generated for plugin ${plugin.name} (no API methods or properties)
export interface ${interfaceName} {
  // This plugin has no public API methods or properties
}`;
    }

    // Generate interface from methods and properties
    const methodsBlock = this.generateMethodsBlock(plugin.methods, includeDocs);
    const propertiesBlock = this.generatePropertiesBlock(plugin.properties, includeDocs);
    const getSharedApiMethod = this.generateGetSharedApiMethod(plugin);

    const docComment = includeDocs 
      ? generateJsDoc(`API interface for ${plugin.name}`, '  ')
      : '';

    return `// Interface generated for plugin ${plugin.name}
${docComment}export interface ${interfaceName} {
${methodsBlock}
${getSharedApiMethod}
${propertiesBlock}
}`;
  }

  /**
   * Generates the methods block for a plugin interface
   */
  private generateMethodsBlock(methods: PluginInfo['methods'], includeDocs: boolean): string {
    if (!methods || methods.length === 0) return '';

    return methods
      .filter(m => !isLifecycleMethod(m.name))
      .map(method => {
        const doc = includeDocs && method.doc ? generateJsDoc(method.doc, '  ') : '';
        const signature = formatMethodSignature(method.name, method.params, method.returnType);
        return `${doc}  ${signature}`;
      })
      .join('\n');
  }

  /**
   * Generates the properties block for a plugin interface
   */
  private generatePropertiesBlock(properties: PluginInfo['properties'], includeDocs: boolean): string {
    if (!properties || properties.length === 0) return '';

    const block = properties
      .map(prop => {
        const doc = includeDocs && prop.doc ? generateJsDoc(prop.doc, '  ') : '';
        const signature = formatPropertySignature(prop.name, prop.type);
        return `${doc}  ${signature}`;
      })
      .join('\n');

    return block.length > 0 ? `\n  ${block}` : '';
  }

  /**
   * Generates the getSharedApi method if not present
   */
  private generateGetSharedApiMethod(plugin: PluginInfo): string {
    const hasGetSharedApi = plugin.methods.some(m => m.name === 'getSharedApi');
    const interfaceName = pluginNameToInterfaceName(plugin.name);

    if (hasGetSharedApi) return '';

    // Only add if plugin has methods or properties
    if (plugin.methods.length > 0 || (plugin.properties && plugin.properties.length > 0)) {
      return `  getSharedApi(): ${interfaceName};`;
    }

    return '';
  }

  /**
   * Generates the main plugin types file
   */
  private generatePluginTypesFile(
    plugins: PluginInfo[],
    pluginInterfaces: Map<string, string>
  ): string {
    const interfacesBlock = Array.from(pluginInterfaces.values()).join('\n\n');
    const registryEntries = this.generateRegistryEntries(plugins);
    const pluginNamesUnion = this.generatePluginNamesUnion(plugins);

    return `// Types generated automatically by Bun Plugins LSP
// DO NOT EDIT MANUALLY - These types are regenerated automatically
// Last generated: ${new Date().toISOString()}

${interfacesBlock}

// Registry of plugin types
export interface PluginTypeRegistry {
${registryEntries}
}

// Helper type for plugin names
export type PluginNames = ${pluginNamesUnion};

// Helper to get plugin API type
export type PluginApi<TName extends keyof PluginTypeRegistry> = PluginTypeRegistry[TName];
`;
  }

  /**
   * Generates the global types file
   */
  private generateGlobalTypesFile(plugins: PluginInfo[]): string {
    const pluginNamesUnion = this.generatePluginNamesUnion(plugins);
    const moduleDeclarations = this.generateModuleDeclarations(plugins);

    return `// Global types generated automatically by Bun Plugins LSP
// Last generated: ${new Date().toISOString()}

// Extend global types for plugin context
declare global {
  // Extend the plugin type registry
  namespace NodeJS {
    interface PluginTypeRegistry extends import('./plugin-types').PluginTypeRegistry {}
  }

  // Extend PluginContext for better autocompletion
  interface PluginContext {
    /**
     * Gets a plugin by name with static typing
     * @param name Name of the plugin
     * @returns Plugin API or undefined if not found
     */
    getPlugin<TName extends keyof PluginTypeRegistry>(name: TName): PluginTypeRegistry[TName] | undefined;
    getPlugin(name: string): unknown | undefined;
  }
}

${moduleDeclarations}
`;
  }

  /**
   * Generates registry entries for all plugins
   */
  private generateRegistryEntries(plugins: PluginInfo[]): string {
    if (plugins.length === 0) {
      return '  // No plugins found';
    }

    return plugins
      .map(plugin => {
        const interfaceName = pluginNameToInterfaceName(plugin.name);
        return `  "${plugin.name}": ${interfaceName};`;
      })
      .join('\n');
  }

  /**
   * Generates a union type of all plugin names
   */
  private generatePluginNamesUnion(plugins: PluginInfo[]): string {
    if (plugins.length === 0) return 'never';
    return plugins.map(p => `"${p.name}"`).join(' | ');
  }

  /**
   * Generates module declarations for all plugins
   */
  private generateModuleDeclarations(plugins: PluginInfo[]): string {
    if (plugins.length === 0) {
      return '// No module declarations - no plugins found';
    }

    return plugins
      .map(plugin => {
        const interfaceName = pluginNameToInterfaceName(plugin.name);
        const fileName = path.basename(plugin.filePath, '.ts').replace('.js', '');
        const methodsBlock = plugin.methods
          .filter(m => !isLifecycleMethod(m.name))
          .map(m => `    ${formatMethodSignature(m.name, m.params, m.returnType)}`)
          .join('\n');
        const propertiesBlock = plugin.properties?.map(p => 
          `    ${formatPropertySignature(p.name, p.type)}`
        ).join('\n') || '';
        const getSharedApiMethod = plugin.methods.some(m => m.name === 'getSharedApi') 
          ? '' 
          : `    getSharedApi(): ${interfaceName};`;

        return `// Module declaration for ${plugin.name}
declare module "*/plugins/${fileName}" {
  export interface ${interfaceName} {
${methodsBlock || '    // No public methods'}
${getSharedApiMethod}
${propertiesBlock || '    // No public properties'}
  }
}`;
      })
      .join('\n\n');
  }

  /**
   * Saves generated types to files with error handling
   */
  async saveTypes(
    workspaceRoot: string,
    types: GeneratedTypes,
    typesDir: string = '.bun-plugins-types'
  ): Promise<string[]> {
    const generatedFiles: string[] = [];
    const fullPath = path.join(workspaceRoot, typesDir);

    // Ensure directory exists
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }

    // Save plugin types
    const pluginTypesPath = path.join(fullPath, 'plugin-types.d.ts');
    if (writeFile(pluginTypesPath, types.pluginTypes)) {
      generatedFiles.push(pluginTypesPath);
    }

    // Save global types
    const globalTypesPath = path.join(fullPath, 'global.d.ts');
    if (writeFile(globalTypesPath, types.globalTypes)) {
      generatedFiles.push(globalTypesPath);
    }

    // Save individual interface files
    types.pluginInterfaces.forEach((code, pluginName) => {
      const interfaceName = pluginNameToInterfaceName(pluginName);
      const interfacePath = path.join(fullPath, `${interfaceName}.d.ts`);
      if (writeFile(interfacePath, code)) {
        generatedFiles.push(interfacePath);
      }
    });

    // Create index file for easier imports
    const indexPath = path.join(fullPath, 'index.d.ts');
    const indexContent = `// Export all types
export * from './plugin-types';
export * from './global';
`;
    if (writeFile(indexPath, indexContent)) {
      generatedFiles.push(indexPath);
    }

    return generatedFiles;
  }

  /**
   * Creates a README in the types directory
   */
  private async createTypesReadme(typesPath: string, plugins: PluginInfo[]): Promise<void> {
    const readmePath = path.join(typesPath, 'README.md');
    const pluginList = plugins.length > 0 
      ? plugins.map(p => `- **${p.name}** (\`${path.basename(p.filePath)}\`)`).join('\n')
      : 'No plugins found';
    
    const content = `# Bun Plugins Types

This directory contains automatically generated TypeScript type definitions for your Bun plugins.

## Generated Files

- \`plugin-types.d.ts\` - Main plugin type definitions
- \`global.d.ts\` - Global type augmentations
- \`index.d.ts\` - Re-exports all types
- \`[PluginName]Api.d.ts\` - Individual plugin type definitions

## Plugins (${plugins.length})

${pluginList}

## Important Notes

⚠️ **DO NOT EDIT THESE FILES MANUALLY** - They are automatically regenerated when plugins change.

## How to Regenerate Types

If you delete these files or need to regenerate them:

1. **Using the LSP Server**: The types are automatically regenerated when you save plugin files.
2. **Manually Trigger**: Use the LSP server's file watching capabilities - any change to plugin files will trigger regeneration.
3. **Force Regeneration**: Delete the \`.bun-plugins-types\` directory and restart the LSP server.

## Automatic Regeneration

The LSP server monitors your plugin files and automatically regenerates types when:
- A plugin file is modified
- A new plugin is added
- A plugin is deleted
- Plugin metadata changes

## Using the Types

\`\`\`typescript
import { getPlugin } from 'bun';

// Get typed plugin API
const mathPlugin = getPlugin('math-plugin');
if (mathPlugin) {
  mathPlugin.add(1, 2); // Fully typed!
}
\`\`\`

## Last Generated

${new Date().toISOString()}
`;

    writeFile(readmePath, content);
  }

  /**
   * Updates tsconfig.json to include generated types
   */
  async updateTsConfig(workspaceRoot: string, typesDir: string = '.bun-plugins-types'): Promise<void> {
    const tsconfigPath = path.join(workspaceRoot, 'tsconfig.json');
    const relativeTypesPath = `./${typesDir}`;

    // Check if tsconfig exists
    if (!fileExists(tsconfigPath)) {
      console.log('⚠️  No tsconfig.json found, creating a basic one...');
      const basicTsConfig = {
        compilerOptions: {
          target: "ES2020",
          module: "commonjs",
          lib: ["ES2020"],
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true,
          forceConsistentCasingInFileNames: true,
          typeRoots: ["./node_modules/@types", relativeTypesPath]
        }
      };
      if (writeJsonFile(tsconfigPath, basicTsConfig)) {
        console.log('✅ Created tsconfig.json');
      }
      return;
    }

    // Read and update existing tsconfig
    const tsconfig = readJsonFile<any>(tsconfigPath);
    if (!tsconfig) {
      console.error('❌ Failed to read tsconfig.json');
      return;
    }

    // Ensure compilerOptions exists
    if (!tsconfig.compilerOptions) {
      tsconfig.compilerOptions = {};
    }

    // Add typeRoots
    if (!tsconfig.compilerOptions.typeRoots) {
      tsconfig.compilerOptions.typeRoots = ["./node_modules/@types"];
    }

    // Add our types directory if not present
    if (!tsconfig.compilerOptions.typeRoots.includes(relativeTypesPath)) {
      tsconfig.compilerOptions.typeRoots.push(relativeTypesPath);
    }

    // Save updated tsconfig
    if (writeJsonFile(tsconfigPath, tsconfig)) {
      console.log('✅ Updated tsconfig.json to include plugin types');
    }
  }

  /**
   * Sets up automatic regeneration with file watching
   */
  async setupAutoRegeneration(
    workspaceRoot: string,
    scanPluginsFn: (workspaceRoot: string) => Promise<PluginInfo[]>,
    options: Partial<GenerationOptions> = {}
  ): Promise<void> {
    const typesDir = options.typesDir || '.bun-plugins-types';

    // Simple file watcher implementation
    const pluginsDir = path.join(workspaceRoot, 'plugins');
    
    if (fs.existsSync(pluginsDir)) {
      try {
        const watcher = fs.watch(pluginsDir, { recursive: true }, async (eventType, filename) => {
          if (filename && (filename.endsWith('.ts') || filename.endsWith('.js'))) {
            // Debounce: wait a bit before regenerating
            await new Promise(resolve => setTimeout(resolve, 500));
            
            try {
              const plugins = await scanPluginsFn(workspaceRoot);
              await this.generateTypesWithValidation(plugins, {
                workspaceRoot,
                typesDir,
                updateTsConfig: false,
                validatePlugins: true,
                generateDocs: true
              });
            } catch (error) {
              console.error('[TypeGenerator] Error during auto-regeneration:', error);
            }
          }
        });

        // Store watcher reference for cleanup (simplified)
        (this as any).watcher = watcher;
        console.log('✅ Automatic type regeneration enabled');
      } catch (error) {
        console.error('[TypeGenerator] Error setting up file watcher:', error);
      }
    }
  }

  /**
   * Triggers manual regeneration
   */
  async regenerate(
    workspaceRoot: string,
    scanPluginsFn: (workspaceRoot: string) => Promise<PluginInfo[]>,
    options: Partial<GenerationOptions> = {}
  ): Promise<GenerationResult> {
    const plugins = await scanPluginsFn(workspaceRoot);
    return this.generateTypesWithValidation(plugins, {
      workspaceRoot,
      ...options,
      forceRegenerate: true
    });
  }

  /**
   * Gets the last generation time
   */
  getLastGenerationTime(): Date | null {
    return this.lastGenerationTime;
  }

  /**
   * Clears cached generated types
   */
  clearCache(): void {
    this.generatedTypes.clear();
  }

  /**
   * Cleanup: Close all file watchers
   */
  dispose(): void {
    const watcher = (this as any).watcher;
    if (watcher) {
      try {
        watcher.close();
      } catch (error) {
        console.error('[TypeGenerator] Error closing file watcher:', error);
      }
    }
  }

  /**
   * Checks if types directory exists
   */
  typesDirectoryExists(workspaceRoot: string, typesDir: string = '.bun-plugins-types'): boolean {
    const typesPath = path.join(workspaceRoot, typesDir);
    try {
      return fs.existsSync(typesPath) && fs.statSync(typesPath).isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * Gets all generated type files
   */
  getGeneratedTypeFiles(workspaceRoot: string, typesDir: string = '.bun-plugins-types'): string[] {
    const typesPath = path.join(workspaceRoot, typesDir);
    
    if (!this.typesDirectoryExists(workspaceRoot, typesDir)) {
      return [];
    }

    const files: string[] = [];
    
    try {
      const entries = fs.readdirSync(typesPath, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.d.ts')) {
          files.push(path.join(typesPath, entry.name));
        }
      }
    } catch (error) {
      console.error('[TypeGenerator] Error reading types directory:', error);
    }

    return files;
  }

  /**
   * Deletes generated types
   */
  deleteGeneratedTypes(workspaceRoot: string, typesDir: string = '.bun-plugins-types'): boolean {
    const typesPath = path.join(workspaceRoot, typesDir);
    
    if (!fs.existsSync(typesPath)) {
      console.log('[TypeGenerator] No types directory to delete');
      return true;
    }

    try {
      fs.rmSync(typesPath, { recursive: true, force: true });
      console.log(`[TypeGenerator] ✅ Deleted types directory: ${typesPath}`);
      this.lastGenerationTime = null;
      return true;
    } catch (error) {
      console.error('[TypeGenerator] Error deleting types directory:', error);
      return false;
    }
  }
}

/**
 * Creates a singleton instance of the type generator
 */
export function createTypeGenerator(): PluginTypeGenerator {
  return PluginTypeGenerator.getInstance();
}
