// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// Shared ESLint config for the lingui no-unlocalized-strings rule, imported by
// every app's eslint.config.js. At 'error', so a new unwrapped UI string fails
// CI. Extend the ignore lists below when a genuine false positive surfaces,
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
          // Brand and product names - never translated. Keep in step with BRAND
          // in claude/scripts/i18n_glossary.py; the extras here are third-party
          // products Mochi names in provider and browser tables.
          '^(?:Mochi|Mochi OS|GitHub|Stripe|Pushbullet|ntfy|libp2p|JWT|OAuth|OIDC|PKCE|SAML)$',
          // Browser names, returned by user-agent sniffing as an identifier.
          '^Browser$',
          // Internal reason strings and diagnostic source labels: recorded
          // against a forced logout or attached to a normalised error for
          // debugging, never rendered.
          '^Session expired$',
          '^error\\.message',
          '^(?:Google|Microsoft|Facebook|Apple|Claude|OpenAI|Anthropic|Gemini|Ollama)$',
          '^(?:Firefox|Chrome|Safari|Edge|Opera|Chromium)$',
          // Error class names assigned to `name`, not shown to anyone.
          '^[A-Z][A-Za-z0-9]*Error$',
          // ISO date/time fragments concatenated onto a date string.
          '^T?\\d{2}:\\d{2}(?::\\d{2})?(?:Z|[+-]\\d{2}:\\d{2})?$',
          // Attribution markup required verbatim by the tile provider licence.
          '^©\\s',
          // Tailwind arbitrary-value class strings (`[&_h1]:text-3xl …`,
          // `[!important]`) used in `cn()`/className helpers and the
          // typography-class arrays in document-page renderers.
          '^\\[[&!]',
          // CSS colour and dimension values: oklch(), rgb(), hsl(), var(), hex
          // colours, numbers with units, and the gradient and color-mix
          // functions the theme resolver builds `--background-image` from.
          '^(?:oklch|rgb|rgba|hsl|hsla|var|calc|url|color-mix|(?:repeating-)?(?:linear|radial|conic)-gradient)\\(',
          '^#[0-9a-fA-F]{3,8}$',
          '^[0-9]+(?:\\.[0-9]+)?(?:rem|em|px|vh|vw|%)$',
          // CSS positional keywords, alone or as a pair (`top center` for
          // `background-position`). Confined to the six box keywords so
          // ordinary prose cannot match.
          '^(?:top|bottom|center|left|right|middle)(?:\\s+(?:top|bottom|center|left|right|middle))?$',
          // CSS font-family stacks — comma-separated token lists ending
          // in a generic family keyword. Captures both the explicit
          // `font_stacks` table in apps/settings and any inline stacks
          // passed to fontFamily-style props.
          '(?:sans-serif|serif|monospace|cursive|fantasy|system-ui)\\s*$',
          // React directives. `'use client'` is a directive prologue, not a
          // string the user ever sees.
          '^use (?:client|server|strict)$',
          // Tailwind utility strings outside a className prop - object values
          // and early returns in class-picking helpers. Recognised by a variant
          // colon or a known utility prefix, which prose never carries.
          '^(?:[a-z0-9-]+[:/])?(?:md|sm|lg|xl|dark|group|hover|focus|peer|data|rtl|ltr|max|min|w|h|p|m|bg|text|border|flex|grid|gap|space|shrink|grow|opacity|rounded|font|items|justify|absolute|relative|fixed|sticky|pointer|transition|overflow|cursor|select|whitespace|truncate|z|top|bottom|left|right|inset|size|aspect|leading|tracking|shadow|ring|animate|duration|delay|ease|scale|translate|rotate)[-:[]',
          // Cookie serialisations built inline: `name=value; path=/; max-age=…`.
          '(?:;\\s*(?:path|max-age|domain|samesite|secure|expires)=)',
          // Bare CSS lengths and length pairs assigned to style properties
          // (`attrib.style.padding = "0 4px"`).
          '^\\d+(?:\\.\\d+)?(?:px|rem|em|%|vh|vw)?(?:\\s+\\d+(?:\\.\\d+)?(?:px|rem|em|%|vh|vw)?)*$',
          // Date and time format patterns: `DD/MM/YYYY`, `D MMM YYYY`, `HH:mm`.
          // Only format letters, separators and spaces, so prose can't match.
          '^[DMYHhmsAaZz][DMYHhmsAaZz0-9/.:,\\- ]*$',
          // Inline SVG markup passed to map markers and icon helpers.
          '^<svg\\b',
          // CSS media queries and selector strings handed to matchMedia,
          // querySelector and closest.
          '^\\(prefers-|^\\[role=|^\\[data-',
          // HTTP mechanics: header names, auth scheme prefixes, MIME types.
          '^(?:Bearer|Basic) ?$',
          '^Content-(?:Type|Disposition|Length)$',
          '^(?:application|text|image|audio|video|multipart)/',
          // DOM exception names, thrown as the `name` argument rather than
          // shown to anyone.
          '^(?:NotAllowedError|NotSupportedError|AbortError|SecurityError|InvalidStateError|NetworkError|TimeoutError|DataError)$',
        ],
        ignoreNames: [
          { regex: { pattern: 'className', flags: 'i' } },
          { regex: { pattern: '^[A-Z0-9_-]+$' } },
          // Variables holding a class string rather than prose (`toggleClass`,
          // `*Classes`, `*ClassName`). The rule exempts the className prop and
          // cn()/cva() arguments, but not the intermediate variable.
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
          // Developer-facing logging. These strings go to the console for
          // whoever is debugging, never to a user, and are deliberately in
          // English so they match the source.
          'logDevError',
          'logDevWarn',
          '*devConsole.log',
          '*devConsole.warn',
          '*devConsole.error',
          // Exception constructors. The message is for a developer or is a
          // DOM error name; Error/TypeError/RangeError are already listed.
          'DOMException',
          'webauthnFailure',
          // React context accessors take the calling component's name so the
          // "used outside its provider" throw can say who did it.
          '*useActionPillContext',
          '*Context',
          // Internal reason strings recorded against a forced logout, not
          // rendered anywhere.
          '*authManager.logout',
          '*.logout',
          // Mochi conventions
          'mochi.log.debug',
          'mochi.log.info',
          'mochi.log.warn',
          'mochi.log.error',
        ],
        // Uses TS type info to suppress false positives (string arguments to
        // Map/Set/Headers methods). An app's eslint.config.js must set
        // parserOptions.project for typed linting or the rule errors loudly.
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
