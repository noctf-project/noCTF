const DISALLOWED_PROTOCOLS = new Set([
  "javascript:",
  "vbscript:",
  "data:",
  "about:",
  "file:",
]);

export const SanitizedRedirect = (u: string) => {
  if (!u) return;
  if (/^\/[^\/]/.test(u)) {
    window.location.href = u;
    return;
  }
  try {
    const url = new URL(u);
    if (DISALLOWED_PROTOCOLS.has(url.protocol)) {
      window.location.href = "/";
      return;
    }
  } catch {}
  window.location.href = "/";
};
