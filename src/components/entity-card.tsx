/**
 * Internal shared component — not exported from lib/common index.
 * Used by search-entity-page and search-entity-dialog.
 */
import { Loader2, type LucideIcon } from 'lucide-react'
import { cn } from '../lib/utils'
import { Button } from './ui/button'

export interface EntityCardItem {
  id: string
  name: string
  fingerprint?: string
  blurb?: string
}

interface EntityCardProps {
  entity: EntityCardItem
  icon: LucideIcon
  iconClassName: string
  isPending: boolean
  onSubscribe: () => void
  subscribeLabel: string
}

export function EntityCard({
  entity,
  icon: Icon,
  iconClassName,
  isPending,
  onSubscribe,
  subscribeLabel,
}: EntityCardProps) {
  return (
    <div className='group flex items-center justify-between p-3 rounded-lg border border-transparent transition-all duration-200 hover:bg-muted/50 hover:shadow-sm hover:border-border'>
      <div className='flex items-center gap-3 overflow-hidden'>
        <div
          className={cn(
            'flex items-center justify-center size-10 rounded-full shrink-0',
            iconClassName
          )}
        >
          <Icon className='size-5' />
        </div>
        <div className='min-w-0 flex-1'>
          <div className='truncate font-medium text-sm leading-none mb-1'>
            {entity.name}
          </div>
          {entity.blurb && (
            <div className='text-muted-foreground text-xs truncate opacity-80'>
              {entity.blurb}
            </div>
          )}
          {!entity.blurb && entity.fingerprint && (
            <div className='text-muted-foreground text-xs truncate opacity-80 font-mono'>
              {entity.fingerprint.match(/.{1,3}/g)?.join('-')}
            </div>
          )}
        </div>
      </div>
      <div className='flex gap-2 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-all'>
        <Button
          size='sm'
          disabled={isPending}
          onClick={onSubscribe}
          className='h-8 px-4 rounded-full'
        >
          {isPending ? (
            <Loader2 className='size-4 animate-spin' />
          ) : (
            subscribeLabel
          )}
        </Button>
      </div>
    </div>
  )
}
