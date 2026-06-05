import type { ReactNode } from 'react'

export interface ActivityTimelineItem {
  id: string | number
  primary: ReactNode
  secondary?: ReactNode
}

interface ActivityTimelineProps {
  items: ActivityTimelineItem[]
}

export function ActivityTimeline({ items }: ActivityTimelineProps) {
  return (
    <ol className='space-y-0'>
      {items.map((item, idx) => {
        const isLast = idx === items.length - 1
        return (
          <li key={item.id} className='flex gap-3'>
            <div className='flex flex-col items-center'>
              <div className='mt-1.5 size-2 shrink-0 rounded-full bg-primary/50 ring-2 ring-background' />
              {!isLast && <div className='mt-1 w-px flex-1 bg-border' />}
            </div>
            <div className={`min-w-0 space-y-0.5 ${isLast ? '' : 'pb-4'}`}>
              {item.primary}
              {item.secondary}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
