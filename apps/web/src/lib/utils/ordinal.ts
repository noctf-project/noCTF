export const ordinal = (i: number): string => {
  if (!Number.isFinite(i)) return i.toString();
  const v = Math.abs(i);
  const c = v % 100;
  if (c >= 10 && c <= 20) return `${i}th`;
  const d = v % 10;
  if (d === 1) return `${i}st`;
  if (d === 2) return `${i}nd`;
  if (d === 3) return `${i}rd`;
  return `${i}th`;
};
