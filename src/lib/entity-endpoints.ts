// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// Route table shared by the object/class/field apps (crm, projects). Paths are
// relative to the baseURL set in the app's request module; an app with routes
// of its own spreads them on top: { ...entityEndpoints, templates:
// '-/templates' }. Every id goes in through path, which encodes it as one
// segment.

import { getAppPath } from './app-path'
import { path, tryPath } from './request-path'

export const entityEndpoints = {
  // Class-level endpoints (no entity context)
  list: '-/list',
  create: '-/create',
  search: '-/directory/search',
  probe: '-/probe',
  recommendations: '-/recommendations',
  share: (entityId: string) => path`${entityId}/-/share`,
  subscribe: '-/subscribe',
  unsubscribe: '-/unsubscribe',

  // Entity-level endpoints (use /-/ separator)
  information: (entityId: string) => path`${entityId}/-/information`,
  update: (entityId: string) => path`${entityId}/-/update`,
  delete: (entityId: string) => path`${entityId}/-/delete`,
  people: (entityId: string) => path`${entityId}/-/people`,

  // Access control endpoints
  access: (entityId: string) => path`${entityId}/-/access`,
  accessSet: (entityId: string) => path`${entityId}/-/access/set`,
  accessRevoke: (entityId: string) => path`${entityId}/-/access/revoke`,

  // Object endpoints
  objects: (entityId: string) => path`${entityId}/-/objects`,
  objectCreate: (entityId: string) => path`${entityId}/-/objects/create`,
  object: (entityId: string, objectId: string) =>
    path`${entityId}/-/objects/${objectId}`,
  objectUpdate: (entityId: string, objectId: string) =>
    path`${entityId}/-/objects/${objectId}/update`,
  objectDelete: (entityId: string, objectId: string) =>
    path`${entityId}/-/objects/${objectId}/delete`,
  objectMove: (entityId: string, objectId: string) =>
    path`${entityId}/-/objects/${objectId}/move`,

  // Value endpoints
  valuesSet: (entityId: string, objectId: string) =>
    path`${entityId}/-/objects/${objectId}/values`,
  valueSet: (entityId: string, objectId: string, field: string) =>
    path`${entityId}/-/objects/${objectId}/values/${field}`,

  // Link endpoints
  links: (entityId: string, objectId: string) =>
    path`${entityId}/-/objects/${objectId}/links`,
  linkCreate: (entityId: string, objectId: string) =>
    path`${entityId}/-/objects/${objectId}/links/create`,
  linkDelete: (entityId: string, objectId: string) =>
    path`${entityId}/-/objects/${objectId}/links/delete`,

  // Comment endpoints
  comments: (entityId: string, objectId: string) =>
    path`${entityId}/-/objects/${objectId}/comments`,
  commentCreate: (entityId: string, objectId: string) =>
    path`${entityId}/-/objects/${objectId}/comments/create`,
  commentUpdate: (entityId: string, objectId: string, commentId: string) =>
    path`${entityId}/-/objects/${objectId}/comments/${commentId}/update`,
  commentDelete: (entityId: string, objectId: string, commentId: string) =>
    path`${entityId}/-/objects/${objectId}/comments/${commentId}/delete`,

  // Attachment endpoints
  attachments: (entityId: string, objectId: string) =>
    path`${entityId}/-/objects/${objectId}/attachments`,
  attachmentCreate: (entityId: string, objectId: string) =>
    path`${entityId}/-/objects/${objectId}/attachments/create`,
  attachmentDelete: (
    entityId: string,
    objectId: string,
    attachmentId: string
  ) =>
    path`${entityId}/-/objects/${objectId}/attachments/${attachmentId}/delete`,
  attachmentCopy: (entityId: string, objectId: string) =>
    path`${entityId}/-/objects/${objectId}/attachments/copy`,

  // Activity endpoint
  activity: (entityId: string, objectId: string) =>
    path`${entityId}/-/objects/${objectId}/activity`,

  // Watcher endpoints
  watchers: (entityId: string, objectId: string) =>
    path`${entityId}/-/objects/${objectId}/watchers`,
  watcherAdd: (entityId: string, objectId: string) =>
    path`${entityId}/-/objects/${objectId}/watchers/add`,
  watcherRemove: (entityId: string, objectId: string) =>
    path`${entityId}/-/objects/${objectId}/watchers/remove`,

  // Design import/export endpoints
  designExport: (entityId: string) => path`${entityId}/-/design/export`,
  designImport: (entityId: string) => path`${entityId}/-/design/import`,

  // Data import/export endpoints
  dataExport: (entityId: string) => path`${entityId}/-/data/export`,
  dataExportWarm: (entityId: string) => path`${entityId}/-/data/export/warm`,
  dataImport: (entityId: string) => path`${entityId}/-/data/import`,

  // View endpoints
  views: (entityId: string) => path`${entityId}/-/views`,
  viewCreate: (entityId: string) => path`${entityId}/-/views/create`,
  viewReorder: (entityId: string) => path`${entityId}/-/views/reorder`,
  viewUpdate: (entityId: string, viewId: string) =>
    path`${entityId}/-/views/${viewId}/update`,
  viewDelete: (entityId: string, viewId: string) =>
    path`${entityId}/-/views/${viewId}/delete`,

  // Class endpoints
  classes: (entityId: string) => path`${entityId}/-/classes`,
  classCreate: (entityId: string) => path`${entityId}/-/classes/create`,
  classUpdate: (entityId: string, classId: string) =>
    path`${entityId}/-/classes/${classId}/update`,
  classDelete: (entityId: string, classId: string) =>
    path`${entityId}/-/classes/${classId}/delete`,

  // Hierarchy endpoints
  hierarchy: (entityId: string, classId: string) =>
    path`${entityId}/-/classes/${classId}/hierarchy`,
  hierarchySet: (entityId: string, classId: string) =>
    path`${entityId}/-/classes/${classId}/hierarchy/set`,

  // Field endpoints
  fields: (entityId: string, classId: string) =>
    path`${entityId}/-/classes/${classId}/fields`,
  fieldCreate: (entityId: string, classId: string) =>
    path`${entityId}/-/classes/${classId}/fields/create`,
  fieldReorder: (entityId: string, classId: string) =>
    path`${entityId}/-/classes/${classId}/fields/reorder`,
  fieldUpdate: (entityId: string, classId: string, fieldId: string) =>
    path`${entityId}/-/classes/${classId}/fields/${fieldId}/update`,
  fieldDelete: (entityId: string, classId: string, fieldId: string) =>
    path`${entityId}/-/classes/${classId}/fields/${fieldId}/delete`,

  // Option endpoints
  options: (entityId: string, classId: string, fieldId: string) =>
    path`${entityId}/-/classes/${classId}/fields/${fieldId}/options`,
  optionCreate: (entityId: string, classId: string, fieldId: string) =>
    path`${entityId}/-/classes/${classId}/fields/${fieldId}/options/create`,
  optionReorder: (entityId: string, classId: string, fieldId: string) =>
    path`${entityId}/-/classes/${classId}/fields/${fieldId}/options/reorder`,
  optionUpdate: (
    entityId: string,
    classId: string,
    fieldId: string,
    optionId: string
  ) =>
    path`${entityId}/-/classes/${classId}/fields/${fieldId}/options/${optionId}/update`,
  optionDelete: (
    entityId: string,
    classId: string,
    fieldId: string,
    optionId: string
  ) =>
    path`${entityId}/-/classes/${classId}/fields/${fieldId}/options/${optionId}/delete`,

  // User and group endpoints
  usersSearch: '-/users/search',
  groups: '-/groups',
} as const

