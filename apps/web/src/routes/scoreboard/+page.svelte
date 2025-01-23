<script lang="ts">
  import Icon from "@iconify/svelte";

  interface ScoreboardEntry {
    team: string;
    rank: number;
    score: number;
    solves: number[];
  }

  interface ChallengeEntry {
    id: number;
    title: string;
    points: number;
    categories: string[];
  }

  const challenges: ChallengeEntry[] = [
    { id: 0, title: "baby-crypto", points: 100, categories: ["crypto"] },
    { id: 1, title: "RSAttack", points: 300, categories: ["crypto"] },
    { id: 2, title: "SafeEncrypt", points: 450, categories: ["crypto"] },
    { id: 3, title: "baby-pwn", points: 100, categories: ["pwn"] },
    { id: 4, title: "heap-overflow", points: 350, categories: ["pwn"] },
    { id: 5, title: "ROP-chain", points: 500, categories: ["pwn"] },
    { id: 6, title: "web-login", points: 150, categories: ["web"] },
    { id: 7, title: "SQLi-fun", points: 250, categories: ["web"] },
    {
      id: 8,
      title: "XSS-blog this chall title long",
      points: 400,
      categories: ["web"],
    },
    { id: 9, title: "rev-me", points: 200, categories: ["rev"] },
    { id: 10, title: "packed-bin", points: 300, categories: ["rev"] },
    { id: 11, title: "vm-crack", points: 450, categories: ["rev"] },
    { id: 12, title: "forensics-101", points: 150, categories: ["forensics"] },
    { id: 13, title: "hidden-data", points: 350, categories: ["forensics"] },
    { id: 14, title: "kernel-bug", points: 500, categories: ["pwn", "rev"] },
  ];

  const scoreboard = [
    {
      team: "qqq",
      rank: 1,
      score: 3850,
      solves: [0, 1, 2, 3, 4, 6, 7, 9, 10, 12, 13],
    },
    {
      team: "long team name long team name",
      rank: 2,
      score: 3600,
      solves: [0, 1, 3, 4, 5, 6, 7, 9, 12],
    },
    {
      team: "l33t h4x0rs",
      rank: 3,
      score: 3400,
      solves: [0, 1, 2, 3, 6, 7, 9, 12, 13],
    },
    {
      team: "Binary Bandits",
      rank: 4,
      score: 3200,
      solves: [0, 3, 4, 6, 7, 8, 9, 12],
    },
    {
      team: "Segmentation Fault",
      rank: 5,
      score: 2900,
      solves: [0, 1, 3, 6, 7, 9, 12],
    },
    {
      team: "Stack Smashers",
      rank: 6,
      score: 2700,
      solves: [0, 3, 4, 6, 9, 12, 13],
    },
    {
      team: "Buffer Overflow",
      rank: 7,
      score: 2500,
      solves: [0, 1, 3, 6, 7, 12],
    },
    { team: "Cyber Dragons", rank: 8, score: 2300, solves: [0, 3, 6, 9, 12] },
    { team: "Packet Pirates", rank: 9, score: 2000, solves: [0, 3, 6, 12] },
    { team: "Red Team Blues", rank: 10, score: 1800, solves: [0, 3, 6] },
    { team: "Null Pointers", rank: 11, score: 1500, solves: [0, 3, 12] },
    { team: "Zero Days Left", rank: 12, score: 1200, solves: [0, 6] },
  ];

  function hasSolved(team: ScoreboardEntry, challengeId: number): boolean {
    return team.solves.includes(challengeId);
  }
</script>

<div class="w-10/12 mx-auto py-4">
  <h1 class="text-3xl font-bold mb-6 text-center">Scoreboard</h1>

  <div class="overflow-x-auto">
    <div class="flex flex-row gap-0 w-full ml-[26.5rem]">
      {#each challenges as challenge}
        <div class="relative">
          <div
            class="
                w-12
                h-32
                border
                border-base-300
                bg-base-200
                skew-x-[-45deg]
                translate-x-16
            "
          ></div>
          <div
            class="
                absolute
                bottom-14
                left-3
                px-1
                -rotate-45
                w-40
                z-10
                truncate
            "
            title={challenge.title}
          >
            {challenge.title}
          </div>
        </div>
      {/each}
    </div>

    <table class="border-collapse w-80 overflow-auto table-fixed">
      <thead class="h-4">
        <tr>
          <th class="border border-base-300 bg-base-200 px-2 py-1 w-8">#</th>
          <th class="border border-base-300 bg-base-200 px-2 py-1 w-64">Team</th
          >
          <th class="border border-base-300 bg-base-200 px-2 py-1 w-20"
            >Score</th
          >
          <th class="border border-base-300 bg-base-200 px-2 py-1 w-14"
            >Flags</th
          >

          {#each challenges as challenge}
            <th
              class="border border-base-300 bg-base-200 w-12 text-center text-sm"
            >
              {challenge.points}
            </th>
          {/each}
        </tr>
      </thead>

      <tbody>
        {#each scoreboard as entry}
          <tr>
            <td class="border border-base-300 text-center h-12">
              {entry.rank}
            </td>
            <td class="border border-base-300 px-4">
              <span class="truncate block" title={entry.team}>
                {entry.team}
              </span>
            </td>
            <td class="border border-base-300 px-4 text-right">
              {entry.score}
            </td>
            <td class="border border-base-300 px-4 text-center">
              {entry.solves.length}
            </td>
            {#each challenges as challenge}
              {@const solved = hasSolved(entry, challenge.id)}
              <td
                class={"border border-base-300 p-0 " +
                  (solved ? "bg-primary/20" : "")}
              >
                <div class="w-full h-full flex items-center justify-center">
                  {#if solved}
                    <Icon
                      icon="material-symbols:flag"
                      class="text-primary text-3xl"
                    />
                  {/if}
                </div>
              </td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>
