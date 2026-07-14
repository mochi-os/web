// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

export interface User {
  uid: string
  username: string
  role: string
  status: 'active' | 'suspended'
  methods: string
  last: number
}

export interface Session {
  id: string
  expires: number
  created: number
  accessed: number
  address: string
  agent: string
}

export interface UsersData {
  users: User[]
  count: number
}

export interface SessionsData {
  sessions: Session[]
}
