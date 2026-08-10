// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "@radix-ui/react-slot"
import { X } from "lucide-react"

import { cn } from "../../lib/utils"
import type { UploadSlice } from "../../lib/upload-slices"
import { Button } from "./button"

/**
 * Fill for one attachment's own bytes, along the bottom edge of whatever it is
 * given as a parent.
 *
 * Decorative on purpose. The byte counts are already spelled out in the
 * description line beside it, and ten progressbar roles each announcing their
 * own percentage would bury that one useful line. Timing matches the aggregate
 * bar in `upload-progress.tsx`: two progress indicators in the same view
 * running at different speeds reads as a bug. No RTL handling is needed — the
 * fill is a block box, so it grows from the inline start either way.
 */
function AttachmentProgress({
  fraction,
  className,
}: {
  fraction: number
  className?: string
}) {
  const percent = Math.min(Math.max(fraction, 0), 1) * 100
  return (
    <div
      aria-hidden
      data-slot="attachment-progress"
      className={cn(
        "bg-foreground/15 absolute inset-x-0 bottom-0 h-1 overflow-hidden rounded-b-[inherit]",
        className
      )}
    >
      <div
        className="bg-primary h-full transition-[width] duration-300"
        style={{ width: `${percent}%` }}
      />
    </div>
  )
}

const attachmentVariants = cva(
  "group/attachment relative flex w-fit max-w-full min-w-0 shrink-0 flex-wrap rounded-xl border bg-card text-card-foreground transition-colors focus-within:ring-1 focus-within:ring-ring/50 has-[>a,>button]:hover:bg-muted/50 data-[state=error]:border-destructive/30 data-[state=idle]:border-dashed",
  {
    variants: {
      size: {
        default:
          "gap-2 text-sm has-data-[slot=attachment-content]:px-2.5 has-data-[slot=attachment-content]:py-2 has-data-[slot=attachment-media]:p-2",
        sm: "gap-2.5 text-xs has-data-[slot=attachment-content]:px-2 has-data-[slot=attachment-content]:py-1.5 has-data-[slot=attachment-media]:p-1.5",
        xs: "gap-1.5 rounded-lg text-xs has-data-[slot=attachment-content]:px-1.5 has-data-[slot=attachment-content]:py-1 has-data-[slot=attachment-media]:p-1",
      },
      orientation: {
        horizontal: "min-w-40 items-center",
        vertical: "w-24 flex-col has-data-[slot=attachment-content]:w-30",
      },
    },
  }
)

function Attachment({
  className,
  state = "done",
  size = "default",
  orientation = "horizontal",
  progress,
  children,
  ...props
}: React.ComponentProps<"div"> &
  VariantProps<typeof attachmentVariants> & {
    state?: "idle" | "uploading" | "processing" | "error" | "done"
    /** This file's own share of an upload in flight. */
    progress?: UploadSlice | null
  }) {
  return (
    <div
      data-slot="attachment"
      data-state={state}
      data-size={size}
      data-orientation={orientation}
      className={cn(attachmentVariants({ size, orientation }), className)}
      {...props}
    >
      {children}
      {progress && <AttachmentProgress fraction={progress.fraction} />}
    </div>
  )
}

const attachmentMediaVariants = cva(
  "relative flex aspect-square w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted text-foreground group-data-[orientation=vertical]/attachment:w-full group-data-[size=sm]/attachment:w-8 group-data-[size=xs]/attachment:w-7 group-data-[size=xs]/attachment:rounded-md group-data-[state=error]/attachment:bg-destructive/10 group-data-[state=error]/attachment:text-destructive group-data-[orientation=vertical]/attachment:*:data-[slot=spinner]:size-6! [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 group-data-[orientation=vertical]/attachment:[&_svg:not([class*='size-'])]:size-6 group-data-[size=xs]/attachment:[&_svg:not([class*='size-'])]:size-3.5",
  {
    variants: {
      variant: {
        icon: "",
        image:
          "opacity-60 group-data-[state=done]/attachment:opacity-100 group-data-[state=idle]/attachment:opacity-100 *:[img]:aspect-square *:[img]:w-full *:[img]:object-cover",
      },
    },
    defaultVariants: {
      variant: "icon",
    },
  }
)

