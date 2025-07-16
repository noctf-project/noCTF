<script lang="ts">
  /* eslint-disable @typescript-eslint/no-explicit-any */
  import Icon from "@iconify/svelte";
  import NestedObjectField from "./NestedObjectField.svelte";
  import PatternPropertiesField from "./PatternPropertiesField.svelte";

  type SchemaProperty = {
    type?: string;
    title?: string;
    description?: string;
    default?: any;
    enum?: any[];
    anyOf?: Array<{ const?: any; type?: string }>;
    const?: any;
    minimum?: number;
    maximum?: number;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    format?: string;
    contentMediaType?: string;
    items?: {
      type?: string;
      properties?: Record<string, any>;
      required?: string[];
      title?: string;
      description?: string;
    };
    properties?: Record<string, any>;
    patternProperties?: Record<string, any>;
    required?: string[];
  };

  let {
    property,
    value = $bindable(),
    fieldName,
    disabled = false,
    required = false,
  }: {
    property: SchemaProperty;
    value: any;
    fieldName: string;
    disabled?: boolean;
    required?: boolean;
  } = $props();

  function getFieldId() {
    return `field-${fieldName}`;
  }

  function handleNumberInput(event: Event) {
    const target = event.target as HTMLInputElement;
    const numValue = parseFloat(target.value);
    value = isNaN(numValue) ? null : numValue;
  }

  function handleIntegerInput(event: Event) {
    const target = event.target as HTMLInputElement;
    const intValue = parseInt(target.value, 10);
    value = isNaN(intValue) ? null : intValue;
  }

  function handleJsonInput(event: Event) {
    const target = event.target as HTMLTextAreaElement;
    try {
      value = JSON.parse(target.value);
    } catch (_) {
      /* empty */
    }
  }

  function getJsonString(val: any): string {
    if (val === null || val === undefined) return "";
    if (typeof val === "string") return val;
    try {
      return JSON.stringify(val, null, 2);
    } catch (_) {
      return String(val);
    }
  }

  function isJsonField(prop: SchemaProperty): boolean {
    return (
      !prop.type &&
      !prop.properties &&
      !prop.patternProperties &&
      !prop.enum &&
      !prop.anyOf &&
      !prop.const
    );
  }

  function getEnumOptions(prop: SchemaProperty): any[] {
    if (prop.enum) {
      return prop.enum;
    }
    if (prop.anyOf) {
      return prop.anyOf
        .filter((item) => item && typeof item === "object")
        .map((item) => item.const)
        .filter((val) => val !== undefined);
    }
    return [];
  }

  function getDefaultValueForArrayItem(itemSchema: any): any {
    if (!itemSchema) return "";

    switch (itemSchema.type) {
      case "string":
        return "";
      case "number":
      case "integer":
        return 0;
      case "boolean":
        return false;
      case "object":
        const obj: any = {};
        if (itemSchema.properties) {
          for (const [key, prop] of Object.entries(itemSchema.properties)) {
            if ((prop as any).default !== undefined) {
              obj[key] = (prop as any).default;
            }
          }
        }
        return obj;
      case "array":
        return [];
      default:
        return "";
    }
  }
</script>

