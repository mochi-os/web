// Copyright © 2026 Mochi OÜ
// SPDX-License-Identifier: Apache-2.0

// Compact language picker for the login page and anonymous-chrome
// placements (Phase 1 Wave 3 step 10 of claude/plans/languages.md).
//
// Renders a globe-icon button that opens a popover containing the searchable
// list of installed catalogs (fetched once from /_/languages, identified by
// BCP 47 tag), plus an "Auto (detect from browser)" entry pinned at the top.
// Native names come from Intl.DisplayNames.
//
// On select, the choice is written to localStorage via setStoredLanguage (also
// mirrored to a mochi_language cookie so the server-side resolver honours it
// post-login) and the page reloads so the I18nProvider picks up the new tag
// at boot. Picking "auto" stores the literal string "auto"; both the client
// and server treat it as fall-through to navigator.language / Accept-Language.
//
// The settings preferences page uses a different code path (server-side
// preference + shellSetLanguage broadcast) and does NOT use this component.
import { useMemo, useState } from 'react'
import { useLingui } from '@lingui/react/macro'
import { useQuery } from '@tanstack/react-query'
import { Globe } from 'lucide-react'
import { Button } from './ui/button'
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
} from './ui/command'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'
import { setStoredLanguage } from '../context/i18n-provider'
import { detectLanguage } from '../context/locale-provider'
import { cn, naturalCompare } from '../lib/utils'

type LanguageEntry = {
  tag: string
  native: string
}

function capitalise(s: string): string {
  if (!s) return s
  // Use the first character's locale-aware uppercase, then keep the rest.
  return s.charAt(0).toLocaleUpperCase() + s.slice(1)
}

// Explicit display-name overrides. Keyed by lower-cased BCP 47 tag.
// Used when Intl.DisplayNames would return a name that doesn't match Mochi's
// chosen wording (e.g. en-us → "American English") or that doesn't sort
// alongside its parent language in the picker.
//
// `en` is overridden because Mochi's source `en` catalog uses neutral English
// (per CLAUDE.md), not UK or US English; "English (international)" reads
// honestly and treats US English as a sibling localisation, not a deviation
// from "real" English.
const displayNameOverrides: Record<string, string> = {
  'en': 'English (international)',
  'en-us': 'English (USA)',
  'es': 'Español (España)',
  'es-419': 'Español (latinoamericano)',
  // Tags with no CLDR data — Intl.DisplayNames falls back to en-GB and
  // returns the English exonym instead of the native autonym. The picker
  // would otherwise show "Aymara"/"Guarani"/"Haitian Creole" instead of the
  // self-name. Date and number formatting for these locales also fall back
  // to en-GB at runtime; we accept that for now (Latin-script anyway) and
  // only fix the picker label.
  'ay': 'Aymar aru',
  'gn': "Avañe'ẽ",
  'ht': 'Kreyòl ayisyen',
}

