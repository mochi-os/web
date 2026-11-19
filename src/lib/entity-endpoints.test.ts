// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// crm and projects each tested this table through their own binding, 38
// identical assertions apiece, while the table itself lived here untested.
// The routes are asserted once, against the shared table. Each app keeps only
// the endpoints it adds on top.

import { describe, it, expect } from 'vitest'
import {
  entityAddress,
  entityAssets,
  entityEndpoints,
} from './entity-endpoints'

describe('entityEndpoints', () => {
  describe('class-level endpoints (static strings)', () => {
    it('should have list endpoint', () => {
      expect(entityEndpoints.list).toBe('-/list')
    })
    it('should have create endpoint', () => {
      expect(entityEndpoints.create).toBe('-/create')
    })
  })
  describe('container-level endpoints', () => {
    it('should generate info endpoint with container ID', () => {
      expect(entityEndpoints.information('abc123')).toBe('abc123/-/information')
    })
    it('should generate update endpoint with container ID', () => {
      expect(entityEndpoints.update('abc123')).toBe('abc123/-/update')
    })
    it('should generate delete endpoint with container ID', () => {
      expect(entityEndpoints.delete('abc123')).toBe('abc123/-/delete')
    })
  })
  describe('object endpoints', () => {
    it('should generate objects list endpoint', () => {
      expect(entityEndpoints.objects('proj1')).toBe('proj1/-/objects')
    })
    it('should generate object create endpoint', () => {
      expect(entityEndpoints.objectCreate('proj1')).toBe(
        'proj1/-/objects/create'
      )
    })
    it('should generate object get endpoint', () => {
      expect(entityEndpoints.object('proj1', 'obj1')).toBe(
        'proj1/-/objects/obj1'
      )
    })
    it('should generate object update endpoint', () => {
      expect(entityEndpoints.objectUpdate('proj1', 'obj1')).toBe(
        'proj1/-/objects/obj1/update'
      )
    })
    it('should generate object delete endpoint', () => {
      expect(entityEndpoints.objectDelete('proj1', 'obj1')).toBe(
        'proj1/-/objects/obj1/delete'
      )
    })
    it('should generate object move endpoint', () => {
      expect(entityEndpoints.objectMove('proj1', 'obj1')).toBe(
        'proj1/-/objects/obj1/move'
      )
    })
  })
  describe('value endpoints', () => {
    it('should generate values set endpoint', () => {
      expect(entityEndpoints.valuesSet('proj1', 'obj1')).toBe(
        'proj1/-/objects/obj1/values'
      )
    })
    it('should generate single value set endpoint', () => {
      expect(entityEndpoints.valueSet('proj1', 'obj1', 'status')).toBe(
        'proj1/-/objects/obj1/values/status'
      )
    })
  })
  describe('view endpoints', () => {
    it('should generate views list endpoint', () => {
      expect(entityEndpoints.views('proj1')).toBe('proj1/-/views')
    })
    it('should generate view create endpoint', () => {
      expect(entityEndpoints.viewCreate('proj1')).toBe('proj1/-/views/create')
    })
    it('should generate view update endpoint', () => {
      expect(entityEndpoints.viewUpdate('proj1', 'view1')).toBe(
        'proj1/-/views/view1/update'
      )
    })
    it('should generate view delete endpoint', () => {
      expect(entityEndpoints.viewDelete('proj1', 'view1')).toBe(
        'proj1/-/views/view1/delete'
      )
    })
  })
  describe('class endpoints', () => {
    it('should generate classes list endpoint', () => {
      expect(entityEndpoints.classes('proj1')).toBe('proj1/-/classes')
    })
    it('should generate class create endpoint', () => {
      expect(entityEndpoints.classCreate('proj1')).toBe(
        'proj1/-/classes/create'
      )
    })
    it('should generate class update endpoint', () => {
      expect(entityEndpoints.classUpdate('proj1', 'task')).toBe(
        'proj1/-/classes/task/update'
      )
    })
    it('should generate class delete endpoint', () => {
      expect(entityEndpoints.classDelete('proj1', 'task')).toBe(
        'proj1/-/classes/task/delete'
      )
    })
  })
  describe('field endpoints', () => {
    it('should generate fields list endpoint', () => {
      expect(entityEndpoints.fields('proj1', 'task')).toBe(
        'proj1/-/classes/task/fields'
      )
    })
    it('should generate field create endpoint', () => {
      expect(entityEndpoints.fieldCreate('proj1', 'task')).toBe(
        'proj1/-/classes/task/fields/create'
      )
    })
    it('should generate field reorder endpoint', () => {
      expect(entityEndpoints.fieldReorder('proj1', 'task')).toBe(
        'proj1/-/classes/task/fields/reorder'
      )
    })
    it('should generate field update endpoint', () => {
      expect(entityEndpoints.fieldUpdate('proj1', 'task', 'field1')).toBe(
        'proj1/-/classes/task/fields/field1/update'
      )
    })
    it('should generate field delete endpoint', () => {
      expect(entityEndpoints.fieldDelete('proj1', 'task', 'field1')).toBe(
        'proj1/-/classes/task/fields/field1/delete'
      )
    })
  })
  describe('option endpoints', () => {
    it('should generate options list endpoint', () => {
      expect(entityEndpoints.options('proj1', 'task', 'status')).toBe(
        'proj1/-/classes/task/fields/status/options'
      )
    })
    it('should generate option create endpoint', () => {
      expect(entityEndpoints.optionCreate('proj1', 'task', 'status')).toBe(
        'proj1/-/classes/task/fields/status/options/create'
      )
    })
    it('should generate option update endpoint', () => {
      expect(
        entityEndpoints.optionUpdate('proj1', 'task', 'status', 'opt1')
      ).toBe('proj1/-/classes/task/fields/status/options/opt1/update')
    })
    it('should generate option delete endpoint', () => {
      expect(
        entityEndpoints.optionDelete('proj1', 'task', 'status', 'opt1')
      ).toBe('proj1/-/classes/task/fields/status/options/opt1/delete')
    })
  })
  describe('comment endpoints', () => {
    it('should generate comments list endpoint', () => {
      expect(entityEndpoints.comments('proj1', 'obj1')).toBe(
        'proj1/-/objects/obj1/comments'
      )
    })
    it('should generate comment create endpoint', () => {
      expect(entityEndpoints.commentCreate('proj1', 'obj1')).toBe(
        'proj1/-/objects/obj1/comments/create'
      )
    })
    it('should generate comment update endpoint', () => {
      expect(entityEndpoints.commentUpdate('proj1', 'obj1', 'comment1')).toBe(
        'proj1/-/objects/obj1/comments/comment1/update'
      )
    })
    it('should generate comment delete endpoint', () => {
      expect(entityEndpoints.commentDelete('proj1', 'obj1', 'comment1')).toBe(
        'proj1/-/objects/obj1/comments/comment1/delete'
      )
    })
  })
  describe('watcher endpoints', () => {
    it('should generate watchers list endpoint', () => {
      expect(entityEndpoints.watchers('proj1', 'obj1')).toBe(
        'proj1/-/objects/obj1/watchers'
      )
    })
    it('should generate watcher add endpoint', () => {
      expect(entityEndpoints.watcherAdd('proj1', 'obj1')).toBe(
        'proj1/-/objects/obj1/watchers/add'
      )
    })
    it('should generate watcher remove endpoint', () => {
      expect(entityEndpoints.watcherRemove('proj1', 'obj1')).toBe(
        'proj1/-/objects/obj1/watchers/remove'
      )
    })
  })
  describe('activity endpoint', () => {
    it('should generate activity endpoint', () => {
      expect(entityEndpoints.activity('proj1', 'obj1')).toBe(
        'proj1/-/objects/obj1/activity'
      )
    })
  })
})

