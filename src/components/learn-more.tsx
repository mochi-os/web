// Copyright © 2026 Mochi OÜ
// SPDX-License-Identifier: Apache-2.0

import { type Root, type Content, type Trigger } from '@radix-ui/react-popover'
import { Trans } from '@lingui/react/macro'
import { CircleHelp } from 'lucide-react'
import { cn } from '../lib/utils'
import { Button } from './ui/button'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'

type LearnMoreProps = React.ComponentProps<typeof Root> & {
  contentProps?: React.ComponentProps<typeof Content>
  triggerProps?: React.ComponentProps<typeof Trigger>
}

export function LearnMore({
  children,
  contentProps,
  triggerProps,
  ...props
}: LearnMoreProps) {
  return (
    <Popover {...props}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger
            asChild
            {...triggerProps}
            className={cn('size-5 rounded-full', triggerProps?.className)}
          >
            <Button variant="outline" size="icon">
              <span className="sr-only"><Trans>Learn more</Trans></span>
              <CircleHelp className="size-4" />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent><Trans>Learn more</Trans></TooltipContent>
      </Tooltip>
      <PopoverContent
        side="top"
        align="start"
        {...contentProps}
        className={cn('text-muted-foreground text-sm', contentProps?.className)}
      >
        {children}
      </PopoverContent>
    </Popover>
  )
}