// Native autonyms keyed by lower-cased BCP 47 tag. Browsers ship
// Intl.DisplayNames data for only a subset of display locales, so
// `new Intl.DisplayNames([tag]).of(tag)` falls back to the runtime default
// (usually the English exonym) for the many less-common locales. This table
// gives the correct self-name from CLDR so the picker reads in each
// language's own script regardless of the browser's ICU coverage. Values are
// final display strings — capitalisation is baked in, so they are NOT passed
// through `capitalise` (which would corrupt caseless scripts, e.g. mapping
// Georgian Mkhedruli to Asomtavruli). Keys overridden in
// `displayNameOverrides` are omitted there; the override wins.
const nativeNames: Record<string, string> = {
  'af': 'Afrikaans',
  'am': 'አማርኛ',
  'ar': 'العربية',
  'az': 'Azərbaycan',
  'be': 'Беларуская',
  'bg': 'Български',
  'bho': 'भोजपुरी',
  'bn': 'বাংলা',
  'bs': 'Bosanski',
  'ca': 'Català',
  'ckb': 'کوردیی ناوەندی',
  'cs': 'Čeština',
  'cy': 'Cymraeg',
  'da': 'Dansk',
  'de': 'Deutsch',
  'de-ch': 'Schweizer Hochdeutsch',
  'el': 'Ελληνικά',
  'es-ar': 'Español (Argentina)',
  'et': 'Eesti',
  'eu': 'Euskara',
  'fa': 'فارسی',
  'fi': 'Suomi',
  'fr': 'Français',
  'fr-ca': 'Français canadien',
  'ga': 'Gaeilge',
  'gd': 'Gàidhlig',
  'gl': 'Galego',
  'gu': 'ગુજરાતી',
  'ha': 'Hausa',
  'he': 'עברית',
  'hi': 'हिन्दी',
  'hr': 'Hrvatski',
  'hu': 'Magyar',
  'hy': 'Հայերեն',
  'id': 'Bahasa Indonesia',
  'is': 'Íslenska',
  'it': 'Italiano',
  'ja': '日本語',
  'jv': 'Jawa',
  'ka': 'ქართული',
  'kk': 'Қазақ тілі',
  'km': 'ខ្មែរ',
  'kn': 'ಕನ್ನಡ',
  'ko': '한국어',
  'ku': 'Kurdî (kurmancî)',
  'ky': 'Кыргызча',
  'lo': 'ລາວ',
  'lt': 'Lietuvių',
  'lv': 'Latviešu',
  'mk': 'Македонски',
  'ml': 'മലയാളം',
  'mn': 'Монгол',
  'mr': 'मराठी',
  'ms': 'Melayu',
  'mt': 'Malti',
  'my': 'မြန်မာ',
  'nb': 'Norsk bokmål',
  'ne': 'नेपाली',
  'nl': 'Nederlands',
  'nl-be': 'Vlaams',
  'nn': 'Norsk nynorsk',
  'om': 'Oromoo',
  'pa': 'ਪੰਜਾਬੀ',
  'pl': 'Polski',
  'ps': 'پښتو',
  'pt': 'Português',
  'pt-br': 'Português (Brasil)',
  'qu': 'Runasimi',
  'ro': 'Română',
  'ru': 'Русский',
  'sd': 'سنڌي',
  'si': 'සිංහල',
  'sk': 'Slovenčina',
  'sl': 'Slovenščina',
  'sq': 'Shqip',
  'sr': 'Српски',
  'su': 'Basa Sunda',
  'sv': 'Svenska',
  'sw': 'Kiswahili',
  'ta': 'தமிழ்',
  'te': 'తెలుగు',
  'tg': 'Тоҷикӣ',
  'th': 'ไทย',
  'tk': 'Türkmen dili',
  'tl': 'Filipino',
  'tr': 'Türkçe',
  'uk': 'Українська',
  'ur': 'اردو',
  'uz': 'O‘zbek',
  'vi': 'Tiếng Việt',
  'xh': 'IsiXhosa',
  'yi': 'ייִדיש',
  'yo': 'Èdè Yorùbá',
  'yue': '粵語',
  'zh-hans': '简体中文',
  'zh-hant': '繁體中文',
  'zh-hk': '繁體中文（香港）',
  'zu': 'IsiZulu',
}

// resolveInstalled walks the parent chain of `tag` and returns the closest
// match in `installed`. Mirrors the server-side resolver's fallback chain so
// the Auto entry's display name reflects the catalog the user will actually
// load — e.g. an `en-gb` browser falls through to `en` and shows the override
// "English (international)" rather than the Intl.DisplayNames default
// "British English". Returns the tag unchanged if nothing matches.
function resolveInstalled(tag: string, installed: Set<string>): string {
  let t = tag.toLowerCase()
  while (t !== '') {
    if (installed.has(t)) return t
    const i = t.lastIndexOf('-')
    if (i < 0) break
    t = t.slice(0, i)
  }
  return tag
}

