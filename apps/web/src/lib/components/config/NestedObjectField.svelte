<script lang="ts">
  /* eslint-disable @typescript-eslint/no-explicit-any */
  import Icon from "@iconify/svelte";
  import SchemaFormField from "./SchemaFormField.svelte";
  import PatternPropertiesField from "./PatternPropertiesField.svelte";
  import Self from "./NestedObjectField.svelte";

  type ObjectSchema = {
    type: "object";
    properties?: Record<string, any>;
    patternProperties?: Record<string, any>;
    required?: string[];
    title?: string;
    description?: string;
  };

  let {
    schema,
    value = $bindable(),
    fieldName,
    disabled = false,
  }: {
    schema: ObjectSchema;
    value: Record<string, any>;
    fieldName: string;
    disabled?: boolean;
  } = $props();

  let isExpanded = $state(true);

  $effect(() => {
    if (value === undefined || value === null) {
      value = {};
    }

    if (schema?.properties && value && typeof value === "object") {
      for (const [key, property] of Object.entries(schema.properties)) {
        if (property && typeof property === "object") {
          if (
            property.type === "object" &&
            (value[key] === undefined || value[key] === null)
          ) {
            value[key] = {};
          }
          if (
            property.type === "array" &&
            (value[key] === undefined || value[key] === null)
          ) {
            value[key] = [];
          }
          if (value[key] === undefined && property.default !== undefined) {
            value[key] = property.default;
          }
        }
      }
    }
  });

  function isRequired(propertyName: string): boolean {
    return schema.required?.includes(propertyName) ?? false;
  }

  function toggleExpanded() {
    isExpanded = !isExpanded;
  }
</script>

<div class="border border-base-300 rounded-lg p-4 bg-base-50">
  <div class="flex items-center justify-between mb-4">
    <div class="flex items-center gap-2">
      <button
        type="button"
        class="btn btn-ghost btn-xs"
        onclick={toggleExpanded}
        {disabled}
      >
        <Icon
          icon={isExpanded
            ? "material-symbols:expand-less"
            : "material-symbols:expand-more"}
          class="text-lg"
        />
      </button>
      <div>
        <h4 class="font-medium text-base">
          {schema.title || fieldName}
        </h4>
        {#if schema.description}
          <p class="text-sm text-base-content/70">{schema.description}</p>
        {/if}
      </div>
    </div>
  </div>

  {#if isExpanded}
    <div class="space-y-4 ml-6">
      {#if schema?.properties && typeof schema.properties === "object"}
        {#each Object.entries(schema.properties) as [propertyName, propertySchema]}
          {#if propertySchema && typeof propertySchema === "object"}
            <div class="form-control">
              {#if propertySchema.type === "object" && propertySchema.patternProperties}
                <PatternPropertiesField
                  schema={propertySchema}
                  bind:value={value[propertyName]}
                  fieldName={propertyName}
                  {disabled}
                />
              {:else if propertySchema.type === "object"}
                <Self
                  schema={propertySchema}
                  bind:value={value[propertyName]}
                  fieldName={propertyName}
                  {disabled}
                />
              {:else}
                <SchemaFormField
                  property={propertySchema}
                  bind:value={value[propertyName]}
                  fieldName={propertyName}
                  required={isRequired(propertyName)}
                  {disabled}
                />
              {/if}
            </div>
          {/if}
        {/each}
      {/if}

      {#if schema.patternProperties}
        <PatternPropertiesField
          schema={schema as any}
          bind:value
          {fieldName}
          {disabled}
        />
      {/if}
    </div>
  {/if}
</div>
