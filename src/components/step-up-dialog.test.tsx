// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { I18nProvider } from '@lingui/react'
import { i18n } from '@lingui/core'
import { StepUpDialog, type StepUpClient } from './step-up-dialog'

i18n.load('en', {})
i18n.activate('en')

// The OAuth factor polls for up to two minutes: the sandboxed iframe's
// window.open returns null, so the client cannot see the popup close and keeps
// asking the server for the proof. Dismissing the dialog does not stop it.
function deferredClient(): {
  client: StepUpClient
  resolve: (token: string) => void
} {
  let release: (token: string) => void = () => {}
  const pending = new Promise<{ token: string }>((r) => {
    release = (token: string) => r({ token })
  })
  return {
    client: {
      methods: async () => ['oauth'],
      send: async () => {},
      verifyEmail: async () => ({ token: '' }),
      verifyTotp: async () => ({ token: '' }),
      passkeyBegin: async () => ({ ceremony: '', options: {} }),
      passkeyFinish: async () => ({ token: '' }),
      oauthProviders: async () => ['github'],
      oauthVerify: () => pending,
    } as StepUpClient,
    resolve: (token: string) => release(token),
  }
}

function view(ui: React.ReactNode) {
  return render(<I18nProvider i18n={i18n}>{ui}</I18nProvider>)
}

afterEach(() => vi.restoreAllMocks())

describe('StepUpDialog abandoned OAuth ceremony', () => {
  it('does not verify when the proof arrives after dismissal', async () => {
    const { client, resolve } = deferredClient()
    const onVerified = vi.fn()

    const { rerender } = view(
      <StepUpDialog
        open
        onOpenChange={() => {}}
        title='Confirm'
        client={client}
        onVerified={onVerified}
      />
    )

    const button = await screen.findByRole('button', { name: /github/i })
    fireEvent.click(button)

    // The user gives up and closes the dialog while the popup is still open.
    rerender(
      <I18nProvider i18n={i18n}>
        <StepUpDialog
          open={false}
          onOpenChange={() => {}}
          title='Confirm'
          client={client}
          onVerified={onVerified}
        />
      </I18nProvider>
    )

    // The ceremony completes anyway - the popup was never cancelled.
    resolve('late-proof')
    await new Promise((r) => setTimeout(r, 0))

    // Whatever action the caller had pending must NOT run: by now it may be a
    // different one, requested after this dialog was dismissed.
    expect(onVerified).not.toHaveBeenCalled()
  })

  it('verifies when the proof arrives while the dialog is still open', async () => {
    // Companion: without it, "not called" would pass just as well against a
    // dialog whose OAuth button never worked at all.
    const { client, resolve } = deferredClient()
    const onVerified = vi.fn()

    view(
      <StepUpDialog
        open
        onOpenChange={() => {}}
        title='Confirm'
        client={client}
        onVerified={onVerified}
      />
    )

    const button = await screen.findByRole('button', { name: /github/i })
    fireEvent.click(button)

    resolve('good-proof')
    await waitFor(() => expect(onVerified).toHaveBeenCalledWith('good-proof'))
  })
})