describe('entityAssets', () => {
  it('names a comment, activity and user asset', () => {
    expect(entityAssets.comment('proj1', 'c1')).toBe('proj1/-/comment/c1/asset')
    expect(entityAssets.activity('proj1', 'a1')).toBe(
      'proj1/-/activity/a1/asset'
    )
    expect(entityAssets.user('proj1', 'u1')).toBe('proj1/-/user/u1/asset')
  })
  it('names an attachment and its thumbnail', () => {
    expect(entityAssets.attachment('proj1', 'f1')).toBe(
      'proj1/-/attachments/f1'
    )
    expect(entityAssets.attachment('proj1', 'f1', 'thumbnail')).toBe(
      'proj1/-/attachments/f1/thumbnail'
    )
  })
})

describe('entityAddress', () => {
  it('puts the path under the app path', () => {
    window.history.replaceState({}, '', '/projects/abc')
    expect(entityAddress(() => entityAssets.comment('E', 'c1'))).toBe(
      '/projects/E/-/comment/c1/asset'
    )
  })
  it('gives undefined for an id the path refuses', () => {
    expect(entityAddress(() => entityAssets.comment('E', '..'))).toBeUndefined()
    expect(entityAddress(() => entityAssets.user('E', ''))).toBeUndefined()
  })
})

