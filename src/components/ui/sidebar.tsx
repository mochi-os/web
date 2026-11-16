// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import * as React from 'react'
import { Trans } from '@lingui/react/macro'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { PanelLeftIcon } from 'lucide-react'
import { cn } from '../../lib/utils'
import {
  getShellInitData,
  initShellBridge,
  isInShell,
  onShellMessage,
  safeCookieSet,
  shellSetSidebarState,
  shellSetSidebarWidth,
} from '../../lib/shell-bridge'
import { getCookie } from '../../lib/cookies'
import {
  SIDEBAR_WIDTH_DEFAULT,
  SIDEBAR_WIDTH_MIN,
  SIDEBAR_WIDTH_STEP,
  clampSidebarWidth,
  maxSidebarWidth,
  parseSidebarWidth,
} from '../../lib/sidebar-width'
import { useAuthStore } from '../../stores/auth-store'
import { useScreenSize } from '../../hooks/use-screen-size'
import { Button } from './button'
import { Input } from './input'
import { Separator } from './separator'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from './sheet'
import { Skeleton } from './skeleton'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './tooltip'
import { t } from '@lingui/core/macro'

const SIDEBAR_COOKIE_NAME = 'sidebar_state'
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7
const SIDEBAR_WIDTH_COOKIE_NAME = 'sidebar_width'
const SIDEBAR_WIDTH = '16rem'
const SIDEBAR_WIDTH_MOBILE = '16rem'
const SIDEBAR_WIDTH_ICON = '3rem'
const SIDEBAR_KEYBOARD_SHORTCUT = 'b'

type SidebarContextProps = {
  state: 'expanded' | 'collapsed'
  open: boolean
  setOpen: (open: boolean) => void
  openMobile: boolean
  setOpenMobile: (open: boolean) => void
  isMobile: boolean
  toggleSidebar: () => void
  /** Whether this window offers the drag handle: desktop widths only. */
  resizable: boolean
  /** The dragged width in CSS pixels, clamped to this window; null is the default. */
  width: number | null
  /** Save a dragged width for every app, or null to go back to the default. */
  setWidth: (width: number | null) => void
}

// The saved width as this page can first see it: the shell's init when it has
// already landed, otherwise the cookie a top-level page shares across apps.
function readSidebarWidth(): number | null {
  if (isInShell()) return parseSidebarWidth(getShellInitData()?.sidebarWidth)
  return parseSidebarWidth(getCookie(SIDEBAR_WIDTH_COOKIE_NAME))
}

const SidebarContext = React.createContext<SidebarContextProps | null>(null)

function useSidebar() {
  const context = React.useContext(SidebarContext)
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider.')
  }

  return context
}

