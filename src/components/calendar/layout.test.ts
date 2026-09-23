// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest'
import {
  addDays,
  addMonths,
  barRows,
  coveredDays,
  dayList,
  dayOfWeek,
  daysBetween,
  overlapColumns,
  rangeTitle,
  snap,
  startOfMonth,
  startOfWeek,
  stepDate,
  viewRange,
  weekNumber,
  weekRows,
  yearOf,
  monthsBetween,
  type RangeOptions,
} from './layout'

const options: RangeOptions = {
  weekStartsOn: 1,
  weeks: 4,
  previous: 0,
}

describe('day arithmetic', () => {
  it('adds and subtracts days across a month and a year boundary', () => {
    expect(addDays('2026-09-16', 1)).toBe('2026-09-17')
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01')
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29')
  })

  it('crosses a daylight-saving change without losing a day', () => {
    // 2026-03-29 is the European spring change; civil days are unaffected.
    expect(addDays('2026-03-28', 1)).toBe('2026-03-29')
    expect(addDays('2026-03-29', 1)).toBe('2026-03-30')
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2)
  })

  it('clamps a month step onto a shorter month', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonths('2026-03-31', -1)).toBe('2026-02-28')
    expect(addMonths('2026-12-15', 1)).toBe('2027-01-15')
    expect(addMonths('2024-01-31', 1)).toBe('2024-02-29')
  })

  it('reads the weekday and the start of the week', () => {
    expect(dayOfWeek('2026-09-16')).toBe(3)
    expect(startOfWeek('2026-09-16', 1)).toBe('2026-09-14')
    expect(startOfWeek('2026-09-16', 0)).toBe('2026-09-13')
    expect(startOfWeek('2026-09-13', 0)).toBe('2026-09-13')
    expect(startOfMonth('2026-09-16')).toBe('2026-09-01')
  })

  it('numbers weeks the ISO way whatever the week start', () => {
    expect(weekNumber('2026-01-01')).toBe(1)
    expect(weekNumber('2026-09-16')).toBe(38)
    // 2027-01-01 is a Friday, so it belongs to the last week of 2026.
    expect(weekNumber('2027-01-01')).toBe(53)
  })

  it('splits a run of days into rows of seven', () => {
    expect(dayList('2026-09-14', 3)).toEqual([
      '2026-09-14',
      '2026-09-15',
      '2026-09-16',
    ])
    const rows = weekRows('2026-09-14', 14)
    expect(rows).toHaveLength(2)
    expect(rows[0][0]).toBe('2026-09-14')
    expect(rows[1][6]).toBe('2026-09-27')
  })
})

describe('viewRange', () => {
  it('shows one day in the day view', () => {
    expect(viewRange('day', '2026-09-16', options)).toEqual({
      from: '2026-09-16',
      days: 1,
      date: '2026-09-16',
    })
  })

  it('starts the week at the locale week start', () => {
    expect(viewRange('week', '2026-09-16', options).from).toBe('2026-09-14')
    expect(
      viewRange('week', '2026-09-16', { ...options, weekStartsOn: 0 }).from
    ).toBe('2026-09-13')
  })

  it('rolls the multiweek span back by the previous weeks', () => {
    const range = viewRange('multiweek', '2026-09-16', {
      ...options,
      weeks: 4,
      previous: 2,
    })
    expect(range.from).toBe('2026-08-31')
    expect(range.days).toBe(28)
  })

  it('always shows six rows in the month view', () => {
    const range = viewRange('month', '2026-09-16', options)
    expect(range.from).toBe('2026-08-31')
    expect(range.days).toBe(42)
  })

  it('anchors the list view on its day', () => {
    expect(viewRange('list', '2026-09-16', options)).toEqual({
      from: '2026-09-16',
      days: 1,
      date: '2026-09-16',
    })
  })
})

