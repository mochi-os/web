// Copyright © 2026 Mochi OÜ
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
