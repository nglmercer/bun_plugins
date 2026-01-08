import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { ArkTypeConverter } from "../../src/types/arktype_converter";
import { PropertyInfo, ArkTypeSchemaInfo } from "../../src/types/interfaces";
import { PluginTypeGenerator } from "../../src/types/plugin_generator";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeFile, mkdir, rm } from "node:fs/promises";

describe("ArkTypeConverter", () => {
  describe("classToArkType", () => {
    it("should convert simple class properties to arktype schema", () => {
      const properties: PropertyInfo[] = [
        { name: "id", type: "number", isOptional: false, isArray: false },
        { name: "name", type: "string", isOptional: false, isArray: false },
        { name: "email", type: "string", isOptional: true, isArray: false },
      ];

      const result = ArkTypeConverter.classToArkType("User", properties);

      expect(result).toContain("const userSchema = type({");
      expect(result).toContain("  id: number");
      expect(result).toContain("  name: string");
      expect(result).toContain("  email?: string");
      expect(result).toContain("});");
    });

    it("should convert array properties to arktype", () => {
      const properties: PropertyInfo[] = [
        { name: "tags", type: "string", isOptional: false, isArray: true },
        { name: "scores", type: "number", isOptional: true, isArray: true },
      ];

      const result = ArkTypeConverter.classToArkType("Item", properties);

      expect(result).toContain('array("string")');
      expect(result).toContain('array("number")');
    });

    it("should convert nested types to arktype", () => {
      const nestedSchema: ArkTypeSchemaInfo = {
        schemaName: "Address",
        schemaDefinition: "",
        typeDefinition: "",
        properties: [
          { name: "street", type: "string", isOptional: false, isArray: false },
          { name: "city", type: "string", isOptional: false, isArray: false },
        ],
      };

      const properties: PropertyInfo[] = [
        { name: "address", type: "Address", isOptional: false, isArray: false, nestedType: nestedSchema },
      ];

      const result = ArkTypeConverter.classToArkType("Person", properties);

      expect(result).toContain("const personSchema = type({");
      expect(result).toContain('  address: "Address"');
      expect(result).toContain("});");
    });

    it("should handle complex nested types", () => {
      const nestedSchema: ArkTypeSchemaInfo = {
        schemaName: "ContactInfo",
        schemaDefinition: "",
        typeDefinition: "",
        properties: [
          { name: "email", type: "string", isOptional: false, isArray: false },
          { name: "phone", type: "string", isOptional: true, isArray: false },
        ],
      };

      const properties: PropertyInfo[] = [
        { name: "contact", type: "ContactInfo", isOptional: false, isArray: false, nestedType: nestedSchema },
        { name: "contacts", type: "ContactInfo", isOptional: true, isArray: true, nestedType: nestedSchema },
      ];

      const result = ArkTypeConverter.classToArkType("Company", properties);

      expect(result).toContain("const companySchema = type({");
      expect(result).toContain('  contact: "ContactInfo"');
      expect(result).toContain('  contacts?: array("ContactInfo")');
      expect(result).toContain("});");
    });

    it("should handle empty properties list", () => {
      const result = ArkTypeConverter.classToArkType("EmptyClass", []);

      expect(result).toContain("const emptyClassSchema = type({");
      expect(result).toContain("});");
    });
  });

  describe("arkTypeToTypeScript", () => {
    it("should convert arktype schema to TypeScript interface", () => {
      const schema: ArkTypeSchemaInfo = {
        schemaName: "User",
        schemaDefinition: "",
        typeDefinition: "",
        properties: [
          { name: "id", type: "number", isOptional: false, isArray: false },
          { name: "name", type: "string", isOptional: false, isArray: false },
          { name: "age", type: "number", isOptional: true, isArray: false },
        ],
      };

      const result = ArkTypeConverter.arkTypeToTypeScript(schema);

      expect(result).toContain("export interface User {");
      expect(result).toContain("  id: number;");
      expect(result).toContain("  name: string;");
      expect(result).toContain("  age?: number;");
    });

    it("should handle array types in TypeScript output", () => {
      const schema: ArkTypeSchemaInfo = {
        schemaName: "Item",
        schemaDefinition: "",
        typeDefinition: "",
        properties: [
          { name: "tags", type: "string", isOptional: false, isArray: true },
          { name: "values", type: "number", isOptional: true, isArray: true },
        ],
      };

      const result = ArkTypeConverter.arkTypeToTypeScript(schema);

      expect(result).toContain("tags: string[];");
      expect(result).toContain("values?: number[];");
    });

    it("should handle complex nested types", () => {
      const nestedSchema: ArkTypeSchemaInfo = {
        schemaName: "Address",
        schemaDefinition: "",
        typeDefinition: "",
        properties: [
          { name: "street", type: "string", isOptional: false, isArray: false },
          { name: "city", type: "string", isOptional: false, isArray: false },
          { name: "zipCode", type: "string", isOptional: true, isArray: false },
        ],
      };

      const schema: ArkTypeSchemaInfo = {
        schemaName: "Person",
        schemaDefinition: "",
        typeDefinition: "",
        properties: [
          { name: "name", type: "string", isOptional: false, isArray: false },
          { name: "address", type: "Address", isOptional: false, isArray: false, nestedType: nestedSchema },
        ],
      };

      const result = ArkTypeConverter.arkTypeToTypeScript(schema);

      expect(result).toContain("export interface Person {");
      expect(result).toContain("  name: string;");
      expect(result).toContain("  address: Address;");
    });
  });

  describe("generateTypeGuard", () => {
    it("should generate type guard function", () => {
      const schema: ArkTypeSchemaInfo = {
        schemaName: "User",
        schemaDefinition: "",
        typeDefinition: "",
        properties: [
          { name: "id", type: "number", isOptional: false, isArray: false },
          { name: "name", type: "string", isOptional: false, isArray: false },
        ],
      };

      const result = ArkTypeConverter.generateTypeGuard(schema);

      expect(result).toContain("export function isUser(value: unknown): value is User {");
      expect(result).toContain("const schema = type({");
      expect(result).toContain("});");
      expect(result).toContain("return schema(value).status;");
    });

    it("should generate type guard with optional properties", () => {
      const schema: ArkTypeSchemaInfo = {
        schemaName: "Config",
        schemaDefinition: "",
        typeDefinition: "",
        properties: [
          { name: "required", type: "string", isOptional: false, isArray: false },
          { name: "optional", type: "number", isOptional: true, isArray: false },
        ],
      };

      const result = ArkTypeConverter.generateTypeGuard(schema);

      expect(result).toContain("export function isConfig(value: unknown): value is Config {");
      expect(result).toContain("required: \"string\"");
      expect(result).toContain("optional?: \"number\"");
    });
  });

  describe("typeToArkType", () => {
    it("should convert primitive types correctly", () => {
      const stringProp: PropertyInfo = { name: "test", type: "string", isOptional: false, isArray: false };
      const numberProp: PropertyInfo = { name: "test", type: "number", isOptional: false, isArray: false };
      const booleanProp: PropertyInfo = { name: "test", type: "boolean", isOptional: false, isArray: false };

      expect(ArkTypeConverter.typeToArkType(stringProp)).toBe("string");
      expect(ArkTypeConverter.typeToArkType(numberProp)).toBe("number");
      expect(ArkTypeConverter.typeToArkType(booleanProp)).toBe("boolean");
    });

    it("should convert special types", () => {
      const anyProp: PropertyInfo = { name: "test", type: "any", isOptional: false, isArray: false };
      const unknownProp: PropertyInfo = { name: "test", type: "unknown", isOptional: false, isArray: false };
      const voidProp: PropertyInfo = { name: "test", type: "void", isOptional: false, isArray: false };
      const nullProp: PropertyInfo = { name: "test", type: "null", isOptional: false, isArray: false };
      const dateProp: PropertyInfo = { name: "test", type: "Date", isOptional: false, isArray: false };

      expect(ArkTypeConverter.typeToArkType(anyProp)).toBe("any");
      expect(ArkTypeConverter.typeToArkType(unknownProp)).toBe("unknown");
      expect(ArkTypeConverter.typeToArkType(voidProp)).toBe("undefined");
      expect(ArkTypeConverter.typeToArkType(nullProp)).toBe("null");
      expect(ArkTypeConverter.typeToArkType(dateProp)).toBe("string");
    });

    it("should convert unknown types to string literal", () => {
      const customProp: PropertyInfo = { name: "test", type: "CustomType", isOptional: false, isArray: false };

      expect(ArkTypeConverter.typeToArkType(customProp)).toBe('"CustomType"');
    });

    it("should handle array types with primitives", () => {
      const stringArrayProp: PropertyInfo = { name: "tags", type: "string", isOptional: false, isArray: true };
      const numberArrayProp: PropertyInfo = { name: "scores", type: "number", isOptional: true, isArray: true };

      expect(ArkTypeConverter.typeToArkType(stringArrayProp)).toBe('array("string")');
      expect(ArkTypeConverter.typeToArkType(numberArrayProp)).toBe('array("number")');
    });

    it("should handle array types with nested types", () => {
      const nestedSchema: ArkTypeSchemaInfo = {
        schemaName: "Item",
        schemaDefinition: "",
        typeDefinition: "",
        properties: [
          { name: "id", type: "number", isOptional: false, isArray: false },
        ],
      };

      const nestedArrayProp: PropertyInfo = { name: "items", type: "Item", isOptional: false, isArray: true, nestedType: nestedSchema };

      const result = ArkTypeConverter.typeToArkType(nestedArrayProp);
      expect(result).toContain("array(");
      expect(result).toContain('"Item"');
    });
  });

  describe("arkTypeToTSType", () => {
    it("should convert arktype types to TypeScript types", () => {
      const stringProp: PropertyInfo = { name: "test", type: "string", isOptional: false, isArray: false };
      const numberProp: PropertyInfo = { name: "test", type: "number", isOptional: false, isArray: false };
      const undefinedProp: PropertyInfo = { name: "test", type: "undefined", isOptional: false, isArray: false };

      expect(ArkTypeConverter.arkTypeToTSType(stringProp)).toBe("string");
      expect(ArkTypeConverter.arkTypeToTSType(numberProp)).toBe("number");
      expect(ArkTypeConverter.arkTypeToTSType(undefinedProp)).toBe("void");
    });

    it("should handle array types", () => {
      const stringArrayProp: PropertyInfo = { name: "tags", type: "string", isOptional: false, isArray: true };
      const numberArrayProp: PropertyInfo = { name: "scores", type: "number", isOptional: true, isArray: true };

      expect(ArkTypeConverter.arkTypeToTSType(stringArrayProp)).toBe("string[]");
      expect(ArkTypeConverter.arkTypeToTSType(numberArrayProp)).toBe("number[]");
    });

    it("should preserve custom types", () => {
      const customProp: PropertyInfo = { name: "test", type: "CustomType", isOptional: false, isArray: false };

      expect(ArkTypeConverter.arkTypeToTSType(customProp)).toBe("CustomType");
    });
  });

  describe("nestedTypeToArkType", () => {
    it("should convert nested type with properties", () => {
      const schema: ArkTypeSchemaInfo = {
        schemaName: "Address",
        schemaDefinition: "",
        typeDefinition: "",
        properties: [
          { name: "street", type: "string", isOptional: false, isArray: false },
          { name: "city", type: "string", isOptional: false, isArray: false },
        ],
      };

      const result = ArkTypeConverter.nestedTypeToArkType(schema);

      expect(result).toContain("type({");
      expect(result).toContain("street: string");
      expect(result).toContain("city: string");
    });

    it("should return 'any' for empty properties", () => {
      const schema: ArkTypeSchemaInfo = {
        schemaName: "EmptyType",
        schemaDefinition: "",
        typeDefinition: "",
        properties: [],
      };

      const result = ArkTypeConverter.nestedTypeToArkType(schema);

      expect(result).toBe("any");
    });
  });

  describe("arkTypeNestedToTSType", () => {
    it("should return schema name for nested types", () => {
      const schema: ArkTypeSchemaInfo = {
        schemaName: "Address",
        schemaDefinition: "",
        typeDefinition: "",
        properties: [
          { name: "street", type: "string", isOptional: false, isArray: false },
        ],
      };

      const result = ArkTypeConverter.arkTypeNestedToTSType(schema);

      expect(result).toBe("Address");
    });

    it("should return 'any' for empty properties", () => {
      const schema: ArkTypeSchemaInfo = {
        schemaName: "EmptyType",
        schemaDefinition: "",
        typeDefinition: "",
        properties: [],
      };

      const result = ArkTypeConverter.arkTypeNestedToTSType(schema);

      expect(result).toBe("any");
    });
  });
});

