// UI Components
export * from './components/ui/alert-dialog'
export * from './components/ui/alert'
export * from './components/ui/avatar'
export * from './components/ui/badge'
export * from './components/ui/button'
export * from './components/ui/calendar'
export * from './components/ui/card'
export * from './components/ui/copy-button'
export * from './components/ui/data-chip'
export * from './components/ui/checkbox'
export * from './components/ui/collapsible'
export * from './components/ui/command'
export * from './components/ui/create-entity-dialog'
export * from './components/ui/dialog'
export * from './components/ui/drawer'
export * from './components/ui/dropdown-menu'
export * from './components/ui/empty-state'
export * from './components/ui/form'
export * from './components/ui/image-lightbox'
export * from './components/ui/input'
export * from './components/ui/input-otp'
export * from './components/ui/label'
export * from './components/ui/popover'
export * from './components/ui/radio-group'
export * from './components/ui/responsive-dialog'
export * from './components/ui/scroll-area'
export * from './components/ui/select'
export * from './components/ui/sort-direction-button'
export * from './components/ui/sort-selector'
export * from './components/ui/separator'
export * from './components/ui/sheet'
export * from './components/ui/sidebar'
export * from './components/ui/skeleton'
export * from './components/ui/card-skeleton'
export * from './components/ui/list-skeleton'
export * from './components/ui/detail-skeleton'
export * from './components/ui/board-skeleton'
export * from './components/ui/sonner'
export * from './components/ui/status-badge'
export * from './components/ui/slider'
export * from './components/ui/switch'
export * from './components/ui/table'
export * from './components/ui/tabs'
export * from './components/ui/textarea'
export * from './components/ui/tooltip'

// Layout Components
export * from './components/layout/main'
export * from './components/layout/header'
export * from './components/layout/top-bar'
export * from './components/layout/authenticated-layout'
export * from './components/layout/page-header'
export * from './components/layout/back-button'
export * from './components/layout/section'
export * from './components/layout/simple-layout'
export * from './components/layout/app-title'
export * from './components/layout/team-switcher'
export * from './components/layout/top-nav'
export { AppSidebar } from './components/layout/app-sidebar'
export { NavGroup } from './components/layout/nav-group'
export { NavUser } from './components/layout/nav-user'
export type { SidebarData, NavGroup as NavGroupType, NavItem, NavCollapsible, NavSubItem, NavLink, NavAction } from './components/layout/types'
export {
  RightPanel,
  RightPanelProvider,
  RightPanelHeader,
  RightPanelContent,
  RightPanelFooter,
  RightPanelTrigger,
  RightPanelCloseButton,
  useRightPanel,
} from './components/layout/right-panel'

// Data Table Components
export * from './components/data-table'

// Location Components
export * from './components/map-view'
export * from './components/place-picker'
export * from './components/travelling-picker'

// Shared Components
export * from './components/tree-row'
export * from './components/timezone-select'
export * from './lib/preference-utils'
export * from './components/coming-soon'
export * from './components/command-menu'
export * from './components/load-more-trigger'
export * from './components/config-drawer'
export * from './components/confirm-dialog'
export * from './components/date-picker'
export * from './components/faceless-avatar'
export * from './components/entity-onboarding-empty-state'
export * from './components/learn-more'
export * from './components/long-text'
export * from './components/navigation-progress'
export * from './components/notification-title'
export * from './components/notifications-dropdown'
export * from './components/password-input'
export * from './components/preference-item'
export * from './components/profile-dropdown'
export * from './components/responsive-confirm-dialog'
export * from './components/search'
export * from './components/person-picker'
export * from './components/search-entity-page'
export * from './components/search-entity-dialog'
export * from './components/select-dropdown'
export * from './components/sign-out-dialog'
export * from './components/skip-to-main'
export * from './components/tag-input'
export * from './components/theme-switch'
export * from './components/colour-picker'
export * from './components/comment-tree-layout'
export * from './components/icon-button'
export * from './components/post-tags'

