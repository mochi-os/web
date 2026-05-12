import { Link } from '@tanstack/react-router'
import { Trans } from '@lingui/react/macro'

/**
 * Footer linking to the three server-level documents (rules / terms /
 * privacy). Uses TanStack Router <Link> so navigation is client-side —
 * no iframe reload, shell URL sync via the pushState patch fires correctly.
 * The host app must declare `document/rules`, `document/terms`,
 * `document/privacy` routes (each mounting `<DocumentPage name='…' />`)
 * plus a `-/document/get` action. Per CLAUDE.md, an app must never link
 * to another app's pages just because they render the same content.
 */
export function ServerDocumentsFooter() {
  return (
    <p className='text-muted-foreground space-x-2 pb-6 pt-2 text-center text-sm'>
      <Link to='document/rules' className='hover:text-foreground transition-colors'>
        <Trans>Server rules</Trans>
      </Link>
      <span aria-hidden='true'>·</span>
      <Link to='document/terms' className='hover:text-foreground transition-colors'>
        <Trans>Terms and conditions</Trans>
      </Link>
      <span aria-hidden='true'>·</span>
      <Link to='document/privacy' className='hover:text-foreground transition-colors'>
        <Trans>Privacy</Trans>
      </Link>
    </p>
  )
}
