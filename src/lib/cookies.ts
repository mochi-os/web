import Cookies from 'js-cookie'

export interface CookieOptions {
  maxAge?: number
  httpOnly?: boolean
  secure?: boolean
  sameSite?: 'strict' | 'lax' | 'none'
  path?: string
}

export function getCookie(name: string): string | undefined {
  try {
    return Cookies.get(name)
  } catch {
    return undefined // Sandboxed iframe — no cookie access
  }
}

export function setCookie(
  name: string,
  value: string,
  options: CookieOptions = {}
): void {
  try {
    const { maxAge, ...rest } = options
    const cookieOptions = maxAge
      ? { ...rest, expires: maxAge / 86400 } // Convert seconds to days for js-cookie
      : rest
    Cookies.set(name, value, cookieOptions)
  } catch {
    // Sandboxed iframe — no cookie access
  }
}

export function removeCookie(name: string, path: string = '/'): void {
  try {
    Cookies.remove(name, { path })
  } catch {
    // Sandboxed iframe — no cookie access
  }
}
