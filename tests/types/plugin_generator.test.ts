import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
} from "bun:test";
import { PluginTypeGenerator } from "../../src/types/plugin_generator";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeFile, mkdir, rm } from "node:fs/promises";

describe("PluginTypeGenerator", () => {
  let tempDir: string;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    tempDir = join(tmpdir(), "bun-plugins-gen-test-" + Date.now());
    await mkdir(tempDir, { recursive: true });

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

  beforeEach(async () => {
    // Clean up output directory before each test
    const outputDir = join(tempDir, "output");
    try {
      await rm(outputDir, { recursive: true, force: true });
    } catch {
      // Ignore errors
    }
  });

  describe("constructor", () => {
    it("should create generator with required options", () => {
      const generator = new PluginTypeGenerator({
        pluginsDir: "/plugins",
        outputDir: "/output",
      });

      expect(generator).toBeDefined();
    });

    it("should create generator with custom package name", () => {
      const generator = new PluginTypeGenerator({
        pluginsDir: "/plugins",
        outputDir: "/output",
        packageName: "custom_plugins",
      });

      expect(generator).toBeDefined();
    });
  });

  describe("scanPlugins", () => {
    it("should return empty array for non-existent directory", async () => {
      const generator = new PluginTypeGenerator({
        pluginsDir: join(tempDir, "non-existent"),
        outputDir: join(tempDir, "output"),
      });

      const plugins = await generator.scanPlugins();

      expect(plugins).toEqual([]);
    });

    it("should scan and parse TypeScript plugins", async () => {
      const testPlugin = `export class MyPlugin {
        name = "my-plugin";
        version = "1.0.0";
        id: number = 0;
        title: string = "";
      }`;

      await writeFile(join(tempDir, "MyPlugin.ts"), testPlugin);

      const generator = new PluginTypeGenerator({
        pluginsDir: tempDir,
        outputDir: join(tempDir, "output"),
      });

      const plugins = await generator.scanPlugins();

      expect(plugins.length).toBeGreaterThan(0);
      expect(plugins[0].className).toBe("MyPlugin");
      expect(plugins[0].name).toBe("my-plugin");
    });

    it("should scan and parse JavaScript plugins", async () => {
      const testPlugin = `export class JsPlugin {
        name = "js-plugin";
        version = "2.0.0";
      }`;

      await writeFile(join(tempDir, "JsPlugin.js"), testPlugin);

      const generator = new PluginTypeGenerator({
        pluginsDir: tempDir,
        outputDir: join(tempDir, "output"),
      });

      const plugins = await generator.scanPlugins();

      expect(plugins.length).toBeGreaterThan(0);
      expect(plugins[0].isTypeScript).toBe(false);
    });

    it("should ignore non-plugin files", async () => {
      const notAPlugin = `export const foo = "bar";`;

      await writeFile(join(tempDir, "utils.ts"), notAPlugin);

      const generator = new PluginTypeGenerator({
        pluginsDir: tempDir,
        outputDir: join(tempDir, "output"),
      });

      const plugins = await generator.scanPlugins();

      // Should not include files without class declarations
      expect(plugins.every((p) => p.name !== "utils")).toBe(true);
    });
  });

  describe("generateDeclarations", () => {
    it("should generate declarations with plugin names", async () => {
      // Create isolated directory to avoid fs-plugin timeout
      const isolatedTempDir = join(tmpdir(), "bun-plugins-decl-" + Date.now());
      await mkdir(isolatedTempDir, { recursive: true });

      const testPlugin = `export class DeclPlugin {
        name = "decl-plugin";
        version = "1.0.0";
      }`;

      await writeFile(join(isolatedTempDir, "DeclPlugin.ts"), testPlugin);

      const generator = new PluginTypeGenerator({
        pluginsDir: isolatedTempDir,
        outputDir: join(isolatedTempDir, "output"),
        packageName: "test_plugins",
      });

      const plugins = await generator.scanPlugins();
      const result = generator.generateDeclarations(plugins);

      // Clean up
      await rm(isolatedTempDir, { recursive: true, force: true });

      expect(result).toContain("KnownPluginNames");
      expect(result).toContain("decl-plugin");
      expect(result).toContain("test_plugins");
    });

    it("should generate declarations with custom base API", async () => {
      // Create isolated directory to avoid fs-plugin timeout
      const isolatedTempDir = join(tmpdir(), "bun-plugins-api-" + Date.now());
      await mkdir(isolatedTempDir, { recursive: true });

      const testPlugin = `export class ApiPlugin {
        name = "api-plugin";
        version = "1.0.0";
      }`;

      await writeFile(join(isolatedTempDir, "ApiPlugin.ts"), testPlugin);

      const generator = new PluginTypeGenerator({
        pluginsDir: isolatedTempDir,
        outputDir: join(isolatedTempDir, "output"),
      });

      const plugins = await generator.scanPlugins();
      const result = generator.generateDeclarations(plugins, "CustomApi");

      // Clean up
      await rm(isolatedTempDir, { recursive: true, force: true });

      expect(result).toContain("interface CustomApi");
    });
  });

  describe("generateModuleExports", () => {
    it("should generate module exports", async () => {
      // Create isolated directory for this test to avoid fs-plugin timeout
      const isolatedTempDir = join(
        tmpdir(),
        "bun-plugins-export-" + Date.now(),
      );
      await mkdir(isolatedTempDir, { recursive: true });

      const testPlugin = `export class ExportPlugin {
        name = "export-plugin";
        version = "1.0.0";
      }`;

      await writeFile(join(isolatedTempDir, "ExportPlugin.ts"), testPlugin);

      const generator = new PluginTypeGenerator({
        pluginsDir: isolatedTempDir,
        outputDir: join(isolatedTempDir, "output"),
      });

      const plugins = await generator.scanPlugins();
      const result = generator.generateModuleExports(plugins);

      // Clean up
      await rm(isolatedTempDir, { recursive: true, force: true });

      expect(result).toContain("ExportPlugin");
      expect(result).toContain("PluginNames");
      expect(result).toContain("PluginApiType");
    });
  });

  describe("generate", () => {
    it("should generate all output files", async () => {
      const testPlugin = `export class GeneratePlugin {
        name = "generate-plugin";
        version = "1.0.0";
        id: number = 0;
      }`;

      await writeFile(join(tempDir, "GeneratePlugin.ts"), testPlugin);

      const outputDir = join(tempDir, "generated");
      const generator = new PluginTypeGenerator({
        pluginsDir: tempDir,
        outputDir: outputDir,
        packageName: "test_bun_plugins",
      });

      const plugins = await generator.generate();

      expect(plugins.length).toBeGreaterThan(0);

      // Verify output files were created
      const dtsPath = join(outputDir, "plugin-registry.d.ts");
      const indexPath = join(outputDir, "index.d.ts");

      const dtsExists = await Bun.file(dtsPath).exists();
      const indexExists = await Bun.file(indexPath).exists();

      expect(dtsExists).toBe(true);
      expect(indexExists).toBe(true);
    });
  });

  describe("getPlugins", () => {
    it("should return scanned plugins from isolated directory", async () => {
      // Create a unique plugin for this test in an isolated temp directory
      const isolatedTempDir = join(
        tmpdir(),
        "bun-plugins-isolated-" + Date.now(),
      );
      await mkdir(isolatedTempDir, { recursive: true });

      const uniqueName = "unique-get-plugin-isolated";
      const testPlugin = `export class UniquePlugin {
        name = "${uniqueName}";
        version = "1.0.0";
      }`;

      await writeFile(join(isolatedTempDir, "UniquePlugin.ts"), testPlugin);

      const generator = new PluginTypeGenerator({
        pluginsDir: isolatedTempDir,
        outputDir: join(isolatedTempDir, "output"),
      });

      const plugins = await generator.getPlugins();

      // Clean up
      await rm(isolatedTempDir, { recursive: true, force: true });

      expect(plugins.length).toBeGreaterThan(0);
      // Find the plugin with our unique name
      const uniquePlugin = plugins.find((p) => p.name === uniqueName);
      expect(uniquePlugin).toBeDefined();
      expect(uniquePlugin?.name).toBe(uniqueName);
    });
  });

  describe("static methods", () => {
    describe("convertClassToArkType", () => {
      it("should return null for non-existent file", async () => {
        const result = await PluginTypeGenerator.convertClassToArkType(
          join(tempDir, "non-existent.ts"),
        );

        expect(result).toBeNull();
      });

      it("should convert class file to arktype schema", async () => {
        const testClass = `export class ConvertPlugin {
          name = "convert-plugin";
          version = "1.0.0";
          id: number = 0;
          title: string = "";
          isActive: boolean = false;
        }`;

        const pluginPath = join(tempDir, "ConvertPlugin.ts");
        await writeFile(pluginPath, testClass);

        const result =
          await PluginTypeGenerator.convertClassToArkType(pluginPath);

        expect(result).not.toBeNull();
        expect(result?.schemaName).toBe("ConvertPluginSchema");
        expect(result?.properties.length).toBeGreaterThan(0);
        expect(result?.schemaDefinition).toContain("type({");
      });
    });
  });

  describe("class property extraction", () => {
    it("should extract public properties", async () => {
      const testClass = `export class PropsPlugin {
        publicId: number = 0;
        publicName: string = "";
        publicActive: boolean = false;
      }`;

      const pluginPath = join(tempDir, "PropsPlugin.ts");
      await writeFile(pluginPath, testClass);

      const result =
        await PluginTypeGenerator.convertClassToArkType(pluginPath);

      expect(result?.properties.length).toBe(3);
      expect(result?.properties.some((p) => p.name === "publicId")).toBe(true);
      expect(result?.properties.some((p) => p.name === "publicName")).toBe(
        true,
      );
      expect(result?.properties.some((p) => p.name === "publicActive")).toBe(
        true,
      );
    });

    it("should exclude private properties", async () => {
      const testClass = `export class PrivatePlugin {
        publicId: number = 0;
        _privateId: number = 0;
        #secretId: number = 0;
      }`;

      const pluginPath = join(tempDir, "PrivatePlugin.ts");
      await writeFile(pluginPath, testClass);

      const result =
        await PluginTypeGenerator.convertClassToArkType(pluginPath);

      expect(result?.properties.length).toBe(1);
      expect(result?.properties[0].name).toBe("publicId");
    });

    it("should handle optional properties", async () => {
      const testClass = `export class OptionalPlugin {
        required: string;
        optional?: number;
        optionalWithDefault: boolean = false;
      }`;

      const pluginPath = join(tempDir, "OptionalPlugin.ts");
      await writeFile(pluginPath, testClass);

      const result =
        await PluginTypeGenerator.convertClassToArkType(pluginPath);

      expect(result?.properties.length).toBeGreaterThan(0);
    });

    it("should handle array types", async () => {
      const testClass = `export class ArrayPlugin {
        tags: string[] = [];
        numbers: number[] = [];
        items: Array<{ id: number }> = [];
      }`;

      const pluginPath = join(tempDir, "ArrayPlugin.ts");
      await writeFile(pluginPath, testClass);

      const result =
        await PluginTypeGenerator.convertClassToArkType(pluginPath);

      expect(result?.properties.length).toBe(3);
    });
  });
});

describe("generatePluginTypes function", () => {
  it("should be exported correctly", async () => {
    const { generatePluginTypes } = await import("../../src/types/generator");

    expect(typeof generatePluginTypes).toBe("function");
  });
});
