// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// The wheel over a view that pages rather than scrolls: the month grid and
// the mini month; the multiweek grid scrolls, by Scroll below. A mouse wheel
// sends one event per notch, each a step's worth on its own. A trackpad sends
// a stream of small deltas that ramp up under the fingers and then decay for
// as long as the flick's inertia lasts: one flick has to mean one step, but
// fingers that keep pushing, a long drag or a new swipe before the last one's
// glide has died away, have to keep stepping.

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

/** The share of a week the weeks move past before the range steps on. */
const CROSS = 0.6
/** Milliseconds in which an animated move covers most of the way left. */
const EASE = 60

/**
 * The wheel over a grid that scrolls through its weeks by the pixel rather
 * than paging, as the multiweek grid does. A trackpad's deltas, its glide
 * included, move the weeks as far as the fingers do; a mouse wheel's notches
 * each move them a week, animated; and once the movement stops they settle,
 * animated, on the nearest week. The offset is measured from the week the
 * range starts on, later weeks positive. Once the weeks have moved most of a
 * week past it the range should step on, and when it has, `shift` measures
 * the offset from its new first week, so the weeks stay where they are drawn.
 */
export class Scroll {
  /** Pixels the weeks have moved past the range's first week. */
  offset = 0
  /** Where an animated move is heading. */
  private target = 0
  private direction = 0
  private notches = true
  private time = -Infinity

  /**
   * Takes a wheel event, given a week's height in pixels: true when it
   * starts or extends an animated move, false when it moved the weeks itself.
   */
  input(event: WheelInput, height: number): boolean {
    const delta = pixels(event)
    if (delta === 0) return false
    const direction = Math.sign(delta)
    if (event.timeStamp - this.time > GAP || direction !== this.direction) {
      this.direction = direction
      this.notches = true
    }
    this.time = event.timeStamp
    this.notches = this.notches && Math.abs(delta) >= THRESHOLD
    if (this.notches) {
      this.target =
        Math.round(this.target / height) * height + direction * height
      return true
    }
    this.offset += delta
    this.target = this.offset
    return false
  }

  /** Whether a movement is under way at `now`: a wheel event within the gap. */
  active(now: number): boolean {
    return now - this.time <= GAP
  }

  /**
   * Heads for the nearest week once the wheel has stopped: the week the
   * fingers left the weeks nearest, or the one notches are already heading
   * for.
   */
  settle(height: number) {
    this.target = Math.round(this.target / height) * height
  }

  /**
   * Moves an animated move on by `elapsed` milliseconds: true while it has
   * further to go.
   */
  frame(elapsed: number): boolean {
    const left = this.target - this.offset
    if (Math.abs(left) < 0.5) {
      this.offset = this.target
      return false
    }
    this.offset += left * (1 - Math.exp(-Math.max(0, elapsed) / EASE))
    return true
  }

  /**
   * The weeks the range should step by, given a week's height: none until
   * the weeks have moved most of a week past its first.
   */
  weeks(height: number): number {
    if (Math.abs(this.offset) < height * CROSS) return 0
    return Math.round(this.offset / height)
  }

  /** The range has stepped by `weeks`: the offset is now from its new first week. */
  shift(weeks: number, height: number) {
    this.offset -= weeks * height
    this.target -= weeks * height
  }

  /** Back on the range's first week, as after a jump made elsewhere. */
  reset() {
    this.offset = 0
    this.target = 0
  }
}
