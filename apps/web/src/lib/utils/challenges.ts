export const CATEGORIES = [
  "pwn",
  "crypto",
  "web",
  "rev",
  "misc",
  "hardware",
  "forensics",
  "osint",
  "blockchain",
] as const;
export type Category = (typeof CATEGORIES)[number];
const ICON_MAP: { [k in Category | "all"]: string } = {
  all: "material-symbols:background-dot-small",
  pwn: "material-symbols:bug-report-rounded",
  crypto: "material-symbols:key",
  web: "tabler:world",
  rev: "material-symbols:fast-rewind",
  misc: "mdi:puzzle",
  hardware: "bxs:chip",
  forensics: "material-symbols:document-search-rounded",
  osint: "ph:detective-fill",
  blockchain: "tdesign:blockchain",
};

export const categoryToIcon = (category: string) => {
  const c = category.toLowerCase();
  if (!(c in ICON_MAP)) {
    return "carbon:unknown-filled";
  }
  return ICON_MAP[c as Category] as string;
};

const DIFFICULTY_BG_MAP: { [k in Difficulty]: string } = {
  beginner: "bg-diff-beginner",
  easy: "bg-diff-easy",
  medium: "bg-diff-medium",
  hard: "bg-diff-hard",
};
export const DIFFICULTIES = ["beginner", "easy", "medium", "hard"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const difficultyToBgColour = (difficulty: Difficulty) => {
  return DIFFICULTY_BG_MAP[difficulty];
};

export const getDifficultyFromTags = (tags: { [k in string]: string }) => {
  return tags["difficulty"] ?? "";
};

export const getCategoriesFromTags = (tags: { [k in string]: string }) => {
  try {
    return JSON.parse(tags["categories"] ?? "[]");
  } catch {
    return [];
  }
};

export const slugify = (title: string) => {
  const s = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64)
    .replace(/-$/g, "");
  return /^\d/.test(s) ? `n-${s}`.slice(0, 64) : s;
};
