// Shared ESLint config for the lingui no-unlocalized-strings rule.
// Imported from each app's eslint.config.js so a single ignore list
// covers every Mochi web project.
//
// Set to 'warn' (not 'error') so existing unwrapped strings are
// surfaced without breaking CI. Tighten to 'error' once the baseline
// is clean.

import pluginLingui from 'eslint-plugin-lingui'

export default {
  plugins: {
    lingui: pluginLingui,
  },
  rules: {
    'lingui/no-unlocalized-strings': [
      'warn',
      {
        ignore: [
          // Single lowercase word — config keys, log tags, enum values
          '^(?![A-Z])\\S+$',
          // UPPERCASE constants
          '^[A-Z0-9_-]+$',
          // Brand name — intentionally never translated
          '^Mochi$',
        ],
        ignoreNames: [
          { regex: { pattern: 'className', flags: 'i' } },
          { regex: { pattern: '^[A-Z0-9_-]+$' } },
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
          'tabIndex',
          'autoComplete',
          'inputMode',
          'pattern',
          'fontFamily',
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
