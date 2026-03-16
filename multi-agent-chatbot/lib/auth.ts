import { API_URL } from './config'

export interface User {
  id: string
  fullName: string
  email: string
  createdAt: string
  lastLogin?: string
}

/**
 * Token storage: sessionStorage instead of localStorage.
 * sessionStorage is cleared when the browser tab/window closes,
 * limiting the window for token theft compared to persistent localStorage.
 *
 * Note: for full XSS protection the ideal solution is HttpOnly-only cookies
 * (requires same-origin or a Next.js API proxy to the backend).
 */
export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return sessionStorage.getItem('token')
}

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

export function setAuth(token: string, user: User): void {
  sessionStorage.setItem('token', token)
  sessionStorage.setItem('user', JSON.stringify(user))
}

export function clearAuth(): void {
  sessionStorage.removeItem('token')
  sessionStorage.removeItem('user')
}

export function isAuthenticated(): boolean {
  return !!getToken()
}

export async function logout(): Promise<void> {
  try {
    const token = getToken()
    if (token) {
      await fetch(`${API_URL}/api/auth/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      })
    }
  } catch (error) {
    console.error('Logout error:', error)
  } finally {
    clearAuth()
  }
}

export async function checkAuth(): Promise<User | null> {
  const token = getToken()
  if (!token) return null

  try {
    const response = await fetch(`${API_URL}/api/auth/me`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
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
