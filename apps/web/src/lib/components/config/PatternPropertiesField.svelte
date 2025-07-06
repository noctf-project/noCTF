<script lang="ts">
  /* eslint-disable @typescript-eslint/no-explicit-any */
  import Icon from "@iconify/svelte";
  import SchemaFormField from "./SchemaFormField.svelte";
  import NestedObjectField from "./NestedObjectField.svelte";

  type PatternPropertySchema = {
    type: "object";
    patternProperties?: Record<string, any>;
    title?: string;
    description?: string;
  };

  let {
    schema,
    value = $bindable(),
    fieldName,
    disabled = false,
  }: {
    schema: PatternPropertySchema;
    value: Record<string, any>;
    fieldName: string;
    disabled?: boolean;
  } = $props();

  let isExpanded = $state(true);
  let newKeyName = $state("");
  let editingKey = $state<string | null>(null);
  let editingKeyName = $state("");

  $effect(() => {
    if (value === undefined || value === null) {
      value = {};
    }
  });

  const patternSchema = $derived(() => {
    const patterns = Object.values(schema.patternProperties || {});
    return patterns[0] || {};
  });

  function toggleExpanded() {
    isExpanded = !isExpanded;
  }

  function addNewKey() {
    if (!newKeyName.trim() || value[newKeyName.trim()]) {
      return;
    }

    const key = newKeyName.trim();

    let defaultValue;
    if (patternSchema().type === "object") {
      defaultValue = {};
      if (patternSchema().properties) {
        for (const [propKey, propSchema] of Object.entries(
          patternSchema().properties,
        )) {
          if ((propSchema as any).default !== undefined) {
            (defaultValue as any)[propKey] = (propSchema as any).default;
          }
        }
      }
    } else if (patternSchema().type === "array") {
      defaultValue = [];
    } else if (patternSchema().type === "boolean") {
      defaultValue = false;
    } else if (
      patternSchema().type === "number" ||
      patternSchema().type === "integer"
    ) {
      defaultValue = 0;
    } else {
      defaultValue = "";
    }

    value = { ...value, [key]: defaultValue };
    newKeyName = "";
  }

  function removeKey(key: string) {
    const newValue = { ...value };
    delete newValue[key];
    value = newValue;
  }

  function startEditKey(key: string) {
    editingKey = key;
    editingKeyName = key;
  }

  function saveKeyEdit() {
    if (
      !editingKey ||
      !editingKeyName.trim() ||
      editingKeyName === editingKey
    ) {
      cancelKeyEdit();
      return;
    }

    if (value[editingKeyName.trim()]) {
      // Key already exists, cancel edit
      cancelKeyEdit();
      return;
    }

    const newValue = { ...value };
    const oldValue = newValue[editingKey];
    delete newValue[editingKey];
    newValue[editingKeyName.trim()] = oldValue;
    value = newValue;

    cancelKeyEdit();
  }

  function cancelKeyEdit() {
    editingKey = null;
    editingKeyName = "";
  }

  function handleKeyPress(event: KeyboardEvent) {
    if (event.key === "Enter") {
      if (editingKey) {
        saveKeyEdit();
      } else {
        addNewKey();
      }
    } else if (event.key === "Escape") {
      if (editingKey) {
        cancelKeyEdit();
      }
    }
  }

  function isValidKeyName(keyName: string): boolean {
    return keyName.trim().length > 0 && !value[keyName.trim()];
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
        <p class="text-xs text-base-content/50">
          Dynamic key-value pairs ({Object.keys(value || {}).length} items)
        </p>
      </div>
    </div>
  </div>

  {#if isExpanded}
    <div class="space-y-4 ml-6">
      {#if !disabled}
        <div class="flex gap-2 items-end">
          <div class="form-control flex-1">
            <label class="label" for="new-key">
              <span class="label-text text-sm">Add new key</span>
            </label>
            <input
              type="text"
              class="input input-bordered input-sm"
              bind:value={newKeyName}
              placeholder="Enter key name..."
              onkeydown={handleKeyPress}
            />
          </div>
          <button
            type="button"
            class="btn btn-primary btn-sm pop hover:pop"
            onclick={addNewKey}
            disabled={!isValidKeyName(newKeyName)}
          >
            <Icon icon="material-symbols:add" />
            Add
          </button>
        </div>
        <div class="divider my-2"></div>
      {/if}

      {#if Object.keys(value || {}).length === 0}
        <div class="text-center py-8 text-base-content/50">
          <p>Empty array</p>
        </div>
      {:else}
        <div class="space-y-4">
          {#each Object.entries(value || {}) as [key, _]}
            <div class="border border-base-200 rounded-lg p-3 bg-base-100">
              <div class="flex items-center justify-between mb-3">
                <div class="flex items-center gap-2 flex-1">
                  {#if editingKey === key}
                    <input
                      type="text"
                      class="input input-bordered input-xs flex-1 max-w-xs"
                      bind:value={editingKeyName}
                      onkeydown={handleKeyPress}
                    />
                    <button
                      type="button"
                      class="btn btn-success btn-xs pop hover:pop"
                      onclick={saveKeyEdit}
                      disabled={!isValidKeyName(editingKeyName) ||
                        editingKeyName === key}
                    >
                      <Icon icon="material-symbols:check" />
                    </button>
                    <button
                      type="button"
                      class="btn btn-ghost btn-xs pop hover:pop"
                      onclick={cancelKeyEdit}
                    >
                      <Icon icon="material-symbols:close" />
                    </button>
                  {:else}
                    <code
                      class="bg-base-200 px-2 py-1 rounded text-sm font-mono"
                      >{key}</code
                    >
                    {#if !disabled}
                      <button
                        type="button"
                        class="btn btn-ghost btn-xs pop hover:pop"
                        onclick={() => startEditKey(key)}
                      >
                        <Icon icon="material-symbols:edit" />
                      </button>
                    {/if}
                  {/if}
                </div>

                {#if !disabled && editingKey !== key}
                  <button
                    type="button"
                    class="btn btn-error btn-xs pop hover:pop"
                    onclick={() => removeKey(key)}
                  >
                    <Icon icon="material-symbols:delete" />
                  </button>
                {/if}
              </div>

              <div class="ml-4">
                {#if patternSchema().type === "object"}
                  <NestedObjectField
                    schema={patternSchema()}
                    bind:value={value[key]}
                    fieldName={`${key} configuration`}
                    {disabled}
                  />
                {:else}
                  <SchemaFormField
                    property={patternSchema()}
                    bind:value={value[key]}
                    fieldName={`${key} value`}
                    {disabled}
                  />
                {/if}
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {/if}
</div>
