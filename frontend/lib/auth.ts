import { API_URL } from './config'

export interface AuthUser {
  id: string
  email: string
  fullName?: string
}

const KEY = 'mockprep_user'

export function setAuth(user: AuthUser) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(KEY, JSON.stringify(user))
  }
}

export function clearAuth() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(KEY)
  }
}

export function getCachedUser(): AuthUser | null {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem(KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as AuthUser
  } catch {
    return null
  }
}

/** Verifies the session against the server. Returns user if session is valid, null otherwise. */
export async function verifySession(): Promise<AuthUser | null> {
  try {
    const res = await fetch(`${API_URL}/api/auth/me`, {
      credentials: 'include',
      headers: { Origin: typeof window !== 'undefined' ? window.location.origin : '' },
    })
    if (!res.ok) { clearAuth(); return null }
    const data = await res.json()
    const user = data.data?.user ?? data.user ?? null
    if (user) setAuth(user)
    return user
  } catch {
    return null
  }
}
