import adapter from "@sveltejs/adapter-static";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

export default {
  kit: {
    adapter: adapter({
      // default options are shown. On some platforms
      // these options are set automatically — see below
      pages: "dist",
      assets: "dist",
      runes: true,
      precompress: false,
      strict: true,
      fallback: "index.html",
    }),
  },
  vite: {
    server: {
      proxy: {
        "/api": "http://localhost:8000",
      },
    },
  },
  preprocess: [vitePreprocess()],
};
