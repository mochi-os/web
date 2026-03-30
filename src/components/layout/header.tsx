import { useEffect, useState } from 'react'
import { cn } from '../../lib/utils'

type HeaderProps = React.HTMLAttributes<HTMLElement> & {
  fixed?: boolean
  compact?: boolean
}

export function Header({
  className,
  fixed,
  compact,
  children,
  ...props
}: HeaderProps) {
  const [offset, setOffset] = useState(0)

  useEffect(() => {
    const onScroll = () => {
      setOffset(document.body.scrollTop || document.documentElement.scrollTop)
    }

    // Add scroll listener to the body
    document.addEventListener('scroll', onScroll, { passive: true })

    // Clean up the event listener on unmount
    return () => document.removeEventListener('scroll', onScroll)
  }, [])

  // Don't render empty header
  if (!children) {
    return null
  }

  return (
    <header
      className={cn(
        'z-40',
        compact ? 'h-14' : 'h-17',
        fixed && 'header-fixed peer/header sticky top-[var(--sticky-top,0px)] w-full',
        offset > 10 && fixed ? 'shadow' : 'shadow-none',
        'border-b bg-background',
        className
      )}
      style={fixed ? { paddingRight: 'var(--removed-body-scroll-bar-size, 0px)' } : undefined}
      {...props}
    >
      <div
        className={cn(
          'relative flex h-full w-full items-center justify-center',
          offset > 10 &&
          fixed &&
          'after:bg-background/20 after:absolute after:inset-0 after:-z-10 after:backdrop-blur-lg'
        )}
      >
        <div
          className={cn(
            'flex h-full w-full items-center gap-3 sm:gap-4',
            '@7xl/content:mx-auto @7xl/content:max-w-7xl',
            compact ? 'px-4 py-2' : 'p-4'
          )}
        >
          {children}
        </div>
      </div>
    </header>
  )
}
