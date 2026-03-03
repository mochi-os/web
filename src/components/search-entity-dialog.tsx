'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, Loader2, type LucideIcon } from 'lucide-react'
import {
    ResponsiveDialog,
    ResponsiveDialogContent,
    ResponsiveDialogHeader,
    ResponsiveDialogTitle,
    ResponsiveDialogDescription,
} from './ui/responsive-dialog'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { ScrollArea } from './ui/scroll-area'
import { cn } from '../lib/utils'
import { requestHelpers } from '../lib/request'

interface DirectoryEntry {
    id: string
    name: string
    fingerprint?: string
    class?: string
    location?: string
}

interface RecommendedEntity {
    id: string
    name: string
    blurb?: string
    fingerprint?: string
}

interface SearchEntityDialogProps {
    /** Whether the dialog is open */
    open: boolean
    /** Callback when open state changes */
    onOpenChange: (open: boolean) => void
    /** Called when user clicks subscribe on an entity */
    onSubscribe: (entityId: string, entity: DirectoryEntry) => Promise<void>
    /** Set of already subscribed entity IDs or fingerprints */
    subscribedIds?: Set<string>
    /** Entity class being searched (e.g., "feed", "forum", "wiki") */
    entityClass: string
    /** API endpoint for directory search (e.g., "/feeds/directory/search") */
    searchEndpoint: string
    /** Icon to display for each result */
    icon: LucideIcon
    /** Tailwind classes for icon container (e.g., "bg-orange-500/10 text-orange-600") */
    iconClassName?: string
    /** Dialog title (e.g., "Search feeds") */
    title: string
    /** Dialog description */
    description?: string
    /** Input placeholder */
    placeholder?: string
    /** Empty state message when no results */
    emptyMessage?: string
    /** Label for subscribe button */
    subscribeLabel?: string
    /** Optional recommended entities to show when not searching */
    recommendations?: RecommendedEntity[]
    /** Whether recommendations are loading */
    isLoadingRecommendations?: boolean
    /** Whether recommendations failed to load */
    isRecommendationsError?: boolean
}

