import type { CSSProperties, ReactNode } from 'react'
import { cn } from '../../lib/utils'
import { EntityAvatar } from '../entity-avatar'
import { useAccent } from '../../hooks/use-accent'

interface GameHeaderProps {
  title: ReactNode
  status: ReactNode
  meta?: ReactNode
  stats?: ReactNode
  actions?: ReactNode
  banner?: ReactNode
  myTurn?: boolean
  statusLive?: 'off' | 'polite' | 'assertive'
  variant?: 'card' | 'strip'
  className?: string
  // Opponent entity fingerprint — renders their avatar next to the title and
  // tints the header border with their accent colour (if set).
  opponentFingerprint?: string | null
  // Fallback name for the avatar initials when the opponent has no avatar set.
  opponentName?: string
}

export function GameHeader({
  title,
  status,
  meta,
  stats,
  actions,
  banner,
  myTurn,
  statusLive = 'polite',
  variant = 'card',
  className,
  opponentFingerprint,
  opponentName,
}: GameHeaderProps) {
  // The opponent's avatar/style live on the people app and need to be proxied
  // (direct entity URLs only resolve locally; remote opponents 404 there).
  const proxyBase = opponentFingerprint ? `/people/${opponentFingerprint}` : null
  const { accent } = useAccent(undefined, proxyBase ? `${proxyBase}/-/style` : undefined)
  const accentStyle: CSSProperties | undefined = accent
    ? { borderColor: accent }
    : undefined

  return (
    <section
      className={cn(
        'grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-2',
        'transition-[background-color,border-color,color,box-shadow] duration-150 ease-out motion-reduce:transition-none',
        'min-[900px]:grid-cols-[minmax(0,1fr)_auto_auto] min-[900px]:items-center',
        variant === 'card'
          ? 'rounded-xl border border-border/70 bg-surface-1/80 px-3 py-3 shadow-sm'
          : 'border-b border-border/50 px-3 py-2.5',
        className
      )}
      style={accentStyle}
    >
      <div className='flex min-w-0 items-center gap-3'>
        {proxyBase ? (
          <EntityAvatar
            src={`${proxyBase}/-/avatar`}
            styleUrl={`${proxyBase}/-/style`}
            name={opponentName}
            size="md"
            className='shrink-0'
          />
        ) : null}
        <div className='min-w-0 space-y-1'>
          <h1 className='min-w-0 line-clamp-2 text-base leading-tight font-semibold min-[600px]:line-clamp-1 min-[900px]:text-lg'>
            {title}
          </h1>
          <p
            aria-live={statusLive}
            className='text-sm leading-tight font-medium min-[900px]:text-[0.9375rem]'
          >
            {myTurn != null && (
              <span
                aria-hidden='true'
                className={cn(
                  'mr-1.5 inline-block size-2 rounded-full align-middle',
                  myTurn ? 'bg-emerald-500' : 'bg-muted-foreground/30'
                )}
              />
            )}
            {status}
          </p>
          {meta ? (
            <p className='text-sm leading-tight text-muted-foreground'>{meta}</p>
          ) : null}
        </div>
      </div>

      {actions ? (
        <div className='col-start-2 row-start-1 flex shrink-0 items-center gap-1 self-start justify-self-end min-[900px]:col-start-3'>
          {actions}
        </div>
      ) : null}

      {stats ? (
        <div
          className={cn(
            'col-span-2 flex min-w-0 items-center gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
            'min-[600px]:flex-wrap min-[600px]:overflow-visible min-[600px]:pb-0',
            'min-[900px]:col-span-1 min-[900px]:col-start-2 min-[900px]:row-start-1 min-[900px]:self-center',
            '[&>*]:inline-flex [&>*]:shrink-0 [&>*]:items-center [&>*]:gap-1.5 [&>*]:rounded-full [&>*]:border [&>*]:border-border/70 [&>*]:bg-surface-2',
            '[&>*]:px-2.5 [&>*]:py-1 [&>*]:text-sm [&>*]:font-medium [&>*]:tabular-nums [&>*]:shadow-xs',
            '[&>*]:transition-[background-color,border-color,color,box-shadow] [&>*]:duration-150 [&>*]:ease-out motion-reduce:[&>*]:transition-none'
          )}
        >
          {stats}
        </div>
      ) : null}

      {banner ? (
        <div className='col-span-2 min-[900px]:col-span-3'>{banner}</div>
      ) : null}
    </section>
  )
}
