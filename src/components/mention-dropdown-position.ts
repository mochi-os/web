// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

export type MentionDropdownRect = {
  top: number
  bottom: number
  left: number
  width: number
}

export type MentionDropdownPositionInput = {
  rect: MentionDropdownRect
  viewportWidth: number
  viewportHeight: number
  preferredMaxHeight?: number
  gap?: number
  margin?: number
}

export type MentionDropdownPosition = {
  placement: 'above' | 'below'
  top?: number
  bottom?: number
  left: number
  width: number
  maxHeight: number
}

function clamp(value: number, min: number, max: number): number {
  if (max < min) return min
  return Math.min(Math.max(value, min), max)
}

/**
 * Pure placement math for the MentionTextarea portal dropdown.
 * Chooses above vs below by available viewport space and clamps into margins.
 */
export function computeMentionDropdownPosition(
  input: MentionDropdownPositionInput
): MentionDropdownPosition {
  const preferredMaxHeight = input.preferredMaxHeight ?? 288
  const gap = input.gap ?? 4
  const margin = input.margin ?? 8
  const { rect, viewportWidth, viewportHeight } = input

  const availableAbove = Math.max(0, rect.top - margin - gap)
  const availableBelow = Math.max(0, viewportHeight - rect.bottom - margin - gap)

  const placement: 'above' | 'below' =
    availableBelow >= availableAbove ? 'below' : 'above'
  const availableOnSide = placement === 'below' ? availableBelow : availableAbove
  const maxHeight = Math.min(preferredMaxHeight, availableOnSide)

  const maxWidth = Math.max(0, viewportWidth - 2 * margin)
  const width = Math.min(Math.max(0, rect.width), maxWidth)
  const left = clamp(rect.left, margin, Math.max(margin, viewportWidth - margin - width))

  let top: number | undefined = undefined
  let bottom: number | undefined = undefined

  if (placement === 'below') {
    top = clamp(rect.bottom + gap, margin, Math.max(margin, viewportHeight - margin - maxHeight))
  } else {
    bottom = clamp(viewportHeight - rect.top + gap, margin, Math.max(margin, viewportHeight - margin - maxHeight))
  }

  return { placement, top, bottom, left, width, maxHeight }
}
