import { describe, it, expect } from "vitest";
import { render } from "@testing-library/svelte";
import NestedObjectField from "./NestedObjectField.svelte";

describe("NestedObjectField", () => {
  it("mounts safely even when value is undefined", () => {
    const schema = {
      type: "object" as const,
      title: "Test Nested",
      properties: {
        address: { type: "string", title: "Address" },
        name: { type: "string", title: "Name" },
      },
    };

    expect(() => {
      render(NestedObjectField, {
        props: {
          schema,
          value: undefined as unknown as object,
          fieldName: "testNested",
        },
      });
    }).not.toThrow();
  });

  it("renders fields when value is provided", () => {
    const schema = {
      type: "object" as const,
      title: "From Address",
      properties: {
        address: { type: "string", title: "Email Address" },
        name: { type: "string", title: "Sender Name" },
      },
    };

    const { getByText, getByDisplayValue } = render(NestedObjectField, {
      props: {
        schema,
        value: { address: "test@example.com", name: "Tester" },
        fieldName: "from",
      },
    });

    expect(getByText("From Address")).toBeInTheDocument();
    expect(getByDisplayValue("test@example.com")).toBeInTheDocument();
    expect(getByDisplayValue("Tester")).toBeInTheDocument();
  });
});
