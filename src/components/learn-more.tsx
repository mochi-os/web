import { type Root, type Content, type Trigger } from '@radix-ui/react-popover'
import { CircleHelp } from 'lucide-react'
import { cn } from '../lib/utils'
import { Button } from './ui/button'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'

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
      <PopoverTrigger
        asChild
        {...triggerProps}
        className={cn('size-5 rounded-full', triggerProps?.className)}
      >
        <Button variant="outline" size="icon">
          <span className="sr-only">Learn more</span>
          <CircleHelp className="size-4" />
        </Button>
      </PopoverTrigger>
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
