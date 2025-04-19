import { API_BASE_URL } from "$lib/api/index.svelte";

export function validateRedirect(url: URL) {
  return (
    url.origin === API_BASE_URL && url.pathname === "/auth/oauth/authorize"
  );
}

export function performRedirect(redir: string) {
  if (redir.charAt(0) === "/") {
    window.location.replace(window.location.origin + redir);
  } else {
    if (redir.startsWith("api/")) {
      redir = API_BASE_URL + redir.substring(3);
    }
    try {
      const url = new URL(redir);
      if (validateRedirect(url)) {
        window.location.replace(url);
      } else {
        window.location.replace("/");
      }
    } catch {
      window.location.replace("/");
    }
  }
}
