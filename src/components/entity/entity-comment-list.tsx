// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// Threaded comment list and composer for the object/class/field apps. The four
// API calls arrive as props; the module behind them is per-app.


import { useCallback, useEffect, useState, useRef } from "react";
import { useLingui } from '@lingui/react/macro'
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, MessageSquare, Paperclip, Send, X } from "lucide-react";
import type { AxiosProgressEvent } from "axios";
import { Button } from "../ui/button";
import { EmptyState } from "../ui/empty-state";
import { ListSkeleton } from "../ui/list-skeleton";
import { MentionTextarea } from "../mention-textarea";
import { Tooltip, TooltipTrigger, TooltipContent } from "../ui/tooltip";
import { UploadProgress } from "../ui/upload-progress";
import { toast } from "../../lib/toast-utils";
import { getErrorMessage } from "../../lib/handle-server-error";
import { useAuthStore } from "../../stores/auth-store";
import { useImageObjectUrls } from "../../hooks/use-image-object-urls";
import { useUploadProgress } from "../../hooks/use-upload-progress";
import { textUnchanged } from "../../lib/change-detection";
import { findCommentTextInTree } from "../../lib/comment-tree";
import { cn } from "../../lib/utils";
import { removePendingFile } from "../../lib/attachment-utils";
import {
  ComposerAttachments,
  SendShortcutHint,
  dropActiveClass,
  offlineBlocked,
  useComposerDrop,
  useDiscardGuard,
} from "../comment-composer";
import { mergePendingFiles } from "../../lib/composer-files";
import { EntityCommentThread } from "./entity-comment-thread";
import type { EntityComment } from "../../types/entity-object";

export interface EntityCommentListProps {
  containerId: string;
  objectId: string;
  readOnly?: boolean;
  listComments: (
    containerId: string,
    objectId: string,
  ) => Promise<{ data: { comments: EntityComment[]; count: number } }>;
  listPeople: (
    containerId: string,
  ) => Promise<{ data: { people: { id: string; name: string }[] } }>;
  createComment: (
    containerId: string,
    objectId: string,
    content: string,
    parent?: string,
    files?: File[],
    onProgress?: (event: AxiosProgressEvent) => void,
  ) => Promise<unknown>;
  updateComment: (
    containerId: string,
    objectId: string,
    commentId: string,
    content: string,
  ) => Promise<unknown>;
  deleteComment: (
    containerId: string,
    objectId: string,
    commentId: string,
  ) => Promise<unknown>;
}

