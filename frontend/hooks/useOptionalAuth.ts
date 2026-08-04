import { useEffect, useState } from 'react'
import { verifySession, type AuthUser } from '@/lib/auth'

/** Like useRequireAuth, but never redirects — pages using this allow guest access. */
export function useOptionalAuth() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    verifySession().then(u => {
      setUser(u)
      setLoading(false)
    })
  }, [])

  return { user, loading }
}
