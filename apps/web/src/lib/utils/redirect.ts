const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

export const ExternalRedirect = (u: string) => {
  if (!u) return;
  if (/^\/[^/]/.test(u)) {
    window.location.href = u;
    return;
  }
  try {
    const url = new URL(u);
    if (ALLOWED_PROTOCOLS.has(url.protocol)) {
      window.location.href = url.toString();
      return;
    }
  } catch {
    /* empty */
  }
  window.location.href = "/";
};
