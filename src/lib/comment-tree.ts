// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

export interface CommentTreeSearchOptions<T> {
  getId: (item: T) => string
  getText: (item: T) => string
  getChildren?: (item: T) => readonly T[] | undefined
}

/** Walk a nested comment tree and return the text field for the matching id. */
export function findCommentTextInTree<T>(
  comments: readonly T[],
  id: string,
  options: CommentTreeSearchOptions<T>
): string | undefined {
  for (const comment of comments) {
    if (options.getId(comment) === id) {
      return options.getText(comment)
    }
    const children = options.getChildren?.(comment)
    if (children?.length) {
      const nested = findCommentTextInTree(children, id, options)
      if (nested !== undefined) {
        return nested
      }
    }
  }
  return undefined
}

/**
 * Count the roots and all their replies: a post's "N comments" is the whole
 * subtree, and a reply inherits its parent's image anchor.
 */
export function countCommentTree<T>(
  comments: readonly T[],
  getChildren: (item: T) => readonly T[] | undefined
): number {
  let total = 0
  for (const comment of comments) {
    total += 1
    const children = getChildren(comment)
    if (children?.length) total += countCommentTree(children, getChildren)
  }
  return total
}