// Each installed language renders as its native exonym so users recognise
// their own language by sight (Français, 日本語). For the Auto entry's
// descriptive parenthetical the caller passes the active UI locale so the
// detected language reads in the user's UI language instead.
function nativeName(tag: string, displayLocale?: string): string {
  const override = displayNameOverrides[tag.toLowerCase()]
  if (override) return override
  // No explicit display locale means the caller wants the language's own
  // autonym (the list entries). Prefer the static table — the browser's
  // Intl.DisplayNames lacks data for most display locales and would return
  // the English exonym. With a display locale set (the Auto entry, which
  // shows the detected language in the active UI locale) we must use Intl.
  if (!displayLocale) {
    const auto = nativeNames[tag.toLowerCase()]
    if (auto) return auto
  }
  let name = tag
  try {
    name = new Intl.DisplayNames([displayLocale ?? tag], { type: 'language' }).of(tag) ?? tag
  } catch {
    /* fall back to raw tag */
  }
  return capitalise(name)
}

// Sort priority: 0 = Latin-script natives (English, Français, Deutsch, …),
// 1 = non-Latin-script natives (العربية, 日本語, 한국어, עברית, …). Within each
// bucket, naturalCompare sorts by the displayed native name. Putting Latin
// first means English-speaking and most European users find their language
// near the top; non-Latin readers find theirs grouped together below.
function scriptBucket(native: string): number {
  // Find the first letter (skip leading spaces, parens, punctuation).
  for (const ch of native) {
    if (/\p{L}/u.test(ch)) {
      return /[A-Za-zÀ-ÿĀ-ſƀ-ɏ]/.test(ch) ? 0 : 1
    }
  }
  return 0
}

function describeLanguages(tags: string[]): LanguageEntry[] {
  const out: LanguageEntry[] = tags.map((tag) => ({ tag, native: nativeName(tag) }))
  out.sort((a, b) => {
    const ba = scriptBucket(a.native)
    const bb = scriptBucket(b.native)
    if (ba !== bb) return ba - bb
    return naturalCompare(a.native, b.native)
  })
  return out
}

export function LanguagePicker({
  className,
  align = 'end',
}: {
  className?: string
  align?: 'start' | 'center' | 'end'
}) {
  const { t, i18n } = useLingui()
  const [open, setOpen] = useState(false)
  const { data } = useQuery<{ languages: string[] }>({
    queryKey: ['_', 'languages'],
    queryFn: () => fetch('/_/languages').then((r) => r.json()),
    staleTime: 5 * 60 * 1000,
  })
  const entries = useMemo(() => {
    const list = describeLanguages(data?.languages ?? ['en'])
    // "Auto" pinned to the top. The suffix shows the catalog the user will
    // actually load — we walk the detected tag through the installed-locale
    // fallback chain (mirroring the server-side resolver) so an en-gb
    // browser shows "English (international)" rather than "British English".
    const installed = new Set((data?.languages ?? ['en']).map((s) => s.toLowerCase()))
    const resolved = resolveInstalled(detectLanguage(), installed)
    const auto: LanguageEntry = {
      tag: 'auto',
      native: `${t`Detect from web browser`}: ${nativeName(resolved, i18n.locale)}`,
    }
    return [auto, ...list]
  }, [data, t, i18n.locale])

  // Hide the picker when only English is installed — there's nothing real to
  // pick (Auto + English alone gives no choice). Phase 2 catalogs reveal it.
  if (entries.length <= 2) return null

  const handleSelect = (tag: string) => {
    setStoredLanguage(tag)
    setOpen(false)
    // Reload so the I18nProvider picks up the new tag at boot.
    window.location.reload()
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant='outline'
          size='icon'
          aria-label={t`Choose language`}
          className={cn('size-9', className)}
        >
          <Globe className='size-4' />
        </Button>
      </PopoverTrigger>
      <PopoverContent align={align} className='w-[22rem] p-0'>
        <Command>
          <CommandList className='max-h-[60vh]'>
            <CommandGroup>
              {entries.map((entry) => (
                <CommandItem
                  key={entry.tag}
                  value={entry.tag}
                  onSelect={() => handleSelect(entry.tag)}
                >
                  <span className='truncate'>{entry.native}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
