// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// An app's Lingui configuration: each app's lingui.config.js is a call to this,
// so the locales and their fallbacks are listed here alone.

export default function configuration() {
  return {
    sourceLocale: 'en',
    // prettier-ignore
    locales: ['en', 'en-us', 'fr', 'ja', 'ar', 'zh-hans', 'zh-hant', 'ko', 'id', 'th', 'tl', 'pt', 'pt-br', 'de', 'sv', 'nl', 'pl', 'he', 'it', 'hi', 'ur', 'vi', 'el', 'ru', 'uk', 'cs', 'hu', 'da', 'fi', 'nb', 'is', 'ms', 'es-419', 'es', 'nl-be', 'af', 'sw', 'yo', 'ha', 'am', 'zu', 'xh', 'bn', 'ta', 'te', 'mr', 'kn', 'ml', 'gu', 'pa', 'si', 'ne', 'tr', 'fa', 'ro', 'bg', 'hr', 'sr', 'sk', 'sl', 'ca', 'et', 'lv', 'lt', 'sq', 'be', 'mk', 'bs', 'yi', 'my', 'ps', 'kk', 'uz', 'az', 'km', 'lo', 'mn', 'cy', 'ga', 'gd', 'mt', 'eu', 'gl', 'tg', 'ky', 'tk', 'qu', 'ay', 'gn', 'ht', 'hy', 'ckb', 'ku', 'ka', 'fr-ca', 'zh-hk', 'de-ch', 'nn', 'en-ca', 'es-ar', 'jv', 'sd', 'bho', 'su', 'om', 'yue'],
    // `include` also covers lib/web so shared @mochi/web strings land in each
    // app's catalogues - there is no shared catalogue, so a new lib/web string
    // needs `pnpm i18n:extract` in every consuming app.
    catalogs: [
      {
        path: 'src/locales/{locale}/messages',
        include: ['src/**/*.{ts,tsx}', '../../../lib/web/src/**/*.{ts,tsx}'],
      },
    ],
    // Kept as written, every key quoted: claude/scripts/i18n_glossary.py reads
    // the pairs from this block.
    // prettier-ignore
    fallbackLocales: {
      'yue': 'zh-hk',
      'fr-ca': 'fr',
      'zh-hk': 'zh-hant',
      'es-ar': 'es-419',
      'de-ch': 'de',
      'en-ca': 'en',
      'en-us': 'en',
    },
    format: 'po',
    // Origins name the file only. With line numbers every edit that shifts a
    // line in lib/web rewrites all 106 catalogues in every app, and the CI
    // drift check fails on that alone.
    formatOptions: { origins: true, lineNumbers: false },
    compileNamespace: 'es',
  }
}
