// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '../ui/sidebar'

type AppTitleProps = {
  title: string
  subtitle?: string
}

export function AppTitle({ title, subtitle = 'Mochi OS' }: AppTitleProps) {
  const { setOpenMobile } = useSidebar()
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          size='lg'
          className='gap-0 py-0 hover:bg-transparent active:bg-transparent'
          asChild
        >
          <div>
            <a
              href='/'
              onClick={() => setOpenMobile(false)}
              className='flex flex-1 items-center gap-2 text-start text-sm leading-tight'
            >
              <img
                src='./images/logo-header.png'
                alt='Mochi'
                className='h-6 w-6 shrink-0'
              />
              <div className='grid flex-1 text-start leading-tight'>
                <span className='truncate font-bold'>{title}</span>
                <span className='truncate text-xs'>{subtitle}</span>
              </div>
            </a>
          </div>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
