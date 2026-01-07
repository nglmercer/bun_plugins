import { readdir, readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { join, relative, extname, dirname } from "node:path";
import ts from "typescript";

export interface PluginTypeInfo {
  name: string;
  version: string;
  className: string;
  filePath: string;
  isTypeScript: boolean;
  apiInterface?: string;
  dependencies?: Record<string, string>;
  arkTypeSchema?: ArkTypeSchemaInfo;
}

export interface ArkTypeSchemaInfo {
  schemaName: string;
  schemaDefinition: string;
  typeDefinition: string;
  properties: PropertyInfo[];
}

export interface PropertyInfo {
  name: string;
  type: string;
  isOptional: boolean;
  isArray: boolean;
  nestedType?: ArkTypeSchemaInfo;
  isMethod?: boolean;
  params?: MethodParamInfo[];
}

export interface MethodParamInfo {
  name: string;
  type: string;
  isOptional: boolean;
}

export interface GeneratorOptions {
  pluginsDir: string;
  outputDir: string;
  baseApiInterface?: string;
  packageName?: string;
}

/**
 * Utilidades para convertir entre clases TypeScript, schemas de arktype y types de TypeScript
 */
export class ArkTypeConverter {
  /**
   * Convierte una clase TypeScript a un schema de arktype
   */
  static classToArkType(className: string, properties: PropertyInfo[]): string {
    const schemaProps = properties.map(prop => {
      const typeStr = this.typeToArkType(prop);
      return `  ${prop.name}${prop.isOptional ? "?" : ""}: ${typeStr}`;
    }).join(",\n");

    return `const ${className.charAt(0).toLowerCase() + className.slice(1)}Schema = type({\n${schemaProps}\n});`;
  }

  /**
   * Convierte un tipo TypeScript a su equivalente en arktype
   */
  static typeToArkType(prop: PropertyInfo): string {
    if (prop.isArray) {
      if (prop.nestedType) {
        const nestedSchema = this.nestedTypeToArkType(prop.nestedType);
        return `array(${nestedSchema})`;
      }
      return `array("${prop.type.toLowerCase()}")`;
    }

    const typeMap: Record<string, string> = {
      "string": "string",
      "number": "number",
      "boolean": "boolean",
      "any": "any",
      "unknown": "unknown",
      "void": "undefined",
      "null": "null",
      "Date": "string", // Fechas se representan como strings en JSON
      "object": "any"
    };

    return typeMap[prop.type] ?? `"${prop.type}"`; // Enums o tipos literales
  }

  /**
   * Convierte un tipo anidado a arktype
   */
  static nestedTypeToArkType(schema: ArkTypeSchemaInfo): string {
    if (schema.properties.length === 0) {
      return "any";
    }

    const props = schema.properties.map(prop => {
      const typeStr = this.typeToArkType(prop);
      return `    ${prop.name}${prop.isOptional ? "?" : ""}: ${typeStr}`;
    }).join(",\n");

    return `type({\n${props}\n})`;
  }

  /**
   * Genera la definición de tipo TypeScript desde un schema de arktype
   */
  static arkTypeToTypeScript(schema: ArkTypeSchemaInfo): string {
    const props = schema.properties.map(prop => {
      const optional = prop.isOptional ? "?" : "";
      let typeStr = this.arkTypeToTSType(prop);
      return `  ${prop.name}${optional}: ${typeStr};`;
    }).join("\n");

    return `export interface ${schema.schemaName} {\n${props}\n}`;
  }

  /**
   * Convierte un tipo arktype a TypeScript
   */
  static arkTypeToTSType(prop: PropertyInfo): string {
    if (prop.isArray) {
      if (prop.nestedType) {
        const nestedInterface = this.arkTypeNestedToTSType(prop.nestedType);
        return `(${nestedInterface})[]`;
      }
      return `${prop.type.toLowerCase()}[]`;
    }

    const typeMap: Record<string, string> = {
      "string": "string",
      "number": "number",
      "boolean": "boolean",
      "any": "any",
      "unknown": "unknown",
      "undefined": "void",
      "null": "null"
    };

    return typeMap[prop.type] ?? prop.type;
  }

  /**
   * Convierte un tipo anidado a TypeScript
   */
  static arkTypeNestedToTSType(schema: ArkTypeSchemaInfo): string {
    if (schema.properties.length === 0) {
      return "any";
    }

    return schema.schemaName;
  }

  /**
   * Genera un type guard de TypeScript desde un schema de arktype
   */
  static generateTypeGuard(schema: ArkTypeSchemaInfo): string {
    const varName = schema.schemaName.charAt(0).toLowerCase() + schema.schemaName.slice(1);
    
    return `export function is${schema.schemaName}(value: unknown): value is ${schema.schemaName} {
  const schema = type({
${schema.properties.map(p => `    ${p.name}${p.isOptional ? "?" : ""}: "${p.type.toLowerCase()}"`).join(",\n")}
  });
  return schema(value).status;
}`;
  }
}

/**
 * Generador principal para manejar la conversión entre clases, schemas de arktype y types
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
    
    for (const filePath of pluginFiles) {
      try {
        const content = await readFile(filePath, "utf-8");
        const pluginInfo = this.parsePlugin(filePath, content);
        
        if (pluginInfo && pluginInfo.className) {
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
   * Extrae las propiedades de una clase TypeScript
   */
  extractClassProperties(sourceFile: ts.SourceFile): PropertyInfo[] {
    const properties: PropertyInfo[] = [];
    
    const visit = (node: ts.Node) => {
      if (ts.isClassDeclaration(node)) {
        // Visitar todas las declaraciones dentro de la clase
        node.members.forEach(member => {
          if (ts.isPropertyDeclaration(member) && member.name && ts.isIdentifier(member.name)) {
            const propName = member.name.text;
            const propInfo = this.extractPropertyType(member, sourceFile);
            if (propInfo) {
              properties.push(propInfo);
            }
          }
          
          // Manejar constructores con parámetros
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
  
  /**
   * Extrae el tipo de una propiedad
   */
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
      // Inferir tipo del inicializador
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
  
  /**
   * Verifica si un tipo es un array
   */
  private isArrayType(typeNode: ts.TypeNode, sourceFile: ts.SourceFile): boolean {
    if (ts.isArrayTypeNode(typeNode)) {
      return true;
    }
    if (ts.isUnionTypeNode(typeNode)) {
      return typeNode.types.some(t => this.isArrayType(t, sourceFile));
    }
    return false;
  }
  
  /**
   * Extrae tipos anidados (objetos, interfaces)
   */
  private extractNestedType(typeNode: ts.TypeNode, sourceFile: ts.SourceFile): ArkTypeSchemaInfo | undefined {
    if (ts.isTypeReferenceNode(typeNode)) {
      const typeName = typeNode.typeName.getText(sourceFile);
      
      // Buscar la definición de este tipo en el archivo
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
   * Busca las propiedades de un tipo en el archivo fuente
   */
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
  
  /**
   * Mapea nombres de tipos a nombres normalizados
   */
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
    
    // Extraer solo el nombre del tipo sin modificadores
    const baseType = type.split("<")[0]?.split("|")[0]?.trim() || type;
    return typeMap[baseType] || baseType;
  }
  
  /**
   * Infiere el tipo desde un inicializador
   */
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
  
  /**
   * Obtiene el símbolo en una ubicación
   */
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
  
  /**
   * Obtiene el type checker de TypeScript
   */
  private getTypeChecker(): ts.TypeChecker {
    const program = ts.createProgram([join(process.cwd(), "src/types/generator.ts")], this.compilerOptions);
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

    function visit(node: ts.Node) {
      if (ts.isClassDeclaration(node)) {
        if (node.name) {
          className = node.name.text;
          
          // Extraer propiedades de la clase para generar schema de arktype
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
              typeDefinition: ArkTypeConverter.arkTypeToTypeScript({
                schemaName,
                schemaDefinition: "",
                typeDefinition: "",
                properties
              }),
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
        if (name === "getSharedApi" && node.type) {
          const returnType = node.type.getText(sourceFile);
          const match = returnType.match(/:\s*(\w+Api)/);
          if (match) {
            apiInterface = match[1];
          }
        }
      }

      ts.forEachChild(node, visit);
    }

    ts.forEachChild(sourceFile, visit);

    if (!className) {
      const exportDefaultMatch = source.match(/export\s+default\s+definePlugin\s*\(/);
      if (exportDefaultMatch) {
        className = "DefaultPlugin";
      }
    }

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
    
    const hasSharedApi = /getSharedApi\s*\(/.test(source);
    
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
  
  generateDeclarations(plugins: PluginTypeInfo[], baseApiInterface: string = "BasePluginApi"): string {
    const pluginNames = plugins.map(p => `  | "${p.name}"`).join("\n");
    
    const apiTypeMappings = plugins.map(p => {
      const apiType = p.apiInterface || baseApiInterface;
      return `  T extends "${p.name}" ? ${apiType} :`;
    }).join("\n");
    
    const classTypeMappings = plugins.map(p => {
      return `  T extends "${p.name}" ? typeof ${p.className} :`;
    }).join("\n");
    
    const pluginList = plugins.map(p => {
      const deps = p.dependencies 
        ? `, dependencies: ${JSON.stringify(p.dependencies)}`
        : "";
      return `  { name: "${p.name}"; version: "${p.version}"; class: typeof ${p.className }${deps} }`;
    }).join(",\n");
    
    return `import type { IPlugin } from "${this.packageName}/types";

declare global {
  namespace ${this.packageName.replace(/-/g, '_')} {
    interface ${baseApiInterface} {
      name: string;
      version: string;
      actions?: string[];
      type?: string;
      loaded?: string;
    }

    type KnownPluginNames = 
${pluginNames};

    type PluginApiType<T extends KnownPluginNames> =
${apiTypeMappings}
      ${baseApiInterface};

    type PluginClassType<T extends KnownPluginNames> =
${classTypeMappings}
      IPlugin;

    type AllPlugins = readonly [
${pluginList}
    ];

    type GetPluginApi<T extends KnownPluginNames> = PluginApiType<T>;
    type GetPluginClass<T extends KnownPluginNames> = PluginClassType<T>;
  }
}

export {};
`;
  }
  
  generateModuleExports(plugins: PluginTypeInfo[], baseApiInterface: string = "BasePluginApi"): string {
    const pluginExports = plugins.map(p => {
      const relPath = relative(this.outputDir, p.filePath);
      return `export { ${p.className} } from "./${relPath.replace(/\\/g, '/').replace(/\.(ts|js)$/, "")}";`;
    }).join("\n");
    
    return `import type { IPlugin } from "${this.packageName}/types";

export type { KnownPluginNames, PluginApiType, PluginClassType, AllPlugins, GetPluginApi, GetPluginClass } from "./plugin-registry";

export interface ${baseApiInterface} {
  name: string;
  version: string;
  actions?: string[];
  type?: string;
  loaded?: string;
}

${pluginExports}
`;
  }
  
  /**
   * Genera archivos de schemas de arktype para cada plugin
   */
  generateArkTypeSchemas(plugins: PluginTypeInfo[]): string {
    let content = `// Auto-generated ArkType schemas\nimport { type } from "arktype";\n\n`;
    
    for (const plugin of plugins) {
      if (plugin.arkTypeSchema) {
        content += `// Schema for ${plugin.className}\n`;
        content += `export const ${plugin.arkTypeSchema.schemaName} = ${plugin.arkTypeSchema.schemaDefinition}\n\n`;
        content += `// TypeScript type for ${plugin.className}\n`;
        content += `export ${plugin.arkTypeSchema.typeDefinition}\n\n`;
        content += `// Type guard for ${plugin.className}\n`;
        content += `${ArkTypeConverter.generateTypeGuard(plugin.arkTypeSchema)}\n\n`;
      }
    }
    
    return content;
  }
  
  async generate(): Promise<PluginTypeInfo[]> {
    await mkdir(this.outputDir, { recursive: true });
    
    const plugins = await this.scanPlugins();
    const baseApiInterface = "BasePluginApi";
    
    const declarations = this.generateDeclarations(plugins, baseApiInterface);
    const moduleExports = this.generateModuleExports(plugins, baseApiInterface);
    const arkTypeSchemas = this.generateArkTypeSchemas(plugins);
    
    const dtsPath = join(this.outputDir, "plugin-registry.d.ts");
    const indexPath = join(this.outputDir, "index.d.ts");
    const arkTypePath = join(this.outputDir, "arktype-schemas.ts");
    
    await writeFile(dtsPath, declarations, "utf-8");
    await writeFile(indexPath, moduleExports, "utf-8");
    await writeFile(arkTypePath, arkTypeSchemas, "utf-8");
    
    console.log(`Generated ${dtsPath} with ${plugins.length} plugins`);
    console.log(`Generated ${indexPath}`);
    console.log(`Generated ${arkTypePath}`);
    
    return plugins;
  }
  
  async getPlugins(): Promise<PluginTypeInfo[]> {
    return this.scanPlugins();
  }
  
  /**
   * Método estático para convertir directamente una clase a schema de arktype
   */
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
        typeDefinition: ArkTypeConverter.arkTypeToTypeScript({
          schemaName,
          schemaDefinition: "",
          typeDefinition: "",
          properties
        }),
        properties
      };
    } catch (error) {
      console.error(`Error converting class to ArkType: ${error}`);
      return null;
    }
  }
  
  /**
   * Método estático para convertir un schema de arktype a tipo TypeScript
   */
  static convertArkTypeToTypeScript(schema: ArkTypeSchemaInfo): string {
    return ArkTypeConverter.arkTypeToTypeScript(schema);
  }
}

export async function generatePluginTypes(
  pluginsDir: string = join(process.cwd(), "plugins"),
  outputDir: string = join(process.cwd(), ".bun-plugins-types"),
  packageName: string = "bun_plugins"
): Promise<PluginTypeInfo[]> {
  const generator = new PluginTypeGenerator({ pluginsDir, outputDir, packageName });
  return generator.generate();
}

/**
 * Ejemplo de uso:
 * 
 * // Convertir clase a schema de arktype
 * const schema = await PluginTypeGenerator.convertClassToArkType("./plugins/MyPlugin.ts");
 * console.log(schema.schemaDefinition);
 * 
 * // Convertir schema a TypeScript
 * const tsType = PluginTypeGenerator.convertArkTypeToTypeScript(schema);
 * console.log(tsType);
 */
