// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// Attachment gallery and file list for one object in the object/class/field
// apps. Images and videos go in the gallery, everything else in the file list.
// The three API calls arrive as props; the module behind them is per-app.


import { useState, useRef } from "react";
import { Trans, useLingui } from '@lingui/react/macro'
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Download, Loader2, Paperclip, Trash2, Upload } from "lucide-react";
import type { AxiosProgressEvent } from "axios";
import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentGroup,
  AttachmentMedia,
  AttachmentTitle,
  AttachmentTrigger,
} from "../ui/attachment";
import { AttachmentComposer } from "../attachment-composer";
import { AttachmentGallery } from "../attachment-gallery";
import { Button } from "../ui/button";
import { ConfirmDialog } from "../confirm-dialog";
import { UploadProgress } from "../ui/upload-progress";
import { Tooltip, TooltipTrigger, TooltipContent } from "../ui/tooltip";
import { getAppPath } from "../../lib/app-path";
import { useFormat } from "../../hooks/use-format";
import { useImageObjectUrls } from "../../hooks/use-image-object-urls";
import {
  isImage,
  isVideo,
  getFileIcon,
  pendingFileKey,
} from "../../lib/attachment-utils";
import { getErrorMessage } from "../../lib/handle-server-error";
import { authenticatedUrl } from "../../lib/shell-bridge";
import { toast } from "../../lib/toast-utils";
import { useUploadProgress } from "../../hooks/use-upload-progress";
import type { EntityAttachment as AttachmentData } from "../../types/entity-object";

export interface EntityObjectAttachmentsProps {
  containerId: string;
  objectId: string;
  readOnly: boolean;
  listAttachments: (
    containerId: string,
    objectId: string,
  ) => Promise<{ data: { attachments: AttachmentData[] } }>;
  uploadAttachments: (
    containerId: string,
    objectId: string,
    files: File[],
    onProgress?: (event: AxiosProgressEvent) => void,
  ) => Promise<unknown>;
  deleteAttachment: (
    containerId: string,
    objectId: string,
    attachmentId: string,
  ) => Promise<unknown>;
}

