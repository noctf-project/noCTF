export default {
    trailingComma: "all",
    tabWidth: 2,
    semi: true,
    singleQuote: false,
    plugins: ["prettier-plugin-svelte"],
    overrides: [{ "files": "*.svelte", "options": { "parser": "svelte" } }],
};
