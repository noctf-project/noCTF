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
          "primary-content": "#e6e6f7",
          "--diff-beginner": "#8cd5fa",
          "--diff-easy": "#a1d593",
          "--diff-medium": "#deb475",
          "--diff-hard": "#d35153",
        },
      },
      {
        dark: {
          primary: "#6ea84f",
          secondary: "#e8da63",
          accent: "#49d9b1",
          neutral: "#020405",
          "base-100": "#1a1b1e",
          "base-200": "#14151a",
          "base-300": "#090b15",
          "--base-400": "#040716",
          "--base-500": "#010108",
          info: "#5fc4e9",
          success: "#b3f550",
          warning: "#ea9545",
          error: "#dc5551",
          "--diff-beginner": "#64a7ca",
          "--diff-easy": "#669b57",
          "--diff-medium": "#c38b46",
          "--diff-hard": "#ad3b3d",
        },
      },
    ],
  },
} satisfies Config;
