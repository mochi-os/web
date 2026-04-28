import { Button } from './button'

interface LoadMoreProps {
  hasMore: boolean
  isLoading: boolean
  onLoadMore: () => void
  totalShown: number
  total: number
  label?: string
}

export function LoadMore({
  hasMore,
  isLoading,
  onLoadMore,
  totalShown,
  total,
  label,
}: LoadMoreProps) {
  if (!hasMore && totalShown === 0) return null
  return (
    <div className='mt-4 flex flex-col items-center gap-2'>
      {hasMore ? (
        <Button
          variant='outline'
          size='sm'
          onClick={onLoadMore}
          disabled={isLoading}
        >
          {isLoading ? 'Loading...' : (label ?? 'Load more')}
        </Button>
      ) : null}
      <p className='text-xs text-muted-foreground'>
        Showing {totalShown} of {total}
      </p>
    </div>
  )
}
