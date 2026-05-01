import { useState } from 'react'
import { Trans, useLingui } from '@lingui/react/macro'
import { User, UsersRound, Globe, Users, X } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { Skeleton } from '../../components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../../components/ui/alert-dialog'
import type { AccessLevel, AccessRule } from './types'
import { GeneralError } from '../errors/general-error'

// Subject display labels for special subjects
const SUBJECT_LABELS: Record<string, string> = {
  '*': 'Anyone',
  '+': 'Authenticated users',
}

export interface AccessListProps {
  rules: AccessRule[]
  levels: AccessLevel[]
  onLevelChange: (subject: string, level: string) => Promise<void>
  onRevoke: (subject: string) => Promise<void>
  isLoading?: boolean
  error?: Error | null
  onRetry?: () => void
  /** Width for the level select dropdown (default: 250px) */
  selectWidth?: number
}

function formatSubject(subject: string, name?: string): string {
  if (SUBJECT_LABELS[subject]) {
    return SUBJECT_LABELS[subject]
  }
  if (subject.startsWith('@')) {
    return `Group: ${name || subject.slice(1)}`
  }
  // For entity IDs, show name if available, otherwise truncate
  if (name) {
    return name
  }
  if (subject.length > 20) {
    return `${subject.slice(0, 8)}...${subject.slice(-8)}`
  }
  return subject
}

function getSubjectIcon(subject: string) {
  if (subject === '*') {
    return <Globe className="h-4 w-4 shrink-0" />
  }
  if (subject === '+') {
    return <Users className="h-4 w-4 shrink-0" />
  }
  if (subject.startsWith('@')) {
    return <UsersRound className="h-4 w-4 shrink-0" />
  }
  return <User className="h-4 w-4 shrink-0" />
}

// Sort subjects: owners first, then users, then groups, then +, then *
function subjectPriority(subject: string, isOwner?: boolean): number {
  if (isOwner) return -1
  if (subject === '*') return 3
  if (subject === '+') return 2
  if (subject.startsWith('@') || subject.startsWith('#')) return 1
  return 0
}

export function AccessList({
  rules,
  levels,
  onLevelChange,
  onRevoke,
  isLoading = false,
  error = null,
  onRetry,
  selectWidth = 250,
}: AccessListProps) {
  const { t } = useLingui()
  const [updatingSubject, setUpdatingSubject] = useState<string | null>(null)

  const handleLevelChange = async (subject: string, newLevel: string) => {
    setUpdatingSubject(subject)
    try {
      await onLevelChange(subject, newLevel)
    } finally {
      setUpdatingSubject(null)
    }
  }

  const handleRevoke = async (subject: string) => {
    setUpdatingSubject(subject)
    try {
      await onRevoke(subject)
    } finally {
      setUpdatingSubject(null)
    }
  }

  // Get the current level for a rule based on its operation
  const getRuleLevel = (rule: AccessRule): string => {
    // For deny rules, return 'none'
    if (rule.grant === 0) {
      return 'none'
    }
    // Otherwise return the operation as the level
    return rule.operation
  }

  // Get the label for a level value
  const getLevelLabel = (value: string): string => {
    const level = levels.find((l) => l.value === value)
    return level?.label || value
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    )
  }

  if (error) {
    return <GeneralError mode='inline' minimal error={error} reset={onRetry} />
  }

  if (!rules.length) {
    return (
      <p className="text-muted-foreground text-sm">
        <Trans>No access rules configured. Add rules to control who can access this resource.</Trans>
      </p>
    )
  }

  // Group rules by subject
  // For hierarchical model, there's one rule per subject
  // For permission model, there might be multiple rules per subject
  const subjectData = new Map<string, { rules: AccessRule[]; name?: string; isOwner?: boolean }>()
  for (const rule of rules) {
    const existing = subjectData.get(rule.subject)
    if (existing) {
      existing.rules.push(rule)
    } else {
      subjectData.set(rule.subject, {
        rules: [rule],
        name: rule.name,
        isOwner: rule.isOwner,
      })
    }
  }

  // Sort by priority (owners first, then users, then groups, +, *)
  const sortedSubjects = [...subjectData.entries()].sort(
    ([a, aData], [b, bData]) => subjectPriority(a, aData.isOwner) - subjectPriority(b, bData.isOwner)
  )

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead><Trans>Subject</Trans></TableHead>
          <TableHead><Trans>Access level</Trans></TableHead>
          <TableHead className="w-[50px]"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sortedSubjects.map(([subject, data]) => {
          // For hierarchical model, use the first (and only) rule
          // For permission model, this would need different handling
          const rule = data.rules[0]
          const currentLevel = getRuleLevel(rule)
          const isUpdating = updatingSubject === subject
          const isOwner = data.isOwner

          return (
            <TableRow key={subject}>
              <TableCell>
                <div className="flex items-center gap-2">
                  {getSubjectIcon(subject)}
                  <span className="font-medium">
                    {formatSubject(subject, data.name)}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                {isOwner ? (
                  <span className="text-sm"><Trans>Owner</Trans></span>
                ) : (
                  <Select
                    value={currentLevel}
                    onValueChange={(newLevel) => void handleLevelChange(subject, newLevel)}
                    disabled={isUpdating}
                  >
                    <SelectTrigger style={{ width: selectWidth }} className="h-8 -ml-3">
                      <SelectValue>{getLevelLabel(currentLevel)}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {levels.map((level) => (
                        <SelectItem key={level.value} value={level.value}>
                          {level.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </TableCell>
              <TableCell>
                {!isOwner && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={isUpdating}
                        aria-label={t`Remove access rule`}
                        title={t`Remove access rule`}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle><Trans>Remove access?</Trans></AlertDialogTitle>
                        <AlertDialogDescription>
                          Remove access rule for "{formatSubject(subject, data.name)}"?
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel><Trans>Cancel</Trans></AlertDialogCancel>
                        <AlertDialogAction onClick={() => void handleRevoke(subject)}>
                          <Trans>Remove</Trans>
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
