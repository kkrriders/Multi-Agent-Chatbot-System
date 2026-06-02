'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { setAuth } from '@/lib/auth'
import { API_URL } from '@/lib/config'

function OAuthButton({ provider, label, className }: { provider: 'google' | 'linkedin'; label: string; className?: string }) {
  const icon = provider === 'google' ? (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  ) : (
    <svg className="w-5 h-5 text-[#0A66C2]" fill="currentColor" viewBox="0 0 24 24">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
    </svg>
  )
  return (
    <button
      type="button"
      onClick={() => { window.location.href = `${API_URL}/api/auth/${provider}` }}
      className={className ?? 'flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-surface-container-lowest border border-outline-variant/40 rounded-lg hover:bg-surface-container-low hover:border-outline-variant transition-colors shadow-sm text-sm font-semibold text-on-surface'}
    >
      {icon}{label}
    </button>
  )
}

export default function SignupPage() {
  const router = useRouter()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
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
      if (data.data?.user) setAuth(data.data.user)
      router.push('/dashboard')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Signup failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-background text-on-background min-h-screen flex flex-col font-sans antialiased overflow-x-hidden selection:bg-primary-container/30 selection:text-primary">
      {/* Top header */}
      <header className="absolute top-0 left-0 w-full px-4 md:px-12 z-10 flex justify-between items-center h-16">
        <Link href="/" className="flex items-center gap-2 group">
          <span className="material-symbols-outlined text-primary text-3xl group-hover:scale-110 transition-transform duration-300">school</span>
          <span className="font-geist font-bold text-emerald-deep text-xl tracking-tight">MockPrep</span>
        </Link>
        <div className="hidden md:flex items-center gap-4">
          <span className="text-xs text-slate-muted">Already have an account?</span>
          <Link
            href="/login"
            className="text-sm font-semibold text-primary hover:text-emerald-deep transition-colors px-4 py-2 border border-outline-variant/30 rounded-full hover:bg-surface-container-low"
          >
            Log in
          </Link>
        </div>
      </header>

      <main className="flex-grow flex flex-col lg:flex-row min-h-screen relative">
        {/* Dot pattern background */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.04]"
          style={{ backgroundImage: 'radial-gradient(#64748B 1px, transparent 1px)', backgroundSize: '24px 24px' }}
        />

        {/* Left column — form */}
        <section className="w-full lg:w-1/2 flex flex-col justify-center px-4 md:px-12 lg:px-[12%] py-24 z-10 relative bg-surface/80 backdrop-blur-sm lg:bg-transparent lg:backdrop-blur-none border-r border-outline-variant/10">
          <div className="max-w-md w-full mx-auto space-y-8">
            {/* Header */}
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-surface-container border border-outline-variant/20 rounded-full mb-2">
                <div className="flex -space-x-2">
                  {['👩', '👨', '👩'].map((e, i) => (
                    <div key={i} className="w-6 h-6 rounded-full border border-surface bg-surface-container-high flex items-center justify-center text-sm">{e}</div>
                  ))}
                </div>
                <span className="text-xs text-on-surface-variant">Join 10,000+ candidates</span>
              </div>
              <h1 className="font-geist font-bold text-2xl md:text-3xl text-on-background">
                Start your journey to interview success
              </h1>
              <p className="text-lg text-slate-muted">
                Create an account to access AI-powered mock interviews and personalized feedback.
              </p>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-error bg-error-container/30 rounded-lg px-3 py-2.5 border border-error-container">
                <span className="material-symbols-outlined text-base">error</span>
                {error}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Full name */}
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-on-surface" htmlFor="fullName">Full Name</label>
                <div className="relative group">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-muted group-focus-within:text-primary transition-colors">person</span>
                  <input
                    id="fullName" type="text" value={fullName} onChange={e => setFullName(e.target.value)}
                    required placeholder="Jane Doe"
                    className="w-full pl-10 pr-4 py-3 bg-surface-container-lowest border border-outline-variant/50 rounded-lg focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all placeholder:text-slate-muted/50 text-base text-on-background shadow-sm hover:border-outline-variant"
                  />
                </div>
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-on-surface" htmlFor="email">Email Address</label>
                <div className="relative group">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-muted group-focus-within:text-primary transition-colors">mail</span>
                  <input
                    id="email" type="email" value={email} onChange={e => setEmail(e.target.value)}
                    required placeholder="jane@example.com"
                    className="w-full pl-10 pr-4 py-3 bg-surface-container-lowest border border-outline-variant/50 rounded-lg focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all placeholder:text-slate-muted/50 text-base text-on-background shadow-sm hover:border-outline-variant"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-on-surface" htmlFor="password">Password</label>
                <div className="relative group">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-muted group-focus-within:text-primary transition-colors">lock</span>
                  <input
                    id="password" type={showPassword ? 'text' : 'password'}
                    value={password} onChange={e => setPassword(e.target.value)}
                    required placeholder="••••••••"
                    className="w-full pl-10 pr-10 py-3 bg-surface-container-lowest border border-outline-variant/50 rounded-lg focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all placeholder:text-slate-muted/50 text-base text-on-background shadow-sm hover:border-outline-variant"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-muted hover:text-on-surface transition-colors"
                  >
                    <span className="material-symbols-outlined text-xl">{showPassword ? 'visibility' : 'visibility_off'}</span>
                  </button>
                </div>
                <p className="text-xs text-slate-muted pt-1">Must be at least 8 characters.</p>
              </div>

              <button
                type="submit" disabled={loading}
                className="w-full bg-primary hover:bg-emerald-deep text-white font-semibold text-base py-3.5 rounded-lg transition-all duration-200 active:scale-[0.98] shadow-sm hover:shadow-md flex justify-center items-center gap-2 disabled:opacity-60"
              >
                {loading ? (
                  <><span className="material-symbols-outlined text-base animate-spin">sync</span>Creating account…</>
                ) : (
                  <>Get Started <span className="material-symbols-outlined text-xl">arrow_forward</span></>
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="relative flex items-center py-2">
              <div className="flex-grow border-t border-outline-variant/30" />
              <span className="flex-shrink-0 mx-4 text-xs text-slate-muted px-2">or continue with</span>
              <div className="flex-grow border-t border-outline-variant/30" />
            </div>

            {/* Social auth */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <OAuthButton provider="google" label="Google" />
              <OAuthButton provider="linkedin" label="LinkedIn" />
            </div>

            <div className="md:hidden text-center pt-4">
              <span className="text-xs text-slate-muted">Already have an account? </span>
              <Link href="/login" className="text-sm font-semibold text-primary hover:underline">Log in</Link>
            </div>
            <p className="text-xs text-slate-muted text-center max-w-xs mx-auto">
              By signing up, you agree to our{' '}
              <span className="text-primary hover:underline cursor-pointer">Terms of Service</span>{' '}and{' '}
              <span className="text-primary hover:underline cursor-pointer">Privacy Policy</span>.
            </p>
          </div>
        </section>

        {/* Right column — visual (desktop only) */}
        <section className="hidden lg:flex w-1/2 bg-surface-container-low relative overflow-hidden flex-col justify-center items-center px-[8%]">
          <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-primary-container/20 rounded-full blur-[80px]" />
          <div className="absolute bottom-[-10%] left-[-10%] w-80 h-80 bg-tertiary-fixed/30 rounded-full blur-[60px]" />
          <div className="relative z-10 w-full max-w-lg space-y-6">
            <div className="bg-surface/60 backdrop-blur-md border border-outline-variant/20 rounded-xl p-8 shadow-sm">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center border border-primary/20">
                  <span className="material-symbols-outlined text-primary text-[28px]">model_training</span>
                </div>
                <div>
                  <h3 className="font-geist font-semibold text-xl text-on-background">AI Interview Coach</h3>
                  <p className="text-xs text-slate-muted">Real-time analysis &amp; feedback</p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="h-2 w-full bg-surface-container rounded-full overflow-hidden">
                  <div className="h-full bg-primary w-[85%] rounded-full relative">
                    <div className="absolute right-0 top-0 bottom-0 w-4 bg-white/30 animate-pulse" />
                  </div>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-muted">Communication Score</span>
                  <span className="text-primary font-bold">85/100</span>
                </div>
              </div>
            </div>
            <div className="bg-surface/80 backdrop-blur-md border border-outline-variant/20 rounded-xl p-6 shadow-sm flex gap-4 ml-8">
              <div className="w-12 h-12 rounded-full bg-emerald-deep/10 border-2 border-surface flex items-center justify-center flex-shrink-0 text-xl">👩</div>
              <div>
                <p className="text-base text-on-surface-variant italic mb-2">
                  &ldquo;MockPrep&apos;s AI gave me the exact feedback I needed to refine my answers. I landed my dream role within weeks.&rdquo;
                </p>
                <p className="text-xs font-bold text-on-background">Sarah J. <span className="font-normal text-slate-muted">— Software Engineer</span></p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
