import * as React from 'react'
import { cn } from '../../lib/utils'
import { useScreenSize } from '../../hooks/use-screen-size'
import { Button } from '../ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../ui/sheet'
import { PanelRightIcon, XIcon } from 'lucide-react'

// Cookie for persisting right panel state
const RIGHT_PANEL_COOKIE_NAME = 'right_panel_state'
const RIGHT_PANEL_COOKIE_MAX_AGE = 60 * 60 * 24 * 7 // 7 days
const RIGHT_PANEL_WIDTH = '20rem'
const RIGHT_PANEL_WIDTH_MOBILE = '20rem'

type RightPanelContextProps = {
  open: boolean
  setOpen: (open: boolean) => void
  openMobile: boolean
  setOpenMobile: (open: boolean) => void
  isMobile: boolean
  isLargeScreen: boolean
  togglePanel: () => void
}

const RightPanelContext = React.createContext<RightPanelContextProps | null>(null)

function useRightPanel() {
  const context = React.useContext(RightPanelContext)
  if (!context) {
    throw new Error('useRightPanel must be used within a RightPanelProvider.')
  }
  return context
}

function RightPanelProvider({
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
  const { isMobile, width } = useScreenSize()
  // Large screen: >= 1280px (xl breakpoint)
  const isLargeScreen = width >= 1280
  const [openMobile, setOpenMobile] = React.useState(false)

  // Internal state
  const [_open, _setOpen] = React.useState(() => {
    if (typeof document !== 'undefined') {
      const cookie = document.cookie
        .split('; ')
        .find((row) => row.startsWith(`${RIGHT_PANEL_COOKIE_NAME}=`))
      if (cookie) {
        return cookie.split('=')[1] !== 'false'
      }
    }
    return defaultOpen
  })

  const open = openProp ?? _open
  const setOpen = React.useCallback(
    (value: boolean | ((value: boolean) => boolean)) => {
      const openState = typeof value === 'function' ? value(open) : value
      if (setOpenProp) {
        setOpenProp(openState)
      } else {
        _setOpen(openState)
      }
      // Persist to cookie
      document.cookie = `${RIGHT_PANEL_COOKIE_NAME}=${openState}; path=/; max-age=${RIGHT_PANEL_COOKIE_MAX_AGE}`
    },
    [setOpenProp, open]
  )

  const togglePanel = React.useCallback(() => {
    if (isMobile) {
      setOpenMobile((prev) => !prev)
    } else {
      setOpen((prev) => !prev)
    }
  }, [isMobile, setOpen])

  const contextValue = React.useMemo<RightPanelContextProps>(
    () => ({
      open,
      setOpen,
      openMobile,
      setOpenMobile,
      isMobile,
      isLargeScreen,
      togglePanel,
    }),
    [open, setOpen, openMobile, setOpenMobile, isMobile, isLargeScreen, togglePanel]
  )

  return (
    <RightPanelContext.Provider value={contextValue}>
      <div
        data-slot="right-panel-wrapper"
        style={
          {
            '--right-panel-width': RIGHT_PANEL_WIDTH,
            ...style,
          } as React.CSSProperties
        }
        className={cn('flex h-full w-full', className)}
        {...props}
      >
        {children}
      </div>
    </RightPanelContext.Provider>
  )
}

type RightPanelProps = React.ComponentProps<'div'> & {
  children?: React.ReactNode
}

function RightPanel({ className, children, ...props }: RightPanelProps) {
  const { isMobile, isLargeScreen, open, openMobile, setOpenMobile } = useRightPanel()

  // Hidden on small/medium screens (shown as drawer on mobile)
  if (isMobile) {
    return (
      <Sheet open={openMobile} onOpenChange={setOpenMobile}>
        <SheetContent
          data-slot="right-panel"
          className="bg-background text-foreground w-(--right-panel-width) p-0"
          style={
            {
              '--right-panel-width': RIGHT_PANEL_WIDTH_MOBILE,
            } as React.CSSProperties
          }
          side="right"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Details Panel</SheetTitle>
            <SheetDescription>Contextual information and details.</SheetDescription>
          </SheetHeader>
          <div className="flex h-full w-full flex-col">{children}</div>
        </SheetContent>
      </Sheet>
    )
  }

  // Hidden on medium screens (between mobile and xl)
  if (!isLargeScreen) {
    return null
  }

  // Desktop: only show when open
  if (!open) {
    return null
  }

  return (
    <div
      data-slot="right-panel"
      className={cn(
        'hidden xl:flex',
        'h-full w-(--right-panel-width) flex-shrink-0 flex-col',
        'border-l border-border bg-background',
        'overflow-hidden',
        'transition-[width,opacity] duration-200 ease-linear',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

function RightPanelHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="right-panel-header"
      className={cn('flex flex-shrink-0 items-center gap-2 border-b p-4', className)}
      {...props}
    />
  )
}

function RightPanelContent({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="right-panel-content"
      className={cn('flex-1 overflow-auto p-4', className)}
      {...props}
    />
  )
}

function RightPanelFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="right-panel-footer"
      className={cn('flex-shrink-0 border-t p-4', className)}
      {...props}
    />
  )
}

function RightPanelTrigger({
  className,
  onClick,
  ...props
}: React.ComponentProps<typeof Button>) {
  const { togglePanel, open, isLargeScreen, isMobile } = useRightPanel()

  // Only show on large screens or when there's mobile context
  if (!isLargeScreen && !isMobile) {
    return null
  }

  return (
    <Button
      data-slot="right-panel-trigger"
      variant="ghost"
      size="icon"
      className={cn('size-8', className)}
      onClick={(event) => {
        onClick?.(event)
        togglePanel()
      }}
      {...props}
    >
      {open ? <XIcon className="size-5" /> : <PanelRightIcon className="size-5" />}
      <span className="sr-only">Toggle Right Panel</span>
    </Button>
  )
}

function RightPanelCloseButton({
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  const { setOpen, setOpenMobile, isMobile } = useRightPanel()

  return (
    <Button
      data-slot="right-panel-close"
      variant="ghost"
      size="icon"
      className={cn('size-8', className)}
      onClick={() => {
        if (isMobile) {
          setOpenMobile(false)
        } else {
          setOpen(false)
        }
      }}
      {...props}
    >
      <XIcon className="size-4" />
      <span className="sr-only">Close Panel</span>
    </Button>
  )
}

export {
  RightPanel,
  RightPanelProvider,
  RightPanelHeader,
  RightPanelContent,
  RightPanelFooter,
  RightPanelTrigger,
  RightPanelCloseButton,
  useRightPanel,
}
