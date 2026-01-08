import { describe, it, expect } from "bun:test";
import { ArkTypeConverter } from "../../src/types/arktype_converter";
import type { PropertyInfo, ArkTypeSchemaInfo } from "../../src/types/interfaces";

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
      expect(result).toContain("  address: Address");
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
      expect(result).toContain("  contact: ContactInfo");
      expect(result).toContain('  contacts?: array("ContactInfo")');
      expect(result).toContain("});");
    });

    it("should handle empty properties list", () => {
      const result = ArkTypeConverter.classToArkType("EmptyClass", []);

      expect(result).toContain("const emptyClassSchema = type({");
      expect(result).toContain("});");
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

    it("should convert custom types without quotes", () => {
      const customProp: PropertyInfo = { name: "test", type: "CustomType", isOptional: false, isArray: false };

      expect(ArkTypeConverter.typeToArkType(customProp)).toBe("CustomType");
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

    const schema = ArkTypeConverter.classToArkType("TestClass", properties);

    expect(schema).toContain('items: array("string")');
    expect(schema).toContain('nullableItems?: array("number")');
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
    expect(schema).toContain("calculateTotal: function"); // Methods are treated as function in arktype
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

    // Verify schema structure
    expect(schema).toContain("const userSchema = type({");
    expect(schema).toContain("id: number");
    expect(schema).toContain("username: string");
    expect(schema).toContain("email: string");
    expect(schema).toContain("age?: number");
    expect(schema).toContain("isActive: boolean");
    expect(schema).toContain('tags?: array("string")');
    expect(schema).toContain("  address: Address");
    expect(schema).toContain('addresses?: array("Address")');
    expect(schema).toContain("});");
  });
});
