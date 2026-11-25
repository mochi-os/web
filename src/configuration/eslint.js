// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// An app's ESLint configuration: each app's eslint.config.js is a call to this
// with what is its own.

import js from '@eslint/js'
import pluginQuery from '@tanstack/eslint-plugin-query'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig } from 'eslint/config'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import i18n from '../../eslint-i18n-config.js'

/**
 * @param {object} options
 * @param {string} options.directory The app's web directory, which holds the
 *   tsconfig files typed linting reads.
 * @param {string[]} [options.ignores] Paths not linted, besides dist, coverage
 *   and the generated UI components.
 * @param {string[]} [options.strings] Patterns of literal strings the
 *   translation rule passes, besides the shared ones.
 * @param {string[]} [options.functions] Calls whose string arguments the
 *   translation rule passes, besides the shared ones.
 * @param {...object} blocks The app's own configuration objects, applied after
 *   the shared ones.
 */
export default function configuration(
  { directory, ignores = [], strings = [], functions = [] },
  ...blocks
) {
  const unlocalized = i18n.rules['lingui/no-unlocalized-strings'][1]
  return defineConfig(
    { ignores: ['dist', 'coverage', 'src/components/ui', ...ignores] },
    {
      extends: [
        js.configs.recommended,
        ...tseslint.configs.recommended,
        ...pluginQuery.configs['flat/recommended'],
      ],
      files: ['**/*.{ts,tsx}'],
      languageOptions: {
        ecmaVersion: 2020,
        globals: globals.browser,
        parserOptions: {
          project: [
            './tsconfig.app.json',
            './tsconfig.node.json',
            './tsconfig.eslint.json',
          ],
          tsconfigRootDir: directory,
        },
      },
      plugins: {
        'react-hooks': reactHooks,
        'react-refresh': reactRefresh,
      },
      rules: {
        ...reactHooks.configs.recommended.rules,
        'react-refresh/only-export-components': [
          'warn',
          { allowConstantExport: true },
        ],
        'no-console': 'error',
        'no-unused-vars': 'off',
        '@typescript-eslint/no-unused-vars': [
          'error',
          {
            args: 'all',
            argsIgnorePattern: '^_',
            caughtErrors: 'all',
            caughtErrorsIgnorePattern: '^_',
            destructuredArrayIgnorePattern: '^_',
            varsIgnorePattern: '^_',
            ignoreRestSiblings: true,
          },
        ],
        '@typescript-eslint/consistent-type-imports': [
          'error',
          {
            prefer: 'type-imports',
            fixStyle: 'inline-type-imports',
            disallowTypeAnnotations: false,
          },
        ],
        'no-duplicate-imports': 'error',
        // toast and Toaster come wrapped from @mochi/web.
        'no-restricted-imports': [
          'error',
          {
            paths: [
              {
                name: 'sonner',
                message: "Import toast/Toaster from '@mochi/web' instead.",
              },
            ],
          },
        ],
      },
    },
    {
      files: [
        'src/routes/**/*.{ts,tsx}',
        'src/context/**/*.{ts,tsx}',
        'src/test/**/*.{ts,tsx}',
      ],
      rules: {
        'react-refresh/only-export-components': 'off',
      },
    },
    {
      files: ['**/*.{ts,tsx}'],
      // Tests are excluded, as in lib/web: their strings are fixtures and
      // it() descriptions, never rendered.
      ignores: ['src/**/*.test.{ts,tsx}', 'src/**/*.spec.{ts,tsx}'],
      ...i18n,
      rules: {
        ...i18n.rules,
        'lingui/no-unlocalized-strings': [
          'error',
          {
            ...unlocalized,
            ignore: [...unlocalized.ignore, ...strings],
            ignoreFunctions: [...unlocalized.ignoreFunctions, ...functions],
          },
        ],
      },
    },
    ...blocks
  )
}
