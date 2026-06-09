import { cn } from '../lib/utils'

type ThemeGradientBackgroundProps = {
  children: React.ReactNode
  className?: string
}

/**
 * Decorative top radial gradient tinted with the active theme primary color.
 * Lives inside the scroll container so it moves with page content.
 */
export function ThemeGradientBackground({
  children,
  className,
}: ThemeGradientBackgroundProps) {
  return (
    <div className={cn('relative min-h-full bg-background', className)}>
      <div
        aria-hidden='true'
        className='pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(ellipse_at_top,color-mix(in_oklch,var(--primary)_12%,transparent),transparent_70%)] sm:h-[560px]'
      />
      <div className='relative z-10'>{children}</div>
    </div>
  )
}
