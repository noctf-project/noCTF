export const NormalizeName = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

export const NormalizeEmail = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/\+.*(?=@)/, "");
