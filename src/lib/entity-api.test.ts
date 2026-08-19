// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// createEntityApi is the whole object/class/field client both crm and projects
// call. Each app used to assert it through its own binding — 56 blocks in crm,
// 53 of the same blocks in projects — while the client itself sat here with
// nothing on it. The routes it builds and the payloads it sends are asserted
// once, against a stub AppClient, so a change to the shared client fails here
// rather than twice over in the apps.
//
// Ported from apps/crm/web/src/api/crms.test.ts at main (56 blocks): the 53
// both apps shared, plus the three upload blocks only crm ever covered even
// though uploadAttachments and importData have always been shared code.
// What stays in the apps is their own wiring — request module, endpoint table,
// resource key — and whatever routes only they have.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createEntityApi } from './entity-api'
import { entityEndpoints } from './entity-endpoints'
import type { AppClient } from './create-app-client'
import type { EntityObject } from '../types/entity-object'

const request = {
  get: vi.fn(),
  post: vi.fn(),
} as unknown as AppClient

// The resource key is the one thing the server names after the app, so the
// shared client takes it as config. Any value exercises the same code path.
type Shapes = {
  summary: unknown
  details: unknown
  object: EntityObject
  objectDetail: unknown
  objectCreated: unknown
  createRequest: unknown
  updateRequest: unknown
  listKey: 'entities'
}

const build = () =>
  createEntityApi<Shapes>({
    request,
    endpoints: entityEndpoints,
    resourceKey: 'entity',
  })

// Every method that actually ran, recorded on call rather than on property
// access, so the surface gate at the foot of this file measures invocation and
// not merely that a test mentioned the name.
const reached = new Set<string>()

function instrument<T extends object>(client: T): T {
  return Object.fromEntries(
    Object.entries(client).map(([name, fn]) => [
      name,
      (...args: unknown[]) => {
        reached.add(name)
        return (fn as (...a: unknown[]) => unknown)(...args)
      },
    ])
  ) as T
}

const api = instrument(build())

// Paths the stub was actually called with. Harvested in afterEach because the
// suite's beforeEach clears the mocks between blocks.
const routes = new Set<string>()

afterEach(() => {
  for (const client of [request.get, request.post]) {
    for (const [path] of vi.mocked(client).mock.calls) routes.add(String(path))
  }
})

