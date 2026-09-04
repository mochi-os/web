// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// The object detail sheet for the object/class/field apps (crm, projects). Both
// apps carried a copy of this; 325 of the smaller file's 472 code lines matched.
// Every network call arrives on one `api` prop, which both apps satisfy by
// passing the object `createEntityApi` returns.
//
// The two things the apps do differently are driven by data, not by flags:
// the readable-id line appears when the object has a `readable`, and the
// merge-requests tab arrives through `extraTabs`.

import { useState, useEffect, useRef, useMemo, type ReactNode } from "react";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, Trash2, MessageSquare, Activity, Settings2 } from "lucide-react";
import { Button } from "../ui/button";
import { ConfirmDialog } from "../confirm-dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "../ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { ListSkeleton } from "../ui/list-skeleton";
import { GeneralError } from "../../features/errors/general-error";
import { cn, naturalCompare } from "../../lib/utils";
import { toast } from "../../lib/toast-utils";
import { getErrorMessage } from "../../lib/handle-server-error";
import { textUnchanged } from "../../lib/change-detection";
import { entityObjectTitle, type EntityTitleObject } from "../../lib/entity-title";
import { canWrite, canComment } from "../../lib/entity-access";
import { useShellOverlay } from "../../hooks/use-shell-overlay";
import { EntityFieldEditor } from "./entity-field-editor";
import { EntityCommentList, type EntityCommentListProps } from "./entity-comment-list";
import { EntityActivityList, type EntityActivityListProps } from "./entity-activity-list";
import {
  EntityObjectAttachments,
  type EntityObjectAttachmentsProps,
} from "./entity-object-attachments";
import { EntityObjectLinks, type EntityObjectLinksProps } from "./entity-object-links";
import { getAppPath } from "../../lib/app-path";
import type { Person } from "../person-picker";
import type {
  EntityAccess,
  EntityDesign,
  EntityObject,
  EntityObjectLink,
} from "../../types/entity-object";

/** What `getObject` has to return. Apps may return more; the panel reads this. */
export interface EntityObjectDetail<TObject extends EntityObject> {
  object: TObject;
  values: Record<string, string>;
  outgoing: EntityObjectLink[];
  incoming: EntityObjectLink[];
  watching: boolean;
  comment_count: number;
}

/** A tab an app adds between Comments and Activity. */
export interface EntityObjectDetailTab {
  id: string;
  label: string;
  icon: ReactNode;
  /** Rendered only while this tab is the active one. */
  content: ReactNode;
}

/** The calls the panel makes itself. The rest come from the children's props. */
interface EntityObjectDetailOwnApi<
  TObject extends EntityObject,
  TDetail extends EntityObjectDetail<TObject>,
> {
  getObject: (containerId: string, objectId: string) => Promise<{ data: TDetail }>;
  setValue: (
    containerId: string,
    objectId: string,
    field: string,
    value: string,
  ) => Promise<unknown>;
  updateObject: (
    containerId: string,
    objectId: string,
    data: { parent: string },
  ) => Promise<unknown>;
  deleteObject: (containerId: string, objectId: string) => Promise<unknown>;
  addWatcher: (containerId: string, objectId: string) => Promise<unknown>;
  removeWatcher: (containerId: string, objectId: string) => Promise<unknown>;
  // Raw shape, as createEntityApi returns it. The panel unwraps `.data.results`
  // for the field editor, which each app's own binding used to do.
  searchUsers: (
    query: string,
  ) => Promise<{
    data: { results: { id: string; name: string; fingerprint: string }[] };
  }>;
}

/**
 * Everything the panel and its children call. Both apps' api objects satisfy
 * it structurally, so an app passes its whole api rather than 18 functions.
 */
export type EntityObjectDetailPanelApi<
  TObject extends EntityObject,
  TDetail extends EntityObjectDetail<TObject>,
> = EntityObjectDetailOwnApi<TObject, TDetail> &
  Pick<
    EntityCommentListProps,
    "listComments" | "listPeople" | "createComment" | "updateComment" | "deleteComment"
  > &
  Pick<EntityActivityListProps, "listActivity"> &
  Pick<
    EntityObjectAttachmentsProps,
    "listAttachments" | "uploadAttachments" | "deleteAttachment"
  > &
  Pick<EntityObjectLinksProps<TObject>, "listObjects" | "createLink" | "deleteLink">;