export function SearchEntityDialog({
    open,
    onOpenChange,
    onSubscribe,
    subscribedIds = new Set(),
    entityClass,
    searchEndpoint,
    icon: Icon,
    iconClassName = 'bg-primary/10 text-primary',
    title,
    description,
    placeholder = 'Search...',
    emptyMessage = 'No results found',
    subscribeLabel = 'Subscribe',
    recommendations = [],
    isLoadingRecommendations = false,
    isRecommendationsError = false,
}: SearchEntityDialogProps) {
    const [searchQuery, setSearchQuery] = useState('')
    const [debouncedSearch, setDebouncedSearch] = useState('')
    const [pendingEntityId, setPendingEntityId] = useState<string | null>(null)

    // Debounce search input
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(searchQuery), 500)
        return () => clearTimeout(timer)
    }, [searchQuery])

    // Clear state when dialog closes
    useEffect(() => {
        if (!open) {
            setSearchQuery('')
            setDebouncedSearch('')
            setPendingEntityId(null)
        }
    }, [open])

    // Search query
    const { data, isLoading, isError } = useQuery({
        queryKey: [entityClass, 'directory-search', debouncedSearch],
        queryFn: async () => {
            const response = await requestHelpers.get<DirectoryEntry[] | { results: DirectoryEntry[] }>(
                `${searchEndpoint}?search=${encodeURIComponent(debouncedSearch)}`
            )
            // Handle both array response and { results: [] } response formats
            return Array.isArray(response) ? response : (response.results || [])
        },
        enabled: debouncedSearch.length > 0 && open,
    })

    const results = data || []

    const handleSubscribe = async (entity: DirectoryEntry) => {
        setPendingEntityId(entity.id)
        try {
            await onSubscribe(entity.id, entity)
            onOpenChange(false)
        } catch (error) {
            console.error('Failed to subscribe:', error)
        } finally {
            setPendingEntityId(null)
        }
    }

    return (
        <ResponsiveDialog
            open={open}
            onOpenChange={onOpenChange}
            shouldCloseOnInteractOutside={false}
        >
            <ResponsiveDialogContent className="flex max-h-[85vh] flex-col gap-0 p-0 sm:max-w-[600px] overflow-hidden border-none shadow-2xl">
                <ResponsiveDialogHeader className="border-b px-4 py-4 bg-muted/30">
                    <ResponsiveDialogTitle className="text-xl font-semibold tracking-tight">
                        {title}
                    </ResponsiveDialogTitle>
                    <ResponsiveDialogDescription className={cn("text-xs", !description && "sr-only")}>
                        {description || title}
                    </ResponsiveDialogDescription>
                </ResponsiveDialogHeader>

                <div className="p-4 border-b bg-background">
                    <div className="relative">
                        <Search className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" />
                        <Input
                            placeholder={placeholder}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 bg-muted/50 border-transparent focus:bg-background focus:border-input transition-all"
                            autoFocus
                        />
                    </div>
                </div>

                <ScrollArea className="flex-1 pr-4 bg-muted/10 h-[400px] overflow-y-scroll">
                    {isLoading && debouncedSearch && (
                        <div className="flex flex-col items-center justify-center py-12 gap-2">
                            <Loader2 className="text-primary size-8 animate-spin" />
                            <p className="text-sm text-muted-foreground">Searching...</p>
                        </div>
                    )}

                    {isError && (
                        <div className="h-full flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                            <p className="text-sm font-medium">Search failed</p>
                        </div>
                    )}

                    {!isLoading && !isError && debouncedSearch && results.length === 0 && (
                        <div className="py-12 text-center">
                            <div className="bg-muted/50 rounded-full p-4 w-fit mx-auto mb-3">
                                <Icon className="text-muted-foreground size-8" />
                            </div>
                            <h3 className="font-semibold text-sm">{emptyMessage}</h3>
                            <p className="text-muted-foreground text-xs mt-1">Try adjusting your search terms</p>
                        </div>
                    )}

                    {!debouncedSearch && (() => {
                        const filteredRecommendations = recommendations.filter((rec) =>
                            !subscribedIds.has(rec.id) && (!rec.fingerprint || !subscribedIds.has(rec.fingerprint))
                        )
                        return (
                            <div className="p-4">
                                {isLoadingRecommendations ? (
                                    <div className="flex items-center justify-center py-8">
                                        <Loader2 className="text-muted-foreground size-5 animate-spin" />
                                    </div>
                                ) : isRecommendationsError || filteredRecommendations.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                                        <Search className="size-12 opacity-20 mb-3" />
                                        <p className="text-sm font-medium">Type to find {entityClass}s...</p>
                                    </div>
                                ) : (
                                    <div>
                                        <p className="text-muted-foreground mb-3 text-xs font-medium uppercase tracking-wide">
                                            Recommended
                                        </p>
                                        <div className="space-y-1">
                                            {filteredRecommendations.map((rec) => {
                                                const isPending = pendingEntityId === rec.id

                                                return (
                                                    <div
                                                        key={rec.id}
                                                        className="group flex items-center justify-between p-3 rounded-lg border border-transparent transition-all duration-200 hover:bg-background hover:shadow-sm hover:border-border"
                                                    >
                                                        <div className="flex items-center gap-3 overflow-hidden">
                                                            <div className={cn(
                                                                "flex items-center justify-center size-10 rounded-full shrink-0",
                                                                iconClassName
                                                            )}>
                                                                <Icon className="size-5" />
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <div className="truncate font-medium text-sm leading-none mb-1">
                                                                    {rec.name}
                                                                </div>
                                                                {rec.blurb && (
                                                                    <div className="text-muted-foreground text-xs truncate opacity-80">
                                                                        {rec.blurb}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                                            <Button
                                                                size="sm"
                                                                disabled={isPending}
                                                                onClick={() => handleSubscribe({ id: rec.id, name: rec.name, fingerprint: rec.fingerprint })}
                                                                className="h-8 px-4 rounded-full"
                                                            >
                                                                {isPending ? (
                                                                    <Loader2 className="size-4 animate-spin" />
                                                                ) : (
                                                                    subscribeLabel
                                                                )}
                                                            </Button>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )
                    })()}

                    {results.length > 0 && (
                        <div className="p-2 space-y-1">
                            {results
                                .filter((entity) => !subscribedIds.has(entity.id) && (!entity.fingerprint || !subscribedIds.has(entity.fingerprint)))
                                .map((entity) => {
                                    const isPending = pendingEntityId === entity.id

                                    return (
                                        <div
                                            key={entity.fingerprint || entity.id}
                                            className="group flex items-center justify-between p-3 rounded-lg border border-transparent transition-all duration-200 hover:bg-background hover:shadow-sm hover:border-border"
                                        >
                                            <div className="flex items-center gap-3 overflow-hidden">
                                                <div className={cn(
                                                    "flex items-center justify-center size-10 rounded-full shrink-0",
                                                    iconClassName
                                                )}>
                                                    <Icon className="size-5" />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="truncate font-medium text-sm leading-none mb-1">
                                                        {entity.name}
                                                    </div>
                                                    {entity.fingerprint && (
                                                        <div className="text-muted-foreground text-xs truncate opacity-80 font-mono">
                                                            {entity.fingerprint.match(/.{1,3}/g)?.join('-')}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                                <Button
                                                    size="sm"
                                                    disabled={isPending}
                                                    onClick={() => handleSubscribe(entity)}
                                                    className="h-8 px-4 rounded-full"
                                                >
                                                    {isPending ? (
                                                        <Loader2 className="size-4 animate-spin" />
                                                    ) : (
                                                        subscribeLabel
                                                    )}
                                                </Button>
                                            </div>
                                        </div>
                                    )
                                })}
                        </div>
                    )}
                </ScrollArea>
            </ResponsiveDialogContent>
        </ResponsiveDialog>
    )
}
