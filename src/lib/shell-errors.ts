// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { t } from '@lingui/core/macro'

// The shell's bridges (passkeys, microphone, camera) answer a failure with a
// DOMException-style name and nothing else: shell.js has no catalog, so the
// message an app may show is resolved here, in the app's own language. The
// name stays on the Error for callers that branch on it.
export type ShellBridge = 'webauthn' | 'microphone' | 'camera'

export function shellErrorMessage(bridge: ShellBridge, name: string): string {
  switch (bridge) {
    case 'webauthn':
      switch (name) {
        case 'SecurityError':
          return t`This app is not allowed to use your passkey. Allow it in Settings, under Permissions.`
        case 'NotSupportedError':
          return t`Passkeys are not available in this browser`
        case 'TimeoutError':
          return t`The passkey request was not answered`
        case 'NotAllowedError':
        case 'AbortError':
          return t`Cancelled`
        default:
          return t`Passkey verification failed. Please try again.`
      }
    case 'microphone':
      switch (name) {
        case 'NotAllowedError':
          return t`Microphone permission denied`
        case 'NotSupportedError':
          return t`Voice recording is not supported in this browser`
        case 'InvalidStateError':
          return t`A recording is already in progress.`
        case 'AbortError':
          return t`Cancelled`
        case 'EmptyRecordingError':
          return t`Recording produced no audio`
        case 'TimeoutError':
          return t`The microphone request was not answered`
        default:
          return t`Recording failed. Please try again.`
      }
    case 'camera':
      switch (name) {
        case 'NotAllowedError':
          return t`Camera permission denied`
        case 'InvalidStateError':
          return t`The camera is already in use`
        case 'AbortError':
          return t`Cancelled`
        case 'TimeoutError':
          return t`The camera request was not answered`
        default:
          return t`Camera unavailable`
      }
  }
}
