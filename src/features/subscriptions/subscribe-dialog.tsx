import { useState, useEffect, useMemo } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Bell, Loader2, Mail, Rss, Webhook, Globe, Check } from 'lucide-react'
import { getBrowserName } from '../../lib/push'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog'
import { Button } from '../../components/ui/button'
import { Switch } from '../../components/ui/switch'
import { Skeleton } from '../../components/ui/skeleton'
import { requestHelpers } from '../../lib/request'
import { getErrorMessage } from '../../lib/handle-server-error'
import { toast } from '../../lib/toast-utils'
import { NOTIFICATIONS_PATH } from '../../lib/app-path'
import { useDestinations } from '../../hooks/use-destinations'
import { usePush } from '../../hooks/use-push'
import type { SubscribeDialogProps, DestinationToggle, SubscriptionItem } from './types'

interface CreateResponse {
  id: number
}

interface SubscriptionToggle extends SubscriptionItem {
  enabled: boolean
}

function getDestinationIcon(type: string, accountType?: string) {
  if (type === 'web') {
    return <Globe className="h-4 w-4" />
  }
  if (type === 'rss') {
    return <Rss className="h-4 w-4" />
  }
  switch (accountType) {
    case 'email':
      return <Mail className="h-4 w-4" />
    case 'browser':
      return <Bell className="h-4 w-4" />
    case 'url':
      return <Webhook className="h-4 w-4" />
    default:
      return <Bell className="h-4 w-4" />
  }
}

