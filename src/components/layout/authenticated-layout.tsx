import { useEffect } from 'react'
import { Outlet } from '@tanstack/react-router'

import { cn } from '../../lib/utils'
import { getCookie } from '../../lib/cookies'
import { isDomainEntityRouting } from '../../lib/app-path'
import { useAuthStore } from '../../stores/auth-store'

import { LayoutProvider } from '../../context/layout-provider'
import { SearchProvider } from '../../context/search-provider'

import { SidebarInset, SidebarProvider } from '../ui/sidebar'
import { TopBar } from './top-bar'
import { AppSidebar } from './app-sidebar'
import { useVerifySession } from '../../hooks/use-verify-session'

import {
  RightPanel,
  RightPanelProvider,
  RightPanelHeader,
  RightPanelContent,
  RightPanelFooter,
  RightPanelCloseButton,
} from './right-panel'

import type { SidebarData } from './types'

/* ------------------------------------------------------------------ */
/* Types */
/* ------------------------------------------------------------------ */

type RightPanelConfig = {
  header?: React.ReactNode
  content?: React.ReactNode
  footer?: React.ReactNode
  headerClassName?: string
  contentClassName?: string
  footerClassName?: string
  showCloseButton?: boolean
}

type AuthenticatedLayoutProps = {
  children?: React.ReactNode
  sidebarData?: SidebarData
  sidebarFooter?: React.ReactNode
  showNotifications?: boolean
  title?: string
  mobileTitle?: React.ReactNode
  rightPanel?: RightPanelConfig
  rightPanelDefaultOpen?: boolean
  isLoadingSidebar?: boolean
}

/* ------------------------------------------------------------------ */
/* Layout */
/* ------------------------------------------------------------------ */

export function AuthenticatedLayout({
  children,
  sidebarData,
  showNotifications = true,
  title,
  mobileTitle: _mobileTitle,
  sidebarFooter,
  rightPanel,
  rightPanelDefaultOpen = true,
  isLoadingSidebar,
}: AuthenticatedLayoutProps) {
  useVerifySession()

  useEffect(() => {
    if (title) document.title = title
  }, [title])

  const isLoggedIn = useAuthStore((state) => state.isAuthenticated)
  const isLogoutInProgress = useAuthStore((state) => state.isLogoutInProgress)

  const defaultOpen = getCookie('sidebar_state') !== 'false'
  const hasSidebar = !!(sidebarData && sidebarData.navGroups.length > 0)
  const hasRightPanel =
    !!rightPanel &&
    !!(rightPanel.header || rightPanel.content || rightPanel.footer)

  if (isLogoutInProgress) {
    return (
      <div className='flex h-svh w-full items-center justify-center bg-background px-4'>
        <div className='text-center'>
          <p className='text-sm font-medium'>Signing out...</p>
          <p className='text-muted-foreground mt-1 text-sm'>
            Redirecting to login.
          </p>
        </div>
      </div>
    )
  }

  /* ------------------------------------------------------------------
   * Anonymous users (logged out)
   * ------------------------------------------------------------------ */
  if (!isLoggedIn) {
    const isDomainRouted = isDomainEntityRouting()

    return (
      <SearchProvider>
        <LayoutProvider>
          <SidebarProvider defaultOpen={defaultOpen}>
            <div className='relative h-svh w-full'>
              {/* Floating TopBar for main site only */}
              {!isDomainRouted && (
                <div className='absolute top-2 left-2 z-50'>
                  <TopBar showNotifications={false} />
                </div>
              )}

              {/* Full-page content */}
              <div className={cn('@container/content', 'h-full overflow-auto')}>
                {children ?? <Outlet />}
              </div>
            </div>
          </SidebarProvider>
        </LayoutProvider>
      </SearchProvider>
    )
  }

  /* ------------------------------------------------------------------
   * Authenticated layout
   * ------------------------------------------------------------------ */

  const layoutContent = (
    <div className='flex h-svh w-full'>
      {hasSidebar ? (
        <>
          {/* Desktop sidebar */}
          <AppSidebar
            data={sidebarData}
            showNotifications={showNotifications}
            sidebarFooter={sidebarFooter}
            isLoading={isLoadingSidebar}
          />

          {/* Mobile TopBar */}
          <header className='fixed top-0 left-0 right-0 z-[60] h-12 border-b bg-background md:hidden overflow-visible'>
            <div className='flex h-full items-center px-2 overflow-visible'>
              <TopBar
                showNotifications={showNotifications}
                showSidebarTrigger
              />
            </div>
          </header>

          {/* Main content */}
          <SidebarInset
            className={cn(
              '@container/content',
              'flex-1 h-full overflow-auto',
              'pt-12 md:pt-0'
            )}
          >
            {children ?? <Outlet />}
          </SidebarInset>

          {/* Right panel */}
          {hasRightPanel && (
            <RightPanel className='h-full'>
              {(rightPanel.header || rightPanel.showCloseButton) && (
                <RightPanelHeader className={rightPanel.headerClassName}>
                  <div className='flex-1'>{rightPanel.header}</div>
                  {rightPanel.showCloseButton && <RightPanelCloseButton />}
                </RightPanelHeader>
              )}

              {rightPanel.content && (
                <RightPanelContent className={rightPanel.contentClassName}>
                  {rightPanel.content}
                </RightPanelContent>
              )}

              {rightPanel.footer && (
                <RightPanelFooter className={rightPanel.footerClassName}>
                  {rightPanel.footer}
                </RightPanelFooter>
              )}
            </RightPanel>
          )}
        </>
      ) : (
        <>
          {/* No sidebar layout */}

          {/* Mobile */}
          <div className='flex h-12 items-center border-b px-2 md:hidden'>
            <TopBar showNotifications={showNotifications} />
            {_mobileTitle && (
              <>
                <div className='flex-1' />
                <div className='pr-2'>{_mobileTitle}</div>
              </>
            )}
          </div>

          {/* Desktop vertical TopBar */}
          <div className='hidden md:flex h-full'>
            <TopBar showNotifications={showNotifications} vertical />
          </div>

          {/* Content */}
          <div className={cn('@container/content', 'flex-1 overflow-auto')}>
            {children ?? <Outlet />}
          </div>

          {/* Right panel */}
          {hasRightPanel && (
            <RightPanel className='h-full'>
              {(rightPanel.header || rightPanel.showCloseButton) && (
                <RightPanelHeader className={rightPanel.headerClassName}>
                  <div className='flex-1'>{rightPanel.header}</div>
                  {rightPanel.showCloseButton && <RightPanelCloseButton />}
                </RightPanelHeader>
              )}

              {rightPanel.content && (
                <RightPanelContent className={rightPanel.contentClassName}>
                  {rightPanel.content}
                </RightPanelContent>
              )}

              {rightPanel.footer && (
                <RightPanelFooter className={rightPanel.footerClassName}>
                  {rightPanel.footer}
                </RightPanelFooter>
              )}
            </RightPanel>
          )}
        </>
      )}
    </div>
  )

  /* ------------------------------------------------------------------ */

  return (
    <SearchProvider>
      <LayoutProvider>
        <SidebarProvider defaultOpen={defaultOpen}>
          {hasRightPanel ? (
            <RightPanelProvider defaultOpen={rightPanelDefaultOpen}>
              {layoutContent}
            </RightPanelProvider>
          ) : (
            layoutContent
          )}
        </SidebarProvider>
      </LayoutProvider>
    </SearchProvider>
  )
}
