// Copyright © 2026 Mochi OÜ
// SPDX-License-Identifier: Apache-2.0

/** Returned from mutationFn when proposed edit matches original — skip API side effects. */
export const MUTATION_SKIPPED = Symbol('mutation-skipped')

export function isMutationSkipped(result: unknown): result is typeof MUTATION_SKIPPED {
  return result === MUTATION_SKIPPED
}

export type MutationFnResult<T> = T | typeof MUTATION_SKIPPED

export interface TextCompareOptions {
  trim?: boolean
}

export function textUnchanged(
  a: string,
  b: string,
  options: TextCompareOptions = {}
): boolean {
  const { trim = true } = options
  const left = trim ? a.trim() : a
  const right = trim ? b.trim() : b
  return left === right
}

export function textChanged(
  a: string,
  b: string,
  options?: TextCompareOptions
): boolean {
  return !textUnchanged(a, b, options)
}

export function arraysEqual<T>(a: readonly T[], b: readonly T[]): boolean {
  if (a.length !== b.length) return false
  return a.every((value, index) => value === b[index])
}

export function unorderedArraysEqual(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false
  const sortedA = [...a].sort()
  const sortedB = [...b].sort()
  return arraysEqual(sortedA, sortedB)
}

export function jsonValueUnchanged(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
}
