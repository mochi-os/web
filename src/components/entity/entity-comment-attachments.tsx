// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { AttachmentGallery } from '../attachment-gallery'
import { getAppPath } from '../../lib/app-path'
import { authenticatedUrl } from '../../lib/shell-bridge'
import type { EntityAttachment } from '../../types/entity-object'

export interface EntityCommentAttachmentsProps {
  attachments: EntityAttachment[]
  containerId: string
}

export function EntityCommentAttachments({
  attachments,
  containerId,
}: EntityCommentAttachmentsProps) {
  if (!attachments || attachments.length === 0) return null

  const basePath = `${getAppPath()}/${containerId}/-/attachments/`
  const attUrl = (id: string, suffix = '') =>
    authenticatedUrl(`${basePath}${id}${suffix}`)

  return (
    <div className="mt-1">
      <AttachmentGallery
        attachments={attachments}
        getUrl={(att) => attUrl(att.id)}
        getThumbnailUrl={(att) => attUrl(att.id, '/thumbnail')}
        rowHeight={80}
      />
    </div>
  )
}
