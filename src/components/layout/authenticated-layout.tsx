// Copyright © 2026 Mochi OÜ
// SPDX-License-Identifier: Apache-2.0

import { useEffect } from 'react'
import { Trans } from '@lingui/react/macro'
import { Outlet } from '@tanstack/react-router'

import { cn } from '../../lib/utils'
import { getCookie } from '../../lib/cookies'
import { isInShell, installShellLinkInterceptor, installShellNavigationSync, installShellClipboardProxy, getShellInitData, shellSetSidebarPresent } from '../../lib/shell-bridge'
import { useAuthStore } from '../../stores/auth-store'

import { LayoutProvider } from '../../context/layout-provider'
import { LocaleProvider } from '../../context/locale-provider'
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
  usePageHeaderForMobileNav?: boolean
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

  useEffect(() => {
    const root = document.documentElement
    if (inShell) {
      root.style.setProperty('--sheet-top-offset', '0px')
    } else {
      root.style.removeProperty('--sheet-top-offset')
    }

    return () => {
      root.style.removeProperty('--sheet-top-offset')
    }
  }, [inShell])

  const isLoggedIn = useAuthStore((state) => state.isAuthenticated)
  const isLogoutInProgress = useAuthStore((state) => state.isLogoutInProgress)

  // When in shell, suppress notifications in the app (menu app handles them)
  const effectiveShowNotifications = inShell ? false : showNotifications

  const shellInit = getShellInitData()
  const defaultOpen = inShell
    ? shellInit?.sidebarOpen !== false
    : getCookie('sidebar_state') !== 'false'
  const hasSidebar = !!(sidebarData && sidebarData.navGroups.length > 0)

  // Inform the shell whether this app has a sidebar. The shell menu uses this
  // to decide whether to apply the persisted collapse state to its layout —
  // sidebar-less apps (e.g. home) should always render the menu horizontally.
  useEffect(() => {
    if (inShell) shellSetSidebarPresent(hasSidebar)
  }, [inShell, hasSidebar])
  const hasRightPanel =
    !!rightPanel &&
    !!(rightPanel.header || rightPanel.content || rightPanel.footer)

  if (isLogoutInProgress) {
    return (
      <div className='flex h-svh w-full items-center justify-center bg-background px-4'>
        <div className='text-center'>
          <p className='text-sm font-medium'><Trans>Signing out...</Trans></p>
          <p className='text-muted-foreground mt-1 text-sm'>
            <Trans>Redirecting to login.</Trans>
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
      <LocaleProvider>
        <SearchProvider>
          <LayoutProvider>
            <SidebarProvider defaultOpen={defaultOpen}>
              <div className={cn('@container/content', 'h-svh w-full overflow-auto')}>
                {children ?? <Outlet />}
              </div>
            </SidebarProvider>
          </LayoutProvider>
        </SearchProvider>
      </LocaleProvider>
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
              <header className='fixed top-0 left-0 right-0 z-[60] h-12 overflow-visible border-b bg-background md:hidden'>
                <div className='flex h-full items-center overflow-visible px-2'>
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
                !inShell && 'pt-12 md:pt-0'
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

            {/* Content — add left padding at desktop widths in shell to
                clear the fixed menu overlay (logo + trigger button laid
                out horizontally is ~88px wide; ps-24 = 96px). At mobile
                widths the shell template positions the iframe below the
                full-width menu bar (top: var(--shell-mobile-topbar-height)
                in shell.html), so no padding is needed there. */}
            <div
              className={cn(
                '@container/content',
                'min-h-0 min-w-0 flex-1 overflow-auto',
                inShell && 'md:ps-24'
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
    <LocaleProvider>
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
    </LocaleProvider>
  )
}
