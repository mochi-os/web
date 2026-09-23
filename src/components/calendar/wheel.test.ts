// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest'
import { Wheel } from './wheel'

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
    expect([0, 60, 120, 180, 240].map((time) => wheel.step(at(time, 100)))).toEqual([
      1, 0, 0, 0, 1,
    ])
  })

  it('steps on every notch rolled slowly', () => {
    const wheel = new Wheel()
    expect([0, 500, 1000].map((time) => wheel.step(at(time, 100)))).toEqual([1, 1, 1])
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

  it('steps nothing on a drag that stays under the threshold', () => {
    const wheel = new Wheel()
    expect(stream(wheel, 0, Array(10).fill(3)).every((step) => step === 0)).toBe(true)
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
