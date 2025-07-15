<script>
  const eligibilityRules = [
    {
      id: 1,
      title: "Payment Method Acceptance",
      content: [
        "To be eligible for any prize, you must provide verification of eligibility, which may include institutional ID or other identification. You also accept DownUnderCTF's chosen payment methods, which may require personal information.",
        "All information provided will be used solely for confirming eligibility and distributing prizes, and will not be stored or shared with anyone else.",
      ],
    },
    {
      id: 2,
      title: "Team Size",
      content: [
        "The team must have 5 or fewer people signed up. Each participant must have their own individual account - account sharing is not permitted.",
      ],
    },
    {
      id: 3,
      title: "Player Eligibility",
      content: [
        "For the 'Scoreboard' prizes, all players on the team must be either from Australia or New Zealand. In addition, all players on the team must be tertiary or secondary school students at an Australian or New Zealand institution.",
      ],
    },
    {
      id: 4,
      title: "Overall Prizes",
      content: [
        "If the team wins any 'Overall' prize, they are not eligible for any other 'Scoreboard' prizes. For avoidance of doubt, winners of any 'Overall' prize can only stack this with 'Meme' and 'Writeup' prizes.",
        "All other prizes outside of 'Overall' can be stacked, if all team members are eligible for the rules.",
      ],
    },
    {
      id: 5,
      title: "Top Country Prizes",
      content: [
        "To be eligible for the 'Top Australian' or 'Top New Zealand' prizes, all team members must be from a single country. In addition, all players on the team must be tertiary or secondary school students at an Australian or New Zealand institution.",
      ],
    },
    {
      id: 6,
      title: "Female Prizes",
      content: [
        "To be eligible for the 'Female' prizes, all team members must be female and from Australia or New Zealand. In addition, all players on the team must be tertiary or secondary school students at an Australian or New Zealand institution.",
      ],
    },
    {
      id: 7,
      title: "Secondary / High School Prize",
      content: [
        "To be eligible for the 'Secondary / High School' prize, all team members must be from Australia or New Zealand. In addition, all players must be secondary school students at an Australian or New Zealand institution.",
      ],
    },
    {
      id: 8,
      title: "First Nations / Pasifika / Māori Prize",
      content: [
        "To be eligible for the 'First Nations / Pasifika / Māori' prize, all team members must belong to any of those groups. In addition, all players must be tertiary or secondary school students at an Australian or New Zealand institution.",
      ],
    },
    {
      id: 9,
      title: "Catch - All",
      content: [
        "Prizes and eligibility are subject to change by DownUnderCTF without warning.",
      ],
    },
  ];

  const prizes = [
    {
      category: "🏆TOP OVERALL TEAM🏆",
      style: " bg-yellow-600/50 border-yellow-300 md:col-span-2 ",
      icon: "",
      prizes: [
        { place: "1st", amount: "$3,133.70" },
        { place: "2nd", amount: "$2,500.00" },
        { place: "3rd", amount: "$1,337.00" },
      ],
    },
    {
      category: "TOP AUSTRALIAN TEAM",
      style: " bg-blue-500/50 border-blue-900",
      icon: null,
      prizes: [
        { place: "1st", amount: "$1,337" },
        { place: "2nd", amount: "$1,000" },
        { place: "3rd", amount: "$750" },
      ],
    },
    {
      category: "TOP NEW ZEALAND TEAM",
      style: " bg-blue-500/50 border-blue-900",
      icon: null,
      prizes: [
        { place: "1st", amount: "$1,337" },
        { place: "2nd", amount: "$1,000" },
        { place: "3rd", amount: "$750" },
      ],
    },
    {
      category: "TOP FEMALE TEAM",
      style: " bg-purple-500/50 border-purple-900",
      icon: null,
      prizes: [
        { place: "1st", amount: "$1,337" },
        { place: "2nd", amount: "$1,000" },
        { place: "3rd", amount: "$750" },
      ],
    },
    {
      category: "TOP SECONDARY SCHOOL / HIGH SCHOOL",
      style: " bg-green-500/50 border-green-900",
      icon: null,
      prizes: [
        { place: "1st", amount: "$1,337" },
        { place: "2nd", amount: "$1,000" },
        { place: "3rd", amount: "$750" },
      ],
    },
    {
      category: "TOP FIRST NATIONS / PASIFIKA / MĀORI TEAM",
      style: " bg-gray-500/50 border-gray-500",
      icon: null,
      prizes: [{ place: "1st", amount: "$1,337" }],
    },
    {
      category: "MEME PRIZE",
      style: " bg-purple-500/50 border-purple-900",
      icon: null,
      prizes: [{ description: "Certified memer", amount: "$100" }],
    },
    {
      category: "WRITE UP PRIZES",
      style: " bg-teal-500/50 border-teal-900 md:col-span-2",
      icon: null,
      prizes: [
        { description: "Best write up", amount: "$100" },
        {
          description: "Best write up w/ an unintended solution",
          amount: "$100",
        },
        { description: "Most entertaining write up", amount: "$100" },
      ],
    },
    {
      category: "SPOT PRIZES!",
      style: " bg-green-500/50 border-green-900 md:col-span-2",
      icon: "🎓",
      prizes: [{ description: "Pentester lab vouchers" }],
    },
  ];

  let prizeImageView = $state(false);
</script>

<div class="flex flex-col items-center pb-10">
  <div class="flex flex-col items-center bg-base-100 p-4 rounded-lg opacity-95">
    <p class="text-4xl">Prizes</p>
    <div class="w-full max-w-2xl px-4 rounded">
      {#if prizeImageView}
        <img
          src="/images/2025-prizes.webp"
          alt="DownUnderCTF 2025 Prizes"
          class="w-full h-auto object-contain rounded my-4"
        />
      {:else}
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 my-4">
          {#each prizes as prize}
            <div
              class="{prize.style}  border-4 rounded-3xl shadow-lg overflow-hidden flex flex-col justify-around"
            >
              <div class=" text-white flex items-center">
                <div class="flex items-center justify-center w-full">
                  <h3 class="font-bold text-center text-lg px-4 opacity-100">
                    {prize.category}
                  </h3>
                </div>
              </div>
              <div class="opacity-100">
                {#each prize.prizes as prizeItem}
                  <div class="flex justify-center gap-3 items-center py-1">
                    <span class="font-medium text-base-content">
                      {prizeItem?.place || prizeItem?.description}
                    </span>
                    <span class="text-white font-semibold">
                      {prizeItem?.amount || ""}
                    </span>
                  </div>
                {/each}
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
    <button
      class="btn btn-primary"
      onclick={() => (prizeImageView = !prizeImageView)}
    >
      {prizeImageView ? "View Text" : "View Image"}
    </button>
    <p class="text-sm py-2">All prizes are in AUD unless otherwise specified</p>

    <div class="w-full max-w-4xl px-4 mt-8">
      <div class=" ">
        <h2 class="text-2xl font-bold mb-6 text-center">Eligibility Rules</h2>
        {#each eligibilityRules as rule}
          <div class="px-6">
            <h3 class="text-lg font-semibold mb-2">{rule.id}. {rule.title}</h3>
            {#each rule.content as paragraph, paragraph_index}
              <p class="text-gray-700 {paragraph_index > 0 ? 'mt-2' : ''}">
                {paragraph}
              </p>
            {/each}
          </div>
        {/each}
      </div>
    </div>
  </div>
</div>
