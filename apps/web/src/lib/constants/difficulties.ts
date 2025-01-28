export const DIFFICULTY_BG_MAP: { [k in Difficulty]: string } = {
  beginner: "bg-diff-beginner",
  easy: "bg-diff-easy",
  medium: "bg-diff-medium",
  hard: "bg-diff-hard",
};
export const DIFFICULTIES = ["beginner", "easy", "medium", "hard"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];
