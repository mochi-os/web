// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { cn } from '../../lib/utils'
import { Trans } from '@lingui/react/macro'
import { normalizeError } from '../../lib/error-normalizer'
import { Button } from '../../components/ui/button'
import { CircleAlert, RotateCcw } from 'lucide-react'

type GeneralErrorProps = React.HTMLAttributes<HTMLDivElement> & {
  minimal?: boolean
  error?: unknown
  reset?: () => void
  mode?: 'fullscreen' | 'inline'
}

const GENERIC_ERROR_MESSAGE = 'An unexpected error occurred'

function toReadableMessage(value: string): string {
  return value
    .trim()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^\w/, (char) => char.toUpperCase())
}

function isIdentifierMessage(value: string): boolean {
  return /^[a-z0-9]+(?:[_-][a-z0-9]+)+$/i.test(value.trim())
}

function formatErrorMessage(message: string): string | undefined {
  const trimmed = message.trim()
  if (!trimmed || trimmed === GENERIC_ERROR_MESSAGE) {
    return undefined
  }

  if (/^request failed with status code \d+$/i.test(trimmed)) {
    return undefined
  }

  if (isIdentifierMessage(trimmed)) {
    return toReadableMessage(trimmed)
  }

  return trimmed
}

function getInlineCopy(status: number, rawMessage: string, errorMessage?: string, source?: string) {
  const lowerMessage = rawMessage.toLowerCase()

  if (source === 'error.message (network)') {
    return { 
      title: <Trans>Network error</Trans>, 
      description: <Trans>Please check your internet connection and try again.</Trans> 
    }
  }

  if (status === 401 || status === 403 || lowerMessage.includes('permission')) {
    return { 
      title: <Trans>Access denied</Trans>, 
      description: errorMessage ?? <Trans>You do not have access to this section.</Trans> 
    }
  }

  if (status === 404) {
    return { 
      title: <Trans>Not found</Trans>, 
      description: errorMessage ?? <Trans>The requested content could not be found.</Trans> 
    }
  }

  if (status === 429) {
    return { 
      title: <Trans>Too many requests</Trans>, 
      description: errorMessage ?? <Trans>Please wait a moment and try again.</Trans> 
    }
  }

  if (errorMessage && errorMessage.toLowerCase() !== 'network error') {
    return { title: errorMessage, description: undefined }
  }

  return { title: <Trans>Please try again.</Trans>, description: undefined }
}

export function GeneralError({
  className,
  minimal = false,
  error,
  reset,
  mode = 'fullscreen',
}: GeneralErrorProps) {
  const normalized = normalizeError(error)
  const statusCode = normalized.status ?? 500
  const message = normalized.message
  const errorMessage = formatErrorMessage(message)
  const displayMessage = errorMessage ?? message
  const inlineCopy = getInlineCopy(statusCode, message, errorMessage, normalized.source)

  // Use the error message as the heading if it's descriptive
  const isDescriptiveMessage = !!errorMessage &&
    !errorMessage.toLowerCase().includes('status code') &&
    !errorMessage.toLowerCase().includes('request failed')
  const heading = isDescriptiveMessage ? errorMessage : statusCode.toString()
  const showHeading = !minimal
  const showMessage = minimal || !isDescriptiveMessage

  if (mode === 'inline') {
    return (
      <div
        className={cn(
          'mx-auto w-full max-w-lg rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-4',
          className
        )}
        role='status'
        aria-live='polite'
      >
        <div className='flex flex-col gap-3'>
          <div className='flex items-start gap-3'>
            <div className='mt-0.5 rounded-full bg-destructive/10 p-1.5'>
              <CircleAlert className='text-destructive h-4 w-4' />
            </div>
            <div className='space-y-1'>
              <p className='text-sm font-semibold'>{inlineCopy.title}</p>
              {inlineCopy.description && (
                <p className='text-muted-foreground text-sm'>{inlineCopy.description}</p>
              )}
            </div>
          </div>

          {reset && (
            <div className='ps-9'>
              <Button
                type='button'
                onClick={reset}
                variant='outline'
                size='sm'
              >
                <RotateCcw className='h-4 w-4' />
                <Trans>Try again</Trans>
              </Button>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'w-full',
        mode === 'fullscreen' && 'h-svh',
        className
      )}
    >
      <div
        className={cn(
          'flex w-full flex-col items-center justify-center gap-2',
          mode === 'fullscreen' && 'm-auto h-full'
        )}
      >
        {showHeading && (
          <h1 className='text-4xl leading-tight font-bold text-center'>{heading}</h1>
        )}
        {showMessage && (
          <p className='text-muted-foreground text-center'>
            {displayMessage}
          </p>
        )}
        {reset && (
          <Button
            type='button'
            onClick={reset}
            variant='outline'
            size='sm'
            className='mt-2'
          >
            <RotateCcw className='h-4 w-4' />
            <Trans>Try again</Trans>
          </Button>
        )}
      </div>
    </div>
  )
}
