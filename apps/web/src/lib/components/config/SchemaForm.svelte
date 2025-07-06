<script lang="ts">
  /* eslint-disable @typescript-eslint/no-explicit-any */
  import SchemaFormField from "./SchemaFormField.svelte";

  type JsonSchema = {
    type: "object";
    properties: Record<string, any>;
    required?: string[];
    title?: string;
    description?: string;
  };

  let {
    schema,
    data = $bindable(),
    disabled = false,
  }: {
    schema: JsonSchema;
    data: Record<string, any>;
    disabled?: boolean;
  } = $props();

  $effect(() => {
    if (schema?.properties && data) {
      for (const [key, property] of Object.entries(schema.properties)) {
        if (data[key] === undefined && property.default !== undefined) {
          data[key] = property.default;
        }
      }
    }
  });

  function isRequired(fieldName: string): boolean {
    return schema.required?.includes(fieldName) ?? false;
  }
</script>

{#if schema?.properties}
  <div class="space-y-6">
    {#if schema.title}
      <div>
        <h3 class="text-lg font-semibold">{schema.title}</h3>
        {#if schema.description}
          <p class="text-base-content/70 text-sm mt-1">{schema.description}</p>
        {/if}
      </div>
    {/if}

    <div class="space-y-6">
      {#each Object.entries(schema.properties) as [fieldName, property]}
        {#if property.type === "object"}
          <div class="form-control">
            <SchemaFormField
              {property}
              bind:value={data[fieldName]}
              {fieldName}
              required={isRequired(fieldName)}
              {disabled}
            />
          </div>
        {/if}
      {/each}

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        {#each Object.entries(schema.properties) as [fieldName, property]}
          {#if property.type !== "object"}
            <div class="form-control">
              <SchemaFormField
                {property}
                bind:value={data[fieldName]}
                {fieldName}
                required={isRequired(fieldName)}
                {disabled}
              />
            </div>
          {/if}
        {/each}
      </div>
    </div>
  </div>
{:else}
  <div class="alert alert-warning">
    <span>No schema properties found</span>
  </div>
{/if}
