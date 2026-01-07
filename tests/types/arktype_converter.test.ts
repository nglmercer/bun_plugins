import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { ArkTypeConverter, PluginTypeGenerator, PropertyInfo, ArkTypeSchemaInfo } from "../../src/types/generator";
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

      // Los tipos anidados se representan como strings literales por defecto
      expect(result).toContain("const personSchema = type({");
      expect(result).toContain('  address: "Address"');
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

    it("should convert unknown types to string literal", () => {
      const customProp: PropertyInfo = { name: "test", type: "CustomType", isOptional: false, isArray: false };

      expect(ArkTypeConverter.typeToArkType(customProp)).toBe('"CustomType"');
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
  });
});

describe("PluginTypeGenerator", () => {
  let tempDir: string;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    tempDir = join(tmpdir(), "bun-plugins-test-" + Date.now());
    await mkdir(tempDir, { recursive: true });
    
    // Crear plugin de prueba
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
    
    await writeFile(join(tempDir, "TestPlugin.ts"), testPlugin);
    
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

  describe("scanPlugins", () => {
    it("should scan and parse plugins from directory", async () => {
      const generator = new PluginTypeGenerator({
        pluginsDir: tempDir,
        outputDir: join(tempDir, "output"),
      });

      const plugins = await generator.scanPlugins();

      expect(plugins.length).toBeGreaterThan(0);
      expect(plugins[0].className).toBe("TestPlugin");
      expect(plugins[0].name).toBe("test-plugin");
      expect(plugins[0].version).toBe("1.0.0");
    });
  });

  describe("generate", () => {
    it("should generate type declaration files", async () => {
      const outputDir = join(tempDir, "generated-types");
      const generator = new PluginTypeGenerator({
        pluginsDir: tempDir,
        outputDir: outputDir,
        packageName: "test_bun_plugins",
      });

      const plugins = await generator.generate();

      expect(plugins.length).toBeGreaterThan(0);
      expect(plugins[0].arkTypeSchema).toBeDefined();
      expect(plugins[0].arkTypeSchema?.properties.length).toBeGreaterThan(0);
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
});
