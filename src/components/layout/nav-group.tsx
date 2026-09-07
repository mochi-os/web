// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { forwardRef, type ReactNode } from 'react'
import { Link, useLocation } from '@tanstack/react-router'
import { useLingui } from '@lingui/react/macro'
import { ChevronRight, Circle, MoreHorizontal } from 'lucide-react'
import { cn } from '../../lib/utils'
import { useListAutoAnimate } from '../../hooks/use-list-auto-animate'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '../ui/collapsible'
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction as SidebarItemAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarSeparator,
  useSidebar,
} from '../ui/sidebar'
import { Badge } from '../ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip'
import {
  type NavAction,
  type NavCollapsible,
  type NavItem,
  type NavLink,
  type NavMenuItem,
  type NavSubCollapsible,
  type NavSubItem,
  type NavGroup as NavGroupProps,
} from './types'

// Type guards
function isNavAction(item: NavItem | NavSubCollapsible | { url?: string; onClick?: () => void; items?: unknown[] }): item is NavAction {
  return 'onClick' in item && typeof item.onClick === 'function' && !('items' in item && item.items)
}

function isNavLink(item: NavItem): item is NavLink {
  return 'url' in item && !('items' in item && item.items)
}

function isNavSubCollapsible(item: unknown): item is NavSubCollapsible {
  return typeof item === 'object' && item !== null && 'items' in item && Array.isArray((item as NavSubCollapsible).items)
}

// A sub-item's link. An external destination (another app) gets a plain
// anchor: the router cannot resolve it and would render this app's 404.
// Forwards its ref so a Slot parent (DropdownMenuItem asChild) can focus it.
const SubItemLink = forwardRef<
  HTMLAnchorElement,
  React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    url: NavLink['url']
    external?: boolean
    children: ReactNode
  }
>(function SubItemLink({ url, external, children, ...rest }, ref) {
  if (external) {
    return (
      <a ref={ref} href={url as string} {...rest}>
        {children}
      </a>
    )
  }
  return (
    <Link ref={ref} preload={false} to={url} {...rest}>
      {children}
    </Link>
  )
})

// Shows the item's icon, or a generic circle visible only in icon-collapsed mode.
// Aggregate ("All <items>") entries reuse the same glyph as their members,
// marked with a small hollow ring at the corner so they stay distinct even when
// the sidebar collapses to icons and the text label is hidden.
function ItemIcon({ icon: Icon, aggregate }: { icon?: React.ElementType; aggregate?: boolean }) {
  if (!Icon) return <Circle className='hidden group-data-[collapsible=icon]:block' />
  if (!aggregate) return <Icon />
  // The menu button hides direct <span> children in icon-collapsed mode to hide
  // the text label, and this wrapper is a <span>. The ! override forces it back
  // to inline-flex so the aggregate ring survives collapse.
  return (
    <span className='relative inline-flex shrink-0 group-data-[collapsible=icon]:!inline-flex'>
      <Icon className='size-4 shrink-0' />
      <span
        aria-hidden
        className='absolute -end-1 -top-1 size-1.5 rounded-full border border-current'
      />
    </span>
  )
}

function getNavItemKey(item: {
  id?: string
  title: string
  url?: unknown
}): string {
  if (item.id) return item.id
  if (item.url !== undefined && item.url !== '') {
    return `url:${String(item.url)}`
  }
  return `action:${item.title}`
}

