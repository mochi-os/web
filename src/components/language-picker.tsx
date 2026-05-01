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
import { Trans, useLingui } from '@lingui/react/macro'
import { useQuery } from '@tanstack/react-query'
import { Globe } from 'lucide-react'
import { Button } from './ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
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
}

function nativeName(tag: string): string {
  const override = displayNameOverrides[tag.toLowerCase()]
  if (override) return override
  let name = tag
  try {
    name = new Intl.DisplayNames([tag], { type: 'language' }).of(tag) ?? tag
  } catch {
    /* fall back to raw tag */
  }
  return capitalise(name)
}

function describeLanguages(tags: string[]): LanguageEntry[] {
  const out: LanguageEntry[] = tags.map((tag) => ({ tag, native: nativeName(tag) }))
  out.sort((a, b) => naturalCompare(a.native, b.native))
  return out
}

export function LanguagePicker({
  className,
  align = 'end',
}: {
  className?: string
  align?: 'start' | 'center' | 'end'
}) {
  const { t } = useLingui()
  const [open, setOpen] = useState(false)
  const { data } = useQuery<{ languages: string[] }>({
    queryKey: ['_', 'languages'],
    queryFn: () => fetch('/_/languages').then((r) => r.json()),
    staleTime: 5 * 60 * 1000,
  })
  const entries = useMemo(() => {
    const list = describeLanguages(data?.languages ?? ['en'])
    // "Auto" pinned to the top: prefix in the active UI language, suffixed
    // with the browser-detected language's native name in parentheses so the
    // user can see which language Auto would pick.
    const auto: LanguageEntry = {
      tag: 'auto',
      native: `${t`Detect from web browser`} (${nativeName(detectLanguage())})`,
    }
    return [auto, ...list]
  }, [data, t])

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
      <PopoverContent align={align} className='w-72 p-0'>
        <Command>
          <CommandInput placeholder={t`Search…`} />
          <CommandList>
            <CommandEmpty><Trans>No matches.</Trans></CommandEmpty>
            <CommandGroup>
              {entries.map((entry) => (
                <CommandItem
                  key={entry.tag}
                  value={`${entry.native} ${entry.tag}`}
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
