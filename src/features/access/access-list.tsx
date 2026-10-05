// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { useState, type CSSProperties } from 'react'
import { Trans } from '@lingui/react/macro'
import { User, UsersRound, Globe, Users, X, Trash2 } from 'lucide-react'
import { cn } from '../../lib/utils'
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
import { ConfirmDialog } from '../../components/confirm-dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../../components/ui/tooltip'
import type { AccessLevel, AccessRule } from './types'
import { GeneralError } from '../errors/general-error'
import { t } from '@lingui/core/macro'

// Special-subject labels, resolved per call rather than once at module load.
// A module-level `const { '*': t`Anyone` }` is evaluated when this file is
// imported - before the shell has sent the user's language - so it would pin
// whatever locale happened to be active then and never update on a change.
function subjectLabel(subject: string): string | undefined {
  if (subject === '*') return t`Anyone`
  if (subject === '+') return t`Authenticated users`
  return undefined
}

export interface AccessListProps {
  rules: AccessRule[]
  levels: AccessLevel[]
  onLevelChange: (subject: string, level: string) => Promise<void>
  onRevoke: (subject: string) => Promise<void>
  isLoading?: boolean
  error?: Error | null
  onRetry?: () => void
  /** Minimum width for the level select dropdown; it grows to fit longer labels (default: 250px) */
  selectWidth?: number
  /** Draw the table's own border. Off by default, since access management
   *  almost always sits inside a settings Card that already draws one. */
  bordered?: boolean
}

function formatSubject(subject: string, name?: string): string {
  const special = subjectLabel(subject)
  if (special) {
    return special
  }
  if (subject.startsWith('@')) {
    return t`Group: ${name || subject.slice(1)}`
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
    return <Globe className='h-4 w-4 shrink-0' />
  }
  if (subject === '+') {
    return <Users className='h-4 w-4 shrink-0' />
  }
  if (subject.startsWith('@')) {
    return <UsersRound className='h-4 w-4 shrink-0' />
  }
  return <User className='h-4 w-4 shrink-0' />
}

// Sort subjects: owners first, then users, then groups, then +, then *
function subjectPriority(subject: string, owner?: boolean): number {
  if (owner) return -1
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
  bordered = false,
}: AccessListProps) {
  const [updatingSubject, setUpdatingSubject] = useState<string | null>(null)
  const [removeSubject, setRemoveSubject] = useState<string | null>(null)

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
      setRemoveSubject(null)
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
      <div className='space-y-2'>
        <Skeleton className='h-10 w-full' />
        <Skeleton className='h-10 w-full' />
        <Skeleton className='h-10 w-full' />
      </div>
    )
  }

  if (error) {
    return <GeneralError mode='inline' minimal error={error} reset={onRetry} />
  }

  if (!rules.length) {
    return (
      <p className='text-muted-foreground text-sm'>
        <Trans>
          No access rules configured. Add rules to control who can access this
          resource.
        </Trans>
      </p>
    )
  }

  // Group rules by subject
  // For hierarchical model, there's one rule per subject
  // For permission model, there might be multiple rules per subject
  const subjectData = new Map<
    string,
    { rules: AccessRule[]; name?: string; owner?: boolean }
  >()
  for (const rule of rules) {
    const existing = subjectData.get(rule.subject)
    if (existing) {
      existing.rules.push(rule)
    } else {
      subjectData.set(rule.subject, {
        rules: [rule],
        name: rule.name,
        owner: rule.owner,
      })
    }
  }

  // Sort by priority (owners first, then users, then groups, +, *)
  const sortedSubjects = [...subjectData.entries()].sort(
    ([a, aData], [b, bData]) =>
      subjectPriority(a, aData.owner) - subjectPriority(b, bData.owner)
  )

  const removeData = removeSubject ? subjectData.get(removeSubject) : null

  return (
    <>
      {/* Below sm the three columns do not fit beside each other, so each rule
          becomes two lines: who it is for with Remove at the end, then the
          level picker at full width. Same markup, laid out as a grid. */}
      <Table bordered={bordered} className='max-sm:block'>
        <TableHeader className='max-sm:sr-only'>
          <TableRow>
            <TableHead>
              <Trans>Subject</Trans>
            </TableHead>
            <TableHead>
              <Trans>Access level</Trans>
            </TableHead>
            <TableHead className='w-[50px]'></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className='max-sm:block'>
          {sortedSubjects.map(([subject, data]) => {
            // For hierarchical model, use the first (and only) rule
            // For permission model, this would need different handling
            const rule = data.rules[0]
            const currentLevel = getRuleLevel(rule)
            const isUpdating = updatingSubject === subject
            const isOwner = data.owner

            return (
              <TableRow
                key={subject}
                className={cn(
                  'max-sm:grid max-sm:grid-cols-[minmax(0,1fr)_auto] max-sm:items-center max-sm:gap-x-2 max-sm:py-2',
                  // Inside a Card the card pads the row; with its own border
                  // the table has to.
                  bordered && 'max-sm:px-3'
                )}
              >
                <TableCell className='max-sm:block max-sm:min-w-0 max-sm:px-0 max-sm:py-1'>
                  <div className='flex min-w-0 items-center gap-2'>
                    {getSubjectIcon(subject)}
                    <span className='font-medium max-sm:truncate'>
                      {formatSubject(subject, data.name)}
                    </span>
                  </div>
                </TableCell>
                <TableCell className='max-sm:col-span-2 max-sm:row-start-2 max-sm:block max-sm:px-0 max-sm:py-1'>
                  {isOwner ? (
                    <span className='text-sm'>
                      <Trans>Owner</Trans>
                    </span>
                  ) : (
                    <Select
                      value={currentLevel}
                      onValueChange={(newLevel) =>
                        void handleLevelChange(subject, newLevel)
                      }
                      disabled={isUpdating}
                    >
                      <SelectTrigger
                        style={
                          {
                            '--access-select-width': `${selectWidth}px`,
                          } as CSSProperties
                        }
                        className='h-8 max-w-full max-sm:w-full sm:-ms-3 sm:min-w-(--access-select-width)'
                      >
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
                <TableCell className='max-sm:col-start-2 max-sm:row-start-1 max-sm:block max-sm:p-0'>
                  {!isOwner && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant='ghost'
                          size='icon'
                          disabled={isUpdating}
                          aria-label={t`Remove access rule`}
                          onClick={() => setRemoveSubject(subject)}
                        >
                          <X className='h-4 w-4' />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{t`Remove access rule`}</TooltipContent>
                    </Tooltip>
                  )}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>

      <ConfirmDialog
        open={!!removeSubject}
        onOpenChange={(open) => {
          if (!open) setRemoveSubject(null)
        }}
        title={t`Remove access?`}
        desc={t`Remove access rule for "${formatSubject(removeSubject ?? '', removeData?.name)}"?`}
        confirmText={t`Remove`}
        icon={<Trash2 className='size-4' />}
        isLoading={!!updatingSubject && updatingSubject === removeSubject}
        handleConfirm={() => {
          if (removeSubject) void handleRevoke(removeSubject)
        }}
      />
    </>
  )
}
