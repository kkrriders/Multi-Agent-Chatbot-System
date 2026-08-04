'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { interview as interviewApi, GUEST_LIMIT_ERROR } from '@/lib/api'
import { GuestLimitPrompt } from '@/components/GuestLimitPrompt'
import { ThemeToggle } from '@/components/ThemeToggle'

interface PreviewQuestion {
  id: string
  text: string
  category: string
  difficulty: string
  questionFormat?: string
}

interface ScoreResult {
  scores: { relevance: number; depth: number; clarity: number; overall: number }
  improvementSuggestions: string[]
  keywordsHit: string[]
  keywordsMissed: string[]
  evidence: string
}

export default function InterviewPreviewPage() {
  const router = useRouter()
  const [questions, setQuestions] = useState<PreviewQuestion[] | null>(null)
  const [mode, setMode] = useState('practice')
  const [index, setIndex] = useState(0)
  const [answer, setAnswer] = useState('')
  const [scoring, setScoring] = useState(false)
  const [result, setResult] = useState<ScoreResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [guestLimitHit, setGuestLimitHit] = useState(false)

  useEffect(() => {
    const raw = sessionStorage.getItem('mockprep_guest_preview')
    if (!raw) { router.replace('/interview'); return }
    try {
      const parsed = JSON.parse(raw) as { mode: string; questions: PreviewQuestion[] }
      setMode(parsed.mode)
      setQuestions(parsed.questions)
    } catch {
      router.replace('/interview')
    }
  }, [router])

  const current = questions?.[index]
  const isLast = questions ? index === questions.length - 1 : false

  const submitAnswer = async () => {
    if (!current || !answer.trim()) return
    setScoring(true)
    setError(null)
    try {
      const res = await interviewApi.previewAnswer(current.text, answer.trim())
      setResult(res)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Scoring failed'
      if (msg === GUEST_LIMIT_ERROR) setGuestLimitHit(true)
      else setError(msg)
    } finally {
      setScoring(false)
    }
  }

  const next = () => {
    setAnswer('')
    setResult(null)
    setError(null)
    setIndex(i => i + 1)
  }

  if (!questions) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <span className="material-symbols-outlined text-primary text-4xl animate-spin">sync</span>
    </div>
  )

  return (
    <div className="bg-background text-on-background min-h-screen font-sans antialiased">
      <header className="border-b border-outline-variant/15 px-4 md:px-8 h-16 flex items-center justify-between">
        <Link href="/interview" className="flex items-center gap-2 text-slate-muted hover:text-primary text-sm font-medium transition-colors">
          <span className="material-symbols-outlined text-base">arrow_back</span>
          Exit preview
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-slate-muted uppercase tracking-wider capitalize">{mode} preview</span>
          <ThemeToggle />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 md:px-0 py-10 md:py-16">
        {guestLimitHit ? (
          <GuestLimitPrompt message="You've used your free interview previews. Create a free account for full sessions, history, and progress tracking." />
        ) : !current ? (
          <div className="text-center py-16">
            <span className="material-symbols-outlined text-primary text-5xl icon-fill mb-4">check_circle</span>
            <h1 className="font-geist font-bold text-2xl md:text-3xl mb-2">Nice work!</h1>
            <p className="text-slate-muted mb-8">That's the end of your free preview. Create a free account for full personalised sessions, unlimited practice, and progress tracking.</p>
            <div className="flex items-center justify-center gap-3">
              <Link href="/login" className="text-sm font-semibold text-primary px-5 py-2.5 rounded-lg border border-primary/30 hover:bg-primary-container/10 transition-colors">Log in</Link>
              <Link href="/signup" className="text-sm font-semibold bg-primary text-on-primary px-6 py-2.5 rounded-lg hover:opacity-90 transition-opacity">Sign up free</Link>
            </div>
          </div>
        ) : (
          <>
            <p className="text-xs font-semibold text-slate-muted uppercase tracking-wider mb-2">
              Question {index + 1} of {questions.length} · {current.category}
            </p>
            <h1 className="font-geist font-bold text-xl md:text-2xl text-on-background mb-6">{current.text}</h1>

            <textarea
              value={answer}
              onChange={e => setAnswer(e.target.value)}
              disabled={!!result}
              rows={6}
              placeholder="Type your answer…"
              className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-lg px-4 py-3 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all resize-none disabled:opacity-70"
            />

            {error && <p className="text-xs text-red-600 dark:text-red-400 mt-2">{error}</p>}

            {!result ? (
              <button
                onClick={submitAnswer}
                disabled={scoring || !answer.trim()}
                className="mt-4 w-full sm:w-auto bg-primary text-on-primary font-semibold text-sm px-6 py-2.5 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {scoring ? <><span className="material-symbols-outlined animate-spin text-base">sync</span>Scoring…</> : 'Submit answer'}
              </button>
            ) : (
              <div className="mt-4 glass-card rounded-xl p-5">
                <div className="flex items-center gap-4 mb-3">
                  <p className="text-3xl font-bold text-primary">{result.scores.overall}</p>
                  <p className="text-xs text-slate-muted uppercase tracking-wider">/ 100 overall</p>
                </div>
                <p className="text-sm text-on-surface mb-3">{result.evidence}</p>
                {result.improvementSuggestions.length > 0 && (
                  <ul className="text-xs text-slate-muted space-y-1 mb-4 list-disc list-inside">
                    {result.improvementSuggestions.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                )}
                <button
                  onClick={next}
                  className="text-sm font-semibold bg-primary text-on-primary px-5 py-2 rounded-lg hover:opacity-90 transition-opacity"
                >
                  {isLast ? 'Finish preview' : 'Next question'}
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
