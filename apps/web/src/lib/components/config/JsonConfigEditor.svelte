<script lang="ts">
  /* eslint-disable @typescript-eslint/no-explicit-any */
  import { JSONEditor, Mode, createAjvValidator } from "svelte-jsoneditor";
  import addFormats from "ajv-formats";

  let {
    schema,
    data = $bindable(),
    disabled = false,
  }: {
    schema: any;
    data: any;
    disabled?: boolean;
  } = $props();

  let content = $state({
    json: data || {},
  });

  let validator = $derived(
    schema
      ? createAjvValidator({
          schema,
          ajvOptions: {
            allErrors: true,
            verbose: true,
          },
          onCreateAjv: (ajv) => {
            addFormats(ajv);
          },
        })
      : undefined,
  );

  function handleChange(updatedContent: any) {
    if (updatedContent.text !== undefined) {
      data = JSON.parse(updatedContent.text);
    }
  }
</script>

<div>
  <JSONEditor
    bind:content
    onChange={handleChange}
    mode={"text" as Mode}
    mainMenuBar={false}
    navigationBar={false}
    statusBar={true}
    readOnly={disabled}
    {validator}
  />
</div>
