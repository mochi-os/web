// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// The wheel over a view that pages rather than scrolls: the month and
// multiweek grids and the mini month. A mouse wheel sends one event per notch,
// each a step's worth on its own. A trackpad sends a stream of small deltas
// that ramp up under the fingers and then decay for as long as the flick's
// inertia lasts: one flick has to mean one step, but fingers that keep
// pushing, a long drag or a new swipe before the last one's glide has died
// away, have to keep stepping.

/** Pixels of delta that make one step; a mouse notch is 100 in Chrome. */
const THRESHOLD = 40
/** Milliseconds after a step before the next may happen. */
const COOLDOWN = 200
/** Milliseconds without an event that end a gesture; inertia sends them every frame. */
const GAP = 100
/** Pixels the fingers travel, after a step within a gesture, for the next one. */
const STRIDE = 150
/**
 * Events back to compare with: fingers still pushing keep a delta at least
 * the given share of this far back, where inertia, only ever decaying, has
 * fallen well below it.
 */
const REACH = 8
const PUSH = 0.9

/** What a wheel event carries that matters here, on DOM and React events alike. */
export interface WheelInput {
  deltaY: number
  /** 0 for pixels, 1 for lines, 2 for pages. */
  deltaMode: number
  timeStamp: number
}

/** A delta in pixels whatever unit the event used. */
function pixels(event: WheelInput): number {
  switch (event.deltaMode) {
    case 1:
      return event.deltaY * 16
    case 2:
      return event.deltaY * 800
    default:
      return event.deltaY
  }
}

/**
 * Turns wheel events into single steps of one direction at a time. Events
 * without a gap between them are one gesture. A gesture of notches, every
 * event a threshold's worth, steps on each notch the cooldown allows, as a
 * mouse wheel does. Any other gesture steps when its deltas add up to the
 * threshold, and again for each stride after that while the fingers are still
 * pushing, but never on a glide's decaying tail.
 */
export class Wheel {
  private direction = 0
  private total = 0
  private notches = true
  private stepped = false
  private time = -Infinity
  private last = -Infinity
  private recent: number[] = []

  /** The step this event makes: 1 forward, -1 back, 0 none. */
  step(event: WheelInput): number {
    const delta = pixels(event)
    if (delta === 0) return 0
    const direction = Math.sign(delta)
    const now = event.timeStamp
    if (now - this.time > GAP || direction !== this.direction) {
      this.direction = direction
      this.total = 0
      this.notches = true
      this.stepped = false
      this.recent = []
    }
    this.time = now
    this.total += delta
    this.notches = this.notches && Math.abs(delta) >= THRESHOLD
    const before = this.recent.length >= REACH ? this.recent[0] : 0
    this.recent.push(Math.abs(delta))
    if (this.recent.length > REACH) this.recent.shift()
    if (now - this.last < COOLDOWN) return 0
    if (this.stepped && !this.notches) {
      const pushing = before > 0 && Math.abs(delta) >= before * PUSH
      if (!pushing || Math.abs(this.total) < STRIDE) return 0
    } else if (Math.abs(this.total) < THRESHOLD) return 0
    this.total = 0
    this.stepped = true
    this.last = now
    return direction
  }
}
