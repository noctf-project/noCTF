import { describe, it, expect, vi } from "vitest";
import { render, within } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import ChallengeFilterer from "./ChallengeFilterer.svelte";
import type { ChallengeCardData } from "./ChallengeCard.svelte";

describe("ChallengeFilterer", () => {
  const sampleChallenges: ChallengeCardData[] = [
    {
      id: 1,
      slug: "baby-web",
      title: "Baby Web",
      categories: ["web"],
      difficulty: "easy",
      points: 100,
      solves: 45,
      isSolved: true,
      hidden: false,
    },
    {
      id: 2,
      slug: "hard-crypto",
      title: "Hard Crypto",
      categories: ["crypto"],
      difficulty: "hard",
      points: 400,
      solves: 5,
      isSolved: false,
      hidden: false,
    },
    {
      id: 3,
      slug: "buffer-overflow",
      title: "Buffer Overflow",
      categories: ["pwn"],
      difficulty: "medium",
      points: 250,
      solves: 12,
      isSolved: false,
      hidden: false,
    },
    {
      id: 4,
      slug: "sqli-master",
      title: "SQLi Master",
      categories: ["web"],
      difficulty: "medium",
      points: 200,
      solves: 20,
      isSolved: false,
      hidden: false,
    },
  ];

  it("renders category filter buttons with correct solve and total counts", () => {
    const onFilter = vi.fn();
    const { getByText } = render(ChallengeFilterer, {
      props: {
        challenges: sampleChallenges,
        onFilter,
      },
    });

    // Check counts inside each specific button
    const allBtn = getByText("All").closest("button")!;
    expect(within(allBtn).getByText("1/4")).toBeInTheDocument();

    const webBtn = getByText("web").closest("button")!;
    expect(within(webBtn).getByText("1/2")).toBeInTheDocument();

    const cryptoBtn = getByText("crypto").closest("button")!;
    expect(within(cryptoBtn).getByText("0/1")).toBeInTheDocument();

    const pwnBtn = getByText("pwn").closest("button")!;
    expect(within(pwnBtn).getByText("0/1")).toBeInTheDocument();
  });

  it("filters challenges to selected category when category button is clicked", async () => {
    const user = userEvent.setup();
    const onFilter = vi.fn();

    const { getByText } = render(ChallengeFilterer, {
      props: {
        challenges: sampleChallenges,
        onFilter,
      },
    });

    // Initial filter emission (All challenges, sorted by solves descending: 45, 20, 12, 5)
    expect(onFilter).toHaveBeenLastCalledWith([
      sampleChallenges[0], // Baby Web (45)
      sampleChallenges[3], // SQLi Master (20)
      sampleChallenges[2], // Buffer Overflow (12)
      sampleChallenges[1], // Hard Crypto (5)
    ]);

    // Click 'web' button
    const webBtn = getByText("web").closest("button")!;
    await user.click(webBtn);

    // Should only emit web challenges
    expect(onFilter).toHaveBeenLastCalledWith([
      sampleChallenges[0], // Baby Web
      sampleChallenges[3], // SQLi Master
    ]);

    // Click 'All' to reset
    const allBtn = getByText("All").closest("button")!;
    await user.click(allBtn);

    expect(onFilter).toHaveBeenLastCalledWith([
      sampleChallenges[0],
      sampleChallenges[3],
      sampleChallenges[2],
      sampleChallenges[1],
    ]);
  });
});