describe('stepDate', () => {
  it('steps by the view unit', () => {
    expect(stepDate('day', '2026-09-16', 1)).toBe('2026-09-17')
    expect(stepDate('week', '2026-09-16', -1)).toBe('2026-09-09')
    expect(stepDate('month', '2026-09-16', 1)).toBe('2026-10-01')
    expect(stepDate('month', '2026-01-15', -1)).toBe('2025-12-01')
    expect(stepDate('list', '2026-09-16', 1)).toBe('2026-10-01')
  })

  it('slides the multiweek span one week at a time, not its length', () => {
    expect(stepDate('multiweek', '2026-09-16', 1)).toBe('2026-09-23')
    expect(stepDate('multiweek', '2026-09-16', -1)).toBe('2026-09-09')
  })
})

describe('rangeTitle', () => {
  const format = {
    longDate: (day: string) => `long:${day}`,
    monthYear: (day: string) => `month:${day}`,
    dayRange: (from: string, to: string) => `range:${from}..${to}`,
  }

  it('names a single day, a span and a month', () => {
    expect(
      rangeTitle('day', viewRange('day', '2026-09-16', options), format)
    ).toBe('long:2026-09-16')
    expect(
      rangeTitle('week', viewRange('week', '2026-09-16', options), format)
    ).toBe('range:2026-09-14..2026-09-20')
    expect(
      rangeTitle(
        'multiweek',
        viewRange('multiweek', '2026-09-16', options),
        format
      )
    ).toBe('range:2026-09-14..2026-10-11')
    expect(
      rangeTitle('month', viewRange('month', '2026-09-16', options), format)
    ).toBe('month:2026-09-16')
  })
})

describe('overlapColumns', () => {
  it('gives a lone block the whole width', () => {
    expect(overlapColumns([{ start: 540, finish: 600 }])).toEqual([
      { column: 0, columns: 1 },
    ])
  })

  it('splits two overlapping blocks side by side', () => {
    expect(
      overlapColumns([
        { start: 540, finish: 660 },
        { start: 600, finish: 720 },
      ])
    ).toEqual([
      { column: 0, columns: 2 },
      { column: 1, columns: 2 },
    ])
  })

  it('does not treat blocks that meet end to end as overlapping', () => {
    expect(
      overlapColumns([
        { start: 540, finish: 600 },
        { start: 600, finish: 660 },
      ])
    ).toEqual([
      { column: 0, columns: 1 },
      { column: 0, columns: 1 },
    ])
  })

  it('reuses a freed column within one cluster', () => {
    // A long block beside two that follow each other: three blocks, two columns.
    const placements = overlapColumns([
      { start: 540, finish: 780 },
      { start: 560, finish: 620 },
      { start: 640, finish: 700 },
    ])
    expect(placements.map((p) => p.columns)).toEqual([2, 2, 2])
    expect(placements[0].column).toBe(0)
    expect(placements[1].column).toBe(1)
    expect(placements[2].column).toBe(1)
  })

  it('keeps separate clusters at their own widths', () => {
    const placements = overlapColumns([
      { start: 0, finish: 60 },
      { start: 30, finish: 90 },
      { start: 600, finish: 660 },
    ])
    expect(placements.map((p) => p.columns)).toEqual([2, 2, 1])
  })

  it('answers in the order the spans were given', () => {
    const placements = overlapColumns([
      { start: 600, finish: 720 },
      { start: 540, finish: 660 },
    ])
    expect(placements[1].column).toBe(0)
    expect(placements[0].column).toBe(1)
  })

  it('still places a block of no length', () => {
    const placements = overlapColumns([
      { start: 540, finish: 540 },
      { start: 540, finish: 600 },
    ])
    expect(placements.map((p) => p.columns)).toEqual([2, 2])
  })
})

