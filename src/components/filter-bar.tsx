import { X } from 'lucide-react'
import { Trans } from '@lingui/react/macro'
import { Button } from './ui/button'

export interface FilterState {
  search: string
  watched: boolean
}

interface FilterBarProps {
  filters: FilterState
  onFilterChange: (filters: FilterState) => void
}

export function FilterBar({ filters, onFilterChange }: FilterBarProps) {
  const clearFilter = (key: keyof FilterState) => {
    onFilterChange({ ...filters, [key]: key === 'watched' ? false : '' })
  }

  const clearAllFilters = () => {
    onFilterChange({ search: '', watched: false })
  }

  const activeFilters: { key: keyof FilterState; label: string; value: string }[] = []

  if (filters.search) {
    activeFilters.push({ key: 'search', label: "Search", value: filters.search })
  }
  if (filters.watched) {
    activeFilters.push({ key: 'watched', label: "Watched", value: 'On' })
  }

  if (activeFilters.length === 0) {
    return null
  }

  return (
    <div className='flex flex-wrap items-center gap-2'>
      {activeFilters.map((filter) => (
        <span
          key={filter.key}
          className='bg-muted inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium'
        >
          <span className='text-muted-foreground'>{filter.label}:</span>
          <span className='max-w-[100px] truncate'>{filter.value}</span>
          <button
            type='button'
            onClick={() => clearFilter(filter.key)}
            aria-label={`Remove ${filter.label} filter`}
            className='ms-0.5'
          >
            <X className='size-3' />
          </button>
        </span>
      ))}
      {activeFilters.length > 1 && (
        <Button
          type='button'
          variant='ghost'
          size='sm'
          className='h-6 text-xs text-muted-foreground'
          onClick={clearAllFilters}
        >
          <Trans>Clear all</Trans>
        </Button>
      )}
    </div>
  )
}
