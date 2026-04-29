import { useEffect, useState } from 'react'
import { useAccent } from '../hooks/use-accent'
import { normalizeEntityUrl } from '../lib/app-path'
import { cn } from '../lib/utils'
import { authenticatedUrl } from '../lib/shell-bridge'
import { FacelessAvatar } from './faceless-avatar'

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
  size?: number
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
  size = 48,
  className,
  alt,
  accent,
}: EntityAvatarProps) {
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
      size={size}
      className={className}
      style={ringStyle}
    />
  ) : (
    <img
      src={resolvedSrc}
      alt={alt ?? (name ? `Avatar for ${name}` : 'Avatar')}
      width={size}
      height={size}
      onError={() => setFailed(true)}
      className={cn(
        'border-border inline-block shrink-0 rounded-full border object-cover',
        className
      )}
      style={{ width: size, height: size, ...ringStyle }}
    />
  )
}
