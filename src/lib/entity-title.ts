// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// Display name for one object. Written out four times before this file: twice
// in lib/web (object links, create dialog) and once in each of crm's and
// projects' detail panels. `number` is optional on the shared object model, so
// formatting it blind printed "PREFIX-undefined" on screen.

import { t } from '@lingui/core/macro'
import type { EntityClass } from '../types/entity-object'

/** The fields a title needs. Any EntityObject satisfies it. */
export interface EntityTitleObject {
  class: string
  number?: number
  readable?: string
  values: Record<string, string>
}

/**
 * The object's title field, else its readable id, else "Untitled".
 *
 * @param prefix Readable-id prefix (e.g. "PROJ"). Leave undefined in apps that
 *   do not number their objects; the fallback is then "Untitled".
 */
export function entityObjectTitle(
  obj: EntityTitleObject,
  classes: EntityClass[],
  prefix?: string,
): string {
  const cls = classes.find((c) => c.id === obj.class)
  const title = (cls?.title ? obj.values[cls.title] : '') || ''
  if (title) return title
  // The server's own readable id wins over one rebuilt from the prefix, so a
  // server that ever numbers differently is still displayed as it numbered.
  if (obj.readable) return obj.readable
  if (prefix !== undefined && typeof obj.number === 'number') {
    return `${prefix}-${obj.number}`
  }
  return t`Untitled`
}
