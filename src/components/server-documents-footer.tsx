import { Link } from '@tanstack/react-router'
import type { ComponentProps } from 'react'
import { Trans } from '@lingui/react/macro'

// Link's `to` prop is typed against each consumer app's route tree.
// A shared lib component can't satisfy every app's tree simultaneously,
// so we cast to a loose anchor-compatible type here. Runtime behaviour
// is unchanged — Link still does client-side navigation.
const DocLink = Link as React.ComponentType<
  Omit<ComponentProps<'a'>, 'href'> & { to: string }
>

/**
 * Footer linking to the three server-level documents (rules / terms /
 * privacy). Uses TanStack Router <Link> so navigation is client-side —
 * no iframe reload, shell URL sync via the pushState patch fires correctly.
 * The host app must declare `/document/rules`, `/document/terms`,
 * `/document/privacy` routes (each mounting `<DocumentPage name='…' />`)
 * plus a `-/document/get` action. Per CLAUDE.md, an app must never link
 * to another app's pages just because they render the same content.
 */
export function ServerDocumentsFooter() {
  return (
    <p className='text-muted-foreground space-x-2 pb-6 pt-2 text-center text-sm'>
      <DocLink to='/document/rules' className='hover:text-foreground transition-colors'>
        <Trans>Server rules</Trans>
      </DocLink>
      <span aria-hidden='true'>·</span>
      <DocLink to='/document/terms' className='hover:text-foreground transition-colors'>
        <Trans>Terms and conditions</Trans>
      </DocLink>
      <span aria-hidden='true'>·</span>
      <DocLink to='/document/privacy' className='hover:text-foreground transition-colors'>
        <Trans>Privacy</Trans>
      </DocLink>
    </p>
  )
}
