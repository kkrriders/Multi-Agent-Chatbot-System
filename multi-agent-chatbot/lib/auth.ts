import { API_URL } from './config'

export interface User {
  id: string
  fullName: string
  email: string
  createdAt: string
  lastLogin?: string
}

/**
 * Auth strategy: rely on the HttpOnly cookie the backend sets on login/register.
 * The browser sends it automatically with credentials:'include' — no JS-accessible
 * token storage means XSS cannot steal the credential.
 *
 * Non-sensitive user profile is kept in sessionStorage for UI display only.
 */

export function getUser(): User | null {
  if (typeof window === 'undefined') return null
  const userStr = sessionStorage.getItem('user')
  if (!userStr) return null
  try {
    return JSON.parse(userStr)
  } catch {
    return null
  }
}

export function setAuth(_token: string, user: User): void {
  // Token is intentionally NOT stored — the HttpOnly cookie is the credential.
  sessionStorage.setItem('user', JSON.stringify(user))
}

export function clearAuth(): void {
  sessionStorage.removeItem('user')
}

export function isAuthenticated(): boolean {
  return !!getUser()
}

export async function logout(): Promise<void> {
  try {
    await fetch(`${API_URL}/api/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    })
  } catch (error) {
    console.error('Logout error:', error)
  } finally {
    clearAuth()
  }
}

export async function checkAuth(): Promise<User | null> {
  if (!isAuthenticated()) return null

  try {
    const response = await fetch(`${API_URL}/api/auth/me`, {
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    })

    if (!response.ok) {
      clearAuth()
      return null
    }

    const data = await response.json()
    return data.data.user
  } catch (error) {
    console.error('Auth check error:', error)
    clearAuth()
    return null
  }
}
