import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import { globalIgnores } from 'eslint/config';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import importPlugin from 'eslint-plugin-import';
import noSecrets from 'eslint-plugin-no-secrets';
import prettierPlugin from 'eslint-plugin-prettier';
import prettierConfig from 'eslint-config-prettier';

const typeCheckedGlobs = ['src/**/*.{ts,tsx}', 'electron/**/*.{ts,tsx}', 'vite.config.ts', 'vitest.config.ts'];

const rendererGlobs = ['src/**/*.{js,jsx,ts,tsx}'];

const nodeGlobs = ['electron/**/*.{js,mjs,cjs,ts,tsx}', 'vite.config.ts', 'vitest.config.ts'];

const sharedTypeLanguageOptions = {
    parser: tseslint.parser,
    parserOptions: {
        project: ['./tsconfig.eslint.json'],
        tsconfigRootDir: import.meta.dirname,
    },
};

const sharedReactPlugins = {
    react,
    'react-hooks': reactHooks,
    'react-refresh': reactRefresh,
    'jsx-a11y': jsxA11y,
    import: importPlugin,
    'no-secrets': noSecrets,
    prettier: prettierPlugin,
};

const importOrderRule = [
    'error',
    {
        groups: [['builtin', 'external'], ['internal', 'parent', 'sibling', 'index'], ['type']],
        pathGroups: [
            { pattern: '@/web/**', group: 'internal', position: 'before' },
            { pattern: '@/app/**', group: 'internal', position: 'before' },
        ],
        pathGroupsExcludedImportTypes: ['builtin'],
        'newlines-between': 'always',
        alphabetize: { order: 'asc', caseInsensitive: true },
    },
];

const noRestrictedImportsRule = ['error', { patterns: ['../*', '../../*', '../../../*', '../../../../*'] }];

export default [
    globalIgnores([
        'dist',
        'dist-electron',
        'release',
        'eslint.config.js',
        'prettier.config.js',
        'electron-builder.json5',
    ]),

    js.configs.recommended,

    ...[...tseslint.configs.recommendedTypeChecked, ...tseslint.configs.strictTypeChecked].map((config) => ({
        ...config,
        files: typeCheckedGlobs,
        languageOptions: {
            ...(config.languageOptions ?? {}),
            ...sharedTypeLanguageOptions,
            parserOptions: {
                ...(config.languageOptions?.parserOptions ?? {}),
                ...sharedTypeLanguageOptions.parserOptions,
            },
        },
    })),

    prettierConfig,

    {
        files: rendererGlobs,
        plugins: sharedReactPlugins,
        languageOptions: {
            ...sharedTypeLanguageOptions,
            ecmaVersion: 2023,
            sourceType: 'module',
            globals: globals.browser,
        },
        settings: {
            react: { version: 'detect' },
            'import/resolver': {
                typescript: { project: ['tsconfig.renderer.json'] },
                node: true,
            },
        },
        rules: {
            'react/jsx-no-useless-fragment': 'warn',
            'react/jsx-key': ['error', { checkFragmentShorthand: true }],
            'react/no-unstable-nested-components': 'warn',
            'react-refresh/only-export-components': 'warn',
            'import/order': importOrderRule,
            'import/newline-after-import': 'warn',
            'import/no-unresolved': 'off',
            'no-restricted-imports': noRestrictedImportsRule,
            'no-secrets/no-secrets': 'warn',
            'no-alert': 'error',
            'prettier/prettier': ['warn', { endOfLine: 'auto' }],
        },
    },

    {
        files: nodeGlobs,
        plugins: sharedReactPlugins,
        languageOptions: {
            ...sharedTypeLanguageOptions,
            ecmaVersion: 2023,
            sourceType: 'module',
            globals: globals.node,
        },
        settings: {
            'import/resolver': {
                typescript: { project: ['tsconfig.node.json'] },
                node: true,
            },
        },
        rules: {
            'import/order': importOrderRule,
            'import/newline-after-import': 'warn',
            'import/no-unresolved': 'off',
            'no-restricted-imports': noRestrictedImportsRule,
            'no-secrets/no-secrets': 'warn',
            'prettier/prettier': ['warn', { endOfLine: 'auto' }],
            'no-empty': 'off',
            'no-unused-vars': ['warn', { args: 'none', varsIgnorePattern: '^_', caughtErrors: 'none' }],
        },
    },
];
