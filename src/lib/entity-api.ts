// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// Client for the object/class/field server API, shared by crm and projects.
// Both apps talk to the same routes with the same payloads; what differs is the
// noun in a handful of response envelopes, which is why the shapes arrive as a
// type bundle rather than as a pile of type parameters.
//
//   interface CrmApiShapes extends EntityApiShapes { summary: Crm; ... }
//   const crmsApi = createEntityApi<CrmApiShapes>({ request, endpoints, resourceKey: 'crm' })
//
// An app that has routes of its own spreads its extra methods over the result.

import type { AxiosProgressEvent } from 'axios'
import type { AppClient } from './create-app-client'
import type { EntityEndpoints } from './entity-endpoints'
import type { AccessRule } from '../features/access/types'
import type {
  EntityActivity,
  EntityAttachment,
  EntityClass,
  EntityComment,
  EntityField,
  EntityFieldOption,
  EntityObject,
  EntityObjectLink,
  EntityView,
  EntityWatcher,
} from '../types/entity-object'

/**
 * The pieces of the API surface that carry an app-specific shape. Everything
 * else in this client is identical between apps and is typed concretely below.
 */
export interface EntityApiShapes {
  /** Row shape in the list response. */
  summary: unknown
  /** Payload of the info endpoint. */
  details: unknown
  /** The app's object type. */
  object: EntityObject
  /** Payload of the single-object endpoint. */
  objectDetail: unknown
  /** Payload of the object-create endpoint. */
  objectCreated: unknown
  /** Body of the entity-create endpoint. */
  createRequest: unknown
  /** Body of the entity-update endpoint. */
  updateRequest: unknown
  /** Plural key the list and recommendation responses are keyed by. */
  listKey: string
}

export interface EntityApiConfig {
  request: AppClient
  endpoints: EntityEndpoints
  /**
   * Singular key the subscribe and unsubscribe payloads carry. The server names
   * the field after the resource ("crm", "project"), so it cannot be derived.
   */
  resourceKey: string
}

// Response types
export interface EntitySuccessResponse {
  data: {
    success: boolean
  }
}

export interface EntityCreateResponse {
  data: {
    id: string
    fingerprint: string
  }
}

export interface EntityViewListResponse {
  data: {
    views: EntityView[]
  }
}

export interface EntityViewCreateResponse {
  data: {
    id: string
    name: string
    viewtype: string
  }
}

export interface EntityObjectListResponse<TObject> {
  data: {
    objects: TObject[]
    watched?: string[]
  }
}

export interface EntityCommentListResponse {
  data: {
    comments: EntityComment[]
    count: number
  }
}

export interface EntityActivityListResponse {
  data: {
    activities: EntityActivity[]
  }
}

export interface EntityAttachmentListResponse {
  data: {
    attachments: EntityAttachment[]
  }
}

export interface EntityWatcherListResponse {
  data: {
    watchers: EntityWatcher[]
    watching: boolean
  }
}

export interface EntityLinkListResponse {
  data: {
    outgoing: EntityObjectLink[]
    incoming: EntityObjectLink[]
  }
}

export interface EntityMoveObjectRequest {
  /** Column field name (e.g. "status" or "column") */
  field?: string
  /** New column value */
  value?: string
  rank?: number
  /** Row field name (for swimlane moves) */
  row_field?: string
  /** New row value */
  row_value?: string
  /** Scope rank renumbering to siblings of this parent */
  scope_parent?: string
  /** "true" to clear parent (promote child to top-level) */
  promote?: string
}

export interface EntityCreateObjectRequest {
  class: string
  title?: string
  template?: string
  parent?: string
}

export interface EntityCreateViewRequest {
  name: string
  viewtype?: 'board' | 'list'
  filter?: string
  columns?: string
  rows?: string
  fields?: string
  sort?: string
  direction?: 'asc' | 'desc'
  classes?: string
  border?: string
}

export type EntityUpdateViewRequest = Partial<EntityCreateViewRequest>

export interface EntityClassListResponse {
  data: {
    classes: EntityClass[]
  }
}

export interface EntityClassCreateResponse {
  data: {
    id: string
    name: string
    sort: number
  }
}

export interface EntityCreateClassRequest {
  name: string
  title?: string
}

export interface EntityUpdateClassRequest {
  name?: string
  title?: string
}

export interface EntityHierarchyGetResponse {
  data: {
    parents: string[]
  }
}

export interface EntityFieldListResponse {
  data: {
    fields: EntityField[]
  }
}

