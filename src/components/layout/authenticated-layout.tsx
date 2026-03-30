import { useEffect } from 'react'
import { Outlet } from '@tanstack/react-router'

import { cn } from '../../lib/utils'
import { getCookie } from '../../lib/cookies'
import { isInShell, installShellLinkInterceptor, installShellNavigationSync, installShellClipboardProxy, getShellInitData } from '../../lib/shell-bridge'
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
  // Skip session verification when in shell — shell guarantees authentication
  const inShell = isInShell()
  useVerifySession(!inShell)

  // Install shell interceptors (link clicks + navigation sync via pushState monkey-patch)
  useEffect(() => {
    if (inShell) {
      installShellLinkInterceptor()
      installShellNavigationSync()
      installShellClipboardProxy()
    }
  }, [inShell])

  useEffect(() => {
    if (title) document.title = title
  }, [title])

  const isLoggedIn = useAuthStore((state) => state.isAuthenticated)
  const isLogoutInProgress = useAuthStore((state) => state.isLogoutInProgress)

  // When in shell, suppress notifications in the app (menu app handles them)
  const effectiveShowNotifications = inShell ? false : showNotifications

  const shellInit = getShellInitData()
  const defaultOpen = inShell
    ? shellInit?.sidebarOpen !== false
    : getCookie('sidebar_state') !== 'false'
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
    return (
      <SearchProvider>
        <LayoutProvider>
          <SidebarProvider defaultOpen={defaultOpen}>
            <div className={cn('@container/content', 'h-svh w-full overflow-auto')}>
              {children ?? <Outlet />}
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
    <div
      className={cn(
        'h-svh w-full',
        hasSidebar ? 'flex' : 'flex flex-col lg:flex-row'
      )}
    >
      {hasSidebar ? (
        <>
          {/* Desktop sidebar */}
          <AppSidebar
            data={sidebarData}
            showNotifications={effectiveShowNotifications}
            sidebarFooter={sidebarFooter}
            isLoading={isLoadingSidebar}
            hideMenu={inShell}
          />

          {/* Mobile TopBar (hidden in shell — menu app provides the header) */}
          {!inShell && (
            <header className='fixed top-0 left-0 right-0 z-[60] h-12 border-b bg-background lg:hidden overflow-visible'>
              <div className='flex h-full items-center px-2 overflow-visible'>
                <TopBar
                  showNotifications={effectiveShowNotifications}
                  showSidebarTrigger
                />
              </div>
            </header>
          )}

          {/* Main content */}
          <SidebarInset
            className={cn(
              '@container/content',
              'flex-1 h-full overflow-auto',
              !inShell && 'pt-12 lg:pt-0 [--sticky-top:3rem] lg:[--sticky-top:0px]'
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

          {/* Mobile (hidden in shell — menu app provides the header) */}
          {!inShell && (
            <div
              className={cn(
                'flex h-12 shrink-0 items-center px-2 lg:hidden',
                !_mobileTitle && 'border-b'
              )}
            >
              <TopBar
                showNotifications={showNotifications}
                className='w-full'
                mobileTitle={_mobileTitle}
              />
            </div>
          )}

          {/* Desktop vertical TopBar (hidden in shell) */}
          {!inShell && (
            <div className='hidden h-full shrink-0 lg:flex'>
              <TopBar showNotifications={showNotifications} vertical />
            </div>
          )}

          {/* Content — add left padding in shell to clear the fixed menu overlay */}
          <div
            className={cn(
              '@container/content',
              'min-h-0 min-w-0 flex-1 overflow-auto',
              inShell && 'pl-12'
            )}
          >
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
