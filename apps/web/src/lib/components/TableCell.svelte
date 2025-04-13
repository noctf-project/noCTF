<script lang="ts">
  export let align: "left" | "center" | "right" = "left";
  export let width: string | undefined = undefined;
  export let bgColor: "error" | "primary" | "warning" | undefined = undefined;
  export let class_: string | undefined = undefined;
  export let expand = false;
</script>

<td
  class="border-r border-base-400 {align === 'center'
    ? 'text-center'
    : align === 'right'
      ? 'text-right'
      : 'text-left'} {bgColor
    ? `bg-${bgColor} text-${bgColor}-content`
    : ''} {class_ ?? ''} {expand ? 'w-full' : 'w-min'}"
  style={width ? `width: ${width}` : undefined}
>
  <slot />
</td>
