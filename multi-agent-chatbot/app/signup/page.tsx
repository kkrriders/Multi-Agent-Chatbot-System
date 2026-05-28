'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { setAuth } from '@/lib/auth'
import { API_URL } from '@/lib/config'
import { BrainCircuit } from 'lucide-react'

export default function SignupPage() {
  const router = useRouter()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    setError('')
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: window.location.origin },
        credentials: 'include',
        body: JSON.stringify({ fullName, email, password, confirmPassword: password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Signup failed')
      if (data.data?.user) setAuth('', data.data.user)
      router.push('/dashboard')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <Link href="/" className="inline-flex items-center gap-2 font-bold text-xl mb-2">
            <BrainCircuit className="w-6 h-6 text-primary" /> MockPrep
          </Link>
          <p className="text-muted-foreground text-sm">Create a free account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="text-destructive text-sm bg-destructive/10 rounded-lg px-3 py-2">{error}</p>}

          <div>
            <label className="text-sm font-medium">Full Name</label>
            <input
              type="text" value={fullName} onChange={e => setFullName(e.target.value)} required
              className="mt-1 w-full border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              placeholder="Your name"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Email</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)} required
              className="mt-1 w-full border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Password</label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)} required
              className="mt-1 w-full border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              placeholder="Min 8 characters"
            />
          </div>

          <button
            type="submit" disabled={loading}
            className="w-full bg-primary text-primary-foreground rounded-lg py-2.5 font-medium disabled:opacity-50"
          >
            {loading ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link href="/login" className="text-primary underline underline-offset-2">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
