// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

/**
 * Runs tasks one at a time. A caller arriving while a task is running waits for
 * that task to finish before its own starts, so each task can rely on whatever
 * the previous one stored.
 *
 * The case this exists for: a debounced autosave clears its dirty flag before
 * awaiting the request, so a second caller that checks the flag sails past its
 * own guard and acts on state the first save has not written yet. Waiting on
 * the flag is not enough - the guard has to be re-read after the wait, which
 * happens naturally when the whole task runs behind the queue.
 *
 * A task that rejects does not wedge the queue: the next one still runs, and
 * the rejection is delivered only to the caller whose task it was.
 */
export function sequence() {
  let tail: Promise<unknown> = Promise.resolve()

  return function run<T>(task: () => Promise<T>): Promise<T> {
    const next = tail.then(task)
    // The queue tracks only that the task settled, not how. Absorbing the
    // rejection here is what keeps a failed task from stalling the next one,
    // and it leaves the rejection itself for the caller who owns it.
    tail = next.then(
      () => undefined,
      () => undefined,
    )
    return next
  }
}
