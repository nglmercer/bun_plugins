import { describe, it, expect } from "bun:test";
import type { PluginTypeInfo, ArkTypeSchemaInfo, PropertyInfo, MethodParamInfo, GeneratorOptions } from "../../src/types/interfaces";

describe("Interfaces", () => {
  describe("PropertyInfo", () => {
    it("should create a basic property", () => {
      const prop: PropertyInfo = {
        name: "id",
        type: "number",
        isOptional: false,
        isArray: false
      };

      expect(prop.name).toBe("id");
      expect(prop.type).toBe("number");
      expect(prop.isOptional).toBe(false);
      expect(prop.isArray).toBe(false);
    });

    it("should create an optional property", () => {
      const prop: PropertyInfo = {
        name: "description",
        type: "string",
        isOptional: true,
        isArray: false
      };

      expect(prop.isOptional).toBe(true);
    });

    it("should create an array property", () => {
      const prop: PropertyInfo = {
        name: "tags",
        type: "string",
        isOptional: false,
        isArray: true
      };

      expect(prop.isArray).toBe(true);
    });

    it("should create a property with nested type", () => {
      const nestedSchema: ArkTypeSchemaInfo = {
        schemaName: "Address",
        schemaDefinition: "",
        typeDefinition: "",
        properties: [
          { name: "street", type: "string", isOptional: false, isArray: false },
          { name: "city", type: "string", isOptional: false, isArray: false }
        ]
      };

      const prop: PropertyInfo = {
        name: "address",
        type: "Address",
        isOptional: false,
        isArray: false,
        nestedType: nestedSchema
      };

      expect(prop.nestedType).toBeDefined();
      expect(prop.nestedType?.schemaName).toBe("Address");
    });

    it("should create a method property", () => {
      const params: MethodParamInfo[] = [
        { name: "x", type: "number", isOptional: false },
        { name: "y", type: "number", isOptional: true }
      ];

      const prop: PropertyInfo = {
        name: "calculate",
        type: "number",
        isOptional: false,
        isArray: false,
        isMethod: true,
        params
      };

      expect(prop.isMethod).toBe(true);
      expect(prop.params?.length).toBe(2);
    });
  });

  describe("ArkTypeSchemaInfo", () => {
    it("should create a schema with properties", () => {
      const schema: ArkTypeSchemaInfo = {
        schemaName: "User",
        schemaDefinition: "const userSchema = type({ id: number, name: string });",
        typeDefinition: "export interface User { id: number; name: string; }",
        properties: [
          { name: "id", type: "number", isOptional: false, isArray: false },
          { name: "name", type: "string", isOptional: false, isArray: false }
        ]
      };

      expect(schema.schemaName).toBe("User");
      expect(schema.properties.length).toBe(2);
      expect(schema.schemaDefinition).toContain("type({");
    });
  });

  describe("PluginTypeInfo", () => {
    it("should create a basic plugin info", () => {
      const plugin: PluginTypeInfo = {
        name: "my-plugin",
        version: "1.0.0",
        className: "MyPlugin",
        filePath: "/plugins/MyPlugin.ts",
        isTypeScript: true
      };

      expect(plugin.name).toBe("my-plugin");
      expect(plugin.className).toBe("MyPlugin");
      expect(plugin.isTypeScript).toBe(true);
    });

    it("should create a plugin with full metadata", () => {
      const plugin: PluginTypeInfo = {
        name: "advanced-plugin",
        version: "2.0.0",
        className: "AdvancedPlugin",
        filePath: "/plugins/AdvancedPlugin.ts",
        isTypeScript: true,
        apiInterface: "AdvancedPluginApi",
        dependencies: { "core": "^1.0.0" },
        arkTypeSchema: {
          schemaName: "AdvancedPluginSchema",
          schemaDefinition: "",
          typeDefinition: "",
          properties: []
        }
      };

      expect(plugin.apiInterface).toBe("AdvancedPluginApi");
      expect(plugin.dependencies).toEqual({ "core": "^1.0.0" });
      expect(plugin.arkTypeSchema).toBeDefined();
    });

    it("should create a JavaScript plugin", () => {
      const plugin: PluginTypeInfo = {
        name: "js-plugin",
        version: "1.0.0",
        className: "JsPlugin",
        filePath: "/plugins/JsPlugin.js",
        isTypeScript: false
      };

      expect(plugin.isTypeScript).toBe(false);
    });
  });

  describe("GeneratorOptions", () => {
    it("should create options with required fields", () => {
      const options: GeneratorOptions = {
        pluginsDir: "/plugins",
        outputDir: "/output"
      };

      expect(options.pluginsDir).toBe("/plugins");
      expect(options.outputDir).toBe("/output");
      expect(options.packageName).toBeUndefined();
    });

    it("should create options with all fields", () => {
      const options: GeneratorOptions = {
        pluginsDir: "/plugins",
        outputDir: "/output",
        baseApiInterface: "CustomApi",
        packageName: "custom_plugins"
      };

      expect(options.baseApiInterface).toBe("CustomApi");
      expect(options.packageName).toBe("custom_plugins");
    });
  });
});
