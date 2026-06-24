'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { interview as interviewApi, type Answer, type Interview, type PanelPersonaFeedback } from '@/lib/api'
import { useRequireAuth } from '@/hooks/useRequireAuth'

interface ResultData {
  interview: Interview
  answers: Answer[]
  progress?: { weakAreas?: string[]; strongAreas?: string[] }
}

export default function ResultsPage() {
  useRequireAuth()
  const params = useParams()
  const router = useRouter()
  const sessionId = params.sessionId as string

  const [data, setData] = useState<ResultData | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    interviewApi.summary(sessionId)
      .then(d => { setData(d as ResultData); setLoading(false) })
      .catch(() => { router.push('/dashboard') })
  }, [sessionId, router])

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <span className="material-symbols-outlined text-primary text-4xl animate-spin">sync</span>
    </div>
  )
  if (!data) return null

  const { interview, answers } = data
  const overallScore = interview.overallScore ?? 0
  const categoryScores = interview.categoryScores ?? {}

  const scoreBarColor = (v: number) => v >= 80 ? 'bg-emerald-deep' : v >= 60 ? 'bg-tertiary-container' : 'bg-error'
  const scoreBadgeClass = (s: number) => s >= 80
    ? 'text-primary bg-primary-container/20 border-primary-container/30'
    : s >= 60
    ? 'text-tertiary-container bg-amber-light border-tertiary-container/10'
    : 'text-error bg-error-container/20 border-error-container'

  return (
    <div className="bg-background text-on-surface min-h-screen flex flex-col font-sans">
      {/* Top nav */}
      <div className="sticky top-0 z-50">
        <header className="bg-surface border-b border-outline-variant/15 w-full">
          <div className="flex justify-between items-center w-full px-4 md:px-12 max-w-[1280px] mx-auto h-16">
            <div className="font-geist font-bold text-emerald-deep text-xl cursor-pointer">MockPrep</div>
            <nav className="hidden md:flex gap-8 items-center h-full">
              {[
                { href: '/dashboard', label: 'Dashboard' },
                { href: '/progress',  label: 'History',   active: true },
                { href: '/upload',    label: 'Resources' },
                { href: '/profile',   label: 'Profile' },
              ].map(item => (
                <Link
                  key={item.href} href={item.href}
                  className={`text-sm font-semibold h-full flex items-center border-b-2 transition-colors cursor-pointer ${
                    item.active
                      ? 'text-primary border-primary pt-1'
                      : 'text-slate-muted border-transparent hover:text-primary'
                  }`}
                >
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
        {mobileMenuOpen && (
          <nav className="md:hidden bg-surface border-b border-outline-variant/15 px-4 py-2 flex flex-col">
            {[
              { href: '/dashboard', label: 'Dashboard' },
              { href: '/progress',  label: 'History' },
              { href: '/upload',    label: 'Resources' },
              { href: '/profile',   label: 'Profile' },
            ].map(item => (
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

      <main className="flex-grow w-full max-w-[1280px] mx-auto px-4 md:px-12 py-12 md:py-16">
        {/* Page header */}
        <div className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <h1 className="font-geist font-bold text-2xl md:text-3xl text-ink">Session Summary Report</h1>
            <p className="text-base text-slate-muted mt-2">
              {interview.targetRole || 'Mock Interview'} · {interview.mode} · Completed {new Date(interview.completedAt || interview.createdAt).toLocaleDateString()}
            </p>
          </div>
          <div className="flex gap-4 w-full md:w-auto">
            <Link href="/progress" className="flex-1 md:flex-none px-6 py-2.5 rounded-lg border border-outline text-on-surface text-sm font-semibold hover:bg-surface-container transition-colors shadow-sm">
              View Past Interviews
            </Link>
            <Link href="/interview" className="flex-1 md:flex-none px-6 py-2.5 rounded-lg bg-emerald-deep text-white text-sm font-semibold hover:bg-primary transition-colors shadow-sm flex items-center justify-center gap-2">
              <span className="material-symbols-outlined text-lg">replay</span>
              Practice Again
            </Link>
          </div>
        </div>

        {/* Bento grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Score ring */}
          <div className="col-span-1 md:col-span-5 lg:col-span-4 bg-surface rounded-xl p-8 border border-outline-variant/30 flex flex-col items-center justify-center relative overflow-hidden shadow-sm">
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary-container/20 rounded-full blur-2xl" />
            <h2 className="font-geist font-semibold text-2xl text-ink w-full text-center mb-6">Final Score</h2>
            <div className="relative w-48 h-48 flex items-center justify-center">
              <svg className="w-full h-full absolute transform -rotate-90" viewBox="0 0 36 36">
                <path className="text-surface-container stroke-current" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" strokeWidth="3"/>
                <path
                  className="text-emerald-deep stroke-current"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  strokeDasharray={`${overallScore}, 100`}
                  strokeLinecap="round"
                  strokeWidth="3"
                  style={{ transition: 'stroke-dasharray 1.5s ease-out' }}
                />
              </svg>
              <div className="flex flex-col items-center z-10">
                <div className="font-geist font-bold text-5xl text-emerald-deep leading-none">{overallScore}</div>
                <div className="text-xs text-slate-muted mt-1 uppercase tracking-wider">Out of 100</div>
              </div>
            </div>
            <div className="mt-6 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-container-low border border-outline-variant/50">
              <span className="material-symbols-outlined text-emerald-deep icon-fill text-base">trending_up</span>
              <span className="text-xs text-on-surface font-medium">
                {overallScore >= 80 ? 'Excellent performance!' : overallScore >= 60 ? 'Good effort — keep going' : 'Room to improve — review tips below'}
              </span>
            </div>
          </div>

          {/* Performance breakdown */}
          <div className="col-span-1 md:col-span-7 lg:col-span-8 flex flex-col gap-6">
            {/* Category scores */}
            <div className="bg-surface rounded-xl p-8 border border-outline-variant/30 shadow-sm flex-grow">
              <h2 className="font-geist font-semibold text-2xl text-ink mb-6 flex items-center gap-2">
                <span className="material-symbols-outlined text-slate-muted">bar_chart</span>
                Performance Breakdown
              </h2>
              <div className="space-y-6">
                {Object.keys(categoryScores).length > 0 ? (
                  Object.entries(categoryScores).map(([cat, sc]) => (
                    <div key={cat}>
                      <div className="flex justify-between items-end mb-2">
                        <span className="text-sm font-semibold text-on-surface capitalize">{cat}</span>
                        <span className="text-xs text-slate-muted">{sc.overall}%</span>
                      </div>
                      <div className="h-2 w-full bg-surface-container rounded-full overflow-hidden">
                        <div className={`h-full ${scoreBarColor(sc.overall)} rounded-full transition-all duration-700`} style={{ width: `${sc.overall}%` }} />
                      </div>
                    </div>
                  ))
                ) : (
                  [
                    { label: 'Relevance',  pct: Math.min(100, Math.round(overallScore * 1.07)) },
                    { label: 'Depth',      pct: Math.min(100, Math.round(overallScore * 0.89)) },
                    { label: 'Clarity',    pct: Math.min(100, Math.round(overallScore * 1.05)) },
                  ].map(({ label, pct }) => (
                    <div key={label}>
                      <div className="flex justify-between items-end mb-2">
                        <span className="text-sm font-semibold text-on-surface">{label}</span>
                        <span className="text-xs text-slate-muted">{pct}%</span>
                      </div>
                      <div className="h-2 w-full bg-surface-container rounded-full overflow-hidden">
                        <div className={`h-full ${scoreBarColor(pct)} rounded-full`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Speech metrics */}
            {answers.some(a => a.speechMetrics) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {(() => {
                  const voiceAnswers = answers.filter(a => a.speechMetrics)
                  const totalFillers = voiceAnswers.reduce((s, a) => s + (a.speechMetrics?.fillerWordCount || 0), 0)
                  const avgPronunciation = voiceAnswers.length
                    ? Math.round(voiceAnswers.reduce((s, a) => s + (a.speechMetrics?.pronunciationScore || 0), 0) / voiceAnswers.length)
                    : 0
                  return (
                    <>
                      <div className="bg-surface rounded-xl p-6 border border-outline-variant/30 shadow-sm flex items-start gap-4">
                        <div className="w-10 h-10 rounded-full bg-amber-light flex items-center justify-center flex-shrink-0 mt-1">
                          <span className="material-symbols-outlined text-on-tertiary-container">record_voice_over</span>
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-ink mb-1">Filler Words</h3>
                          <p className="text-lg font-semibold text-on-surface mb-1">{totalFillers} detected</p>
                          <p className="text-xs text-slate-muted">{totalFillers <= 3 ? 'Excellent pacing — well below average.' : 'Try to pause instead of using filler words.'}</p>
                        </div>
                      </div>
                      <div className="bg-surface rounded-xl p-6 border border-outline-variant/30 shadow-sm flex items-start gap-4">
                        <div className="w-10 h-10 rounded-full bg-primary-container/20 flex items-center justify-center flex-shrink-0 mt-1">
                          <span className="material-symbols-outlined text-emerald-deep icon-fill">campaign</span>
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-ink mb-1">Pronunciation</h3>
                          <p className="text-lg font-semibold text-emerald-deep mb-1">{avgPronunciation}% Confidence</p>
                          <p className="text-xs text-slate-muted">{avgPronunciation >= 85 ? 'Clear articulation across complex terminology.' : 'Continue practicing to improve clarity.'}</p>
                        </div>
                      </div>
                    </>
                  )
                })()}
              </div>
            )}
          </div>

          {/* Panel feedback */}
          {interview.mode === 'panel' && interview.panelFeedback && (
            <div className="col-span-1 md:col-span-12">
              <PanelFeedbackSection feedback={interview.panelFeedback} />
            </div>
          )}

          {/* Answer breakdown */}
          <div className="col-span-1 md:col-span-12 bg-surface-container-low rounded-xl p-8 border border-outline-variant/20 shadow-sm">
            <h2 className="font-geist font-semibold text-2xl text-ink mb-6 flex items-center gap-2">
              <span className="material-symbols-outlined text-tertiary-container icon-fill">lightbulb</span>
              Answer Breakdown
            </h2>
            <div className="space-y-3">
              {answers.map((a: Answer, i: number) => {
                const q = typeof a.questionId === 'object' ? a.questionId : null
                const isOpen = expanded === a._id
                const score = a.scores?.overall ?? 0
                return (
                  <div key={a._id} className="bg-surface rounded-lg border border-outline-variant/15 overflow-hidden">
                    <button
                      onClick={() => setExpanded(isOpen ? null : a._id)}
                      className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-surface-container-lowest/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-slate-muted w-5">Q{i + 1}</span>
                        <span className="text-sm font-medium text-on-surface line-clamp-1">{q?.text || 'Question'}</span>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        {a.inputMethod === 'voice' && <span className="material-symbols-outlined text-base text-slate-muted icon-fill">mic</span>}
                        {a.scored && (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${scoreBadgeClass(score)}`}>
                            {score}/100
                          </span>
                        )}
                        <span className="material-symbols-outlined text-slate-muted text-base">{isOpen ? 'expand_less' : 'expand_more'}</span>
                      </div>
                    </button>

                    {isOpen && (
                      <div className="px-4 pb-4 border-t border-outline-variant/15 space-y-3 pt-3">
                        <p className="text-sm text-slate-muted">{a.text}</p>
                        {a.scored && (
                          <div className="grid grid-cols-3 gap-2">
                            {(['relevance', 'depth', 'clarity'] as const).map(dim => (
                              <div key={dim} className="border border-outline-variant/20 rounded-lg p-2 text-center bg-white">
                                <div className={`text-lg font-bold ${scoreBarColor(a.scores[dim]).replace('bg-', 'text-')}`}>{a.scores[dim]}</div>
                                <div className="text-xs text-slate-muted capitalize">{dim}</div>
                              </div>
                            ))}
                          </div>
                        )}
                        {a.improvementSuggestions?.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-slate-muted mb-1.5">How to improve</p>
                            <ul className="space-y-1">
                              {a.improvementSuggestions.map((s, j) => (
                                <li key={j} className="text-sm flex gap-2 text-on-surface">
                                  <span className="text-primary flex-shrink-0">→</span>{s}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {(a.keywordsHit?.length > 0 || a.keywordsMissed?.length > 0) && (
                          <div className="grid sm:grid-cols-2 gap-3 pt-1">
                            {a.keywordsHit?.length > 0 && (
                              <div>
                                <p className="text-xs font-semibold text-primary mb-1.5">Keywords used</p>
                                <div className="flex flex-wrap gap-1">
                                  {a.keywordsHit.map(k => (
                                    <span key={k} className="text-xs bg-primary-container/20 text-primary px-2 py-0.5 rounded-full border border-primary/20">{k}</span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {a.keywordsMissed?.length > 0 && (
                              <div>
                                <p className="text-xs font-semibold text-tertiary-container mb-1.5">Keywords to include</p>
                                <div className="flex flex-wrap gap-1">
                                  {a.keywordsMissed.map(k => (
                                    <span key={k} className="text-xs bg-amber-light text-tertiary-container px-2 py-0.5 rounded-full border border-tertiary-container/20">{k}</span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </main>

      <footer className="bg-background border-t border-outline-variant/15 w-full mt-auto">
        <div className="w-full py-3 px-4 md:px-12 flex flex-col sm:flex-row justify-between items-center max-w-[1280px] mx-auto gap-4">
          <div className="text-sm font-bold text-emerald-deep">MockPrep</div>
          <div className="text-xs text-slate-muted">© 2024 MockPrep AI. All rights reserved.</div>
          <div className="flex gap-6">
            {['Privacy Policy', 'Terms of Service', 'Support'].map(l => (
              <span key={l} className="text-xs text-slate-muted hover:text-emerald-deep transition-colors cursor-pointer">{l}</span>
            ))}
          </div>
        </div>
      </footer>
    </div>
  )
}

const PANEL_PERSONA_CONFIG: Record<string, { emoji: string; role: string; colorClass: string }> = {
  alex:  { emoji: '👨', role: 'Senior Engineer',  colorClass: 'border-primary/20 bg-primary-container/10' },
  priya: { emoji: '👩', role: 'Hiring Manager',   colorClass: 'border-secondary-container bg-secondary-container/30' },
  james: { emoji: '🧔', role: 'Bar Raiser',       colorClass: 'border-amber-light bg-amber-light/30' },
}

function PanelFeedbackSection({ feedback }: {
  feedback: { alex: PanelPersonaFeedback; priya: PanelPersonaFeedback; james: PanelPersonaFeedback }
}) {
  return (
    <div className="mb-6">
      <h2 className="font-geist font-semibold text-2xl text-ink mb-4">Panel Feedback</h2>
      <div className="space-y-3">
        {(Object.entries(feedback) as [string, PanelPersonaFeedback][]).map(([key, pf]) => {
          const cfg = PANEL_PERSONA_CONFIG[key]
          if (!cfg) return null
          return (
            <div key={key} className={`border rounded-xl p-6 ${cfg.colorClass}`}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-surface flex items-center justify-center text-xl flex-shrink-0">{cfg.emoji}</div>
                <div>
                  <span className="font-semibold text-on-surface capitalize">{key}</span>
                  <span className="text-xs text-slate-muted ml-2">— {cfg.role}</span>
                </div>
                <span className={`ml-auto text-xl font-bold ${pf.score >= 80 ? 'text-primary' : pf.score >= 60 ? 'text-tertiary-container' : 'text-error'}`}>
                  {pf.score}
                </span>
              </div>
              <p className="text-sm text-slate-muted mb-3">{pf.summary}</p>
              <div className="grid sm:grid-cols-2 gap-3">
                {pf.strengths.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-primary mb-1">Strengths</p>
                    <ul className="space-y-0.5">
                      {pf.strengths.map((s, i) => <li key={i} className="text-xs text-slate-muted">+ {s}</li>)}
                    </ul>
                  </div>
                )}
                {pf.gaps.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-error mb-1">To Improve</p>
                    <ul className="space-y-0.5">
                      {pf.gaps.map((g, i) => <li key={i} className="text-xs text-slate-muted">→ {g}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
