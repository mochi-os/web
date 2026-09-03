// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// Threaded comment list and composer for the object/class/field apps. The four
// API calls arrive as props; the module behind them is per-app.


import { useCallback, useEffect, useState, useRef } from "react";
import { useLingui } from '@lingui/react/macro'
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageSquare } from "lucide-react";
import type { AxiosProgressEvent } from "axios";
import { EmptyState } from "../ui/empty-state";
import { ListSkeleton } from "../ui/list-skeleton";
import { toast } from "../../lib/toast-utils";
import { ENTITY_LIMIT } from "../../lib/entity-api";
import { getErrorMessage } from "../../lib/handle-server-error";
import { useAttachmentError } from "../../hooks/use-attachment-error";
import { useAuthStore } from "../../stores/auth-store";
import { useUploadProgress } from "../../hooks/use-upload-progress";
import { textUnchanged } from "../../lib/change-detection";
import { findCommentTextInTree } from "../../lib/comment-tree";
import {
  CommentBox,
  useDiscardGuard,
} from "../comment-composer";
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
  // The comment box owns its files and reports their count; it is always on
  // screen, so clearing it means remounting it (the key), not closing it.
  const [newFileCount, setNewFileCount] = useState(0);
  const [composerKey, setComposerKey] = useState(0);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState("");
  const [isSendingComment, setIsSendingComment] = useState(false);

  const [replyFileCount, setReplyFileCount] = useState(0);
  const pendingReplyTarget = useRef<string | null>(null);

  const clearComposer = useCallback(() => {
    setNewComment("");
    setNewFileCount(0);
    setComposerKey((key) => key + 1);
  }, []);

  useEffect(() => {
    clearComposer();
    setReplyingTo(null);
    setReplyDraft("");
    setReplyFileCount(0);
  }, [objectId, clearComposer]);
  const queryClient = useQueryClient();
  const currentUserId = useAuthStore((s) => s.identity);
  const { progress: uploadProgress, upload } = useUploadProgress();
  const attachmentError = useAttachmentError();

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
        return upload(
          (onProgress) =>
            createComment(
              containerId,
              objectId,
              content,
              parent,
              files,
              onProgress,
            ),
          { sizes: files.map((file) => file.size) },
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
      toast.error(attachmentError(err, t`Failed to post comment`));
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

  // Rejects on failure so the box keeps the draft and its attachments staged
  // for Retry; the mutation already reported it.
  const handleCreate = async (content: string, files?: File[]) => {
    setIsSendingComment(true);
    try {
      await createMutation.mutateAsync({ content, files });
      setNewComment("");
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

  // The page composer is always on screen, so there is nothing to close —
  // discarding clears it in place.
  const hasDraft = newComment.trim().length > 0 || newFileCount > 0;

  const { requestClose, discardDialog } = useDiscardGuard({
    hasText: newComment.trim().length > 0,
    hasFiles: newFileCount > 0,
    onDiscard: clearComposer,
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
        <div>
          <CommentBox
            key={composerKey}
            value={newComment}
            onValueChange={setNewComment}
            onSubmit={handleCreate}
            maxLength={ENTITY_LIMIT.comment}
            // Cancel only once there is something to discard.
            onClose={hasDraft ? requestClose : undefined}
            onFilesChange={setNewFileCount}
            people={people}
            progress={uploadProgress}
            placeholder={t`Add a comment...`}
            rows={3}
          />
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