describe('createEntityApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ============= Crm Methods =============

  describe('list', () => {
    it('should fetch the entity list', async () => {
      const mockResponse = {
        data: {
          entities: [
            { id: '1', fingerprint: 'abc', name: 'Crm 1' },
            { id: '2', fingerprint: 'def', name: 'Crm 2' },
          ],
        },
      }
      vi.mocked(request.get).mockResolvedValue(mockResponse)

      const result = await api.list()

      expect(request.get).toHaveBeenCalledWith('-/list')
      expect(result).toEqual(mockResponse)
    })
  })

  describe('create', () => {
    it('should create a new entity', async () => {
      const mockResponse = {
        data: { id: '123', fingerprint: 'abc123' },
      }
      vi.mocked(request.post).mockResolvedValue(mockResponse)

      const result = await api.create({
        name: 'New entity',
        privacy: 'private',
      })

      expect(request.post).toHaveBeenCalledWith('-/create', {
        name: 'New entity',
        privacy: 'private',
      })
      expect(result).toEqual(mockResponse)
    })

    it('should create an entity with optional fields', async () => {
      const mockResponse = { data: { id: '123', fingerprint: 'abc123' } }
      vi.mocked(request.post).mockResolvedValue(mockResponse)

      await api.create({
        name: 'New entity',
        description: 'A test entity',
        prefix: 'TEST',
      })

      expect(request.post).toHaveBeenCalledWith('-/create', {
        name: 'New entity',
        description: 'A test entity',
        prefix: 'TEST',
      })
    })
  })

  describe('get', () => {
    it('should fetch entity details', async () => {
      const mockResponse = {
        data: {
          entity: { id: '1', name: 'Test entity' },
          classes: [],
          fields: {},
          options: {},
          views: [],
          hierarchy: {},
        },
      }
      vi.mocked(request.get).mockResolvedValue(mockResponse)

      const result = await api.get('proj123')

      expect(request.get).toHaveBeenCalledWith('proj123/-/info')
      expect(result).toEqual(mockResponse)
    })
  })

  describe('update', () => {
    it('should update the entity', async () => {
      const mockResponse = { data: { success: true } }
      vi.mocked(request.post).mockResolvedValue(mockResponse)

      const result = await api.update('proj123', {
        name: 'Updated Name',
        description: 'New description',
      })

      expect(request.post).toHaveBeenCalledWith('proj123/-/update', {
        name: 'Updated Name',
        description: 'New description',
      })
      expect(result).toEqual(mockResponse)
    })
  })

  describe('delete', () => {
    it('should delete the entity', async () => {
      const mockResponse = { data: { success: true } }
      vi.mocked(request.post).mockResolvedValue(mockResponse)

      const result = await api.delete('proj123')

      expect(request.post).toHaveBeenCalledWith('proj123/-/delete')
      expect(result).toEqual(mockResponse)
    })
  })

  // ============= Object Methods =============

  describe('listObjects', () => {
    it('should fetch objects without params', async () => {
      const mockResponse = { data: { objects: [] } }
      vi.mocked(request.get).mockResolvedValue(mockResponse)

      await api.listObjects('proj123')

      expect(request.get).toHaveBeenCalledWith('proj123/-/objects')
    })

    it('should fetch objects with class filter', async () => {
      const mockResponse = { data: { objects: [] } }
      vi.mocked(request.get).mockResolvedValue(mockResponse)

      await api.listObjects('proj123', { class: 'task' })

      expect(request.get).toHaveBeenCalledWith('proj123/-/objects?class=task')
    })

    it('should fetch objects with multiple filters', async () => {
      const mockResponse = { data: { objects: [] } }
      vi.mocked(request.get).mockResolvedValue(mockResponse)

      await api.listObjects('proj123', {
        class: 'task',
        status: 'in_progress',
      })

      expect(request.get).toHaveBeenCalledWith(
        'proj123/-/objects?class=task&status=in_progress'
      )
    })

    it('should handle empty parent filter', async () => {
      const mockResponse = { data: { objects: [] } }
      vi.mocked(request.get).mockResolvedValue(mockResponse)

      await api.listObjects('proj123', { parent: '' })

      expect(request.get).toHaveBeenCalledWith('proj123/-/objects?parent=')
    })
  })

  describe('createObject', () => {
    it('should create an object', async () => {
      const mockResponse = {
        data: { id: 'obj1', number: 1, readable: 'proj-1' },
      }
      vi.mocked(request.post).mockResolvedValue(mockResponse)

      const result = await api.createObject('proj123', {
        class: 'task',
        title: 'New Task',
      })

      expect(request.post).toHaveBeenCalledWith('proj123/-/objects/create', {
        class: 'task',
        title: 'New Task',
      })
      expect(result).toEqual(mockResponse)
    })

    it('should create object with parent', async () => {
      const mockResponse = { data: { id: 'obj2', number: 2 } }
      vi.mocked(request.post).mockResolvedValue(mockResponse)

      await api.createObject('proj123', {
        class: 'subtask',
        parent: 'obj1',
      })

      expect(request.post).toHaveBeenCalledWith('proj123/-/objects/create', {
        class: 'subtask',
        parent: 'obj1',
      })
    })
  })

  describe('getObject', () => {
    it('should fetch object details', async () => {
      const mockResponse = {
        data: {
          object: { id: 'obj1', class: 'task' },
          values: { title: 'Test Task' },
          watching: false,
        },
      }
      vi.mocked(request.get).mockResolvedValue(mockResponse)

      const result = await api.getObject('proj123', 'obj1')

      expect(request.get).toHaveBeenCalledWith('proj123/-/objects/obj1')
      expect(result).toEqual(mockResponse)
    })
  })

  describe('updateObject', () => {
    it('should update object', async () => {
      const mockResponse = { data: { success: true } }
      vi.mocked(request.post).mockResolvedValue(mockResponse)

      await api.updateObject('proj123', 'obj1', { class: 'bug' })

      expect(request.post).toHaveBeenCalledWith(
        'proj123/-/objects/obj1/update',
        { class: 'bug' }
      )
    })
  })

  describe('deleteObject', () => {
    it('should delete object', async () => {
      const mockResponse = { data: { success: true } }
      vi.mocked(request.post).mockResolvedValue(mockResponse)

      await api.deleteObject('proj123', 'obj1')

      expect(request.post).toHaveBeenCalledWith('proj123/-/objects/obj1/delete')
    })
  })

  describe('moveObject', () => {
    it('should move object to new column value', async () => {
      const mockResponse = { data: { success: true } }
      vi.mocked(request.post).mockResolvedValue(mockResponse)

      await api.moveObject('proj123', 'obj1', {
        field: 'status',
        value: 'done',
      })

      expect(request.post).toHaveBeenCalledWith('proj123/-/objects/obj1/move', {
        field: 'status',
        value: 'done',
      })
    })
  })

  describe('setValues', () => {
    it('should set multiple values at once', async () => {
      const mockResponse = { data: { success: true } }
      vi.mocked(request.post).mockResolvedValue(mockResponse)

      await api.setValues('proj123', 'obj1', {
        title: 'Updated Title',
        priority: 'high',
      })

      expect(request.post).toHaveBeenCalledWith(
        'proj123/-/objects/obj1/values',
        { title: 'Updated Title', priority: 'high' }
      )
    })
  })

  describe('setValue', () => {
    it('should set a single field value', async () => {
      const mockResponse = { data: { success: true } }
      vi.mocked(request.post).mockResolvedValue(mockResponse)

      await api.setValue('proj123', 'obj1', 'status', 'in_progress')

      expect(request.post).toHaveBeenCalledWith(
        'proj123/-/objects/obj1/values/status',
        { value: 'in_progress' }
      )
    })
  })

  // ============= Comment Methods =============

  describe('listComments', () => {
    it('should fetch comments for an object', async () => {
      const mockResponse = {
        data: {
          comments: [{ id: 'c1', content: 'First comment', author: 'user1' }],
        },
      }
      vi.mocked(request.get).mockResolvedValue(mockResponse)

      const result = await api.listComments('proj123', 'obj1')

      expect(request.get).toHaveBeenCalledWith(
        'proj123/-/objects/obj1/comments'
      )
      expect(result).toEqual(mockResponse)
    })
  })

  describe('createComment', () => {
    it('should create a comment', async () => {
      const mockResponse = {
        data: { id: 'c1', content: 'New comment', author: 'user1' },
      }
      vi.mocked(request.post).mockResolvedValue(mockResponse)

      await api.createComment('proj123', 'obj1', 'New comment')

      // timeout 0 is asserted rather than accepted as any object: the client's
      // 30-second default is what aborted large uploads mid-flight, so a
      // loose matcher here would pass just as happily if it came back.
      expect(request.post).toHaveBeenCalledWith(
        'proj123/-/objects/obj1/comments/create',
        expect.any(FormData),
        expect.objectContaining({ timeout: 0 })
      )
    })

    it('should create a reply comment', async () => {
      const mockResponse = { data: { id: 'c2' } }
      vi.mocked(request.post).mockResolvedValue(mockResponse)

      await api.createComment('proj123', 'obj1', 'Reply', 'c1')

      expect(request.post).toHaveBeenCalledWith(
        'proj123/-/objects/obj1/comments/create',
        expect.any(FormData),
        expect.objectContaining({ timeout: 0 })
      )
    })

    it('should report upload progress to the caller', async () => {
      vi.mocked(request.post).mockResolvedValue({ data: { id: 'c3' } })
      const onProgress = vi.fn()

      await api.createComment(
        'proj123',
        'obj1',
        'With a file',
        undefined,
        [new File(['x'], 'a.txt')],
        onProgress
      )

      expect(request.post).toHaveBeenCalledWith(
        'proj123/-/objects/obj1/comments/create',
        expect.any(FormData),
        expect.objectContaining({ timeout: 0, onUploadProgress: onProgress })
      )
    })
  })

  // The commit that lifted the client's 30-second timeout applied it to three
  // upload paths and left two of them untested, including the one whose bug it
  // names: a large import aborting mid-flight. Covered here so the value is
  // pinned everywhere it was set, not only where a test happened to exist.
  describe('upload timeouts', () => {
    it('should lift the timeout when uploading attachments', async () => {
      vi.mocked(request.post).mockResolvedValue({ data: { attachments: [] } })
      const onProgress = vi.fn()

      await api.uploadAttachments(
        'proj123',
        'obj1',
        [new File(['x'], 'a.txt')],
        onProgress
      )

      expect(request.post).toHaveBeenCalledWith(
        'proj123/-/objects/obj1/attachments/create',
        expect.any(FormData),
        expect.objectContaining({ timeout: 0, onUploadProgress: onProgress })
      )
    })

    it('should lift the timeout when importing data', async () => {
      vi.mocked(request.post).mockResolvedValue({
        data: { objects: 1, comments: 0, attachments: 0, links: 0 },
      })
      const onProgress = vi.fn()

      await api.importData('proj123', new Blob(['x']), onProgress)

      expect(request.post).toHaveBeenCalledWith(
        'proj123/-/data/import',
        expect.any(FormData),
        expect.objectContaining({ timeout: 0, onUploadProgress: onProgress })
      )
    })
  })

  describe('updateComment', () => {
    it('should update a comment', async () => {
      const mockResponse = { data: { success: true } }
      vi.mocked(request.post).mockResolvedValue(mockResponse)

      await api.updateComment('proj123', 'obj1', 'c1', 'Updated content')

      expect(request.post).toHaveBeenCalledWith(
        'proj123/-/objects/obj1/comments/c1/update',
        { content: 'Updated content' }
      )
    })
  })

  describe('deleteComment', () => {
    it('should delete a comment', async () => {
      const mockResponse = { data: { success: true } }
      vi.mocked(request.post).mockResolvedValue(mockResponse)

      await api.deleteComment('proj123', 'obj1', 'c1')

      expect(request.post).toHaveBeenCalledWith(
        'proj123/-/objects/obj1/comments/c1/delete'
      )
    })
  })

  // ============= View Methods =============

  describe('listViews', () => {
    it('should fetch entity views', async () => {
      const mockResponse = {
        data: {
          views: [{ id: 'v1', name: 'Board', viewtype: 'board' }],
        },
      }
      vi.mocked(request.get).mockResolvedValue(mockResponse)

      const result = await api.listViews('proj123')

      expect(request.get).toHaveBeenCalledWith('proj123/-/views')
      expect(result).toEqual(mockResponse)
    })
  })

  describe('createView', () => {
    it('should create a view', async () => {
      const mockResponse = {
        data: { id: 'v2', name: 'List View', viewtype: 'list' },
      }
      vi.mocked(request.post).mockResolvedValue(mockResponse)

      await api.createView('proj123', {
        name: 'List View',
        viewtype: 'list',
      })

      expect(request.post).toHaveBeenCalledWith('proj123/-/views/create', {
        name: 'List View',
        viewtype: 'list',
      })
    })
  })

  describe('updateView', () => {
    it('should update a view', async () => {
      const mockResponse = { data: { success: true } }
      vi.mocked(request.post).mockResolvedValue(mockResponse)

      await api.updateView('proj123', 'v1', {
        name: 'Updated Board',
        sort: 'priority',
        direction: 'desc',
      })

      expect(request.post).toHaveBeenCalledWith('proj123/-/views/v1/update', {
        name: 'Updated Board',
        sort: 'priority',
        direction: 'desc',
      })
    })
  })

  describe('deleteView', () => {
    it('should delete a view', async () => {
      const mockResponse = { data: { success: true } }
      vi.mocked(request.post).mockResolvedValue(mockResponse)

      await api.deleteView('proj123', 'v1')

      expect(request.post).toHaveBeenCalledWith('proj123/-/views/v1/delete')
    })
  })

  // ============= Class Methods =============

  describe('listClasses', () => {
    it('should fetch entity classes', async () => {
      const mockResponse = {
        data: { classes: [{ id: 'task', name: 'Task', sort: 0 }] },
      }
      vi.mocked(request.get).mockResolvedValue(mockResponse)

      const result = await api.listClasses('proj123')

      expect(request.get).toHaveBeenCalledWith('proj123/-/classes')
      expect(result).toEqual(mockResponse)
    })
  })

  describe('createClass', () => {
    it('should create a class', async () => {
      const mockResponse = { data: { id: 'bug', name: 'Bug', sort: 1 } }
      vi.mocked(request.post).mockResolvedValue(mockResponse)

      await api.createClass('proj123', { name: 'Bug' })

      expect(request.post).toHaveBeenCalledWith('proj123/-/classes/create', {
        name: 'Bug',
      })
    })
  })

  describe('updateClass', () => {
    it('should update a class', async () => {
      const mockResponse = { data: { success: true } }
      vi.mocked(request.post).mockResolvedValue(mockResponse)

      await api.updateClass('proj123', 'task', { name: 'Issue' })

      expect(request.post).toHaveBeenCalledWith(
        'proj123/-/classes/task/update',
        { name: 'Issue' }
      )
    })
  })

  describe('deleteClass', () => {
    it('should delete a class', async () => {
      const mockResponse = { data: { success: true } }
      vi.mocked(request.post).mockResolvedValue(mockResponse)

      await api.deleteClass('proj123', 'bug')

      expect(request.post).toHaveBeenCalledWith('proj123/-/classes/bug/delete')
    })
  })

  // ============= Field Methods =============

  describe('listFields', () => {
    it('should fetch fields for a class', async () => {
      const mockResponse = {
        data: {
          fields: [{ id: 'title', name: 'Title', fieldtype: 'text' }],
        },
      }
      vi.mocked(request.get).mockResolvedValue(mockResponse)

      const result = await api.listFields('proj123', 'task')

      expect(request.get).toHaveBeenCalledWith('proj123/-/classes/task/fields')
      expect(result).toEqual(mockResponse)
    })
  })

  describe('createField', () => {
    it('should create a field', async () => {
      const mockResponse = {
        data: {
          id: 'priority',
          name: 'Priority',
          fieldtype: 'select',
          sort: 3,
        },
      }
      vi.mocked(request.post).mockResolvedValue(mockResponse)

      await api.createField('proj123', 'task', {
        name: 'Priority',
        fieldtype: 'select',
      })

      expect(request.post).toHaveBeenCalledWith(
        'proj123/-/classes/task/fields/create',
        { name: 'Priority', fieldtype: 'select' }
      )
    })
  })

  describe('updateField', () => {
    it('should update a field', async () => {
      const mockResponse = { data: { success: true } }
      vi.mocked(request.post).mockResolvedValue(mockResponse)

      await api.updateField('proj123', 'task', 'priority', {
        flags: 'required',
        position: 'card',
      })

      expect(request.post).toHaveBeenCalledWith(
        'proj123/-/classes/task/fields/priority/update',
        { flags: 'required', position: 'card' }
      )
    })
  })

  describe('deleteField', () => {
    it('should delete a field', async () => {
      const mockResponse = { data: { success: true } }
      vi.mocked(request.post).mockResolvedValue(mockResponse)

      await api.deleteField('proj123', 'task', 'priority')

      expect(request.post).toHaveBeenCalledWith(
        'proj123/-/classes/task/fields/priority/delete'
      )
    })
  })

  describe('reorderFields', () => {
    it('should reorder fields', async () => {
      const mockResponse = { data: { success: true } }
      vi.mocked(request.post).mockResolvedValue(mockResponse)

      await api.reorderFields('proj123', 'task', [
        'title',
        'status',
        'priority',
      ])

      expect(request.post).toHaveBeenCalledWith(
        'proj123/-/classes/task/fields/reorder',
        { order: 'title,status,priority' }
      )
    })
  })

  // ============= Option Methods =============

  describe('listOptions', () => {
    it('should fetch options for a field', async () => {
      const mockResponse = {
        data: {
          options: [{ id: 'high', name: 'High', colour: '#ff0000' }],
        },
      }
      vi.mocked(request.get).mockResolvedValue(mockResponse)

      const result = await api.listOptions('proj123', 'task', 'priority')

      expect(request.get).toHaveBeenCalledWith(
        'proj123/-/classes/task/fields/priority/options'
      )
      expect(result).toEqual(mockResponse)
    })
  })

  describe('createOption', () => {
    it('should create an option', async () => {
      const mockResponse = {
        data: { id: 'critical', name: 'Critical', colour: '#ff0000', sort: 0 },
      }
      vi.mocked(request.post).mockResolvedValue(mockResponse)

      await api.createOption('proj123', 'task', 'priority', {
        name: 'Critical',
        colour: '#ff0000',
      })

      expect(request.post).toHaveBeenCalledWith(
        'proj123/-/classes/task/fields/priority/options/create',
        { name: 'Critical', colour: '#ff0000' }
      )
    })
  })

  describe('updateOption', () => {
    it('should update an option', async () => {
      const mockResponse = { data: { success: true } }
      vi.mocked(request.post).mockResolvedValue(mockResponse)

      await api.updateOption('proj123', 'task', 'priority', 'high', {
        colour: '#ff5500',
      })

      expect(request.post).toHaveBeenCalledWith(
        'proj123/-/classes/task/fields/priority/options/high/update',
        { colour: '#ff5500' }
      )
    })
  })

  describe('deleteOption', () => {
    it('should delete an option', async () => {
      const mockResponse = { data: { success: true } }
      vi.mocked(request.post).mockResolvedValue(mockResponse)

      await api.deleteOption('proj123', 'task', 'priority', 'low')

      expect(request.post).toHaveBeenCalledWith(
        'proj123/-/classes/task/fields/priority/options/low/delete'
      )
    })
  })

  describe('reorderOptions', () => {
    it('should reorder options', async () => {
      const mockResponse = { data: { success: true } }
      vi.mocked(request.post).mockResolvedValue(mockResponse)

      await api.reorderOptions('proj123', 'task', 'priority', [
        'critical',
        'high',
        'medium',
        'low',
      ])

      expect(request.post).toHaveBeenCalledWith(
        'proj123/-/classes/task/fields/priority/options/reorder',
        { order: 'critical,high,medium,low' }
      )
    })
  })

  // ============= Watcher Methods =============

  describe('listWatchers', () => {
    it('should fetch watchers for an object', async () => {
      const mockResponse = {
        data: { watchers: [{ id: 'user1', name: 'User 1' }] },
      }
      vi.mocked(request.get).mockResolvedValue(mockResponse)

      const result = await api.listWatchers('proj123', 'obj1')

      expect(request.get).toHaveBeenCalledWith(
        'proj123/-/objects/obj1/watchers'
      )
      expect(result).toEqual(mockResponse)
    })
  })

  describe('addWatcher', () => {
    it('should add current user as watcher', async () => {
      const mockResponse = { data: { success: true, watching: true } }
      vi.mocked(request.post).mockResolvedValue(mockResponse)

      const result = await api.addWatcher('proj123', 'obj1')

      expect(request.post).toHaveBeenCalledWith(
        'proj123/-/objects/obj1/watchers/add'
      )
      expect(result.data.watching).toBe(true)
    })
  })

  describe('removeWatcher', () => {
    it('should remove current user as watcher', async () => {
      const mockResponse = { data: { success: true, watching: false } }
      vi.mocked(request.post).mockResolvedValue(mockResponse)

      const result = await api.removeWatcher('proj123', 'obj1')

      expect(request.post).toHaveBeenCalledWith(
        'proj123/-/objects/obj1/watchers/remove'
      )
      expect(result.data.watching).toBe(false)
    })
  })

  // ============= Link Methods =============

  describe('listLinks', () => {
    it('should fetch links for an object', async () => {
      const mockResponse = {
        data: { links: [{ target: 'obj2', linktype: 'blocks' }] },
      }
      vi.mocked(request.get).mockResolvedValue(mockResponse)

      const result = await api.listLinks('proj123', 'obj1')

      expect(request.get).toHaveBeenCalledWith('proj123/-/objects/obj1/links')
      expect(result).toEqual(mockResponse)
    })
  })

  describe('createLink', () => {
    it('should create a link between objects', async () => {
      const mockResponse = { data: { success: true } }
      vi.mocked(request.post).mockResolvedValue(mockResponse)

      await api.createLink('proj123', 'obj1', 'obj2', 'blocks')

      expect(request.post).toHaveBeenCalledWith(
        'proj123/-/objects/obj1/links/create',
        { target: 'obj2', linktype: 'blocks' }
      )
    })
  })

  describe('deleteLink', () => {
    it('should delete a link', async () => {
      const mockResponse = { data: { success: true } }
      vi.mocked(request.post).mockResolvedValue(mockResponse)

      await api.deleteLink('proj123', 'obj1', 'obj2', 'blocks')

      expect(request.post).toHaveBeenCalledWith(
        'proj123/-/objects/obj1/links/delete',
        { target: 'obj2', linktype: 'blocks' }
      )
    })
  })

  // ============= Hierarchy Methods =============

  describe('getHierarchy', () => {
    it('should fetch hierarchy for a class', async () => {
      const mockResponse = { data: { parents: ['epic', 'story'] } }
      vi.mocked(request.get).mockResolvedValue(mockResponse)

      const result = await api.getHierarchy('proj123', 'task')

      expect(request.get).toHaveBeenCalledWith(
        'proj123/-/classes/task/hierarchy'
      )
      expect(result).toEqual(mockResponse)
    })
  })

  describe('setHierarchy', () => {
    it('should set hierarchy for a class', async () => {
      const mockResponse = { data: { success: true } }
      vi.mocked(request.post).mockResolvedValue(mockResponse)

      await api.setHierarchy('proj123', 'subtask', ['task', 'bug'])

      expect(request.post).toHaveBeenCalledWith(
        'proj123/-/classes/subtask/hierarchy/set',
        { parents: 'task,bug' }
      )
    })

    it('should handle empty hierarchy', async () => {
      const mockResponse = { data: { success: true } }
      vi.mocked(request.post).mockResolvedValue(mockResponse)

      await api.setHierarchy('proj123', 'task', [])

      expect(request.post).toHaveBeenCalledWith(
        'proj123/-/classes/task/hierarchy/set',
        { parents: '_none_' }
      )
    })
  })

  // ============= Activity Methods =============

  describe('listActivity', () => {
    it('should fetch activity for an object', async () => {
      const mockResponse = {
        data: {
          activities: [{ id: 'a1', action: 'created', created: Date.now() }],
        },
      }
      vi.mocked(request.get).mockResolvedValue(mockResponse)

      const result = await api.listActivity('proj123', 'obj1')

      expect(request.get).toHaveBeenCalledWith(
        'proj123/-/objects/obj1/activity'
      )
      expect(result).toEqual(mockResponse)
    })
  })

  // ============= Attachment Methods =============

  describe('listAttachments', () => {
    it('should fetch attachments for an object', async () => {
      const mockResponse = {
        data: { attachments: [{ id: 'att1', filename: 'file.pdf' }] },
      }
      vi.mocked(request.get).mockResolvedValue(mockResponse)

      const result = await api.listAttachments('proj123', 'obj1')

      expect(request.get).toHaveBeenCalledWith(
        'proj123/-/objects/obj1/attachments'
      )
      expect(result).toEqual(mockResponse)
    })
  })

  describe('deleteAttachment', () => {
    it('should delete an attachment', async () => {
      const mockResponse = { data: { success: true } }
      vi.mocked(request.post).mockResolvedValue(mockResponse)

      await api.deleteAttachment('proj123', 'obj1', 'att1')

      expect(request.post).toHaveBeenCalledWith(
        'proj123/-/objects/obj1/attachments/att1/delete'
      )
    })
  })
})

