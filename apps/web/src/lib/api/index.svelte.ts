import createClient, { type Middleware } from "openapi-fetch";
import type { paths } from "@noctf/openapi-spec";

import { IS_STATIC_EXPORT, staticHandler } from "$lib/static_export/middleware";

export const SESSION_TOKEN_KEY = "noctf-session-token";

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
const client = createClient<paths>({
  baseUrl: API_BASE_URL,
  fetch: IS_STATIC_EXPORT ? (r) => staticHandler.handleRequest(r) : undefined,
});

const authMiddleware: Middleware = {
  async onRequest({ request }) {
    // TODO: make this into a module/service
    const token = localStorage.getItem(SESSION_TOKEN_KEY);
    if (token) request.headers.set("authorization", `Bearer ${token}`);
    return request;
  },
};

if (!IS_STATIC_EXPORT) {
  client.use(authMiddleware);
}

type Loadable<T> =
  | {
      loading: true;
      error: undefined;
      r: undefined;
    }
  | {
      loading: false;
      error: boolean;
      r: T;
    };
export function wrapLoadable<T>(p: Promise<T>): Loadable<T> {
  const s = $state<Loadable<T>>({
    loading: true,
    error: undefined,
    r: undefined,
  });
  p.then(
    (r) => {
      s.loading = false;
      s.r = r;
    },
    (e) => {
      s.loading = false;
      s.error = true;
      console.error(e);
    },
  ).finally(() => {
    s.loading = false;
  });
  return s;
}

export default client;
