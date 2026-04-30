import { useEffect, useState } from 'react'
import { useAccent } from '../hooks/use-accent'
import { normalizeEntityUrl } from '../lib/app-path'
import { cn } from '../lib/utils'
import { authenticatedUrl } from '../lib/shell-bridge'
import { FacelessAvatar } from './faceless-avatar'

// Standard avatar tiers. Pick by intent, not pixels:
//   xs  — inline next to text (notifications, mod log, restriction rows)
//   sm  — sidebar items, list rows
//   md  — member lists, table cells, search-result rows
//   lg  — dense feature list rows (friends list, add-friend results)
//   xl  — page header
//   2xl — profile hero
export const AVATAR_SIZES = {
  xs: 20,
  sm: 28,
  md: 32,
  lg: 40,
  xl: 48,
  '2xl': 80,
} as const

export type AvatarSize = keyof typeof AVATAR_SIZES

type EntityAvatarProps = {
  fingerprint?: string | null
  // Optional cache-busting token appended as ?v=<version>
  version?: string
  // Direct URL override. If set, takes precedence over fingerprint.
  src?: string | null
  // Direct URL for the entity's style endpoint. When rendering an entity owned
  // by another peer, the consuming app proxies /style through its own action.
  styleUrl?: string | null
  name?: string
  seed?: string
  // Pixel size or tier name (xs/sm/md/lg/xl/2xl). Prefer tier names for new code.
  size?: number | AvatarSize
  className?: string
  alt?: string
  // Explicit accent colour for the ring. Takes precedence over the automatic
  // lookup — pass this when the caller already has the accent value and would
  // otherwise force a redundant style fetch.
  accent?: string
}

function fingerprintUrl(fingerprint: string, version?: string): string {
  const base = `/${fingerprint}/-/avatar`
  return version ? `${base}?v=${encodeURIComponent(version)}` : base
}

export function EntityAvatar({
  fingerprint,
  version,
  src,
  styleUrl,
  name,
  seed,
  size = 'xl',
  className,
  alt,
  accent,
}: EntityAvatarProps) {
  const px = typeof size === 'number' ? size : AVATAR_SIZES[size]
  const rawSrc = src ?? (fingerprint ? fingerprintUrl(fingerprint, version) : null)
  const resolvedSrc = rawSrc ? authenticatedUrl(normalizeEntityUrl(rawSrc)) : null
  const { accent: fetched } = useAccent(
    !accent && !styleUrl && fingerprint ? fingerprint : undefined,
    !accent && styleUrl ? normalizeEntityUrl(styleUrl) : undefined
  )
  const ring = accent ?? fetched
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setFailed(false)
  }, [resolvedSrc])

  const ringStyle = ring ? { borderWidth: 2, borderColor: ring } : undefined

  return !resolvedSrc || failed ? (
    <FacelessAvatar
      name={name}
      seed={seed ?? fingerprint ?? undefined}
      size={px}
      className={className}
      style={ringStyle}
    />
  ) : (
    <img
      src={resolvedSrc}
      alt={alt ?? (name ? `Avatar for ${name}` : 'Avatar')}
      width={px}
      height={px}
      onError={() => setFailed(true)}
      className={cn(
        'border-border inline-block shrink-0 rounded-full border object-cover',
        className
      )}
      style={{ width: px, height: px, ...ringStyle }}
    />
  )
}
