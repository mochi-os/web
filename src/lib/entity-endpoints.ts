// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// Route table shared by the object/class/field apps (crm, projects). Both
// servers expose the same object model under the same paths, so the table is
// the same table; an app that adds routes of its own spreads them on top:
//
//   const endpoints = {
//     projects: { ...entityEndpoints, templates: '-/templates' },
//   } as const
//
// Paths are relative to the baseURL set in the app's request module.

export const entityEndpoints = {
  // Class-level endpoints (no entity context)
  list: '-/list',
  create: '-/create',
  search: '-/directory/search',
  probe: '-/probe',
  recommendations: '-/recommendations',
  share: (entityId: string) => `${entityId}/-/share`,
  subscribe: '-/subscribe',
  unsubscribe: '-/unsubscribe',

  // Entity-level endpoints (use /-/ separator)
  info: (entityId: string) => `${entityId}/-/info`,
  update: (entityId: string) => `${entityId}/-/update`,
  delete: (entityId: string) => `${entityId}/-/delete`,
  people: (entityId: string) => `${entityId}/-/people`,

  // Access control endpoints
  access: (entityId: string) => `${entityId}/-/access`,
  accessSet: (entityId: string) => `${entityId}/-/access/set`,
  accessRevoke: (entityId: string) => `${entityId}/-/access/revoke`,

  // Object endpoints
  objects: (entityId: string) => `${entityId}/-/objects`,
  objectCreate: (entityId: string) => `${entityId}/-/objects/create`,
  object: (entityId: string, objectId: string) =>
    `${entityId}/-/objects/${objectId}`,
  objectUpdate: (entityId: string, objectId: string) =>
    `${entityId}/-/objects/${objectId}/update`,
  objectDelete: (entityId: string, objectId: string) =>
    `${entityId}/-/objects/${objectId}/delete`,
  objectMove: (entityId: string, objectId: string) =>
    `${entityId}/-/objects/${objectId}/move`,

  // Value endpoints
  valuesSet: (entityId: string, objectId: string) =>
    `${entityId}/-/objects/${objectId}/values`,
  valueSet: (entityId: string, objectId: string, field: string) =>
    `${entityId}/-/objects/${objectId}/values/${field}`,

  // Link endpoints
  links: (entityId: string, objectId: string) =>
    `${entityId}/-/objects/${objectId}/links`,
  linkCreate: (entityId: string, objectId: string) =>
    `${entityId}/-/objects/${objectId}/links/create`,
  linkDelete: (entityId: string, objectId: string) =>
    `${entityId}/-/objects/${objectId}/links/delete`,

  // Comment endpoints
  comments: (entityId: string, objectId: string) =>
    `${entityId}/-/objects/${objectId}/comments`,
  commentCreate: (entityId: string, objectId: string) =>
    `${entityId}/-/objects/${objectId}/comments/create`,
  commentUpdate: (entityId: string, objectId: string, commentId: string) =>
    `${entityId}/-/objects/${objectId}/comments/${commentId}/update`,
  commentDelete: (entityId: string, objectId: string, commentId: string) =>
    `${entityId}/-/objects/${objectId}/comments/${commentId}/delete`,

  // Attachment endpoints
  attachments: (entityId: string, objectId: string) =>
    `${entityId}/-/objects/${objectId}/attachments`,
  attachmentCreate: (entityId: string, objectId: string) =>
    `${entityId}/-/objects/${objectId}/attachments/create`,
  attachmentDelete: (
    entityId: string,
    objectId: string,
    attachmentId: string,
  ) => `${entityId}/-/objects/${objectId}/attachments/${attachmentId}/delete`,

  // Activity endpoint
  activity: (entityId: string, objectId: string) =>
    `${entityId}/-/objects/${objectId}/activity`,

  // Watcher endpoints
  watchers: (entityId: string, objectId: string) =>
    `${entityId}/-/objects/${objectId}/watchers`,
  watcherAdd: (entityId: string, objectId: string) =>
    `${entityId}/-/objects/${objectId}/watchers/add`,
  watcherRemove: (entityId: string, objectId: string) =>
    `${entityId}/-/objects/${objectId}/watchers/remove`,

  // Design import/export endpoints
  designExport: (entityId: string) => `${entityId}/-/design/export`,
  designImport: (entityId: string) => `${entityId}/-/design/import`,

  // Data import/export endpoints
  dataExport: (entityId: string) => `${entityId}/-/data/export`,
  dataExportWarm: (entityId: string) => `${entityId}/-/data/export/warm`,
  dataImport: (entityId: string) => `${entityId}/-/data/import`,

  // View endpoints
  views: (entityId: string) => `${entityId}/-/views`,
  viewCreate: (entityId: string) => `${entityId}/-/views/create`,
  viewReorder: (entityId: string) => `${entityId}/-/views/reorder`,
  viewUpdate: (entityId: string, viewId: string) =>
    `${entityId}/-/views/${viewId}/update`,
  viewDelete: (entityId: string, viewId: string) =>
    `${entityId}/-/views/${viewId}/delete`,

  // Class endpoints
  classes: (entityId: string) => `${entityId}/-/classes`,
  classCreate: (entityId: string) => `${entityId}/-/classes/create`,
  classUpdate: (entityId: string, classId: string) =>
    `${entityId}/-/classes/${classId}/update`,
  classDelete: (entityId: string, classId: string) =>
    `${entityId}/-/classes/${classId}/delete`,

  // Hierarchy endpoints
  hierarchy: (entityId: string, classId: string) =>
    `${entityId}/-/classes/${classId}/hierarchy`,
  hierarchySet: (entityId: string, classId: string) =>
    `${entityId}/-/classes/${classId}/hierarchy/set`,

  // Field endpoints
  fields: (entityId: string, classId: string) =>
    `${entityId}/-/classes/${classId}/fields`,
  fieldCreate: (entityId: string, classId: string) =>
    `${entityId}/-/classes/${classId}/fields/create`,
  fieldReorder: (entityId: string, classId: string) =>
    `${entityId}/-/classes/${classId}/fields/reorder`,
  fieldUpdate: (entityId: string, classId: string, fieldId: string) =>
    `${entityId}/-/classes/${classId}/fields/${fieldId}/update`,
  fieldDelete: (entityId: string, classId: string, fieldId: string) =>
    `${entityId}/-/classes/${classId}/fields/${fieldId}/delete`,

  // Option endpoints
  options: (entityId: string, classId: string, fieldId: string) =>
    `${entityId}/-/classes/${classId}/fields/${fieldId}/options`,
  optionCreate: (entityId: string, classId: string, fieldId: string) =>
    `${entityId}/-/classes/${classId}/fields/${fieldId}/options/create`,
  optionReorder: (entityId: string, classId: string, fieldId: string) =>
    `${entityId}/-/classes/${classId}/fields/${fieldId}/options/reorder`,
  optionUpdate: (
    entityId: string,
    classId: string,
    fieldId: string,
    optionId: string,
  ) =>
    `${entityId}/-/classes/${classId}/fields/${fieldId}/options/${optionId}/update`,
  optionDelete: (
    entityId: string,
    classId: string,
    fieldId: string,
    optionId: string,
  ) =>
    `${entityId}/-/classes/${classId}/fields/${fieldId}/options/${optionId}/delete`,

  // User and group endpoints
  usersSearch: '-/users/search',
  groups: '-/groups',
} as const

export type EntityEndpoints = typeof entityEndpoints
