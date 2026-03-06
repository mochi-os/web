import { useState } from 'react'
import { Bell } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { SubscribeDialog } from './subscribe-dialog'
import type { SubscribeButtonProps } from './types'

// Self-contained button component with permission dialog
export function SubscribeButton({
  app,
  label,
  type,
  object,
  subscriptions,
  onResult,
  appBase = '',
  children,
  variant = 'outline',
  size = 'default',
  disabled = false,
  className,
}: SubscribeButtonProps) {
  const [dialogOpen, setDialogOpen] = useState(false)

  return (
    <>
      <Button
        variant={variant}
        size={size}
        disabled={disabled}
        className={className}
        onClick={() => setDialogOpen(true)}
      >
        {children ?? (
          <>
            <Bell className="h-4 w-4" />
            Subscribe
          </>
        )}
      </Button>

      <SubscribeDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        app={app}
        label={label}
        type={type}
        object={object}
        subscriptions={subscriptions}
        appBase={appBase}
        onResult={onResult}
      />
    </>
  )
}
