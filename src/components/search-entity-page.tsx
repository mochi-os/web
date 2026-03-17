import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, Loader2, type LucideIcon } from 'lucide-react'
import { Input } from './ui/input'
import { requestHelpers } from '../lib/request'
import { usePageTitle } from '../hooks/use-page-title'
import { Header } from './layout/header'
import { Main } from './layout/main'
import { GeneralError } from '../features/errors/general-error'
import { EntityCard } from './entity-card'
import type { EntityCardItem } from './entity-card'

interface DirectoryEntry extends EntityCardItem {
  class?: string
  location?: string
}

interface RecommendedEntity extends EntityCardItem {
  // EntityCardItem already covers id, name, fingerprint, blurb
}

interface FindEntityPageProps {
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
  /** Page title (e.g., "Find feeds") */
  title: string
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
  /** Error object for recommendations failure */
  recommendationsError?: unknown
  /** Retry callback for failed recommendations */
  onRetryRecommendations?: () => void
}

export function FindEntityPage({
  onSubscribe,
  subscribedIds = new Set(),
  entityClass,
  searchEndpoint,
  icon: Icon,
  iconClassName = 'bg-primary/10 text-primary',
  title,
  placeholder = 'Search...',
  emptyMessage = 'No results found',
  subscribeLabel = 'Subscribe',
  recommendations = [],
  isLoadingRecommendations = false,
  isRecommendationsError = false,
  recommendationsError,
  onRetryRecommendations,
}: FindEntityPageProps) {
  usePageTitle(title)

  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [pendingEntityId, setPendingEntityId] = useState<string | null>(null)

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 500)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Search query
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: [entityClass, 'directory-search', debouncedSearch],
    queryFn: async () => {
      const response = await requestHelpers.get<DirectoryEntry[] | { results: DirectoryEntry[] }>(
        `${searchEndpoint}?search=${encodeURIComponent(debouncedSearch)}`
      )
      return Array.isArray(response) ? response : (response.results || [])
    },
    enabled: debouncedSearch.length > 0,
  })

  const results = data || []

  const handleSubscribe = async (entity: DirectoryEntry) => {
    setPendingEntityId(entity.id)
    try {
      await onSubscribe(entity.id, entity)
    } finally {
      setPendingEntityId(null)
    }
  }

  const isSubscribed = (entity: EntityCardItem) =>
    subscribedIds.has(entity.id) || (!!entity.fingerprint && subscribedIds.has(entity.fingerprint))

  const filteredRecommendations = recommendations.filter((rec) => !isSubscribed(rec))
  const filteredResults = results.filter((entity) => !isSubscribed(entity))

  return (
    <>
      <Header>
        <div className='flex items-center gap-2'>
          <Icon className='size-5' />
          <h1 className='text-lg font-semibold'>{title}</h1>
        </div>
      </Header>
      <Main>
        <div className='mx-auto max-w-2xl space-y-6'>
          <div className='relative'>
            <Search className='text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2' />
            <Input
              placeholder={placeholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className='pl-9 bg-muted/50 border-transparent focus:bg-background focus:border-input transition-all'
              autoFocus
            />
          </div>

          {isLoading && debouncedSearch && (
            <div className='flex flex-col items-center justify-center py-12 gap-2'>
              <Loader2 className='text-primary size-8 animate-spin' />
              <p className='text-sm text-muted-foreground'>Searching...</p>
            </div>
          )}

          {isError && (
            <div className='py-12'>
              <GeneralError error={error} minimal mode='inline' reset={refetch} />
            </div>
          )}

          {!isLoading && !isError && debouncedSearch && filteredResults.length === 0 && (
            <div className='py-12 text-center'>
              <div className='bg-muted/50 rounded-full p-4 w-fit mx-auto mb-3'>
                <Icon className='text-muted-foreground size-8' />
              </div>
              <h3 className='font-semibold text-sm'>{emptyMessage}</h3>
              <p className='text-muted-foreground text-xs mt-1'>Try adjusting your search terms</p>
            </div>
          )}

          {!debouncedSearch && (
            <div>
              {isLoadingRecommendations ? (
                <div className='flex items-center justify-center py-8'>
                  <Loader2 className='text-muted-foreground size-5 animate-spin' />
                </div>
              ) : isRecommendationsError ? (
                <div className='py-8'>
                  <GeneralError
                    error={recommendationsError}
                    minimal
                    mode='inline'
                    reset={onRetryRecommendations}
                  />
                </div>
              ) : filteredRecommendations.length === 0 ? (
                <div className='flex flex-col items-center justify-center py-8 text-center text-muted-foreground'>
                  <Search className='size-12 opacity-20 mb-3' />
                </div>
              ) : (
                <div>
                  <p className='text-muted-foreground mb-3 text-xs font-medium uppercase tracking-wide'>
                    Recommended
                  </p>
                  <div className='space-y-1'>
                    {filteredRecommendations.map((rec) => (
                      <EntityCard
                        key={rec.id}
                        entity={rec}
                        icon={Icon}
                        iconClassName={iconClassName}
                        isPending={pendingEntityId === rec.id}
                        onSubscribe={() =>
                          handleSubscribe({ id: rec.id, name: rec.name, fingerprint: rec.fingerprint })
                        }
                        subscribeLabel={subscribeLabel}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {filteredResults.length > 0 && (
            <div className='space-y-1'>
              {filteredResults.map((entity) => (
                <EntityCard
                  key={entity.fingerprint || entity.id}
                  entity={entity}
                  icon={Icon}
                  iconClassName={iconClassName}
                  isPending={pendingEntityId === entity.id}
                  onSubscribe={() => handleSubscribe(entity)}
                  subscribeLabel={subscribeLabel}
                />
              ))}
            </div>
          )}
        </div>
      </Main>
    </>
  )
}