export function NavGroup({
  title,
  items,
  separator,
  animateList = false,
}: NavGroupProps) {
  const { state, isMobile } = useSidebar()
  const pathname = useLocation({ select: (location) => location.pathname })
  const animationsDisabled =
    !animateList || (state === 'collapsed' && !isMobile)
  const [menuRef] = useListAutoAnimate<HTMLUListElement>({
    disabled: animationsDisabled,
  })

  return (
    <>
      {separator && <SidebarSeparator className='mx-2' />}
      <SidebarGroup>
      {title && <SidebarGroupLabel>{title}</SidebarGroupLabel>}
      <SidebarMenu ref={animateList ? menuRef : undefined}>
        {items.map((item) => {
          const key = getNavItemKey(item)

          if (isNavAction(item)) {
            return <SidebarMenuAction key={key} item={item} />
          }

          if (isNavLink(item)) {
            return <SidebarMenuLink key={key} item={item} pathname={pathname} />
          }

          if (state === 'collapsed' && !isMobile)
            return (
              <SidebarMenuCollapsedDropdown
                key={key}
                item={item}
                pathname={pathname}
              />
            )

          return (
            <SidebarMenuCollapsible key={key} item={item} pathname={pathname} />
          )
        })}
      </SidebarMenu>
    </SidebarGroup>
    </>
  )
}

function NavBadge({ children, className }: { children: ReactNode; className?: string }) {
  return <Badge variant='destructive' className={cn('rounded-full px-1 py-0 text-xs', className)}>{children}</Badge>
}

function NavTitle({ title, meta }: { title: string; meta?: string }) {
  return (
    <>
      {title}
      {meta ? (
        <span className='text-muted-foreground ms-1.5 text-[0.8125rem] font-semibold leading-none'>
          {meta}
        </span>
      ) : null}
    </>
  )
}

function navLinkTooltip(item: NavLink): string | { children: string; hidden: boolean } {
  if (item.tooltipAlways) {
    return { children: item.title, hidden: false }
  }
  return item.title
}

function NavLinkTrailing({ item }: { item: NavLink }) {
  const EndIcon = item.endIcon
  if (!EndIcon && !item.badge) return null

  return (
    <span className='ms-auto flex shrink-0 items-center gap-1'>
      {EndIcon ? (
        <EndIcon
          className={cn(
            'text-muted-foreground size-3.5 opacity-40',
            item.endIconClassName
          )}
          aria-hidden
        />
      ) : null}
      {item.badge ? <NavBadge>{item.badge}</NavBadge> : null}
    </span>
  )
}

