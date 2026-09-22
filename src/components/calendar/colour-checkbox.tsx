// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { cn } from '../../lib/utils'

export interface ColourCheckboxProps {
  /** The colour as #rrggbb. */
  colour: string
  /** Filled with a tick when shown, an outline when hidden. */
  checked: boolean
  className?: string
}

/**
 * A calendar's row marker: a rounded square in the calendar's colour, filled
 * with a tick while the calendar is shown and left as an outline while it is
 * hidden. The tick is drawn rather than written so it needs no font and no
 * translation, and `currentColor` is never used - the square carries the
 * calendar's own colour in both themes.
 */
export function ColourCheckbox({
  colour,
  checked,
  className,
}: ColourCheckboxProps) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex size-4 shrink-0 items-center justify-center rounded-[4px] border-2',
        // The sidebar's menu button hides its direct <span> children in the
        // icon-collapsed rail, which is how it hides a row's text label. This
        // marker is a <span> too, so without the override a collapsed rail
        // shows a row with nothing in it.
        'group-data-[collapsible=icon]:!inline-flex',
        className
      )}
      style={{
        borderColor: colour,
        backgroundColor: checked ? colour : 'transparent',
      }}
    >
      {checked && (
        <svg
          viewBox='0 0 16 16'
          className='size-3'
          fill='none'
          stroke='#ffffff'
          strokeWidth='3'
          strokeLinecap='round'
          strokeLinejoin='round'
        >
          <path d='M3.5 8.5 6.5 11.5 12.5 4.5' />
        </svg>
      )}
    </span>
  )
}

// The shared sidebar renders a nav item's icon as a bare <Icon />, so a row
// needs a component already carrying its colour and state. One component per
// pair, kept so a re-render does not remount the icon.
const bound = new Map<string, React.FC>()

/** The sidebar icon for a calendar of this colour in this state. */
export function colourCheckbox(colour: string, checked: boolean): React.FC {
  const key = `${colour}|${checked ? 'on' : 'off'}`
  let Icon = bound.get(key)
  if (!Icon) {
    Icon = function CalendarColourCheckbox() {
      return <ColourCheckbox colour={colour} checked={checked} />
    }
    bound.set(key, Icon)
  }
  return Icon
}
