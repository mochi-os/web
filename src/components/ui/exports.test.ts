// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// The ui primitives export what the apps and the library use; scaffolding
// nothing consumes stays private to its file.
import { describe, it, expect } from 'vitest'
import * as avatar from './avatar'
import * as popover from './popover'
import * as scroll from './scroll-area'
import * as otp from './input-otp'
import * as dialog from './dialog'
import * as alert from './alert-dialog'
import * as drawer from './drawer'
import * as pill from './status-pill'
import * as mic from '../../lib/shell-mic-session'

describe('ui primitive exports', () => {
  it('keep the unadopted shadcn parts private', () => {
    expect(Object.keys(avatar)).toEqual(['Avatar'])
    expect(Object.keys(popover)).not.toContain('PopoverAnchor')
    expect(Object.keys(scroll)).not.toContain('ScrollBar')
    expect(Object.keys(otp)).not.toContain('InputOTPSeparator')
    expect(Object.keys(dialog)).not.toContain('DialogBody')
    expect(Object.keys(dialog)).not.toContain('DialogOverlay')
    expect(Object.keys(dialog)).not.toContain('DialogPortal')
    expect(Object.keys(alert)).not.toContain('AlertDialogBody')
    expect(Object.keys(alert)).not.toContain('AlertDialogPortal')
    expect(Object.keys(alert)).not.toContain('AlertDialogOverlay')
    expect(Object.keys(drawer)).not.toContain('DrawerPortal')
    expect(Object.keys(drawer)).not.toContain('DrawerOverlay')
    expect(Object.keys(pill)).not.toContain('statusToneClass')
    expect(Object.keys(pill)).toContain('StatusPill')
  })

  it('keep the mime picker inside the mic session host', () => {
    expect(Object.keys(mic)).not.toContain('pickMicMimeType')
    expect(Object.keys(mic)).toContain('createMicSessionHost')
  })
})
