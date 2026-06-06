'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { interview as interviewApi, cv as cvApi } from '@/lib/api'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { toast } from 'sonner'

const MODES = [
  {
    id: 'practice',
    label: 'Practice',
    icon: 'school',
    iconBg: 'bg-secondary-container text-on-secondary-container',
    desc: 'Low-pressure environment. Pause, rewind, and ask for hints. Perfect for warming up or tackling new topics.',
    features: [
      { icon: 'schedule', text: 'Untimed' },
      { icon: 'list', text: 'Customizable length' },
    ],
  },
  {
    id: 'timed',
    label: 'Timed Fire',
    icon: 'timer',
    iconBg: 'bg-amber-light text-tertiary-container',
    desc: 'Train your concise answering skills. Strict time limits per question with no pausing allowed.',
    features: [
      { icon: 'schedule', text: '2 mins / question' },
      { icon: 'list', text: '5–10 questions' },
    ],
  },
  {
    id: 'full',
    label: 'Full Mock',
    icon: 'cases',
    iconBg: 'bg-surface-container-high text-on-surface',
    desc: 'A complete end-to-end simulation. Behavioral and technical questions tailored to the job description.',
    features: [
      { icon: 'schedule', text: '45 minutes' },
      { icon: 'analytics', text: 'Detailed scorecard' },
    ],
  },
  {
    id: 'panel',
    label: 'Panel Pressure',
    icon: 'group',
    iconBg: 'bg-error-container text-on-error-container',
    desc: 'Face multiple AI personas with conflicting priorities. Tests your ability to manage complex stakeholder dynamics.',
    features: [
      { icon: 'record_voice_over', text: '3 distinct personas' },
      { icon: 'psychology', text: 'High difficulty' },
    ],
  },
]

