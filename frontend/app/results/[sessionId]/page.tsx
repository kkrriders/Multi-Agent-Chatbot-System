'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { interview as interviewApi, type Answer, type Interview, type PanelPersonaFeedback } from '@/lib/api'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { Sidebar } from '@/components/sidebar'
import { Topbar } from '@/components/Topbar'
import { describeIntegritySignals } from '@/lib/integrity'

const SystemDesignCanvas = dynamic(() => import('@/components/SystemDesignCanvas'), { ssr: false })
const CodeEditor = dynamic(() => import('@/components/CodeEditor'), { ssr: false })

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
  const [recentScores, setRecentScores] = useState<{ id: string; score: number; date: string }[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    interviewApi.summary(sessionId)
      .then(d => { setData(d as ResultData); setLoading(false) })
      .catch(() => { router.push('/dashboard') })
    interviewApi.history()
      .then(d => {
        const completed = (d.sessions || [])
          .filter(s => s.status === 'completed' && s.overallScore != null)
          .sort((a, b) => new Date(a.completedAt || a.createdAt).getTime() - new Date(b.completedAt || b.createdAt).getTime())
        const lastFour = completed.slice(-4)
        setRecentScores(lastFour.map(s => ({ id: s._id, score: s.overallScore!, date: new Date(s.completedAt || s.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) })))
      })
      .catch(() => {})
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
  const prevScore = recentScores.length > 1 ? recentScores[recentScores.length - 2].score : null
  const delta = prevScore != null ? overallScore - prevScore : null

  const scoreBarColor = (v: number) => v >= 80 ? 'bg-secondary' : v >= 60 ? 'bg-tertiary' : 'bg-error'
  const scoreBadgeClass = (s: number) => s >= 80
    ? 'text-primary bg-primary-container/20 border-primary-container/30'
    : s >= 60
    ? 'text-tertiary-container bg-amber-light border-tertiary-container/10'
    : 'text-error bg-error-container/20 border-error-container'

  const voiceAnswers = answers.filter(a => a.speechMetrics)
  const totalFillers = voiceAnswers.reduce((s, a) => s + (a.speechMetrics?.fillerWordCount || 0), 0)
  const avgPronunciation = voiceAnswers.length
    ? Math.round(voiceAnswers.reduce((s, a) => s + (a.speechMetrics?.pronunciationScore || 0), 0) / voiceAnswers.length)
    : 0
  const avgWpm = voiceAnswers.filter(a => a.speechMetrics?.wordsPerMinute != null).length
    ? Math.round(voiceAnswers.reduce((s, a) => s + (a.speechMetrics?.wordsPerMinute || 0), 0) / voiceAnswers.filter(a => a.speechMetrics?.wordsPerMinute != null).length)
    : null

  return (
    <div className="bg-background text-on-surface min-h-screen flex font-sans antialiased">
      <Sidebar />
      <Topbar />

      <main className="flex-1 md:ml-64 pt-20 md:pt-24 px-4 md:px-12 pb-24 md:pb-12 w-full max-w-[1280px] mx-auto">
        <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h2 className="font-heading text-3xl md:text-4xl font-bold text-primary">Session Summary</h2>
            <p className="text-lg text-on-surface-variant mt-2">
              {interview.targetRole || 'Mock Interview'} — {interview.mode} interview · {new Date(interview.completedAt || interview.createdAt).toLocaleDateString()}
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/progress" className="px-4 py-2 rounded-lg text-sm font-semibold bg-surface-container-highest text-on-surface-variant hover:bg-surface-dim transition-colors flex items-center gap-1">
              <span className="material-symbols-outlined text-[18px]">bar_chart</span> View Past Interviews
            </Link>
            <Link href="/interview" className="px-4 py-2 rounded-lg text-sm font-semibold bg-secondary/10 text-secondary border border-secondary/20 hover:bg-secondary/20 transition-colors flex items-center gap-1">
              <span className="material-symbols-outlined text-[18px]">replay</span> Practice Again
            </Link>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Score & Trend */}
          <div className="md:col-span-4 blueprint-card rounded-xl p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide">Overall Score</h3>
                {delta != null && (
                  <span className={`inline-flex items-center justify-center px-2 py-1 rounded-full text-xs font-medium border ${delta >= 0 ? 'bg-secondary/10 text-secondary border-secondary/20' : 'bg-error/10 text-error border-error/20'}`}>
                    {delta >= 0 ? '+' : ''}{delta}% from last
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-1">
                <span className="font-heading text-[56px] leading-none font-bold text-primary">{overallScore}</span>
                <span className="text-lg text-on-surface-variant">/ 100</span>
              </div>
              <p className="text-sm text-on-surface-variant mt-2">
                {overallScore >= 80 ? 'Excellent performance! Keep refining the details.' : overallScore >= 60 ? 'Good effort — focus on elaborating your weaker answers.' : 'Room to improve — review the tips below.'}
              </p>
            </div>
            {recentScores.length > 1 && (
              <div className="mt-6 pt-6 border-t border-outline-variant/20">
                <h4 className="text-xs font-semibold text-on-surface-variant uppercase mb-4">Recent Trend</h4>
                <div className="h-20 w-full flex items-end justify-between gap-1">
                  {recentScores.map((s, i) => (
                    <div
                      key={s.id}
                      className={`w-full rounded-t-sm ${i === recentScores.length - 1 ? 'bg-secondary shadow-[0_0_12px_rgba(0,102,138,0.3)]' : 'bg-surface-container'}`}
                      style={{ height: `${Math.max(8, s.score)}%` }}
                      title={`${s.score}`}
                    />
                  ))}
                </div>
                <div className="flex justify-between mt-1 text-xs text-outline">
                  {recentScores.map((s, i) => (
                    <span key={s.id} className={i === recentScores.length - 1 ? 'text-secondary font-medium' : ''}>
                      {i === recentScores.length - 1 ? 'Today' : s.date}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Category Breakdown */}
          <div className="md:col-span-8 blueprint-card rounded-xl p-6">
            <h3 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide mb-6">Category Breakdown</h3>
            <div className="space-y-6">
              {Object.keys(categoryScores).length > 0 ? (
                Object.entries(categoryScores).map(([cat, sc]) => (
                  <div key={cat}>
                    <div className="flex justify-between items-end mb-2">
                      <h4 className="font-semibold text-primary capitalize">{cat}</h4>
                      <span className="font-heading text-xl font-bold text-primary">{sc.overall}<span className="text-sm text-on-surface-variant">/100</span></span>
                    </div>
                    <div className="w-full h-2 bg-surface-container-high rounded-full overflow-hidden">
                      <div className={`h-full ${scoreBarColor(sc.overall)} rounded-full transition-all duration-700`} style={{ width: `${sc.overall}%` }} />
                    </div>
                  </div>
                ))
              ) : (
                [
                  { label: 'Relevance', pct: Math.min(100, Math.round(overallScore * 1.07)) },
                  { label: 'Depth',     pct: Math.min(100, Math.round(overallScore * 0.89)) },
                  { label: 'Clarity',   pct: Math.min(100, Math.round(overallScore * 1.05)) },
                ].map(({ label, pct }) => (
                  <div key={label}>
                    <div className="flex justify-between items-end mb-2">
                      <h4 className="font-semibold text-primary">{label}</h4>
                      <span className="font-heading text-xl font-bold text-primary">{pct}<span className="text-sm text-on-surface-variant">/100</span></span>
                    </div>
                    <div className="w-full h-2 bg-surface-container-high rounded-full overflow-hidden">
                      <div className={`h-full ${scoreBarColor(pct)} rounded-full`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Panel feedback */}
          {interview.mode === 'panel' && interview.panelFeedback && (
            <div className="md:col-span-12">
              <PanelFeedbackSection feedback={interview.panelFeedback} />
            </div>
          )}

          {/* Speech Analysis & Question Review */}
          {voiceAnswers.length > 0 && (
            <div className="md:col-span-4 blueprint-card rounded-xl p-6">
              <div className="flex items-center gap-2 mb-6">
                <span className="material-symbols-outlined text-tertiary">record_voice_over</span>
                <h3 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide">Speech Analysis</h3>
              </div>
              <div className="grid grid-cols-2 gap-2 mb-6">
                <div className="bg-surface/60 rounded-lg p-4 border border-outline-variant/10 text-center">
                  <span className="block font-heading text-2xl font-bold text-primary">{totalFillers}</span>
                  <span className="block text-xs text-on-surface-variant mt-1">Filler Words</span>
                </div>
                <div className="bg-surface/60 rounded-lg p-4 border border-outline-variant/10 text-center">
                  <span className="block font-heading text-2xl font-bold text-primary">{avgWpm ?? '—'}</span>
                  <span className="block text-xs text-on-surface-variant mt-1">Words / Min</span>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-on-surface-variant">Pronunciation Clarity</span>
                  <span className="text-primary font-semibold">{avgPronunciation >= 85 ? 'High' : avgPronunciation >= 60 ? 'Moderate' : 'Low'}</span>
                </div>
                <div className="w-full h-1.5 bg-surface-container-high rounded-full overflow-hidden">
                  <div className="h-full bg-secondary rounded-full" style={{ width: `${avgPronunciation}%` }} />
                </div>
              </div>
              {totalFillers > 3 && (
                <div className="mt-6 p-4 rounded-lg bg-inverse-primary/20 border border-inverse-primary/30">
                  <p className="text-sm text-primary flex gap-2 items-start">
                    <span className="material-symbols-outlined text-[18px] text-tertiary shrink-0 mt-0.5">lightbulb</span>
                    Try pausing briefly instead of using filler words — it reads as more confident.
                  </p>
                </div>
              )}
            </div>
          )}

          <div className={voiceAnswers.length > 0 ? 'md:col-span-8' : 'md:col-span-12'}>
            <h3 className="font-heading text-2xl font-bold text-primary mb-4">Question Review</h3>
            <div className="space-y-4">
              {answers.map((a: Answer, i: number) => {
                const q = typeof a.questionId === 'object' ? a.questionId : null
                const isOpen = expanded === a._id
                const score = a.scores?.overall ?? 0
                const borderColor = !a.scored ? 'border-l-outline-variant' : score >= 70 ? 'border-l-secondary' : 'border-l-error/50'
                return (
                  <div key={a._id} className={`blueprint-card rounded-xl border-l-4 ${borderColor} overflow-hidden`}>
                    <button
                      onClick={() => setExpanded(isOpen ? null : a._id)}
                      className="w-full flex items-start justify-between gap-4 p-6 text-left hover:bg-surface-container-high/20 transition-colors"
                    >
                      <div>
                        <span className="text-xs font-semibold text-secondary uppercase tracking-wider mb-1 block">Question {i + 1}{q?.category ? ` • ${q.category}` : ''}</span>
                        <h4 className="text-base font-medium text-primary">{q?.text || 'Question'}</h4>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {a.inputMethod === 'voice' && <span className="material-symbols-outlined text-base text-slate-muted icon-fill">mic</span>}
                        {a.integrityFlag && a.integrityFlag !== 'CLEAN' && (
                          <span className="material-symbols-outlined text-base text-error icon-fill" title={a.integrityFlag === 'LIKELY_AI' ? 'Flagged as likely pasted / AI-generated' : 'Flagged as suspicious'}>
                            warning
                          </span>
                        )}
                        {a.scored && (
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${scoreBadgeClass(score)}`}>
                            {score}/100
                          </span>
                        )}
                        <span className="material-symbols-outlined text-slate-muted text-base">{isOpen ? 'expand_less' : 'expand_more'}</span>
                      </div>
                    </button>

                    {isOpen && (
                      <div className="px-6 pb-6 space-y-4">
                        <div className="bg-surface-container/50 rounded-lg p-4">
                          {q?.questionFormat === 'system_design' && a.diagramSnapshot ? (
                            <div style={{ height: 360 }}>
                              <SystemDesignCanvas initialDiagram={a.diagramSnapshot} readonly />
                            </div>
                          ) : q?.questionFormat === 'coding' && a.code ? (
                            <div style={{ height: 420 }}>
                              <CodeEditor
                                starterCode={a.code}
                                initialLanguage={a.language || 'javascript'}
                                testResults={a.testResults}
                                codeScore={a.codeScore}
                                readonly
                              />
                            </div>
                          ) : (
                            <p className="text-sm text-on-surface-variant">{a.text}</p>
                          )}
                        </div>
                        {a.integrityFlag && a.integrityFlag !== 'CLEAN' && (
                          <div className="flex items-start gap-1.5 bg-error/10 border border-error/30 rounded-lg p-2.5 text-xs text-error">
                            <span className="material-symbols-outlined text-sm shrink-0 icon-fill">warning</span>
                            <div>
                              <p className="font-semibold">
                                {a.integrityFlag === 'LIKELY_AI' ? 'Flagged as likely pasted / AI-generated' : 'Flagged as suspicious'}
                              </p>
                              {typeof a.scores.rawOverall === 'number' && a.scores.rawOverall !== score && (
                                <p className="text-error/80 mt-0.5">Content quality was {a.scores.rawOverall}, discounted to {score} for this reason.</p>
                              )}
                              {describeIntegritySignals(a.integritySignals).map((line, k) => (
                                <p key={k} className="text-error/80 mt-0.5">{line}</p>
                              ))}
                            </div>
                          </div>
                        )}
                        {a.scored && (
                          <div className="grid grid-cols-3 gap-2">
                            {(['relevance', 'depth', 'clarity'] as const).map(dim => (
                              <div key={dim} className="border border-outline-variant/20 rounded-lg p-2 text-center bg-surface-container-lowest">
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
    <div>
      <h3 className="font-heading text-2xl font-bold text-primary mb-4">Panel Feedback</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {(Object.entries(feedback) as [string, PanelPersonaFeedback][]).map(([key, pf]) => {
          const cfg = PANEL_PERSONA_CONFIG[key]
          if (!cfg) return null
          return (
            <div key={key} className={`blueprint-card rounded-xl p-6 border-t-4 ${cfg.colorClass}`}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-surface flex items-center justify-center text-xl flex-shrink-0">{cfg.emoji}</div>
                <div>
                  <span className="font-semibold text-on-surface capitalize">{key}</span>
                  <span className="text-xs text-slate-muted block">{cfg.role}</span>
                </div>
                <span className={`ml-auto text-xl font-bold ${pf.score >= 80 ? 'text-primary' : pf.score >= 60 ? 'text-tertiary-container' : 'text-error'}`}>
                  {pf.score}
                </span>
              </div>
              <p className="text-sm text-slate-muted mb-3">{pf.summary}</p>
              <div className="space-y-3">
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
