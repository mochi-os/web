// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// The property under test is that the slices always agree with the aggregate
// counter they were derived from: nothing is uploading before the files ahead
// of it are sent, and the last file lands on 1 exactly when the request does.

import { describe, it, expect } from 'vitest'
import { uploadSlices } from './upload-slices'

/** Sum of `sizes`, which is also the body size when there is no overhead. */
const sum = (sizes: number[]) => sizes.reduce((a, b) => a + b, 0)

const states = (slices: ReturnType<typeof uploadSlices>) =>
  slices?.map((slice) => slice.state)

describe('uploadSlices', () => {
  it('gives up when the body size is unknown', () => {
    expect(uploadSlices(500, null, [1000, 1000])).toBeNull()
  })

  it('gives up when there is nothing to slice', () => {
    expect(uploadSlices(500, 1000, [])).toBeNull()
    expect(uploadSlices(500, 1000, [0, 0])).toBeNull()
    expect(uploadSlices(500, 0, [1000])).toBeNull()
  })

  it('leaves every file waiting before the first byte', () => {
    const sizes = [1000, 2000, 3000]
    const slices = uploadSlices(0, sum(sizes), sizes)
    expect(states(slices)).toEqual(['uploading', 'waiting', 'waiting'])
    expect(slices![0].fraction).toBe(0)
  })

  it('reports the file straddling the counter and nothing after it', () => {
    const sizes = [1000, 2000, 3000]
    // 1000 sent whole, then half of the 2000.
    const slices = uploadSlices(2000, sum(sizes), sizes)
    expect(states(slices)).toEqual(['sent', 'uploading', 'waiting'])
    expect(slices![0].fraction).toBe(1)
    expect(slices![1].fraction).toBeCloseTo(0.5, 6)
    expect(slices![2].fraction).toBe(0)
  })

  // A counter landing exactly on a boundary must not show two files in flight.
  it('hands over cleanly on an exact boundary', () => {
    const sizes = [1000, 2000, 3000]
    const slices = uploadSlices(1000, sum(sizes), sizes)
    expect(states(slices)).toEqual(['sent', 'uploading', 'waiting'])
    expect(slices![1].fraction).toBe(0)
  })

  it('finishes the last file exactly when the request finishes', () => {
    const sizes = [1000, 2000, 3000]
    const slices = uploadSlices(sum(sizes), sum(sizes), sizes)
    expect(states(slices)).toEqual(['sent', 'sent', 'sent'])
    expect(slices!.every((slice) => slice.fraction === 1)).toBe(true)
  })

  it('handles a single file', () => {
    const slices = uploadSlices(250, 1000, [1000])
    expect(states(slices)).toEqual(['uploading'])
    expect(slices![0].fraction).toBeCloseTo(0.25, 6)
  })

  // The real body carries the text fields and a boundary preamble per part, so
  // `total` always exceeds the sum of the file sizes. Scaling absorbs it: the
  // last file still has to land on 1 at the end of the request, or a bar sits
  // short of full while the upload is demonstrably over.
  it('absorbs the multipart overhead', () => {
    const sizes = [1_000_000, 4_000_000]
    const overhead = 512
    const total = sum(sizes) + overhead

    const done = uploadSlices(total, total, sizes)
    expect(states(done)).toEqual(['sent', 'sent'])
    expect(done!.every((slice) => slice.fraction === 1)).toBe(true)

    // A quarter of the body is a quarter of the payload: the 1 MB file plus
    // 250 KB of the 4 MB one. Without the scaling the overhead would push this
    // short of the boundary and leave the first file reading 99.9%.
    const early = uploadSlices(Math.round(total * 0.25), total, sizes)
    expect(states(early)).toEqual(['sent', 'uploading'])
    expect(early![1].fraction).toBeCloseTo(0.0625, 4)
  })

  it('never reports past the end when the counter overshoots', () => {
    const sizes = [1000, 2000]
    const slices = uploadSlices(9999, sum(sizes), sizes)
    expect(states(slices)).toEqual(['sent', 'sent'])
    expect(slices!.every((slice) => slice.fraction === 1)).toBe(true)
  })

  // A zero-byte file has no bytes to wait for, so it cannot be the one in
  // flight; it is sent the moment the counter reaches it.
  it('passes straight over empty files', () => {
    const sizes = [1000, 0, 1000]
    const slices = uploadSlices(1000, sum(sizes), sizes)
    expect(states(slices)).toEqual(['sent', 'sent', 'uploading'])
  })

  // Properties that hold for every counter, over randomised shapes: a bar
  // sliding backwards, or two tiles filling at once. Seeded, so a failure
  // reproduces.
  describe('invariants', () => {
    function makeRandom(seed: number) {
      let state = seed
      return () => {
        state = (state * 1103515245 + 12345) % 2147483648
        return state / 2147483648
      }
    }

    it('holds across randomised uploads', () => {
      const random = makeRandom(20260810)

      for (let run = 0; run < 300; run++) {
        const count = 1 + Math.floor(random() * 8)
        const sizes = Array.from({ length: count }, () =>
          // A mix of ordinary files and the occasional empty one, which is the
          // shape that used to make the "which file is in flight" test fail.
          random() < 0.15 ? 0 : 1 + Math.floor(random() * 5_000_000)
        )
        const payload = sum(sizes)
        if (payload === 0) continue
        // Realistic framing: a boundary preamble per part plus the text fields.
        const total = payload + 180 * count + Math.floor(random() * 400)

        let previous: number[] = sizes.map(() => 0)
        const steps = 25

        for (let step = 0; step <= steps; step++) {
          const sent = Math.round((total * step) / steps)
          const slices = uploadSlices(sent, total, sizes)
          expect(slices).not.toBeNull()
          const list = slices!

          const seen = states(list)!
          const firstWaiting = seen.indexOf('waiting')
          const lastSent = seen.lastIndexOf('sent')

          list.forEach((slice, i) => {
            expect(slice.fraction).toBeGreaterThanOrEqual(0)
            expect(slice.fraction).toBeLessThanOrEqual(1)
            if (slice.state === 'sent') expect(slice.fraction).toBe(1)
            if (slice.state === 'waiting') expect(slice.fraction).toBe(0)
            // Never goes backwards as the counter climbs.
            expect(slice.fraction).toBeGreaterThanOrEqual(previous[i])
          })

          // At most one file is on the wire at a time.
          expect(seen.filter((s) => s === 'uploading').length).toBeLessThanOrEqual(1)
          // Ordered sent… uploading… waiting, with no interleaving.
          if (firstWaiting !== -1) expect(lastSent).toBeLessThan(firstWaiting)

          previous = list.map((slice) => slice.fraction)
        }

        // The request finishing has to leave every file finished, or a bar
        // sits short of full while the upload is demonstrably over.
        const done = uploadSlices(total, total, sizes)!
        expect(done.every((slice) => slice.state === 'sent')).toBe(true)
        expect(done.every((slice) => slice.fraction === 1)).toBe(true)
      }
    })
  })
})
