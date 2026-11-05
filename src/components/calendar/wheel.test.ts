// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest'
import { Scroll, Wheel } from './wheel'

const at = (timeStamp: number, deltaY: number, deltaMode = 0) => ({
  deltaY,
  deltaMode,
  timeStamp,
})

/** The steps a stream of deltas makes, one event per frame from `start`. */
function stream(wheel: Wheel, start: number, deltas: number[]): number[] {
  return deltas.map((delta, index) => wheel.step(at(start + index * 16, delta)))
}

/** A flick's tail: deltas decaying a twentieth a frame, a second and more. */
function tail(peak: number): number[] {
  const deltas: number[] = []
  for (let delta = peak; delta >= 1; delta = Math.floor(delta * 0.95)) {
    deltas.push(delta)
  }
  return deltas
}

describe('Wheel', () => {
  it('steps at once on a mouse notch, either way', () => {
    expect(new Wheel().step(at(0, 100))).toBe(1)
    expect(new Wheel().step(at(0, -100))).toBe(-1)
  })

  it('steps once per cooldown while notches roll quickly', () => {
    const wheel = new Wheel()
    expect(
      [0, 60, 120, 180, 240].map((time) => wheel.step(at(time, 100)))
    ).toEqual([1, 0, 0, 0, 1])
  })

  it('steps on every notch rolled slowly', () => {
    const wheel = new Wheel()
    expect([0, 500, 1000].map((time) => wheel.step(at(time, 100)))).toEqual([
      1, 1, 1,
    ])
  })

  it('steps once on a flick, on its ramp, and never on its tail', () => {
    const wheel = new Wheel()
    expect(stream(wheel, 0, [2, 5, 12, 25])).toEqual([0, 0, 0, 1])
    const rest = stream(wheel, 64, tail(40))
    // The tail runs well past the cooldown, so nothing but the guard holds it.
    expect(rest.length * 16).toBeGreaterThan(400)
    expect(rest.every((step) => step === 0)).toBe(true)
  })

  it('steps once on a slow drag when its deltas reach the threshold, then no more', () => {
    const wheel = new Wheel()
    const steps = stream(wheel, 0, Array(30).fill(3))
    expect(steps.indexOf(1)).toBe(13)
    expect(steps.filter((step) => step !== 0)).toEqual([1])
  })

  it('keeps stepping, a stride at a time, while the fingers keep moving', () => {
    const wheel = new Wheel()
    const steps = stream(wheel, 0, Array(100).fill(10))
    // The threshold at the fourth frame, then every 150 pixels: fifteen frames.
    expect(steps.flatMap((step, index) => (step ? [index] : []))).toEqual([
      3, 18, 33, 48, 63, 78, 93,
    ])
    expect(steps.every((step) => step >= 0)).toBe(true)
  })

  it("steps on each new swipe, though the last one's glide has not died away", () => {
    const wheel = new Wheel()
    const swipe = [2, 5, 12, 25, ...tail(40).slice(0, 20)]
    // No gap between the swipes: the glide still runs when the next begins,
    // and the last one's runs on to its end.
    const steps = stream(wheel, 0, [
      ...swipe,
      ...swipe,
      ...swipe,
      ...tail(40).slice(20),
    ])
    expect(steps.filter((step) => step !== 0)).toEqual([1, 1, 1])
  })

  it('steps nothing on a drag that stays under the threshold', () => {
    const wheel = new Wheel()
    expect(
      stream(wheel, 0, Array(10).fill(3)).every((step) => step === 0)
    ).toBe(true)
  })

  it('steps again on a new push after a gap', () => {
    const wheel = new Wheel()
    const flick = [2, 5, 12, 25, ...tail(40)]
    stream(wheel, 0, flick)
    const later = (flick.length - 1) * 16 + 150
    expect(stream(wheel, later, [3, 8, 15, 20])).toEqual([0, 0, 0, 1])
  })

  it('starts a new gesture when the direction turns', () => {
    const wheel = new Wheel()
    expect(stream(wheel, 0, [20, -30, -15])).toEqual([0, 0, -1])
  })

  it('reads lines and pages as pixels', () => {
    expect(new Wheel().step(at(0, 3, 1))).toBe(1)
    expect(new Wheel().step(at(0, -1, 2))).toBe(-1)
  })

  it('ignores a zero delta without ending the gesture', () => {
    const wheel = new Wheel()
    expect(stream(wheel, 0, [20, 0, 25])).toEqual([0, 0, 1])
  })
})

