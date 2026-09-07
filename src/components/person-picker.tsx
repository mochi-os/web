// Mochi: Person picker component for selecting users/people
// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

'use client'

import { useState, useEffect, useMemo } from 'react'
import { Trans } from '@lingui/react/macro'
import { useQuery } from '@tanstack/react-query'
import { Search, Loader2, X, Check } from 'lucide-react'
import { Button } from './ui/button'
import { EntityAvatar } from './entity-avatar'
import { Input } from './ui/input'
import { Checkbox } from './ui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'
import { cn } from '../lib/utils'
import { plural, t } from '@lingui/core/macro'

export interface Person {
  id: string
  name: string
  fingerprint?: string
}

// Module-level cache for selected people's info (persists across component remounts)
const selectedPeopleGlobalCache = new Map<string, Person>()

export interface PersonPickerProps {
  /** Selection mode - single or multiple */
  mode: 'single' | 'multiple'
  /** Currently selected person ID(s) */
  value: string | string[]
  /** Callback when selection changes */
  onChange: (value: string | string[]) => void
  /** People the caller already knows: friends, members, participants. */
  local?: Person[]
  /** Group heading for `local` when it is shown beside fetched people. */
  localLabel?: string
  /** Searches the directory through the caller's own app. Omit to search
   *  only `local`. */
  directoryFn?: (query: string) => Promise<Person[]>
  /** Loads friends through the caller's own app. Omit to show only `local`. */
  friendsFn?: () => Promise<Person[]>
  /** A person's avatar or accent style, served by the caller's own app. Omit
   *  to show initials: the people app cannot be fetched from inside the shell. */
  assetUrl?: (person: Person, asset: 'avatar' | 'style') => string
  /** Placeholder text */
  placeholder?: string
  /** Empty state message */
  emptyMessage?: string
  /** Whether the picker is disabled */
  disabled?: boolean
  /** Additional CSS classes */
  className?: string
  /** Controlled open state */
  open?: boolean
  /** Callback when open state changes */
  onOpenChange?: (open: boolean) => void
}

