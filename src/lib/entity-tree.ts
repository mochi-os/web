// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// Walks over the parent links of a container's objects.

/** How many items sit under `rootId`, at any depth. */
export function countEntityDescendants(
  objects: readonly { id: string; parent: string }[],
  rootId: string
): number {
  const children = new Map<string, string[]>()
  for (const obj of objects) {
    if (!obj.parent) continue
    const siblings = children.get(obj.parent)
    if (siblings) siblings.push(obj.id)
    else children.set(obj.parent, [obj.id])
  }
  const seen = new Set<string>([rootId])
  const pending = [...(children.get(rootId) ?? [])]
  while (pending.length > 0) {
    const id = pending.pop() as string
    if (seen.has(id)) continue
    seen.add(id)
    pending.push(...(children.get(id) ?? []))
  }
  return seen.size - 1
}
