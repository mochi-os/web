// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// Recursive threaded comment for the object/class/field apps. Actions are
// hover-revealed inline on desktop and collapsed behind a dropdown below the md
// breakpoint, where there is no hover to reveal them with.


import { useCallback, useEffect, useState } from "react";
import { Trans } from '@lingui/react/macro'
import { t, plural } from '@lingui/core/macro'
import { Check, MoreHorizontal, Pencil, Reply, Trash2 } from "lucide-react";
import { Button } from "../ui/button";
import { CommentTreeLayout } from "../comment-tree-layout";
import { ConfirmDialog } from "../confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { EntityAvatar } from "../entity-avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { useFormat } from "../../hooks/use-format";
import { getAppPath } from "../../lib/app-path";
import { MentionTextarea, renderMentions } from "../mention-textarea";
import { ENTITY_LIMIT } from "../../lib/entity-api";
import { textUnchanged } from "../../lib/change-detection";
import {
  CommentBox,
  useDiscardGuard,
} from "../comment-composer";
import type { Upload } from "../../hooks/use-upload-progress";
import { EntityCommentAttachments } from "./entity-comment-attachments";
import type { EntityComment } from "../../types/entity-object";

interface Person {
  id: string;
  name: string;
}

export interface EntityCommentThreadProps {
  comment: EntityComment;
  containerId: string;
  currentUserId?: string;
  readOnly: boolean;
  replyingTo: string | null;
  replyDraft: string;
  onStartReply: (commentId: string) => void;
  onCancelReply: () => void;
  onReplyDraftChange: (value: string) => void;
  /** Reports how many files this comment has staged while it is the one being
   * replied to, so the list can warn before a switch throws them away. */
  onReplyFilesChange?: (count: number) => void;
  onSubmitReply: (commentId: string, files?: File[]) => void | Promise<void>;
  /** Byte progress of the reply upload, when the caller tracks it */
  uploadProgress?: Upload | null;
  onEdit: (commentId: string, content: string) => void;
  onDelete: (commentId: string) => void;
  people?: Person[];
  depth?: number;
}

