'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { interview as interviewApi, type Question } from '@/lib/api'
import { useSSE } from '@/hooks/useSSE'
import { useSpeech } from '@/hooks/useSpeech'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { toast } from 'sonner'

// Heavy components — load client-side only
const SystemDesignCanvas = dynamic(() => import('@/components/SystemDesignCanvas'), { ssr: false })
const CodeEditor = dynamic(() => import('@/components/CodeEditor'), { ssr: false })

// ── Types ─────────────────────────────────────────────────────────────────────

interface ScoreState {
  [answerId: string]: { relevance: number; depth: number; clarity: number; overall: number }
}
interface SingleTestResult {
  input: string; expectedOutput: string; actualOutput: string
  passed: boolean; hidden: boolean; executionTimeMs: number | null
}
interface TestResultState {
  [answerId: string]: { passed: number; total: number; results: SingleTestResult[] }
}
interface FollowUpState {
  answerId: string
  action: 'follow_up' | 'probe_deeper' | 'challenge'
  response: string
}
interface Message {
  id: string
  role: 'ai' | 'user'
  text: string
  interviewer?: string
}

const INTERVIEWER_PERSONAS: Record<string, { role: string; color: string }> = {
  Alex:  { role: 'Senior Engineering Manager', color: 'from-emerald-deep/10 to-primary/5' },
  Priya: { role: 'Product & Behavioral Lead',  color: 'from-secondary-container/20 to-surface' },
  James: { role: 'Bar Raiser',                 color: 'from-amber-light/20 to-surface' },
}

