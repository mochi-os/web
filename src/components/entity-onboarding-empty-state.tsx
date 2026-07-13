// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import type { LucideIcon } from 'lucide-react'
import { EmptyState } from './ui/empty-state'
import { cn } from '../lib/utils'

interface EntityOnboardingEmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  className?: string
  searchSlot?: React.ReactNode
  primaryActionSlot?: React.ReactNode
  secondarySlot?: React.ReactNode
}

export function EntityOnboardingEmptyState({
  icon,
  title,
  description,
  className,
  searchSlot,
  primaryActionSlot,
  secondarySlot,
}: EntityOnboardingEmptyStateProps) {
  return (
    <EmptyState
      icon={icon}
      title={title}
      description={description}
      className={cn('p-8', className)}
      childrenLayout='column'
      childrenClassName='w-full max-w-md'
    >
      {searchSlot && <div className='w-full'>{searchSlot}</div>}
      {primaryActionSlot}
      {secondarySlot}
    </EmptyState>
  )
}