export type EntityEndpoints = typeof entityEndpoints

// The asset routes of the same apps, which a page embeds rather than requests
// through the client: an avatar or style is `<address>/avatar` or
// `<address>/style` under the person's address.
export const entityAssets = {
  comment: (entityId: string, commentId: string) =>
    path`${entityId}/-/comment/${commentId}/asset`,
  activity: (entityId: string, activityId: string) =>
    path`${entityId}/-/activity/${activityId}/asset`,
  user: (entityId: string, userId: string) =>
    path`${entityId}/-/user/${userId}/asset`,
  attachment: (
    entityId: string,
    attachmentId: string,
    variant?: 'thumbnail'
  ) =>
    variant === 'thumbnail'
      ? path`${entityId}/-/attachments/${attachmentId}/thumbnail`
      : path`${entityId}/-/attachments/${attachmentId}`,
} as const

/**
 * A path under the app path, for a page to embed (an avatar, a style, an
 * attachment): undefined when an id in it is refused, so the page leaves that
 * image out rather than failing to render.
 *
 *   entityAddress(() => entityAssets.comment(containerId, comment.id))
 */
export function entityAddress(endpoint: () => string): string | undefined {
  return tryPath(() => `${getAppPath()}/${endpoint()}`) // path-ok: the app's own path and an endpoint path already built
}
