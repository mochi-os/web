// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { QuoteCard, type Quote } from './quote-card'

// The author's avatar is an EntityAvatar, which reads from the query cache.
function show(quote: Quote) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <QuoteCard quote={quote} />
    </QueryClientProvider>
  )
}

describe('QuoteCard', () => {
  it('links the author, text, picture and network to the post', () => {
    show({
      network: 'bluesky',
      url: 'https://bsky.app/profile/bob.bsky.social/post/3abc',
      text: 'Hi there',
      image: 'https://pds.example/blob',
      author: {
        name: 'Bob',
        address: '@bob.bsky.social',
        avatar: 'https://pds.example/avatar',
      },
    })
    const card = screen.getByTestId('quote-card')
    expect(card.tagName).toBe('A')
    expect(card).toHaveAttribute(
      'href',
      'https://bsky.app/profile/bob.bsky.social/post/3abc'
    )
    expect(screen.getByText('Bob')).toBeTruthy()
    expect(screen.getByText('@bob.bsky.social')).toBeTruthy()
    expect(screen.getByText('Hi there')).toBeTruthy()
    expect(screen.getByText('Bluesky')).toBeTruthy()
    expect(
      card.querySelector('img[src="https://pds.example/blob"]')
    ).not.toBeNull()
  })

  it('follows no link that is not a web one', () => {
    show({
      network: 'fediverse',
      url: 'javascript:alert(1)',
      text: 'x',
      image: 'javascript:alert(2)',
    })
    const card = screen.getByTestId('quote-card')
    expect(card.tagName).toBe('DIV')
    expect(card.querySelector('img[src^="javascript"]')).toBeNull()
    expect(screen.getByText('Fediverse')).toBeTruthy()
  })
})
