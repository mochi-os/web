// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// A post on another network quoted in a Mochi post or message: who wrote it,
// its text and its first picture, the whole card a link to the post. The
// server reads the quote from the network when the post is written and keeps
// it with the post, so subscribers see what the writer saw.
import { EntityAvatar } from './entity-avatar'
import { providerName } from '../lib/provider-name'
import { cn } from '../lib/utils'

export interface QuoteAuthor {
  id?: string
  name?: string
  address?: string
  avatar?: string
  url?: string
}

export interface Quote {
  network: string
  url: string
  id?: string
  text?: string
  image?: string
  created?: number
  author?: QuoteAuthor
}

// Only web links are followed: a quote arrives from another server.
function quoteHref(url: string | undefined): string | undefined {
  return url && /^https?:\/\//i.test(url) ? url : undefined
}

export function QuoteCard({
  quote,
  className,
}: {
  quote: Quote
  className?: string
}) {
  const href = quoteHref(quote.url)
  const author = quote.author
  const name = author?.name || author?.address || ''
  const image = quoteHref(quote.image)
  const body = (
    <>
      {(name || quote.network) && (
        <div className='mb-1 flex items-center gap-2'>
          {name && (
            <EntityAvatar
              src={quoteHref(author?.avatar) ?? null}
              name={name}
              size='sm'
            />
          )}
          {name && <span className='truncate font-medium'>{name}</span>}
          {author?.address && author.name && (
            <span className='text-muted-foreground truncate text-xs'>
              {author.address}
            </span>
          )}
          {quote.network && (
            <span className='text-muted-foreground ms-auto shrink-0 text-xs'>
              {providerName(quote.network)}
            </span>
          )}
        </div>
      )}
      {quote.text && (
        <p className='line-clamp-6 whitespace-pre-wrap break-words'>
          {quote.text}
        </p>
      )}
      {image && (
        <img
          src={image}
          alt=''
          className='mt-2 max-h-[250px] max-w-full rounded-lg object-cover'
        />
      )}
    </>
  )
  const classes = cn(
    'block rounded-lg border bg-muted/30 p-3 text-sm text-foreground no-underline',
    href && 'hover:bg-hover',
    className
  )
  return href ? (
    <a
      href={href}
      target='_blank'
      rel='noopener noreferrer'
      className={classes}
      data-testid='quote-card'
    >
      {body}
    </a>
  ) : (
    <div className={classes} data-testid='quote-card'>
      {body}
    </div>
  )
}