export function SubscribeDialog({
  open,
  onOpenChange,
  app,
  label,
  type = '',
  object = '',
  subscriptions: subscriptionsProp,
  appBase = '',
  onResult,
}: SubscribeDialogProps) {
  const { destinations, isLoading } = useDestinations(appBase)
  const push = usePush()
  const [toggles, setToggles] = useState<DestinationToggle[]>([])
  const [enableWeb, setEnableWeb] = useState(true)
  const [enableBrowserPush, setEnableBrowserPush] = useState(false)
  const [subscriptionToggles, setSubscriptionToggles] = useState<SubscriptionToggle[]>([])

  // Build subscription items from either the array prop or legacy single props
  const subscriptionItems: SubscriptionItem[] = subscriptionsProp ?? (label ? [{ label, type, object, defaultEnabled: true }] : [])

  // Ensure destinations is an array (could be undefined during redirect)
  const destinationsList = Array.isArray(destinations) ? destinations : []

  // Find existing browser destination if any
  const browserDestination = destinationsList.find((d) => d.accountType === 'browser')
  // Show browser push option if supported and not already configured
  const showBrowserPushOption = push.supported && !browserDestination

  // Initialize toggles when destinations load
  useEffect(() => {
    if (!isLoading && toggles.length === 0) {
      setToggles(
        destinationsList.map((d) => ({
          type: d.type,
          accountType: d.accountType,
          id: d.id,
          label: d.label,
          identifier: d.identifier,
          enabled: d.defaultEnabled,
        }))
      )
    }
  }, [destinationsList, isLoading, toggles.length])

  // Initialize subscription toggles when dialog opens
  useEffect(() => {
    if (open && subscriptionToggles.length === 0 && subscriptionItems.length > 0) {
      setSubscriptionToggles(
        subscriptionItems.map((s) => ({
          ...s,
          enabled: s.defaultEnabled ?? true,
        }))
      )
    }
  }, [open, subscriptionItems, subscriptionToggles.length])

  // Reset toggles when dialog closes
  useEffect(() => {
    if (!open) {
      setToggles([])
      setSubscriptionToggles([])
      setEnableWeb(true)
      setEnableBrowserPush(false)
    }
  }, [open])

  const createMutation = useMutation({
    mutationFn: async () => {
      // If browser push was enabled, subscribe first
      // Note: Browser account management still goes through notifications app directly
      let newBrowserAccountId: number | null = null
      if (enableBrowserPush && !push.subscribed) {
        try {
          await push.subscribe()
          // Fetch fresh accounts list to get the new browser account ID
          const res = await fetch(`${NOTIFICATIONS_PATH}/-/accounts/list?capability=notify`, {
            credentials: 'include',
          })
          if (res.ok) {
            const data = await res.json()
            const accounts = data?.data || []
            const browserAccount = accounts.find((a: { type: string; id: number }) => a.type === 'browser')
            if (browserAccount) {
              newBrowserAccountId = browserAccount.id
            }
          }
        } catch (error) {
          // If push subscription fails, continue without it
          console.error('Failed to enable browser push:', error)
        }
      }

      // Build destinations list
      const enabledDestinations: Array<{ type: string; target: string }> = []

      // Add web destination if enabled
      if (enableWeb) {
        enabledDestinations.push({ type: 'web', target: 'default' })
      }

      // Add account/rss destinations
      toggles
        .filter((t) => t.enabled)
        .forEach((t) => {
          enabledDestinations.push({
            type: t.type,
            target: String(t.id),
          })
        })

      // Add newly created browser account if applicable
      if (newBrowserAccountId !== null) {
        enabledDestinations.push({
          type: 'account',
          target: String(newBrowserAccountId),
        })
      }

      // Get enabled subscriptions
      const enabledSubscriptions = subscriptionToggles.filter((s) => s.enabled)

      // Create a subscription for each enabled type
      const results: number[] = []
      for (const sub of enabledSubscriptions) {
        const formData = new URLSearchParams()
        formData.append('label', sub.label)
        if (sub.type) formData.append('type', sub.type)
        if (sub.object) formData.append('object', sub.object)
        formData.append('destinations', JSON.stringify(enabledDestinations))

        const result = await requestHelpers.post<CreateResponse>(
          `${appBase}/-/notifications/subscribe`,
          formData.toString(),
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
          }
        )
        results.push(result.id)
      }

      return results
    },
    onSuccess: (ids) => {
      toast.success('Notifications enabled')
      onResult?.(ids.length === 1 ? ids[0] : ids)
      onOpenChange(false)
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Failed to enable notifications'))
    },
  })

  const handleToggle = (id: number | string) => {
    setToggles((prev) =>
      prev.map((t) => (t.id === id ? { ...t, enabled: !t.enabled } : t))
    )
  }

  const handleSubscriptionToggle = (type: string) => {
    setSubscriptionToggles((prev) =>
      prev.map((s) => (s.type === type ? { ...s, enabled: !s.enabled } : s))
    )
  }

  const handleAccept = () => {
    const hasEnabledSubscription = subscriptionToggles.some((s) => s.enabled)
    if (!hasEnabledSubscription) {
      toast.error('Please select at least one notification type')
      return
    }
    const hasEnabledDestination = enableWeb || enableBrowserPush || toggles.some((t) => t.enabled)
    if (!hasEnabledDestination) {
      toast.error('Please select at least one destination')
      return
    }
    createMutation.mutate()
  }

  const handleRefuse = async () => {
    // Create subscriptions with no destinations (marks as "asked but declined")
    // This prevents prompting the user again
    try {
      for (const sub of subscriptionItems) {
        const formData = new URLSearchParams()
        formData.append('label', sub.label)
        if (sub.type) formData.append('type', sub.type)
        if (sub.object) formData.append('object', sub.object)
        formData.append('destinations', '[]')

        await requestHelpers.post(
          `${appBase}/-/notifications/subscribe`,
          formData.toString(),
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
          }
        )
      }
    } catch (error) {
      // Silently ignore errors - declining notifications shouldn't fail visibly
      console.error('Failed to record declined subscriptions:', error)
    }
    onResult?.(null)
    onOpenChange(false)
  }

  // Build unified sorted list of all destination options
  type UnifiedItem =
    | { kind: 'web' }
    | { kind: 'browser' }
    | { kind: 'toggle'; toggle: DestinationToggle }

  const sortedItems = useMemo((): UnifiedItem[] => {
    const items: Array<{ label: string; item: UnifiedItem }> = []

    // Add Mochi web
    items.push({ label: 'Mochi web', item: { kind: 'web' } })

    // Add browser destination option with detected browser name
    if (showBrowserPushOption) {
      items.push({ label: getBrowserName(), item: { kind: 'browser' } })
    }

    // Add all toggles (skip browser accounts as they're handled above or shown separately)
    for (const toggle of toggles) {
      if (toggle.accountType === 'browser' && showBrowserPushOption) {
        continue
      }
      const displayLabel = toggle.accountType === 'email' && toggle.identifier
        ? toggle.identifier
        : toggle.label
      items.push({ label: displayLabel, item: { kind: 'toggle', toggle } })
    }

    // Sort alphabetically by label
    items.sort((a, b) => a.label.localeCompare(b.label))

    return items.map((i) => i.item)
  }, [toggles, showBrowserPushOption])

  const showMultipleSubscriptions = subscriptionToggles.length > 1

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Enable notifications</DialogTitle>
          <DialogDescription>
            <span className="font-medium">{app.charAt(0).toUpperCase() + app.slice(1)}</span> would like to send you
            notifications{showMultipleSubscriptions ? '.' : `: ${subscriptionToggles[0]?.label ?? label}`}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : (
            <>
              {/* Subscription types (only shown when multiple) */}
              {showMultipleSubscriptions && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Notify me about</p>
                  {subscriptionToggles.map((sub) => (
                    <div
                      key={sub.type}
                      className="flex items-center justify-between py-2"
                    >
                      <span className="text-sm">{sub.label}</span>
                      <Switch
                        id={`sub-toggle-${sub.type}`}
                        checked={sub.enabled}
                        onCheckedChange={() => handleSubscriptionToggle(sub.type)}
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Destinations */}
              <div className="space-y-1">
                {showMultipleSubscriptions && (
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Deliver to</p>
                )}
                {sortedItems.map((item) => {
                  if (item.kind === 'web') {
                    return (
                      <div key="web" className="flex items-center justify-between py-2">
                        <div className="flex items-center gap-3">
                          <Globe className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">Mochi web</span>
                        </div>
                        <Switch
                          id="toggle-web"
                          checked={enableWeb}
                          onCheckedChange={setEnableWeb}
                        />
                      </div>
                    )
                  }
                  if (item.kind === 'browser') {
                    return (
                      <div key="browser" className="flex items-center justify-between py-2">
                        <div className="flex items-center gap-3">
                          {getDestinationIcon('account', 'browser')}
                          <span className="text-sm">{getBrowserName()}</span>
                        </div>
                        <Switch
                          id="toggle-browser-push"
                          checked={enableBrowserPush}
                          onCheckedChange={setEnableBrowserPush}
                        />
                      </div>
                    )
                  }
                  const { toggle } = item
                  const displayLabel = toggle.accountType === 'email' && toggle.identifier
                    ? toggle.identifier
                    : toggle.label
                  return (
                    <div
                      key={`${toggle.type}-${toggle.id}`}
                      className="flex items-center justify-between py-2"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-muted-foreground">
                          {getDestinationIcon(toggle.type, toggle.accountType)}
                        </span>
                        <span className="text-sm">{displayLabel}</span>
                      </div>
                      <Switch
                        id={`toggle-${toggle.type}-${toggle.id}`}
                        checked={toggle.enabled}
                        onCheckedChange={() => handleToggle(toggle.id)}
                      />
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>

        <DialogFooter className="flex-row gap-2 sm:justify-end">
          <Button variant="outline" onClick={handleRefuse}>
            Not now
          </Button>
          <Button
            onClick={handleAccept}
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            Enable
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
