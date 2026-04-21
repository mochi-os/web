import { useState } from 'react'
import { cn } from '../lib/utils'
import { FacelessAvatar } from './faceless-avatar'

type EntityAvatarProps = {
  src?: string | null
  name?: string
  seed?: string
  size?: number
  className?: string
  alt?: string
}

export function EntityAvatar({
  src,
  name,
  seed,
  size = 48,
  className,
  alt,
}: EntityAvatarProps) {
  const [errored, setErrored] = useState(false)

  if (!src || errored) {
    return (
      <FacelessAvatar
        name={name}
        seed={seed}
        size={size}
        className={className}
      />
    )
  }

  return (
    <img
      src={src}
      alt={alt ?? (name ? `Avatar for ${name}` : 'Avatar')}
      width={size}
      height={size}
      onError={() => setErrored(true)}
      className={cn(
        'border-border inline-block shrink-0 rounded-full border object-cover',
        className
      )}
      style={{ width: size, height: size }}
    />
  )
}
