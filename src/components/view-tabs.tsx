import { cn } from '../lib/utils'
import { LayoutGrid, ListTree, Plus } from 'lucide-react'

interface View {
  id: string
  name: string
  viewtype: string
}

interface ViewTabsProps {
  views: View[]
  activeViewId: string
  onViewChange: (viewId: string) => void
  onAddView?: () => void
}

function getViewIcon(viewtype: string) {
  switch (viewtype) {
    case 'list':
      return <ListTree className='size-4' />
    case 'board':
    default:
      return <LayoutGrid className='size-4' />
  }
}

export function ViewTabs({
  views,
  activeViewId,
  onViewChange,
  onAddView,
}: ViewTabsProps) {
  return (
    <div className='overflow-x-auto no-scrollbar border-b border-border'>
      <div className='flex items-center gap-1 min-w-max'>
        {views.map((view) => (
          <button
            key={view.id}
            type='button'
            onClick={() => onViewChange(view.id)}
            className={cn(
              'flex items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap',
              activeViewId === view.id
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/50',
            )}
          >
            {getViewIcon(view.viewtype)}
            {view.name}
          </button>
        ))}
        {onAddView && (
          <button
            type='button'
            onClick={onAddView}
            aria-label='Add view'
            className='flex items-center gap-1 px-2 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors'
          >
            <Plus className='size-4' />
          </button>
        )}
      </div>
    </div>
  )
}
