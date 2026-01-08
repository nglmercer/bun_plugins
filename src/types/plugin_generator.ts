import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { join, relative, extname } from "node:path";
import ts from "typescript";
import type { PluginTypeInfo, ArkTypeSchemaInfo, PropertyInfo, GeneratorOptions } from "./interfaces";
import { ArkTypeConverter } from "./arktype_converter";

/**
 * Main generator for handling conversion between classes and arktype schemas.
 * Provides dynamic typing and autocomplete without static KnownPluginNames.
 */
export class PluginTypeGenerator {
  private pluginsDir: string;
  private outputDir: string;
  private packageName: string;
  private compilerOptions: ts.CompilerOptions;
  
  constructor(options: GeneratorOptions) {
    this.pluginsDir = options.pluginsDir;
    this.outputDir = options.outputDir;
    this.packageName = options.packageName || "bun_plugins";
    this.compilerOptions = this.getCompilerOptions();
  }
  
  private getCompilerOptions(): ts.CompilerOptions {
    const configPath = join(process.cwd(), "tsconfig.json");
    
    try {
      const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
      if (configFile.error) {
        return this.getDefaultOptions();
      }
      
      const { options } = ts.parseJsonConfigFileContent(
        configFile.config,
        ts.sys,
        process.cwd()
      );
      return options;
    } catch {
      return this.getDefaultOptions();
    }
  }
  
  private getDefaultOptions(): ts.CompilerOptions {
    return {
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.ESNext,
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      noEmit: true
    };
  }
  
  async scanPlugins(): Promise<PluginTypeInfo[]> {
    const pluginFiles = await this.scanDirectory(this.pluginsDir);
    const plugins: PluginTypeInfo[] = [];
    const seenClasses = new Set<string>();
    
    for (const filePath of pluginFiles) {
      try {
        const content = await readFile(filePath, "utf-8");
        const pluginInfo = this.parsePlugin(filePath, content);
        
        if (pluginInfo && pluginInfo.className && !seenClasses.has(pluginInfo.className)) {
          seenClasses.add(pluginInfo.className);
          plugins.push(pluginInfo);
        }
      } catch (err) {
        console.warn(`Warning: Failed to parse ${filePath}: ${err}`);
      }
    }
    
    return plugins;
  }
  
  private async scanDirectory(dir: string): Promise<string[]> {
    const files: string[] = [];
    
    try {
      const entries = await readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        
        if (entry.isDirectory()) {
          if (entry.name !== "node_modules" && 
              entry.name !== "dist" && 
              entry.name !== "build" &&
              entry.name !== ".git" &&
              !entry.name.startsWith(".")) {
            files.push(...(await this.scanDirectory(fullPath)));
          }
        } else if (entry.isFile()) {
          const ext = extname(entry.name);
          if (ext === ".ts" || ext === ".js") {
            files.push(fullPath);
          }
        }
      }
    } catch {
      console.warn(`Warning: Could not read directory ${dir}`);
    }
    
