// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { Component, type ErrorInfo, type ReactNode } from 'react'

// Error boundary for a subtree that arrives over the network. A code-split
// chunk is fetched at render time, so a dropped connection throws where a
// Suspense fallback cannot help: Suspense waits for a promise to settle and a
// rejected one is an error, which then travels to whatever boundary is next up
// the tree. Without one of these that is the router's own error component,
// which replaces the whole app over a picture that failed to arrive.
//
// React's lazy() keeps its verdict: a rejected payload stays rejected, so the
// same lazy component can never recover on its own and re-rendering it throws
// again at once. Recovery is the owner's business, which is what onFailure is
// for.
//
// It catches any render error in the subtree, not only a missing chunk. That is
// deliberate at the game canvas, where the alternative is losing the menu too.
interface Props {
  children: ReactNode
  // Rendered in place of the failed subtree. Left out means nothing is
  // rendered, which is right where the subtree is an enhancement rather than
  // the screen itself.
  fallback?: ReactNode
  // Called once, when the subtree fails. The owner usually has to change course
  // as well as show something: a game canvas that cannot load has to hand the
  // player back to the menu.
  onFailure?: (error: Error) => void
}

interface State {
  failed: boolean
}

export class LazyBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Not DEV-gated: catching the error is what stops React reporting it, and a
    // subtree that disappears with no trace anywhere is a bug report nobody can
    // act on.
    // eslint-disable-next-line no-console
    console.error('subtree failed to render', error, info.componentStack)
    this.props.onFailure?.(error)
  }

  render() {
    return this.state.failed ? (this.props.fallback ?? null) : this.props.children
  }
}
