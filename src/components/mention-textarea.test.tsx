// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { useState } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent, screen } from '@testing-library/react'
import { highlightMentions, MentionTextarea } from './mention-textarea'

function parse(html: string): DocumentFragment {
  const template = document.createElement('template')
  template.innerHTML = html
  return template.content
}

describe('highlightMentions', () => {
  it('wraps a mention token found in text', () => {
    expect(highlightMentions('<p>hi @[Ann Lee] there</p>')).toBe(
      '<p>hi <span class="text-primary font-medium">@Ann Lee</span> there</p>'
    )
  })

  it('leaves a token inside an attribute alone', () => {
    // A sanitiser lets an href or title through; splicing a span into the
    // attribute value would corrupt the element.
    const fragment = parse(highlightMentions('<a href="/search?q=@[x]" title="@[y]">link @[z]</a>'))
    const anchor = fragment.querySelector('a')!
    expect(anchor.getAttribute('href')).toBe('/search?q=@[x]')
    expect(anchor.getAttribute('title')).toBe('@[y]')
    expect(anchor.querySelectorAll('span')).toHaveLength(1)
    expect(anchor.querySelector('span')!.textContent).toBe('@z')
  })

  it('keeps the text around the token escaped', () => {
    expect(highlightMentions('a &lt;b&gt; @[c]')).toBe(
      'a &lt;b&gt; <span class="text-primary font-medium">@c</span>'
    )
  })
})

const people = [{ id: 'p1', name: 'Alice' }]

function Harness({ onKeyDown }: { onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void }) {
  const [value, setValue] = useState('')
  return <MentionTextarea value={value} onValueChange={setValue} people={people} onKeyDown={onKeyDown} />
}

describe('MentionTextarea Enter handling while the dropdown is open', () => {
  function open() {
    const onKeyDown = vi.fn()
    render(<Harness onKeyDown={onKeyDown} />)
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: '@Al' } })
    return { textarea, onKeyDown }
  }

  it('claims a bare Enter for the mention', () => {
    const { textarea, onKeyDown } = open()
    fireEvent.keyDown(textarea, { key: 'Enter' })
    expect(onKeyDown).not.toHaveBeenCalled()
    expect(textarea.value).toBe('@[Alice] ')
  })

  it('passes Ctrl+Enter and Cmd+Enter through to the composer', () => {
    const { textarea, onKeyDown } = open()
    fireEvent.keyDown(textarea, { key: 'Enter', ctrlKey: true })
    fireEvent.keyDown(textarea, { key: 'Enter', metaKey: true })
    expect(onKeyDown).toHaveBeenCalledTimes(2)
    expect(textarea.value).toBe('@Al')
  })
})
