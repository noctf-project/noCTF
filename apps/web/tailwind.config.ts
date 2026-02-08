import containerQueries from "@tailwindcss/container-queries";
import forms from "@tailwindcss/forms";
import typography from "@tailwindcss/typography";
import type { Config } from "tailwindcss";
import daisyui from "daisyui";
import daisyuiThemes from "daisyui/src/theming/themes";

export default {
  content: ["./src/**/*.{html,js,svelte,ts}"],

  theme: {
    fontFamily: {
      sans: ['"Instrument Sans"', "sans-serif"],
      "instrument-sans": ['"Instrument Sans"', "sans-serif"],
    },
    extend: {
      boxShadow: {
        solid: "0px 3px 0 0 var(--base-500)",
      },
      colors: {
        "base-400": "var(--base-400)",
        "base-500": "var(--base-500)",
        "base-content": "#D9D3E5",
        "diff-beginner": "var(--diff-beginner)",
        "diff-easy": "var(--diff-easy)",
        "diff-medium": "var(--diff-medium)",
        "diff-hard": "var(--diff-hard)",
      },
    },
  },

  plugins: [typography, forms, containerQueries, daisyui],

  daisyui: {
    themes: [
      {
        light: {
          ...daisyuiThemes["light"],
          "--base-400": "#8a8b90",
          "--base-500": "#3a3b40",
          primary: "#706ce4",
          secondary: "#6c9ee4",
          info: "#5cb4ef",
          success: "#72ca72",
          warning: "#f2bb54",
          error: "#c75658",
          "primary-content": "#e6e6f7",
          "--text_primary": "#D9D3E5e0", /* TODO fix this lol or disable light theme entirely? */
          "--diff-beginner": "#8cd5fa",
          "--diff-easy": "#a1d593",
          "--diff-medium": "#deb475",
          "--diff-hard": "#dd534e",
          "--rounded-box": "0.5rem",
        },
      },
      {
        dark: {
          primary: "#D79E3A",
          secondary: "#D79E3A",
          accent: "#40c29d",
          neutral: "#2B2734",
          "base-100": "#1b171d",
          "base-200": "#120f13",
          "base-300": "#120915",
          "--base-400": "#040716",
          "--base-500": "#050108",
          info: "#5fc4e9",
          success: "#98cb4b",
          warning: "#ea9545",
          error: "#dc5551",
          "--text_primary": "#D9D3E5e0",
          "--diff-beginner": "#64a7ca",
          "--diff-easy": "#4f9840",
          "--diff-medium": "#ae6e24",
          "--diff-hard": "#ad3b3d",
          "--rounded-box": "0.5rem",
        },
      },
    ],
  },
} satisfies Config;