<div class="form-control">
  <label class="label" for={getFieldId()}>
    <span class="label-text font-medium">
      {property.title || fieldName}
      {#if required}<span class="text-error">*</span>{/if}
    </span>
    {#if property.description}
      <div class="tooltip tooltip-left" data-tip={property.description}>
        <Icon
          icon="material-symbols:info-outline"
          class="text-base-content/60"
        />
      </div>
    {/if}
  </label>

  {#if property.type === "boolean"}
    <label class="label justify-start">
      <input
        id={getFieldId()}
        type="checkbox"
        class="toggle toggle-primary"
        bind:checked={value}
        {disabled}
      />
      <span class="label-text ml-2">
        {value ? "Enabled" : "Disabled"}
      </span>
    </label>
  {:else if property.const !== undefined}
    <input
      id={getFieldId()}
      type="text"
      class="input input-bordered"
      value={property.const}
      readonly
      disabled
    />
  {:else if (property.type === "string" && property.enum) || property.anyOf}
    <select
      id={getFieldId()}
      class="select select-bordered w-full"
      bind:value
      {disabled}
    >
      {#each getEnumOptions(property) as option}
        <option value={option}>{option}</option>
      {/each}
    </select>
  {:else if property.type === "string" && property.contentMediaType === "textarea"}
    <textarea
      id={getFieldId()}
      class="textarea textarea-bordered"
      bind:value
      placeholder={property.description}
      minlength={property.minLength}
      maxlength={property.maxLength}
      {disabled}
    ></textarea>
  {:else if property.type === "string"}
    <input
      id={getFieldId()}
      type="text"
      class="input input-bordered"
      bind:value
      placeholder={property.description}
      minlength={property.minLength}
      maxlength={property.maxLength}
      pattern={property.pattern}
      {disabled}
    />
  {:else if property.type === "number"}
    <input
      id={getFieldId()}
      type="number"
      class="input input-bordered"
      value={value ?? ""}
      min={property.minimum}
      max={property.maximum}
      step="any"
      oninput={handleNumberInput}
      {disabled}
    />
  {:else if property.type === "integer"}
    <input
      id={getFieldId()}
      type="number"
      class="input input-bordered"
      value={value ?? ""}
      min={property.minimum}
      max={property.maximum}
      step="1"
      oninput={handleIntegerInput}
      {disabled}
    />
  {:else if property.type === "array"}
    <div class="space-y-3">
      <div class="flex items-center justify-between">
        <span class="text-sm font-medium text-base-content/70">
          Array Items ({Array.isArray(value) ? value.length : 0})
        </span>
        {#if !disabled}
          <button
            type="button"
            class="btn btn-sm bg-base-100 pop hover:pop"
            onclick={() => {
              if (!Array.isArray(value)) value = [];
              value = [...value, getDefaultValueForArrayItem(property.items)];
            }}
          >
            <Icon icon="material-symbols:add" />
            Add Item
          </button>
        {/if}
      </div>

      {#if Array.isArray(value) && value.length > 0}
        <div class="space-y-3">
          {#each value as _, index}
            <div class="border border-base-200 rounded-lg p-3 bg-base-100">
              <div class="flex items-start justify-between gap-3">
                <div class="flex-1">
                  <div class="flex items-center gap-2 mb-2">
                    <span class="text-xs font-medium text-base-content/60"
                      >Item {index + 1}</span
                    >
                  </div>

                  {#if property.items?.type === "string"}
                    <input
                      type="text"
                      class="input input-bordered w-full"
                      bind:value={value[index]}
                      {disabled}
                    />
                  {:else if property.items?.type === "number"}
                    <input
                      type="number"
                      class="input input-bordered w-full"
                      bind:value={value[index]}
                      step="any"
                      {disabled}
                    />
                  {:else if property.items?.type === "integer"}
                    <input
                      type="number"
                      class="input input-bordered w-full"
                      bind:value={value[index]}
                      step="1"
                      {disabled}
                    />
                  {:else if property.items?.type === "boolean"}
                    <label class="label justify-start">
                      <input
                        type="checkbox"
                        class="toggle toggle-primary"
                        bind:checked={value[index]}
                        {disabled}
                      />
                      <span class="label-text ml-2">
                        {value[index] ? "Enabled" : "Disabled"}
                      </span>
                    </label>
                  {:else if property.items?.type === "object"}
                    <NestedObjectField
                      schema={property.items as any}
                      bind:value={value[index]}
                      fieldName={`Item ${index + 1}`}
                      {disabled}
                    />
                  {:else}
                    <input
                      type="text"
                      class="input input-bordered w-full"
                      bind:value={value[index]}
                      {disabled}
                    />
                  {/if}
                </div>

                {#if !disabled}
                  <button
                    type="button"
                    class="btn btn-error btn-sm pop hover:pop"
                    onclick={() => {
                      value = value.filter((_: any, i: number) => i !== index);
                    }}
                  >
                    <Icon icon="material-symbols:delete" />
                  </button>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      {:else}
        <div
          class="text-center py-8 text-base-content/50 border border-dashed border-base-300 rounded-lg"
        >
          <p>Empty array</p>
        </div>
      {/if}
    </div>
  {:else if property.type === "object" && property.patternProperties}
    <PatternPropertiesField
      schema={property as any}
      bind:value
      {fieldName}
      {disabled}
    />
  {:else if property.type === "object"}
    <NestedObjectField
      schema={property as any}
      bind:value
      {fieldName}
      {disabled}
    />
  {:else if isJsonField(property)}
    <div class="space-y-2">
      <textarea
        id={getFieldId()}
        class="textarea textarea-bordered font-mono text-sm"
        value={getJsonString(value)}
        placeholder="Enter JSON..."
        rows="6"
        oninput={handleJsonInput}
        {disabled}
      ></textarea>
    </div>
  {:else}
    <input
      id={getFieldId()}
      type="text"
      class="input input-bordered"
      bind:value
      {disabled}
    />
  {/if}

  {#if property.description}
    <div class="label">
      <span class="label-text-alt text-base-content/60">
        {property.description}
      </span>
    </div>
  {/if}
</div>