function SidebarProvider({
  defaultOpen = true,
  open: openProp,
  onOpenChange: setOpenProp,
  className,
  style,
  children,
  ...props
}: React.ComponentProps<'div'> & {
  defaultOpen?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  // Mobile (<768px) uses sheet overlay; tablet (768–1023px) uses inline icon rail
  const { isMobile: isNarrow, isTablet, isDesktop, width } = useScreenSize()
  const isMobile = isNarrow
  const [openMobile, setOpenMobile] = React.useState(false)

  // Dragging is offered from 1024px only. Below that the sidebar is a phone
  // sheet or a tablet icon rail, both fixed widths, and a saved desktop width
  // is kept for when the window is wide again rather than applied there.
  const resizable = isDesktop
  const [savedWidth, setSavedWidth] = React.useState(readSidebarWidth)
  // True while the shell's saved state is applied after the first paint, so
  // the sidebar takes its width and open state at once rather than easing into
  // them on every app load. Cleared after two frames: the first paints the
  // settled sidebar with easing off, the second turns it back on.
  const [settling, setSettling] = React.useState(false)
  React.useEffect(() => {
    if (!settling) return
    let second = 0
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setSettling(false))
    })
    return () => {
      cancelAnimationFrame(first)
      cancelAnimationFrame(second)
    }
  }, [settling])
  const sidebarWidth =
    resizable && savedWidth !== null
      ? clampSidebarWidth(savedWidth, width)
      : null
  const setWidth = React.useCallback((value: number | null) => {
    setSavedWidth(value)
    // Same split as the open state: a cookie outside the shell, the shell's
    // own storage inside it, where cookies are unavailable.
    safeCookieSet(
      value === null
        ? `${SIDEBAR_WIDTH_COOKIE_NAME}=; path=/; max-age=0`
        : `${SIDEBAR_WIDTH_COOKIE_NAME}=${value}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`
    )
    shellSetSidebarWidth(value)
  }, [])

  // This is the internal state of the sidebar.
  // We use openProp and setOpenProp for control from outside the component.
  // Collapse by default between 768–900px; above 900px honour the saved preference.
  const [_open, _setOpen] = React.useState(
    isTablet && width < 900 ? false : defaultOpen
  )
  const open = openProp ?? _open
  const setOpen = React.useCallback(
    (value: boolean | ((value: boolean) => boolean)) => {
      const openState = typeof value === 'function' ? value(open) : value
      if (setOpenProp) {
        setOpenProp(openState)
      } else {
        _setOpen(openState)
      }

      // Persist sidebar state: cookie for non-shell, postMessage for shell
      safeCookieSet(
        `${SIDEBAR_COOKIE_NAME}=${openState}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`
      )
      shellSetSidebarState(openState)
    },
    [setOpenProp, open]
  )

  // Helper to toggle the sidebar.
  const toggleSidebar = React.useCallback(() => {
    if (isMobile) {
      setOpenMobile((open) => {
        shellSetSidebarState(!open)
        return !open
      })
    } else {
      setOpen((open) => !open)
    }
  }, [isMobile, setOpen, setOpenMobile])

  React.useEffect(() => {
    if (!isInShell()) return

    return onShellMessage((message) => {
      if (message.type === 'sidebar-toggle') {
        toggleSidebar()
      }
    })
  }, [toggleSidebar])

  // The shell's init arrives after the first render, so the defaultOpen this
  // provider was constructed with is always the fallback rather than the
  // user's saved state - and the useState initializer never re-runs, because
  // the anonymous and authenticated layouts return the identical provider
  // chain and React reconciles instead of remounting. Apply the real value
  // when it lands, without persisting it back: this is the shell telling us
  // what it already stored.
  React.useEffect(() => {
    if (!isInShell()) return
    let cancelled = false
    initShellBridge().then((init) => {
      if (cancelled) return
      setSettling(true)
      if (init.sidebarOpen !== undefined) _setOpen(init.sidebarOpen)
      if (init.sidebarWidth !== undefined)
        setSavedWidth(parseSidebarWidth(init.sidebarWidth))
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Adds a keyboard shortcut to toggle the sidebar.
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === SIDEBAR_KEYBOARD_SHORTCUT &&
        (event.metaKey || event.ctrlKey)
      ) {
        event.preventDefault()
        toggleSidebar()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [toggleSidebar])

  // We add a state so that we can do data-state="expanded" or "collapsed".
  // This makes it easier to style the sidebar with Tailwind classes.
  const state = open ? 'expanded' : 'collapsed'

  const contextValue = React.useMemo<SidebarContextProps>(
    () => ({
      state,
      open,
      setOpen,
      isMobile,
      openMobile,
      setOpenMobile,
      toggleSidebar,
      resizable,
      width: sidebarWidth,
      setWidth,
    }),
    [
      state,
      open,
      setOpen,
      isMobile,
      openMobile,
      setOpenMobile,
      toggleSidebar,
      resizable,
      sidebarWidth,
      setWidth,
    ]
  )

  return (
    <SidebarContext.Provider value={contextValue}>
      <TooltipProvider delayDuration={0}>
        <div
          data-slot='sidebar-wrapper'
          data-settling={settling ? 'true' : undefined}
          style={
            {
              '--sidebar-width':
                sidebarWidth === null ? SIDEBAR_WIDTH : `${sidebarWidth}px`,
              '--sidebar-width-icon': SIDEBAR_WIDTH_ICON,
              ...style,
            } as React.CSSProperties
          }
          className={cn(
            'group/sidebar-wrapper has-data-[variant=inset]:bg-sidebar flex h-full w-full',
            className
          )}
          {...props}
        >
          {children}
        </div>
      </TooltipProvider>
    </SidebarContext.Provider>
  )
}

function Sidebar({
  side = 'left',
  variant = 'sidebar',
  collapsible = 'offcanvas',
  className,
  children,
  ...props
}: React.ComponentProps<'div'> & {
  side?: 'left' | 'right'
  variant?: 'sidebar' | 'floating' | 'inset'
  collapsible?: 'offcanvas' | 'icon' | 'none'
}) {
  const { isMobile, state, openMobile, setOpenMobile } = useSidebar()
  const isLoggedIn = useAuthStore((state) => state.isAuthenticated)

  // Hide sidebar when not logged in
  if (!isLoggedIn) {
    return null
  }

  if (collapsible === 'none') {
    return (
      <div
        data-slot='sidebar'
        className={cn(
          'bg-sidebar text-sidebar-foreground flex h-full w-(--sidebar-width) flex-col',
          className
        )}
        {...props}
      >
        {children}
      </div>
    )
  }

  if (isMobile) {
    return (
      <Sheet open={openMobile} onOpenChange={setOpenMobile} {...props}>
        <SheetContent
          data-sidebar='sidebar'
          data-slot='sidebar'
          data-mobile='true'
          className='bg-sidebar text-sidebar-foreground w-(--sidebar-width) p-0 [&>button]:hidden'
          style={
            {
              '--sidebar-width': SIDEBAR_WIDTH_MOBILE,
            } as React.CSSProperties
          }
          side={side}
          // Sheets ignore outside taps so a half-filled form is not lost. The
          // navigation holds links only, so it closes on one, like any phone
          // menu. Only a tap on the dimmed area counts: the header's own
          // toggle sits outside the sheet, and closing on it here would have
          // the toggle open the menu again at once.
          onInteractOutside={(event) => {
            const target = event.detail.originalEvent.target
            if (
              !(target instanceof Element) ||
              !target.closest('[data-slot=sheet-overlay]')
            ) {
              event.preventDefault()
            }
          }}
        >
          <SheetHeader className='sr-only'>
            <SheetTitle>
              <Trans>Sidebar</Trans>
            </SheetTitle>
            <SheetDescription>
              <Trans>Displays the mobile sidebar.</Trans>
            </SheetDescription>
          </SheetHeader>
          <div className='flex h-full w-full flex-col'>{children}</div>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <div
      className='group peer text-sidebar-foreground relative hidden h-full md:block'
      data-state={state}
      data-collapsible={state === 'collapsed' ? collapsible : ''}
      data-variant={variant}
      data-side={side}
      data-slot='sidebar'
    >
      {/* This is what handles the sidebar gap on desktop */}
      <div
        data-slot='sidebar-gap'
        className={cn(
          'relative w-(--sidebar-width) bg-transparent transition-[width] duration-200 ease-linear',
          // A drag moves the width on every frame; easing it lags the pointer.
          'in-data-[resizing=true]:transition-none in-data-[settling=true]:transition-none',
          'group-data-[collapsible=offcanvas]:w-0',
          'group-data-[side=right]:rotate-180',
          variant === 'floating' || variant === 'inset'
            ? 'group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4)))]'
            : 'group-data-[collapsible=icon]:w-(--sidebar-width-icon)'
        )}
      />
      <div
        data-slot='sidebar-container'
        className={cn(
          'absolute inset-y-0 z-10 hidden h-full w-(--sidebar-width) overflow-visible transition-[inset-inline,width] duration-200 ease-linear md:flex',
          'in-data-[resizing=true]:transition-none in-data-[settling=true]:transition-none',
          side === 'left'
            ? 'start-0 group-data-[collapsible=offcanvas]:-start-[calc(var(--sidebar-width))]'
            : 'end-0 group-data-[collapsible=offcanvas]:-end-[calc(var(--sidebar-width))]',
          // Adjust the padding for floating and inset variants.
          variant === 'floating' || variant === 'inset'
            ? 'p-2 group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4))+2px)]'
            : 'group-data-[collapsible=icon]:w-(--sidebar-width-icon) group-data-[side=left]:border-e group-data-[side=right]:border-s',
          className
        )}
        {...props}
      >
        <div
          data-sidebar='sidebar'
          data-slot='sidebar-inner'
          className='bg-sidebar group-data-[variant=floating]:border-sidebar-border relative flex h-full w-full flex-col group-data-[variant=floating]:rounded-lg group-data-[variant=floating]:border group-data-[variant=floating]:shadow-sm'
        >
          {children}
        </div>
      </div>
    </div>
  )
}

function SidebarTrigger({
  className,
  onClick,
  ...props
}: React.ComponentProps<typeof Button>) {
  const { toggleSidebar } = useSidebar()

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          data-sidebar='trigger'
          data-slot='sidebar-trigger'
          variant='ghost'
          size='icon'
          className={cn('size-8', className)}
          onClick={(event) => {
            onClick?.(event)
            toggleSidebar()
          }}
          {...props}
        >
          <PanelLeftIcon className='size-5' />
          <span className='sr-only'>
            <Trans>Toggle sidebar</Trans>
          </span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <Trans>Toggle sidebar</Trans>
      </TooltipContent>
    </Tooltip>
  )
}

function SidebarRail({ className, ...props }: React.ComponentProps<'button'>) {
  const { toggleSidebar } = useSidebar()

  return (
    <button
      data-sidebar='rail'
      data-slot='sidebar-rail'
      aria-label={t`Toggle sidebar`}
      tabIndex={-1}
      onClick={toggleSidebar}
      title={t`Toggle sidebar`}
      className={cn(
        'absolute inset-y-0 z-20 hidden w-4 -translate-x-1/2 transition-all ease-linear group-data-[side=left]:-end-4 group-data-[side=right]:start-0 sm:flex',
        // Always show the rail line for sidebar variant, brighter on hover
        'after:absolute after:inset-y-0 after:start-1/2 after:w-[2px] after:bg-sidebar-border hover:after:bg-border-strong',
        'in-data-[side=left]:cursor-w-resize in-data-[side=right]:cursor-e-resize',
        '[[data-side=left][data-state=collapsed]_&]:cursor-e-resize [[data-side=right][data-state=collapsed]_&]:cursor-w-resize',
        'hover:group-data-[collapsible=offcanvas]:bg-sidebar group-data-[collapsible=offcanvas]:translate-x-0 group-data-[collapsible=offcanvas]:after:start-full',
        '[[data-side=left][data-collapsible=offcanvas]_&]:-end-2',
        '[[data-side=right][data-collapsible=offcanvas]_&]:-start-2',

        // RTL support
        'rtl:translate-x-1/2',
        'rtl:in-data-[side=left]:cursor-e-resize rtl:in-data-[side=right]:cursor-w-resize',
        'rtl:[[data-side=left][data-state=collapsed]_&]:cursor-w-resize rtl:[[data-side=right][data-state=collapsed]_&]:cursor-e-resize',
        className
      )}
      {...props}
    />
  )
}

type SidebarDrag = {
  pointerId: number
  startX: number
  startWidth: number
  // +1 when moving the pointer right on screen widens the sidebar, -1 when
  // moving it left does. See widenSign.
  sign: number
  latest: number
  frame: number | null
  wrapper: HTMLElement
  // The drag's width goes on the sidebar element, which overrides the
  // wrapper's value for everything that draws the sidebar. The wrapper's value
  // stays React's alone, so taking the override off at the end can never leave
  // a width React does not know about.
  sidebar: HTMLElement
  handle: HTMLElement
  // aria-valuenow as React last wrote it, put back when the drag saves nothing.
  ariaNow: string | null
  bodyCursor: string
  bodyUserSelect: string
}

// Which way on screen a pointer or arrow key has to move to widen the sidebar:
// +1 for right, -1 for left. A start-side sidebar sits on the left in
// left-to-right text and on the right in right-to-left text; an end-side one is
// the mirror of that.
function widenSign(handle: HTMLElement): number {
  const side = handle.closest('[data-slot=sidebar]')?.getAttribute('data-side')
  const rtl = getComputedStyle(handle).direction === 'rtl'
  return (side === 'right' ? -1 : 1) * (rtl ? -1 : 1)
}

// The sidebar's width as drawn, so a drag starts from what is on screen even
// when it is still the rem default rather than a saved pixel width.
function drawnWidth(handle: HTMLElement, fallback: number): number {
  const container = handle.closest('[data-slot=sidebar-container]')
  const width = container?.getBoundingClientRect().width
  return width && width > 0 ? width : fallback
}

/**
 * The drag handle on the sidebar's inner edge. Pointer events cover mouse,
 * touch and pen, and pointer capture keeps a drag going when the pointer
 * leaves the app's frame. While dragging, the width is written straight to the
 * sidebar element's --sidebar-width, so the app does not re-render on every
 * move; it is saved once, on release. Double-click goes back to the default
 * width.
 */
function SidebarResizeHandle({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  const { resizable, isMobile, state, width, setWidth } = useSidebar()
  // Read here, not from the context, so the handle's maximum follows the
  // window even when the sidebar's own width does not change.
  const { width: viewport } = useScreenSize()
  const drag = React.useRef<SidebarDrag | null>(null)

  const finish = React.useCallback(
    (save: boolean) => {
      const current = drag.current
      if (!current) return
      drag.current = null
      if (current.frame !== null) cancelAnimationFrame(current.frame)
      current.wrapper.removeAttribute('data-resizing')
      current.sidebar.style.removeProperty('--sidebar-width')
      if (current.ariaNow === null)
        current.handle.removeAttribute('aria-valuenow')
      else current.handle.setAttribute('aria-valuenow', current.ariaNow)
      document.body.style.cursor = current.bodyCursor
      document.body.style.userSelect = current.bodyUserSelect
      if (save && current.latest !== current.startWidth)
        setWidth(current.latest)
    },
    [setWidth]
  )

  // Hidden or unmounted mid-drag (collapsed with the shortcut, or the window
  // crossed a breakpoint): no pointerup will come, so restore the page here,
  // and save the width the drag reached. Keyed on `shown` because hiding
  // renders null without unmounting.
  const shown = resizable && !isMobile && state === 'expanded'
  React.useEffect(() => {
    if (!shown) return
    return () => finish(true)
  }, [shown, finish])

  if (!shown) return null

  const now = width ?? SIDEBAR_WIDTH_DEFAULT

  return (
    <div
      data-sidebar='resize-handle'
      data-slot='sidebar-resize-handle'
      role='separator'
      aria-orientation='vertical'
      aria-label={t`Resize sidebar`}
      aria-valuemin={SIDEBAR_WIDTH_MIN}
      aria-valuemax={maxSidebarWidth(viewport)}
      aria-valuenow={now}
      tabIndex={0}
      className={cn(
        'absolute inset-y-0 -end-1.5 z-20 w-3 cursor-col-resize touch-none select-none focus-visible:outline-none',
        // The line shows on hover, focus and while dragging; at rest the
        // sidebar's own border is the edge.
        'after:absolute after:inset-y-0 after:start-1/2 after:w-0.5 after:-translate-x-1/2 rtl:after:translate-x-1/2',
        'after:bg-transparent after:transition-colors after:duration-150',
        'hover:after:bg-border-strong focus-visible:after:bg-ring in-data-[resizing=true]:after:bg-border-strong',
        className
      )}
      onPointerDown={(event) => {
        if (event.button !== 0) return
        const handle = event.currentTarget
        const wrapper = handle.closest<HTMLElement>(
          '[data-slot=sidebar-wrapper]'
        )
        const sidebar = handle.closest<HTMLElement>('[data-slot=sidebar]')
        if (!wrapper || !sidebar) return
        event.preventDefault()
        handle.setPointerCapture(event.pointerId)
        const startWidth = drawnWidth(handle, now)
        drag.current = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startWidth,
          sign: widenSign(handle),
          latest: startWidth,
          frame: null,
          wrapper,
          sidebar,
          handle,
          ariaNow: handle.getAttribute('aria-valuenow'),
          bodyCursor: document.body.style.cursor,
          bodyUserSelect: document.body.style.userSelect,
        }
        wrapper.setAttribute('data-resizing', 'true')
        // On the body too, so the cursor holds and no text is selected while
        // the pointer is over the page rather than the handle.
        document.body.style.cursor = 'col-resize'
        document.body.style.userSelect = 'none'
      }}
      onPointerMove={(event) => {
        const current = drag.current
        if (!current || event.pointerId !== current.pointerId) return
        current.latest = clampSidebarWidth(
          current.startWidth + current.sign * (event.clientX - current.startX),
          window.innerWidth
        )
        if (current.frame !== null) return
        current.frame = requestAnimationFrame(() => {
          current.frame = null
          current.sidebar.style.setProperty(
            '--sidebar-width',
            `${current.latest}px`
          )
          current.handle.setAttribute('aria-valuenow', String(current.latest))
        })
      }}
      onPointerUp={() => finish(true)}
      onPointerCancel={() => finish(true)}
      onLostPointerCapture={() => finish(true)}
      onDoubleClick={() => setWidth(null)}
      onKeyDown={(event) => {
        const handle = event.currentTarget
        let next: number | null = null
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          // Arrows follow the screen, not the reading direction: the one
          // pointing away from the sidebar widens it. Each press steps from
          // the saved width, not the drawn one, which is still easing towards
          // the last press when the key is held or tapped quickly. The drawn
          // width only stands in for the rem default before the first step.
          const right = event.key === 'ArrowRight' ? 1 : -1
          next =
            (width ?? drawnWidth(handle, now)) +
            right * widenSign(handle) * SIDEBAR_WIDTH_STEP
        } else if (event.key === 'Home') {
          next = SIDEBAR_WIDTH_MIN
        } else if (event.key === 'End') {
          next = Number.POSITIVE_INFINITY
        }
        if (next === null) return
        event.preventDefault()
        setWidth(clampSidebarWidth(next, window.innerWidth))
      }}
      {...props}
    />
  )
}

function SidebarInset({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot='sidebar-inset'
      className={cn(
        'bg-background relative w-full flex flex-1 flex-col',
        'md:peer-data-[variant=inset]:m-4 md:peer-data-[variant=inset]:ms-0 md:peer-data-[variant=inset]:rounded-xl md:peer-data-[variant=inset]:shadow-sm md:peer-data-[variant=inset]:peer-data-[state=collapsed]:ms-2',
        className
      )}
      {...props}
    />
  )
}

function SidebarInput({
  className,
  ...props
}: React.ComponentProps<typeof Input>) {
  return (
    <Input
      data-slot='sidebar-input'
      data-sidebar='input'
      className={cn('bg-surface-1 h-8 w-full shadow-none', className)}
      {...props}
    />
  )
}

function SidebarHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot='sidebar-header'
      data-sidebar='header'
      className={cn('flex flex-col gap-2 p-1', className)}
      {...props}
    />
  )
}

function SidebarFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot='sidebar-footer'
      data-sidebar='footer'
      className={cn('flex flex-col gap-2 p-2', className)}
      {...props}
    />
  )
}

function SidebarSeparator({
  className,
  ...props
}: React.ComponentProps<typeof Separator>) {
  return (
    <Separator
      data-slot='sidebar-separator'
      data-sidebar='separator'
      className={cn('bg-sidebar-border mx-2 w-auto', className)}
      {...props}
    />
  )
}

function SidebarContent({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot='sidebar-content'
      data-sidebar='content'
      className={cn('flex min-h-0 flex-1 flex-col overflow-hidden', className)}
      {...props}
    />
  )
}

function SidebarGroup({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot='sidebar-group'
      data-sidebar='group'
      className={cn(
        'relative flex w-full min-w-0 flex-col px-2 py-1.5',
        className
      )}
      {...props}
    />
  )
}

function SidebarGroupLabel({
  className,
  asChild = false,
  ...props
}: React.ComponentProps<'div'> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'div'

  return (
    <Comp
      data-slot='sidebar-group-label'
      data-sidebar='group-label'
      className={cn(
        'text-sidebar-foreground/70 ring-sidebar-ring flex h-8 shrink-0 items-center rounded-md px-2 text-xs font-medium outline-hidden transition-[margin,opacity] duration-200 ease-linear focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0',
        'group-data-[collapsible=icon]:-mt-8 group-data-[collapsible=icon]:opacity-0 group-data-[collapsible=icon]:pointer-events-none',
        className
      )}
      {...props}
    />
  )
}

