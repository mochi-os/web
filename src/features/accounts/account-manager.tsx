import { useState } from 'react'
import {
  CheckCircle2,
  Clock,
  Loader2,
  Mail,
  MoreHorizontal,
  Plus,
  Trash2,
} from 'lucide-react'
import { Button } from '../../components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu'
import { toast } from '../../lib/toast-utils'
import { useAccounts } from '../../hooks/use-accounts'
import { AccountAdd } from './account-add'
import { AccountVerify } from './account-verify'
import { getProviderLabel, type Account, type Provider } from './types'

interface AccountManagerProps {
  appBase: string
  capability: string
  title?: string
  description?: string
}

function getProviderIcon(type: string) {
  switch (type) {
    case 'email':
      return <Mail className="h-4 w-4" />
    case 'browser':
      return (
        <svg
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      )
    case 'pushbullet':
      return (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="12" r="10" />
        </svg>
      )
    case 'claude':
    case 'openai':
      return (
        <svg
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Z" />
          <path d="M12 8v8" />
          <path d="M8 12h8" />
        </svg>
      )
    case 'mcp':
      return (
        <svg
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <path d="M8 21h8" />
          <path d="M12 17v4" />
        </svg>
      )
    default:
      return null
  }
}

function AccountItem({
  account,
  providers,
  onRemove,
  onVerify,
  isRemoving,
}: {
  account: Account
  providers: Provider[]
  onRemove: (id: number) => void
  onVerify: (account: Account) => void
  isRemoving: boolean
}) {
  const isVerified = account.verified > 0
  // Defensive check to ensure providers is an array
  const providersList = Array.isArray(providers) ? providers : []
  const provider = providersList.find((p) => p.type === account.type)
  const needsVerification = provider?.verify && !isVerified

  return (
    <div className="flex items-center justify-between py-3 border-b last:border-0">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
          {getProviderIcon(account.type)}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium">
              {account.label || getProviderLabel(account.type)}
            </span>
            {needsVerification ? (
              <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                <Clock className="h-3 w-3" />
                Unverified
              </span>
            ) : isVerified ? (
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
            ) : null}
          </div>
          {account.identifier && (
            <div className="text-sm text-muted-foreground">
              {account.identifier}
            </div>
          )}
        </div>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            disabled={isRemoving}
            aria-label="Open account actions"
            title="Open account actions"
          >
            {isRemoving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MoreHorizontal className="h-4 w-4" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {needsVerification && (
            <DropdownMenuItem onClick={() => onVerify(account)}>
              <Mail className="mr-2 h-4 w-4" />
              Verify
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            onClick={() => onRemove(account.id)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Remove
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

export function AccountManager({
  appBase,
  capability,
  title = 'Connected accounts',
  description = 'Manage your connected accounts for notifications and services.',
}: AccountManagerProps) {
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [verifyAccount, setVerifyAccount] = useState<Account | null>(null)

  const {
    providers: providersData,
    accounts: accountsData,
    isLoading,
    add,
    remove,
    verify,
    isAdding,
    isRemoving,
    isVerifying,
  } = useAccounts(appBase, capability)

  // Ensure arrays are always arrays (defensive check)
  const providers = Array.isArray(providersData) ? providersData : []
  const accounts = Array.isArray(accountsData) ? accountsData : []

  const handleAdd = async (type: string, fields: Record<string, string>, addToExisting: boolean) => {
    try {
      const account = await add(type, fields, addToExisting)
      toast.success('Account added')
      setIsAddOpen(false)

      // If verification is required, show verify dialog
      const provider = providers.find((p) => p.type === type)
      if (provider?.verify && account.verified === 0) {
        setVerifyAccount(account)
      }
    } catch {
      toast.error('Failed to add account')
    }
  }

  const handleRemove = async (id: number) => {
    try {
      await remove(id)
      toast.success('Account removed')
    } catch {
      toast.error('Failed to remove account')
    }
  }

  const handleVerify = async (id: number, code: string) => {
    try {
      const result = await verify(id, code)
      if (result) {
        toast.success('Account verified')
        setVerifyAccount(null)
      } else {
        toast.error('Invalid verification code')
      }
    } catch {
      toast.error('Verification failed')
    }
  }

  const handleResend = async (id: number) => {
    try {
      await verify(id)
      toast.success('Verification code sent')
    } catch {
      toast.error('Failed to send verification code')
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </div>
            <Button onClick={() => setIsAddOpen(true)} size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Add account
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {accounts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No connected accounts</p>
              <p className="text-sm mt-1">
                Add an account to receive notifications and use services.
              </p>
            </div>
          ) : (
            <div>
              {[...accounts]
                .sort((a, b) => {
                  const aName = a.label || getProviderLabel(a.type)
                  const bName = b.label || getProviderLabel(b.type)
                  const nameCompare = aName.localeCompare(bName)
                  if (nameCompare !== 0) return nameCompare
                  const aType = getProviderLabel(a.type)
                  const bType = getProviderLabel(b.type)
                  return aType.localeCompare(bType)
                })
                .map((account) => (
                  <AccountItem
                    key={account.id}
                    account={account}
                    providers={providers}
                    onRemove={handleRemove}
                    onVerify={setVerifyAccount}
                    isRemoving={isRemoving}
                  />
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AccountAdd
        open={isAddOpen}
        onOpenChange={setIsAddOpen}
        providers={providers}
        onAdd={handleAdd}
        isAdding={isAdding}
        appBase={appBase}
      />

      {verifyAccount && (
        <AccountVerify
          open={!!verifyAccount}
          onOpenChange={(open) => !open && setVerifyAccount(null)}
          account={verifyAccount}
          onVerify={handleVerify}
          onResend={handleResend}
          isVerifying={isVerifying}
        />
      )}
    </>
  )
}
