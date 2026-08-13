// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// crm and projects each tested this table through their own binding, 38
// identical assertions apiece, while the table itself lived here untested.
// The routes are asserted once, against the shared table. Each app keeps only
// the endpoints it adds on top.

import { describe, it, expect } from 'vitest'
import { entityEndpoints } from './entity-endpoints'

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
      expect(entityEndpoints.info('abc123')).toBe('abc123/-/info')
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
