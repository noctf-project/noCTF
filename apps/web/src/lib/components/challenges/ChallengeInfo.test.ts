import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import ChallengeInfo from "./ChallengeInfo.svelte";
import type { ChallengeCardData } from "./ChallengeCard.svelte";
import authState from "$lib/state/auth.svelte";
import api from "$lib/api/index.svelte";

vi.mock("$lib/api/index.svelte", () => ({
  default: {
    POST: vi.fn(),
    GET: vi.fn().mockResolvedValue({ data: { data: {} } }),
  },
  API_BASE_URL: "http://localhost:8000",
  SESSION_TOKEN_KEY: "noctf-session-token",
  wrapLoadable: vi.fn((p) => ({ loading: false, error: false, r: p })),
}));

describe("ChallengeInfo", () => {
  const sampleChallData: ChallengeCardData = {
    id: 42,
    slug: "sql-injection-101",
    title: "SQL Injection 101",
    points: 150,
    categories: ["web"],
    difficulty: "easy",
    solves: 10,
    isSolved: false,
    hidden: false,
  };

  const sampleChallDetails = {
    description: "Find the flag in the users table.",
    files: [
      {
        filename: "source.zip",
        url: "files/source.zip",
        size: 1024,
        hash: "abcdef123456",
      },
    ],
    hints: [
      {
        title: "Hint 1",
        description: "Try using `' OR 1=1--`",
      },
    ],
    inputType: "text",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders challenge details, files, and hints correctly", () => {
    const { getByText } = render(ChallengeInfo, {
      props: {
        challData: sampleChallData,
        challDetails: sampleChallDetails,
        loading: false,
        onSolve: vi.fn(),
      },
    });

    expect(getByText("SQL Injection 101")).toBeInTheDocument();
    expect(getByText("150")).toBeInTheDocument();
    expect(getByText("source.zip")).toBeInTheDocument();
    expect(getByText("Hint 1")).toBeInTheDocument();
  });

  it("shows team prompt when user is not on a team", () => {
    // Force user not on team
    authState.user = {
      id: 1,
      name: "Solitary User",
      bio: "",
      roles: [],
      team_id: null,
      division_id: null,
      team_name: null,
      is_admin: false,
    };

    const { getByRole } = render(ChallengeInfo, {
      props: {
        challData: sampleChallData,
        challDetails: sampleChallDetails,
        loading: false,
        onSolve: vi.fn(),
      },
    });

    expect(getByRole("button", { name: /team/i })).toBeInTheDocument();
  });

  it("submits flag and calls onSolve when response status is correct", async () => {
    const user = userEvent.setup();
    const onSolve = vi.fn();

    // User is on a team
    authState.user = {
      id: 1,
      name: "Team Member",
      bio: "",
      roles: [],
      team_id: 10,
      division_id: 1,
      team_name: "Flag Hunters",
      is_admin: false,
    };

    // Mock successful solve
    vi.mocked(api.POST).mockResolvedValueOnce({
      data: {
        data: {
          status: "correct",
          submission_id: 100,
        },
      },
    } as any);

    const { getByRole, findByText } = render(ChallengeInfo, {
      props: {
        challData: sampleChallData,
        challDetails: sampleChallDetails,
        loading: false,
        onSolve,
      },
    });

    const input = getByRole("textbox", { name: /flag/i });
    const submitBtn = getByRole("button", { name: /submit/i });

    await user.click(input);
    await user.paste("noCTF{sql_inject_success}");
    await user.click(submitBtn);

    expect(api.POST).toHaveBeenCalledWith("/challenges/{id}/solves", {
      params: { path: { id: 42 } },
      body: { data: "noCTF{sql_inject_success}" },
    });

    expect(onSolve).toHaveBeenCalledTimes(1);
    expect(await findByText(/correct/i)).toBeInTheDocument();
  });

  it("displays incorrect feedback when response status is incorrect", async () => {
    const user = userEvent.setup();
    const onSolve = vi.fn();

    authState.user = {
      id: 1,
      name: "Team Member",
      bio: "",
      roles: [],
      team_id: 10,
      division_id: 1,
      team_name: "Flag Hunters",
      is_admin: false,
    };

    vi.mocked(api.POST).mockResolvedValueOnce({
      data: {
        data: {
          status: "incorrect",
          submission_id: 101,
        },
      },
    } as any);

    const { getByRole, findByText } = render(ChallengeInfo, {
      props: {
        challData: sampleChallData,
        challDetails: sampleChallDetails,
        loading: false,
        onSolve,
      },
    });

    const input = getByRole("textbox", { name: /flag/i });
    const submitBtn = getByRole("button", { name: /submit/i });

    await user.click(input);
    await user.paste("noCTF{wrong_flag}");
    await user.click(submitBtn);

    expect(api.POST).toHaveBeenCalledWith("/challenges/{id}/solves", {
      params: { path: { id: 42 } },
      body: { data: "noCTF{wrong_flag}" },
    });

    expect(onSolve).not.toHaveBeenCalled();
    expect(await findByText(/incorrect/i)).toBeInTheDocument();
  });

  it("renders solved banner and disables input when challenge is already solved", () => {
    const solvedData = { ...sampleChallData, isSolved: true };

    const { getByRole } = render(ChallengeInfo, {
      props: {
        challData: solvedData,
        challDetails: sampleChallDetails,
        loading: false,
        onSolve: vi.fn(),
      },
    });

    const input = getByRole("textbox", { name: /flag/i });
    expect(input).toBeInTheDocument();
    expect(input).toBeDisabled();
  });
});
