import { useEffect, useState } from 'react'
import { cn } from '../lib/utils'
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
  name?: string
  seed?: string
  size?: number
  className?: string
  alt?: string
}

function fingerprintUrl(fingerprint: string, version?: string): string {
  const base = `/${fingerprint}/-/avatar`
  return version ? `${base}?v=${encodeURIComponent(version)}` : base
}

export function EntityAvatar({
  fingerprint,
  version,
  src,
  name,
  seed,
  size = 48,
  className,
  alt,
}: EntityAvatarProps) {
  const resolvedSrc = src ?? (fingerprint ? fingerprintUrl(fingerprint, version) : null)
  const [state, setState] = useState<'loading' | 'loaded' | 'error'>(
    resolvedSrc ? 'loading' : 'error'
  )

  // Probe via fetch and require Content-Type: image/*. The backend may return
  // 200 with text/html (SPA shell) for unknown/remote persons, and browsers
  // can also report transient aborts as errors on <img>. Checking content-type
  // is deterministic.
  useEffect(() => {
    if (!resolvedSrc) {
      setState('error')
      return
    }
    setState('loading')
    const controller = new AbortController()
    fetch(resolvedSrc, { method: 'HEAD', credentials: 'same-origin', signal: controller.signal })
      .then((response) => {
        const contentType = response.headers.get('content-type') ?? ''
        if (response.ok && contentType.startsWith('image/')) {
          setState('loaded')
        } else {
          setState('error')
        }
      })
      .catch(() => {
        // Abort is expected on unmount; any other failure means we should fall back.
        if (!controller.signal.aborted) setState('error')
      })
    return () => controller.abort()
  }, [resolvedSrc])

  if (!resolvedSrc || state !== 'loaded') {
    return (
      <FacelessAvatar
        name={name}
        seed={seed ?? fingerprint ?? undefined}
        size={size}
        className={className}
      />
    )
  }

  return (
    <img
      src={resolvedSrc}
      alt={alt ?? (name ? `Avatar for ${name}` : 'Avatar')}
      width={size}
      height={size}
      className={cn(
        'border-border inline-block shrink-0 rounded-full border object-cover',
        className
      )}
      style={{ width: size, height: size }}
    />
  )
}
