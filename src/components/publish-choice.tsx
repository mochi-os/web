// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// Where one item also goes besides here: the user's accounts on other
// networks, shown as one line naming those chosen, which opens into a switch
// per account. The label is the app's, from its own catalogue, so this adds
// no string to every app's.
import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { useFormat } from '../hooks/use-format'
import { cn, naturalCompare } from '../lib/utils'
import { Switch } from './ui/switch'

export interface PublishChoiceAccount {
  id: string
  identifier: string
}

export function PublishChoice({
  label,
  accounts,
  selected,
  onChange,
}: {
  label: string
  accounts: PublishChoiceAccount[]
  selected: string[]
  onChange: (accounts: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const { formatList } = useFormat()
  if (accounts.length === 0) return null
  const sorted = [...accounts].sort((a, b) =>
    naturalCompare(a.identifier, b.identifier)
  )
  const chosen = sorted
    .filter((account) => selected.includes(account.id))
    .map((account) => account.identifier)
  return (
    <div className='space-y-2'>
      <button
        type='button'
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className='hover:bg-hover -mx-2 flex w-[calc(100%+1rem)] min-w-0 items-center gap-2 rounded-md px-2 py-1 text-start text-sm'
      >
        <span className='shrink-0 font-medium'>{label}</span>
        <span className='text-muted-foreground min-w-0 truncate'>
          {formatList(chosen)}
        </span>
        <ChevronDown
          className={cn(
            'ms-auto size-4 shrink-0 transition-transform',
            open && 'rotate-180'
          )}
        />
      </button>
      {open && (
        <div className='flex flex-wrap gap-3'>
          {sorted.map((account) => (
            <label key={account.id} className='flex items-center gap-2 text-sm'>
              <Switch
                checked={selected.includes(account.id)}
                aria-label={account.identifier}
                onCheckedChange={(on) =>
                  onChange(
                    on
                      ? [...selected, account.id]
                      : selected.filter((id) => id !== account.id)
                  )
                }
              />
              {account.identifier}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
