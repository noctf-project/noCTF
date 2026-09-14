/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Checks if a value is considered empty (null, undefined, whitespace string, empty array, empty object).
 */
export function isEmptyValue(value: any): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string" && value.trim() === "") return true;
  if (Array.isArray(value) && value.length === 0) return true;
  if (typeof value === "object" && Object.keys(value).length === 0) return true;
  return false;
}

/**
 * Initializes configuration data from a JSON schema recursively,
 * ensuring all nested objects and default values are pre-populated.
 */
export function initializeDataFromSchema(data: any, currentSchema: any): any {
  if (!currentSchema) return data;

  if (currentSchema.type === "object" || currentSchema.properties) {
    const initialized =
      typeof data === "object" && data !== null && !Array.isArray(data)
        ? { ...data }
        : {};

    if (currentSchema.properties) {
      for (const [key, property] of Object.entries(
        currentSchema.properties,
      ) as [string, any][]) {
        if (property && typeof property === "object") {
          if (property.type === "object" || property.properties) {
            initialized[key] = initializeDataFromSchema(
              initialized[key],
              property,
            );
          } else if (property.type === "array") {
            if (
              initialized[key] === undefined ||
              initialized[key] === null ||
              !Array.isArray(initialized[key])
            ) {
              initialized[key] =
                property.default !== undefined ? property.default : [];
            }
          } else if (
            initialized[key] === undefined &&
            property.default !== undefined
          ) {
            initialized[key] = property.default;
          }
        }
      }
    }

    return initialized;
  }

  if (currentSchema.type === "array") {
    if (Array.isArray(data)) {
      return data.map((item) =>
        initializeDataFromSchema(item, currentSchema.items),
      );
    }
    return currentSchema.default !== undefined ? currentSchema.default : [];
  }

  return data !== undefined ? data : currentSchema.default;
}

/**
 * Cleans data for submission by stripping empty non-required fields.
 */
export function cleanDataForSubmission(
  data: any,
  schemaProps?: any,
  requiredFields: string[] = [],
): any {
  if (!data || typeof data !== "object") {
    return data;
  }

  if (Array.isArray(data)) {
    return data
      .map((item) => cleanDataForSubmission(item, schemaProps, requiredFields))
      .filter((item) => !isEmptyValue(item));
  }

  const cleaned: any = {};

  for (const [key, value] of Object.entries(data)) {
    const isRequired = requiredFields.includes(key);
    const propertySchema = schemaProps?.[key];

    const childProps =
      propertySchema?.type === "array"
        ? propertySchema.items?.properties
        : propertySchema?.properties;
    const childRequired =
      propertySchema?.type === "array"
        ? propertySchema.items?.required || []
        : propertySchema?.required || [];

    if (isRequired) {
      if (
        propertySchema?.type === "object" ||
        (propertySchema?.type === "array" && Array.isArray(value))
      ) {
        cleaned[key] = cleanDataForSubmission(value, childProps, childRequired);
      } else {
        cleaned[key] = value;
      }
    } else {
      if (!isEmptyValue(value)) {
        if (
          propertySchema?.type === "object" ||
          (propertySchema?.type === "array" && Array.isArray(value))
        ) {
          const cleanedValue = cleanDataForSubmission(
            value,
            childProps,
            childRequired,
          );
          if (!isEmptyValue(cleanedValue)) {
            cleaned[key] = cleanedValue;
          }
        } else {
          cleaned[key] = value;
        }
      }
    }
  }

  return cleaned;
}
