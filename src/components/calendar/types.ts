// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

/** One occurrence as every calendar view draws it. */
export interface CalendarEvent {
  /** Identifies the occurrence to the caller; unique within a range. */
  key: string
  title: string
  location?: string
  /** Shown, shortened, in the hover text. */
  description?: string
  /** The calendar's colour, as #rrggbb. */
  colour: string
  /** Unix seconds. */
  start: number
  /** Unix seconds; an all-day occurrence finishes at the end of its last day. */
  finish: number
  allday: boolean
  /** A read-only calendar's occurrence cannot be dragged or resized. */
  readonly?: boolean
  recurring?: boolean
  /** True when the occurrence overrides its series. */
  exception?: boolean
}

/** Where a drag left an occurrence, in unix seconds. */
export interface EventMove {
  key: string
  start: number
  finish: number
}