function SidebarGroupAction({
  className,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'button'

  return (
    <Comp
      data-slot='sidebar-group-action'
      data-sidebar='group-action'
      className={cn(
        'text-sidebar-foreground ring-sidebar-ring hover:bg-sidebar-hover hover:text-sidebar-foreground absolute end-3 top-3.5 flex aspect-square w-5 items-center justify-center rounded-md p-0 outline-hidden transition-transform focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0',
        // Increases the hit area of the button on mobile.
        'after:absolute after:-inset-2 lg:after:hidden',
        'group-data-[collapsible=icon]:hidden',
        className
      )}
      {...props}
    />
  )
}

function SidebarGroupContent({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot='sidebar-group-content'
      data-sidebar='group-content'
      className={cn('w-full text-sm', className)}
      {...props}
    />
  )
}

function SidebarMenu({ className, ...props }: React.ComponentProps<'ul'>) {
  return (
    <ul
      data-slot='sidebar-menu'
      data-sidebar='menu'
      className={cn('flex w-full min-w-0 flex-col gap-1', className)}
      {...props}
    />
  )
}

function SidebarMenuItem({ className, ...props }: React.ComponentProps<'li'>) {
  return (
    <li
      data-slot='sidebar-menu-item'
      data-sidebar='menu-item'
      className={cn('group/menu-item relative', className)}
      {...props}
    />
  )
}

const sidebarMenuButtonVariants = cva(
  'peer/menu-button flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-start text-sm outline-hidden ring-sidebar-ring transition-[background-color,color,border-color] duration-150 ease-out hover:bg-sidebar-hover hover:text-sidebar-foreground focus-visible:ring-2 active:bg-sidebar-active active:text-sidebar-foreground disabled:pointer-events-none disabled:opacity-50 group-has-data-[sidebar=menu-action]/menu-item:pe-8 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-[active=true]:bg-sidebar-active data-[active=true]:font-medium data-[active=true]:text-primary data-[active=true]:hover:bg-sidebar-active data-[state=open]:hover:bg-sidebar-hover data-[state=open]:hover:text-sidebar-foreground group-data-[collapsible=icon]:!size-8 group-data-[collapsible=icon]:!w-8 group-data-[collapsible=icon]:!p-2 group-data-[collapsible=icon]:!gap-0 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:[&>span]:hidden [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'hover:bg-sidebar-hover hover:text-sidebar-foreground',
        outline:
          'bg-surface-1 border border-sidebar-border hover:bg-sidebar-hover hover:text-sidebar-foreground hover:border-border-strong',
        primary:
          'bg-primary text-primary-foreground border border-primary/50 shadow-sm hover:bg-primary/90 hover:text-primary-foreground',
      },
      size: {
        default: 'h-8 text-sm',
        sm: 'h-7 text-xs',
        lg: 'h-12 text-sm group-data-[collapsible=icon]:p-0!',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

function SidebarMenuButton({
  asChild = false,
  isActive = false,
  variant = 'default',
  size = 'default',
  tooltip,
  className,
  ...props
}: React.ComponentProps<'button'> & {
  asChild?: boolean
  isActive?: boolean
  tooltip?: string | React.ComponentProps<typeof TooltipContent>
} & VariantProps<typeof sidebarMenuButtonVariants>) {
  const Comp = asChild ? Slot : 'button'
  const { isMobile, state } = useSidebar()

  const button = (
    <Comp
      data-slot='sidebar-menu-button'
      data-sidebar='menu-button'
      data-size={size}
      data-active={isActive}
      className={cn(sidebarMenuButtonVariants({ variant, size }), className)}
      {...props}
    />
  )

  if (!tooltip) {
    return button
  }

  if (typeof tooltip === 'string') {
    tooltip = {
      children: tooltip,
    }
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent
        side='right'
        align='center'
        hidden={state !== 'collapsed' || isMobile}
        {...tooltip}
      />
    </Tooltip>
  )
}

function SidebarMenuAction({
  className,
  asChild = false,
  showOnHover = false,
  ...props
}: React.ComponentProps<'button'> & {
  asChild?: boolean
  showOnHover?: boolean
}) {
  const Comp = asChild ? Slot : 'button'

  return (
    <Comp
      data-slot='sidebar-menu-action'
      data-sidebar='menu-action'
      className={cn(
        'text-sidebar-foreground ring-sidebar-ring hover:bg-sidebar-hover hover:text-sidebar-foreground peer-hover/menu-button:text-sidebar-foreground absolute end-1 top-1.5 flex aspect-square w-5 items-center justify-center rounded-md p-0 outline-hidden transition-transform focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0',
        // Increases the hit area of the button on mobile.
        'after:absolute after:-inset-2 lg:after:hidden',
        'peer-data-[size=sm]/menu-button:top-1',
        'peer-data-[size=default]/menu-button:top-1.5',
        'peer-data-[size=lg]/menu-button:top-2.5',
        'group-data-[collapsible=icon]:hidden',
        showOnHover &&
          'peer-data-[active=true]/menu-button:text-sidebar-foreground group-focus-within/menu-item:opacity-100 group-hover/menu-item:opacity-100 data-[state=open]:opacity-100 lg:opacity-0',
        className
      )}
      {...props}
    />
  )
}

function SidebarMenuBadge({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot='sidebar-menu-badge'
      data-sidebar='menu-badge'
      className={cn(
        'text-sidebar-foreground pointer-events-none absolute end-1 flex h-5 min-w-5 items-center justify-center rounded-md px-1 text-xs font-medium tabular-nums select-none',
        'peer-hover/menu-button:text-sidebar-foreground peer-data-[active=true]/menu-button:text-sidebar-foreground',
        'peer-data-[size=sm]/menu-button:top-1',
        'peer-data-[size=default]/menu-button:top-1.5',
        'peer-data-[size=lg]/menu-button:top-2.5',
        'group-data-[collapsible=icon]:hidden',
        className
      )}
      {...props}
    />
  )
}

function SidebarMenuSkeleton({
  className,
  showIcon = false,
  ...props
}: React.ComponentProps<'div'> & {
  showIcon?: boolean
}) {
  // Random width between 50 to 90%.
  const width = React.useMemo(() => {
    return `${Math.floor(Math.random() * 40) + 50}%`
  }, [])

  return (
    <div
      data-slot='sidebar-menu-skeleton'
      data-sidebar='menu-skeleton'
      className={cn('flex h-8 items-center gap-2 rounded-md px-2', className)}
      {...props}
    >
      {showIcon && (
        <Skeleton
          className='size-4 rounded-md'
          data-sidebar='menu-skeleton-icon'
        />
      )}
      <Skeleton
        className='h-4 max-w-(--skeleton-width) flex-1'
        data-sidebar='menu-skeleton-text'
        style={
          {
            '--skeleton-width': width,
          } as React.CSSProperties
        }
      />
    </div>
  )
}

function SidebarMenuSub({ className, ...props }: React.ComponentProps<'ul'>) {
  return (
    <ul
      data-slot='sidebar-menu-sub'
      data-sidebar='menu-sub'
      className={cn(
        'border-sidebar-border mx-3.5 flex min-w-0 translate-x-px flex-col gap-1 border-s px-2.5 py-0.5',
        'group-data-[collapsible=icon]:hidden',
        className
      )}
      {...props}
    />
  )
}

function SidebarMenuSubItem({
  className,
  ...props
}: React.ComponentProps<'li'>) {
  return (
    <li
      data-slot='sidebar-menu-sub-item'
      data-sidebar='menu-sub-item'
      className={cn('group/menu-sub-item relative', className)}
      {...props}
    />
  )
}

function SidebarMenuSubButton({
  asChild = false,
  size = 'md',
  isActive = false,
  className,
  ...props
}: React.ComponentProps<'a'> & {
  asChild?: boolean
  size?: 'sm' | 'md'
  isActive?: boolean
}) {
  const Comp = asChild ? Slot : 'a'

  return (
    <Comp
      data-slot='sidebar-menu-sub-button'
      data-sidebar='menu-sub-button'
      data-size={size}
      data-active={isActive}
      className={cn(
        'text-sidebar-foreground ring-sidebar-ring hover:bg-sidebar-hover hover:text-sidebar-foreground active:bg-sidebar-active active:text-sidebar-foreground flex h-7 min-w-0 -translate-x-px items-center gap-2 overflow-hidden rounded-md px-2 outline-hidden focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-inherit',
        'data-[active=true]:bg-sidebar-active data-[active=true]:text-sidebar-foreground data-[active=true]:hover:bg-sidebar-active',
        size === 'sm' && 'text-xs',
        size === 'md' && 'text-sm',
        'group-data-[collapsible=icon]:hidden',
        className
      )}
      {...props}
    />
  )
}

export {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarResizeHandle,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
}
