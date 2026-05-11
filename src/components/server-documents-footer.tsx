import { Trans } from '@lingui/react/macro'

export function ServerDocumentsFooter() {
  return (
    <p className='text-muted-foreground space-x-2 pb-6 pt-2 text-center text-sm'>
      <a href='/settings/document/rules' className='hover:text-foreground transition-colors'>
        <Trans>Server rules</Trans>
      </a>
      <span aria-hidden='true'>·</span>
      <a href='/settings/document/terms' className='hover:text-foreground transition-colors'>
        <Trans>Terms and conditions</Trans>
      </a>
      <span aria-hidden='true'>·</span>
      <a href='/settings/document/privacy' className='hover:text-foreground transition-colors'>
        <Trans>Privacy</Trans>
      </a>
    </p>
  )
}
