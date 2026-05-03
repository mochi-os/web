// Mochi: Person picker component for selecting users/people
// Copyright Alistair Cunningham 2026

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
import { requestHelpers } from '../lib/request'
import { t } from '@lingui/core/macro'

export interface Person {
  id: string
  name: string
  fingerprint?: string
}

// Module-level cache for selected people's info (persists across component remounts)
const selectedPeopleGlobalCache = new Map<string, Person>()

interface FriendsResponse {
  friends: Person[]
}

interface DirectorySearchResponse {
  results?: Person[]
}

export interface PersonPickerProps {
  /** Selection mode - single or multiple */
  mode: 'single' | 'multiple'
  /** Currently selected person ID(s) */
  value: string | string[]
  /** Callback when selection changes */
  onChange: (value: string | string[]) => void
  /** Pre-loaded list of people (e.g., project subscribers) */
  local?: Person[]
  /** Whether to include friends in search */
  friends?: boolean
  /** Whether to include directory search */
  directory?: boolean
  /** API base path for friends/directory calls */
  apiBasePath?: string
  /** Custom directory search function. Overrides the default
   *  `${apiBasePath}/people/-/users/search` URL. Useful for apps whose JWT
   *  is scoped to themselves and so cannot call the people app directly. */
  directoryFn?: (query: string) => Promise<Person[]>
  /** Custom friends fetch function. Overrides the default
   *  `${apiBasePath}/people/-/friends` URL. */
  friendsFn?: () => Promise<Person[]>
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
  friends = false,
  directory = false,
  apiBasePath = '',
  directoryFn,
  friendsFn,
  placeholder = 'Select person...',
  emptyMessage = 'No people found',
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

  // Fetch friends when searching
  const { data: friendsData, isLoading: isLoadingFriends } = useQuery({
    queryKey: ['person-picker', 'friends', apiBasePath, !!friendsFn],
    queryFn: async () => {
      if (friendsFn) return friendsFn()
      const response = await requestHelpers.get<FriendsResponse>(
        `${apiBasePath}/people/-/friends`
      )
      return response.friends || []
    },
    enabled: friends && open,
    staleTime: 60000, // Cache for 1 minute
  })

  // Search directory when query is long enough
  const { data: directoryData, isLoading: isLoadingDirectory } = useQuery({
    queryKey: ['person-picker', 'directory', apiBasePath, !!directoryFn, debouncedSearch],
    queryFn: async () => {
      if (directoryFn) return directoryFn(debouncedSearch)
      const response = await requestHelpers.get<DirectorySearchResponse | Person[]>(
        `${apiBasePath}/people/-/users/search?search=${encodeURIComponent(debouncedSearch)}`
      )
      return Array.isArray(response) ? response : (response.results || [])
    },
    enabled: directory && debouncedSearch.length >= 2 && open,
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
      groups.push({ label: "Project members", people: localPeople })
    }

    const friendPeople = filteredPeople.filter(
      (p) => friendIds.has(p.id) && !localIds.has(p.id)
    )
    if (friendPeople.length > 0) {
      groups.push({ label: "Friends", people: friendPeople })
    }

    const otherPeople = filteredPeople.filter(
      (p) => !localIds.has(p.id) && !friendIds.has(p.id)
    )
    if (otherPeople.length > 0) {
      groups.push({ label: "Directory", people: otherPeople })
    }

    return groups
  }, [filteredPeople, local, friendsData])

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
                  : `${displayInfo.count} selected`}
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
                className="rounded-sm hover:bg-accent p-0.5"
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
              className="flex items-center gap-2 px-2 py-1.5 rounded-sm cursor-pointer hover:bg-accent hover:text-accent-foreground text-muted-foreground"
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
                      'hover:bg-accent hover:text-accent-foreground',
                      isSelected && 'bg-accent'
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
                      src={`/people/${person.id}/-/avatar`}
                      styleUrl={`/people/${person.id}/-/style`}
                      name={person.name}
                      size={24}
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
