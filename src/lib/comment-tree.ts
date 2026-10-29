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

/** Walk a nested comment tree and return the comment with this id. */
export function findCommentInTree<T>(
  comments: readonly T[],
  id: string,
  getId: (item: T) => string,
  getChildren: (item: T) => readonly T[] | undefined
): T | undefined {
  for (const comment of comments) {
    if (getId(comment) === id) return comment
    const children = getChildren(comment)
    if (children?.length) {
      const nested = findCommentInTree(children, id, getId, getChildren)
      if (nested) return nested
    }
  }
  return undefined
}

export interface AuthorAddressOptions<T> {
  getAuthor: (item: T) => string | undefined
  /**
   * The asset address the row's own route serves, or undefined for a row
   * that may not stand in for its author: one the server shows to some
   * viewers only, such as a comment awaiting approval.
   */
  getAddress: (item: T) => string | undefined
  getChildren?: (item: T) => readonly T[] | undefined
}

/**
 * One asset address per author, from the first row each author has in a list,
 * walked in display order with every reply. An author's avatar route names a
 * row rather than the person, so a list that built each row's own address
 * fetched the same picture and style once per row - a 500-comment thread by
 * one author sent a thousand requests and ran out of the app's budget for
 * calls to that author's server. Seed `found` to put a row first, as a post
 * goes before its comments.
 */
export function addressByAuthor<T>(
  rows: readonly T[],
  options: AuthorAddressOptions<T>,
  found: Map<string, string> = new Map()
): Map<string, string> {
  for (const row of rows) {
    const author = options.getAuthor(row)
    if (author && !found.has(author)) {
      const address = options.getAddress(row)
      if (address) found.set(author, address)
    }
    const children = options.getChildren?.(row)
    if (children?.length) addressByAuthor(children, options, found)
  }
  return found
}
