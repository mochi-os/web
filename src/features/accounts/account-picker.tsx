import { useState } from 'react'
import { CheckCircle2, Clock, Plus } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select'
import { useAccounts } from '../../hooks/use-accounts'
import { AccountAdd } from './account-add'
import { getProviderLabel } from './types'

interface AccountPickerProps {
  appBase: string
  capability: string
  value?: number
  onChange: (id: number | undefined) => void
  allowAdd?: boolean
  placeholder?: string
}

export function AccountPicker({
  appBase,
  capability,
  value,
  onChange,
  allowAdd = true,
  placeholder = 'Select account',
}: AccountPickerProps) {
  const [isAddOpen, setIsAddOpen] = useState(false)

  const { providers: providersData, accounts: accountsData, isLoading, add, isAdding } = useAccounts(
    appBase,
    capability
  )

  // Ensure arrays are always arrays (defensive check)
  const providers = Array.isArray(providersData) ? providersData : []
  const accounts = Array.isArray(accountsData) ? accountsData : []

  const handleValueChange = (val: string) => {
    if (val === '__add__') {
      setIsAddOpen(true)
    } else {
      onChange(val ? parseInt(val, 10) : undefined)
    }
  }

  const handleAdd = async (type: string, fields: Record<string, string>) => {
    try {
      const account = await add(type, fields)
      setIsAddOpen(false)
      onChange(account.id)
    } catch {
      // Error handled by parent
    }
  }

  return (
    <>
      <Select
        value={value?.toString() || ''}
        onValueChange={handleValueChange}
        disabled={isLoading}
      >
        <SelectTrigger>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {accounts.map((account) => {
            const isVerified = account.verified > 0
            const provider = providers.find((p) => p.type === account.type)
            const needsVerification = provider?.verify && !isVerified

            return (
              <SelectItem key={account.id} value={account.id.toString()}>
                <div className="flex items-center gap-2">
                  <span>
                    {account.label ||
                      account.identifier ||
                      getProviderLabel(account.type)}
                  </span>
                  {needsVerification ? (
                    <Clock className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                  ) : isVerified ? (
                    <CheckCircle2 className="h-3 w-3 text-green-600 dark:text-green-400" />
                  ) : null}
                </div>
              </SelectItem>
            )
          })}
          {allowAdd && (
            <SelectItem value="__add__">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Plus className="h-4 w-4" />
                Add new account
              </div>
            </SelectItem>
          )}
        </SelectContent>
      </Select>

      <AccountAdd
        open={isAddOpen}
        onOpenChange={setIsAddOpen}
        providers={providers}
        onAdd={handleAdd}
        isAdding={isAdding}
        appBase={appBase}
      />
    </>
  )
}
