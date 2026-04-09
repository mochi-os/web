import { useLayout } from '../../context/layout-provider'
import { useScreenSize } from '../../hooks/use-screen-size'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { cn } from '../../lib/utils'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '../ui/sidebar'
import { NavGroup } from './nav-group'
import { Button } from '../ui/button'
import { Skeleton } from '../ui/skeleton'
import { MochiMenu } from './mochi-menu'

import type { SidebarData } from './types'

type AppSidebarProps = {
  data: SidebarData
  showNotifications?: boolean
  sidebarFooter?: React.ReactNode
  isLoading?: boolean
  hideMenu?: boolean
}

function CollapseBtn() {
  const { toggleSidebar, state } = useSidebar()
  const label = state === 'expanded' ? 'Collapse sidebar' : 'Expand sidebar'

  return (
    <Button
      data-sidebar='trigger'
      variant='outline'
      size='icon'
      title={label}
      aria-label={label}
      className={cn(
        'absolute -right-3 top-1/2 -translate-y-1/2 z-50',
        'h-6 w-6 rounded-full border bg-background shadow-md',
        'hover:bg-accent hover:text-accent-foreground',
        'inline-flex'
      )}
      onClick={toggleSidebar}
    >
      {state === 'expanded' ? (
        <ChevronLeft className='h-3 w-3' />
      ) : (
        <ChevronRight className='h-3 w-3' />
      )}
      <span className='sr-only'>{label}</span>
    </Button>
  )
}

export function AppSidebar({
  data,
  showNotifications = true,
  sidebarFooter,
  isLoading,
  hideMenu,
}: AppSidebarProps) {
  const { collapsible } = useLayout()
  const { isTablet } = useScreenSize()
  const { isMobile, state, setOpenMobile } = useSidebar()
  // On tablet, always use icon-rail collapse regardless of user layout preference
  const effectiveCollapsible = isTablet ? 'icon' : collapsible

  return (
    <Sidebar collapsible={effectiveCollapsible} variant='sidebar'>
      {isMobile ? (
        <SidebarHeader>
          <div className='flex items-center gap-2 px-2 py-1'>
            <a href='/' title='Home' className='flex items-center gap-2'>
              <img
                src='/images/logo-header.svg'
                alt='Mochi'
                className='h-6 w-6'
              />
              <span className='text-sm font-semibold'>mochi</span>
            </a>
            <div className='flex-1' />
            <Button
              type='button'
              variant='ghost'
              size='icon'
              className='size-7'
              onClick={() => setOpenMobile(false)}
              aria-label='Close navigation'
            >
              <X className='size-4' />
            </Button>
          </div>
        </SidebarHeader>
      ) : (
        <SidebarHeader className={hideMenu ? (state === 'collapsed' ? 'min-h-20' : 'min-h-10') : undefined}>
          {!hideMenu && (
            <SidebarMenu>
              <SidebarMenuItem>
                <MochiMenu
                  direction={state === 'expanded' ? 'horizontal' : 'vertical'}
                  showNotifications={showNotifications}
                  className='p-2'
                />
              </SidebarMenuItem>
            </SidebarMenu>
          )}
        </SidebarHeader>
      )}

      <SidebarContent className='overflow-y-auto'>
        {isLoading ? (
          <div className='space-y-4 px-2 py-2'>
            <div className='space-y-2'>
              <div className='px-2 py-1.5'>
                <Skeleton className='h-4 w-20' />
              </div>
              <div className='space-y-1'>
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className='flex items-center gap-2 px-2 py-1'>
                    <Skeleton className='size-4 rounded-sm' />
                    <Skeleton className='h-4 w-32' />
                  </div>
                ))}
              </div>
            </div>

            <div className='space-y-2'>
              <div className='px-2 py-1.5'>
                <Skeleton className='h-4 w-16' />
              </div>
              <div className='space-y-1'>
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className='flex items-center gap-2 px-2 py-1'>
                    <Skeleton className='size-4 rounded-sm' />
                    <Skeleton className='h-4 w-24' />
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            {(() => {
              const primary = data.navGroups
                .flatMap((g) => g.items)
                .find((i) => i.variant === 'primary' && 'onClick' in i)

              if (!primary || !('onClick' in primary)) return null

              return (
                <SidebarGroup>
                  <SidebarMenu>
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        variant='primary'
                        onClick={primary.onClick}
                      >
                        {primary.icon && <primary.icon className='size-5' />}
                        <span className='group-data-[collapsible=icon]:hidden'>
                          {primary.title}
                        </span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </SidebarMenu>
                </SidebarGroup>
              )
            })()}

            {data.navGroups.map((group) => (
              <NavGroup
                key={group.title}
                {...group}
                items={group.items.filter((i) => i.variant !== 'primary')}
              />
            ))}
          </>
        )}
      </SidebarContent>

      {sidebarFooter && <SidebarFooter>{sidebarFooter}</SidebarFooter>}

      <CollapseBtn />
    </Sidebar>
  )
}
