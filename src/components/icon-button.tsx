import type { ComponentProps } from 'react'
import { Button } from './ui/button'

type IconButtonProps = Omit<ComponentProps<typeof Button>, 'size' | 'aria-label'> & {
  label: string
}

export function IconButton({ label, title, ...props }: IconButtonProps) {
  return (
    <Button
      size='icon'
      aria-label={label}
      title={title ?? label}
      {...props}
    />
  )
}