export function EntityCommentThread({
  comment,
  containerId,
  currentUserId,
  readOnly,
  replyingTo,
  replyDraft,
  onStartReply,
  onCancelReply,
  onReplyDraftChange,
  onReplyFilesChange,
  onSubmitReply,
  uploadProgress,
  onEdit,
  onDelete,
  people = [],
  depth = 0,
}: EntityCommentThreadProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editBody, setEditBody] = useState("");
  const [deleting, setDeleting] = useState(false);
  // The reply box owns its files and reports their count; the guard here and
  // the one in the list (which arbitrates switching between reply boxes) read
  // it. The box mounts only while replying, so closing drops the files.
  const [replyFileCount, setReplyFileCount] = useState(0);
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);
  const { formatTimestamp } = useFormat();

  const isReplying = replyingTo === comment.id;

  // Rejects on failure so the box keeps its files for Retry; the mutation
  // already reported it.
  const handleSubmitReply = useCallback(
    async (_body: string, files?: File[]) => {
      setIsSubmittingReply(true);
      try {
        await onSubmitReply(comment.id, files);
      } finally {
        setIsSubmittingReply(false);
      }
    },
    [onSubmitReply, comment.id],
  );

  const handleReplyFilesChange = useCallback(
    (count: number) => {
      setReplyFileCount(count);
      onReplyFilesChange?.(count);
    },
    [onReplyFilesChange],
  );

  useEffect(() => {
    if (!isReplying) setReplyFileCount(0);
  }, [isReplying]);

  const { requestClose: requestCloseReply, discardDialog } = useDiscardGuard({
    hasText: replyDraft.trim().length > 0,
    hasFiles: replyFileCount > 0,
    onDiscard: onCancelReply,
    locked: isSubmittingReply,
  });

  const hasChildren = comment.children && comment.children.length > 0;
  const canEdit = currentUserId === comment.author && !readOnly;
  const canDelete = currentUserId === comment.author && !readOnly;

  const getTotalDescendants = (c: EntityComment): number => {
    if (!c.children) return 0;
    return (
      c.children.length +
      c.children.reduce((acc, child) => acc + getTotalDescendants(child), 0)
    );
  };
  const totalDescendants = getTotalDescendants(comment);

  const timestamp = formatTimestamp(comment.created);

  const assetUrl = (slot: string) =>
    `${getAppPath()}/${containerId}/-/comment/${comment.id}/asset/${slot}`;
  const avatar = (
    <EntityAvatar
      src={assetUrl("avatar")}
      styleUrl={assetUrl("style")}
      seed={comment.author}
      name={comment.name || comment.author}
      size="xs"
      className="z-10"
    />
  );

  const collapsedContent = (
    <div className="flex h-5 items-center gap-2 py-0.5 text-xs select-none">
      <span className="text-muted-foreground font-medium">
        {comment.name || comment.author}
      </span>
      <span className="text-muted-foreground">&middot;</span>
      <span className="text-muted-foreground">{timestamp}</span>
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        className="text-primary ms-2 flex cursor-pointer items-center gap-1 hover:underline"
      >
        {totalDescendants > 0 ? (
          <span>
            {plural(totalDescendants, { one: '# reply', other: '+# more replies' })}
          </span>
        ) : (
          <span className="text-muted-foreground italic"><Trans>(expand)</Trans></span>
        )}
      </button>
    </div>
  );

  const content = (
    <div className="space-y-1.5">
      <div className="group/row">
        <div className="flex h-5 items-center gap-2 text-xs">
          <span className="text-foreground font-medium">
            {comment.name || comment.author}
          </span>
          <span className="text-muted-foreground">&middot;</span>
          <span className="text-muted-foreground">{timestamp}</span>
          {comment.edited > 0 && (
            <span className="text-muted-foreground italic"><Trans>(edited)</Trans></span>
          )}
        </div>

        {editing ? (
          <div className="space-y-2">
            <MentionTextarea
              className="placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
              value={editBody}
              onValueChange={setEditBody}
              maxLength={ENTITY_LIMIT.comment}
              rows={3}
              autoFocus
              people={people}
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setEditing(false)}
              >
                <Trans>Cancel</Trans>
              </Button>
              <Button
                size="sm"
                className="h-7 text-xs"
                disabled={
                  !editBody.trim() ||
                  textUnchanged(editBody.trim(), comment.content)
                }
                onClick={() => {
                  const trimmed = editBody.trim();
                  if (textUnchanged(trimmed, comment.content)) {
                    setEditing(false);
                    return;
                  }
                  onEdit(comment.id, trimmed);
                  setEditing(false);
                }}
              >
                <Check className="size-4" />
                <Trans>Save</Trans>
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-foreground text-sm leading-relaxed whitespace-pre-wrap">
            {renderMentions(comment.content)}
          </p>
        )}

        <EntityCommentAttachments
          attachments={comment.attachments}
          containerId={containerId}
        />

        {!readOnly && (
          <div className="flex min-h-7 items-center gap-2 pt-0.5">
            {/* Desktop: hover-reveal inline actions */}
            <div className="pointer-events-none hidden items-center gap-1 opacity-0 transition-opacity group-hover/row:pointer-events-auto group-hover/row:opacity-100 group-focus-within/row:pointer-events-auto group-focus-within/row:opacity-100 md:flex">
              <button
                type="button"
                className="text-muted-foreground hover:bg-hover hover:text-foreground inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs transition-colors"
                onClick={() => onStartReply(comment.id)}
              >
                <Reply className="size-3" />
                <span><Trans>Reply</Trans></span>
              </button>

              {canEdit && (
                <button
                  type="button"
                  className="text-muted-foreground hover:bg-hover hover:text-foreground inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs transition-colors"
                  onClick={() => {
                    setEditing(true);
                    setEditBody(comment.content);
                  }}
                >
                  <Pencil className="size-3" />
                  <span><Trans>Edit</Trans></span>
                </button>
              )}

              {canDelete && (
                <button
                  type="button"
                  className="text-muted-foreground hover:bg-hover hover:text-foreground inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs transition-colors"
                  onClick={() => setDeleting(true)}
                >
                  <Trash2 className="size-3" />
                  <span><Trans>Delete</Trans></span>
                </button>
              )}
            </div>

            {/* Mobile: always-visible dropdown */}
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label={t`Comment actions`}
                      className="text-muted-foreground hover:bg-hover rounded-full p-1 transition-colors md:hidden"
                    >
                      <MoreHorizontal className="size-4" />
                    </button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>{t`Comment actions`}</TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => onStartReply(comment.id)}>
                  <Reply className="me-2 size-4" />
                  <Trans>Reply</Trans>
                </DropdownMenuItem>
                {canEdit && (
                  <DropdownMenuItem
                    onClick={() => {
                      setEditing(true);
                      setEditBody(comment.content);
                    }}
                  >
                    <Pencil className="me-2 size-4" />
                    <Trans>Edit</Trans>
                  </DropdownMenuItem>
                )}
                {canDelete && (
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => setDeleting(true)}
                  >
                    <Trash2 className="me-2 size-4" />
                    <Trans>Delete</Trans>
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      {isReplying && (
        <CommentBox
          kind="reply"
          className="mt-2 border-t pt-2"
          value={replyDraft}
          onValueChange={onReplyDraftChange}
          onSubmit={handleSubmitReply}
          onClose={requestCloseReply}
          onFilesChange={handleReplyFilesChange}
          people={people}
          progress={uploadProgress}
          placeholder={t`Reply to ${comment.name || comment.author}...`}
          autoFocus
        />
      )}

      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={t`Delete comment`}
        desc={t`Are you sure you want to delete this comment? This will also delete all replies.`}
        confirmText={t`Delete`}
        destructive
        handleConfirm={() => {
          onDelete(comment.id);
          setDeleting(false);
        }}
      />
      {discardDialog}
    </div>
  );

  const children = hasChildren ? (
    <>
      {comment.children.map((child) => (
        <EntityCommentThread
          key={child.id}
          comment={child}
          containerId={containerId}
          currentUserId={currentUserId}
          readOnly={readOnly}
          replyingTo={replyingTo}
          replyDraft={replyDraft}
          onStartReply={onStartReply}
          onCancelReply={onCancelReply}
          onReplyDraftChange={onReplyDraftChange}
          onReplyFilesChange={onReplyFilesChange}
          onSubmitReply={onSubmitReply}
          uploadProgress={uploadProgress}
          onEdit={onEdit}
          onDelete={onDelete}
          people={people}
          depth={depth + 1}
        />
      ))}
    </>
  ) : null;

  return (
    <CommentTreeLayout
      depth={depth}
      isCollapsed={collapsed}
      onToggleCollapse={() => setCollapsed(!collapsed)}
      hasChildren={hasChildren}
      avatar={avatar}
      content={content}
      collapsedContent={collapsedContent}
    >
      {children}
    </CommentTreeLayout>
  );
}
