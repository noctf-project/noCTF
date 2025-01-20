<script module lang="ts">
    import { type ChallengeCardProps } from './ChallengeCard.svelte'

    export interface ChallengeBoardProps {
        challenges: ChallengeCardProps[],
    }
</script>

<script lang="ts">
    import ChallengeCard from './ChallengeCard.svelte'

    const { challenges }: ChallengeBoardProps = $props()
</script>

<div class="flex flex-row flex-wrap gap-3 content-start">
    {#each challenges as challenge}
        <ChallengeCard {...challenge} />
    {/each}
</div>
