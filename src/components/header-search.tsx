// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { useState } from 'react'
import { Search, X } from 'lucide-react'
import { cn } from '../lib/utils'
import { IconButton } from './icon-button'
import { Input } from './ui/input'
import { t } from '@lingui/core/macro'

interface HeaderSearchProps {
  value: string
  onValueChange: (value: string) => void
  placeholder: string
  label?: string
}

export function HeaderSearch({
  value,
  onValueChange,
  placeholder,
  label = 'Search',
}: HeaderSearchProps) {
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false)
  const showMobileSearch = isMobileSearchOpen || value.trim().length > 0

  const closeMobileSearch = () => {
    onValueChange('')
    setIsMobileSearchOpen(false)
  }

  return (
    <div className='flex min-w-0 items-center gap-1.5'>
      <Input
        type='search'
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        className='hidden h-9 w-56 md:block'
      />

      {showMobileSearch ? (
        <div className='flex min-w-0 items-center gap-1.5 md:hidden'>
          <Input
            type='search'
            aria-label={label}
            placeholder={placeholder}
            value={value}
            onChange={(event) => onValueChange(event.target.value)}
            className='h-9 w-32 text-sm'
          />
          <IconButton
            label={t`Close search`}
            variant='ghost'
            className={cn('size-9', !value && 'text-muted-foreground')}
            onClick={closeMobileSearch}
          >
            <X className='size-4' />
          </IconButton>
        </div>
      ) : (
        <IconButton
          label={label}
          variant='ghost'
          className='size-9 md:hidden'
          onClick={() => setIsMobileSearchOpen(true)}
        >
          <Search className='size-4' />
        </IconButton>
      )}
    </div>
  )
}
