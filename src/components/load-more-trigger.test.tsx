// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// Inside the shell's sandboxed iframe the browser ignores rootMargin against
// the viewport, so a page that owns its scroll container hands it to the
// trigger as the observer root. The properties under test are the ones the
// stall depended on: the root is the container when it is an ancestor, the
// viewport otherwise, the observer follows the container when it remounts,
// and the sentinel has a height of its own.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from '@testing-library/react'
import { useRef } from 'react'
import { LoadMoreTrigger } from './load-more-trigger'

type Callback = (entries: Partial<IntersectionObserverEntry>[]) => void

class FakeObserver {
  static instances: FakeObserver[] = []
  root: Element | Document | null
  rootMargin: string
  target: Element | null = null
  disconnected = false
  constructor(public callback: Callback, options?: IntersectionObserverInit) {
    this.root = options?.root ?? null
    this.rootMargin = options?.rootMargin ?? ''
    FakeObserver.instances.push(this)
  }
  observe(target: Element) {
    this.target = target
  }
  unobserve() {}
  disconnect() {
    this.disconnected = true
  }
  takeRecords() {
    return []
  }
}

const original = globalThis.IntersectionObserver

beforeEach(() => {
  FakeObserver.instances = []
  globalThis.IntersectionObserver = FakeObserver as unknown as typeof IntersectionObserver
})

afterEach(() => {
  globalThis.IntersectionObserver = original
})

/** The observer that is currently armed: the newest one not yet disconnected. */
function armed() {
  const live = FakeObserver.instances.filter((o) => !o.disconnected)
  expect(live).toHaveLength(1)
  return live[0]
}

/** A list whose scroll container is handed to the trigger as its root. The
 * key remounts the container, as a page does when it swaps between its
 * empty, loading and populated states. */
function List({ containerKey = 'a', onLoadMore = () => {}, isLoading = false }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  return (
    <div key={containerKey} ref={scrollRef} data-testid={`container-${containerKey}`}>
      <LoadMoreTrigger hasMore onLoadMore={onLoadMore} isLoading={isLoading} root={scrollRef} />
    </div>
  )
}

describe('LoadMoreTrigger', () => {
  it('observes against the scroll container when it is an ancestor', () => {
    const { getByTestId } = render(<List />)
    const observer = armed()
    expect(observer.root).toBe(getByTestId('container-a'))
    expect(observer.rootMargin).toBe('200px')
    expect(observer.target).toBe(getByTestId('container-a').firstElementChild)
  })

  it('falls back to the viewport when the element is not an ancestor', () => {
    const elsewhere = document.createElement('div')
    document.body.appendChild(elsewhere)
    render(<LoadMoreTrigger hasMore onLoadMore={() => {}} root={{ current: elsewhere }} />)
    expect(armed().root).toBeNull()
    elsewhere.remove()
  })

  it('uses the viewport when no container is given', () => {
    render(<LoadMoreTrigger hasMore onLoadMore={() => {}} />)
    expect(armed().root).toBeNull()
  })

  it('re-arms on the new container when the list remounts', () => {
    const { rerender, getByTestId } = render(<List containerKey="a" />)
    const first = armed()
    rerender(<List containerKey="b" />)
    const second = armed()
    expect(first.disconnected).toBe(true)
    expect(second.root).toBe(getByTestId('container-b'))
    expect(second.root).not.toBe(first.root)
  })

  it('gives the sentinel a height of its own', () => {
    const { container } = render(<LoadMoreTrigger hasMore onLoadMore={() => {}} />)
    expect(container.firstElementChild?.className).toContain('min-h-')
  })

  it('loads on intersection and not while a page is in flight', () => {
    const onLoadMore = vi.fn()
    const { rerender } = render(<List onLoadMore={onLoadMore} />)
    armed().callback([{ isIntersecting: true }])
    expect(onLoadMore).toHaveBeenCalledTimes(1)
    rerender(<List onLoadMore={onLoadMore} isLoading />)
    armed().callback([{ isIntersecting: true }])
    expect(onLoadMore).toHaveBeenCalledTimes(1)
  })

  it('renders nothing and observes nothing when there are no more pages', () => {
    const { container } = render(<LoadMoreTrigger hasMore={false} onLoadMore={() => {}} />)
    expect(container.firstElementChild).toBeNull()
    expect(FakeObserver.instances).toHaveLength(0)
  })
})
