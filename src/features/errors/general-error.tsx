import { cn } from '../../lib/utils'
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

function getInlineCopy(status: number, rawMessage: string, friendlyMessage?: string) {
  const lowerMessage = rawMessage.toLowerCase()

  if (
    status === 401 ||
    status === 403 ||
    lowerMessage.includes('permission')
  ) {
    return {
      title: 'Permission required',
      description:
        friendlyMessage && friendlyMessage !== 'Permission required'
          ? friendlyMessage
          : 'You do not have access to this section.',
    }
  }

  if (lowerMessage.includes('network') || lowerMessage.includes('failed to fetch')) {
    return {
      title: 'Network issue',
      description: 'Check your connection and try again.',
    }
  }

  if (status === 404) {
    return {
      title: 'Not found',
      description: 'This section is unavailable right now.',
    }
  }

  if (status === 429) {
    return {
      title: 'Too many requests',
      description: 'Please wait a moment and try again.',
    }
  }

  if (status >= 500) {
    return {
      title: 'Server issue',
      description: 'Something went wrong on our side. Try again in a moment.',
    }
  }

  if (friendlyMessage) {
    return {
      title: "Couldn't load this section",
      description: friendlyMessage,
    }
  }

  return {
    title: "Couldn't load this section",
    description: 'Please try again.',
  }
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
  const friendlyMessage = formatErrorMessage(message)
  const displayMessage = friendlyMessage ?? message
  const inlineCopy = getInlineCopy(statusCode, message, friendlyMessage)

  // Use the error message as the heading if it's descriptive
  const isDescriptiveMessage = !!friendlyMessage &&
    !friendlyMessage.toLowerCase().includes('status code') &&
    !friendlyMessage.toLowerCase().includes('request failed')
  const heading = isDescriptiveMessage ? friendlyMessage : statusCode.toString()
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
            <div className='pl-9'>
              <Button
                type='button'
                onClick={reset}
                variant='outline'
                size='sm'
              >
                <RotateCcw className='h-4 w-4' />
                Try again
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
            Try again
          </Button>
        )}
      </div>
    </div>
  )
}
