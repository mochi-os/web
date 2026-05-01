import { useNavigate, useRouter } from '@tanstack/react-router'
import { Trans } from '@lingui/react/macro'
import { Button } from '../../components/ui/button'

export function NotFoundError() {
  const navigate = useNavigate()
  const { history } = useRouter()
  return (
    <div className='h-svh'>
      <div className='m-auto flex h-full w-full flex-col items-center justify-center gap-2'>
        <h1 className='text-[7rem] leading-tight font-bold'>404</h1>
        <span className='font-medium'><Trans>Oops! Page Not Found!</Trans></span>
        <p className='text-muted-foreground text-center'>
          It seems like the page you're looking for <br />
          does not exist or might have been removed.
        </p>
        <div className='mt-6 flex gap-4'>
          <Button variant='outline' onClick={() => history.go(-1)}>
            <Trans>Go Back</Trans>
          </Button>
          <Button onClick={() => navigate({ to: '/' })}><Trans>Back to Home</Trans></Button>
        </div>
      </div>
    </div>
  )
}
