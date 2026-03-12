import { createElement } from 'react'
import { toast as sonnerToast, type ExternalToast } from 'sonner'
import { Copy } from 'lucide-react'
import { shellClipboardWrite } from './shell-bridge'

// Error toasts stay longer (10s vs default 6s)
const ERROR_DURATION = 10000

// Toast wrapper that adds copy functionality to error toasts
export const toast = {
  ...sonnerToast,
  success: sonnerToast.success,
  info: sonnerToast.info,
  warning: sonnerToast.warning,
  message: sonnerToast.message,

  // Override error to add copy action and longer duration
  error: (message: string | React.ReactNode, data?: ExternalToast) => {
    const description = data?.description
    const textToCopy =
      typeof message === 'string'
        ? description
          ? `${message}: ${description}`
          : message
        : description
          ? String(description)
          : ''

    return sonnerToast.error(message, {
      duration: ERROR_DURATION,
      ...data,
      action: textToCopy
        ? {
            label: createElement(Copy, { className: 'h-4 w-4' }),
            onClick: async () => {
              const ok = await shellClipboardWrite(textToCopy)
              if (ok) {
                sonnerToast.success('Copied')
              } else {
                sonnerToast.error('Failed to copy')
              }
            },
          }
        : undefined,
      classNames: {
        actionButton: '!bg-transparent !text-current !p-1',
        ...data?.classNames,
      },
    })
  },
}
