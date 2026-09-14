import { describe, it, expect } from "vitest";
import {
  initializeDataFromSchema,
  cleanDataForSubmission,
  isEmptyValue,
} from "./schema-utils";

describe("schema-utils", () => {
  describe("isEmptyValue", () => {
    it("identifies null and undefined as empty", () => {
      expect(isEmptyValue(null)).toBe(true);
      expect(isEmptyValue(undefined)).toBe(true);
    });

    it("identifies whitespace string as empty", () => {
      expect(isEmptyValue("")).toBe(true);
      expect(isEmptyValue("   ")).toBe(true);
      expect(isEmptyValue("valid")).toBe(false);
    });

    it("identifies empty arrays and objects as empty", () => {
      expect(isEmptyValue([])).toBe(true);
      expect(isEmptyValue({})).toBe(true);
      expect(isEmptyValue([1])).toBe(false);
      expect(isEmptyValue({ key: "value" })).toBe(false);
    });

    it("does not treat boolean false or 0 as empty", () => {
      expect(isEmptyValue(false)).toBe(false);
      expect(isEmptyValue(0)).toBe(false);
    });
  });

  describe("initializeDataFromSchema", () => {
    it("recursively initializes nested objects with default values", () => {
      const emailSchema = {
        type: "object",
        properties: {
          provider: { type: "string", default: "smtp" },
          from: {
            type: "object",
            properties: {
              address: { type: "string", default: "admin@example.com" },
              name: { type: "string", default: "Admin" },
            },
          },
          replyTo: {
            type: "object",
            properties: {
              address: { type: "string" },
              name: { type: "string" },
            },
          },
        },
      };

      // Even when input is completely empty, it must initialize nested objects
      const initialized = initializeDataFromSchema({}, emailSchema);

      expect(initialized).toEqual({
        provider: "smtp",
        from: {
          address: "admin@example.com",
          name: "Admin",
        },
        replyTo: {
          address: undefined,
          name: undefined,
        },
      });
    });

    it("preserves existing values while applying missing defaults", () => {
      const schema = {
        type: "object",
        properties: {
          name: { type: "string", default: "Default Name" },
          count: { type: "number", default: 10 },
          settings: {
            type: "object",
            properties: {
              theme: { type: "string", default: "dark" },
              enabled: { type: "boolean", default: true },
            },
          },
        },
      };

      const existingData = {
        name: "Custom Name",
        settings: {
          enabled: false,
        },
      };

      const result = initializeDataFromSchema(existingData, schema);
      expect(result).toEqual({
        name: "Custom Name",
        count: 10,
        settings: {
          theme: "dark",
          enabled: false,
        },
      });
    });

    it("initializes empty arrays when default is not provided", () => {
      const schema = {
        type: "object",
        properties: {
          tags: { type: "array" },
        },
      };

      const result = initializeDataFromSchema({}, schema);
      expect(result).toEqual({ tags: [] });
    });
  });

  describe("cleanDataForSubmission", () => {
    it("removes empty optional fields while keeping required fields", () => {
      const schema = {
        type: "object",
        required: ["requiredField"],
        properties: {
          requiredField: { type: "string" },
          optionalField: { type: "string" },
          emptyObj: { type: "object", properties: { a: { type: "string" } } },
        },
      };

      const input = {
        requiredField: "",
        optionalField: "",
        emptyObj: { a: "" },
      };

      const cleaned = cleanDataForSubmission(
        input,
        schema.properties,
        schema.required,
      );

      expect(cleaned).toHaveProperty("requiredField", "");
      expect(cleaned).not.toHaveProperty("optionalField");
      expect(cleaned).not.toHaveProperty("emptyObj");
    });

    it("preserves required fields in array items by threading items.properties and items.required", () => {
      const schema = {
        type: "object",
        properties: {
          itemsList: {
            type: "array",
            items: {
              type: "object",
              required: ["name"],
              properties: {
                name: { type: "string" },
                description: { type: "string" },
              },
            },
          },
        },
      };

      const input = {
        itemsList: [
          { name: "", description: "" },
          { name: "Valid Item", description: "" },
        ],
      };

      const cleaned = cleanDataForSubmission(input, schema.properties);

      // name is required in items, so empty name must be kept; description is optional, so empty description is removed
      expect(cleaned).toEqual({
        itemsList: [{ name: "" }, { name: "Valid Item" }],
      });
    });
  });
});
