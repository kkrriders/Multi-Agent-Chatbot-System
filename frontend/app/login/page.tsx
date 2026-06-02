'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { setAuth } from '@/lib/auth'
import { API_URL } from '@/lib/config'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: window.location.origin },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Login failed')
      if (data.data?.user) setAuth(data.data.user)
      router.push('/dashboard')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-surface text-on-surface antialiased min-h-screen flex flex-col md:flex-row selection:bg-primary-container/30 selection:text-emerald-deep">
      {/* Left panel — context & branding (desktop only) */}
      <div className="hidden md:flex md:w-1/2 lg:w-[45%] bg-surface-container-low flex-col justify-between p-12 border-r border-outline-variant/15 relative overflow-hidden">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-emerald-deep icon-fill">psychology</span>
          <span className="text-emerald-deep font-geist font-semibold text-2xl tracking-tight">MockPrep</span>
        </div>
        <div className="z-10 mt-12 max-w-md">
          <h1 className="font-geist font-bold text-5xl text-on-surface mb-6 leading-tight">
            Welcome back,<br />future leader.
          </h1>
          <p className="text-lg text-secondary mb-12">
            Your personalized AI interview coach is ready to help you land that dream role. Let&apos;s pick up where you left off.
          </p>
          <div className="w-full aspect-video rounded-xl overflow-hidden border border-outline-variant/20 shadow-sm bg-white flex items-center justify-center">
            <div className="w-full h-full bg-gradient-to-br from-surface-container-low to-surface-container-high flex items-center justify-center">
              <div className="text-center">
                <span className="material-symbols-outlined text-emerald-deep text-6xl icon-fill">trending_up</span>
                <p className="text-sm text-slate-muted mt-2 font-medium">Track your interview progress</p>
              </div>
            </div>
          </div>
        </div>
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-primary-container/10 rounded-full blur-3xl -z-0" />
        <div className="absolute top-1/4 -right-24 w-64 h-64 bg-tertiary-fixed/20 rounded-full blur-3xl -z-0" />
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex flex-col justify-center items-center p-4 md:p-12 bg-surface relative">
        <div className="w-full max-w-[400px]">
          {/* Mobile brand */}
          <div className="md:hidden mb-10 flex flex-col items-center">
            <div className="flex items-center gap-2 mb-4">
              <span className="material-symbols-outlined text-emerald-deep icon-fill">psychology</span>
              <span className="text-emerald-deep font-geist font-semibold text-2xl">MockPrep</span>
            </div>
            <h1 className="font-geist font-bold text-2xl text-on-surface text-center">Welcome back</h1>
            <p className="text-base text-secondary text-center mt-2">Log in to continue your preparation.</p>
          </div>

          {/* Desktop form header */}
          <div className="hidden md:block mb-8">
            <h2 className="font-geist font-bold text-3xl text-on-surface">Log in</h2>
            <p className="text-base text-secondary mt-2">Access your personalized feedback and history.</p>
          </div>

          {error && (
            <div className="mb-4 flex items-center gap-2 text-sm text-error bg-error-container/30 rounded-lg px-3 py-2.5 border border-error-container">
              <span className="material-symbols-outlined text-base">error</span>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div>
              <label className="block text-xs font-medium text-on-surface-variant mb-1.5" htmlFor="email">
                Email address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="material-symbols-outlined text-slate-muted text-xl">mail</span>
                </div>
                <input
                  id="email" type="email" value={email} onChange={e => setEmail(e.target.value)}
                  required autoComplete="email"
                  placeholder="you@example.com"
                  className="block w-full pl-10 pr-3 py-2.5 bg-surface-container-lowest border border-outline-variant/60 rounded-lg text-base text-on-surface placeholder:text-slate-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-on-surface-variant" htmlFor="password">
                  Password
                </label>
                <span className="text-xs text-primary hover:text-emerald-deep transition-colors cursor-pointer">Forgot password?</span>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="material-symbols-outlined text-slate-muted text-xl">lock</span>
                </div>
                <input
                  id="password" type={showPassword ? 'text' : 'password'}
                  value={password} onChange={e => setPassword(e.target.value)}
                  required autoComplete="current-password"
                  placeholder="••••••••"
                  className="block w-full pl-10 pr-10 py-2.5 bg-surface-container-lowest border border-outline-variant/60 rounded-lg text-base text-on-surface placeholder:text-slate-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(s => !s)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-muted hover:text-on-surface transition-colors"
                >
                  <span className="material-symbols-outlined text-xl">{showPassword ? 'visibility' : 'visibility_off'}</span>
                </button>
              </div>
            </div>

            {/* Submit */}
            <div className="pt-2">
              <button
                type="submit" disabled={loading}
                className="w-full flex justify-center items-center py-3 px-4 rounded-lg shadow-sm font-semibold text-sm text-white bg-primary hover:bg-emerald-deep focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors disabled:opacity-60 cursor-pointer"
              >
                {loading ? (
                  <span className="flex items-center gap-2"><span className="material-symbols-outlined text-base animate-spin">sync</span>Signing in…</span>
                ) : (
                  <span className="flex items-center gap-2">Log In <span className="material-symbols-outlined text-lg">arrow_forward</span></span>
                )}
              </button>
            </div>
          </form>

          {/* Divider */}
          <div className="mt-8 mb-6 relative">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-outline-variant/30" /></div>
            <div className="relative flex justify-center">
              <span className="px-3 bg-surface text-xs text-secondary">Or continue with</span>
            </div>
          </div>

          {/* Social */}
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Google', icon: (
                <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
              )},
              { label: 'LinkedIn', icon: (
                <svg className="h-5 w-5 mr-2 text-[#0A66C2]" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                </svg>
              )},
            ].map(({ label, icon }) => (
              <button
                key={label}
                type="button"
                className="flex items-center justify-center w-full px-4 py-2.5 border border-outline-variant/50 rounded-lg shadow-sm bg-white hover:bg-surface-container-low transition-colors text-sm font-semibold text-on-surface"
              >
                {icon}{label}
              </button>
            ))}
          </div>

          <p className="mt-8 text-center text-base text-secondary">
            New to MockPrep?{' '}
            <Link href="/signup" className="text-sm font-semibold text-primary hover:text-emerald-deep transition-colors ml-1">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
