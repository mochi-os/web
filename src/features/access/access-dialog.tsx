import { useState, useEffect } from 'react'
import { User, UsersRound, Search, Globe, Users } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs'
import { Card, CardContent } from '../../components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select'
import {
  SPECIAL_SUBJECTS,
  type AccessLevel,
  type Group,
  type UserSearchResult,
} from './types'
import { GeneralError } from '../errors/general-error'

export interface AccessDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdd: (subject: string, subjectName: string, level: string) => Promise<void>
  levels: AccessLevel[]
  defaultLevel: string
  // Data fetching
  userSearchResults?: UserSearchResult[]
  userSearchLoading?: boolean
  userSearchError?: unknown
  onRetryUserSearch?: () => void
  onUserSearch?: (query: string) => void
  groups?: Group[]
  groupsError?: unknown
  onRetryGroups?: () => void
}

export function AccessDialog({
  open,
  onOpenChange,
  onAdd,
  levels,
  defaultLevel,
  userSearchResults = [],
  userSearchLoading = false,
  userSearchError,
  onRetryUserSearch,
  onUserSearch,
  groups = [],
  groupsError,
  onRetryGroups,
}: AccessDialogProps) {
  const [userSearch, setUserSearch] = useState('')
  const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(null)
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null)
  const [selectedSpecial, setSelectedSpecial] = useState<{ id: string; name: string } | null>(null)
  const [level, setLevel] = useState(defaultLevel)
  const [activeTab, setActiveTab] = useState<'user' | 'group' | 'special'>('user')
  const [isAdding, setIsAdding] = useState(false)

  // Reset level when dialog opens
  useEffect(() => {
    if (open) {
      setLevel(defaultLevel)
    }
  }, [open, defaultLevel])

  // Trigger user search
  useEffect(() => {
    if (userSearch.length >= 1 && onUserSearch) {
      onUserSearch(userSearch)
    }
  }, [userSearch, onUserSearch])

  // Reset selections when tab changes
  useEffect(() => {
    setSelectedUser(null)
    setSelectedGroup(null)
    setSelectedSpecial(null)
  }, [activeTab])

  const handleAdd = async () => {
    let subject: string
    let subjectName: string

    if (activeTab === 'user' && selectedUser) {
      subject = selectedUser.id
      subjectName = selectedUser.name
    } else if (activeTab === 'group' && selectedGroup) {
      subject = `@${selectedGroup.id}`
      subjectName = selectedGroup.name
    } else if (activeTab === 'special' && selectedSpecial) {
      subject = selectedSpecial.id
      subjectName = selectedSpecial.name
    } else {
      return
    }

    setIsAdding(true)
    try {
      await onAdd(subject, subjectName, level)
      resetAndClose()
    } finally {
      setIsAdding(false)
    }
  }

  const resetAndClose = () => {
    setUserSearch('')
    setSelectedUser(null)
    setSelectedGroup(null)
    setSelectedSpecial(null)
    setLevel(defaultLevel)
    onOpenChange(false)
  }

  const canAdd =
    (activeTab === 'user' && selectedUser) ||
    (activeTab === 'group' && selectedGroup) ||
    (activeTab === 'special' && selectedSpecial)

  const getSelectedName = () => {
    if (activeTab === 'user' && selectedUser) return selectedUser.name
    if (activeTab === 'group' && selectedGroup) return selectedGroup.name
    if (activeTab === 'special' && selectedSpecial) return selectedSpecial.name
    return null
  }

  return (
    <Dialog open={open} onOpenChange={resetAndClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add access</DialogTitle>
          <DialogDescription>
            Select a user, group, or other rule to grant access.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="user">
              <User className="mr-2 h-4 w-4" />
              User
            </TabsTrigger>
            <TabsTrigger value="group">
              <UsersRound className="mr-2 h-4 w-4" />
              Group
            </TabsTrigger>
            <TabsTrigger value="special">
              <Globe className="mr-2 h-4 w-4" />
              Other
            </TabsTrigger>
          </TabsList>

          <TabsContent value="user" className="mt-4">
            <div className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="user-search">Search users</Label>
                <div className="relative">
                  <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
                  <Input
                    id="user-search"
                    value={userSearch}
                    onChange={(e) => {
                      setUserSearch(e.target.value)
                      setSelectedUser(null)
                    }}
                    placeholder="Type to search..."
                    className="pl-10"
                  />
                </div>
              </div>

              {userSearch.length < 1 ? (
                <p className="text-muted-foreground text-center text-sm">
                  Type to search users
                </p>
              ) : userSearchError ? (
                <GeneralError
                  error={userSearchError}
                  minimal
                  mode='inline'
                  reset={onRetryUserSearch}
                />
              ) : userSearchLoading ? (
                <p className="text-muted-foreground text-center text-sm">
                  Searching...
                </p>
              ) : !userSearchResults.length ? (
                <p className="text-muted-foreground text-center text-sm">
                  No users found
                </p>
              ) : (
                <div className="max-h-48 overflow-y-auto rounded-md border">
                  {userSearchResults.map((user) => (
                    <div
                      key={user.id}
                      className={`flex cursor-pointer items-center gap-2 px-3 py-2 transition-colors ${
                        selectedUser?.id === user.id
                          ? 'bg-hover text-hover-foreground'
                          : 'hover:bg-muted'
                      }`}
                      onClick={() => setSelectedUser(user)}
                    >
                      <User className="h-4 w-4 shrink-0" />
                      <span className="truncate text-sm">{user.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="group" className="mt-4">
            <div className="space-y-4">
              <Label>Select group</Label>
              {groupsError ? (
                <GeneralError
                  error={groupsError}
                  minimal
                  mode='inline'
                  reset={onRetryGroups}
                />
              ) : groups.length === 0 ? (
                <p className="text-muted-foreground text-center text-sm">
                  No groups available
                </p>
              ) : (
                <div className="max-h-48 overflow-y-auto rounded-md border">
                  {groups.map((group) => (
                    <div
                      key={group.id}
                      className={`flex cursor-pointer items-center gap-2 px-3 py-2 transition-colors ${
                        selectedGroup?.id === group.id
                          ? 'bg-hover text-hover-foreground'
                          : 'hover:bg-muted'
                      }`}
                      onClick={() => setSelectedGroup(group)}
                    >
                      <UsersRound className="h-4 w-4 shrink-0" />
                      <div className="min-w-0">
                        <span className="truncate text-sm">{group.name}</span>
                        {group.description && (
                          <p className="text-muted-foreground truncate text-xs">
                            {group.description}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="special" className="mt-4">
            <div className="space-y-4">
              <Label>Select access rule</Label>
              <div className="space-y-2">
                {SPECIAL_SUBJECTS.map((special) => (
                  <Card
                    key={special.id}
                    className={`cursor-pointer py-0 transition-colors ${
                      selectedSpecial?.id === special.id
                        ? 'border-primary'
                        : 'hover:bg-muted'
                    }`}
                    onClick={() => setSelectedSpecial(special)}
                  >
                    <CardContent className="flex items-center gap-2 px-3 py-2">
                      {special.id === '*' ? (
                        <Globe className="h-4 w-4 shrink-0" />
                      ) : (
                        <Users className="h-4 w-4 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <span className="text-sm font-medium">{special.name}</span>
                        <p className="text-muted-foreground text-xs">
                          {special.description}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Access level selector - shown when something is selected */}
        {canAdd && (
          <div className="mt-4 space-y-3 border-t pt-4">
            <p className="text-sm">
              Selected: <span className="font-medium">{getSelectedName()}</span>
            </p>
            <Select value={level} onValueChange={setLevel}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {levels.map((lvl) => (
                  <SelectItem key={lvl.value} value={lvl.value}>
                    {lvl.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={resetAndClose}>
            Cancel
          </Button>
          <Button onClick={handleAdd} disabled={!canAdd || isAdding}>
            {isAdding ? 'Adding...' : 'Add'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
