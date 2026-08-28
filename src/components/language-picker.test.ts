// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest'
import { nativeName, describeLanguages } from './language-picker'

// Measured with node's full-icu build: these three resolve their display
// locale to en-GB, so Intl answers with the English exonym. Browsers ship
// less CLDR data than node, so this set is a floor, not a ceiling - which is
// why the static table is consulted first rather than as a fallback.
const NO_CLDR_DATA = [
  ['ay', 'Aymar aru'],
  ['gn', "Avañe'ẽ"],
  ['ht', 'Kreyòl ayisyen'],
] as const

describe('nativeName', () => {
  it.each(NO_CLDR_DATA)('gives %s its autonym where Intl gives the English exonym', (tag, autonym) => {
    expect(nativeName(tag)).toBe(autonym)
    // The reason the table exists: Intl alone would answer in English here.
    expect(new Intl.DisplayNames([tag], { type: 'language' }).of(tag)).not.toBe(autonym) // i18n-format-ok: the assertion IS that bare Intl is wrong here
  })

  it('keeps Mochi wording where it differs from CLDR', () => {
    // `en` is neutral English, not UK or US, and the Spanish pair names its
    // region. Anything reading these must not drift back to Intl's wording.
    expect(nativeName('en')).toBe('English (international)')
    expect(nativeName('en-us')).toBe('English (USA)')
    expect(nativeName('es')).toBe('Español (España)')
    expect(nativeName('es-419')).toBe('Español (latinoamericano)')
  })

  it('prefers the table where Intl has data but words it worse', () => {
    expect(nativeName('id')).toBe('Bahasa Indonesia')
    expect(nativeName('zh-hk')).toBe('繁體中文（香港）')
  })

  it('renders in the requested locale when one is given', () => {
    // The Auto row describes what Auto would pick, so it reads in the UI
    // language rather than the named language's own script.
    expect(nativeName('ja', 'fr')).toBe('Japonais')
    expect(nativeName('ja')).toBe('日本語')
  })

  it('falls back to the capitalised tag rather than throwing on a malformed one', () => {
    // Intl throws on a bad tag; the catch hands the raw tag to capitalise().
    expect(nativeName('not a tag')).toBe('Not a tag')
  })
})

describe('describeLanguages', () => {
  it('returns every tag it was given', () => {
    const tags = ['ja', 'en', 'ar', 'fr', 'ay']
    expect(describeLanguages(tags).map((e) => e.tag).sort()).toEqual([...tags].sort())
  })

  it('puts Latin-script names before the rest', () => {
    const entries = describeLanguages(['ja', 'ar', 'fr', 'en', 'he'])
    const natives = entries.map((e) => e.native)
    const lastLatin = Math.max(natives.indexOf('Français'), natives.indexOf('English (international)'))
    const firstOther = Math.min(natives.indexOf('日本語'), natives.indexOf('العربية'))
    expect(lastLatin).toBeLessThan(firstOther)
  })

  it('carries the autonym, not the exonym, for the no-CLDR locales', () => {
    const entry = describeLanguages(['ay']).find((e) => e.tag === 'ay')
    expect(entry?.native).toBe('Aymar aru')
  })
})
