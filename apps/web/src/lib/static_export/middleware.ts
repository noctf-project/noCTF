import type { Middleware } from "openapi-fetch";

// export const IS_STATIC_EXPORT = !!import.meta.env.VITE_IS_STATIC_EXPORT;
export const IS_STATIC_EXPORT = true; // testing

export const staticExportMiddleware: Middleware = {
  async onRequest({ request, schemaPath }) {
    // TODO: fetch from static export JSON files based on the path, and support custom logic for paginated queries and searches
  },
};