export function EntityCommentList({
  containerId,
  objectId,
  readOnly,
  listComments,
  listPeople,
  createComment,
  updateComment,
  deleteComment,
}: EntityCommentListProps) {
  const { t } = useLingui()
  const [newComment, setNewComment] = useState("");
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const newFileImageUrls = useImageObjectUrls(newFiles);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [createFailed, setCreateFailed] = useState(false);
  const [isSendingComment, setIsSendingComment] = useState(false);

  const [replyFileCount, setReplyFileCount] = useState(0);
  const pendingReplyTarget = useRef<string | null>(null);

  const addNewFiles = useCallback((incoming: File[]) => {
    setCreateFailed(false);
    setNewFiles((prev) => mergePendingFiles(prev, incoming));
  }, []);

  // Editing the draft after a failure means the red attachments and the Retry
  // button no longer describe what is in the box.
  const handleNewCommentChange = useCallback((value: string) => {
    setNewComment(value);
    setCreateFailed(false);
  }, []);

  useEffect(() => {
    setNewComment("");
    setNewFiles([]);
    setCreateFailed(false);
    setReplyingTo(null);
    setReplyDraft("");
    setReplyFileCount(0);
  }, [objectId]);
  const queryClient = useQueryClient();
  const currentUserId = useAuthStore((s) => s.identity);
  const { progress: uploadProgress, upload } = useUploadProgress();

  const { data, isLoading } = useQuery({
    queryKey: ["comments", containerId, objectId],
    queryFn: async () => {
      const response = await listComments(containerId, objectId);
      return response.data;
    },
  });

  const { data: peopleData } = useQuery({
    queryKey: ["people", containerId],
    queryFn: async () => {
      const response = await listPeople(containerId);
      return response.data.people;
    },
    staleTime: 60000,
  });
  const people = peopleData ?? [];

  const createMutation = useMutation({
    mutationFn: async ({
      content,
      parent,
      files,
    }: {
      content: string;
      parent?: string;
      files?: File[];
    }) => {
      if (files?.length) {
        return upload((onProgress) =>
          createComment(
            containerId,
            objectId,
            content,
            parent,
            files,
            onProgress,
          ),
        );
      }
      return createComment(containerId, objectId, content, parent, files);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["comments", containerId, objectId],
      });
      queryClient.invalidateQueries({
        queryKey: ["object", containerId, objectId],
      });
    },
    onError: (err) => {
      toast.error(getErrorMessage(err, t`Failed to post comment`));
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      commentId,
      content,
    }: {
      commentId: string;
      content: string;
    }) => {
      return updateComment(containerId, objectId, commentId, content);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["comments", containerId, objectId],
      });
    },
    onError: (err) => {
      toast.error(getErrorMessage(err, t`Failed to update comment`));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (commentId: string) => {
      return deleteComment(containerId, objectId, commentId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["comments", containerId, objectId],
      });
      queryClient.invalidateQueries({
        queryKey: ["object", containerId, objectId],
      });
    },
    onError: (err) => {
      toast.error(getErrorMessage(err, t`Failed to delete comment`));
    },
  });

  const handleCreate = async () => {
    const trimmed = newComment.trim();
    if (!trimmed || isSendingComment || offlineBlocked()) return;
    setCreateFailed(false);
    setIsSendingComment(true);
    try {
      await createMutation.mutateAsync({
        content: trimmed,
        files: newFiles.length > 0 ? newFiles : undefined,
      });
      setNewComment("");
      setNewFiles([]);
    } catch {
      // The mutation already reported it; keep the draft and its attachments
      // staged so Retry sends the same comment again.
      setCreateFailed(true);
    } finally {
      setIsSendingComment(false);
    }
  };

  const handleReply = async (parentId: string, files?: File[]) => {
    const trimmed = replyDraft.trim();
    if (!trimmed) return;
    await createMutation.mutateAsync({
      content: trimmed,
      parent: parentId,
      files,
    });
    setReplyingTo(null);
    setReplyDraft("");
  };

  const handleEdit = (commentId: string, content: string) => {
    const original = findCommentTextInTree(data?.comments ?? [], commentId, {
      getId: (c) => c.id,
      getText: (c) => c.content,
      getChildren: (c) => c.children,
    });
    if (original !== undefined && textUnchanged(content, original)) {
      return;
    }
    updateMutation.mutate({ commentId, content });
  };

  const handleDelete = (commentId: string) => {
    deleteMutation.mutate(commentId);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addNewFiles(Array.from(e.target.files));
    }
    e.target.value = "";
  };

  const { isDragActive, dropzoneProps } = useComposerDrop({
    onFiles: addNewFiles,
    disabled: isSendingComment,
  });

  // The page composer is always on screen, so there is nothing to close —
  // discarding clears it in place.
  const discardNewComment = useCallback(() => {
    setNewComment("");
    setNewFiles([]);
    setCreateFailed(false);
  }, []);

  const hasDraft = newComment.trim().length > 0 || newFiles.length > 0;

  const { requestClose, discardDialog } = useDiscardGuard({
    hasText: newComment.trim().length > 0,
    hasFiles: newFiles.length > 0,
    onDiscard: discardNewComment,
    locked: isSendingComment,
  });

  const startReply = useCallback((commentId: string) => {
    setReplyingTo(commentId);
    setReplyFileCount(0);
    const selected = window.getSelection()?.toString().trim();
    if (selected) {
      const quoted = selected.split("\n").map((line) => `> ${line}`).join("\n") + "\n\n";
      setReplyDraft(quoted);
    } else {
      setReplyDraft("");
    }
  }, []);

  const cancelReply = useCallback(() => {
    setReplyingTo(null);
    setReplyDraft("");
    setReplyFileCount(0);
  }, []);

  // Opening another comment's reply box throws the current draft away, so it
  // asks first, exactly like closing the box does. The guard lives here rather
  // than in the thread because the comment being replied to is not the one
  // whose Reply button was clicked.
  const { requestClose: requestReplySwitch, discardDialog: replySwitchDialog } =
    useDiscardGuard({
      hasText: replyDraft.trim().length > 0,
      hasFiles: replyFileCount > 0,
      onDiscard: () => {
        const next = pendingReplyTarget.current;
        pendingReplyTarget.current = null;
        if (next) startReply(next);
        else cancelReply();
      },
    });

  const handleStartReply = useCallback(
    (commentId: string) => {
      if (replyingTo && replyingTo !== commentId) {
        pendingReplyTarget.current = commentId;
        requestReplySwitch();
        return;
      }
      startReply(commentId);
    },
    [replyingTo, requestReplySwitch, startReply],
  );

  if (isLoading) {
    return <ListSkeleton count={3} variant="simple" height="h-12" />;
  }

  const comments = data?.comments ?? [];

  return (
    <div className="space-y-4">
      {!readOnly && (
        <div
          className={cn("space-y-2", isDragActive && dropActiveClass)}
          {...dropzoneProps}
        >
          <MentionTextarea
            className="placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            value={newComment}
            onValueChange={handleNewCommentChange}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void handleCreate();
              } else if (e.key === "Escape") {
                requestClose();
              }
            }}
            placeholder={t`Add a comment...`}
            rows={3}
            disabled={isSendingComment}
            people={people}
          />
          <ComposerAttachments
            files={newFiles}
            previewUrls={newFileImageUrls}
            state={
              isSendingComment ? "uploading" : createFailed ? "error" : "idle"
            }
            onRemove={(file) =>
              setNewFiles((prev) => removePendingFile(prev, file))
            }
            // Retry sends the draft, so it is only offered while there is one.
            onRetry={
              newComment.trim() ? () => void handleCreate() : undefined
            }
          />
          {isSendingComment && <UploadProgress progress={uploadProgress} />}
          <div className="flex items-center justify-end gap-2">
            <SendShortcutHint />
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isSendingComment}
                  aria-label={t`Attach comment files`}
                >
                  <Paperclip className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t`Attach comment files`}</TooltipContent>
            </Tooltip>
            {hasDraft && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={requestClose}
                    disabled={isSendingComment}
                    aria-label={t`Cancel comment`}
                  >
                    <X className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t`Cancel comment`}</TooltipContent>
              </Tooltip>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="icon"
                  className="size-8"
                  disabled={!newComment.trim() || isSendingComment}
                  onClick={() => void handleCreate()}
                  aria-label={t`Submit comment`}
                >
                  {isSendingComment ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Send className="size-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t`Submit comment`}</TooltipContent>
            </Tooltip>
          </div>
          {discardDialog}
        </div>
      )}

      {comments.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title={t`No comments yet`}
          description={t`Start the discussion by adding the first comment.`}
          className="py-4"
        />
      ) : (
        <div className="space-y-1">
          {comments.map((comment) => (
            <EntityCommentThread
              key={comment.id}
              comment={comment}
              containerId={containerId}
              currentUserId={currentUserId}
              readOnly={!!readOnly}
              people={people}
              replyingTo={replyingTo}
              replyDraft={replyDraft}
              onStartReply={handleStartReply}
              onCancelReply={cancelReply}
              onReplyDraftChange={setReplyDraft}
              onReplyFilesChange={setReplyFileCount}
              onSubmitReply={handleReply}
              uploadProgress={uploadProgress}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
      {replySwitchDialog}
    </div>
  );
}