describe('barRows', () => {
  const week = dayList('2026-09-14', 7)

  it('places a bar at its column with its span', () => {
    expect(
      barRows(week, [{ key: 'a', start: '2026-09-15', finish: '2026-09-17' }])
    ).toEqual([
      { key: 'a', column: 1, span: 3, row: 0, before: false, after: false },
    ])
  })

  it('clips a bar to the week and marks the sides it runs past', () => {
    expect(
      barRows(week, [{ key: 'a', start: '2026-09-10', finish: '2026-09-23' }])
    ).toEqual([
      { key: 'a', column: 0, span: 7, row: 0, before: true, after: true },
    ])
  })

  it('stacks overlapping bars and reuses a row where they do not overlap', () => {
    const placements = barRows(week, [
      { key: 'long', start: '2026-09-14', finish: '2026-09-18' },
      { key: 'early', start: '2026-09-14', finish: '2026-09-15' },
      { key: 'late', start: '2026-09-19', finish: '2026-09-20' },
    ])
    const rows = Object.fromEntries(placements.map((p) => [p.key, p.row]))
    expect(rows.long).toBe(0)
    expect(rows.early).toBe(1)
    // "late" starts after "long" ends, so it fits on the top row.
    expect(rows.late).toBe(0)
  })

  it('drops a bar that falls outside the week', () => {
    expect(
      barRows(week, [
        { key: 'a', start: '2026-09-01', finish: '2026-09-05' },
        { key: 'b', start: '2026-09-28', finish: '2026-09-29' },
      ])
    ).toEqual([])
  })

  it('answers nothing for an empty week', () => {
    expect(barRows([], [{ key: 'a', start: '1', finish: '2' }])).toEqual([])
  })
})

describe('snap', () => {
  it('rounds to the nearest step and never goes below zero', () => {
    expect(snap(547, 15)).toBe(540)
    expect(snap(548, 15)).toBe(555)
    expect(snap(-20, 15)).toBe(0)
    expect(snap(547, 0)).toBe(547)
  })
})

describe('yearOf and monthsBetween', () => {
  it('reads the year from a civil day', () => {
    expect(yearOf('2026-09-22')).toBe(2026)
    expect(yearOf('1999-01-01')).toBe(1999)
  })

  it('counts months across a year boundary, either way', () => {
    expect(monthsBetween('2026-09-22', '2026-09-01')).toBe(0)
    expect(monthsBetween('2026-09-22', '2026-12-05')).toBe(3)
    expect(monthsBetween('2026-11-30', '2027-01-01')).toBe(2)
    expect(monthsBetween('2027-01-01', '2026-11-30')).toBe(-2)
    expect(monthsBetween('2026-09-22', '2024-09-22')).toBe(-24)
  })
})

describe('coveredDays', () => {
  // A zone nine hours ahead of the instants, as a Tokyo browser reads a server
  // that expanded in UTC.
  const ahead = (date: Date) =>
    new Date(date.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10)
  const utc = (date: Date) => date.toISOString().slice(0, 10)
  const midnight = Date.UTC(2026, 8, 22) / 1000

  it('places an all-day occurrence by its date whatever the zone', () => {
    const one = {
      allday: true,
      date: '2026-09-22',
      start: midnight,
      finish: midnight + 86400,
    }
    expect(coveredDays(one, ahead)).toEqual({
      start: '2026-09-22',
      finish: '2026-09-22',
    })
    expect(
      coveredDays({ ...one, finish: midnight + 2 * 86400 }, ahead)
    ).toEqual({ start: '2026-09-22', finish: '2026-09-23' })
  })

  it('places a timed occurrence by the days its instants fall on', () => {
    const evening = {
      allday: false,
      start: midnight + 20 * 3600,
      finish: midnight + 22 * 3600,
    }
    expect(coveredDays(evening, utc)).toEqual({
      start: '2026-09-22',
      finish: '2026-09-22',
    })
    expect(coveredDays(evening, ahead)).toEqual({
      start: '2026-09-23',
      finish: '2026-09-23',
    })
    // A finish on the stroke of midnight belongs to the day before.
    expect(
      coveredDays(
        { allday: false, start: midnight, finish: midnight + 86400 },
        utc
      )
    ).toEqual({ start: '2026-09-22', finish: '2026-09-22' })
  })
})