const FORMAT_LABEL: Record<string, string> = {
  system_design: 'System Design',
  coding:        'Coding',
  text:          'Interview',
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ActiveInterviewPage() {
  useRequireAuth()
  const router = useRouter()
  const params = useParams()
  const sessionId = params.sessionId as string

  const [questions, setQuestions]       = useState<Question[]>([])
  const [currentIdx, setCurrentIdx]     = useState(0)
  const [mode, setMode]                 = useState<'practice' | 'timed' | 'full' | 'panel'>('practice')
  const [targetRole, setTargetRole]     = useState('')
  const [loading, setLoading]           = useState(true)
  const [submitting, setSubmitting]     = useState(false)
  const [completing, setCompleting]     = useState(false)

  // Text / voice answer
  const [answerText, setAnswerText]   = useState('')
  const [inputMode, setInputMode]     = useState<'text' | 'voice'>('text')
  const [timeLeft, setTimeLeft]       = useState<number | null>(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)

  // System design answer
  const [diagramSnapshot, setDiagramSnapshot] = useState<string | null>(null)
  const [designExplanation, setDesignExplanation] = useState('')

  // Coding answer
  const [code, setCode]         = useState('')
  const [language, setLanguage] = useState('javascript')

  // Scoring / follow-up
  const [scores, setScores]           = useState<ScoreState>({})
  const [testResultMap, setTestResultMap] = useState<TestResultState>({})
  const [scoringIds, setScoringIds]   = useState<Set<string>>(new Set())
  const [followUp, setFollowUp]       = useState<FollowUpState | null>(null)

  // Transcript (text/voice only)
  const [messages, setMessages]               = useState<Message[]>([])
  const [showFillerToast, setShowFillerToast] = useState(false)
  const [fillerWord, setFillerWord]           = useState('')

  const timerRef        = useRef<NodeJS.Timeout | null>(null)
  const startTimeRef    = useRef<number>(Date.now())
  const transcriptEndRef = useRef<HTMLDivElement>(null)
  const handleSubmitRef = useRef<() => void>(() => {})

  const integrityRef = useRef({
    pasteCount: 0, pastedChars: 0, tabSwitchCount: 0, tabSwitchSeconds: 0,
    timeToFirstKeystroke: null as number | null,
    questionDisplayedAt: Date.now(), tabHiddenAt: null as number | null,
  })

  const speech = useSpeech()

  // ── SSE events ───────────────────────────────────────────────────────────────

  useSSE(sessionId, useCallback((event) => {
    if (event.type === 'score-update') {
      setScores(s => ({ ...s, [event.answerId]: event.scores }))
      setScoringIds(s => { const n = new Set(s); n.delete(event.answerId); return n })
      // coding: persist test results from SSE payload
      const tr = event.testResults
      if (tr && tr.length > 0) {
        setTestResultMap(m => ({
          ...m,
          [event.answerId]: {
            passed:  tr.filter(r => r.passed).length,
            total:   tr.length,
            results: tr,
          },
        }))
      }
    }
    if (event.type === 'scoring-start') setScoringIds(s => new Set([...s, event.answerId]))
    if (event.type === 'scoring-error') {
      setScoringIds(s => { const n = new Set(s); n.delete(event.answerId); return n })
      toast.error('Scoring failed for one answer')
    }
    if (event.type === 'follow-up')
      setFollowUp({ answerId: event.answerId, action: event.action, response: event.response })
    if (event.type === 'speech-event') {
      const d = event.data as Record<string, unknown> | null
      if (d?.fillerWord) {
        setFillerWord(String(d.fillerWord)); setShowFillerToast(true)
        setTimeout(() => setShowFillerToast(false), 5000)
      }
    }
  }, []))

  // ── Load session ─────────────────────────────────────────────────────────────

  useEffect(() => {
    interviewApi.state(sessionId).then(data => {
      setQuestions(data.questions)
      setMode(data.interview.mode)
      setTargetRole(data.interview.targetRole || '')
      const answeredCount = data.answers?.length || 0
      const startIdx = answeredCount < data.questions.length ? answeredCount : 0
      setCurrentIdx(startIdx)
      const msgs: Message[] = []
      data.questions.slice(0, answeredCount).forEach((q, i) => {
        msgs.push({ id: `q-${i}`, role: 'ai', text: q.text, interviewer: q.interviewerName || 'Alex' })
        if (data.answers?.[i]) msgs.push({ id: `a-${i}`, role: 'user', text: data.answers[i].text })
      })
      if (data.questions[startIdx]) {
        msgs.push({ id: `q-${startIdx}`, role: 'ai', text: data.questions[startIdx].text, interviewer: data.questions[startIdx].interviewerName || 'Alex' })
      }
      setMessages(msgs)
      setLoading(false)
    }).catch(() => { toast.error('Session not found'); router.push('/interview') })
  }, [sessionId, router])

  useEffect(() => { transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  // Timed mode countdown
  useEffect(() => {
    if (mode !== 'timed' || !questions[currentIdx]) return
    const limit = questions[currentIdx].timeLimitSeconds || 120
    setTimeLeft(limit)
    startTimeRef.current = Date.now()
    timerRef.current = setInterval(() => {
      setTimeLeft(t => { if (t == null || t <= 1) { clearInterval(timerRef.current!); return 0 } return t - 1 })
    }, 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [currentIdx, mode, questions])

  useEffect(() => { if (speech.transcript) setAnswerText(speech.transcript) }, [speech.transcript])

  // Reset integrity signals on question change
  useEffect(() => {
    integrityRef.current = {
      pasteCount: 0, pastedChars: 0, tabSwitchCount: 0, tabSwitchSeconds: 0,
      timeToFirstKeystroke: null, questionDisplayedAt: Date.now(), tabHiddenAt: null,
    }
    // Reset answer state for new question
    setAnswerText(''); setDiagramSnapshot(null); setDesignExplanation(''); setCode(''); setFollowUp(null)
  }, [currentIdx])

  useEffect(() => {
    const onVisibility = () => {
      const s = integrityRef.current
      if (document.hidden) { s.tabSwitchCount += 1; s.tabHiddenAt = Date.now() }
      else if (s.tabHiddenAt != null) { s.tabSwitchSeconds += Math.round((Date.now() - s.tabHiddenAt) / 1000); s.tabHiddenAt = null }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  useEffect(() => {
    if (mode === 'timed' && timeLeft === 0 && !submitting && !completing) handleSubmitRef.current()
  }, [timeLeft]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (mode === 'timed') return
    const id = setInterval(() => setElapsedSeconds(Math.round((Date.now() - startTimeRef.current) / 1000)), 1000)
    return () => clearInterval(id)
  }, [mode])

  // ── Derived state ─────────────────────────────────────────────────────────────

  const currentQuestion  = questions[currentIdx]
  const questionFormat   = currentQuestion?.questionFormat || 'text'
  const isLastQuestion   = currentIdx >= questions.length - 1
  const interviewerName  = currentQuestion?.interviewerName || 'Alex'
  const persona          = INTERVIEWER_PERSONAS[interviewerName] || INTERVIEWER_PERSONAS.Alex

  const canSubmit = (() => {
    if (questionFormat === 'coding')        return code.trim().length > 0
    if (questionFormat === 'system_design') return (diagramSnapshot !== null) || designExplanation.trim().length > 0
    return answerText.trim().length > 0 || speech.transcript.trim().length > 0
  })()

  // ── Handlers ──────────────────────────────────────────────────────────────────

  const handleComplete = useCallback(async () => {
    if (completing) return
    setCompleting(true)
    try {
      const result = await interviewApi.complete(sessionId)
      toast.success(`Interview complete! Score: ${result.overallScore}`)
      router.push(`/results/${sessionId}`)
    } catch { toast.error('Failed to complete session'); setCompleting(false) }
  }, [sessionId, router, completing])

  const advanceQuestion = useCallback((submittedText: string) => {
    speech.reset()
    setAnswerText(''); setDiagramSnapshot(null); setDesignExplanation(''); setCode(''); setFollowUp(null)
    if (isLastQuestion) { handleComplete(); return }
    const nextIdx = currentIdx + 1
    setCurrentIdx(nextIdx)
    if (questions[nextIdx] && (questions[nextIdx].questionFormat || 'text') === 'text') {
      setMessages(m => [...m, { id: `q-${nextIdx}`, role: 'ai', text: questions[nextIdx].text, interviewer: questions[nextIdx].interviewerName || 'Alex' }])
    }
    if (submittedText && questionFormat === 'text') {
      setMessages(m => [...m, { id: `a-user-${currentIdx}`, role: 'user', text: submittedText }])
    }
  }, [currentIdx, isLastQuestion, questions, questionFormat, speech, handleComplete])

  const handleSubmit = async () => {
    if (!currentQuestion || submitting || !canSubmit) return
    setSubmitting(true)
    if (timerRef.current) clearInterval(timerRef.current)
    const elapsed = Math.round((Date.now() - startTimeRef.current) / 1000)
    const s = integrityRef.current

    try {
      if (questionFormat === 'coding') {
        await interviewApi.submitAnswer(sessionId, {
          questionId: currentQuestion.id, questionIndex: currentIdx,
          inputMethod: 'code', timeSpentSeconds: elapsed,
          code, language,
        })
        advanceQuestion('')
      } else if (questionFormat === 'system_design') {
        await interviewApi.submitAnswer(sessionId, {
          questionId: currentQuestion.id, questionIndex: currentIdx,
          answerText: designExplanation.trim() || ' ',
          inputMethod: 'diagram', timeSpentSeconds: elapsed,
          diagramSnapshot,
        })
        advanceQuestion('')
      } else {
        const text = answerText.trim() || speech.transcript.trim()
        await interviewApi.submitAnswer(sessionId, {
          questionId: currentQuestion.id, questionIndex: currentIdx,
          answerText: text, inputMethod: inputMode, timeSpentSeconds: elapsed,
          speechDurationSeconds: speech.durationSeconds || undefined,
          integritySignals: {
            pasteCount: s.pasteCount, pastedChars: s.pastedChars,
            typedChars: Math.max(0, text.length - s.pastedChars),
            tabSwitchCount: s.tabSwitchCount, tabSwitchSeconds: s.tabSwitchSeconds,
            timeToFirstKeystroke: s.timeToFirstKeystroke,
          },
        })
        advanceQuestion(text)
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit answer')
    } finally { setSubmitting(false) }
  }

  handleSubmitRef.current = handleSubmit

  const toggleVoice = () => {
    if (speech.recording) { speech.stop(); setInputMode('text') }
    else { speech.start(); setInputMode('voice') }
  }

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  // ── Loading / empty states ────────────────────────────────────────────────────

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <span className="material-symbols-outlined text-primary text-4xl animate-spin">sync</span>
        <p className="text-sm text-slate-muted">Loading interview session…</p>
      </div>
    </div>
  )

  if (!currentQuestion && !loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <span className="material-symbols-outlined text-primary text-6xl icon-fill mb-3 block">check_circle</span>
        <p className="font-geist font-semibold text-xl text-on-surface mb-4">All questions answered</p>
        <button onClick={handleComplete} disabled={completing} className="bg-primary text-white px-5 py-2.5 rounded-lg font-semibold disabled:opacity-60 flex items-center gap-2 mx-auto">
          {completing ? <><span className="material-symbols-outlined animate-spin text-base">sync</span>Finishing…</> : 'View Results'}
        </button>
      </div>
    </div>
  )

  // ── Score chip helper ─────────────────────────────────────────────────────────

  const LastScoreChip = () => {
    const ids = Object.keys(scores)
    if (!ids.length) return null
    const sc = scores[ids[ids.length - 1]]
    return (
      <div className="mt-4 w-full bg-surface rounded-lg p-3 border border-outline-variant/20 text-xs">
        <p className="text-slate-muted font-medium mb-2 text-center">Last Score</p>
        <div className="flex justify-around">
          {(['relevance', 'depth', 'clarity'] as const).map(d => (
            <div key={d} className="text-center">
              <div className={`font-bold text-sm ${sc[d] >= 80 ? 'text-primary' : sc[d] >= 60 ? 'text-tertiary-container' : 'text-error'}`}>{sc[d]}</div>
              <div className="text-slate-muted capitalize">{d}</div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="bg-background text-on-surface h-screen flex flex-col overflow-hidden font-sans">
      {/* Filler word toast */}
      {showFillerToast && (
        <div className="absolute top-20 right-6 z-50 bg-white/85 backdrop-blur-md border-l-4 border-l-tertiary-container border border-outline-variant/20 rounded-lg p-4 shadow-sm flex items-start gap-3 max-w-sm animate-in slide-in-from-top-2">
          <span className="material-symbols-outlined text-tertiary-container mt-0.5 icon-fill">warning</span>
          <div>
            <p className="text-sm font-semibold text-on-surface mb-1">Filler word detected</p>
            <p className="text-sm text-slate-muted leading-tight">
              Try pausing instead of saying <strong className="text-tertiary-container bg-amber-light/30 px-1 rounded">&ldquo;{fillerWord}&rdquo;</strong>.
            </p>
          </div>
          <button onClick={() => setShowFillerToast(false)} className="text-slate-muted hover:text-on-surface ml-auto">
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>
      )}

      {/* Header */}
      <header className="w-full bg-surface border-b border-outline-variant/30 flex items-center justify-between px-4 md:px-12 h-16 shrink-0 z-10">
        <div className="flex items-center gap-4">
          <h1 className="font-geist font-semibold text-emerald-deep text-xl tracking-tight">MockPrep</h1>
          <span className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-full bg-surface-container-high text-on-surface-variant text-xs font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-primary mr-1.5" />
            {FORMAT_LABEL[questionFormat] ?? 'Interview'} — {mode === 'timed' ? 'Timed' : mode === 'panel' ? 'Panel' : mode === 'full' ? 'Full Mock' : 'Practice'}
          </span>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2 text-right">
          {targetRole && <span className="text-sm font-semibold text-on-surface">{targetRole}</span>}
          <span className="text-xs text-slate-muted">{currentIdx + 1} / {questions.length}</span>
        </div>
      </header>

      {/* Mobile-only question banner — visible instead of the left pane on small screens */}
      <div className="md:hidden bg-surface-container-lowest border-b border-outline-variant/20 px-4 py-2.5 shrink-0">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-semibold text-slate-muted shrink-0">
              {interviewerName} · Q{currentIdx + 1}/{questions.length}
            </span>
            {scoringIds.size > 0 && <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />}
          </div>
          {mode === 'timed' && timeLeft != null && (
            <span className={`text-xs font-mono font-bold shrink-0 ${timeLeft <= 30 ? 'text-error' : 'text-on-surface'}`}>
              ⏱ {formatTime(timeLeft)}
            </span>
          )}
        </div>
        <p className="text-xs text-on-surface mt-1 line-clamp-2 leading-snug">{currentQuestion?.text}</p>
      </div>

      {/* Main workspace */}
      <main className="flex-1 overflow-hidden flex flex-col md:flex-row max-w-[1400px] mx-auto w-full p-3 md:p-6 gap-3 md:gap-6">

        {/* Left pane: AI Persona — hidden on mobile (replaced by compact banner above) */}
        <section className="hidden md:flex w-full md:w-56 lg:w-64 shrink-0 flex-col gap-4">
          <div className={`bg-gradient-to-br ${persona.color} rounded-2xl border border-outline-variant/40 p-5 flex flex-col items-center`}>
            <div className="w-20 h-20 rounded-full bg-surface-container-high flex items-center justify-center mb-3 text-5xl">
              {interviewerName === 'Alex' ? '👨' : interviewerName === 'Priya' ? '👩' : '🧔'}
            </div>
            <h2 className="font-geist font-semibold text-lg text-on-surface mb-0.5">{interviewerName}</h2>
            <p className="text-xs text-slate-muted mb-3 text-center">{persona.role}</p>
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
              speech.recording ? 'bg-error-container/20 text-error' : 'bg-surface-container text-on-surface-variant'
            }`}>
              <div className={`w-2 h-2 rounded-full ${speech.recording ? 'bg-error animate-pulse' : scoringIds.size > 0 ? 'bg-amber-400 animate-pulse' : 'bg-emerald-deep animate-pulse'}`} />
              {speech.recording ? 'Recording…' : scoringIds.size > 0 ? 'Scoring…' : 'Ready'}
            </div>
            <LastScoreChip />
          </div>

          {/* Question mini-card */}
          <div className="bg-surface rounded-xl border border-outline-variant/20 p-4">
            <p className="text-xs font-semibold text-slate-muted uppercase tracking-wide mb-2">
              {currentIdx + 1} of {questions.length} · {currentQuestion?.category?.replace('_', ' ')}
            </p>
            <p className="text-sm text-on-surface leading-snug line-clamp-4">{currentQuestion?.text}</p>
            {currentQuestion?.difficulty && (
              <span className={`mt-2 inline-block text-xs px-2 py-0.5 rounded-full font-semibold ${
                currentQuestion.difficulty === 'hard' ? 'bg-error-container/30 text-error' :
                currentQuestion.difficulty === 'medium' ? 'bg-amber-light/40 text-tertiary-container' :
                'bg-surface-container text-on-surface-variant'
              }`}>{currentQuestion.difficulty}</span>
            )}
          </div>
        </section>

        {/* Right pane: format-specific workspace */}
        <section className="flex-1 flex flex-col bg-surface rounded-xl border border-outline-variant/30 overflow-hidden shadow-sm min-w-0">

          {/* ── SYSTEM DESIGN ───────────────────────────────────────────────── */}
          {questionFormat === 'system_design' && (
            <>
              <div className="px-5 py-3 border-b border-outline-variant/20 bg-surface-container-lowest/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-base">architecture</span>
                  <span className="text-xs font-semibold text-slate-muted uppercase tracking-wider">
                    {currentQuestion?.subtype === 'fix' ? 'Fix this design' : currentQuestion?.subtype === 'improve' ? 'Improve this design' : 'Design from scratch'}
                  </span>
                </div>
                {mode === 'timed' && timeLeft != null && (
                  <span className={`text-sm font-mono font-bold ${timeLeft <= 60 ? 'text-error' : 'text-on-surface'}`}>⏱ {formatTime(timeLeft)}</span>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
                {/* Template diagram for fix/improve */}
                {currentQuestion?.templateDiagram && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50/50 overflow-hidden">
                    <div className="px-4 py-2 border-b border-amber-200 flex items-center gap-2">
                      <span className="material-symbols-outlined text-amber-600 text-base">info</span>
                      <span className="text-xs font-semibold text-amber-700">
                        {currentQuestion.subtype === 'fix' ? 'Broken design to fix' : 'Starting design to improve'}
                      </span>
                    </div>
                    <div style={{ height: 260 }}>
                      <SystemDesignCanvas initialDiagram={currentQuestion.templateDiagram} readonly />
                    </div>
                  </div>
                )}

                {/* Evaluation rubric hints */}
                {currentQuestion?.evaluationRubric && currentQuestion.evaluationRubric.length > 0 && (
                  <div className="rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-4">
                    <p className="text-xs font-semibold text-slate-muted uppercase tracking-wide mb-2">What a complete answer should cover</p>
                    <ul className="space-y-1">
                      {currentQuestion.evaluationRubric.map((r, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-on-surface-variant">
                          <span className="material-symbols-outlined text-slate-muted text-sm mt-0.5">radio_button_unchecked</span>
                          {r}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* User's canvas */}
                <div className="rounded-xl border border-outline-variant/20 overflow-hidden" style={{ height: 400 }}>
                  <div className="px-4 py-2 bg-surface-container border-b border-outline-variant/15 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-base">draw</span>
                    <span className="text-xs font-semibold text-on-surface">Your Design</span>
                    <span className="text-xs text-slate-400 ml-auto">Drag nodes · Connect by pulling handles · Double-click to rename</span>
                  </div>
                  <div style={{ height: 352 }}>
                    <SystemDesignCanvas
                      onChange={json => setDiagramSnapshot(json)}
                    />
                  </div>
                </div>

                {/* Text explanation */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-on-surface">Explain your design choices</label>
                  <textarea
                    value={designExplanation}
                    onChange={e => setDesignExplanation(e.target.value)}
                    placeholder="Walk through your architecture decisions, trade-offs, and how it handles the scale requirements…"
                    rows={4}
                    className="w-full px-4 py-3 bg-surface-container-lowest border border-outline-variant/40 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder:text-slate-muted/60"
                  />
                </div>
              </div>

              <div className="border-t border-outline-variant/20 bg-surface p-4 flex justify-between items-center">
                {mode === 'practice' && (
                  <button
                    onClick={() => advanceQuestion('')}
                    className="flex items-center gap-1.5 text-sm text-slate-muted hover:text-on-surface border border-outline-variant/40 px-3 py-2 rounded-lg transition-colors"
                  >
                    <span className="material-symbols-outlined text-base">skip_next</span> Skip
                  </button>
                )}
                <div className="ml-auto">
                  <button
                    onClick={handleSubmit}
                    disabled={submitting || completing || !canSubmit}
                    className="flex items-center gap-2 bg-primary text-white rounded-lg px-6 py-2.5 font-semibold text-sm disabled:opacity-50 hover:bg-emerald-deep transition-colors"
                  >
                    {submitting || completing
                      ? <><span className="material-symbols-outlined animate-spin text-base">sync</span>{completing ? 'Finishing…' : 'Submitting…'}</>
                      : <><span className="material-symbols-outlined text-base">send</span>{isLastQuestion ? 'Submit & Finish' : 'Submit Design'}</>
                    }
                  </button>
                </div>
              </div>
            </>
          )}

          {/* ── CODING ──────────────────────────────────────────────────────── */}
          {questionFormat === 'coding' && (
            <>
              <div className="px-5 py-3 border-b border-outline-variant/20 bg-surface-container-lowest/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-base">code</span>
                  <span className="text-xs font-semibold text-slate-muted uppercase tracking-wider">Coding Challenge</span>
                </div>
                {mode === 'timed' && timeLeft != null && (
                  <span className={`text-sm font-mono font-bold ${timeLeft <= 30 ? 'text-error' : 'text-on-surface'}`}>⏱ {formatTime(timeLeft)}</span>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
                {/* Scoring feedback after submission */}
                {Object.keys(testResultMap).length > 0 && (() => {
                  const lastId = Object.keys(testResultMap)[Object.keys(testResultMap).length - 1]
                  const tr = testResultMap[lastId]
                  return (
                    <div className={`rounded-xl border p-4 flex items-center gap-3 ${tr.passed === tr.total ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                      <span className={`material-symbols-outlined text-2xl ${tr.passed === tr.total ? 'text-green-600' : 'text-red-500'}`}>
                        {tr.passed === tr.total ? 'check_circle' : 'cancel'}
                      </span>
                      <div>
                        <p className={`font-semibold text-sm ${tr.passed === tr.total ? 'text-green-800' : 'text-red-700'}`}>
                          {tr.passed}/{tr.total} test cases passed
                        </p>
                        {tr.passed < tr.total && <p className="text-xs text-red-600 mt-0.5">Check your logic and edge cases</p>}
                      </div>
                    </div>
                  )
                })()}
                {scoringIds.size > 0 && (
                  <div className="rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-3 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-base animate-spin">sync</span>
                    <span className="text-sm text-slate-muted">Running test cases…</span>
                  </div>
                )}

                <div className="flex-1" style={{ minHeight: 480 }}>
                  <CodeEditor
                    starterCode={currentQuestion?.starterCode || ''}
                    constraints={currentQuestion?.constraints || undefined}
                    testResults={
                      Object.keys(testResultMap).length > 0
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        ? (testResultMap[Object.keys(testResultMap)[Object.keys(testResultMap).length - 1]].results as any[])
                        : undefined
                    }
                    codeScore={
                      Object.keys(testResultMap).length > 0
                        ? { passed: testResultMap[Object.keys(testResultMap)[Object.keys(testResultMap).length - 1]].passed, total: testResultMap[Object.keys(testResultMap)[Object.keys(testResultMap).length - 1]].total }
                        : undefined
                    }
                    onChange={(c, lang) => { setCode(c); setLanguage(lang) }}
                  />
                </div>
              </div>

              <div className="border-t border-outline-variant/20 bg-surface p-4 flex justify-between items-center">
                {mode === 'practice' && (
                  <button
                    onClick={() => advanceQuestion('')}
                    className="flex items-center gap-1.5 text-sm text-slate-muted hover:text-on-surface border border-outline-variant/40 px-3 py-2 rounded-lg transition-colors"
                  >
                    <span className="material-symbols-outlined text-base">skip_next</span> Skip
                  </button>
                )}
                <div className="ml-auto">
                  <button
                    onClick={handleSubmit}
                    disabled={submitting || completing || !canSubmit}
                    className="flex items-center gap-2 bg-primary text-white rounded-lg px-6 py-2.5 font-semibold text-sm disabled:opacity-50 hover:bg-emerald-deep transition-colors"
                  >
                    {submitting || completing
                      ? <><span className="material-symbols-outlined animate-spin text-base">sync</span>{completing ? 'Finishing…' : 'Submitting…'}</>
                      : <><span className="material-symbols-outlined text-base">play_arrow</span>{isLastQuestion ? 'Run & Finish' : 'Run & Submit'}</>
                    }
                  </button>
                </div>
              </div>
            </>
          )}

          {/* ── TEXT / VOICE (default) ───────────────────────────────────────── */}
          {questionFormat === 'text' && (
            <>
              <div className="px-6 py-4 border-b border-outline-variant/20 bg-surface-container-lowest/50 flex justify-between items-center">
                <h3 className="text-xs font-semibold text-slate-muted uppercase tracking-wider">Live Transcript</h3>
                {mode === 'timed' && timeLeft != null && (
                  <span className={`text-sm font-mono font-bold ${timeLeft <= 15 ? 'text-error' : 'text-on-surface'}`}>⏱ {formatTime(timeLeft)}</span>
                )}
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-6">
                {messages.map(msg => (
                  <div key={msg.id} className={`flex flex-col max-w-[85%] ${msg.role === 'ai' ? 'self-start' : 'self-end items-end'}`}>
                    <span className="text-xs text-slate-muted mb-1 mx-1">{msg.role === 'ai' ? (msg.interviewer || 'Alex') : 'You'}</span>
                    <div className={`p-4 rounded-2xl text-base leading-relaxed ${
                      msg.role === 'ai'
                        ? 'bg-surface-container-low text-on-surface rounded-tl-sm'
                        : 'bg-primary-container/10 border border-primary/10 text-on-surface rounded-tr-sm'
                    }`}>{msg.text}</div>
                  </div>
                ))}
                {speech.recording && speech.interim && (
                  <div className="flex flex-col max-w-[85%] self-end items-end">
                    <span className="text-xs text-slate-muted mb-1 mr-1">You</span>
                    <div className="bg-primary-container/10 border border-primary/10 text-on-surface p-4 rounded-2xl rounded-tr-sm text-base">
                      {speech.interim}<span className="inline-block w-1.5 h-4 bg-primary ml-1 animate-pulse align-middle" />
                    </div>
                  </div>
                )}
                {followUp && (
                  <div className="self-start max-w-[85%]">
                    <div className={`p-4 rounded-xl border ${followUp.action === 'challenge' ? 'border-error-container bg-error-container/20' : 'border-amber-light bg-amber-light/30'}`}>
                      <p className={`text-xs font-bold uppercase tracking-wide mb-1 ${followUp.action === 'challenge' ? 'text-error' : 'text-tertiary-container'}`}>
                        {followUp.action === 'follow_up' ? 'Follow-up' : followUp.action === 'probe_deeper' ? 'Probe Deeper' : 'Challenge'}
                      </p>
                      <p className="text-sm text-on-surface">{followUp.response}</p>
                    </div>
                  </div>
                )}
                <div ref={transcriptEndRef} />
              </div>

              <div className="pointer-events-none h-8 bg-gradient-to-t from-surface to-transparent -mt-8 relative z-10" />

              <div className="border-t border-outline-variant/20 bg-surface p-4">
                <div className="flex flex-col gap-3">
                  {!speech.recording && (
                    <textarea
                      value={answerText}
                      onChange={e => {
                        const s = integrityRef.current
                        if (s.timeToFirstKeystroke === null && e.target.value.length > 0)
                          s.timeToFirstKeystroke = Math.round((Date.now() - s.questionDisplayedAt) / 1000)
                        setAnswerText(e.target.value)
                      }}
                      onPaste={e => {
                        const pasted = e.clipboardData?.getData('text') ?? ''
                        const s = integrityRef.current
                        s.pasteCount += 1; s.pastedChars += pasted.length
                        if (s.timeToFirstKeystroke === null) s.timeToFirstKeystroke = Math.round((Date.now() - s.questionDisplayedAt) / 1000)
                      }}
                      placeholder="Type your answer here, or click the mic to speak…"
                      rows={3}
                      className="w-full px-4 py-3 bg-surface-container-lowest border border-outline-variant/40 rounded-lg text-base resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder:text-slate-muted/60"
                    />
                  )}
                  {speech.transcribing && (
                    <div className="flex items-center gap-2 text-sm text-slate-muted px-1">
                      <span className="material-symbols-outlined text-base animate-spin">sync</span>
                      Transcribing audio…
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      {speech.supported && (
                        <button
                          onClick={toggleVoice}
                          className={`flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg transition-colors font-medium ${
                            speech.recording ? 'bg-error-container/50 text-error hover:bg-error-container' : 'bg-surface-container text-on-surface hover:bg-surface-container-high'
                          }`}
                        >
                          <span className="material-symbols-outlined text-xl icon-fill">{speech.recording ? 'mic_off' : 'mic'}</span>
                          {speech.recording ? `Stop (${formatTime(speech.durationSeconds)})` : 'Record'}
                        </button>
                      )}
                      {mode === 'practice' && (
                        <button
                          onClick={() => {
                            const ni = Math.min(currentIdx + 1, questions.length - 1)
                            setAnswerText(''); speech.reset(); setCurrentIdx(ni)
                            if (questions[ni] && (questions[ni].questionFormat || 'text') === 'text')
                              setMessages(m => [...m, { id: `q-skip-${ni}`, role: 'ai', text: questions[ni].text, interviewer: questions[ni].interviewerName || 'Alex' }])
                          }}
                          className="flex items-center gap-1.5 text-sm text-slate-muted hover:text-on-surface border border-outline-variant/40 px-3 py-2 rounded-lg transition-colors"
                        >
                          <span className="material-symbols-outlined text-base">skip_next</span> Skip
                        </button>
                      )}
                    </div>
                    <button
                      onClick={handleSubmit}
                      disabled={submitting || completing || !canSubmit}
                      className="flex items-center gap-2 bg-primary text-white rounded-lg px-6 py-2 font-semibold text-sm disabled:opacity-50 hover:bg-emerald-deep transition-colors"
                    >
                      {submitting || completing
                        ? <><span className="material-symbols-outlined animate-spin text-base">sync</span>{completing ? 'Finishing…' : 'Submitting…'}</>
                        : <><span className="material-symbols-outlined text-base">send</span>{isLastQuestion ? 'Submit & Finish' : 'Submit Answer'}</>
                      }
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </section>
      </main>

      {/* Bottom bar */}
      <div className="w-full bg-surface border-t border-outline-variant/30 shrink-0 z-20">
        <div className="max-w-[1400px] mx-auto px-4 md:px-12 py-3 flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-slate-muted uppercase tracking-wider mb-0.5 hidden md:block">Current Question</p>
            <p className="text-sm font-medium text-on-surface line-clamp-2 md:line-clamp-1 pr-2">{currentQuestion?.text || 'Loading…'}</p>
          </div>
          {questionFormat === 'text' && (
            <button onClick={toggleVoice} disabled={!speech.supported} className="relative group cursor-pointer disabled:opacity-40 shrink-0">
              <div className={`absolute inset-0 rounded-full opacity-20 scale-150 ${speech.recording ? 'bg-error animate-pulse' : 'bg-primary group-hover:opacity-30'} transition-opacity`} />
              <div className={`relative w-14 h-14 rounded-full flex items-center justify-center shadow-md ${speech.recording ? 'bg-error' : 'bg-primary'} text-white transition-colors`}>
                <span className="material-symbols-outlined text-[28px] icon-fill">mic</span>
              </div>
            </button>
          )}
          <div className="flex-1 flex items-center justify-end gap-6">
            {mode !== 'timed' && (
              <div className="flex items-center gap-2 text-slate-muted">
                <span className="material-symbols-outlined text-xl">timer</span>
                <span className="font-mono text-xl text-on-surface tabular-nums">{formatTime(elapsedSeconds)}</span>
              </div>
            )}
            <button onClick={handleComplete} disabled={completing} className="px-5 py-2.5 rounded-lg bg-error-container/50 hover:bg-error-container text-on-error-container text-sm font-semibold transition-colors flex items-center gap-2 disabled:opacity-60">
              <span className="material-symbols-outlined text-lg">close</span>End Session
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
