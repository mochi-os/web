// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// Create-object sheet for the object/class/field apps.
//
// Two container ids, deliberately: `containerId` is the route parameter the
// object list is cached under, `recordId` is the entity record's own id that
// the write endpoints take. They are the same value today in both apps, but
// they come from different places and conflating them would hide it.


import { Trans } from '@lingui/react/macro'
import { t } from '@lingui/core/macro'
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Check, Paperclip, Upload, X } from "lucide-react";
import { useState, useMemo, useEffect, useRef, type ReactNode } from "react";
import type { AxiosProgressEvent } from "axios";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
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
import { Tooltip, TooltipTrigger, TooltipContent } from "../ui/tooltip";
import { ComposerAttachments } from "../comment-composer";
import { UploadProgress } from "../ui/upload-progress";
import { naturalCompare } from "../../lib/utils";
import { useImageObjectUrls } from "../../hooks/use-image-object-urls";
import { useUploadProgress } from "../../hooks/use-upload-progress";
import { removePendingFile } from "../../lib/attachment-utils";
import { mergePendingFiles } from "../../lib/composer-files";
import { moveItem } from "../../lib/reorder";
import { rankBetween, rankCompare } from "../../lib/rank";
import { EntityFieldEditor } from "./entity-field-editor";
import type { EntityDesign, EntityObject } from "../../types/entity-object";

export interface EntityCreateObjectDialogProps<TObject extends EntityObject> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Route parameter the object list is cached under. */
  containerId: string;
  /** The entity record's own id, which the write endpoints take. */
  recordId: string;
  design: EntityDesign;
  /** Readable-id prefix, when the app issues them. */
  prefix?: string;
  defaultFields?: { field: string; value: string }[];
  defaultParent?: string;
  allowedClasses?: string[];
  onCreated?: (id: string, number?: number, readable?: string) => void;
  /** Screen-reader only sheet title and description; each app words its own. */
  srTitle: ReactNode;
  srDescription: ReactNode;
  /** Turns the shared fields into the app's object type for the cache write. */
  buildObject: (base: EntityObject) => TObject;
  listObjects: (
    containerId: string,
  ) => Promise<{ data: { objects: TObject[]; watched?: string[] } }>;
  listPeople: (
    containerId: string,
  ) => Promise<{ data: { people: { id: string; name: string }[] } }>;
  createObject: (
    recordId: string,
    data: { class: string; title?: string; parent?: string },
  ) => Promise<{
    data: { id: string; number?: number; readable?: string; parent?: string };
  }>;
  setValue: (
    recordId: string,
    objectId: string,
    fieldId: string,
    value: string,
  ) => Promise<unknown>;
  uploadAttachments: (
    recordId: string,
    objectId: string,
    files: File[],
    onProgress?: (event: AxiosProgressEvent) => void,
  ) => Promise<unknown>;
  searchUsers: (
    query: string,
  ) => Promise<{ data: { results: { id: string; name: string; fingerprint: string }[] } }>;
}

