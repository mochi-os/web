import { Trans } from '@lingui/react/macro'

/**
 * Footer linking to the three server-level documents (rules / terms /
 * privacy). The links are relative, so they resolve under whichever app
 * mounts this component. The host app must declare its own `document/rules`,
 * `document/terms`, `document/privacy` SPA routes (each mounting
 * `<DocumentPage name='…' />`) plus a `-/document/get` action that calls
 * `mochi.document.get()`. Per CLAUDE.md, an app must never link to another
 * app's pages just because they render the same content.
 */
export function ServerDocumentsFooter() {
  return (
    <p className='text-muted-foreground space-x-2 pb-6 pt-2 text-center text-sm'>
      <a href='document/rules' className='hover:text-foreground transition-colors'>
        <Trans>Server rules</Trans>
      </a>
      <span aria-hidden='true'>·</span>
      <a href='document/terms' className='hover:text-foreground transition-colors'>
        <Trans>Terms and conditions</Trans>
      </a>
      <span aria-hidden='true'>·</span>
      <a href='document/privacy' className='hover:text-foreground transition-colors'>
        <Trans>Privacy</Trans>
      </a>
    </p>
  )
}