export function EntityObjectAttachments({
  containerId,
  objectId,
  readOnly,
  listAttachments,
  uploadAttachments,
  deleteAttachment,
}: EntityObjectAttachmentsProps) {
  const { t } = useLingui()
  const [deleteTarget, setDeleteTarget] = useState<AttachmentData | null>(null);
  // This field has no staging step — the picker uploads straight away — so the
  // files being sent are held here for the life of the request, purely to have
  // something to draw the per-file progress on.
  const [inFlight, setInFlight] = useState<File[]>([]);
  const inFlightPreviews = useImageObjectUrls(inFlight);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { formatFileSize } = useFormat();
  const { progress: uploadProgress, upload } = useUploadProgress();

  const { data, isLoading } = useQuery({
    queryKey: ["attachments", containerId, objectId],
    queryFn: async () => {
      const response = await listAttachments(containerId, objectId);
      return response.data.attachments;
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      return upload(
        (onProgress) =>
          uploadAttachments(containerId, objectId, files, onProgress),
        { sizes: files.map((file) => file.size) },
      );
    },
    // Awaited, so the in-flight tiles stay up until the refreshed gallery is in
    // the cache. Clearing them the moment the response lands would blank the
    // field for as long as the refetch takes.
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["attachments", containerId, objectId],
      });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, t`Failed to upload attachment`));
    },
    onSettled: () => setInFlight([]),
  });

  const deleteMutation = useMutation({
    mutationFn: async (attachmentId: string) => {
      return deleteAttachment(containerId, objectId, attachmentId);
    },
    onSuccess: () => {
      setDeleteTarget(null);
      queryClient.invalidateQueries({
        queryKey: ["attachments", containerId, objectId],
      });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, t`Failed to delete attachment`));
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const picked = Array.from(files);
      setInFlight(picked);
      uploadMutation.mutate(picked);
    }
    e.target.value = "";
  };

  const basePath = `${getAppPath()}/${containerId}/-/attachments/`;
  const attUrl = (id: string, suffix = "") => authenticatedUrl(`${basePath}${id}${suffix}`);
  const attachments: AttachmentData[] = data || [];
  const images = attachments.filter((a) => isImage(a.type) || isVideo(a.type));
  const files = attachments.filter((a) => !isImage(a.type) && !isVideo(a.type));

  if (isLoading) {
    return (
      <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-4 items-start">
        <label className="text-sm font-medium text-muted-foreground pt-2 flex items-center gap-1.5">
          <Paperclip className="size-3.5" />
          <Trans>Files</Trans>
        </label>
        <div className="flex items-center gap-2 pt-2">
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (attachments.length === 0 && readOnly) {
    return null;
  }

  // minmax(0,1fr): a plain 1fr floors at the column's min-content width, so a
  // wide gallery row or a long file name pushes the whole panel sideways
  // instead of wrapping inside the column.
  return (
    <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-4 items-start">
      <label className="text-sm font-medium text-muted-foreground pt-2 flex items-center gap-1.5">
        <Paperclip className="size-3.5" />
        <Trans>Files</Trans>
      </label>
      <div className="min-w-0 space-y-2 pt-1">
        {images.length > 0 && (
          <AttachmentGallery
            attachments={images}
            getUrl={(att) => attUrl(att.id)}
            getThumbnailUrl={(att) => attUrl(att.id, "/thumbnail")}
            rowHeight={80}
            hideFiles
            renderMediaOverlay={
              readOnly
                ? undefined
                : (att) => (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="absolute -top-1.5 -right-1.5 hidden group-hover/item:flex size-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            setDeleteTarget(att as AttachmentData)
                          }}
                          aria-label={t`Delete`}
                        >
                          <Trash2 className="size-3" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>{t`Delete`}</TooltipContent>
                    </Tooltip>
                  )
            }
          />
        )}
        {files.length > 0 && (
          <AttachmentGroup layout="grid">
            {files.map((file) => {
              const FileIcon = getFileIcon(file.type);
              return (
                <Attachment key={file.id} size="sm">
                  <AttachmentTrigger asChild>
                    <a href={attUrl(file.id)} download={file.name}>
                      <span className="sr-only">{file.name}</span>
                    </a>
                  </AttachmentTrigger>
                  <AttachmentMedia>
                    <FileIcon />
                  </AttachmentMedia>
                  <AttachmentContent>
                    <AttachmentTitle>{file.name}</AttachmentTitle>
                    <AttachmentDescription>
                      {formatFileSize(file.size)}
                    </AttachmentDescription>
                  </AttachmentContent>
                  <AttachmentActions>
                    <AttachmentAction
                      asChild
                      variant="ghost"
                      size="icon"
                      className="opacity-0 group-hover/attachment:opacity-100 focus-within:opacity-100 text-muted-foreground hover:text-foreground"
                    >
                      <a href={attUrl(file.id)} download={file.name}>
                        <Download className="size-3" />
                        <span className="sr-only">
                          <Trans>Download</Trans>
                        </span>
                      </a>
                    </AttachmentAction>
                    {!readOnly && (
                      <AttachmentAction
                        variant="ghost"
                        size="icon"
                        className="opacity-0 group-hover/attachment:opacity-100 focus-within:opacity-100 text-muted-foreground hover:text-destructive"
                        onClick={() => setDeleteTarget(file)}
                      >
                        <Trash2 className="size-3" />
                        <span className="sr-only">
                          <Trans>Delete</Trans>
                        </span>
                      </AttachmentAction>
                    )}
                  </AttachmentActions>
                </Attachment>
              );
            })}
          </AttachmentGroup>
        )}
        {!readOnly && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileChange}
            />
            {/* Neither removable nor reorderable: the bytes are already going. */}
            <AttachmentComposer
              items={inFlight.map((file, i) => ({
                key: pendingFileKey(file),
                name: file.name,
                size: file.size,
                type: file.type,
                previewUrl: inFlightPreviews[i],
                progress: uploadProgress?.slices?.[i],
              }))}
              layout="grid"
              preview="tile"
              state="uploading"
            />
            <UploadProgress progress={uploadProgress} />
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadMutation.isPending}
            >
              {uploadMutation.isPending ? (
                <Loader2 className="size-3 me-1.5 animate-spin" />
              ) : (
                <Upload className="size-3 me-1.5" />
              )}
              <Trans>Upload</Trans>
            </Button>
          </>
        )}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={t`Delete attachment`}
        desc={t`Are you sure you want to delete "${deleteTarget?.name}"?`}
        confirmText={t`Delete`}
        destructive
        isLoading={deleteMutation.isPending}
        handleConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
        }}
      />
    </div>
  );
}
