import createClient from "openapi-fetch";
import type { paths } from "@noctf/openapi-spec";

export const API_BASE_URL = "http://localhost:8000";
const client = createClient<paths>({
  baseUrl: API_BASE_URL,
  credentials: "include",
});

type Loadable<T> =
  | {
      loading: true;
      r: undefined;
    }
  | {
      loading: false;
      r: T;
    };
export function wrapLoadable<T>(p: Promise<T>): Loadable<T> {
  const s = $state<Loadable<T>>({ loading: true, r: undefined });
  p.then((r) => {
    s.loading = false;
    s.r = r;
  });
  return s;
}

export default client;
