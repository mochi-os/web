// Mochi: renders a message body written in the lib/text-format subset
// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { Fragment, useMemo, type ReactNode } from 'react'
import { cn } from '../lib/utils'
import {
  parseFormattedText,
  type FormattedBlock,
  type FormattedInline,
} from '../lib/text-format'

export interface FormattedTextRenderOptions {
  /** True for the text of inline code and code blocks. */
  code: boolean
}

export interface FormattedTextProps {
  text: string
  /**
   * Renders each run of plain text, for mention tokens or search
   * highlighting. A mention token always arrives whole in one run. Defaults
   * to the text itself.
   */
  renderText?: (text: string, options: FormattedTextRenderOptions) => ReactNode
  /** For text on a primary-coloured surface, such as a sent chat bubble. */
  inverted?: boolean
  className?: string
}

interface Tone {
  code: string
  quote: string
  link: string
}

// Quoted text keeps the body's full colour: dimmed, it blended into a
// coloured bubble. On the primary colour, code sits in a clearly darker box,
// as a light tint vanished into a saturated blue.
const TONES: Record<'default' | 'inverted', Tone> = {
  default: {
    code: 'bg-foreground/10',
    quote: 'border-foreground/30',
    link: 'text-primary',
  },
  inverted: {
    code: 'bg-black/30',
    quote: 'border-primary-foreground/60',
    link: 'text-primary-foreground',
  },
}

const plain = (text: string) => text

/**
 * A message body with its formatting, as React elements. Nothing is parsed
 * as HTML, and only http, https and mailto links become anchors.
 */
export function FormattedText({
  text,
  renderText = plain,
  inverted = false,
  className,
}: FormattedTextProps) {
  const blocks = useMemo(() => parseFormattedText(text), [text])
  const tone = TONES[inverted ? 'inverted' : 'default']
  return (
    <div className={cn('min-w-0 space-y-1 break-words', className)}>
      {renderBlocks(blocks, tone, renderText)}
    </div>
  )
}

type RenderText = NonNullable<FormattedTextProps['renderText']>

function renderBlocks(
  blocks: FormattedBlock[],
  tone: Tone,
  renderText: RenderText
): ReactNode[] {
  return blocks.map((block, index) => {
    switch (block.type) {
      case 'paragraph':
        return (
          <p key={index} className='whitespace-pre-wrap'>
            {renderInline(block.children, tone, renderText)}
          </p>
        )
      case 'code':
        return (
          <pre
            key={index}
            className={cn(
              'overflow-x-auto rounded-md px-2 py-1.5 font-mono text-xs leading-relaxed whitespace-pre',
              tone.code
            )}
          >
            <code>{renderText(block.text, { code: true })}</code>
          </pre>
        )
      case 'quote':
        return (
          <blockquote
            key={index}
            className={cn('space-y-1 border-s-2 ps-2.5', tone.quote)}
          >
            {renderBlocks(block.children, tone, renderText)}
          </blockquote>
        )
      case 'list': {
        const items = block.items.map((item, itemIndex) => (
          <li key={itemIndex} className='whitespace-pre-wrap'>
            {renderInline(item, tone, renderText)}
          </li>
        ))
        return block.ordered ? (
          <ol
            key={index}
            start={block.start}
            className='list-decimal space-y-0.5 ps-5'
          >
            {items}
          </ol>
        ) : (
          <ul key={index} className='list-disc space-y-0.5 ps-5'>
            {items}
          </ul>
        )
      }
    }
  })
}

function renderInline(
  nodes: FormattedInline[],
  tone: Tone,
  renderText: RenderText
): ReactNode[] {
  return nodes.map((node, index) => {
    switch (node.type) {
      case 'text':
        return (
          <Fragment key={index}>
            {renderText(node.text, { code: false })}
          </Fragment>
        )
      case 'code':
        return (
          <code
            key={index}
            className={cn(
              'rounded px-1 py-0.5 font-mono text-[0.85em]',
              tone.code
            )}
          >
            {renderText(node.text, { code: true })}
          </code>
        )
      case 'strong':
        return (
          // Full bold: semibold was too close to normal text at message size.
          <strong key={index} className='font-bold'>
            {renderInline(node.children, tone, renderText)}
          </strong>
        )
      case 'emphasis':
        return (
          <em key={index} className='italic'>
            {renderInline(node.children, tone, renderText)}
          </em>
        )
      case 'strike':
        return (
          <s key={index} className='line-through'>
            {renderInline(node.children, tone, renderText)}
          </s>
        )
      case 'link':
        return (
          <a
            key={index}
            href={node.href}
            target='_blank'
            rel='noopener noreferrer'
            // A message bubble often handles clicks itself.
            onClick={(event) => event.stopPropagation()}
            className={cn(
              'font-medium underline underline-offset-2',
              tone.link
            )}
          >
            {renderInline(node.children, tone, renderText)}
          </a>
        )
    }
  })
}
