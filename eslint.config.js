// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { fileURLToPath } from 'url'
import { dirname } from 'path'
import globals from 'globals'
import js from '@eslint/js'
import pluginQuery from '@tanstack/eslint-plugin-query'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig } from 'eslint/config'
import tseslint from 'typescript-eslint'
import i18nConfig from './eslint-i18n-config.js'
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export default defineConfig(
  { ignores: ['dist', 'coverage'] },
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
        project: ['./tsconfig.json', './tsconfig.eslint.json'],
        tsconfigRootDir: __dirname,
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
      'no-console': 'warn',
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
        'warn',
        {
          prefer: 'type-imports',
          fixStyle: 'inline-type-imports',
          disallowTypeAnnotations: false,
        },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/triple-slash-reference': 'warn',
      '@tanstack/query/exhaustive-deps': 'warn',
      'no-duplicate-imports': 'error',
    },
  },
  // All 23 apps import eslint-i18n-config.js; lib/web shipped without it, so
  // the component library every app renders was the one place the lingui rule
  // never ran. That is how five error pages reached production as untranslated
  // English paragraphs.
  //
  // Enabled at 'warn' rather than the shared config's 'error' because turning
  // it on surfaces 420 pre-existing violations, a real backlog that has to be
  // triaged string by string (`sonnerToast.error('Failed to copy')` is genuine;
  // much of the rest is attribute and config noise). Same staged approach the
  // Android i18n gates took. Flip to 'error' once the backlog is cleared; the
  // JSX-text subset is already at zero and is held there by
  // claude/scripts/check-jsx-text.mjs.
  {
    // Tests are excluded: their strings are fixtures and `it(...)`
    // descriptions, never rendered. They accounted for 75 of the 420
    // violations found when the rule was first switched on.
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/**/*.test.{ts,tsx}', 'src/**/*.spec.{ts,tsx}'],
    // At 'error', the same as every app. Enabling the rule here first surfaced
    // 420 violations; those were cleared by teaching the shared ignore lists
    // about the non-prose classes, deleting a dead duplicate label table, and
    // wrapping the genuine prose - every string of which is now translated into
    // all 98 full locales.
    ...i18nConfig,
  },
  {
    // Language endonyms must NOT be translated - a language picker that
    // renders "Spanish" instead of "Español" to a Spanish speaker is useless,
    // and the whole point of the table is that each entry is written in its
    // own language.
    files: ['src/components/language-picker.tsx'],
    rules: { 'lingui/no-unlocalized-strings': 'off' },
  },
  {
    // The shell bridge's microphone plumbing throws MicSessionError objects
    // whose `message` is a developer diagnostic. Consumers switch on the error
    // `name` and supply their own translated text - see apps/chat's chat-input,
    // which maps NotAllowedError, NotReadableError, EmptyRecordingError and the
    // rest to t`` toasts. The message string is never rendered, so wrapping it
    // would add ~24 msgids to every locale that nobody will ever read.
    files: ['src/lib/shell-mic-session.ts', 'src/lib/shell-bridge.ts'],
    rules: { 'lingui/no-unlocalized-strings': 'off' },
  }
);
