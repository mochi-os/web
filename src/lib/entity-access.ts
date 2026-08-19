// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// The access ladder crm and projects each held privately, in identical
// four-line copies. The shared object pages gate on it, so it lives here and
// each app's lib/access.ts re-exports it.

import type { EntityAccess } from '../types/entity-object'

export const canDesign = (a: EntityAccess) => a === 'owner' || a === 'design'
export const canWrite = (a: EntityAccess) => canDesign(a) || a === 'write'
export const canCreate = canWrite
export const canComment = (a: EntityAccess) => canWrite(a) || a === 'comment'
