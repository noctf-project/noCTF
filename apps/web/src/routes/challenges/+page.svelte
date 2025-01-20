<script lang="ts">
    import ChallengeBoard from '$lib/components/challenges/ChallengeBoard.svelte'
    import type { ChallengeCardProps } from '$lib/components/challenges/ChallengeCard.svelte'
    import ChallengeFilterer from '$lib/components/challenges/ChallengeFilterer.svelte'

    let allChallenges: ChallengeCardProps[] = [
        {
            title: 'babypwn',
            categories: ['pwn'],
            solves: 23,
            points: 190,
            isSolved: true,
            difficulty: 'easy',
        },
        {
            title: 'lots of challs',
            categories: ['crypto'],
            solves: 1,
            points: 488,
            isSolved: true,
            difficulty: 'hard',
        },
        {
            title: 'chal with a slightly longer title',
            categories: ['pwn', 'crypto'],
            solves: 1,
            points: 500,
            isSolved: false,
            difficulty: 'easy',
        },
        {
            title: 'puzl',
            categories: ['misc', 'crypto'],
            solves: 1,
            points: 488,
            isSolved: true,
            difficulty: 'hard',
        },
        {
            title: 'reeev',
            categories: ['rev', 'crypto'],
            solves: 112,
            points: 95,
            isSolved: true,
            difficulty: 'medium',
        },
        {
            title: 'crycry',
            categories: ['crypto'],
            solves: 11,
            points: 333,
            isSolved: false,
            difficulty: 'easy',
        },
        {
            title: 'web1',
            categories: ['web'],
            solves: 0,
            points: 500,
            isSolved: false,
            difficulty: 'easy',
        },
        {
            title: 'web2',
            categories: ['web'],
            solves: 0,
            points: 500,
            isSolved: false,
            difficulty: 'medium',
        },
        {
            title: 'web3',
            categories: ['web'],
            solves: 0,
            points: 500,
            isSolved: false,
            difficulty: 'medium',
        },
        {
            title: 'web4',
            categories: ['web'],
            solves: 0,
            points: 500,
            isSolved: false,
            difficulty: 'beginner',
        },
        {
            title: 'web5',
            categories: ['web'],
            solves: 0,
            points: 500,
            isSolved: false,
            difficulty: 'beginner',
        },
        {
            title: 'hello',
            categories: ['web', 'pwn', 'crypto', 'misc'],
            solves: 0,
            points: 500,
            isSolved: false,
            difficulty: 'hard',
        },
        {
            title: 'goodbye',
            categories: ['rev', 'web', 'pwn', 'crypto', 'misc'],
            solves: 0,
            points: 500,
            isSolved: false,
            difficulty: 'hard',
        },
        {
            title: 'web6',
            categories: ['web'],
            solves: 0,
            points: 500,
            isSolved: false,
            difficulty: 'hard',
        },
        {
            title: 'web7',
            categories: ['web'],
            solves: 0,
            points: 500,
            isSolved: false,
            difficulty: 'hard',
        },
    ]

    let challenges = $state(allChallenges.sort((a, b) => b.solves - a.solves))
</script>

<div class="w-11/12 m-auto h-auto mt-8">
    <div class="self-center text-center text-4xl font-black pb-4">Challenges</div>
    <div class="grid grid-cols-[min(25%,20rem)_75%] gap-4 px-16 py-8">
        <div class="mt-8">
            <ChallengeFilterer challenges={allChallenges} onFilter={(res) => challenges = res} />
        </div>
        <ChallengeBoard challenges={challenges} />
    </div>
</div>
