'use client'

import { useState, useEffect, useRef } from 'react'
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

const NAV_LINKS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/progress', label: 'History' },
  { href: '/upload', label: 'Resources' },
  { href: '/profile', label: 'Profile' },
]

export default function InterviewSetupPage() {
  const { loading: authLoading } = useRequireAuth()
  const router = useRouter()
  const cvFileRef = useRef<HTMLInputElement>(null)

  const [mode, setMode] = useState('practice')
  const [role, setRole] = useState('')
  const [company, setCompany] = useState('')
  const [jd, setJd] = useState('')
  const [loading, setLoading] = useState(false)
  const [cvChecking, setCvChecking] = useState(true)
  const [cvMissing, setCvMissing] = useState(false)
  const [roleError, setRoleError] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Inline CV upload states
  const [cvFile, setCvFile] = useState<File | null>(null)
  const [cvUploading, setCvUploading] = useState(false)
  const [cvDragging, setCvDragging] = useState(false)
  const [cvExpandUpload, setCvExpandUpload] = useState(false)

  useEffect(() => {
    cvApi.profile()
      .then(() => { setCvMissing(false); setCvChecking(false) })
      .catch(() => { setCvMissing(true); setCvChecking(false) })
  }, [])

  const uploadCvInline = async () => {
    if (!cvFile) return
    setCvUploading(true)
    try {
      await cvApi.upload(cvFile)
      setCvMissing(false)
      setCvFile(null)
      setCvExpandUpload(false)
      toast.success('CV uploaded — questions will be personalised to your background')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setCvUploading(false)
    }
  }

  const start = async () => {
    if (cvMissing) {
      toast.error('Please upload your CV above to personalise your interview questions')
      return
    }
    if (!role.trim()) { setRoleError(true); return }
    setRoleError(false)
    setLoading(true)
    try {
      const data = await interviewApi.start(mode, role.trim(), jd || undefined, company || undefined)
      router.push(`/interview/${data.sessionId}`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to start interview'
      if (msg === 'cv_required') {
        setCvMissing(true)
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

      {/* Top nav — sticky wrapper so mobile menu sticks too */}
      <div className="sticky top-0 z-50">
        <header className="bg-surface border-b border-outline-variant/15 w-full">
          <div className="px-4 md:px-12 max-w-[1280px] mx-auto h-16 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="font-geist font-bold text-emerald-deep text-xl">MockPrep</span>
            </div>
            <nav className="hidden md:flex gap-8 h-full">
              {NAV_LINKS.map(item => (
                <Link key={item.href} href={item.href} className="flex items-center text-slate-muted text-sm font-semibold hover:text-primary transition-colors">
                  {item.label}
                </Link>
              ))}
            </nav>
            <button
              onClick={() => setMobileMenuOpen(o => !o)}
              className="flex md:hidden items-center text-on-surface p-1"
              aria-label="Toggle menu"
            >
              <span className="material-symbols-outlined">{mobileMenuOpen ? 'close' : 'menu'}</span>
            </button>
          </div>
        </header>

        {/* Mobile dropdown menu */}
        {mobileMenuOpen && (
          <nav className="md:hidden bg-surface border-b border-outline-variant/15 px-4 py-2 flex flex-col">
            {NAV_LINKS.map(item => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center px-3 py-3 rounded-lg text-slate-muted hover:bg-surface-container hover:text-primary font-medium text-sm transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        )}
      </div>

      <main className="flex-grow w-full max-w-[1280px] mx-auto px-4 md:px-12 py-8 md:py-12">
        <div className="max-w-4xl mx-auto">

          <div className="mb-8 md:mb-10 text-center md:text-left">
            <Link href="/dashboard" className="inline-flex items-center text-slate-muted hover:text-primary text-xs font-medium mb-4 transition-colors">
              <span className="material-symbols-outlined text-base mr-1">arrow_back</span>
              Back to Dashboard
            </Link>
            <h1 className="font-geist font-bold text-3xl md:text-5xl text-on-background mb-3">Configure Your Session</h1>
            <p className="text-base md:text-lg text-slate-muted max-w-2xl">
              Tailor your interview experience to match your upcoming goals.
            </p>
          </div>

          {/* CV section — always visible once check completes */}
          {!cvChecking && (
            <div className={`bg-white rounded-2xl border mb-8 shadow-sm transition-all ${
              cvMissing ? 'border-2 border-amber-200' : 'border border-outline-variant/15'
            }`}>
              {/* Header row */}
              <div className="flex items-center justify-between p-5 md:p-6">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                    cvMissing ? 'bg-amber-100' : 'bg-primary-container/20'
                  }`}>
                    <span className={`material-symbols-outlined icon-fill text-lg ${cvMissing ? 'text-amber-600' : 'text-primary'}`}>
                      {cvMissing ? 'warning' : 'check_circle'}
                    </span>
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-on-background">
                      {cvMissing ? 'CV required — upload to continue' : 'CV on file'}
                    </p>
                    <p className="text-xs text-slate-muted mt-0.5">
                      {cvMissing
                        ? 'Questions are personalised from your background.'
                        : 'Your questions are tailored to your skills and experience.'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => { setCvExpandUpload(o => !o); setCvFile(null) }}
                  className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors flex items-center gap-1.5 ml-4
                    text-primary border-primary/30 hover:bg-primary-container/10"
                >
                  <span className="material-symbols-outlined text-sm">upload_file</span>
                  {cvExpandUpload ? 'Cancel' : cvMissing ? 'Upload CV' : 'Update CV'}
                </button>
              </div>

              {/* Upload form — always expanded when CV missing, or toggled when CV exists */}
              {(cvMissing || cvExpandUpload) && (
                <div className="px-5 md:px-6 pb-5 md:pb-6 border-t border-outline-variant/15 pt-4">
                  <div
                    onDrop={e => { e.preventDefault(); setCvDragging(false); const f = e.dataTransfer.files[0]; if (f) setCvFile(f) }}
                    onDragOver={e => { e.preventDefault(); setCvDragging(true) }}
                    onDragLeave={() => setCvDragging(false)}
                    onClick={() => cvFileRef.current?.click()}
                    className={`flex flex-col items-center justify-center w-full min-h-[130px] border-2 border-dashed rounded-xl cursor-pointer transition-all ${
                      cvDragging
                        ? 'border-primary bg-primary-container/10'
                        : cvFile
                        ? 'border-primary bg-primary-container/5'
                        : 'border-slate-muted/40 bg-surface-bright hover:bg-surface-container-low hover:border-slate-muted/60'
                    }`}
                  >
                    <input
                      ref={cvFileRef}
                      type="file"
                      accept=".pdf,.docx,.txt"
                      onChange={e => { const f = e.target.files?.[0]; if (f) setCvFile(f) }}
                      className="hidden"
                    />
                    <span className={`material-symbols-outlined text-4xl mb-2 ${cvFile ? 'text-primary' : 'text-slate-muted'}`}>description</span>
                    {cvFile ? (
                      <div className="text-center">
                        <p className="text-sm font-semibold text-emerald-deep">{cvFile.name}</p>
                        <p className="text-xs text-slate-muted mt-1">{(cvFile.size / 1024).toFixed(0)} KB — ready to upload</p>
                      </div>
                    ) : (
                      <div className="text-center px-4">
                        <p className="text-sm font-semibold text-ink"><span className="text-emerald-deep">Click to upload</span> or drag and drop</p>
                        <p className="text-xs text-slate-muted mt-1">Supported: .pdf, .docx, .txt</p>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={uploadCvInline}
                    disabled={!cvFile || cvUploading}
                    className="mt-3 w-full bg-primary text-white font-semibold py-2.5 rounded-lg disabled:opacity-50 flex items-center justify-center gap-2 hover:bg-emerald-deep transition-colors shadow-sm text-sm"
                  >
                    {cvUploading ? (
                      <><span className="material-symbols-outlined animate-spin text-base">sync</span>Parsing CV…</>
                    ) : (
                      <><span className="material-symbols-outlined text-base">upload</span>{cvMissing ? 'Upload & Continue' : 'Upload & Replace'}</>
                    )}
                  </button>

                  <p className="mt-2.5 text-center text-xs text-slate-muted">
                    <Link href="/upload" className="text-primary hover:underline font-medium">Full CV Analysis page</Link>
                    {' '}— gap analysis and skill matching
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Section 1: Context */}
          <div className="bg-white rounded-2xl border border-outline-variant/15 p-6 md:p-8 mb-8 shadow-sm">
            <div className="flex items-center mb-6">
              <div className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center mr-3">
                <span className="text-sm font-semibold text-primary">1</span>
              </div>
              <h2 className="font-geist font-semibold text-xl md:text-2xl text-on-background">Interview Context</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="flex flex-col">
                <label className="text-sm font-semibold text-on-surface mb-2" htmlFor="company">Target Company (Optional)</label>
                <input
                  id="company" value={company} onChange={e => setCompany(e.target.value)}
                  placeholder="e.g. Google, Stripe, local startup"
                  className="bg-surface-bright border border-outline-variant/50 rounded-lg px-4 py-3 text-base text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                />
              </div>
              <div className="flex flex-col">
                <label className="text-sm font-semibold text-on-surface mb-2" htmlFor="role">
                  Target Role <span className="text-error">*</span>
                </label>
                <input
                  id="role" value={role}
                  onChange={e => { setRole(e.target.value); if (e.target.value.trim()) setRoleError(false) }}
                  placeholder="e.g. Senior Frontend Engineer"
                  className={`bg-surface-bright border rounded-lg px-4 py-3 text-base text-on-surface focus:outline-none focus:ring-2 transition-all ${
                    roleError
                      ? 'border-error focus:ring-error/30 focus:border-error'
                      : 'border-outline-variant/50 focus:ring-primary/50 focus:border-primary'
                  }`}
                />
                {roleError && (
                  <p className="text-xs text-error mt-1.5 flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">error</span>
                    Target Role is required to personalise your questions.
                  </p>
                )}
              </div>
              <div className="flex flex-col md:col-span-2">
                <label className="text-sm font-semibold text-on-surface mb-2" htmlFor="jd">Job Description (Optional)</label>
                <textarea
                  id="jd" value={jd} onChange={e => setJd(e.target.value)}
                  placeholder="Paste relevant parts of the job description here to help generate specific technical or behavioral questions…"
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
              <h2 className="font-geist font-semibold text-xl md:text-2xl text-on-background">Select Mode</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
              {MODES.map(m => (
                <button
                  key={m.id}
                  onClick={() => setMode(m.id)}
                  className={`text-left cursor-pointer bg-white border-2 rounded-2xl p-5 md:p-6 h-full relative overflow-hidden flex flex-col transition-all duration-300 hover:shadow-[0_10px_25px_-5px_rgba(0,108,73,0.1)] hover:-translate-y-0.5 ${
                    mode === m.id ? 'border-primary shadow-[0_0_0_1px_#006c49] bg-surface/50' : 'border-outline-variant/15 hover:border-outline-variant/40'
                  }`}
                >
                  <div className={`absolute top-4 right-4 text-primary transition-all duration-300 ${mode === m.id ? 'opacity-100 scale-100' : 'opacity-0 scale-75'}`}>
                    <span className="material-symbols-outlined icon-fill">check_circle</span>
                  </div>
                  <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl ${m.iconBg} flex items-center justify-center mb-3 md:mb-4`}>
                    <span className="material-symbols-outlined">{m.icon}</span>
                  </div>
                  <h3 className="font-geist font-semibold text-xl md:text-2xl text-on-background mb-2">{m.label}</h3>
                  <p className="text-sm md:text-base text-slate-muted mb-4 flex-grow">{m.desc}</p>
                  <ul className="space-y-1.5 mt-auto">
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
              onClick={start} disabled={loading || cvChecking}
              className="w-full sm:w-auto bg-primary hover:bg-emerald-deep text-white font-semibold text-base md:text-lg px-8 py-3 rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {cvChecking ? (
                <><span className="material-symbols-outlined animate-spin">sync</span>Checking profile…</>
              ) : loading ? (
                <><span className="material-symbols-outlined animate-spin">sync</span>Preparing…</>
              ) : (
                <>Launch Session <span className="material-symbols-outlined">rocket_launch</span></>
              )}
            </button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-background w-full py-4 px-4 md:px-12 flex flex-col md:flex-row justify-between items-center max-w-[1280px] mx-auto border-t border-outline-variant/15 mt-auto gap-3 md:gap-0">
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