// The surface gate. Cross-package coverage cannot be measured here (the app
// suites resolve @mochi/web to this source, but v8 scopes its report to the
// vitest project root and drops everything outside it), so reach over the
// client's own surface is the acceptance criterion instead of a coverage delta.
//
// These 17 methods were never invoked by either app's suite on main either.
// Restoring them is betterment rather than remediation, so they are quoted
// separately and listed here instead: the debt lives in the code, not in a
// document, and the gate fails the moment anything ELSE stops being invoked.
const NEVER_TESTED_ON_MAIN = [
  'exportData',
  'exportDesign',
  'getAccessRules',
  'importDesign',
  'listGroups',
  'listPeople',
  'probe',
  'recommendations',
  'reorderViews',
  'revokeAccess',
  'search',
  'searchUsers',
  'setAccessLevel',
  'share',
  'subscribe',
  'unsubscribe',
  'warmExport',
] as const

describe('shared client surface', () => {
  it('invokes every client method except the 17 quoted separately', () => {
    const surface = Object.keys(build())
    const missing = surface.filter(
      (name) =>
        !reached.has(name) &&
        !(NEVER_TESTED_ON_MAIN as readonly string[]).includes(name)
    )
    expect(missing).toEqual([])
  })

  it('keeps the untested list honest — nothing on it is secretly covered', () => {
    const stale = NEVER_TESTED_ON_MAIN.filter((name) => reached.has(name))
    expect(stale).toEqual([])
  })

  // Each of the 65 methods references exactly one member of the shared table
  // and no member is referenced twice, so reaching a method is reaching its
  // route: 48 methods reached is 48 of the 65 routes, not 65.
  it('reaches 48 of the 65 client methods, one route each', () => {
    const surface = Object.keys(build())
    expect(surface).toHaveLength(65)
    expect(Object.keys(entityEndpoints)).toHaveLength(65)
    expect(reached.size).toBe(surface.length - NEVER_TESTED_ON_MAIN.length)
    expect(reached.size).toBe(48)
  })
})