describe("PropertyInfo validation", () => {
  it("should handle optional properties correctly", () => {
    const properties: PropertyInfo[] = [
      { name: "required", type: "string", isOptional: false, isArray: false },
      { name: "optional", type: "number", isOptional: true, isArray: false },
    ];

    const schema = ArkTypeConverter.classToArkType("TestClass", properties);

    expect(schema).toContain("required: string");
    expect(schema).toContain("optional?: number");
  });

  it("should handle array properties correctly", () => {
    const properties: PropertyInfo[] = [
      { name: "items", type: "string", isOptional: false, isArray: true },
      { name: "nullableItems", type: "number", isOptional: true, isArray: true },
    ];

    const interfaceResult = ArkTypeConverter.arkTypeToTypeScript({
      schemaName: "TestClass",
      schemaDefinition: "",
      typeDefinition: "",
      properties,
    });

    expect(interfaceResult).toContain("items: string[];");
    expect(interfaceResult).toContain("nullableItems?: number[];");
  });

  it("should handle method properties correctly", () => {
    const properties: PropertyInfo[] = [
      { name: "id", type: "number", isOptional: false, isArray: false },
      { 
        name: "calculateTotal", 
        type: "number", 
        isOptional: false, 
        isArray: false, 
        isMethod: true,
        params: [
          { name: "amount", type: "number", isOptional: false },
          { name: "tax", type: "number", isOptional: true }
        ]
      },
    ];

    const schema = ArkTypeConverter.classToArkType("Invoice", properties);

    expect(schema).toContain("id: number");
    expect(schema).toContain("calculateTotal: \"number\""); // Methods are treated as string literal types in arktype

    const interfaceResult = ArkTypeConverter.arkTypeToTypeScript({
      schemaName: "Invoice",
      schemaDefinition: "",
      typeDefinition: "",
      properties,
    });

    expect(interfaceResult).toContain("id: number;");
    expect(interfaceResult).toContain("calculateTotal: number;");
  });

  it("should handle complex real-world scenario", () => {
    const addressSchema: ArkTypeSchemaInfo = {
      schemaName: "Address",
      schemaDefinition: "",
      typeDefinition: "",
      properties: [
        { name: "street", type: "string", isOptional: false, isArray: false },
        { name: "city", type: "string", isOptional: false, isArray: false },
        { name: "zipCode", type: "string", isOptional: true, isArray: false },
        { name: "country", type: "string", isOptional: false, isArray: false },
      ],
    };

    const userProperties: PropertyInfo[] = [
      { name: "id", type: "number", isOptional: false, isArray: false },
      { name: "username", type: "string", isOptional: false, isArray: false },
      { name: "email", type: "string", isOptional: false, isArray: false },
      { name: "age", type: "number", isOptional: true, isArray: false },
      { name: "isActive", type: "boolean", isOptional: false, isArray: false },
      { name: "tags", type: "string", isOptional: true, isArray: true },
      { name: "address", type: "Address", isOptional: false, isArray: false, nestedType: addressSchema },
      { name: "addresses", type: "Address", isOptional: true, isArray: true, nestedType: addressSchema },
    ];

    const schema = ArkTypeConverter.classToArkType("User", userProperties);
    const interfaceResult = ArkTypeConverter.arkTypeToTypeScript({
      schemaName: "User",
      schemaDefinition: "",
      typeDefinition: "",
      properties: userProperties,
    });

    // Verify schema structure
    expect(schema).toContain("const userSchema = type({");
    expect(schema).toContain("id: number");
    expect(schema).toContain("username: string");
    expect(schema).toContain("email: string");
    expect(schema).toContain("age?: number");
    expect(schema).toContain("isActive: boolean");
    expect(schema).toContain('tags?: array("string")');
    expect(schema).toContain('address: "Address"');
    expect(schema).toContain('addresses?: array("Address")');
    expect(schema).toContain("});");

    // Verify interface structure
    expect(interfaceResult).toContain("export interface User {");
    expect(interfaceResult).toContain("  id: number;");
    expect(interfaceResult).toContain("  username: string;");
    expect(interfaceResult).toContain("  email: string;");
    expect(interfaceResult).toContain("  age?: number;");
    expect(interfaceResult).toContain("  isActive: boolean;");
    expect(interfaceResult).toContain("  tags?: string[];");
    expect(interfaceResult).toContain("  address: Address;");
    expect(interfaceResult).toContain("  addresses?: (Address)[];");
  });
});

