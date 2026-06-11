import { LayoutGrid, ListTree, Plus } from 'lucide-react'
import { t } from '@lingui/core/macro'
import { Tabs, TabsList, TabsTrigger } from './ui/tabs'

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
    <Tabs
      variant='underline'
      value={activeViewId}
      onValueChange={onViewChange}
      className='no-scrollbar border-border gap-0 overflow-x-auto border-b'
    >
      <div className='flex min-w-max items-center gap-1'>
        <TabsList className='w-auto border-b-0'>
          {views.map((view) => (
            <TabsTrigger key={view.id} value={view.id} className='gap-2'>
              {getViewIcon(view.viewtype)}
              {view.name}
            </TabsTrigger>
          ))}
        </TabsList>
        {onAddView && (
          <button
            type='button'
            onClick={onAddView}
            aria-label={t`Add view`}
            title={t`Add view`}
            className='text-muted-foreground hover:text-foreground flex items-center gap-1 px-2 py-2 text-sm transition-colors'
          >
            <Plus className='size-4' />
          </button>
        )}
      </div>
    </Tabs>
  )
}
