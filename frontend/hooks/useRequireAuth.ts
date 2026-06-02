import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { verifySession, type AuthUser } from '@/lib/auth'

export function useRequireAuth() {
  const router = useRouter()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    verifySession().then(u => {
      if (!u) { router.push('/login'); return }
      setUser(u)
      setLoading(false)
    })
  }, [router])

  return { user, loading }
}
