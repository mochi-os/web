import { AlertCircle, ExternalLink } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from './ui/alert'
import { Button } from './ui/button'
import { getCurrentAppId } from '../lib/permission-utils'

interface PermissionPromptProps {
  permission: string
  onDismiss?: () => void
}

// Get user-friendly permission name
function getPermissionLabel(permission: string): string {
  const labels: Record<string, string> = {
    'group/manage': 'manage groups',
    'user/read': 'read user information',
    'setting/write': 'modify settings',
    'permission/manage': 'manage permissions',
    'webpush/send': 'send notifications',
  }

  if (labels[permission]) {
    return labels[permission]
  }

  if (permission.startsWith('url:')) {
    const domain = permission.slice(4)
    return `access ${domain}`
  }

  return permission
}

export function PermissionPrompt({ permission, onDismiss }: PermissionPromptProps) {
  const appId = getCurrentAppId()
  const permissionLabel = getPermissionLabel(permission)
  const requestUrl = `/apps/permissions/request?app=${encodeURIComponent(appId)}&permission=${encodeURIComponent(permission)}`

  const handleGrantClick = () => {
    // Open in new tab - this works because it's triggered by direct user click
    window.open(requestUrl, '_blank')
  }

  return (
    <Alert>
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Permission required</AlertTitle>
      <AlertDescription className="mt-2">
        <p className="mb-3">
          This app needs permission to {permissionLabel}. Grant permission and try again.
        </p>
        <div className="flex gap-2">
          <Button size="sm" onClick={handleGrantClick}>
            Grant permission
            <ExternalLink className="ml-2 h-3 w-3" />
          </Button>
          {onDismiss && (
            <Button size="sm" variant="outline" onClick={onDismiss}>
              Cancel
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  )
}