function AttachmentMedia({
  className,
  variant = "icon",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof attachmentMediaVariants>) {
  return (
    <div
      data-slot="attachment-media"
      data-variant={variant}
      className={cn(attachmentMediaVariants({ variant }), className)}
      {...props}
    />
  )
}

function AttachmentContent({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="attachment-content"
      className={cn(
        "max-w-full min-w-0 flex-1 leading-tight group-data-[orientation=vertical]/attachment:px-1",
        className
      )}
      {...props}
    />
  )
}

function AttachmentTitle({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="attachment-title"
      className={cn(
        "block max-w-full min-w-0 truncate font-medium group-data-[state=processing]/attachment:animate-pulse group-data-[state=uploading]/attachment:animate-pulse",
        className
      )}
      {...props}
    />
  )
}

function AttachmentDescription({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="attachment-description"
      className={cn(
        "mt-0.5 block min-w-0 truncate text-xs text-muted-foreground group-data-[state=error]/attachment:text-destructive/80",
        "max-w-full",
        className
      )}
      {...props}
    />
  )
}

function AttachmentActions({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="attachment-actions"
      className={cn(
        "relative z-20 flex shrink-0 items-center group-data-[orientation=vertical]/attachment:absolute group-data-[orientation=vertical]/attachment:top-3 group-data-[orientation=vertical]/attachment:right-3 group-data-[orientation=vertical]/attachment:gap-1",
        className
      )}
      {...props}
    />
  )
}

function AttachmentAction({
  className,
  variant,
  size = "icon",
  type = "button",
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button
      data-slot="attachment-action"
      variant={variant ?? "ghost"}
      size={size}
      // A bare button defaults to type="submit", and these actions live inside
      // composer and create forms: removing a staged file submitted the form,
      // creating the record and closing the dialog under the user.
      type={type}
      className={cn(className)}
      {...props}
    />
  )
}

function AttachmentTrigger({
  className,
  asChild = false,
  type,
  ...props
}: React.ComponentProps<"button"> & {
  asChild?: boolean
}) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="attachment-trigger"
      type={asChild ? undefined : (type ?? "button")}
      className={cn("absolute inset-0 z-10 outline-none", className)}
      {...props}
    />
  )
}

const attachmentGroupVariants = cva("flex min-w-0 gap-3 py-1", {
  variants: {
    layout: {
      // One row that scrolls sideways. Compact, but only ever shows the few
      // attachments that fit, which is wrong wherever the order matters.
      row: "snap-x snap-mandatory scroll-px-1 no-scrollbar overflow-x-auto overscroll-x-contain *:data-[slot=attachment]:flex-none *:data-[slot=attachment]:snap-start",
      // Wraps onto as many rows as it takes, so every attachment is on screen.
      // items-start is load-bearing: a flex line stretches its items to the
      // tallest one by default, which pulls every tile to the height of the
      // largest and leaves dead space under the short ones.
      grid: "flex-wrap content-start items-start",
    },
  },
  defaultVariants: {
    layout: "row",
  },
})

function AttachmentGroup({
  className,
  layout,
  ...props
}: React.ComponentProps<"div"> &
  VariantProps<typeof attachmentGroupVariants>) {
  return (
    <div
      data-slot="attachment-group"
      data-layout={layout ?? "row"}
      className={cn(attachmentGroupVariants({ layout }), className)}
      {...props}
    />
  )
}

type AttachmentTileProps = Omit<React.ComponentProps<"div">, "children"> & {
  /** File name, shown under the preview and used as the image's alt text. */
  name: string
  /** Second line: the formatted size, or an error in its place. */
  meta?: React.ReactNode
  /** Object URL or thumbnail. Falls back to `icon` when absent. */
  previewUrl?: string | null
  /** A video preview needs a <video>; an <img> renders nothing for one. */
  previewKind?: "image" | "video"
  /** Shown in place of a preview, for anything that is not an image. */
  icon?: React.ReactNode
  state?: "idle" | "uploading" | "error"
  /**
   * This file's own share of an upload in flight. Supersedes the pulse that
   * `state: "uploading"` draws on the name: a real fill says which of ten
   * files is on the wire, and a pulse on every one of them says nothing.
   */
  progress?: UploadSlice | null
  /** Lifts the tile while the pointer is carrying it. */
  dragging?: boolean
  /** Small label over the bottom-left of the preview, such as "New". */
  badge?: React.ReactNode
  onRemove?: () => void
  /** Translated; the tile holds no copy of its own. */
  removeLabel?: string
}

