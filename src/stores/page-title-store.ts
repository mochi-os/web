// Copyright © 2026 Mochi OÜ
// SPDX-License-Identifier: Apache-2.0

import { create } from 'zustand'

interface PageTitleState {
  title: string
  setTitle: (title: string) => void
}

export const usePageTitleStore = create<PageTitleState>()((set) => ({
  title: '',
  setTitle: (title) => set({ title }),
}))
