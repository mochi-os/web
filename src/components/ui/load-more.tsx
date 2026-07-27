// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { Trans, useLingui } from '@lingui/react/macro'
import { Button } from './button'

interface LoadMoreProps {
  hasMore: boolean
  isLoading: boolean
  onLoadMore: () => void
  totalShown: number
  total: number
  label?: string
}

export function LoadMore({
  hasMore,
  isLoading,
  onLoadMore,
  totalShown,
  total,
  label,
}: LoadMoreProps) {
  const { t } = useLingui()
  if (!hasMore && totalShown === 0) return null
  return (
    <div className='mt-4 flex flex-col items-center gap-2'>
      {hasMore ? (
        <Button
          variant='outline'
          size='sm'
          onClick={onLoadMore}
          disabled={isLoading}
        >
          {isLoading ? <Trans>Loading...</Trans> : (label ?? t`Load more`)}
        </Button>
      ) : null}
      <p className='text-xs text-muted-foreground'>
        <Trans>Showing {totalShown} of {total}</Trans>
      </p>
    </div>
  )
}
