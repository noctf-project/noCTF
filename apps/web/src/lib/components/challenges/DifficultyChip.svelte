<script lang="ts">
  import { difficultyToBgColour } from "$lib/utils/challenges";
  import { type Difficulty } from "$lib/constants/difficulties";

  let { difficulty }: { difficulty: Difficulty } = $props();
</script>

<div
  class={`badge badge-xs py-2 font-semibold ${difficultyToBgColour(difficulty)}`}
>
  {difficulty}
</div>