/**
 * One attachment as a gallery tile: a square preview with the name and size
 * beneath it, and the remove button floating over the top corner.
 *
 * The square preview is the point. A row of names tells you nothing about which
 * photo is which, and picking the photo to move is the whole job when a gallery
 * is being put in order.
 */
function AttachmentTile({
  name,
  meta,
  previewUrl,
  previewKind = "image",
  icon,
  state = "idle",
  progress,
  dragging = false,
  badge,
  onRemove,
  removeLabel,
  className,
  ...props
}: AttachmentTileProps) {
  // Files still queued behind the one on the wire are dimmed, so the order the
  // upload is working through is legible without reading a single number.
  const waiting = progress?.state === "waiting"
  return (
    <div
      data-slot="attachment-tile"
      data-state={state}
      className={cn(
        "group/tile bg-card text-card-foreground relative flex w-24 shrink-0 flex-col overflow-hidden rounded-xl border transition-[transform,box-shadow,border-color] sm:w-32",
        state === "error" && "border-destructive/40",
        dragging && "ring-primary z-10 scale-[1.04] shadow-lg ring-2",
        className
      )}
      {...props}
    >
      <div
        className={cn(
          "bg-muted relative aspect-square w-full shrink-0 overflow-hidden",
          waiting && "opacity-50 transition-opacity"
        )}
      >
        {previewUrl && previewKind === "video" ? (
          <video
            src={previewUrl}
            muted
            playsInline
            draggable={false}
            className={cn(
              "absolute inset-0 size-full object-cover",
              // The blanket dim is the indeterminate signal. With a real slice
              // the fill and the queued dim say it better, and stacking the two
              // put a waiting tile at 30% — which reads as broken, not queued.
              state === "uploading" && !progress && "opacity-60"
            )}
          />
        ) : previewUrl ? (
          // Absolutely positioned, not merely sized: an in-flow image keeps its
          // intrinsic height as a minimum, and a tall screenshot then forces the
          // square open from the inside and drags the whole row with it.
          <img
            src={previewUrl}
            alt={name}
            draggable={false}
            className={cn(
              "absolute inset-0 size-full object-cover",
              // The blanket dim is the indeterminate signal. With a real slice
              // the fill and the queued dim say it better, and stacking the two
              // put a waiting tile at 30% — which reads as broken, not queued.
              state === "uploading" && !progress && "opacity-60"
            )}
          />
        ) : (
          <div
            className={cn(
              "text-muted-foreground absolute inset-0 flex items-center justify-center [&_svg]:size-7",
              state === "error" && "text-destructive"
            )}
          >
            {icon}
          </div>
        )}
        {badge && (
          <div className="absolute bottom-1.5 left-1.5">{badge}</div>
        )}
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={removeLabel}
            // Revealed on hover where there is a pointer, always visible where
            // there is not — a tap has no hover state to reveal it with.
            className="absolute top-1.5 right-1.5 grid size-6 place-items-center rounded-full bg-black/55 text-white opacity-0 backdrop-blur-sm transition hover:bg-black/80 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-white group-hover/tile:opacity-100 [@media(hover:none)]:opacity-100"
          >
            <X className="size-3.5" strokeWidth={2.5} />
          </button>
        )}
        {progress && (
          <AttachmentProgress
            fraction={progress.fraction}
            // Square preview, square corners: the tile's own radius is on the
            // card below it, not on this edge.
            className="rounded-none"
          />
        )}
      </div>
      <div className="min-w-0 px-2 py-1.5">
        <p
          className={cn(
            "truncate text-xs leading-tight font-medium",
            state === "uploading" && !progress && "animate-pulse"
          )}
          title={name}
        >
          {name}
        </p>
        {meta && (
          <p
            className={cn(
              "text-muted-foreground mt-0.5 truncate text-[11px]",
              state === "error" && "text-destructive"
            )}
          >
            {meta}
          </p>
        )}
      </div>
    </div>
  )
}

export {
  Attachment,
  AttachmentProgress,
  AttachmentTile,
  AttachmentGroup,
  AttachmentMedia,
  AttachmentContent,
  AttachmentTitle,
  AttachmentDescription,
  AttachmentActions,
  AttachmentAction,
  AttachmentTrigger,
}
