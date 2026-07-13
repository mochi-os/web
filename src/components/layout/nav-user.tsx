// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { useEffect } from 'react'
import { Trans } from '@lingui/react/macro'
import {
  ChevronsUpDown,
  LogOut,
  Moon,
  CircleUser,
  Settings,
} from 'lucide-react'
import { useAuthStore } from '../../stores/auth-store'

import { useTheme } from '../../context/theme-provider'
import { useScreenSize } from '../../hooks/use-screen-size'
import useDialogState from '../../hooks/use-dialog-state'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '../ui/drawer'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '../ui/sidebar'
import { Switch } from '../ui/switch'
import { SignOutDialog } from '../sign-out-dialog'

export function NavUser() {
  const { isMobile } = useSidebar()
  const { isDesktop } = useScreenSize()
  const [open, setOpen] = useDialogState()
  const [dropdownOpen, setDropdownOpen] = useDialogState()
  const { resolvedTheme, setTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const name = useAuthStore((state) => state.name)
  const displayName = name || 'User'

  /* Update theme-color meta tag when theme is updated */
  useEffect(() => {
    const themeColor = resolvedTheme === 'dark' ? '#1a1a1a' : '#fff'
    const metaThemeColor = document.querySelector("meta[name='theme-color']")
    if (metaThemeColor) metaThemeColor.setAttribute('content', themeColor)
  }, [resolvedTheme])

  const triggerButton = (
    <SidebarMenuButton
      size='lg'
      className='data-[state=open]:bg-hover data-[state=open]:text-hover-foreground group-data-[collapsible=icon]:!size-8 group-data-[collapsible=icon]:!p-2'
    >
      <CircleUser className='hidden size-4 group-data-[collapsible=icon]:block' />
      <div className='grid flex-1 text-start text-sm leading-tight group-data-[collapsible=icon]:hidden'>
        <span className='truncate font-semibold'>{displayName}</span>
      </div>
      <ChevronsUpDown className='ms-auto size-4 group-data-[collapsible=icon]:hidden' />
    </SidebarMenuButton>
  )

  const menuContent = (
    <>
      <DropdownMenuLabel className='p-0 font-normal'>
        <div className='grid px-2 py-1.5 text-start text-sm leading-tight'>
          <span className='truncate font-semibold'>{displayName}</span>
        </div>
      </DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuItem asChild>
        <a href='/settings/' className='flex items-center gap-2'>
          <Settings size={16} />
          <Trans>Settings</Trans>
        </a>
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <div className="flex items-center justify-between px-2 py-1.5 text-sm select-none">
        <div className="flex items-center gap-2">
          <Moon className="size-4" />
          <Trans>Dark mode</Trans>
        </div>
        <Switch 
          checked={isDark} 
          onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')} 
        />
      </div>
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={() => setOpen(true)}>
        <LogOut className='size-4' />
        <Trans>Log out</Trans>
      </DropdownMenuItem>
    </>
  )

  if (isDesktop) {
    return (
      <>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu open={!!dropdownOpen} onOpenChange={setDropdownOpen}>
              <DropdownMenuTrigger asChild>{triggerButton}</DropdownMenuTrigger>
              <DropdownMenuContent
                className='w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg'
                side={isMobile ? 'bottom' : 'right'}
                align='end'
                sideOffset={4}
              >
                {menuContent}
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
        <SignOutDialog open={!!open} onOpenChange={setOpen} />
      </>
    )
  }

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <Drawer open={!!dropdownOpen} onOpenChange={setDropdownOpen}>
            <DrawerTrigger asChild>{triggerButton}</DrawerTrigger>
            <DrawerContent>
              <DrawerHeader>
                <DrawerTitle className='sr-only'><Trans>Profile</Trans></DrawerTitle>
              </DrawerHeader>
              <div className='px-4 pb-4'>
                <div className='mb-4 pb-4 border-b'>
                  <div className='grid text-start text-sm leading-tight'>
                    <span className='truncate font-semibold'>{displayName}</span>
                  </div>
                </div>
                <div className='flex flex-col gap-2'>
                  <a href='/settings/' className='flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-hover rounded-md'>
                    <Settings size={16} />
                    <Trans>Settings</Trans>
                  </a>
                  
                  <div className='flex items-center justify-between px-2 py-1.5 text-sm hover:bg-hover rounded-md'>
                    <div className='flex items-center gap-2'>
                      <Moon size={16} />
                      <Trans>Dark mode</Trans>
                    </div>
                    <Switch 
                      checked={isDark} 
                      onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')} 
                    />
                  </div>

                  <button
                    onClick={() => setOpen(true)}
                    className='flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-hover rounded-md'
                  >
                    <LogOut size={16} />
                    <Trans>Log out</Trans>
                  </button>
                </div>
              </div>
            </DrawerContent>
          </Drawer>
        </SidebarMenuItem>
      </SidebarMenu>
      <SignOutDialog open={!!open} onOpenChange={setOpen} />
    </>
  )
}

export function NavUserDropdownContent() {
  const [open, setOpen] = useDialogState()
  const { resolvedTheme, setTheme } = useTheme()

  const name = useAuthStore((state) => state.name)
  const displayName = name || 'User'

  return (
    <>
      <DropdownMenuLabel className='p-0 font-normal'>
        <div className='grid px-2 py-1.5 text-start text-sm leading-tight'>
          <span className='truncate font-semibold'>{displayName}</span>
        </div>
      </DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuItem asChild>
        <a href='/settings/' className='flex items-center gap-2'>
          <Settings size={16} />
          <Trans>Settings</Trans>
        </a>
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <div className="flex items-center justify-between px-2 py-1.5 text-sm select-none">
        <div className="flex items-center gap-2">
          <Moon className="size-4" />
          <Trans>Dark mode</Trans>
        </div>
        <Switch
          checked={resolvedTheme === 'dark'}
          onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
        />
      </div>
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={() => setOpen(true)}>
        <LogOut className='size-4' />
        <Trans>Log out</Trans>
      </DropdownMenuItem>
      <SignOutDialog open={!!open} onOpenChange={setOpen} />
    </>
  )
}
