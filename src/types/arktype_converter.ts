import type { PropertyInfo, ArkTypeSchemaInfo } from "./interfaces";

/**
 * Utilities for converting between TypeScript classes, arktype schemas, and TypeScript types.
 */
export class ArkTypeConverter {
  /**
   * Converts a TypeScript class to an arktype schema.
   */
  static classToArkType(className: string, properties: PropertyInfo[]): string {
    const schemaProps = properties.map(prop => {
      const typeStr = this.typeToArkType(prop);
      return `  ${prop.name}${prop.isOptional ? "?" : ""}: ${typeStr}`;
    }).join(",\n");

    return `const ${className.charAt(0).toLowerCase() + className.slice(1)}Schema = type({\n${schemaProps}\n});`;
  }

  /**
   * Converts a TypeScript type to its arktype equivalent.
   */
  static typeToArkType(prop: PropertyInfo): string {
    if (prop.isArray) {
      if (prop.nestedType) {
        // For arrays with nested types, use the type name as a string literal
        return `array("${prop.type}")`;
      }
      return `array("${prop.type.toLowerCase()}")`;
    }

    // Methods are treated as string literal types in arktype
    if (prop.isMethod) {
      return `"${prop.type}"`;
    }

    const typeMap: Record<string, string> = {
      "string": "string",
      "number": "number",
      "boolean": "boolean",
      "any": "any",
      "unknown": "unknown",
      "void": "undefined",
      "null": "null",
      "Date": "string", // Dates are represented as strings in JSON
      "object": "any"
    };

    return typeMap[prop.type] ?? `"${prop.type}"`; // Enums or literal types
  }

  /**
   * Converts a nested type to arktype.
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
   * Generates a TypeScript type definition from an arktype schema.
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
   * Converts an arktype type to TypeScript.
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
   * Converts a nested type to TypeScript.
   */
  static arkTypeNestedToTSType(schema: ArkTypeSchemaInfo): string {
    if (schema.properties.length === 0) {
      return "any";
    }

    return schema.schemaName;
  }

  /**
   * Generates a TypeScript type guard from an arktype schema.
   */
  static generateTypeGuard(schema: ArkTypeSchemaInfo): string {
    const varName = schema.schemaName.charAt(0).toLowerCase() + schema.schemaName.slice(1);
    
    const props = schema.properties.map(p => {
      const optional = p.isOptional ? "?" : "";
      const typeStr = p.isArray ? `array("${p.type.toLowerCase()}")` : `"${p.type.toLowerCase()}"`;
      return `    ${p.name}${optional}: ${typeStr}`;
    }).join(",\n");
    
    return `export function is${schema.schemaName}(value: unknown): value is ${schema.schemaName} {
  const schema = type({
${props}
  });
  return schema(value).status;
}`;
  }

  /**
   * Generates an ArkType assertion function from a schema.
   */
  static generateTypeAssertion(schema: ArkTypeSchemaInfo): string {
    const varName = schema.schemaName.charAt(0).toLowerCase() + schema.schemaName.slice(1);
    
    return `export function assert${schema.schemaName}(value: unknown): ${schema.schemaName} {
  const ${varName}Schema = type({
${schema.properties.map(p => `    ${p.name}${p.isOptional ? "?" : ""}: "${p.type.toLowerCase()}"`).join(",\n")}
  });
  return ${varName}Schema(value);
}`;
  }

  /**
   * Generates a TypeScript type from a class definition.
   */
  static generateTypeFromClass(className: string, properties: PropertyInfo[]): string {
    const props = properties.map(prop => {
      const optional = prop.isOptional ? "?" : "";
      const arraySuffix = prop.isArray ? "[]" : "";
      const nestedType = prop.nestedType ? this.arkTypeNestedToTSType(prop.nestedType) : prop.type;
      const typeStr = nestedType + arraySuffix;
      return `  ${prop.name}${optional}: ${typeStr};`;
    }).join("\n");

    return `export interface ${className}Type {\n${props}\n}`;
  }
}