export default function InterviewSetupPage() {
  const { loading: authLoading } = useRequireAuth()
  const router = useRouter()
  const [mode, setMode] = useState('practice')
  const [role, setRole] = useState('')
  const [company, setCompany] = useState('')
  const [jd, setJd] = useState('')
  const [loading, setLoading] = useState(false)
  const [cvMissing, setCvMissing] = useState(false)

  useEffect(() => {
    cvApi.profile().catch(() => setCvMissing(true))
  }, [])

  const start = async () => {
    if (cvMissing) {
      router.push('/upload?required=1')
      return
    }
    setLoading(true)
    try {
      const data = await interviewApi.start(mode, role || undefined, jd || undefined, company || undefined)
      router.push(`/interview/${data.sessionId}`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to start interview'
      if (msg === 'cv_required') {
        setCvMissing(true)
        router.push('/upload?required=1')
      } else {
        toast.error(msg)
      }
      setLoading(false)
    }
  }

  if (authLoading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <span className="material-symbols-outlined text-primary text-4xl animate-spin">sync</span>
    </div>
  )

  return (
    <div className="bg-background text-on-background min-h-screen flex flex-col font-sans">
      {/* Top nav */}
      <header className="bg-surface top-0 border-b border-outline-variant/15 w-full px-4 md:px-12 max-w-[1280px] mx-auto h-16 flex justify-between items-center z-50 sticky">
        <div className="flex items-center gap-2">
          <span className="font-geist font-bold text-emerald-deep text-xl">MockPrep</span>
        </div>
        <nav className="hidden md:flex gap-8 h-full">
          {[
            { href: '/dashboard', label: 'Dashboard' },
            { href: '/progress', label: 'History' },
            { href: '/upload', label: 'Resources' },
            { href: '/profile', label: 'Profile' },
          ].map(item => (
            <Link key={item.href} href={item.href} className="flex items-center text-slate-muted text-sm font-semibold hover:text-primary transition-colors cursor-pointer">
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex md:hidden items-center">
          <button className="text-on-surface"><span className="material-symbols-outlined">menu</span></button>
        </div>
      </header>

      <main className="flex-grow w-full max-w-[1280px] mx-auto px-4 md:px-12 py-12">
        <div className="max-w-4xl mx-auto">

          {/* CV gate banner */}
          {cvMissing && (
            <div className="mb-8 flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-5 py-4">
              <span className="material-symbols-outlined text-amber-500 mt-0.5">warning</span>
              <div className="flex-1">
                <p className="font-semibold text-amber-900 text-sm">CV required before starting</p>
                <p className="text-amber-700 text-sm mt-0.5">Questions are personalised from your skills and experience. Upload your CV first so the AI can tailor every question to your background.</p>
              </div>
              <Link href="/upload?required=1" className="shrink-0 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors">
                Upload CV
              </Link>
            </div>
          )}

          <div className="mb-10 text-center md:text-left">
            <Link href="/dashboard" className="inline-flex items-center text-slate-muted hover:text-primary text-xs font-medium mb-4 transition-colors">
              <span className="material-symbols-outlined text-base mr-1">arrow_back</span>
              Back to Dashboard
            </Link>
            <h1 className="font-geist font-bold text-4xl md:text-5xl text-on-background mb-3">Configure Your Session</h1>
            <p className="text-lg text-slate-muted max-w-2xl">
              Tailor your interview experience to match your upcoming goals. Select a mode and provide context for our AI coach.
            </p>
          </div>

          {/* Section 1: Context */}
          <div className="bg-white rounded-2xl border border-outline-variant/15 p-6 md:p-8 mb-8 shadow-sm">
            <div className="flex items-center mb-6">
              <div className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center mr-3">
                <span className="text-sm font-semibold text-primary">1</span>
              </div>
              <h2 className="font-geist font-semibold text-2xl text-on-background">Interview Context</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col">
                <label className="text-sm font-semibold text-on-surface mb-2" htmlFor="company">Target Company (Optional)</label>
                <input
                  id="company" value={company} onChange={e => setCompany(e.target.value)}
                  placeholder="e.g. Google, Stripe, local startup"
                  className="bg-surface-bright border border-outline-variant/50 rounded-lg px-4 py-3 text-base text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                />
              </div>
              <div className="flex flex-col">
                <label className="text-sm font-semibold text-on-surface mb-2" htmlFor="role">Target Role</label>
                <input
                  id="role" value={role} onChange={e => setRole(e.target.value)}
                  placeholder="e.g. Senior Frontend Engineer"
                  className="bg-surface-bright border border-outline-variant/50 rounded-lg px-4 py-3 text-base text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                />
              </div>
              <div className="flex flex-col md:col-span-2">
                <label className="text-sm font-semibold text-on-surface mb-2" htmlFor="jd">Job Description (Paste key requirements)</label>
                <textarea
                  id="jd" value={jd} onChange={e => setJd(e.target.value)}
                  placeholder="Paste relevant parts of the job description here to help generate specific technical or behavioral questions..."
                  rows={4}
                  className="bg-surface-bright border border-outline-variant/50 rounded-lg px-4 py-3 text-base text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all resize-none"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Mode Selection */}
          <div className="mb-10">
            <div className="flex items-center mb-6">
              <div className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center mr-3">
                <span className="text-sm font-semibold text-primary">2</span>
              </div>
              <h2 className="font-geist font-semibold text-2xl text-on-background">Select Mode</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {MODES.map(m => (
                <button
                  key={m.id}
                  onClick={() => setMode(m.id)}
                  className={`text-left cursor-pointer bg-white border-2 rounded-2xl p-6 h-full relative overflow-hidden flex flex-col transition-all duration-300 hover:shadow-[0_10px_25px_-5px_rgba(0,108,73,0.1)] hover:-translate-y-0.5 ${
                    mode === m.id ? 'border-primary shadow-[0_0_0_1px_#006c49] bg-surface/50' : 'border-outline-variant/15 hover:border-outline-variant/40'
                  }`}
                >
                  <div className={`absolute top-4 right-4 text-primary transition-all duration-300 ${mode === m.id ? 'opacity-100 scale-100' : 'opacity-0 scale-75'}`}>
                    <span className="material-symbols-outlined icon-fill">check_circle</span>
                  </div>
                  <div className={`w-12 h-12 rounded-xl ${m.iconBg} flex items-center justify-center mb-4`}>
                    <span className="material-symbols-outlined">{m.icon}</span>
                  </div>
                  <h3 className="font-geist font-semibold text-2xl text-on-background mb-2">{m.label}</h3>
                  <p className="text-base text-slate-muted mb-4 flex-grow">{m.desc}</p>
                  <ul className="space-y-2 mt-auto">
                    {m.features.map(f => (
                      <li key={f.text} className="flex items-center text-xs text-on-surface-variant">
                        <span className="material-symbols-outlined text-base mr-2 text-slate-muted">{f.icon}</span>
                        {f.text}
                      </li>
                    ))}
                  </ul>
                </button>
              ))}
            </div>
          </div>

          {/* Action */}
          <div className="flex justify-end pt-6 border-t border-outline-variant/15">
            <button
              onClick={start} disabled={loading}
              className="bg-primary hover:bg-emerald-deep text-white font-semibold text-lg px-8 py-3 rounded-lg shadow-sm transition-colors flex items-center gap-2 disabled:opacity-60"
            >
              {loading ? (
                <><span className="material-symbols-outlined animate-spin">sync</span>Preparing…</>
              ) : (
                <>Launch Session <span className="material-symbols-outlined">rocket_launch</span></>
              )}
            </button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-background w-full py-3 px-4 md:px-12 flex flex-col md:flex-row justify-between items-center max-w-[1280px] mx-auto border-t border-outline-variant/15 mt-auto gap-4 md:gap-0">
        <span className="text-sm font-bold text-emerald-deep">MockPrep AI</span>
        <span className="text-xs text-slate-muted">© 2024 MockPrep AI. All rights reserved.</span>
        <div className="flex gap-4">
          {['Privacy Policy', 'Terms of Service', 'Support'].map(l => (
            <span key={l} className="text-xs text-slate-muted hover:text-emerald-deep transition-colors cursor-pointer">{l}</span>
          ))}
        </div>
      </footer>
    </div>
  )
}
