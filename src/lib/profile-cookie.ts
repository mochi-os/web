// Copyright © 2026 Mochi OÜ
// SPDX-License-Identifier: Apache-2.0

import { getCookie, removeCookie, setCookie } from './cookies'

export type IdentityPrivacy = 'public' | 'private'

export interface ProfileCookieData {
  email?: string
  name?: string
}

export interface ProfileCookiePatch {
  email?: string | null
  name?: string | null
}

const PROFILE_COOKIE = 'mochi_me'

const sanitizeProfile = (profile: ProfileCookieData): ProfileCookieData => {
  const sanitized: ProfileCookieData = {}

  if (typeof profile.email === 'string' && profile.email.length > 0) {
    sanitized.email = profile.email
  }

  if (typeof profile.name === 'string' && profile.name.length > 0) {
    sanitized.name = profile.name
  }

  return sanitized
}

export const readProfileCookie = (): ProfileCookieData => {
  const raw = getCookie(PROFILE_COOKIE)
  if (!raw) {
    return {}
  }

  try {
    const parsed = JSON.parse(raw) as ProfileCookieData
    return sanitizeProfile(parsed)
  } catch {
    removeCookie(PROFILE_COOKIE, '/')
    return {}
  }
}

const mergeProfile = (
  current: ProfileCookieData,
  patch: ProfileCookiePatch
): ProfileCookieData => ({
  email: patch.email === null ? undefined : patch.email ?? current.email,
  name: patch.name === null ? undefined : patch.name ?? current.name,
})

export const mergeProfileCookie = (
  patch: ProfileCookiePatch
): ProfileCookieData => {
  const merged = sanitizeProfile(mergeProfile(readProfileCookie(), patch))

  if (Object.keys(merged).length === 0) {
    removeCookie(PROFILE_COOKIE, '/')
    return {}
  }

  setCookie(PROFILE_COOKIE, JSON.stringify(merged), {
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
    sameSite: 'strict',
    secure: window.location.protocol === 'https:',
  })

  return merged
}

export const clearProfileCookie = (): void => {
  removeCookie(PROFILE_COOKIE, '/')
}
