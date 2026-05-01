import React from 'react'
import { Trans } from '@lingui/react/macro'
import { useNavigate } from '@tanstack/react-router'
import { ArrowRight, ChevronRight } from 'lucide-react'
import { useSearch } from '../context/search-provider'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from './ui/command'
import { ScrollArea } from './ui/scroll-area'
import type { SidebarData } from './layout/types'
import { t } from '@lingui/core/macro'

interface CommandMenuProps {
  sidebarData: SidebarData
}

export function CommandMenu({ sidebarData }: CommandMenuProps) {
  const navigate = useNavigate()
  const { open, setOpen } = useSearch()

  const runCommand = React.useCallback(
    (command: () => unknown) => {
      setOpen(false)
      command()
    },
    [setOpen]
  )

  const navigateTo = React.useCallback(
    (url: string, external?: boolean) => {
      runCommand(() => {
        if (external) {
          window.location.href = url
        } else {
          navigate({ to: url })
        }
      })
    },
    [navigate, runCommand]
  )

  return (
    <CommandDialog modal open={open} onOpenChange={setOpen}>
      <CommandInput placeholder={t`Type a command or search...`} />
      <CommandList>
        <ScrollArea type='hover' className='h-72 pe-1'>
          <CommandEmpty><Trans>No results found.</Trans></CommandEmpty>
          {sidebarData.navGroups.map((group) => (
            <CommandGroup key={group.title} heading={group.title}>
              {group.items.map((navItem, i) => {
                // Handle action items (onClick)
                if ('onClick' in navItem && navItem.onClick) {
                  return (
                    <CommandItem
                      key={`action-${navItem.title}-${i}`}
                      value={navItem.title}
                      onSelect={() => runCommand(() => navItem.onClick())}
                    >
                      <div className='flex size-4 items-center justify-center'>
                        <ArrowRight className='text-muted-foreground/80 size-2 rtl:rotate-180' />
                      </div>
                      {navItem.title}
                    </CommandItem>
                  )
                }

                // Handle link items (url)
                if ('url' in navItem && navItem.url)
                  return (
                    <CommandItem
                      key={`${navItem.url}-${i}`}
                      value={navItem.title}
                      onSelect={() =>
                        navigateTo(navItem.url as string, 'external' in navItem ? navItem.external : undefined)
                      }
                    >
                      <div className='flex size-4 items-center justify-center'>
                        <ArrowRight className='text-muted-foreground/80 size-2 rtl:rotate-180' />
                      </div>
                      {navItem.title}
                    </CommandItem>
                  )

                // Handle collapsible items (items array)
                return ('items' in navItem ? navItem.items : [])?.map((subItem, i) => (
                  <CommandItem
                    key={`${navItem.title}-${subItem.url}-${i}`}
                    value={`${navItem.title}-${subItem.url}`}
                    onSelect={() =>
                      navigateTo(subItem.url as string, subItem.external)
                    }
                  >
                    <div className='flex size-4 items-center justify-center'>
                      <ArrowRight className='text-muted-foreground/80 size-2 rtl:rotate-180' />
                    </div>
                    {navItem.title} <ChevronRight className="rtl:rotate-180" /> {subItem.title}
                  </CommandItem>
                ))
              })}
            </CommandGroup>
          ))}
        </ScrollArea>
      </CommandList>
    </CommandDialog>
  )
}