// Ids are route parameters, which the router has percent-decoded, and ids from
// another server's answer. Whatever one holds, the request must reach the
// action the builder names, with no inputs the id chose.
describe('hostile ids', () => {
  const base = 'https://mochi.example/projects/'

  // Every builder of both tables, called with the hostile value in each id
  // slot in turn.
  const builders = [
    ...Object.entries(entityEndpoints),
    ...Object.entries(entityAssets),
  ].filter(
    (entry): entry is [string, (...ids: string[]) => string] =>
      typeof entry[1] === 'function'
  )

  it('covers every builder in the tables', () => {
    expect(builders).toHaveLength(61)
  })

  it.each([
    ['a query', 'delete?x='],
    ['a fragment', 'x#y'],
    ['a backslash climb', '..\\..\\-\\access\\set?subject=a&level=design'],
    ['an encoded climb', '%2e%2e'],
  ])('keeps %s inside its segment', (_name, hostile) => {
    for (const [name, build] of builders) {
      const slots = build.length
      for (let slot = 0; slot < slots; slot++) {
        const ids = Array.from({ length: slots }, (_, i) =>
          i === slot ? hostile : `id${i}`
        )
        // The thumbnail variant is a fixed word, not an id.
        if (name === 'attachment' && slot === 2) continue
        const benign = build(
          ...Array.from({ length: slots }, (_, i) => `id${i}`)
        )
        const built = build(...ids)
        const url = new URL(built, base)
        expect(url.search, `${name}[${slot}]`).toBe('')
        expect(url.hash, `${name}[${slot}]`).toBe('')
        // Same number of segments as the benign path, and only the hostile
        // slot differs.
        const segments = url.pathname.split('/')
        const expected = new URL(benign, base).pathname.split('/')
        expect(segments.length, `${name}[${slot}]`).toBe(expected.length)
        expect(
          segments.filter((s, i) => s !== expected[i]),
          `${name}[${slot}]`
        ).toEqual([encodeURIComponent(hostile)])
      }
    }
  })

  it.each([
    ['two dots', '..'],
    ['a dot', '.'],
    ['empty', ''],
    ['a slash', 'a/b'],
    ['a climb with a query', '../delete?x='],
  ])('refuses an id that is %s', (_name, hostile) => {
    for (const [name, build] of builders) {
      const slots = build.length
      for (let slot = 0; slot < slots; slot++) {
        if (name === 'attachment' && slot === 2) continue
        const ids = Array.from({ length: slots }, (_, i) =>
          i === slot ? hostile : `id${i}`
        )
        expect(() => build(...ids), `${name}[${slot}]`).toThrow(Error)
      }
    }
  })
})