describe('Scroll', () => {
  // A week 150 pixels tall.
  const HEIGHT = 150

  /** Feeds deltas a frame apart from `start`; true where one started an animated move. */
  const feed = (scroll: Scroll, start: number, deltas: number[]) =>
    deltas.map((delta, index) =>
      scroll.input(at(start + index * 16, delta), HEIGHT)
    )

  /** Runs an animated move to its end, a frame at a time, stepping as it goes. */
  function animate(scroll: Scroll): number[] {
    const steps: number[] = []
    for (let frame = 0; frame < 200 && scroll.frame(16); frame++) {
      const weeks = scroll.weeks(HEIGHT)
      if (weeks) {
        steps.push(weeks)
        scroll.shift(weeks, HEIGHT)
      }
    }
    return steps
  }

  it("moves the weeks as far as a trackpad's deltas, either way", () => {
    const scroll = new Scroll()
    expect(feed(scroll, 0, [4, 12, 20, 9])).toEqual([
      false,
      false,
      false,
      false,
    ])
    expect(scroll.offset).toBe(45)
    feed(scroll, 1000, [-30, -30])
    expect(scroll.offset).toBe(-15)
  })

  it('steps once the weeks have moved most of a week, and not before', () => {
    const scroll = new Scroll()
    feed(scroll, 0, [10, 30, 40])
    expect(scroll.weeks(HEIGHT)).toBe(0)
    feed(scroll, 48, [10])
    expect(scroll.weeks(HEIGHT)).toBe(1)
    scroll.shift(1, HEIGHT)
    // Measured from the next week, where the weeks still are.
    expect(scroll.offset).toBe(-60)
    expect(scroll.weeks(HEIGHT)).toBe(0)
  })

  it('steps by as many weeks as a fast glide has passed', () => {
    const scroll = new Scroll()
    feed(scroll, 0, [20, 100, 120, 120])
    expect(scroll.weeks(HEIGHT)).toBe(2)
  })

  it('steps back once it has moved most of a week the other way', () => {
    const scroll = new Scroll()
    feed(scroll, 0, [-20, -30, -40])
    expect(scroll.weeks(HEIGHT)).toBe(-1)
  })

  it('moves a whole week, animated, for each mouse notch', () => {
    const scroll = new Scroll()
    expect(scroll.input(at(0, 100), HEIGHT)).toBe(true)
    expect(scroll.offset).toBe(0)
    expect(animate(scroll)).toEqual([1])
    expect(scroll.offset).toBe(0)
    // Two notches in quick succession, then back one.
    scroll.input(at(1000, 100), HEIGHT)
    scroll.input(at(1040, 100), HEIGHT)
    expect(animate(scroll)).toEqual([1, 1])
    scroll.input(at(2000, -100), HEIGHT)
    expect(animate(scroll)).toEqual([-1])
  })

  it('settles on the nearest week once the wheel stops', () => {
    const near = new Scroll()
    feed(near, 0, [20, 30, 20])
    near.settle(HEIGHT)
    expect(animate(near)).toEqual([])
    expect(near.offset).toBe(0)
    const far = new Scroll()
    feed(far, 0, [20, 30, 30])
    far.settle(HEIGHT)
    expect(animate(far)).toEqual([1])
    expect(far.offset).toBe(0)
  })

  it('keeps on to the week notches are heading for when it settles', () => {
    const scroll = new Scroll()
    scroll.input(at(0, 100), HEIGHT)
    scroll.input(at(30, 100), HEIGHT)
    scroll.frame(16)
    scroll.settle(HEIGHT)
    expect(animate(scroll)).toEqual([1, 1])
  })

  it('is under way only while wheel events keep coming', () => {
    const scroll = new Scroll()
    expect(scroll.active(0)).toBe(false)
    feed(scroll, 0, [10])
    expect(scroll.active(50)).toBe(true)
    expect(scroll.active(500)).toBe(false)
  })
})
