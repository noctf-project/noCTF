import {
  CATEGORY_UNKNOWN_ICON,
  ICON_MAP,
  type Category,
} from "$lib/constants/categories";
import {
  DIFFICULTY_BG_MAP,
  type Difficulty,
} from "$lib/constants/difficulties";

export const categoryToIcon = (category: string) => {
  const c = category.toLowerCase();
  if (!(c in ICON_MAP)) {
    return CATEGORY_UNKNOWN_ICON;
  }
  return ICON_MAP[c as Category] as string;
};

export const difficultyToBgColour = (difficulty: Difficulty) => {
  return DIFFICULTY_BG_MAP[difficulty];
};

export const getDifficultyFromTags = (tags: { [k in string]: string }) => {
  return tags["difficulty"] ?? "";
};

export const getCategoriesFromTags = (tags: { [k in string]: string }) => {
  return tags?.["categories"]?.split(",") ?? [];
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

export const formatFileSize = (bytes: number, decimals: number = 2): string => {
  if (bytes === 0) return "0 B";

  const units: string[] = ["B", "KB", "MB", "GB"];
  const k: number = 1024;

  const i: number = Math.floor(Math.log(bytes) / Math.log(k));
  const size: number = bytes / Math.pow(k, i);
  return `${parseFloat(size.toFixed(decimals))} ${units[i]}`;
};