    return files;
  }
  
  /**
   * Extracts the properties and methods from a TypeScript class.
   */
  extractClassProperties(sourceFile: ts.SourceFile): PropertyInfo[] {
    const properties: PropertyInfo[] = [];
    
    const visit = (node: ts.Node) => {
      if (ts.isClassDeclaration(node)) {
        node.members.forEach(member => {
          if (ts.isPropertyDeclaration(member) && member.name && ts.isIdentifier(member.name)) {
            const propName = member.name.text;
            const propInfo = this.extractPropertyType(member, sourceFile);
            if (propInfo) {
              properties.push(propInfo);
            }
          }
          
          if (ts.isMethodDeclaration(member) && member.name && ts.isIdentifier(member.name)) {
            const methodInfo = this.extractMethodInfo(member, sourceFile);
            if (methodInfo) {
              properties.push(methodInfo);
            }
          }
          
          if (ts.isConstructorDeclaration(member)) {
            member.parameters.forEach(param => {
              if (ts.isIdentifier(param.name) && param.type) {
                const propInfo: PropertyInfo = {
                  name: param.name.text,
                  type: param.type.getText(sourceFile),
                  isOptional: param.questionToken !== undefined,
                  isArray: this.isArrayType(param.type, sourceFile),
                  nestedType: this.extractNestedType(param.type, sourceFile)
                };
                properties.push(propInfo);
              }
            });
          }
        });
      }
      
      ts.forEachChild(node, visit);
    };
    
    ts.forEachChild(sourceFile, visit);
    return properties;
  }
  
  private extractMethodInfo(node: ts.MethodDeclaration, sourceFile: ts.SourceFile): PropertyInfo | null {
    const name = node.name.getText(sourceFile);
    
    if (name.startsWith("_") || name.startsWith("#")) {
      return null;
    }
    
    // Filter out lifecycle methods and getApi (internal plugin methods)
    const lifecycleMethods = ["onLoad", "onUnload", "onEnable", "onDisable", "onReload", "getApi"];
    if (lifecycleMethods.includes(name)) {
      return null;
    }
    
    const params: { name: string; type: string; isOptional: boolean }[] = [];
    node.parameters.forEach(param => {
      if (ts.isIdentifier(param.name)) {
        params.push({
          name: param.name.text,
          type: param.type ? param.type.getText(sourceFile) : "any",
          isOptional: param.questionToken !== undefined
        });
      }
    });
    
    const returnType = node.type ? node.type.getText(sourceFile) : "void";
    
    return {
      name,
      type: returnType,
      isOptional: false,
      isArray: false,
      isMethod: true,
      params
    };
  }
  
  private extractPropertyType(node: ts.PropertyDeclaration, sourceFile: ts.SourceFile): PropertyInfo | null {
    if (!node.name || !ts.isIdentifier(node.name)) {
      return null;
    }
    
    const name = node.name.text;
    
    if (name.startsWith("_") || name.startsWith("#")) {
      return null;
    }
    
    let type = "any";
    let isOptional = node.questionToken !== undefined || node.initializer !== undefined;
    let isArray = false;
    let nestedType: ArkTypeSchemaInfo | undefined;
    
    if (node.type) {
      type = node.type.getText(sourceFile);
      isArray = this.isArrayType(node.type, sourceFile);
      nestedType = this.extractNestedType(node.type, sourceFile);
    } else if (node.initializer) {
      type = this.inferTypeFromInitializer(node.initializer, sourceFile);
    }
    
    return {
      name,
      type: this.mapTypeName(type),
      isOptional,
      isArray,
      nestedType
    };
  }
  
  private isArrayType(typeNode: ts.TypeNode, sourceFile: ts.SourceFile): boolean {
    if (ts.isArrayTypeNode(typeNode)) {
      return true;
    }
    if (ts.isUnionTypeNode(typeNode)) {
      return typeNode.types.some(t => this.isArrayType(t, sourceFile));
    }
    return false;
  }
  
  private extractNestedType(typeNode: ts.TypeNode, sourceFile: ts.SourceFile): ArkTypeSchemaInfo | undefined {
    if (ts.isTypeReferenceNode(typeNode)) {
      const typeName = typeNode.typeName.getText(sourceFile);
      const nestedProperties = this.findTypeProperties(typeName, sourceFile);
      
      if (nestedProperties.length > 0) {
        return {
          schemaName: typeName,
          schemaDefinition: "",
          typeDefinition: "",
          properties: nestedProperties
        };
      }
    }
    
    if (ts.isTypeLiteralNode(typeNode)) {
      const properties: PropertyInfo[] = [];
      
      typeNode.members.forEach(member => {
        if (ts.isPropertySignature(member) && member.name && ts.isIdentifier(member.name)) {
          const propInfo: PropertyInfo = {
            name: member.name.text,
            type: member.type ? member.type.getText(sourceFile) : "any",
            isOptional: member.questionToken !== undefined,
            isArray: member.type ? this.isArrayType(member.type, sourceFile) : false
          };
          properties.push(propInfo);
        }
      });
      
      return {
        schemaName: "InlineType",
        schemaDefinition: "",
        typeDefinition: "",
        properties
      };
    }
    
    return undefined;
  }

  /**
   * Generate a type string for public methods of a plugin class.
   */
  private generatePublicMethodsType(p: PluginTypeInfo): string {
    if (p.arkTypeSchema && p.arkTypeSchema.properties.length > 0) {
      const props = p.arkTypeSchema.properties
        .filter(prop => !prop.name.startsWith("_") && !prop.name.startsWith("#"))
        .map(prop => {
          if (prop.isMethod) {
            const params = prop.params?.map(param => `${param.name}: ${param.type}`).join(", ") || "";
            return `    ${prop.name}(${params}): ${prop.type};`;
          }
          return `    ${prop.name}${prop.isOptional ? "?" : ""}: ${prop.type};`;
        })
        .join("\n");
      return `{\n${props}\n  }`;
    }
    return p.className;
  }

  /**
   * Generate an inline type definition for a plugin's API.
   * If the plugin has an API interface defined, it extracts the interface definition.
   * Otherwise, it generates the type from public methods.
   */
  private generateInlineApiType(p: PluginTypeInfo, fallbackType: string): string {
    // If the plugin has an API interface, try to extract its definition
    if (p.apiInterface && p.arkTypeSchema) {
      const props = p.arkTypeSchema.properties
        .filter(prop => !prop.name.startsWith("_") && !prop.name.startsWith("#"))
        .map(prop => {
          if (prop.isMethod) {
            const params = prop.params?.map(param => `${param.name}: ${param.type}`).join(", ") || "";
            return `    ${prop.name}(${params}): ${prop.type};`;
          }
          return `    ${prop.name}${prop.isOptional ? "?" : ""}: ${prop.type};`;
        })
        .join("\n");
      
      if (props) {
        return `{\n${props}\n  }`;
      }
    }
    
    // Fallback: use the provided type (either interface name or public methods)
    return fallbackType;
  }

  private findTypeProperties(typeName: string, sourceFile: ts.SourceFile): PropertyInfo[] {
    const properties: PropertyInfo[] = [];
    
    const visit = (node: ts.Node) => {
      if (ts.isInterfaceDeclaration(node) && node.name.text === typeName) {
        node.members.forEach(member => {
          if (ts.isPropertySignature(member) && member.name && ts.isIdentifier(member.name)) {
            const propInfo: PropertyInfo = {
              name: member.name.text,
              type: member.type ? this.mapTypeName(member.type.getText(sourceFile)) : "any",
              isOptional: member.questionToken !== undefined,
              isArray: member.type ? this.isArrayType(member.type, sourceFile) : false
            };
            properties.push(propInfo);
          }
        });
      }
      
      if (ts.isTypeAliasDeclaration(node) && node.name.text === typeName) {
        if (ts.isTypeLiteralNode(node.type)) {
          node.type.members.forEach(member => {
            if (ts.isPropertySignature(member) && member.name && ts.isIdentifier(member.name)) {
              const propInfo: PropertyInfo = {
                name: member.name.text,
                type: member.type ? this.mapTypeName(member.type.getText(sourceFile)) : "any",
                isOptional: member.questionToken !== undefined,
                isArray: member.type ? this.isArrayType(member.type, sourceFile) : false
              };
              properties.push(propInfo);
            }
          });
        }
      }
      
      ts.forEachChild(node, visit);
    };
    
    ts.forEachChild(sourceFile, visit);
    return properties;
  }
  
  private mapTypeName(type: string): string {
    const typeMap: Record<string, string> = {
      "string": "string",
      "String": "string",
      "number": "number",
      "Number": "number",
      "boolean": "boolean",
      "Boolean": "boolean",
      "any": "any",
      "unknown": "unknown",
      "void": "void",
      "null": "null",
      "Date": "Date",
      "Promise": "Promise",
      "Array": "Array",
      "Record": "Record"
    };
    
    const baseType = type.split("<")[0]?.split("|")[0]?.trim() || type;
    return typeMap[baseType] || baseType;
  }
  
  private inferTypeFromInitializer(initializer: ts.Expression, sourceFile: ts.SourceFile): string {
    if (ts.isStringLiteral(initializer)) {
      return "string";
    }
    if (ts.isNumericLiteral(initializer)) {
      return "number";
    }
    if (ts.isIdentifier(initializer)) {
      const symbol = this.getSymbolAtLocation(initializer, sourceFile);
      if (symbol) {
        return symbol;
      }
    }
    return "any";
  }
  
  private getSymbolAtLocation(node: ts.Node, sourceFile: ts.SourceFile): string | undefined {
    const typeChecker = this.getTypeChecker();
    const symbol = typeChecker.getSymbolAtLocation(node);
    
    if (symbol && symbol.declarations && symbol.declarations.length > 0) {
      const decl = symbol.declarations[0];
      if (decl && (ts.isTypeAliasDeclaration(decl) || ts.isInterfaceDeclaration(decl))) {
        return decl.name.text;
      }
    }
    
    return undefined;
  }
  
  private getTypeChecker(): ts.TypeChecker {
    const program = ts.createProgram([join(process.cwd(), "src/types/plugin_generator.ts")], this.compilerOptions);
    return program.getTypeChecker();
  }

  private parseTypeScriptPlugin(filePath: string, source: string): PluginTypeInfo | null {
    const sourceFile = ts.createSourceFile(
      filePath,
      source,
      ts.ScriptTarget.Latest,
      true
    );

    let pluginName = "";
    let pluginVersion = "1.0.0";
    let className = "";
    let apiInterface: string | undefined;
    let dependencies: Record<string, string> | undefined;
    let arkTypeSchema: ArkTypeSchemaInfo | undefined;

    // Store interface definitions for later lookup
    const interfaceDefinitions = new Map<string, PropertyInfo[]>();
    const self = this;

    function visit(node: ts.Node) {
      // Extract interface definitions
      if (ts.isInterfaceDeclaration(node)) {
        const interfaceName = node.name.text;
        const properties: PropertyInfo[] = [];
        
        node.members.forEach(member => {
          if (ts.isPropertySignature(member) && member.name && ts.isIdentifier(member.name)) {
            const propName = member.name.text;
            if (!propName.startsWith("_") && !propName.startsWith("#")) {
              const propInfo: PropertyInfo = {
                  name: propName,
                  type: member.type ? member.type.getText(sourceFile) : "any",
                  isOptional: member.questionToken !== undefined,
                  isArray: member.type ? self.isArrayType(member.type, sourceFile) : false
                };
              properties.push(propInfo);
            }
          } else if (ts.isMethodSignature(member) && member.name && ts.isIdentifier(member.name)) {
            const methodName = member.name.getText(sourceFile);
            if (!methodName.startsWith("_") && !methodName.startsWith("#")) {
              const params: { name: string; type: string; isOptional: boolean }[] = [];
              member.parameters.forEach(param => {
                if (ts.isIdentifier(param.name)) {
                  params.push({
                    name: param.name.text,
                    type: param.type ? param.type.getText(sourceFile) : "any",
                    isOptional: param.questionToken !== undefined
                  });
                }
              });
              
              const returnType = member.type ? member.type.getText(sourceFile) : "void";
              properties.push({
                name: methodName,
                type: returnType,
                isOptional: false,
                isArray: false,
                isMethod: true,
                params
              });
            }
          }
        });
        
        if (properties.length > 0) {
          interfaceDefinitions.set(interfaceName, properties);
        }
      }

      if (ts.isClassDeclaration(node)) {
        if (node.name) {
          className = node.name.text;
          
          const converter = new PluginTypeGenerator({
            pluginsDir: "",
            outputDir: ""
          });
          const properties = converter.extractClassProperties(sourceFile);
          
          if (properties.length > 0) {
            const schemaName = className + "Schema";
            arkTypeSchema = {
              schemaName,
              schemaDefinition: ArkTypeConverter.classToArkType(className, properties),
              typeDefinition: "",
              properties
            };
          }
        }
      }

      if (ts.isPropertyDeclaration(node)) {
        const name = node.name.getText(sourceFile);
        
        if (name === "name" && node.initializer) {
          pluginName = node.initializer.getText(sourceFile).replace(/['"]/g, "");
        }
        
        if (name === "version" && node.initializer) {
          pluginVersion = node.initializer.getText(sourceFile).replace(/['"]/g, "");
        }
        
        if (name === "dependencies" && node.initializer) {
          try {
            const depsText = node.initializer.getText(sourceFile);
            dependencies = eval(`(${depsText})`);
          } catch {
          }
        }
      }

      if (ts.isMethodDeclaration(node)) {
        const name = node.name.getText(sourceFile);
        if (name === "getApi" && node.type) {
          const returnType = node.type.getText(sourceFile);
          const match = returnType.match(/:\s*(\w+Api)/);
          if (match) {
            apiInterface = match[1];
            // If we found an API interface, use its properties for the schema
            if (apiInterface) {
              const apiProperties = interfaceDefinitions.get(apiInterface);
              if (apiProperties) {
                arkTypeSchema = {
                  schemaName: apiInterface + "Schema",
                  schemaDefinition: ArkTypeConverter.classToArkType(apiInterface, apiProperties),
                  typeDefinition: "",
                  properties: apiProperties
                };
              }
            }
          }
        }
      }

      ts.forEachChild(node, visit);
    }

    ts.forEachChild(sourceFile, visit);

    const fileName = filePath.split(/[/\\]/).pop()?.replace(/\.(ts|js)$/, "") || "";
    const name = pluginName || fileName.toLowerCase().replace(/plugin$/i, "");

    if (!name) return null;

    return {
      name,
      version: pluginVersion,
      className,
      filePath,
      isTypeScript: true,
      apiInterface,
      dependencies,
      arkTypeSchema
    };
  }
  
  private parseJavaScriptPlugin(filePath: string, source: string): PluginTypeInfo | null {
    const fileName = filePath.split(/[/\\]/).pop()?.replace(/\.(ts|js)$/, "") || "";
    
    const classMatch = source.match(/export\s+class\s+(\w+)/);
    const className = classMatch?.[1] || fileName;
    
    const nameMatch = source.match(/this\.name\s*=\s*["']([^"']+)["']/) ||
                     source.match(/name\s*=\s*["']([^"']+)["']/);
    const name = nameMatch?.[1] || fileName.toLowerCase().replace(/plugin$/i, "");
    
    const versionMatch = source.match(/version\s*=\s*["']([^"']+)["']/);
    const version = versionMatch?.[1] || "1.0.0";
    
    const hasSharedApi = /getApi\s*\(/.test(source);
    
    if (!name) return null;
    
    return {
      name,
      version,
      className,
      filePath,
      isTypeScript: false,
      apiInterface: hasSharedApi ? `${className}Api` : undefined
    };
  }
  
  private parsePlugin(filePath: string, content: string): PluginTypeInfo | null {
    const ext = extname(filePath);
    
    if (ext === ".ts") {
      return this.parseTypeScriptPlugin(filePath, content);
    } else if (ext === ".js") {
      return this.parseJavaScriptPlugin(filePath, content);
    }
    
    return null;
  }
  
  /**
   * Generates dynamic type declarations using a factory pattern.
   * No static KnownPluginNames - types are computed at compile time.
   * 
   * The API type includes:
   * - Base plugin properties (name, version)
   * - Public methods from the class
   * - Shared API methods if getApi is defined
   */
  generateDeclarations(plugins: PluginTypeInfo[], baseApiInterface: string = "BasePluginApi"): string {
    // Note: We don't import plugin classes here because they are not distributed with the package
    // The class names are used only for type information

    // Dynamic plugin factory map - each plugin is indexed by name
    const pluginFactoryEntries = plugins.map(p => {
      // Generate public methods type from the class
      const publicMethodsType = this.generatePublicMethodsType(p);
      
      // Use the shared API interface if available, otherwise use the public methods
      const apiType = p.apiInterface ? p.apiInterface : publicMethodsType;
      
      // Generate inline type definition for the API
      // This ensures that the API type is fully defined without external dependencies
      const inlineApiType = this.generateInlineApiType(p, apiType);
      
      // Fix relative imports for distributed types
      const sanitizedApiType = inlineApiType
        .replace(/PluginContext/g, 'any')
        .replace(/EngineActionHandler/g, 'any')
        .replace(/ActionRegistry/g, 'any')
        .replace(/import\("\.\.\/\.\.\/src"\)\./g, 'import("bun_plugins/src").')
        .replace(/import\("\.\.\/src"\)\./g, 'import("bun_plugins/src").');
      
      return `    "${p.name}": {
      name: "${p.name}";
      version: "${p.version}";
      class: ${p.className};
      api: ${sanitizedApiType};
      dependencies?: ${p.dependencies ? `Record<${JSON.stringify(Object.keys(p.dependencies))}, string>` : "undefined"};
    }`;
    }).join(",\n");

    return `import type { PluginFactory as BasePluginFactory, BasePluginApi } from "${this.packageName}/src/types/plugin-registry-base";

/**
 * Extend the PluginFactory interface with discovered plugins.
 * Users can also extend this interface with their own plugins using declaration merging.
 *
 * Example:
 * \`\`\`typescript
 * declare module "bun_plugins" {
 *   export interface PluginFactory {
 *     "my-plugin": {
 *       name: "my-plugin";
 *       version: "1.0.0";
 *       class: MyPlugin;
 *       api: MyPluginApi;
 *     };
 *   }
 * }
 * \`\`\`
 */
export interface PluginFactory extends BasePluginFactory {
${pluginFactoryEntries}
}

/**
 * Re-export base types for convenience.
 * These types support dynamic plugin discovery and user extension.
 */
export type {
  PluginClassType,
  GetPluginApi,
  GetPluginClass,
  IsValidPlugin,
  PluginFromFactory,
  PluginInstanceType
} from "${this.packageName}/src/types/plugin-registry-base";

// Re-export BasePluginApi (already imported at the top)
export type { BasePluginApi };

// Define PluginNames directly from the extended PluginFactory
// For development, we allow any string to be used as plugin name
export type PluginNames = keyof PluginFactory | string;

// Define PluginApiType directly from the extended PluginFactory
export type PluginApiType<T extends string> =
  T extends keyof PluginFactory
    ? PluginFactory[T]["api"]
    : BasePluginApi;
`;
  }
    
  generateModuleExports(plugins: PluginTypeInfo[], baseApiInterface: string = "BasePluginApi"): string {
    // Note: We don't export plugin classes here because they are not distributed with the package
    
    return `

export type {
  PluginNames,
  PluginApiType,
  PluginClassType,
  GetPluginApi,
  GetPluginClass,
  IsValidPlugin,
  PluginFromFactory,
  PluginFactory
} from "${this.packageName}/plugin-types/plugin-registry";

export interface ${baseApiInterface} {
  name: string;
  version: string;
  actions?: string[];
  type?: string;
  loaded?: string;
}
`;
  }
    
  async generate(): Promise<PluginTypeInfo[]> {
    await mkdir(this.outputDir, { recursive: true });
    
    const plugins = await this.scanPlugins();
    const baseApiInterface = "BasePluginApi";
    
    const declarations = this.generateDeclarations(plugins, baseApiInterface);
    const moduleExports = this.generateModuleExports(plugins);
    
    const dtsPath = join(this.outputDir, "plugin-registry.d.ts");
    const indexPath = join(this.outputDir, "index.d.ts");
    
    await writeFile(dtsPath, declarations, "utf-8");
    await writeFile(indexPath, moduleExports, "utf-8");
    
    console.log(`Generated ${dtsPath} with ${plugins.length} plugins`);
    console.log(`Generated ${indexPath}`);
    
    return plugins;
  }
    
  async getPlugins(): Promise<PluginTypeInfo[]> {
    return this.scanPlugins();
  }
    
  static async convertClassToArkType(classFilePath: string): Promise<ArkTypeSchemaInfo | null> {
    try {
      const content = await readFile(classFilePath, "utf-8");
      const sourceFile = ts.createSourceFile(
        classFilePath,
        content,
        ts.ScriptTarget.Latest,
        true
      );
        
      let className = "";
      let properties: PropertyInfo[] = [];
        
      const visit = (node: ts.Node) => {
        if (ts.isClassDeclaration(node) && node.name) {
          className = node.name.text;
            
          const tempGenerator = new PluginTypeGenerator({
            pluginsDir: "",
            outputDir: ""
          });
          properties = tempGenerator.extractClassProperties(sourceFile);
        }
        ts.forEachChild(node, visit);
      };
        
      ts.forEachChild(sourceFile, visit);
        
      if (!className || properties.length === 0) {
        return null;
      }
        
      const schemaName = className + "Schema";
      return {
        schemaName,
        schemaDefinition: ArkTypeConverter.classToArkType(className, properties),
        typeDefinition: "",
        properties
      };
    } catch (error) {
      console.error(`Error converting class to ArkType: ${error}`);
      return null;
    }
  }
}

/**
 * Generates plugin types from a plugins directory.
 */
export async function generatePluginTypes(
  pluginsDir: string = join(process.cwd(), "plugins"),
  outputDir: string = join(process.cwd(), "plugin-types"),
  packageName: string = "bun_plugins"
): Promise<PluginTypeInfo[]> {
  const generator = new PluginTypeGenerator({ pluginsDir, outputDir, packageName });
  return generator.generate();
}
