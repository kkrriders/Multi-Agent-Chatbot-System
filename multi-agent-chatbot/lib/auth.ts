export interface User {
  id: string
  fullName: string
  email: string
  createdAt: string
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('token')
}

export function getUser(): User | null {
  if (typeof window === 'undefined') return null
  const userStr = localStorage.getItem('user')
  if (!userStr) return null

  try {
    return JSON.parse(userStr)
  } catch {
    return null
  }
}

export function setAuth(token: string, user: User): void {
  localStorage.setItem('token', token)
  localStorage.setItem('user', JSON.stringify(user))
}

export function clearAuth(): void {
  localStorage.removeItem('token')
  localStorage.removeItem('user')
}

export function isAuthenticated(): boolean {
  return !!getToken()
}

export async function logout(): Promise<void> {
  try {
    const token = getToken()

    if (token) {
      await fetch('http://localhost:3000/api/auth/logout', {
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

  if (!token) {
    return null
  }

  try {
    const response = await fetch('http://localhost:3000/api/auth/me', {
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
