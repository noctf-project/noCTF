import { Primitive } from "../types/primitives.ts";

export type EventFilter = {
  [key: string]:
    | ["!" | "=" | ">" | ">=" | "<" | "<=", Primitive | Primitive[]]
    | EventFilter;
};
const FILTERABLE_TYPES = new Set(["string", "number", "boolean"]);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const EvaluateFilter = (filter: EventFilter, data: any, ttl = 16) => {
  // bail if no filter or exceeded TTL, we want to err on the side of false positives
  if (!filter || !ttl) {
    return true;
  }

  // so we don't have to keep allocating memory
  const empty = {};

  for (const key of Object.keys(filter)) {
    // scalar
    if (Array.isArray(filter[key])) {
      // bail since we only support primitives
      if (!FILTERABLE_TYPES.has(typeof data[key])) {
        continue;
      }
      const [c, v] = filter[key];
      switch (c) {
        case "!":
          if (Array.isArray(v)) {
            if (v.includes(data[key])) return false;
          } else if (v === data[key]) return false;
          break;
        case "=":
          if (Array.isArray(v)) {
            if (!v.includes(data[key])) return false;
          } else if (v !== data[key]) return false;
          break;
        case ">":
          if (!Array.isArray(v) && data[key] <= v) return false;
          break;
        case ">=":
          if (!Array.isArray(v) && data[key] < v) return false;
          break;
        case "<":
          if (!Array.isArray(v) && data[key] >= v) return false;
          break;
        case "<=":
          if (!Array.isArray(v) && data[key] > v) return false;
          break;
        default:
          break;
      }
    } else {
      if (!EvaluateFilter(filter[key], data[key] || empty, ttl - 1))
        return false;
    }
  }
  return true;
};
