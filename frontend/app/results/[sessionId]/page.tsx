'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { interview as interviewApi, type Answer, type Interview, type PanelPersonaFeedback } from '@/lib/api'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { Nav } from '@/components/nav'
import { CheckCircle, ChevronDown, ChevronUp, Mic, RotateCcw, ArrowRight } from 'lucide-react'

function ScoreRing({ score, size = 80 }: { score: number; size?: number }) {
  const r = (size - 8) / 2
  const circ = 2 * Math.PI * r
  const dash = (score / 100) * circ
  const color = score >= 80 ? '#22c55e' : score >= 60 ? '#eab308' : '#ef4444'
  return (
    <svg width={size} height={size}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={4} className="text-border" />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={4}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dasharray 1s ease' }}
      />
      <text x="50%" y="50%" textAnchor="middle" dy="0.35em" className="fill-foreground font-bold" fontSize={size / 4}>
        {score}
      </text>
    </svg>
  )
}

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

  useEffect(() => {
    interviewApi.summary(sessionId)
      .then(d => { setData(d as ResultData); setLoading(false) })
      .catch(() => { router.push('/dashboard') })
  }, [sessionId, router])

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
    </div>
  )
  if (!data) return null

  const { interview, answers } = data
  const overallScore = interview.overallScore ?? 0

  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <div className="pt-14">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <div className="text-center mb-8">
            <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-3" />
            <h1 className="text-2xl font-bold mb-1">Interview Complete</h1>
            <p className="text-muted-foreground">{interview.targetRole || 'Mock Interview'} · {interview.mode}</p>
          </div>

          <div className="flex justify-center mb-8">
            <div className="text-center">
              <ScoreRing score={overallScore} size={120} />
              <p className="text-sm text-muted-foreground mt-2">Overall Score</p>
            </div>
          </div>

          {interview.categoryScores && Object.keys(interview.categoryScores).length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
              {Object.entries(interview.categoryScores).map(([cat, s]) => (
                <div key={cat} className="border border-border rounded-xl p-3 text-center">
                  <div className="text-2xl font-bold">{s.overall}</div>
                  <div className="text-xs text-muted-foreground capitalize">{cat}</div>
                </div>
              ))}
            </div>
          )}

          {interview.mode === 'panel' && (
            interview.panelFeedback
              ? <PanelFeedbackSection feedback={interview.panelFeedback} />
              : (
                <div className="mb-6 border border-border rounded-xl px-4 py-3 text-sm text-muted-foreground">
                  Panel feedback was unavailable for this session. Scores above reflect individual answer scores.
                </div>
              )
          )}

          {data.progress && (
            <div className="border border-border rounded-xl p-4 mb-6 space-y-3">
              <h2 className="font-semibold">Progress Insights</h2>
              {(data.progress.weakAreas?.length ?? 0) > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Weak areas to improve</p>
                  <div className="flex flex-wrap gap-1">
                    {data.progress.weakAreas?.map((a: string) => (
                      <span key={a} className="text-xs bg-red-500/10 text-red-400 px-2 py-0.5 rounded-full">{a}</span>
                    ))}
                  </div>
                </div>
              )}
              {(data.progress.strongAreas?.length ?? 0) > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Strong areas</p>
                  <div className="flex flex-wrap gap-1">
                    {data.progress.strongAreas?.map((a: string) => (
                      <span key={a} className="text-xs bg-green-500/10 text-green-400 px-2 py-0.5 rounded-full">{a}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <h2 className="font-semibold mb-3">Answer Breakdown</h2>
          <div className="space-y-3 mb-8">
            {answers.map((a: Answer, i: number) => {
              const q = typeof a.questionId === 'object' ? a.questionId : null
              const isOpen = expanded === a._id
              const score = a.scores?.overall ?? 0
              return (
                <div key={a._id} className="border border-border rounded-xl overflow-hidden">
                  <button
                    onClick={() => setExpanded(isOpen ? null : a._id)}
                    className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/30"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-muted-foreground w-5">Q{i + 1}</span>
                      <span className="text-sm font-medium line-clamp-1">{q?.text || 'Question'}</span>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {a.inputMethod === 'voice' && <Mic className="w-3.5 h-3.5 text-muted-foreground" />}
                      <span className={`text-sm font-bold ${score >= 80 ? 'text-green-500' : score >= 60 ? 'text-yellow-500' : 'text-red-500'}`}>
                        {a.scored ? score : '—'}
                      </span>
                      {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                    </div>
                  </button>

                  {isOpen && (
                    <div className="px-4 pb-4 border-t border-border space-y-3 pt-3">
                      <p className="text-sm text-muted-foreground">{a.text}</p>

                      {a.scored && (
                        <div className="grid grid-cols-3 gap-2">
                          {(['relevance', 'depth', 'clarity'] as const).map(dim => (
                            <div key={dim} className="border border-border rounded-lg p-2 text-center">
                              <div className="text-lg font-bold">{a.scores[dim]}</div>
                              <div className="text-xs text-muted-foreground capitalize">{dim}</div>
                            </div>
                          ))}
                        </div>
                      )}

                      {a.improvementSuggestions?.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1.5">How to phrase this better</p>
                          <ul className="space-y-1">
                            {a.improvementSuggestions.map((s, j) => (
                              <li key={j} className="text-sm flex gap-2">
                                <span className="text-primary flex-shrink-0">→</span> {s}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {(a.keywordsMissed?.length > 0 || a.keywordsHit?.length > 0) && (
                        <div className="grid sm:grid-cols-2 gap-3 pt-1">
                          {a.keywordsHit?.length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-green-400 mb-1.5">Keywords you used</p>
                              <div className="flex flex-wrap gap-1">
                                {a.keywordsHit.map(k => (
                                  <span key={k} className="text-xs bg-green-500/10 text-green-400 border border-green-500/20 px-2 py-0.5 rounded-full">
                                    {k}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          {a.keywordsMissed?.length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-amber-400 mb-1.5">Keywords to include next time</p>
                              <div className="flex flex-wrap gap-1">
                                {a.keywordsMissed.map(k => (
                                  <span key={k} className="text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full">
                                    {k}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {a.speechMetrics && (
                        <div className="text-xs text-muted-foreground border-t border-border pt-2 flex flex-wrap gap-3">
                          <span>Pace: <b>{a.speechMetrics.wordsPerMinute ?? '?'} wpm</b></span>
                          <span>Fillers: <b>{a.speechMetrics.fillerWordCount}</b></span>
                          <span>Clarity: <b>{a.speechMetrics.pronunciationScore}</b></span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div className="flex gap-3">
            <Link href="/interview" className="flex-1 flex items-center justify-center gap-2 border border-border rounded-lg py-2.5 font-medium text-sm hover:bg-accent">
              <RotateCcw className="w-4 h-4" /> Practice Again
            </Link>
            <Link href="/progress" className="flex-1 flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-lg py-2.5 font-medium text-sm">
              View Progress <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

const PANEL_PERSONA_CONFIG: Record<string, { initials: string; color: string; role: string }> = {
  alex:  { initials: 'A', color: 'bg-blue-500/10 border-blue-500/30 text-blue-400',       role: 'Senior Engineer' },
  priya: { initials: 'P', color: 'bg-purple-500/10 border-purple-500/30 text-purple-400', role: 'Hiring Manager' },
  james: { initials: 'J', color: 'bg-amber-500/10 border-amber-500/30 text-amber-400',    role: 'Bar Raiser' },
}

function PanelFeedbackSection({ feedback }: {
  feedback: { alex: PanelPersonaFeedback; priya: PanelPersonaFeedback; james: PanelPersonaFeedback }
}) {
  return (
    <div className="mb-8">
      <h2 className="font-semibold mb-4">Panel Feedback</h2>
      <div className="space-y-3">
        {(Object.entries(feedback) as [string, PanelPersonaFeedback][]).map(([key, pf]) => {
          const cfg = PANEL_PERSONA_CONFIG[key]
          if (!cfg) return null
          return (
            <div key={key} className={`border rounded-xl p-4 ${cfg.color}`}>
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-9 h-9 rounded-full border flex items-center justify-center text-sm font-bold flex-shrink-0 ${cfg.color}`}>
                  {cfg.initials}
                </div>
                <div>
                  <span className="font-semibold capitalize">{key}</span>
                  <span className="text-xs text-muted-foreground ml-2">— {cfg.role}</span>
                </div>
                <span className={`ml-auto text-lg font-bold ${pf.score >= 80 ? 'text-green-500' : pf.score >= 60 ? 'text-yellow-500' : 'text-red-500'}`}>
                  {pf.score}
                </span>
              </div>
              <p className="text-sm text-muted-foreground mb-3">{pf.summary}</p>
              <div className="grid sm:grid-cols-2 gap-3">
                {pf.strengths.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-green-400 mb-1">Strengths</p>
                    <ul className="space-y-0.5">
                      {pf.strengths.map((s, i) => <li key={i} className="text-xs text-muted-foreground">+ {s}</li>)}
                    </ul>
                  </div>
                )}
                {pf.gaps.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-red-400 mb-1">To Improve</p>
                    <ul className="space-y-0.5">
                      {pf.gaps.map((g, i) => <li key={i} className="text-xs text-muted-foreground">→ {g}</li>)}
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
