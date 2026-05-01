// Compact language picker for the login page and anonymous-chrome
// placements (Phase 1 Wave 3 step 10 of claude/plans/languages.md).
//
// Renders a globe-icon button that opens a popover containing the searchable
// list of installed catalogs (fetched once from /_/languages, identified by
// BCP 47 tag). Native names + English exonyms come from Intl.DisplayNames.
//
// On select, the choice is written to localStorage via setStoredLanguage and
// the page reloads so the I18nProvider picks up the new tag at boot. The
// settings preferences page uses a different code path (server-side
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
import { cn } from '../lib/utils'

type LanguageEntry = {
  tag: string
  native: string
  exonym: string
  display: string
}

function describeLanguages(tags: string[]): LanguageEntry[] {
  const out: LanguageEntry[] = []
  for (const tag of tags) {
    let native = tag
    let exonym = tag
    try {
      native = new Intl.DisplayNames([tag], { type: 'language' }).of(tag) ?? tag
      exonym = new Intl.DisplayNames(['en'], { type: 'language' }).of(tag) ?? tag
    } catch {
      /* fall back to raw tag */
    }
    out.push({
      tag,
      native,
      exonym,
      display: native === exonym ? native : `${native} - ${exonym}`,
    })
  }
  out.sort((a, b) => a.native.localeCompare(b.native))
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
  const entries = useMemo(() => describeLanguages(data?.languages ?? ['en']), [data])

  // Hide the picker when only English is installed — there's nothing to pick.
  if (entries.length <= 1) return null

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
                  value={`${entry.native} ${entry.exonym} ${entry.tag}`}
                  onSelect={() => handleSelect(entry.tag)}
                >
                  <span className='truncate'>{entry.display}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