export interface EntityObjectDetailPanelProps<
  TObject extends EntityObject,
  TDetail extends EntityObjectDetail<TObject>,
> {
  containerId: string;
  objectId: string | null;
  design: EntityDesign;
  access: EntityAccess;
  api: EntityObjectDetailPanelApi<TObject, TDetail>;
  /** Readable-id prefix (e.g. "PROJ"). Omit in apps that do not number objects. */
  prefix?: string;
  /** Extra tabs, inserted between Comments and Activity. */
  extraTabs?: (detail: TDetail) => EntityObjectDetailTab[];
  onClose: () => void;
}

export function EntityObjectDetailPanel<
  TObject extends EntityObject,
  TDetail extends EntityObjectDetail<TObject>,
>({
  containerId,
  objectId,
  design,
  access,
  api,
  prefix,
  extraTabs,
  onClose,
}: EntityObjectDetailPanelProps<TObject, TDetail>) {
  useShellOverlay(!!objectId);
  const [activeTab, setActiveTab] = useState<string>("properties");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  // Hold the heavy tab body behind a skeleton until the 500ms slide-in settles:
  // cold queries resolving mid-slide reflow the animating layer and stutter it.
  const [slideSettled, setSlideSettled] = useState(false);
  const queryClient = useQueryClient();

  // Closing is never blocked on an invalid date: the field never commits one,
  // and an emptied input fires no change event, so a guard could latch and
  // never release.
  const handleClose = () => {
    onClose();
  };

  const placeholderFromObjectsCache = (): TDetail | undefined => {
    const cached = queryClient.getQueryData<{
      objects: TObject[];
      watched?: string[];
    }>(["objects", containerId]);
    if (!cached || !objectId) return undefined;
    const obj = cached.objects.find((o) => o.id === objectId);
    if (!obj) return undefined;
    // The cached list carries no readable id, so rebuild it from the prefix
    // for the placeholder frame. Without this the header's readable line and
    // anything an extra tab reads off it blink empty until the fetch lands.
    const readable =
      obj.readable ??
      (prefix !== undefined && typeof obj.number === "number"
        ? `${prefix}-${obj.number}`
        : undefined);
    return {
      object: readable ? { ...obj, readable } : obj,
      values: obj.values,
      outgoing: [],
      incoming: [],
      watching: cached.watched?.includes(objectId) ?? false,
      comment_count: 0,
    } as unknown as TDetail;
  };

  const { data, isPlaceholderData, isLoading, error, refetch } = useQuery({
    queryKey: ["object", containerId, objectId],
    queryFn: async () => {
      if (!objectId) throw new Error("No object ID");
      const response = await api.getObject(containerId, objectId);
      return response.data;
    },
    enabled: !!objectId,
    // Use the cached objects list as placeholder so the panel renders at once.
    // The cast is TanStack's NonFunctionGuard: it rejects a function-valued
    // placeholder, and it cannot prove a generic TDetail is not one, so the
    // lazy form has to be smuggled past the guard. It is still called as a
    // function at runtime, which is what TanStack checks.
    placeholderData: placeholderFromObjectsCache as never,
  });

  // Reveal the tab body once the open slide (500ms, see sheet.tsx) has settled.
  // Only defer on a real closed -> open transition, which is the one that plays
  // the slide; switching directly from one object to another keeps the sheet in
  // place with no animation, so it should swap content immediately.
  const previousObjectId = useRef<string | null>(null);
  useEffect(() => {
    const wasClosed = previousObjectId.current === null;
    previousObjectId.current = objectId;
    if (!objectId) {
      setSlideSettled(false);
      return;
    }
    if (!wasClosed) {
      setSlideSettled(true);
      return;
    }
    setSlideSettled(false);
    const timer = setTimeout(() => setSlideSettled(true), 500);
    return () => clearTimeout(timer);
  }, [objectId]);

  // When opening a different object, default to comments if it has any.
  const tabInitializedFor = useRef<string | null>(null);
  useEffect(() => {
    if (objectId !== tabInitializedFor.current && data && !isPlaceholderData) {
      tabInitializedFor.current = objectId;
      setActiveTab(data.comment_count > 0 ? "comments" : "properties");
    }
  }, [objectId, data, isPlaceholderData]);

  const { data: peopleData } = useQuery({
    queryKey: ["people", containerId],
    queryFn: async () => {
      const response = await api.listPeople(containerId);
      return response.data.people;
    },
    staleTime: 60000,
  });

  // All objects, for the parent picker. Shares the container page's cache.
  const { data: objectListData } = useQuery({
    queryKey: ["objects", containerId],
    queryFn: async () => {
      const response = await api.listObjects(containerId);
      return response.data;
    },
  });
  const objectsData = objectListData?.objects;

  const updateValueMutation = useMutation({
    mutationFn: async ({ field, value }: { field: string; value: string }) => {
      if (!objectId) return;
      await api.setValue(containerId, objectId, field, value);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["object", containerId, objectId] });
      queryClient.invalidateQueries({ queryKey: ["objects", containerId] });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, t`Failed to save`));
    },
  });

  const watchMutation = useMutation({
    mutationFn: async (watching: boolean) => {
      if (!objectId) return;
      return watching
        ? api.removeWatcher(containerId, objectId)
        : api.addWatcher(containerId, objectId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["object", containerId, objectId] });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, t`Failed to update watching`));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!objectId) return;
      return api.deleteObject(containerId, objectId);
    },
    onSuccess: () => {
      setShowDeleteDialog(false);
      queryClient.invalidateQueries({ queryKey: ["objects", containerId] });
      requestAnimationFrame(() => onClose());
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, t`Failed to delete`));
    },
  });

  const updateParentMutation = useMutation({
    mutationFn: async (newParent: string) => {
      if (!objectId) return;
      return api.updateObject(containerId, objectId, { parent: newParent });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["object", containerId, objectId] });
      queryClient.invalidateQueries({ queryKey: ["objects", containerId] });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, t`Failed to move`));
    },
  });

  // Parents allowed by the hierarchy, minus this object and its descendants.
  // Sorted here rather than in the JSX so the render does not copy an array.
  const validParentOptions = useMemo(() => {
    if (!objectsData || !data) return [];

    const object = data.object;
    const parentClassIds = (design.hierarchy[object.class] || []).filter((c) => c !== "");
    if (parentClassIds.length === 0) return [];

    const descendants = new Set<string>();
    const findDescendants = (id: string) => {
      descendants.add(id);
      for (const obj of objectsData) {
        if (obj.parent === id && !descendants.has(obj.id)) {
          findDescendants(obj.id);
        }
      }
    };
    findDescendants(object.id);

    return objectsData
      .filter((obj) => parentClassIds.includes(obj.class) && !descendants.has(obj.id))
      .sort((a, b) =>
        naturalCompare(
          entityObjectTitle(a, design.classes, prefix),
          entityObjectTitle(b, design.classes, prefix),
        ),
      );
  }, [objectsData, data, design.hierarchy, design.classes, prefix]);

  const currentParent = useMemo(() => {
    if (!data?.object.parent || !objectsData) return null;
    return objectsData.find((obj) => obj.id === data.object.parent);
  }, [data, objectsData]);

  if (!objectId) {
    return null;
  }

  if (isLoading) {
    return (
      <Sheet open={true} onOpenChange={handleClose}>
        <SheetContent className="w-full sm:max-w-2xl p-0 gap-0" onInteractOutside={() => {}}>
          <SheetHeader className="sr-only">
            <SheetTitle><Trans>Loading item</Trans></SheetTitle>
            <SheetDescription><Trans>Loading item details</Trans></SheetDescription>
          </SheetHeader>
          <div className="p-6">
            <ListSkeleton variant="simple" height="h-12" count={3} />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  if (error || !data) {
    return (
      <Sheet open={true} onOpenChange={handleClose}>
        <SheetContent className="w-full sm:max-w-2xl p-6" onInteractOutside={() => {}}>
          <SheetHeader className="sr-only">
            <SheetTitle><Trans>Error</Trans></SheetTitle>
            <SheetDescription><Trans>Failed to load item</Trans></SheetDescription>
          </SheetHeader>
          <GeneralError
            error={error ?? new Error(t`Failed to load item`)}
            minimal
            mode="inline"
            reset={() => {
              void refetch();
            }}
          />
        </SheetContent>
      </Sheet>
    );
  }

  const object = data.object;
  const classFields = design.fields[object.class] || [];
  const classOptions = design.options[object.class] || {};
  const cls = design.classes.find((c) => c.id === object.class);
  const titleField = cls?.title ? classFields.find((f) => f.id === cls.title) : undefined;
  const title = entityObjectTitle(object, design.classes, prefix);
  const objectTitle = (obj: EntityTitleObject) =>
    entityObjectTitle(obj, design.classes, prefix);

  const appTabs = extraTabs ? extraTabs(data) : [];
  const tabs: { id: string; label: string; icon: ReactNode }[] = [
    { id: "properties", label: t`Properties`, icon: <Settings2 className="size-4" /> },
    {
      id: "comments",
      label: t`Comments (${data.comment_count || 0})`,
      icon: <MessageSquare className="size-4" />,
    },
    ...appTabs.map((tab) => ({ id: tab.id, label: tab.label, icon: tab.icon })),
    { id: "activity", label: t`Activity`, icon: <Activity className="size-4" /> },
  ];
  const activeExtraTab = appTabs.find((tab) => tab.id === activeTab);

  const handleFieldChange = (fieldId: string, value: string) => {
    if (textUnchanged(value, data.values[fieldId] ?? "")) return;
    updateValueMutation.mutate({ field: fieldId, value });
  };

  const searchUsers = async (query: string) =>
    (await api.searchUsers(query)).data.results;

  // A member's avatar and accent through the app's own user-asset route: the
  // picker cannot fetch the people app from inside the shell. Both apps mount
  // the route at the same path under the container.
  const personAsset = (person: Person, asset: "avatar" | "style") =>
    `${getAppPath()}/${containerId}/-/user/${person.id}/asset/${asset}`;

  return (
    <Sheet open={true} onOpenChange={handleClose}>
      <SheetContent
        className="w-full sm:max-w-3xl p-0 gap-0 [&>button:last-child]:hidden"
        onInteractOutside={() => {}}
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <SheetHeader className="sr-only">
          <SheetTitle><Trans>Item details</Trans></SheetTitle>
          <SheetDescription><Trans>View and edit item details</Trans></SheetDescription>
        </SheetHeader>
        {/* Header. The readable id shows only in apps that issue one. */}
        <div className="flex items-center gap-3 px-6 py-4 border-b shrink-0">
          <div className="flex flex-col md:flex-row md:items-baseline gap-0.5 md:gap-2 flex-1 min-w-0">
            <h2 className="text-xl font-bold leading-tight line-clamp-2 md:truncate min-w-0">
              {title}
            </h2>
            {object.readable && (
              <>
                <span className="hidden md:block shrink-0 text-muted-foreground">·</span>
                <span
                  data-testid="entity-readable"
                  className="text-xs md:text-sm text-muted-foreground shrink-0 whitespace-nowrap"
                >
                  {object.readable}
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => watchMutation.mutate(data.watching)}
                  disabled={watchMutation.isPending}
                  aria-label={data.watching ? t`Stop watching` : t`Watch`}
                >
                  {data.watching ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{data.watching ? t`Stop watching` : t`Watch`}</TooltipContent>
            </Tooltip>
            {canWrite(access) && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground"
                    onClick={() => setShowDeleteDialog(true)}
                    aria-label={t`Delete item`}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t`Delete item`}</TooltipContent>
              </Tooltip>
            )}
            <Button variant="outline" size="sm" className="h-8" onClick={handleClose}>
              <Trans>Done</Trans>
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b shrink-0">
          <div className="flex gap-1 px-6 overflow-x-auto no-scrollbar">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "relative flex shrink-0 items-center gap-2 px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors",
                  activeTab === tab.id
                    ? "text-foreground after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content — deferred until the open slide settles so cold queries
            don't reflow the animating panel (first-open jank). */}
        <div className="flex-1 overflow-y-auto p-6">
          {!slideSettled ? (
            <div className="max-w-2xl space-y-6">
              <ListSkeleton variant="simple" height="h-12" count={4} />
            </div>
          ) : (
            <>
              <div className="max-w-2xl space-y-6" hidden={activeTab !== "properties"}>
                {titleField && (
                  <div className="grid grid-cols-[120px_1fr] gap-4 items-start">
                    <label className="text-sm font-medium text-muted-foreground pt-2">
                      {titleField.name}
                    </label>
                    <EntityFieldEditor
                      field={titleField}
                      value={data.values[titleField.id] || ""}
                      options={classOptions[titleField.id] || []}
                      onChange={(value) => handleFieldChange(titleField.id, value)}
                      readOnly={!canWrite(access)}
                      hideLabel
                      localPeople={peopleData}
                      searchUsers={searchUsers}
                      personAsset={personAsset}
                    />
                  </div>
                )}

                {(validParentOptions.length > 0 || currentParent) && (
                  <div className="grid grid-cols-[120px_1fr] gap-4 items-start">
                    <label className="text-sm font-medium text-muted-foreground pt-2">
                      <Trans>Parent</Trans>
                    </label>
                    {!canWrite(access) ? (
                      <span className="text-sm h-9 flex items-center">
                        {currentParent ? objectTitle(currentParent) : t`None`}
                      </span>
                    ) : (
                      <Select
                        value={object.parent || "_none_"}
                        onValueChange={(value) => {
                          const newParent = value === "_none_" ? "" : value;
                          if (textUnchanged(newParent, object.parent ?? "")) return;
                          updateParentMutation.mutate(newParent);
                        }}
                        disabled={updateParentMutation.isPending}
                      >
                        <SelectTrigger className="w-full" aria-label={t`Parent`}>
                          <SelectValue placeholder={t`None`}>
                            {currentParent ? objectTitle(currentParent) : t`None`}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_none_"><Trans>None</Trans></SelectItem>
                          {validParentOptions.map((obj) => (
                            <SelectItem key={obj.id} value={obj.id}>
                              {objectTitle(obj)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                )}

                {classFields
                  .filter((f) => f.id !== cls?.title)
                  .map((field) => (
                    <div
                      key={field.id}
                      className="grid grid-cols-[120px_1fr] gap-4 items-start"
                    >
                      <label className="text-sm font-medium text-muted-foreground pt-2">
                        {field.name}
                      </label>
                      <EntityFieldEditor
                        field={field}
                        value={data.values[field.id] || ""}
                        options={classOptions[field.id] || []}
                        onChange={(value) => handleFieldChange(field.id, value)}
                        readOnly={!canWrite(access)}
                        hideLabel
                        localPeople={peopleData}
                        searchUsers={searchUsers}
                        personAsset={personAsset}
                      />
                    </div>
                  ))}

                <EntityObjectAttachments
                  containerId={containerId}
                  objectId={objectId}
                  readOnly={!canWrite(access)}
                  listAttachments={api.listAttachments}
                  uploadAttachments={api.uploadAttachments}
                  deleteAttachment={api.deleteAttachment}
                />

                <EntityObjectLinks
                  containerId={containerId}
                  objectId={objectId}
                  outgoing={data.outgoing}
                  incoming={data.incoming}
                  prefix={prefix}
                  classes={design.classes}
                  readOnly={!canWrite(access)}
                  listObjects={api.listObjects}
                  createLink={api.createLink}
                  deleteLink={api.deleteLink}
                />
              </div>

              {activeExtraTab && (
                <div className="max-w-2xl">{activeExtraTab.content}</div>
              )}

              {/* Comments stay mounted so the draft survives tab switches —
                  same pattern as the properties tab. */}
              <div className="max-w-2xl" hidden={activeTab !== "comments"}>
                <EntityCommentList
                  containerId={containerId}
                  objectId={objectId}
                  readOnly={!canComment(access)}
                  listComments={api.listComments}
                  listPeople={api.listPeople}
                  createComment={api.createComment}
                  updateComment={api.updateComment}
                  deleteComment={api.deleteComment}
                />
              </div>

              {activeTab === "activity" && (
                <div className="max-w-2xl">
                  <EntityActivityList
                    containerId={containerId}
                    objectId={objectId}
                    fields={classFields}
                    listActivity={api.listActivity}
                  />
                </div>
              )}
            </>
          )}
        </div>

        <ConfirmDialog
          open={showDeleteDialog}
          onOpenChange={setShowDeleteDialog}
          title={t`Delete item`}
          desc={t`Are you sure you want to delete "${title}"? This action cannot be undone.`}
          confirmText={t`Delete`}
          destructive
          isLoading={deleteMutation.isPending}
          handleConfirm={() => deleteMutation.mutate()}
        />
      </SheetContent>
    </Sheet>
  );
}
