import type { PropertyInfo, ArkTypeSchemaInfo } from "./interfaces";

/**
 * Utilities for converting between TypeScript classes and arktype schemas.
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

    const varName = className.charAt(0).toLowerCase() + className.slice(1);
    return `const ${varName}Schema = type({\n${schemaProps}\n});`;
  }

  /**
   * Converts a TypeScript type to its arktype equivalent.
   */
  static typeToArkType(prop: PropertyInfo): string {
    // Handle method types - they should be "function" in arktype
    if (prop.isMethod) {
      return "function";
    }

    if (prop.isArray) {
      if (prop.nestedType) {
        // For arrays with nested types, use the type name
        return `array("${prop.type}")`;
      }
      return `array("${prop.type.toLowerCase()}")`;
    }

    // Check if this is a custom class type (starts with uppercase letter)
    const isCustomClass = /^[A-Z]/.test(prop.type) && 
                          prop.type !== "String" && 
                          prop.type !== "Number" && 
                          prop.type !== "Boolean" && 
                          prop.type !== "Date" && 
                          prop.type !== "Array" && 
                          prop.type !== "Promise" && 
                          prop.type !== "Record" &&
                          prop.type !== "Map";

    if (isCustomClass) {
      // Keep custom class types as-is (without quotes) for proper type reference
      return prop.type;
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
      "Map": "Map",
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
}
