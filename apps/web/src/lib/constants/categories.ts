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
  "beginner",
  "unsolved",
  "solved",
] as const;
export type Category = (typeof CATEGORIES)[number];
export const ICON_MAP: { [k in Category | "all"]: string } = {
  all: "material-symbols:background-dot-small",
  unsolved: "material-symbols:mail-outline",
  solved: "material-symbols:send",
  pwn: "material-symbols:bug-report-rounded",
  crypto: "material-symbols:key",
  web: "tabler:world",
  rev: "material-symbols:fast-rewind",
  misc: "mdi:puzzle",
  hardware: "bxs:chip",
  forensics: "material-symbols:document-search-rounded",
  osint: "ph:detective-fill",
  blockchain: "tdesign:blockchain",
  beginner: "mdi:seedling",
};
export const CATEGORY_UNKNOWN_ICON = "carbon:unknown-filled";
