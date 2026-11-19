// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { AttachmentGallery } from '../attachment-gallery'
import { entityAddress, entityAssets } from '../../lib/entity-endpoints'
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
  // Undefined for an id that cannot be one path segment, whose attachment is
  // left out rather than fetched from another path.
  const attUrl = (id: string, variant?: 'thumbnail') => {
    const address = entityAddress(() =>
      entityAssets.attachment(containerId, id, variant)
    )
    return address && authenticatedUrl(address)
  }
  const shown = (attachments ?? []).filter((a) => attUrl(a.id) !== undefined)
  if (shown.length === 0) return null

  return (
    <div className='mt-1'>
      <AttachmentGallery
        attachments={shown}
        getUrl={(att) => attUrl(att.id) ?? ''}
        getThumbnailUrl={(att) => attUrl(att.id, 'thumbnail') ?? ''}
        rowHeight={80}
      />
    </div>
  )
}