describe("PluginTypeGenerator with ArkType integration", () => {
  let tempDir: string;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    tempDir = join(tmpdir(), "bun-plugins-arktype-test-" + Date.now());
    await mkdir(tempDir, { recursive: true });
    
    // Create test plugins
    const testPlugin = `export class TestPlugin {
      name = "test-plugin";
      version = "1.0.0";
      
      id: number = 0;
      title: string = "";
      isActive: boolean = false;
      tags: string[] = [];
      
      async onLoad() {
        console.log("Loading");
      }
      
      async onUnload() {
        console.log("Unloading");
      }
    }
    `;

    const complexPlugin = `export class ComplexPlugin {
      name = "complex-plugin";
      version = "2.0.0";
      
      id: number;
      name: string;
      settings: {
        enabled: boolean;
        timeout: number;
      } = { enabled: true, timeout: 30 };
      items: Array<{ id: number; value: string }> = [];
    }
    `;
    
    await writeFile(join(tempDir, "TestPlugin.ts"), testPlugin);
    await writeFile(join(tempDir, "ComplexPlugin.ts"), complexPlugin);
    
    cleanup = async () => {
      try {
        await rm(tempDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    };
  });

  afterAll(async () => {
    await cleanup();
  });

  describe("arkTypeSchema generation", () => {
    it("should generate complete arkTypeSchema for plugins", async () => {
      const generator = new PluginTypeGenerator({
        pluginsDir: tempDir,
        outputDir: join(tempDir, "output"),
      });

      const plugins = await generator.scanPlugins();

      expect(plugins.length).toBeGreaterThan(0);
      
      // Check that arkTypeSchema is generated
      const testPluginWithSchema = plugins.find(p => p.arkTypeSchema && p.className === "TestPlugin");
      expect(testPluginWithSchema).toBeDefined();
      expect(testPluginWithSchema?.arkTypeSchema).toBeDefined();
      expect(testPluginWithSchema?.arkTypeSchema?.schemaName).toBe("TestPluginSchema");
    });

    it("should extract properties from plugin classes", async () => {
      const generator = new PluginTypeGenerator({
        pluginsDir: tempDir,
        outputDir: join(tempDir, "output"),
      });

      const plugins = await generator.scanPlugins();
      const testPlugin = plugins.find(p => p.className === "TestPlugin");

      expect(testPlugin).toBeDefined();
      expect(testPlugin?.arkTypeSchema?.properties.length).toBeGreaterThan(0);
      
      const propNames = testPlugin?.arkTypeSchema?.properties.map(p => p.name);
      expect(propNames).toContain("id");
      expect(propNames).toContain("title");
      expect(propNames).toContain("isActive");
      expect(propNames).toContain("tags");
    });

    it("should generate valid arktype schema definition", async () => {
      const generator = new PluginTypeGenerator({
        pluginsDir: tempDir,
        outputDir: join(tempDir, "output"),
      });

      const plugins = await generator.scanPlugins();
      const testPlugin = plugins.find(p => p.className === "TestPlugin");

      expect(testPlugin?.arkTypeSchema?.schemaDefinition).toContain("type({");
      expect(testPlugin?.arkTypeSchema?.typeDefinition).toContain("export interface");
    });

    it("should generate valid TypeScript interface", async () => {
      const generator = new PluginTypeGenerator({
        pluginsDir: tempDir,
        outputDir: join(tempDir, "output"),
      });

      const plugins = await generator.scanPlugins();
      const testPlugin = plugins.find(p => p.className === "TestPlugin");

      expect(testPlugin?.arkTypeSchema?.typeDefinition).toContain("export interface TestPluginSchema {");
      expect(testPlugin?.arkTypeSchema?.typeDefinition).toContain("  id?: number;");
      expect(testPlugin?.arkTypeSchema?.typeDefinition).toContain("  title?: string;");
    });
  });

  describe("convertClassToArkType", () => {
    it("should convert a class file to arktype schema", async () => {
      const pluginPath = join(tempDir, "TestPlugin.ts");
      const result = await PluginTypeGenerator.convertClassToArkType(pluginPath);

      expect(result).not.toBeNull();
      expect(result?.schemaName).toBe("TestPluginSchema");
      expect(result?.properties.length).toBeGreaterThan(0);
      expect(result?.schemaDefinition).toContain("type({");
    });

    it("should handle complex types with inline objects", async () => {
      const pluginPath = join(tempDir, "ComplexPlugin.ts");
      const result = await PluginTypeGenerator.convertClassToArkType(pluginPath);

      expect(result).not.toBeNull();
      expect(result?.properties.length).toBeGreaterThan(0);
    });
  });
});
