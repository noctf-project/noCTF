import { describe, it, expect } from "vitest";
import { render } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import PatternPropertiesField from "./PatternPropertiesField.svelte";

describe("PatternPropertiesField", () => {
  const sampleSchema = {
    type: "object" as const,
    title: "Webhook Delivery Channels",
    patternProperties: {
      "^(.*)$": {
        type: "object",
        properties: {
          url: { type: "string", title: "Webhook URL" },
        },
      },
    },
  };

  it("mounts safely with undefined value without throwing", () => {
    expect(() => {
      render(PatternPropertiesField, {
        props: {
          schema: sampleSchema,
          value: undefined as unknown as object,
          fieldName: "webhooks",
        },
      });
    }).not.toThrow();
  });

  it("adds a new dynamic key when typed and submitted", async () => {
    const user = userEvent.setup();
    const data: Record<string, unknown> = {};

    const { getByPlaceholderText, getByRole, getByText } = render(
      PatternPropertiesField,
      {
        props: {
          schema: sampleSchema,
          value: data,
          fieldName: "webhooks",
        },
      },
    );

    const input = getByPlaceholderText("Enter key name...");
    const addButton = getByRole("button", { name: "Add" });

    await user.type(input, "discord-alerts");
    await user.click(addButton);

    expect(getByText("discord-alerts")).toBeInTheDocument();
  });
});