export function EntityCreateObjectDialog<TObject extends EntityObject>({
  open,
  onOpenChange,
  containerId,
  recordId,
  design,
  prefix,
  defaultFields,
  defaultParent,
  allowedClasses,
  onCreated,
  srTitle,
  srDescription,
  buildObject,
  listObjects,
  listPeople,
  createObject,
  setValue,
  uploadAttachments,
  searchUsers,
}: EntityCreateObjectDialogProps<TObject>) {
  const [error, setError] = useState<string | null>(null);
  const [selectedClass, setSelectedType] = useState(design.classes[0]?.id || "");
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [parent, setParent] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const pendingFilePreviewUrls = useImageObjectUrls(pendingFiles);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { progress: uploadProgress, upload } = useUploadProgress();

  // Filter classes to those allowed by the current view
  const availableClasses = useMemo(() => {
    return allowedClasses?.length
      ? design.classes.filter((c) => allowedClasses.includes(c.id))
      : design.classes;
  }, [allowedClasses, design.classes]);

  // Load objects for parent selection (shares cache with design page)
  const { data: objectListData } = useQuery({
    queryKey: ["objects", containerId],
    queryFn: async () => {
      const response = await listObjects(containerId);
      return response.data;
    },
  });
  const objectsData = objectListData?.objects;

  // Filter out classes that require a parent but have no valid parent objects
  const creatableClasses = useMemo(() => {
    if (!objectsData) return availableClasses;
    return availableClasses.filter((cls) => {
      const parentClasses = design.hierarchy[cls.id] || [];
      if (parentClasses.length === 0 || parentClasses.includes("")) return true;
      const parentClassIds = parentClasses.filter((t) => t !== "");
      return objectsData.some((obj) => parentClassIds.includes(obj.class));
    });
  }, [availableClasses, design.hierarchy, objectsData]);

  // A value is usable for a class's field when the field exists there and,
  // for enumerated fields, the value is one of that class's options. Board
  // defaults come from whichever class the board renders, so on a
  // multi-class view (e.g. the tickets template: ticket + task with
  // different status sets) a default can be invalid for the class actually
  // selected here — the server rejects it with "Invalid option" (#467).
  const usableValue = (classId: string, fieldId: string, value: string) => {
    const field = (design.fields[classId] || []).find((f) => f.id === fieldId);
    if (!field) return false;
    if (field.fieldtype !== "enumerated") return true;
    return (design.options[classId]?.[fieldId] || []).some((o) => o.id === value);
  };

  const resetRef = useRef({ creatableClasses, defaultFields, defaultParent, design, usableValue });
  resetRef.current = { creatableClasses, defaultFields, defaultParent, design, usableValue };
  useEffect(() => {
    if (open) {
      const { creatableClasses, defaultFields, defaultParent, design, usableValue } = resetRef.current;
      const initialType = creatableClasses[0]?.id || "";
      setSelectedType(initialType);
      setParent(defaultParent || "");
      setPendingFiles([]);
      setError(null);
      // Initialize field values with defaults valid for the initial class
      const initialValues: Record<string, string> = {};
      if (defaultFields) {
        for (const df of defaultFields) {
          if (usableValue(initialType, df.field, df.value)) {
            initialValues[df.field] = df.value;
          }
        }
      }
      // Auto-select first option for required enumerated fields
      const fields = design.fields[initialType] || [];
      const opts = design.options[initialType] || {};
      for (const f of fields) {
        if (f.fieldtype === "enumerated" && f.flags?.split(",").includes("required") && !initialValues[f.id]) {
          const fieldOpts = opts[f.id] || [];
          if (fieldOpts.length > 0) {
            initialValues[f.id] = fieldOpts[0].id;
          }
        }
      }
      setFieldValues(initialValues);
    }
  }, [open]);

  useEffect(() => {
    if (!open || creatableClasses.length === 0) return;
    if (!creatableClasses.some((c) => c.id === selectedClass)) {
      setSelectedType(creatableClasses[0].id);
    }
  }, [open, creatableClasses, selectedClass]);

  // When the class changes: drop values that aren't usable for the new class
  // (an enumerated value carried over from another class would be rejected by
  // the server), re-apply the usable defaults, and auto-select the first
  // option for any required enumerated field left empty.
  useEffect(() => {
    if (!selectedClass) return;
    setFieldValues((prev) => {
      const next: Record<string, string> = {};
      for (const [fieldId, value] of Object.entries(prev)) {
        if (usableValue(selectedClass, fieldId, value)) {
          next[fieldId] = value;
        }
      }
      if (defaultFields) {
        for (const df of defaultFields) {
          if (usableValue(selectedClass, df.field, df.value)) {
            next[df.field] = df.value;
          }
        }
      }
      const fields = design.fields[selectedClass] || [];
      const opts = design.options[selectedClass] || {};
      for (const f of fields) {
        if (f.fieldtype === "enumerated" && f.flags?.split(",").includes("required") && !next[f.id]) {
          const fieldOpts = opts[f.id] || [];
          if (fieldOpts.length > 0) {
            next[f.id] = fieldOpts[0].id;
          }
        }
      }
      return next;
    });
  }, [selectedClass, defaultFields, design.fields, design.options]);

  // Fetch design members for the owner picker
  const { data: peopleData } = useQuery({
    queryKey: ["people", containerId],
    queryFn: async () => {
      const response = await listPeople(containerId);
      return response.data.people;
    },
    staleTime: 60000,
  });

  // Get fields and options for selected type
  const classFields = useMemo(() => {
    return design.fields[selectedClass] || [];
  }, [design.fields, selectedClass]);

  const classOptions = useMemo(() => {
    return design.options[selectedClass] || {};
  }, [design.options, selectedClass]);

  const missingRequired = classFields.some(
    (f) => f.flags?.split(",").includes("required") && !fieldValues[f.id]?.trim(),
  );

  // Get display title for any object using its class's title field
  const objectTitle = (obj: {
    class: string;
    number?: number;
    values: Record<string, string>;
  }) => {
    const cls = design.classes.find((c) => c.id === obj.class);
    const title = (cls?.title ? obj.values[cls.title] : "") || "";
    if (title) return title;
    return prefix !== undefined && typeof obj.number === "number"
      ? `${prefix}-${obj.number}`
      : t`Untitled`;
  };

  // Filter objects to only show valid parents based on hierarchy rules
  const allowedParentClasses = useMemo(() => {
    return design.hierarchy[selectedClass] || [];
  }, [design.hierarchy, selectedClass]);

  const canBeTopLevel = allowedParentClasses.includes("");
  const parentRequired = !canBeTopLevel && allowedParentClasses.length > 0;

  // Human-readable names for required parent classes (used in "no parents" message)
  const parentClassNames = useMemo(() => {
    return allowedParentClasses
      .filter((t) => t !== "")
      .map((id) => design.classes.find((c) => c.id === id)?.name || id)
      .join(t` or `);
  }, [allowedParentClasses, design.classes]);

  const validParentOptions = useMemo(() => {
    if (!objectsData || !selectedClass) return [];

    const parentClassIds = allowedParentClasses.filter((t) => t !== "");
    if (parentClassIds.length === 0) return [];

    return objectsData
      .filter((obj) => parentClassIds.includes(obj.class))
      .sort((a, b) => naturalCompare(objectTitle(a), objectTitle(b)));
  }, [objectsData, selectedClass, allowedParentClasses]);

  // Get current parent object info
  const currentParent = useMemo(() => {
    if (!parent || !objectsData) return null;
    return objectsData.find((obj) => obj.id === parent);
  }, [parent, objectsData]);

  const createMutation = useMutation({
    mutationFn: async () => {
      // Find the title field from the class
      const selectedCls = design.classes.find((c) => c.id === selectedClass);
      const titleFieldId = selectedCls?.title;

      // Create the object
      const response = await createObject(recordId, {
        class: selectedClass,
        title: titleFieldId ? fieldValues[titleFieldId] || undefined : undefined,
        parent: parent || undefined,
      });

      // Set all field values (skip title — already sent in create call)
      const objectId = response.data.id;
      const validFields = new Set((design.fields[selectedClass] || []).map((f) => f.id));
      for (const [fieldId, value] of Object.entries(fieldValues)) {
        if (fieldId !== titleFieldId && value && validFields.has(fieldId)) {
          await setValue(recordId, objectId, fieldId, value);
        }
      }

      // Upload any attached files
      if (pendingFiles.length > 0) {
        await upload(
          (onProgress) =>
            uploadAttachments(recordId, objectId, pendingFiles, onProgress),
          { sizes: pendingFiles.map((file) => file.size) },
        );
      }

      return {
        ...response.data,
        fieldValues,
        parent,
      };
    },
    onSuccess: (data) => {
      // Add new object to cache immediately for instant UI update
      queryClient.setQueryData(
        ["objects", containerId],
        (old: { objects: TObject[]; watched?: string[] } | undefined) => {
          const maxRank = old?.objects.reduce(
            (max, o) => (max === null || rankCompare(o.rank, max) > 0 ? o.rank : max),
            null as string | null,
          ) ?? null;
          const newObject = buildObject({
            id: data.id,
            class: selectedClass,
            number: data.number,
            parent: data.parent || "",
            rank: rankBetween(maxRank, null),
            created: Math.floor(Date.now() / 1000),
            updated: Math.floor(Date.now() / 1000),
            values: { ...fieldValues },
          });
          if (!old) return { objects: [newObject], watched: [] };
          return { ...old, objects: [...old.objects, newObject] };
        },
      );
      queryClient.invalidateQueries({
        queryKey: ["objects", containerId],
      });
      onCreated?.(data.id, data.number, data.readable);
      onOpenChange(false);
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    createMutation.mutate();
  };

  const handleFieldChange = (fieldId: string, value: string) => {
    setFieldValues((prev) => ({ ...prev, [fieldId]: value }));
  };

  // Auto-select first parent when parent is required, preferring one in the same column
  useEffect(() => {
    if (open && parentRequired && !parent && validParentOptions.length > 0) {
      if (defaultFields && defaultFields.length > 0) {
        const columnParent = validParentOptions.find((obj) =>
          defaultFields.every((df) => obj.values[df.field] === df.value),
        );
        if (columnParent) {
          setParent(columnParent.id);
          return;
        }
      }
      setParent(validParentOptions[0].id);
    }
  }, [open, parentRequired, parent, validParentOptions, defaultFields]);

  const handleTypeChange = (newType: string) => {
    setSelectedType(newType);
    setParent("");
    // Reset field values but keep defaults if applicable
    const newValues: Record<string, string> = {};
    if (defaultFields) {
      const newTypeFields = design.fields[newType] || [];
      for (const df of defaultFields) {
        if (newTypeFields.some((f) => f.id === df.field)) {
          newValues[df.field] = df.value;
        }
      }
    }
    // Auto-select first option for required enumerated fields
    const fields = design.fields[newType] || [];
    const opts = design.options[newType] || {};
    for (const f of fields) {
      if (f.fieldtype === "enumerated" && f.flags?.split(",").includes("required") && !newValues[f.id]) {
        const fieldOpts = opts[f.id] || [];
        if (fieldOpts.length > 0) {
          newValues[f.id] = fieldOpts[0].id;
        }
      }
    }
    setFieldValues(newValues);
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={handleClose} modal={false}>
      <SheetContent className="w-full sm:max-w-2xl p-0 gap-0 [&>button:last-child]:hidden" onOpenAutoFocus={(event) => event.preventDefault()}>
        <SheetHeader className="sr-only">
          <SheetTitle>{srTitle}</SheetTitle>
          <SheetDescription>{srDescription}</SheetDescription>
        </SheetHeader>
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b shrink-0">
          <div className="flex items-center gap-2 flex-1">
            {creatableClasses.length > 0 ? (
              <>
                <Label className="text-xl font-bold"><Trans>New</Trans></Label>
                <Select value={selectedClass} onValueChange={handleTypeChange}>
                  <SelectTrigger className="w-auto h-auto py-1 px-2 text-xl font-bold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="z-[60]">
                    {creatableClasses.map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            ) : (
              <Label className="text-xl font-bold"><Trans>Create</Trans></Label>
            )}
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleClose}
                aria-label={t`Close`}
              >
                <X className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t`Close`}</TooltipContent>
          </Tooltip>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-2xl space-y-6">
              {creatableClasses.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  <Trans>No item types can be created yet. Create the required parent items first.</Trans>
                </p>
              )}

              {/* Parent picker */}
              {(validParentOptions.length > 0 || parentRequired) && (
                <div className="grid grid-cols-[120px_1fr] gap-4 items-start">
                  <label className="text-sm font-medium text-muted-foreground pt-2">
                    <Trans>Parent</Trans>
                  </label>
                  {validParentOptions.length > 0 ? (
                    <Select
                      value={parent || "_none_"}
                      onValueChange={(v) => setParent(v === "_none_" ? "" : v)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={t`None`}>
                          {currentParent
                            ? objectTitle(currentParent)
                            : t`None`}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="z-[60]">
                        {!parentRequired && <SelectItem value="_none_"><Trans>None</Trans></SelectItem>}
                        {validParentOptions.map((obj) => (
                          <SelectItem key={obj.id} value={obj.id}>
                            {objectTitle(obj)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-sm text-muted-foreground pt-2">
                      {t`No ${parentClassNames} to add to`}
                    </p>
                  )}
                </div>
              )}

              {/* Dynamic fields based on selected type */}
              {classFields.map((field, index) => {
                  const isFirstTextField = field.fieldtype === "text" && classFields.findIndex((f) => f.fieldtype === "text") === index;
                  return (
                  <div key={field.id} className="grid grid-cols-[120px_1fr] gap-4 items-start">
                    <label className="text-sm font-medium text-muted-foreground pt-2">
                      {field.name}
                    </label>
                    <EntityFieldEditor
                      field={field}
                      value={fieldValues[field.id] || ""}
                      options={classOptions[field.id] || []}
                      onChange={(value) => handleFieldChange(field.id, value)}
                      disabled={createMutation.isPending}
                      autoFocus={isFirstTextField}
                      immediate
                      hideLabel
                      localPeople={peopleData}
                      searchUsers={async (q) => (await searchUsers(q)).data.results}
                    />
                  </div>
                  );
                })}

              {/* File attachments */}
              <div className="grid grid-cols-[120px_1fr] gap-4 items-start">
                <label className="text-sm font-medium text-muted-foreground pt-2 flex items-center gap-1.5">
                  <Paperclip className="size-3.5" />
                  <Trans>Files</Trans>
                </label>
                <div className="space-y-2 pt-1">
                  <ComposerAttachments
                    files={pendingFiles}
                    previewUrls={pendingFilePreviewUrls}
                    // The object is created first and the files uploaded after,
                    // so the tiles sit inert for a moment before they start
                    // filling. That gap is the record being written, not a stall.
                    state={createMutation.isPending ? "uploading" : "idle"}
                    progress={uploadProgress?.slices}
                    onRemove={(file) =>
                      setPendingFiles((prev) => removePendingFile(prev, file))
                    }
                    onReorder={(from, to) =>
                      setPendingFiles((prev) => moveItem(prev, from, to))
                    }
                  />
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      // Copy the FileList before clearing the input: it is
                      // live, so resetting the value empties it, and a state
                      // updater React defers (which it does as soon as the
                      // hook has a pending update, e.g. after removing a
                      // staged file) would then read no files at all and
                      // silently drop the pick.
                      const picked = Array.from(e.target.files ?? []);
                      e.target.value = "";
                      if (picked.length > 0) {
                        setPendingFiles((prev) => mergePendingFiles(prev, picked));
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={createMutation.isPending}
                  >
                    <Upload className="size-3 me-1.5" />
                    <Trans>Upload</Trans>
                  </Button>
                </div>
              </div>

              {error && (
                <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                  {error}
                </div>
              )}
            </div>
          </div>

          <UploadProgress progress={uploadProgress} className="px-6 pb-2" />
          <SheetFooter className="px-6 py-4 border-t">
            <Button type="submit" disabled={createMutation.isPending || (parentRequired && !parent) || missingRequired || creatableClasses.length === 0}>
              <Check className="size-4" />
              {createMutation.isPending ? t`Creating...` : t`Create`}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
