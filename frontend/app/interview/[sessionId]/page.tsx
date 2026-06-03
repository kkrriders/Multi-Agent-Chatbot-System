'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { interview as interviewApi, type Question } from '@/lib/api'
import { useSSE } from '@/hooks/useSSE'
import { useSpeech } from '@/hooks/useSpeech'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { toast } from 'sonner'

interface ScoreState {
  [answerId: string]: { relevance: number; depth: number; clarity: number; overall: number }
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

export default function ActiveInterviewPage() {
  useRequireAuth()
  const router = useRouter()
  const params = useParams()
  const sessionId = params.sessionId as string

  const [questions, setQuestions] = useState<Question[]>([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [answerText, setAnswerText] = useState('')
  const [mode, setMode] = useState<'practice' | 'timed' | 'full' | 'panel'>('practice')
  const [targetRole, setTargetRole] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [timeLeft, setTimeLeft] = useState<number | null>(null)
  const [inputMode, setInputMode] = useState<'text' | 'voice'>('text')
  const [submitting, setSubmitting] = useState(false)
  const [scores, setScores] = useState<ScoreState>({})
  const [scoringIds, setScoringIds] = useState<Set<string>>(new Set())
  const [followUp, setFollowUp] = useState<FollowUpState | null>(null)
  const [loading, setLoading] = useState(true)
  const [completing, setCompleting] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [showFillerToast, setShowFillerToast] = useState(false)
  const [fillerWord, setFillerWord] = useState('')
  const [elapsedSeconds, setElapsedSeconds] = useState(0)

  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const startTimeRef = useRef<number>(Date.now())
  const transcriptEndRef = useRef<HTMLDivElement>(null)
  const handleSubmitRef = useRef<() => void>(() => {})

  const integrityRef = useRef({
    pasteCount: 0, pastedChars: 0, tabSwitchCount: 0, tabSwitchSeconds: 0,
    timeToFirstKeystroke: null as number | null, questionDisplayedAt: Date.now(), tabHiddenAt: null as number | null,
  })

  const speech = useSpeech()

  const scrollToBottom = () => transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' })

  useSSE(sessionId, useCallback((event) => {
    if (event.type === 'score-update') {
      setScores(s => ({ ...s, [event.answerId]: event.scores }))
      setScoringIds(s => { const n = new Set(s); n.delete(event.answerId); return n })
    }
    if (event.type === 'scoring-start') setScoringIds(s => new Set([...s, event.answerId]))
    if (event.type === 'scoring-error') {
      setScoringIds(s => { const n = new Set(s); n.delete(event.answerId); return n })
      toast.error('Scoring failed for one answer')
    }
    if (event.type === 'follow-up') setFollowUp({ answerId: event.answerId, action: event.action, response: event.response })
    if (event.type === 'speech-event') {
      const d = event.data as Record<string, unknown> | null
      if (d?.fillerWord) {
        setFillerWord(String(d.fillerWord))
        setShowFillerToast(true)
        setTimeout(() => setShowFillerToast(false), 5000)
      }
    }
  }, []))

  useEffect(() => {
    interviewApi.state(sessionId).then(data => {
      setQuestions(data.questions)
      setMode(data.interview.mode)
      setTargetRole(data.interview.targetRole || '')
      const answeredCount = data.answers?.length || 0
      const startIdx = answeredCount < data.questions.length ? answeredCount : 0
      setCurrentIdx(startIdx)
      // Pre-populate transcript with answered questions/answers
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

  useEffect(() => { scrollToBottom() }, [messages])

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

  useEffect(() => {
    if (speech.transcript) setAnswerText(speech.transcript)
  }, [speech.transcript])

  useEffect(() => {
    integrityRef.current = {
      pasteCount: 0, pastedChars: 0, tabSwitchCount: 0, tabSwitchSeconds: 0,
      timeToFirstKeystroke: null, questionDisplayedAt: Date.now(), tabHiddenAt: null,
    }
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

  const currentQuestion = questions[currentIdx]
  const isLastQuestion = currentIdx >= questions.length - 1
  const interviewerName = currentQuestion?.interviewerName || 'Alex'
  const persona = INTERVIEWER_PERSONAS[interviewerName] || INTERVIEWER_PERSONAS.Alex

  const handleComplete = useCallback(async () => {
    if (completing) return
    setCompleting(true)
    try {
      const result = await interviewApi.complete(sessionId)
      toast.success(`Interview complete! Score: ${result.overallScore}`)
      router.push(`/results/${sessionId}`)
    } catch {
      toast.error('Failed to complete session')
      setCompleting(false)
    }
  }, [sessionId, router, completing])

  const handleSubmit = async () => {
    if (!currentQuestion || (!answerText.trim() && !speech.transcript.trim())) {
      toast.error('Please type or speak your answer first')
      return
    }
    setSubmitting(true)
    if (timerRef.current) clearInterval(timerRef.current)
    const elapsed = Math.round((Date.now() - startTimeRef.current) / 1000)
    const text = answerText.trim() || speech.transcript.trim()
    const s = integrityRef.current
    try {
      await interviewApi.submitAnswer(sessionId, {
        questionId: currentQuestion.id, questionIndex: currentIdx, answerText: text,
        inputMethod: inputMode, timeSpentSeconds: elapsed,
        speechDurationSeconds: speech.durationSeconds || undefined,
        integritySignals: inputMode === 'text' ? {
          pasteCount: s.pasteCount, pastedChars: s.pastedChars,
          typedChars: Math.max(0, text.length - s.pastedChars),
          tabSwitchCount: s.tabSwitchCount, tabSwitchSeconds: s.tabSwitchSeconds,
          timeToFirstKeystroke: s.timeToFirstKeystroke,
        } : { pasteCount: 0, pastedChars: 0, typedChars: 0, tabSwitchCount: s.tabSwitchCount, tabSwitchSeconds: s.tabSwitchSeconds, timeToFirstKeystroke: s.timeToFirstKeystroke },
      })
      // Add user answer to transcript
      setMessages(m => [...m, { id: `a-user-${currentIdx}`, role: 'user', text }])
      speech.reset()
      setAnswerText('')
      setFollowUp(null)
      if (isLastQuestion) {
        await handleComplete()
      } else {
        const nextIdx = currentIdx + 1
        setCurrentIdx(nextIdx)
        if (questions[nextIdx]) {
          setMessages(m => [...m, { id: `q-${nextIdx}`, role: 'ai', text: questions[nextIdx].text, interviewer: questions[nextIdx].interviewerName || 'Alex' }])
        }
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit answer')
    } finally {
      setSubmitting(false)
    }
  }

  handleSubmitRef.current = handleSubmit

  const toggleVoice = () => {
    if (speech.recording) { speech.stop(); setInputMode('text') }
    else { speech.start(); setInputMode('voice') }
  }

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

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

  return (
    <div className="bg-background text-on-surface h-screen flex flex-col overflow-hidden font-sans selection:bg-primary-container/30">
      {/* Filler word toast */}
      {showFillerToast && (
        <div className="absolute top-20 right-6 z-50 bg-white/85 backdrop-blur-md border-l-4 border-l-tertiary-container border border-outline-variant/20 rounded-lg p-4 shadow-sm flex items-start gap-3 max-w-sm animate-in slide-in-from-top-2">
          <span className="material-symbols-outlined text-tertiary-container mt-0.5 icon-fill">warning</span>
          <div>
            <p className="text-sm font-semibold text-on-surface mb-1">Filler word detected</p>
            <p className="text-sm text-slate-muted leading-tight">
              Try to pause instead of saying <strong className="text-tertiary-container bg-amber-light/30 px-1 rounded">&ldquo;{fillerWord}&rdquo;</strong>.
            </p>
          </div>
          <button onClick={() => setShowFillerToast(false)} className="text-slate-muted hover:text-on-surface ml-auto">
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>
      )}

      {/* Task-focused header */}
      <header className="w-full bg-surface border-b border-outline-variant/30 flex items-center justify-between px-4 md:px-12 h-16 shrink-0 z-10">
        <div className="flex items-center gap-4">
          <h1 className="font-geist font-semibold text-emerald-deep text-xl tracking-tight">MockPrep</h1>
          <span className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-full bg-surface-container-high text-on-surface-variant text-xs font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-primary mr-1.5" />
            {mode === 'timed' ? 'Timed Mode' : mode === 'panel' ? 'Panel Mode' : mode === 'full' ? 'Full Mock' : 'Practice Mode'}
          </span>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2 text-right">
          {targetRole && <span className="text-sm font-semibold text-on-surface">{targetRole}</span>}
          {companyName && <><span className="hidden sm:inline text-outline-variant">|</span><span className="text-sm text-slate-muted">{companyName}</span></>}
          <span className="text-xs text-slate-muted">{currentIdx + 1} / {questions.length}</span>
        </div>
      </header>

      {/* Main workspace */}
      <main className="flex-1 overflow-hidden flex flex-col md:flex-row max-w-[1280px] mx-auto w-full p-4 md:p-6 gap-6">
        {/* Left pane: AI Persona */}
        <section className="w-full md:w-4/12 lg:w-3/12 flex flex-col shrink-0">
          <div className={`bg-gradient-to-br ${persona.color} rounded-2xl border border-outline-variant/40 p-6 flex flex-col items-center justify-center h-full relative overflow-hidden shadow-sm`}>
            <div className="absolute -top-10 -right-10 opacity-5 pointer-events-none">
              <svg fill="none" height="200" viewBox="0 0 200 200" width="200">
                <path d="M100 20C140 20 180 50 180 100C180 150 130 180 100 180C50 180 20 140 20 100C20 60 60 20 100 20Z" stroke="currentColor" strokeDasharray="8 8" strokeWidth="2"/>
              </svg>
            </div>
            <div className="relative mb-6">
              <div className="w-32 h-32 md:w-36 md:h-36 rounded-full overflow-hidden border-4 border-surface shadow-sm relative z-10 bg-gradient-to-br from-surface-container to-surface-container-high flex items-center justify-center">
                <span className="text-6xl">{interviewerName === 'Alex' ? '👨' : interviewerName === 'Priya' ? '👩' : '🧔'}</span>
              </div>
              <div className="absolute inset-0 rounded-full border-2 border-emerald-deep/20 scale-110 animate-ping" style={{ animationDuration: '3s' }} />
            </div>
            <h2 className="font-geist font-semibold text-2xl text-on-surface mb-1">{interviewerName}</h2>
            <p className="text-sm text-slate-muted mb-4 text-center">{persona.role}</p>
            {speech.recording ? (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-error-container/20 text-error text-xs font-medium">
                <div className="w-2 h-2 rounded-full bg-error animate-pulse" />
                Recording…
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-container text-on-surface-variant text-xs font-medium">
                <div className="w-2 h-2 rounded-full bg-emerald-deep animate-pulse" />
                {scoringIds.size > 0 ? 'Scoring…' : 'Listening…'}
              </div>
            )}

            {/* Last score */}
            {Object.keys(scores).length > 0 && (() => {
              const lastId = Object.keys(scores)[Object.keys(scores).length - 1]
              const sc = scores[lastId]
              return (
                <div className="mt-4 w-full bg-surface rounded-lg p-3 border border-outline-variant/20 text-xs">
                  <p className="text-slate-muted font-medium mb-2 text-center">Last Answer</p>
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
            })()}
          </div>
        </section>

        {/* Right pane: transcript + input */}
        <section className="w-full md:w-8/12 lg:w-9/12 flex flex-col bg-surface rounded-xl border border-outline-variant/30 overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-outline-variant/20 bg-surface-container-lowest/50 flex justify-between items-center">
            <h3 className="text-xs font-semibold text-slate-muted uppercase tracking-wider">Live Transcript</h3>
            <div className="flex items-center gap-2">
              {mode === 'timed' && timeLeft != null && (
                <span className={`text-sm font-mono font-bold ${timeLeft <= 15 ? 'text-error' : 'text-on-surface'}`}>
                  ⏱ {formatTime(timeLeft)}
                </span>
              )}
            </div>
          </div>

          {/* Transcript scroll */}
          <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-6">
            {messages.map(msg => (
              <div key={msg.id} className={`flex flex-col max-w-[85%] ${msg.role === 'ai' ? 'self-start' : 'self-end items-end'}`}>
                <span className="text-xs text-slate-muted mb-1 mx-1">{msg.role === 'ai' ? (msg.interviewer || 'Alex') : 'You'}</span>
                <div className={`p-4 rounded-2xl text-base leading-relaxed ${
                  msg.role === 'ai'
                    ? 'bg-surface-container-low text-on-surface rounded-tl-sm'
                    : 'bg-primary-container/10 border border-primary/10 text-on-surface rounded-tr-sm'
                }`}>
                  {msg.text}
                </div>
              </div>
            ))}

            {/* Interim speech */}
            {speech.recording && speech.interim && (
              <div className="flex flex-col max-w-[85%] self-end items-end">
                <span className="text-xs text-slate-muted mb-1 mr-1">You</span>
                <div className="bg-primary-container/10 border border-primary/10 text-on-surface p-4 rounded-2xl rounded-tr-sm text-base">
                  {speech.interim}
                  <span className="inline-block w-1.5 h-4 bg-primary ml-1 animate-pulse align-middle" />
                </div>
              </div>
            )}

            {followUp && (
              <div className="self-start max-w-[85%]">
                <div className={`p-4 rounded-xl border ${
                  followUp.action === 'challenge'
                    ? 'border-error-container bg-error-container/20'
                    : 'border-amber-light bg-amber-light/30'
                }`}>
                  <p className={`text-xs font-bold uppercase tracking-wide mb-1 ${followUp.action === 'challenge' ? 'text-error' : 'text-tertiary-container'}`}>
                    {followUp.action === 'follow_up' ? 'Follow-up' : followUp.action === 'probe_deeper' ? 'Probe Deeper' : 'Challenge'}
                  </p>
                  <p className="text-sm text-on-surface">{followUp.response}</p>
                </div>
              </div>
            )}
            <div ref={transcriptEndRef} />
          </div>

          {/* Bottom fade */}
          <div className="pointer-events-none h-8 bg-gradient-to-t from-surface to-transparent -mt-8 relative z-10" />

          {/* Input area */}
          <div className="border-t border-outline-variant/20 bg-surface p-4">
            <div className="flex flex-col gap-3">
              {!speech.recording && (
                <textarea
                  value={answerText}
                  onChange={e => {
                    const s = integrityRef.current
                    if (s.timeToFirstKeystroke === null && e.target.value.length > 0) s.timeToFirstKeystroke = Math.round((Date.now() - s.questionDisplayedAt) / 1000)
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
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  {speech.supported && (
                    <button
                      onClick={toggleVoice}
                      className={`flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg transition-colors font-medium ${
                        speech.recording
                          ? 'bg-error-container/50 text-error hover:bg-error-container'
                          : 'bg-surface-container text-on-surface hover:bg-surface-container-high'
                      }`}
                    >
                      <span className="material-symbols-outlined text-xl icon-fill">{speech.recording ? 'mic_off' : 'mic'}</span>
                      {speech.recording ? `Stop (${formatTime(speech.durationSeconds)})` : 'Record'}
                    </button>
                  )}
                  {mode === 'practice' && (
                    <button
                      onClick={() => { setAnswerText(''); speech.reset(); const ni = Math.min(currentIdx + 1, questions.length - 1); setCurrentIdx(ni); if (questions[ni]) setMessages(m => [...m, { id: `q-skip-${ni}`, role: 'ai', text: questions[ni].text, interviewer: questions[ni].interviewerName || 'Alex' }]) }}
                      className="flex items-center gap-1.5 text-sm text-slate-muted hover:text-on-surface border border-outline-variant/40 px-3 py-2 rounded-lg transition-colors"
                    >
                      <span className="material-symbols-outlined text-base">skip_next</span> Skip
                    </button>
                  )}
                </div>
                <button
                  onClick={handleSubmit}
                  disabled={submitting || completing || (!answerText.trim() && !speech.transcript.trim())}
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
        </section>
      </main>

      {/* Bottom control bar */}
      <div className="w-full bg-surface border-t border-outline-variant/30 shrink-0 shadow-[0_-4px_20px_rgba(0,0,0,0.02)] z-20">
        <div className="max-w-[1280px] mx-auto px-4 md:px-12 py-3 flex items-center justify-between gap-4">
          <div className="flex-1 truncate">
            <p className="text-xs text-slate-muted uppercase tracking-wider mb-0.5">Current Question</p>
            <p className="text-sm font-medium text-on-surface truncate pr-4">{currentQuestion?.text || 'Loading…'}</p>
          </div>
          {/* Mic indicator */}
          <div className="flex items-center justify-center shrink-0">
            <button
              onClick={toggleVoice}
              disabled={!speech.supported}
              className="relative group cursor-pointer disabled:opacity-40"
            >
              <div className={`absolute inset-0 rounded-full opacity-20 scale-150 ${speech.recording ? 'bg-error animate-pulse' : 'bg-primary group-hover:opacity-30'} transition-opacity`} />
              <div className={`relative w-14 h-14 rounded-full flex items-center justify-center shadow-md ${speech.recording ? 'bg-error' : 'bg-primary'} text-white transition-colors`}>
                <span className="material-symbols-outlined text-[28px] icon-fill">{speech.recording ? 'mic' : 'mic'}</span>
              </div>
            </button>
          </div>
          {/* Timer + end */}
          <div className="flex-1 flex items-center justify-end gap-6">
            {mode !== 'timed' && (
              <div className="flex items-center gap-2 text-slate-muted">
                <span className="material-symbols-outlined text-xl">timer</span>
                <span className="font-mono text-xl text-on-surface tabular-nums">
                  {formatTime(elapsedSeconds)}
                </span>
              </div>
            )}
            <button
              onClick={handleComplete}
              disabled={completing}
              className="px-5 py-2.5 rounded-lg bg-error-container/50 hover:bg-error-container text-on-error-container text-sm font-semibold transition-colors flex items-center gap-2 disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-lg">close</span>
              End Session
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