export function PersonPicker({
  mode,
  value,
  onChange,
  local = [],
  localLabel,
  directoryFn,
  friendsFn,
  assetUrl,
  placeholder = t`Select person...`,
  emptyMessage = t`No people found`,
  disabled = false,
  className,
  open: controlledOpen,
  onOpenChange,
}: PersonPickerProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const open = controlledOpen ?? internalOpen
  const setOpen = onOpenChange ?? setInternalOpen
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  // Force re-render when global cache updates
  const [cacheVersion, setCacheVersion] = useState(0)

  // Normalize value to array for internal use
  const selectedIds = useMemo(() => {
    if (mode === 'single') {
      return value ? [value as string] : []
    }
    return (value as string[]) || []
  }, [mode, value])

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Clear search when popover closes
  useEffect(() => {
    if (!open) {
      setSearchQuery('')
      setDebouncedSearch('')
    }
  }, [open])

  // Both fetchers go through the caller's own app: a request to the people
  // app from inside the shell's sandboxed iframe carries no cookies and is
  // refused, so there is no default to fall back to. The loaders are the
  // app's fixed functions, not query inputs.
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  const { data: friendsData, isLoading: isLoadingFriends } = useQuery({
    queryKey: ['person-picker', 'friends'],
    queryFn: () => (friendsFn ? friendsFn() : Promise.resolve([])),
    enabled: !!friendsFn && open,
    staleTime: 60000, // Cache for 1 minute
  })

  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  const { data: directoryData, isLoading: isLoadingDirectory } = useQuery({
    queryKey: ['person-picker', 'directory', debouncedSearch],
    queryFn: () => (directoryFn ? directoryFn(debouncedSearch) : Promise.resolve([])),
    enabled: !!directoryFn && debouncedSearch.length >= 2 && open,
  })

  // Combine and deduplicate all people sources
  const allPeople = useMemo(() => {
    const peopleMap = new Map<string, Person>()

    // Add local people first (highest priority)
    for (const person of local) {
      peopleMap.set(person.id, person)
    }

    // Add friends
    if (friendsData) {
      for (const friend of friendsData) {
        if (!peopleMap.has(friend.id)) {
          peopleMap.set(friend.id, friend)
        }
      }
    }

    // Add directory results
    if (directoryData) {
      for (const person of directoryData) {
        if (!peopleMap.has(person.id)) {
          peopleMap.set(person.id, person)
        }
      }
    }

    return Array.from(peopleMap.values())
  }, [local, friendsData, directoryData])

  // Filter people based on search query
  const filteredPeople = useMemo(() => {
    if (!searchQuery.trim()) {
      return allPeople
    }
    const query = searchQuery.toLowerCase()
    return allPeople.filter(
      (person) =>
        person.name.toLowerCase().includes(query) ||
        person.id.toLowerCase().includes(query) ||
        person.fingerprint?.toLowerCase().includes(query)
    )
  }, [allPeople, searchQuery])

  // Group people by source for display
  const groupedPeople = useMemo(() => {
    const localIds = new Set(local.map((p) => p.id))
    const friendIds = new Set(friendsData?.map((p) => p.id) || [])

    const groups: { label: string; people: Person[] }[] = []

    const localPeople = filteredPeople.filter((p) => localIds.has(p.id))
    if (localPeople.length > 0) {
      groups.push({ label: localLabel ?? t`People`, people: localPeople })
    }

    const friendPeople = filteredPeople.filter(
      (p) => friendIds.has(p.id) && !localIds.has(p.id)
    )
    if (friendPeople.length > 0) {
      groups.push({ label: t`Friends`, people: friendPeople })
    }

    const otherPeople = filteredPeople.filter(
      (p) => !localIds.has(p.id) && !friendIds.has(p.id)
    )
    if (otherPeople.length > 0) {
      groups.push({ label: t`Directory`, people: otherPeople })
    }

    return groups
  }, [filteredPeople, local, localLabel, friendsData])

  const isLoading = isLoadingFriends || isLoadingDirectory

  const handleSelect = (personId: string) => {
    // Cache the selected person's info in global cache so it persists across remounts
    const person = allPeople.find((p) => p.id === personId)
    if (person && !selectedPeopleGlobalCache.has(personId)) {
      selectedPeopleGlobalCache.set(personId, person)
      setCacheVersion((v) => v + 1)
    }

    if (mode === 'single') {
      onChange(personId)
      setOpen(false)
    } else {
      const newValue = selectedIds.includes(personId)
        ? selectedIds.filter((id) => id !== personId)
        : [...selectedIds, personId]
      onChange(newValue)
    }
  }

  // Get display info for trigger button
  const displayInfo = useMemo(() => {
    if (selectedIds.length === 0) return null

    const selectedPeople = selectedIds
      .map((id) =>
        allPeople.find((p) => p.id === id) ||
        local.find((p) => p.id === id) ||
        selectedPeopleGlobalCache.get(id)
      )
      .filter(Boolean) as Person[]

    if (selectedPeople.length === 0) {
      return { names: [], count: selectedIds.length }
    }

    const names = selectedPeople.map((p) => p.name)
    return { names, count: selectedPeople.length }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds, allPeople, local, cacheVersion])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            'w-full justify-between font-normal',
            !displayInfo && 'text-muted-foreground',
            className
          )}
        >
          {displayInfo ? (
            <span className="flex items-center gap-1 min-w-0 flex-1">
              <span className="truncate">
                {displayInfo.names.length > 0
                  ? displayInfo.names.slice(0, 2).join(', ')
                  : plural(displayInfo.count, { one: '# selected', other: '# selected' })}
              </span>
              {displayInfo.count > 2 && (
                <span className="shrink-0 text-xs text-muted-foreground">
                  +{displayInfo.count - 2}
                </span>
              )}
            </span>
          ) : (
            <span className="truncate">{placeholder}</span>
          )}
          <div className="flex items-center gap-1 shrink-0">
            {displayInfo && (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  onChange(mode === 'single' ? '' : [])
                }}
                onPointerDown={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                }}
                onMouseDown={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                }}
                className="rounded-sm hover:bg-hover p-0.5"
              >
                <X className="size-4 opacity-50 hover:opacity-100" />
              </span>
            )}
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        {/* Search input */}
        <div className="p-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t`Search...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="ps-8 h-8"
              autoFocus
            />
          </div>
        </div>

        {(() => {
          const showNone = mode === 'single' && selectedIds.length > 0 && !searchQuery
          const searching = isLoading && !!debouncedSearch
          const hasPeople = filteredPeople.length > 0
          const searchedAndEmpty = !isLoading && !!debouncedSearch && !hasPeople
          if (!showNone && !searching && !hasPeople && !searchedAndEmpty) return null
          return (
        <div className="max-h-64 overflow-y-auto border-t p-1">
          {showNone && (
            <div
              onClick={() => {
                onChange('')
                setOpen(false)
              }}
              className="flex items-center gap-2 px-2 py-1.5 rounded-sm cursor-pointer hover:bg-hover hover:text-hover-foreground text-muted-foreground"
            >
              <div className="size-4 shrink-0" />
              <span className="text-sm"><Trans>None</Trans></span>
            </div>
          )}

          {searching && (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {searchedAndEmpty && (
            <div className="py-6 text-center text-sm text-muted-foreground">
              {emptyMessage}
            </div>
          )}

          {!isLoading && groupedPeople.map((group) => (
            <div key={group.label}>
              {groupedPeople.length > 1 && (
                <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                  {group.label}
                </div>
              )}
              {group.people.map((person) => {
                const isSelected = selectedIds.includes(person.id)
                return (
                  <div
                    key={person.id}
                    onClick={() => handleSelect(person.id)}
                    className={cn(
                      'flex items-center gap-2 px-2 py-1.5 rounded-sm cursor-pointer',
                      'hover:bg-hover hover:text-hover-foreground',
                      isSelected && 'bg-selected'
                    )}
                  >
                    {mode === 'multiple' ? (
                      <Checkbox
                        checked={isSelected}
                        className="shrink-0"
                        onClick={(e) => e.stopPropagation()}
                        onCheckedChange={() => handleSelect(person.id)}
                      />
                    ) : (
                      <div className="size-4 shrink-0 flex items-center justify-center">
                        {isSelected && <Check className="size-4" />}
                      </div>
                    )}
                    <EntityAvatar
                      src={assetUrl ? assetUrl(person, 'avatar') : undefined}
                      styleUrl={assetUrl ? assetUrl(person, 'style') : undefined}
                      seed={person.id}
                      name={person.name}
                      size="sm"
                    />
                    <span className="truncate text-sm">{person.name}</span>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
          )
        })()}
      </PopoverContent>
    </Popover>
  )
}