export interface EntityFieldCreateResponse {
  data: {
    id: string
    name: string
    fieldtype: string
    sort: number
  }
}

export interface EntityCreateFieldRequest {
  name: string
  fieldtype?: string
  flags?: string
  multi?: string
  card?: string
  rows?: string
}

export interface EntityUpdateFieldRequest {
  id?: string
  name?: string
  flags?: string
  multi?: string
  card?: string
  min?: string
  max?: string
  pattern?: string
  minlength?: string
  maxlength?: string
  prefix?: string
  suffix?: string
  format?: string
  position?: string
  rows?: string
}

export interface EntityOptionListResponse {
  data: {
    options: EntityFieldOption[]
  }
}

export interface EntityOptionCreateResponse {
  data: {
    id: string
    name: string
    colour: string
    sort: number
  }
}

export interface EntityCreateOptionRequest {
  name: string
  colour?: string
  icon?: string
}

export interface EntityUpdateOptionRequest {
  name?: string
  colour?: string
  icon?: string
}

export interface EntityDirectoryEntry {
  id: string
  name: string
  fingerprint: string
  location?: string
}

export interface EntitySearchResponse {
  data: EntityDirectoryEntry[]
}

export function createEntityApi<TShapes extends EntityApiShapes>({
  request,
  endpoints,
  resourceKey,
}: EntityApiConfig) {
  type TObject = TShapes['object']
  return {

    // List all entities
    list: async (): Promise<{ data: Record<TShapes['listKey'], TShapes['summary'][]> }> => {
      return request.get(endpoints.list);
    },

    // Search for entities in the directory
    search: async (params: { search: string }): Promise<EntitySearchResponse> => {
      return request.get<EntitySearchResponse>(
        `${endpoints.search}?search=${encodeURIComponent(params.search)}`
      );
    },

    // Create a new entity
    create: async (
      data: TShapes['createRequest'],
    ): Promise<EntityCreateResponse> => {
      return request.post<EntityCreateResponse, TShapes['createRequest']>(
        endpoints.create,
        data,
      );
    },

    // Get entity details
    get: async (entityId: string): Promise<{ data: TShapes['details'] }> => {
      return request.get(endpoints.info(entityId));
    },

    // Update entity
    update: async (
      entityId: string,
      data: TShapes['updateRequest'],
    ): Promise<EntitySuccessResponse> => {
      return request.post<EntitySuccessResponse, TShapes['updateRequest']>(
        endpoints.update(entityId),
        data,
      );
    },

    // Delete entity
    delete: async (entityId: string): Promise<EntitySuccessResponse> => {
      return request.post<EntitySuccessResponse>(
        endpoints.delete(entityId),
      );
    },

    // List entity members (subscribers + owners)
    listPeople: async (
      entityId: string,
    ): Promise<{ data: { people: { id: string; name: string }[] } }> => {
      return request.get(endpoints.people(entityId));
    },

    // ============= Object Methods =============

    // List objects
    listObjects: async (
      entityId: string,
      params?: { class?: string; status?: string; parent?: string },
    ): Promise<EntityObjectListResponse<TObject>> => {
      const searchParams = new URLSearchParams();
      if (params?.class) searchParams.set("class", params.class);
      if (params?.status) searchParams.set("status", params.status);
      if (params?.parent !== undefined) searchParams.set("parent", params.parent);
      const query = searchParams.toString();
      const url =
        endpoints.objects(entityId) + (query ? `?${query}` : "");
      return request.get<EntityObjectListResponse<TObject>>(url);
    },

    // Create object
    createObject: async (
      entityId: string,
      data: EntityCreateObjectRequest,
    ): Promise<{ data: TShapes['objectCreated'] }> => {
      return request.post<{ data: TShapes['objectCreated'] }, EntityCreateObjectRequest>(
        endpoints.objectCreate(entityId),
        data,
      );
    },

    // Get object
    getObject: async (
      entityId: string,
      objectId: string,
    ): Promise<{ data: TShapes['objectDetail'] }> => {
      return request.get<{ data: TShapes['objectDetail'] }>(
        endpoints.object(entityId, objectId),
      );
    },

    // Update object
    updateObject: async (
      entityId: string,
      objectId: string,
      data: { parent?: string; class?: string },
    ): Promise<EntitySuccessResponse> => {
      return request.post<EntitySuccessResponse>(
        endpoints.objectUpdate(entityId, objectId),
        data,
      );
    },

    // Delete object
    deleteObject: async (
      entityId: string,
      objectId: string,
    ): Promise<EntitySuccessResponse> => {
      return request.post<EntitySuccessResponse>(
        endpoints.objectDelete(entityId, objectId),
      );
    },

    // Move object (change status - for drag-drop)
    moveObject: async (
      entityId: string,
      objectId: string,
      data: EntityMoveObjectRequest,
    ): Promise<EntitySuccessResponse> => {
      return request.post<EntitySuccessResponse, EntityMoveObjectRequest>(
        endpoints.objectMove(entityId, objectId),
        data,
      );
    },

    // Set multiple values
    setValues: async (
      entityId: string,
      objectId: string,
      values: Record<string, string>,
    ): Promise<EntitySuccessResponse> => {
      return request.post<EntitySuccessResponse>(
        endpoints.valuesSet(entityId, objectId),
        values,
      );
    },

    // Set single value
    setValue: async (
      entityId: string,
      objectId: string,
      field: string,
      value: string,
    ): Promise<EntitySuccessResponse> => {
      return request.post<EntitySuccessResponse>(
        endpoints.valueSet(entityId, objectId, field),
        { value },
      );
    },

    // ============= Link Methods =============

    // List links
    listLinks: async (
      entityId: string,
      objectId: string,
    ): Promise<EntityLinkListResponse> => {
      return request.get<EntityLinkListResponse>(
        endpoints.links(entityId, objectId),
      );
    },

    // Create link
    createLink: async (
      entityId: string,
      objectId: string,
      target: string,
      linktype: string,
    ): Promise<EntitySuccessResponse> => {
      return request.post<EntitySuccessResponse>(
        endpoints.linkCreate(entityId, objectId),
        { target, linktype },
      );
    },

    // Delete link
    deleteLink: async (
      entityId: string,
      objectId: string,
      target: string,
      linktype: string,
    ): Promise<EntitySuccessResponse> => {
      return request.post<EntitySuccessResponse>(
        endpoints.linkDelete(entityId, objectId),
        { target, linktype },
      );
    },

    // ============= Comment Methods =============

    // List comments
    listComments: async (
      entityId: string,
      objectId: string,
    ): Promise<EntityCommentListResponse> => {
      return request.get<EntityCommentListResponse>(
        endpoints.comments(entityId, objectId),
      );
    },

    // Create comment
    createComment: async (
      entityId: string,
      objectId: string,
      content: string,
      parent?: string,
      files?: File[],
      onProgress?: (event: AxiosProgressEvent) => void,
    ): Promise<{ data: EntityComment }> => {
      const formData = new FormData();
      formData.append("content", content);
      if (parent) formData.append("parent", parent);
      if (files) {
        files.forEach((file) => formData.append("files", file));
      }
      return request.post<{ data: EntityComment }>(
        endpoints.commentCreate(entityId, objectId),
        formData,
        { timeout: 0, onUploadProgress: onProgress },
      );
    },

    // Update comment
    updateComment: async (
      entityId: string,
      objectId: string,
      commentId: string,
      content: string,
    ): Promise<EntitySuccessResponse> => {
      return request.post<EntitySuccessResponse>(
        endpoints.commentUpdate(entityId, objectId, commentId),
        { content },
      );
    },

    // Delete comment
    deleteComment: async (
      entityId: string,
      objectId: string,
      commentId: string,
    ): Promise<EntitySuccessResponse> => {
      return request.post<EntitySuccessResponse>(
        endpoints.commentDelete(entityId, objectId, commentId),
      );
    },

    // ============= Activity Methods =============

    // List activity
    listActivity: async (
      entityId: string,
      objectId: string,
    ): Promise<EntityActivityListResponse> => {
      return request.get<EntityActivityListResponse>(
        endpoints.activity(entityId, objectId),
      );
    },

    // ============= Attachment Methods =============

    // Upload attachments
    uploadAttachments: async (
      entityId: string,
      objectId: string,
      files: File[],
      onProgress?: (event: AxiosProgressEvent) => void,
    ): Promise<EntityAttachmentListResponse> => {
      const formData = new FormData();
      for (const file of files) {
        formData.append("files", file);
      }
      return request.post(
        endpoints.attachmentCreate(entityId, objectId),
        formData,
        { timeout: 0, onUploadProgress: onProgress },
      );
    },

    // List attachments
    listAttachments: async (
      entityId: string,
      objectId: string,
    ): Promise<EntityAttachmentListResponse> => {
      return request.get<EntityAttachmentListResponse>(
        endpoints.attachments(entityId, objectId),
      );
    },

    // Delete attachment
    deleteAttachment: async (
      entityId: string,
      objectId: string,
      attachmentId: string,
    ): Promise<EntitySuccessResponse> => {
      return request.post<EntitySuccessResponse>(
        endpoints.attachmentDelete(entityId, objectId, attachmentId),
      );
    },

    // ============= Watcher Methods =============

    // List watchers
    listWatchers: async (
      entityId: string,
      objectId: string,
    ): Promise<EntityWatcherListResponse> => {
      return request.get<EntityWatcherListResponse>(
        endpoints.watchers(entityId, objectId),
      );
    },

    // Add watcher (self)
    addWatcher: async (
      entityId: string,
      objectId: string,
    ): Promise<EntitySuccessResponse & { data: { watching: boolean } }> => {
      return request.post<
        EntitySuccessResponse & { data: { watching: boolean } }
      >(endpoints.watcherAdd(entityId, objectId));
    },

    // Remove watcher (self)
    removeWatcher: async (
      entityId: string,
      objectId: string,
    ): Promise<EntitySuccessResponse & { data: { watching: boolean } }> => {
      return request.post<
        EntitySuccessResponse & { data: { watching: boolean } }
      >(endpoints.watcherRemove(entityId, objectId));
    },

    // ============= Design Import/Export Methods =============

    // Export design as template JSON
    exportDesign: async (
      entityId: string,
    ): Promise<{ data: Record<string, unknown> }> => {
      return request.get(endpoints.designExport(entityId));
    },

    // Import design from template JSON or built-in template ID
    importDesign: async (
      entityId: string,
      data: Record<string, unknown>,
      template?: string,
      templateVersion?: number,
    ): Promise<EntitySuccessResponse> => {
      const payload: Record<string, string> = {
        template: template || "",
        template_version: String(templateVersion || 0),
      };
      // Only send data if it has content (for file imports)
      // For built-in templates, the backend loads the template file by template ID
      if (Object.keys(data).length > 0) {
        payload.data = JSON.stringify(data);
      }
      return request.post<EntitySuccessResponse>(
        endpoints.designImport(entityId),
        payload,
      );
    },

    // ============= Data Import/Export Methods =============

    // Export data as a zip container: a manifest plus one entry per attachment.
    // Fetched as a blob because the attachment bytes never become JSON - the
    // server streams them into the archive rather than base64-encoding them.
    exportData: async (entityId: string): Promise<Blob> => {
      const response = await request.get<Blob>(
        endpoints.dataExport(entityId),
        { responseType: "blob" },
      );
      return response as unknown as Blob;
    },

    // Import data from JSON
    // Pre-fetch attachment bytes on the server before an export. Remote entities
    // fetch bytes over P2P in bounded rounds; loop until remaining is zero,
    // then call exportData.
    warmExport: async (
      entityId: string,
    ): Promise<{ data: { attachments: number; remaining: number } }> => {
      return request.post(endpoints.dataExportWarm(entityId), {});
    },

    // Import data from an export file. Uploaded as a multipart file part:
    // form fields cap out at a few megabytes at the HTTP layer, while file
    // parts spool to disk.
    importData: async (
      entityId: string,
      file: Blob,
      onProgress?: (event: AxiosProgressEvent) => void,
      design?: boolean,
    ): Promise<{ data: { objects: number; comments: number; attachments: number; links: number } }> => {
      const form = new FormData();
      form.append("file", file, "import.zip");
      // A container carries the design its objects were validated against, so a
      // restore applies both in one upload.
      if (design) form.append("design", "1");
      return request.post(endpoints.dataImport(entityId), form, {
        timeout: 0,
        onUploadProgress: onProgress,
      });
    },

    // ============= View Methods =============

    // List views
    listViews: async (entityId: string): Promise<EntityViewListResponse> => {
      return request.get<EntityViewListResponse>(
        endpoints.views(entityId),
      );
    },

    // Create view
    createView: async (
      entityId: string,
      data: EntityCreateViewRequest,
    ): Promise<EntityViewCreateResponse> => {
      return request.post<EntityViewCreateResponse, EntityCreateViewRequest>(
        endpoints.viewCreate(entityId),
        data,
      );
    },

    // Update view
    updateView: async (
      entityId: string,
      viewId: string,
      data: EntityUpdateViewRequest,
    ): Promise<EntitySuccessResponse> => {
      // Filter out undefined values before sending
      const cleanData: Record<string, string> = {};
      for (const [key, value] of Object.entries(data)) {
        if (value !== undefined && value !== null) {
          cleanData[key] = value;
        }
      }
      return request.post<EntitySuccessResponse, Record<string, string>>(
        endpoints.viewUpdate(entityId, viewId),
        cleanData,
      );
    },

    // Delete view
    deleteView: async (
      entityId: string,
      viewId: string,
    ): Promise<EntitySuccessResponse> => {
      return request.post<EntitySuccessResponse>(
        endpoints.viewDelete(entityId, viewId),
      );
    },

    // Reorder views
    reorderViews: async (
      entityId: string,
      order: string[],
    ): Promise<EntitySuccessResponse> => {
      return request.post<EntitySuccessResponse>(
        endpoints.viewReorder(entityId),
        { order: order.join(",") },
      );
    },

    // ============= Class Methods =============

    // List classes
    listClasses: async (entityId: string): Promise<EntityClassListResponse> => {
      return request.get<EntityClassListResponse>(
        endpoints.classes(entityId),
      );
    },

    // Create class
    createClass: async (
      entityId: string,
      data: EntityCreateClassRequest,
    ): Promise<EntityClassCreateResponse> => {
      return request.post<EntityClassCreateResponse, EntityCreateClassRequest>(
        endpoints.classCreate(entityId),
        data,
      );
    },

    // Update class
    updateClass: async (
      entityId: string,
      classId: string,
      data: EntityUpdateClassRequest,
    ): Promise<EntitySuccessResponse> => {
      return request.post<EntitySuccessResponse, EntityUpdateClassRequest>(
        endpoints.classUpdate(entityId, classId),
        data,
      );
    },

    // Delete class
    deleteClass: async (
      entityId: string,
      classId: string,
    ): Promise<EntitySuccessResponse> => {
      return request.post<EntitySuccessResponse>(
        endpoints.classDelete(entityId, classId),
      );
    },

    // ============= Hierarchy Methods =============

    // Get hierarchy
    getHierarchy: async (
      entityId: string,
      classId: string,
    ): Promise<EntityHierarchyGetResponse> => {
      return request.get<EntityHierarchyGetResponse>(
        endpoints.hierarchy(entityId, classId),
      );
    },

    // Set hierarchy
    setHierarchy: async (
      entityId: string,
      classId: string,
      parents: string[],
    ): Promise<EntitySuccessResponse> => {
      // Use _none_ to indicate empty list, since empty string means "can be root"
      const parentsStr = parents.length === 0 ? "_none_" : parents.join(",");
      return request.post<EntitySuccessResponse, { parents: string }>(
        endpoints.hierarchySet(entityId, classId),
        { parents: parentsStr },
      );
    },

    // ============= Field Methods =============

    // List fields
    listFields: async (
      entityId: string,
      classId: string,
    ): Promise<EntityFieldListResponse> => {
      return request.get<EntityFieldListResponse>(
        endpoints.fields(entityId, classId),
      );
    },

    // Create field
    createField: async (
      entityId: string,
      classId: string,
      data: EntityCreateFieldRequest,
    ): Promise<EntityFieldCreateResponse> => {
      return request.post<EntityFieldCreateResponse, EntityCreateFieldRequest>(
        endpoints.fieldCreate(entityId, classId),
        data,
      );
    },

    // Update field
    updateField: async (
      entityId: string,
      classId: string,
      fieldId: string,
      data: EntityUpdateFieldRequest,
    ): Promise<EntitySuccessResponse> => {
      return request.post<EntitySuccessResponse, EntityUpdateFieldRequest>(
        endpoints.fieldUpdate(entityId, classId, fieldId),
        data,
      );
    },

    // Delete field
    deleteField: async (
      entityId: string,
      classId: string,
      fieldId: string,
    ): Promise<EntitySuccessResponse> => {
      return request.post<EntitySuccessResponse>(
        endpoints.fieldDelete(entityId, classId, fieldId),
      );
    },

    // Reorder fields
    reorderFields: async (
      entityId: string,
      classId: string,
      order: string[],
    ): Promise<EntitySuccessResponse> => {
      return request.post<EntitySuccessResponse>(
        endpoints.fieldReorder(entityId, classId),
        { order: order.join(",") },
      );
    },

    // ============= Option Methods =============

    // List options
    listOptions: async (
      entityId: string,
      classId: string,
      fieldId: string,
    ): Promise<EntityOptionListResponse> => {
      return request.get<EntityOptionListResponse>(
        endpoints.options(entityId, classId, fieldId),
      );
    },

    // Create option
    createOption: async (
      entityId: string,
      classId: string,
      fieldId: string,
      data: EntityCreateOptionRequest,
    ): Promise<EntityOptionCreateResponse> => {
      return request.post<EntityOptionCreateResponse, EntityCreateOptionRequest>(
        endpoints.optionCreate(entityId, classId, fieldId),
        data,
      );
    },

    // Update option
    updateOption: async (
      entityId: string,
      classId: string,
      fieldId: string,
      optionId: string,
      data: EntityUpdateOptionRequest,
    ): Promise<EntitySuccessResponse> => {
      return request.post<EntitySuccessResponse, EntityUpdateOptionRequest>(
        endpoints.optionUpdate(entityId, classId, fieldId, optionId),
        data,
      );
    },

    // Delete option
    deleteOption: async (
      entityId: string,
      classId: string,
      fieldId: string,
      optionId: string,
    ): Promise<EntitySuccessResponse> => {
      return request.post<EntitySuccessResponse>(
        endpoints.optionDelete(entityId, classId, fieldId, optionId),
      );
    },

    // Reorder options
    reorderOptions: async (
      entityId: string,
      classId: string,
      fieldId: string,
      order: string[],
    ): Promise<EntitySuccessResponse> => {
      return request.post<EntitySuccessResponse>(
        endpoints.optionReorder(entityId, classId, fieldId),
        { order: order.join(",") },
      );
    },

    // ============================================================================
    // Remote entitys (Subscribe)
    // ============================================================================

    // Probe a remote entity by URL
    probe: async (
      url: string,
    ): Promise<{
      data: {
        id: string;
        name: string;
        description: string;
        prefix: string;
        fingerprint: string;
        class: string;
        server?: string;
        /** owner's peer from a mochi:// share-link probe; subscribe pins the same peer. */
        peer?: string;
        remote: boolean;
      };
    }> => {
      return request.post(endpoints.probe, { url });
    },

    // Get recommended entities
    recommendations: async (): Promise<{
      data: Record<
        TShapes['listKey'],
        Array<{
          id: string;
          name: string;
          blurb: string;
          fingerprint: string;
          server: string;
        }>
      >;
    }> => {
      return request.get(endpoints.recommendations);
    },

    // Subscribe to a remote entity
    subscribe: async (
      entityId: string,
      server?: string,
      peer?: string,
    ): Promise<{ data: { fingerprint: string } }> => {
      return request.post(endpoints.subscribe, {
        [resourceKey]: entityId,
        server,
        peer,
      });
    },

    // Produce a mochi://<peer>/<entity> share link for a entity the caller owns.
    share: async (
      entityId: string,
    ): Promise<{ data: { link: string; peer: string } }> => {
      return request.post(endpoints.share(entityId), {});
    },

    // Unsubscribe from a remote entity
    unsubscribe: async (
      entityId: string,
    ): Promise<{ data: { success: boolean } }> => {
      return request.post(endpoints.unsubscribe, {
        [resourceKey]: entityId,
      });
    },

    // ============================================================================
    // Access Control
    // ============================================================================

    // Get access rules for a entity
    getAccessRules: async (
      entityId: string,
    ): Promise<{
      data: {
        rules: AccessRule[];
        owner: { id: string; name: string };
      };
    }> => {
      return request.get(endpoints.access(entityId));
    },

    // Set access level for a subject
    setAccessLevel: async (
      entityId: string,
      subject: string,
      level: string,
    ): Promise<{ data: { success: boolean } }> => {
      return request.post(endpoints.accessSet(entityId), {
        subject,
        level,
      });
    },

    // Revoke access for a subject
    revokeAccess: async (
      entityId: string,
      subject: string,
    ): Promise<{ data: { success: boolean } }> => {
      return request.post(endpoints.accessRevoke(entityId), {
        subject,
      });
    },

    // Search users (for adding access rules)
    searchUsers: async (
      query: string,
    ): Promise<{ data: { results: { id: string; name: string; fingerprint: string }[] } }> => {
      return request.get(`${endpoints.usersSearch}?search=${encodeURIComponent(query)}`);
    },

    // List groups (for adding access rules)
    listGroups: async (): Promise<{ data: { groups: { id: string; name: string }[] } }> => {
      return request.get(endpoints.groups);
    },
  };
}