// Context Providers
export * from './context/direction-provider'
export * from './context/font-provider'
export {
  LayoutProvider,
  useLayout,
  type Collapsible as LayoutCollapsible,
} from './context/layout-provider'
export * from './context/theme-provider'
export * from './context/search-provider'

// Stores
export * from './stores/auth-store'
export * from './stores/page-title-store'

// Hooks
export { useQueryWithError, useInfiniteQueryWithError } from './hooks/use-query-with-error'
export { default as useDialogState } from './hooks/use-dialog-state'
export * from './hooks/use-media-query'
export * from './hooks/use-screen-size'
export * from './hooks/use-notifications'
export * from './hooks/use-push'
export * from './hooks/use-page-title'
export * from './hooks/useAuth'
export * from './hooks/use-logout'
export * from './hooks/use-verify-session'
export * from './hooks/use-require-auth'
export * from './hooks/use-table-url-state'
export * from './hooks/use-video-thumbnail'
export * from './hooks/use-place-search'
export * from './hooks/use-lightbox-hash'
export * from './hooks/use-image-object-urls'
export * from './hooks/use-accounts'
export * from './hooks/use-destinations'
export * from './hooks/use-debounce'
// Lib utilities
export * from './lib/create-app-client'
export * from './lib/api-client'
export { getAppPath, getRouterBasepath, getApiBasepath, getAuthLoginUrl, isDomainEntityRouting, getEntityFingerprint, getEntityClass, NOTIFICATIONS_PATH } from './lib/app-path'
export { isInShell, initShellBridge, shellNavigate, shellNavigateExternal, shellSetTitle, shellSetSidebarState, onShellMessage, getShellInitData, safeCookieGet, safeCookieSet, installShellLinkInterceptor, installShellNavigationSync, installShellClipboardProxy, authenticatedUrl, shellClipboardWrite, shellSubscribeNotifications, shellRequestPermission, shellFetch } from './lib/shell-bridge'
export * as shellStorage from './lib/shell-storage'
export { useShellStorage } from './hooks/use-shell-storage'
export * from './lib/auth-endpoints'
export * from './lib/auth-manager'
export * from './lib/cookies'
export { extractStatus } from './lib/error-normalizer'
export * from './lib/handle-server-error'
export * from './lib/query-client'
export * from './lib/request'
export * from './lib/show-submitted-data'
export * from './lib/utils'
export * from './lib/chat-ui'
export * from './lib/places-api'
export * from './lib/attachment-utils'
export * from './lib/toast-utils'
export * from './lib/permission-utils'
export * from './lib/safe-navigation'
export * as push from './lib/push'

// Types
export type { PlaceData, PostData, TravellingData, PhotonPlace } from './types/places'
export * from './types/settings'
export * from './types/users'

// Hooks
export * from './hooks/settings/use-preferences'
export * from './hooks/settings/use-system-settings'

// Error pages
export * from './features/errors/forbidden'
export * from './features/errors/general-error'
export * from './features/errors/maintenance-error'
export * from './features/errors/not-found-error'
export * from './features/errors/unauthorized-error'

// Access control components
export * from './features/access'

// Connected accounts components
export * from './features/accounts'

// Subscriptions components
export * from './features/subscriptions'

// Custom icons
export { IconDir } from './assets/custom/icon-dir'
export { IconLayoutCompact } from './assets/custom/icon-layout-compact'
export { IconLayoutDefault } from './assets/custom/icon-layout-default'
export { IconLayoutFull } from './assets/custom/icon-layout-full'
export { IconSidebarFloating } from './assets/custom/icon-sidebar-floating'
export { IconSidebarInset } from './assets/custom/icon-sidebar-inset'
export { IconSidebarSidebar } from './assets/custom/icon-sidebar-sidebar'
export { IconThemeDark } from './assets/custom/icon-theme-dark'
export { IconThemeLight } from './assets/custom/icon-theme-light'
export { IconThemeSystem } from './assets/custom/icon-theme-system'