function SidebarLinkMenu({ menu }: { menu: NavMenuItem[] }) {
  const { setOpenMobile } = useSidebar()
  const { t } = useLingui()
  if (!menu.length) return null

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <SidebarItemAction showOnHover aria-label={t`Open actions`}>
              <MoreHorizontal />
            </SidebarItemAction>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>{t`Open actions`}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent side='right' align='start' sideOffset={4}>
        {menu.map((menuItem) => (
          <DropdownMenuItem
            key={menuItem.title}
            disabled={menuItem.disabled}
            className={
              menuItem.destructive
                ? 'text-destructive focus:text-destructive'
                : undefined
            }
            onSelect={(event) => {
              event.preventDefault()
              event.stopPropagation()
              setOpenMobile(false)
              menuItem.onClick()
            }}
          >
            {menuItem.icon && <menuItem.icon className='me-2 size-4' />}
            <span>{menuItem.title}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function SidebarMenuAction({ item }: { item: NavAction }) {
  const { setOpenMobile } = useSidebar()
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        tooltip={item.title}
        isActive={item.isActive}
        onClick={() => {
          setOpenMobile(false)
          item.onClick()
        }}
        variant={item.variant}
        className={item.className}
      >
        <ItemIcon icon={item.icon} aggregate={item.aggregate} />
        <span className='group-data-[collapsible=icon]:hidden'>{item.title}</span>
        {item.badge && <NavBadge>{item.badge}</NavBadge>}
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

function SidebarMenuLink({
  item,
  pathname,
}: {
  item: NavLink
  pathname: string
}) {
  const { setOpenMobile } = useSidebar()
  if (item.external) {
    // Use explicit isActive prop if provided, otherwise check pathname
    const isActive = item.isActive ?? checkIsActive(pathname, item)
    return (
      <SidebarMenuItem>
        <SidebarMenuButton asChild isActive={isActive} tooltip={navLinkTooltip(item)} className={item.className}>
          <a href={item.url as string} onClick={() => setOpenMobile(false)}>
            <ItemIcon icon={item.icon} aggregate={item.aggregate} />
            <span className='min-w-0 flex-1 truncate group-data-[collapsible=icon]:hidden'>
              <NavTitle title={item.title} meta={item.meta} />
            </span>
            <NavLinkTrailing item={item} />
          </a>
        </SidebarMenuButton>
        {item.menu?.length ? <SidebarLinkMenu menu={item.menu} /> : null}
      </SidebarMenuItem>
    )
  }
  // Use explicit isActive prop if provided, otherwise check pathname
  const isActive = item.isActive ?? checkIsActive(pathname, item)
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={isActive}
        tooltip={navLinkTooltip(item)}
        className={item.className}
      >
        <Link preload={false} to={item.url} onClick={() => setOpenMobile(false)}>
          <ItemIcon icon={item.icon} aggregate={item.aggregate} />
          <span className='min-w-0 flex-1 truncate group-data-[collapsible=icon]:hidden'>
            <NavTitle title={item.title} meta={item.meta} />
          </span>
          <NavLinkTrailing item={item} />
        </Link>
      </SidebarMenuButton>
      {item.menu?.length ? <SidebarLinkMenu menu={item.menu} /> : null}
    </SidebarMenuItem>
  )
}

function SidebarMenuCollapsible({
  item,
  pathname,
}: {
  item: NavCollapsible
  pathname: string
}) {
  const { setOpenMobile } = useSidebar()
  const { t } = useLingui()

  // Use controlled mode if `open` prop is provided, otherwise use uncontrolled
  const isControlled = typeof item.open === 'boolean'
  const collapsibleProps = isControlled
    ? { open: item.open }
    : { defaultOpen: checkIsActive(pathname, item, true) }

  // Only highlight if open (for controlled items) or URL matches (for uncontrolled)
  const shouldHighlight = isControlled
    ? item.open && checkIsActive(pathname, item)
    : checkIsActive(pathname, item)

  return (
    <Collapsible
      asChild
      {...collapsibleProps}
      className='group/collapsible'
    >
      <SidebarMenuItem>
        {item.url ? (
           <div className='flex items-center'>
            {item.external ? (
              <SidebarMenuButton
                asChild
                isActive={shouldHighlight}
                tooltip={item.title}
                className={cn('flex-1', item.className)}
              >
                <a href={item.url as string} onClick={() => setOpenMobile(false)}>
                  <ItemIcon icon={item.icon} aggregate={item.aggregate} />
                  <span className='group-data-[collapsible=icon]:hidden'>{item.title}</span>
                  {item.badge && <NavBadge>{item.badge}</NavBadge>}
                </a>
              </SidebarMenuButton>
            ) : (
              <SidebarMenuButton
                asChild
                isActive={shouldHighlight}
                tooltip={item.title}
                className={cn('flex-1', item.className)}
              >
                <Link preload={false} to={item.url} onClick={() => setOpenMobile(false)}>
                  <ItemIcon icon={item.icon} aggregate={item.aggregate} />
                  <span className='group-data-[collapsible=icon]:hidden'>{item.title}</span>
                  {item.badge && <NavBadge>{item.badge}</NavBadge>}
                </Link>
              </SidebarMenuButton>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <CollapsibleTrigger asChild>
                  <button
                    type='button'
                    aria-label={t`Toggle section`}
                    className='rounded-md p-2 transition-colors hover:bg-hover active:bg-interactive-active'
                  >
                    <ChevronRight className='size-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90 rtl:rotate-180' />
                  </button>
                </CollapsibleTrigger>
              </TooltipTrigger>
              <TooltipContent>{t`Toggle section`}</TooltipContent>
            </Tooltip>
          </div>
        ) : (
          /*
            If NO URL, the entire row is the collapsible trigger.
           */
          <CollapsibleTrigger asChild>
            <SidebarMenuButton
              tooltip={item.title}
              className={cn('cursor-pointer', item.className)}
            >
              <ItemIcon icon={item.icon} aggregate={item.aggregate} />
              <span className='group-data-[collapsible=icon]:hidden'>
                {item.title}
              </span>
              {item.badge && <NavBadge>{item.badge}</NavBadge>}
             <ChevronRight className='ms-auto size-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90 group-data-[collapsible=icon]:hidden rtl:rotate-180' />
            </SidebarMenuButton>
          </CollapsibleTrigger>
        )}

        <CollapsibleContent className='CollapsibleContent'>
          <SidebarMenuSub>
            {item.items.map((subItem) => {
              // Handle nested collapsible sub-items
              if (isNavSubCollapsible(subItem)) {
                return (
                  <SidebarMenuSubCollapsible
                    key={getNavItemKey(subItem)}
                    item={subItem}
                    pathname={pathname}
                  />
                )
              }
              // Handle action sub-items
              if (isNavAction(subItem)) {
                return (
                  <SidebarMenuSubItem key={getNavItemKey(subItem)}>
                    <SidebarMenuSubButton
                      className='cursor-pointer'
                      onClick={() => {
                        setOpenMobile(false)
                        subItem.onClick()
                      }}
                    >
                      {subItem.icon && <subItem.icon />}
                      <span className='group-data-[collapsible=icon]:hidden'>{subItem.title}</span>
                      {subItem.badge && <NavBadge>{subItem.badge}</NavBadge>}
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                )
              }
              // Handle link sub-items
              return (
                <SidebarMenuSubItem key={getNavItemKey(subItem)}>
                  <SidebarMenuSubButton
                    asChild
                    isActive={'url' in subItem ? checkIsActive(pathname, subItem) : false}
                  >
                    <SubItemLink
                      url={'url' in subItem ? subItem.url : '#'}
                      external={'external' in subItem ? subItem.external : false}
                      onClick={() => setOpenMobile(false)}
                    >
                      {subItem.icon && <subItem.icon />}
                      <span className='group-data-[collapsible=icon]:hidden'>{subItem.title}</span>
                      {subItem.badge && <NavBadge>{subItem.badge}</NavBadge>}
                    </SubItemLink>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              )
            })}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  )
}

function SidebarMenuSubCollapsible({
  item,
  pathname,
}: {
  item: NavSubCollapsible
  pathname: string
}) {
  const { setOpenMobile } = useSidebar()
  const { t } = useLingui()

  // Use controlled mode if `open` prop is provided
  const isControlled = typeof item.open === 'boolean'
  const collapsibleProps = isControlled
    ? { open: item.open }
    : { defaultOpen: checkIsActive(pathname, item, true) }

  // Only highlight if open (for controlled items) or URL matches (for uncontrolled)
  const shouldHighlight = isControlled
    ? item.open && checkIsActive(pathname, item)
    : checkIsActive(pathname, item)

  return (
    <SidebarMenuSubItem>
      <Collapsible {...collapsibleProps} className='group/subcollapsible'>
        {item.url ? (
          <div className='flex items-center'>
             <SidebarMenuSubButton
                asChild
                isActive={shouldHighlight}
                className='flex-1'
              >
                <Link preload={false} to={item.url} onClick={() => setOpenMobile(false)}>
                  <ItemIcon icon={item.icon} aggregate={item.aggregate} />
                  <span className='group-data-[collapsible=icon]:hidden'>{item.title}</span>
                  {item.badge && <NavBadge>{item.badge}</NavBadge>}
                </Link>
              </SidebarMenuSubButton>
            <Tooltip>
              <TooltipTrigger asChild>
                <CollapsibleTrigger asChild>
                  <button
                    type='button'
                    aria-label={t`Toggle section`}
                    className='rounded-md p-1.5 transition-colors hover:bg-hover active:bg-interactive-active'
                  >
                    <ChevronRight className='size-3 transition-transform duration-200 group-data-[state=open]/subcollapsible:rotate-90 rtl:rotate-180' />
                  </button>
                </CollapsibleTrigger>
              </TooltipTrigger>
              <TooltipContent>{t`Toggle section`}</TooltipContent>
            </Tooltip>
          </div>
        ) : (
          /*
            If NO URL, full row toggle
           */
          <CollapsibleTrigger asChild>
             <SidebarMenuSubButton className='flex-1 cursor-pointer'>
                <ItemIcon icon={item.icon} aggregate={item.aggregate} />
                <span className='group-data-[collapsible=icon]:hidden'>{item.title}</span>
                {item.badge && <NavBadge>{item.badge}</NavBadge>}
                <ChevronRight className='ms-auto size-3 transition-transform duration-200 group-data-[state=open]/subcollapsible:rotate-90 rtl:rotate-180' />
              </SidebarMenuSubButton>
          </CollapsibleTrigger>
        )}

        <CollapsibleContent>
          <SidebarMenuSub>
            {item.items.map((subSubItem) => {
              // Handle action sub-sub-items
              if (isNavAction(subSubItem)) {
                return (
                  <SidebarMenuSubItem key={getNavItemKey(subSubItem)}>
                    <SidebarMenuSubButton
                      className='cursor-pointer'
                      onClick={() => {
                        setOpenMobile(false)
                        subSubItem.onClick()
                      }}
                    >
                      {subSubItem.icon && <subSubItem.icon />}
                      <span className='group-data-[collapsible=icon]:hidden'>{subSubItem.title}</span>
                      {subSubItem.badge && <NavBadge>{subSubItem.badge}</NavBadge>}
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                )
              }
              // Handle link sub-sub-items
              return (
                <SidebarMenuSubItem key={getNavItemKey(subSubItem)}>
                  <SidebarMenuSubButton
                    asChild
                    isActive={'url' in subSubItem ? checkIsActive(pathname, subSubItem) : false}
                  >
                    <SubItemLink
                      url={'url' in subSubItem ? subSubItem.url : '#'}
                      external={'external' in subSubItem ? subSubItem.external : false}
                      onClick={() => setOpenMobile(false)}
                    >
                      {subSubItem.icon && <subSubItem.icon />}
                      <span className='group-data-[collapsible=icon]:hidden'>{subSubItem.title}</span>
                      {subSubItem.badge && <NavBadge>{subSubItem.badge}</NavBadge>}
                    </SubItemLink>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              )
            })}
          </SidebarMenuSub>
        </CollapsibleContent>
      </Collapsible>
    </SidebarMenuSubItem>
  )
}

function SidebarMenuCollapsedDropdown({
  item,
  pathname,
}: {
  item: NavCollapsible
  pathname: string
}) {
  return (
    <SidebarMenuItem>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SidebarMenuButton
            tooltip={item.title}
            isActive={checkIsActive(pathname, item)}
          >
            <ItemIcon icon={item.icon} aggregate={item.aggregate} />
            <span className='group-data-[collapsible=icon]:hidden'>{item.title}</span>
            {item.badge && <NavBadge className='group-data-[collapsible=icon]:hidden'>{item.badge}</NavBadge>}
            <ChevronRight className='ms-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90 group-data-[collapsible=icon]:hidden rtl:rotate-180' />
          </SidebarMenuButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent side='right' align='start' sideOffset={4}>
          <DropdownMenuLabel>
            {item.title} {item.badge ? `(${item.badge})` : ''}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {item.items.map((sub) => {
            const key = getNavItemKey(sub)
            if (isNavSubCollapsible(sub)) {
              // A nested section keeps its children reachable while the
              // sidebar is collapsed: a flyout, not a silent omission.
              return (
                <DropdownMenuSub key={key}>
                  <DropdownMenuSubTrigger>
                    {sub.icon && <sub.icon />}
                    <span className='max-w-52 text-wrap'>{sub.title}</span>
                    {sub.badge && <span className='ms-auto text-xs'>{sub.badge}</span>}
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    {sub.items.map((leaf) => {
                      const leafKey = getNavItemKey(leaf)
                      if (isNavAction(leaf)) {
                        return (
                          <DropdownMenuItem key={leafKey} onClick={leaf.onClick}>
                            {leaf.icon && <leaf.icon />}
                            <span className='max-w-52 text-wrap'>{leaf.title}</span>
                            {leaf.badge && <span className='ms-auto text-xs'>{leaf.badge}</span>}
                          </DropdownMenuItem>
                        )
                      }
                      return (
                        <DropdownMenuItem key={leafKey} asChild>
                          <SubItemLink
                            url={leaf.url}
                            external={leaf.external}
                            className={`${checkIsActive(pathname, leaf) ? 'bg-secondary' : ''}`}
                          >
                            {leaf.icon && <leaf.icon />}
                            <span className='max-w-52 text-wrap'>{leaf.title}</span>
                            {leaf.badge && <span className='ms-auto text-xs'>{leaf.badge}</span>}
                          </SubItemLink>
                        </DropdownMenuItem>
                      )
                    })}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              )
            }
            if (isNavAction(sub)) {
              return (
                <DropdownMenuItem key={key} onClick={sub.onClick}>
                  {sub.icon && <sub.icon />}
                  <span className='max-w-52 text-wrap'>{sub.title}</span>
                  {sub.badge && <span className='ms-auto text-xs'>{sub.badge}</span>}
                </DropdownMenuItem>
              )
            }
            return (
              <DropdownMenuItem key={key} asChild>
                <SubItemLink
                  url={sub.url}
                  external={sub.external}
                  className={`${checkIsActive(pathname, sub) ? 'bg-secondary' : ''}`}
                >
                  {sub.icon && <sub.icon />}
                  <span className='max-w-52 text-wrap'>{sub.title}</span>
                  {sub.badge && <span className='ms-auto text-xs'>{sub.badge}</span>}
                </SubItemLink>
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  )
}

function checkIsActive(pathname: string, item: NavItem | NavSubItem, mainNav = false): boolean {
  // Normalize paths for comparison
  const normalizePath = (path: string): string => {
    if (!path) return '/'
    // Handle relative paths like './' or '.'
    if (path === './' || path === '.') {
      return '/'
    }
    // Remove trailing slashes for consistent comparison (except for root)
    const trimmed = path.replace(/\/$/, '')
    return trimmed || '/'
  }

  const normalizedPathname = normalizePath(pathname)
  // Check if item has a URL property before accessing it
  const url = 'url' in item ? item.url : undefined
  const normalizedItemUrl = normalizePath(url as string)

  // Check for exact match
  if (url && normalizedPathname === normalizedItemUrl) {
    return true
  }

  // Check for prefix match (e.g., /abc123/settings matches /abc123)
  // But not for root URL to avoid matching everything
  if (url && normalizedItemUrl !== '/' && normalizedPathname.startsWith(normalizedItemUrl + '/')) {
    return true
  }

  // Check if any child nav item is active (Recursive)
  if ('items' in item && item.items && Array.isArray(item.items)) {
    const hasActiveChild = item.items.some((child: NavItem | NavSubItem) => checkIsActive(pathname, child))
    if (hasActiveChild) {
      return true
    }
  }

  // For main nav items, check if the first segment matches
  if (mainNav && url) {
    const pathnameSegments = normalizedPathname.split('/').filter(Boolean)
    const itemUrlSegments = normalizedItemUrl.split('/').filter(Boolean)
    if (pathnameSegments.length > 0 && itemUrlSegments.length > 0) {
      return pathnameSegments[0] === itemUrlSegments[0]
    }
  }

  return false
}
