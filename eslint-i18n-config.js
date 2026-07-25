// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// Shared ESLint config for the lingui no-unlocalized-strings rule.
// Imported from each app's eslint.config.js so a single ignore list
// covers every Mochi web project.
//
// Set to 'error' so any new unwrapped UI string fails CI. The ignore
// patterns and ignoreNames lists below cover legitimate non-prose
// literals (CSS class strings, color values, font stacks, command
// payloads, etc.) — extend them when a true false-positive surfaces
// rather than reaching for `// eslint-disable-next-line`.

import pluginLingui from 'eslint-plugin-lingui'

export default {
  plugins: {
    lingui: pluginLingui,
  },
  rules: {
    'lingui/no-unlocalized-strings': [
      'error',
      {
        ignore: [
          // Single lowercase word — config keys, log tags, enum values
          '^(?![A-Z])\\S+$',
          // UPPERCASE constants
          '^[A-Z0-9_-]+$',
          // Brand name — intentionally never translated
          '^Mochi$',
          // Tailwind arbitrary-value class strings (`[&_h1]:text-3xl …`,
          // `[!important]`) used in `cn()`/className helpers and the
          // typography-class arrays in document-page renderers.
          '^\\[[&!]',
          // CSS color / dimension values: `oklch(…)`, `rgb(…)`, `hsl(…)`,
          // `var(…)`, hex colors (`#fff`, `#1e3a5f`), and pure numeric
          // values with units (`1rem`, `0.75rem`, `2.25rem`). These appear
          // in theme-preview-card.tsx and similar style-only literals.
          '^(?:oklch|rgb|rgba|hsl|hsla|var|calc|url)\\(',
          '^#[0-9a-fA-F]{3,8}$',
          '^[0-9]+(?:\\.[0-9]+)?(?:rem|em|px|vh|vw|%)$',
          // CSS font-family stacks — comma-separated token lists ending
          // in a generic family keyword. Captures both the explicit
          // `font_stacks` table in apps/settings and any inline stacks
          // passed to fontFamily-style props.
          '(?:sans-serif|serif|monospace|cursive|fantasy|system-ui)\\s*$',
        ],
        ignoreNames: [
          { regex: { pattern: 'className', flags: 'i' } },
          { regex: { pattern: '^[A-Z0-9_-]+$' } },
          // Variables holding a class string rather than prose:
          // `const toggleClass = isSent ? 'text-primary' : '…'`, and the
          // `*Classes` / `*ClassName` variants. The rule already exempts
          // the className *prop* and cn()/cva() arguments, but not the
          // intermediate variable, which is how conditional styling is
          // usually expressed.
          { regex: { pattern: 'class(es|name|names)?$', flags: 'i' } },
          'styleName',
          'src',
          'srcSet',
          'type',
          'id',
          'width',
          'height',
          'displayName',
          'Authorization',
          'data-testid',
          'role',
          'rel',
          'tabIndex',
          'autoComplete',
          'inputMode',
          'pattern',
          'fontFamily',
          // Shell-command props on settings/system status renderers and
          // similar admin/install hint widgets — the literal `sudo apt …`
          // text is the verbatim command the user copies, not UI prose.
          'command',
        ],
        ignoreFunctions: [
          // Class-name builders and styling utilities
          'cva',
          'cn',
          'clsx',
          'twMerge',
          // Standard browser/Node APIs
          'console.*',
          '*.addEventListener',
          '*.removeEventListener',
          '*.postMessage',
          '*.getElementById',
          '*.querySelector',
          '*.querySelectorAll',
          '*headers.set',
          '*.setAttribute',
          '*.getAttribute',
          // String/array methods that take literal arguments
          '*.includes',
          '*.indexOf',
          '*.endsWith',
          '*.startsWith',
          '*.split',
          '*.replace',
          '*.replaceAll',
          '*.match',
          // Other framework calls
          'require',
          'Error',
          'TypeError',
          'RangeError',
          // Mochi conventions
          'mochi.log.debug',
          'mochi.log.info',
          'mochi.log.warn',
          'mochi.log.error',
        ],
        // useTsTypes leverages TS type info to suppress false positives
        // (e.g. string args to Map/Set/Headers/URLSearchParams methods).
        // Apps whose eslint.config.js doesn't set parserOptions.project
        // for typed linting (login, possibly others) need to add it; the
        // rule errors loudly if the config doesn't support typed linting.
        useTsTypes: true,
        ignoreMethodsOnTypes: [
          'Map.get',
          'Map.has',
          'Map.set',
          'Map.delete',
          'Set.has',
          'Set.add',
          'Set.delete',
          'URLSearchParams.get',
          'URLSearchParams.set',
          'URLSearchParams.has',
          'URLSearchParams.delete',
          'URLSearchParams.append',
          'Headers.get',
          'Headers.set',
          'Headers.has',
          'Storage.getItem',
          'Storage.setItem',
          'Storage.removeItem',
        ],
      },
    ],
  },
}
