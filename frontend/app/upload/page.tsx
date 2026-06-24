'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { cv as cvApi, type CandidateProfile } from '@/lib/api'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { toast } from 'sonner'

const NAV_LINKS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/progress',  label: 'History' },
  { href: '/upload',    label: 'Resources', active: true },
  { href: '/profile',   label: 'Profile' },
]

export default function UploadPage() {
  const { loading: authLoading } = useRequireAuth()
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [profile, setProfile] = useState<CandidateProfile | null>(null)
  const [jd, setJd] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [gaps, setGaps] = useState<{ fitScore: number | null; missingSkills: string[]; matchedSkills: string[] } | null>(null)
  const [dragging, setDragging] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) setFile(f)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) setFile(f)
  }

  const handleUpload = async () => {
    if (!file) return
    setUploading(true)
    try {
      const data = await cvApi.upload(file)
      setProfile(data.profile)
      toast.success('CV parsed successfully')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const handleGapAnalysis = async () => {
    if (!jd.trim()) return
    setAnalyzing(true)
    try {
      const data = await cvApi.analyzeGap(jd)
      setGaps(data)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Analysis failed')
    } finally {
      setAnalyzing(false)
    }
  }

  if (authLoading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <span className="material-symbols-outlined text-primary text-4xl animate-spin">sync</span>
    </div>
  )

  return (
    <div className="bg-background text-on-background antialiased min-h-screen flex flex-col">
      {/* Top nav — sticky wrapper includes mobile dropdown */}
      <div className="sticky top-0 z-50">
        <nav className="bg-surface border-b border-outline-variant/15">
          <div className="flex justify-between items-center w-full px-4 md:px-12 max-w-[1280px] mx-auto h-16">
            <div className="font-geist font-bold text-emerald-deep text-xl">MockPrep</div>
            <div className="hidden md:flex space-x-8">
              {NAV_LINKS.map(item => (
                <Link
                  key={item.href} href={item.href}
                  className={`text-sm font-semibold transition-colors cursor-pointer ${
                    item.active ? 'text-primary border-b-2 border-primary pb-1' : 'text-slate-muted hover:text-primary'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
            <button
              onClick={() => setMobileMenuOpen(o => !o)}
              className="flex md:hidden items-center text-on-surface p-1"
              aria-label="Toggle menu"
            >
              <span className="material-symbols-outlined">{mobileMenuOpen ? 'close' : 'menu'}</span>
            </button>
          </div>
        </nav>
        {mobileMenuOpen && (
          <nav className="md:hidden bg-surface border-b border-outline-variant/15 px-4 py-2 flex flex-col">
            {NAV_LINKS.map(item => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center px-3 py-3 rounded-lg font-medium text-sm transition-colors ${
                  item.active ? 'text-primary bg-primary-container/10' : 'text-slate-muted hover:bg-surface-container hover:text-primary'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        )}
      </div>

      <main className="flex-grow w-full max-w-[1280px] mx-auto px-4 md:px-12 py-8 md:py-12">
        {/* Header */}
        <div className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div>
            <Link href="/dashboard" className="inline-flex items-center text-slate-muted hover:text-primary transition-colors mb-4 text-xs font-medium">
              <span className="material-symbols-outlined mr-1 text-base">arrow_back</span>
              Back to Dashboard
            </Link>
            <h1 className="font-geist font-bold text-4xl md:text-5xl text-on-background mb-2">CV Analysis</h1>
            <p className="text-lg text-secondary max-w-2xl">
              {profile
                ? `We've analyzed your CV. Here's your match breakdown and skill gap report.`
                : `Upload your CV and we'll extract your skills and compare them against your target role.`}
            </p>
          </div>
          {gaps?.fitScore != null && (
            <div className="flex items-center gap-4 bg-surface rounded-xl border border-outline-variant/20 p-4 shadow-sm">
              <div className="relative w-16 h-16 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                  <path className="text-surface-variant stroke-current" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" strokeWidth="3"/>
                  <path className="text-primary stroke-current" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" strokeDasharray={`${gaps.fitScore}, 100`} strokeWidth="3"/>
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="font-geist font-semibold text-2xl text-primary">{gaps.fitScore}<span className="text-sm">%</span></span>
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-on-surface">Match Score</h3>
                <p className="text-xs text-slate-muted">
                  {gaps.fitScore >= 75 ? 'Strong Candidate' : gaps.fitScore >= 50 ? 'Good Match' : 'Needs Work'}
                </p>
              </div>
            </div>
          )}
        </div>

        {!profile ? (
          /* Upload zone */
          <div className="max-w-2xl mx-auto space-y-6">
            <div
              onDrop={handleDrop}
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onClick={() => fileRef.current?.click()}
              className={`flex flex-col items-center justify-center w-full min-h-[280px] border-2 border-dashed rounded-xl cursor-pointer transition-all relative overflow-hidden ${
                dragging
                  ? 'border-primary bg-primary-container/10'
                  : 'border-slate-muted/40 bg-surface-bright hover:bg-surface-container-low hover:border-slate-muted/60'
              }`}
            >
              <input ref={fileRef} type="file" accept=".pdf,.docx,.txt" onChange={handleFile} className="hidden" />
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 hover:opacity-100 transition-opacity pointer-events-none" />
              <span className={`material-symbols-outlined text-6xl mb-4 transition-transform duration-300 ${file ? 'text-primary' : 'text-slate-muted'} hover:-translate-y-1`}>description</span>
              {file ? (
                <div className="text-center">
                  <p className="text-base font-semibold text-emerald-deep mb-1">{file.name}</p>
                  <p className="text-xs text-slate-muted">{(file.size / 1024).toFixed(0)} KB — ready to upload</p>
                </div>
              ) : (
                <div className="text-center">
                  <p className="text-sm font-semibold text-ink mb-2">
                    <span className="text-emerald-deep">Click to upload</span> or drag and drop
                  </p>
                  <p className="text-xs text-slate-muted">Supported formats: .pdf, .docx, .txt</p>
                </div>
              )}
            </div>

            <button
              onClick={handleUpload}
              disabled={!file || uploading}
              className="w-full bg-primary text-white font-semibold text-base py-3 rounded-lg disabled:opacity-50 flex items-center justify-center gap-2 hover:bg-emerald-deep transition-colors shadow-sm"
            >
              {uploading ? (
                <><span className="material-symbols-outlined animate-spin text-base">sync</span>Parsing CV…</>
              ) : (
                <><span className="material-symbols-outlined">upload</span>Upload &amp; Parse</>
              )}
            </button>
          </div>
        ) : (
          /* Results layout */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
            {/* Left: CV highlights */}
            <div className="bg-white rounded-xl border border-outline-variant/15 p-6 md:p-8 flex flex-col shadow-sm">
              <div className="flex justify-between items-center mb-6 border-b border-outline-variant/15 pb-4">
                <h2 className="font-geist font-semibold text-2xl text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">description</span>
                  Your CV Highlights
                </h2>
                <button onClick={() => setProfile(null)} className="text-primary hover:text-emerald-deep text-xs font-semibold transition-colors">
                  Upload New CV
                </button>
              </div>

              {/* Parsed profile */}
              {profile.name && (
                <div className="flex items-center gap-3 mb-6 p-4 bg-primary-container/5 rounded-lg border border-primary/10">
                  <span className="material-symbols-outlined text-primary icon-fill text-2xl">verified_user</span>
                  <div>
                    <p className="text-sm font-semibold text-on-surface">{profile.name}</p>
                    <p className="text-xs text-slate-muted">CV successfully parsed</p>
                  </div>
                </div>
              )}

              {(profile.skills?.length ?? 0) > 0 && (
                <div className="bg-surface rounded-lg p-4 border border-outline-variant/10 mb-4">
                  <div className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-primary mt-0.5 icon-fill">check_circle</span>
                    <div>
                      <h4 className="text-sm font-semibold text-on-surface mb-1">Extracted Skills ({profile.skills?.length})</h4>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {profile.skills?.slice(0, 12).map((s: string) => (
                          <span key={s} className="px-2 py-0.5 bg-primary-container/10 text-primary rounded text-xs font-medium border border-primary/20">{s}</span>
                        ))}
                        {(profile.skills?.length ?? 0) > 12 && (
                          <span className="px-2 py-0.5 bg-surface-container text-slate-muted rounded text-xs">+{(profile.skills?.length ?? 0) - 12} more</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {(profile.experience?.length ?? 0) > 0 && (
                <div className="bg-surface rounded-lg p-4 border border-outline-variant/10 mb-4">
                  <div className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-primary mt-0.5 icon-fill">check_circle</span>
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold text-on-surface mb-2">Experience ({profile.experience?.length} roles)</h4>
                      <div className="space-y-1">
                        {profile.experience?.slice(0, 3).map((e, i: number) => (
                          <div key={i} className="text-sm text-secondary">
                            <span className="font-medium text-on-surface">{e.role}</span>
                            {e.company && <span className="text-slate-muted"> @ {e.company}</span>}
                            {e.duration && <span className="text-slate-muted"> · {e.duration}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right: Gap analysis */}
            <div className="bg-white rounded-xl border border-outline-variant/15 p-6 md:p-8 flex flex-col shadow-sm">
              <div className="flex justify-between items-center mb-6 border-b border-outline-variant/15 pb-4">
                <h2 className="font-geist font-semibold text-2xl text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-slate-muted">work</span>
                  Gap Analysis
                </h2>
              </div>

              <div className="flex-grow">
                <h3 className="text-xs font-bold text-on-surface uppercase tracking-wider mb-4">Paste a job description to analyze</h3>
                <textarea
                  value={jd} onChange={e => setJd(e.target.value)}
                  placeholder="Paste key requirements from the job description here..." rows={5} maxLength={10000}
                  className="w-full border border-outline-variant/50 rounded-lg px-4 py-3 bg-surface text-base text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all resize-none mb-4"
                />

                {gaps && (
                  <div className="space-y-4 mb-6">
                    {/* Gap items */}
                    {(gaps.missingSkills?.length ?? 0) > 0 && gaps.missingSkills.map((s: string) => (
                      <div key={s} className="bg-amber-light/30 rounded-lg p-4 border border-amber-light/50 relative overflow-hidden">
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-tertiary-container rounded-l" />
                        <div className="flex items-start gap-3 pl-2">
                          <span className="material-symbols-outlined text-tertiary-container mt-0.5 icon-fill">warning</span>
                          <div>
                            <h4 className="text-sm font-semibold text-on-surface mb-1">{s}</h4>
                            <p className="text-sm text-secondary">Missing from your CV — consider adding relevant experience.</p>
                          </div>
                        </div>
                      </div>
                    ))}

                    {(gaps.matchedSkills?.length ?? 0) > 0 && (
                      <div className="bg-primary-container/5 rounded-lg p-4 border border-primary/10">
                        <div className="flex items-start gap-3">
                          <span className="material-symbols-outlined text-primary mt-0.5 icon-fill">check_circle</span>
                          <div>
                            <h4 className="text-sm font-semibold text-on-surface mb-2">Matched Skills ({gaps.matchedSkills.length})</h4>
                            <div className="flex flex-wrap gap-1.5">
                              {gaps.matchedSkills.slice(0, 10).map((s: string) => (
                                <span key={s} className="px-2 py-0.5 bg-primary-container/15 text-primary rounded text-xs font-medium border border-primary/20">{s}</span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-auto pt-6 border-t border-outline-variant/15 space-y-3">
                <button
                  onClick={handleGapAnalysis}
                  disabled={!jd.trim() || analyzing}
                  className="w-full bg-primary hover:bg-emerald-deep text-white text-sm font-semibold py-3 px-6 rounded-lg transition-colors flex justify-center items-center gap-2 disabled:opacity-50 shadow-sm"
                >
                  {analyzing ? (
                    <><span className="material-symbols-outlined animate-spin text-base">sync</span>Analyzing…</>
                  ) : (
                    <><span className="material-symbols-outlined">auto_fix_high</span>Analyze with AI</>
                  )}
                </button>
                <p className="text-center text-xs text-slate-muted">Generate suggested improvements to bridge skill gaps.</p>
              </div>
            </div>
          </div>
        )}

        {profile && (
          <div className="flex justify-center mt-4">
            <button
              onClick={() => router.push('/interview')}
              className="inline-flex items-center gap-2 bg-primary text-white text-base font-semibold px-8 py-3 rounded-lg hover:bg-emerald-deep transition-colors shadow-sm"
            >
              Start Interview <span className="material-symbols-outlined">arrow_forward</span>
            </button>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-background border-t border-outline-variant/15 mt-auto">
        <div className="w-full py-4 px-4 md:px-12 flex flex-col md:flex-row justify-between items-center max-w-[1280px] mx-auto gap-3 md:gap-0 md:h-16">
          <div className="text-sm font-bold text-emerald-deep">MockPrep</div>
          <div className="text-xs text-slate-muted">© 2024 MockPrep AI. All rights reserved.</div>
          <div className="flex space-x-6">
            {['Privacy Policy', 'Terms of Service', 'Support'].map(l => (
              <span key={l} className="text-xs text-slate-muted hover:text-emerald-deep transition-colors cursor-pointer">{l}</span>
            ))}
          </div>
        </div>
      </footer>
    </div>
  )
}
