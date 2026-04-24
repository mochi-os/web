import { useEffect, useState } from 'react'
import { useAccent } from '../hooks/use-accent'
import { normalizeEntityUrl } from '../lib/app-path'
import { cn } from '../lib/utils'
import { authenticatedUrl } from '../lib/shell-bridge'
import { FacelessAvatar } from './faceless-avatar'

type EntityAvatarProps = {
  // Entity fingerprint — resolves to /<fingerprint>/-/avatar. Falls back to the
  // FacelessAvatar initials placeholder on 404 or load error.
  fingerprint?: string | null
  // Optional cache-busting token appended as ?v=<version>. Useful when the
  // caller already knows the upload token (e.g. profile editor after a new
  // upload).
  version?: string
  // Direct URL override. If set, takes precedence over fingerprint.
  src?: string | null
  // Direct URL for the entity's style endpoint. When rendering an entity owned
  // by another peer, the consuming app proxies /style through its own action
  // (same pattern as src). Falls back to /<fingerprint>/-/style when omitted.
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

const AVATAR_CACHE_MAX = 500
const avatarValidityCache = new Map<string, boolean>()

function rememberValidity(url: string, valid: boolean) {
  if (avatarValidityCache.size >= AVATAR_CACHE_MAX) {
    const oldest = avatarValidityCache.keys().next().value
    if (oldest !== undefined) avatarValidityCache.delete(oldest)
  }
  avatarValidityCache.set(url, valid)
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
  const [state, setState] = useState<'loading' | 'loaded' | 'error'>(() => {
    if (!rawSrc) return 'error'
    const cached = avatarValidityCache.get(rawSrc)
    if (cached !== undefined) return cached ? 'loaded' : 'error'
    return 'loading'
  })

  // Probe via fetch and require Content-Type: image/*. The backend may return
  // 200 with text/html (SPA shell) for unknown/remote persons, and browsers
  // can also report transient aborts as errors on <img>. Checking content-type
  // is deterministic.
  useEffect(() => {
    if (!rawSrc || !resolvedSrc) {
      setState('error')
      return
    }

    const cached = avatarValidityCache.get(rawSrc)
    if (cached !== undefined) {
      setState(cached ? 'loaded' : 'error')
      return
    }

    setState('loading')
    const controller = new AbortController()
    fetch(resolvedSrc, { method: 'HEAD', credentials: 'same-origin', signal: controller.signal })
      .then((response) => {
        const contentType = response.headers.get('content-type') ?? ''
        const valid = response.ok && contentType.startsWith('image/')
        rememberValidity(rawSrc, valid)
        setState(valid ? 'loaded' : 'error')
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          rememberValidity(rawSrc, false)
          setState('error')
        }
      })
    return () => controller.abort()
  }, [rawSrc, resolvedSrc])

  const content = !resolvedSrc || state !== 'loaded' ? (
    <FacelessAvatar
      name={name}
      seed={seed ?? fingerprint ?? undefined}
      size={size}
      className={cn(ring && 'border-0', className)}
    />
  ) : (
    <img
      src={resolvedSrc}
      alt={alt ?? (name ? `Avatar for ${name}` : 'Avatar')}
      width={size}
      height={size}
      className={cn(
        'border-border inline-block shrink-0 rounded-full border object-cover',
        ring && 'border-0',
        className
      )}
      style={{ width: size, height: size }}
    />
  )

  if (ring) {
    return (
      <span
        className="inline-flex shrink-0 rounded-full"
        style={{ boxShadow: `0 0 0 2px ${ring}`, lineHeight: 0 }}
      >
        {content}
      </span>
    )
  }

  return content
}
