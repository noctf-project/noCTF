import tseslint from 'typescript-eslint'
import stylisticTs from '@stylistic/eslint-plugin-ts'
import tsParser from '@typescript-eslint/parser'
import eslintPluginSvelte from 'eslint-plugin-svelte'
import svelteParser from 'svelte-eslint-parser'

const rules = {
    '@stylistic/ts/indent': ['error', 4],
    '@stylistic/ts/comma-dangle': ['error', 'always-multiline'],
    '@stylistic/ts/quotes': ['error', 'single'],
    '@stylistic/ts/semi': ['error', 'never'],
    '@/dot-location': ['error', 'property'],
    '@typescript-eslint/no-unused-vars': [
        'warn',
        {
            'argsIgnorePattern': '^_',
            'varsIgnorePattern': '^_',
            'caughtErrorsIgnorePattern': '^_',
        },
    ],
}

export default tseslint.config(
    {
        ignores: ['**/.svelte-kit/', '**/dist/index.d.ts']
    },
    ...eslintPluginSvelte.configs['flat/recommended'],
    ...tseslint.configs.recommended,
    {
        files: ['**/*.ts'],
        ignores: ['**/.svelte-kit/', '**/dist/index.d.ts'],

        plugins: {
            '@stylistic/ts': stylisticTs,
        },

        languageOptions: {
            parser: tsParser,
        },

        rules,
    },
    {
        files: ['**/*.svelte'],
        ignores: ['**/.svelte-kit/', '**/dist/index.d.ts'],

        plugins: {
            '@stylistic/ts': stylisticTs,
        },

        languageOptions: {
            parser: svelteParser,
            parserOptions: {
                extraFileExtensions: ['.svelte'],
                parser: {
                    ts: tsParser,
                    typescript: tsParser,
                },
            },
        },

        rules,
    },
)
