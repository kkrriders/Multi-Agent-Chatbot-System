'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { interview as interviewApi, type Question, type Answer } from '@/lib/api'
import { useSSE } from '@/hooks/useSSE'
import { useSpeech } from '@/hooks/useSpeech'
import { Mic, MicOff, Send, SkipForward, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface ScoreState {
  [answerId: string]: { relevance: number; depth: number; clarity: number; overall: number }
}

const CATEGORY_COLOR: Record<string, string> = {
  technical: 'bg-blue-500/10 text-blue-400',
  behavioral: 'bg-purple-500/10 text-purple-400',
  situational: 'bg-amber-500/10 text-amber-400',
  intro: 'bg-green-500/10 text-green-400',
  closing: 'bg-gray-500/10 text-gray-400',
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const color = value >= 80 ? 'bg-green-500' : value >= 60 ? 'bg-yellow-500' : 'bg-red-500'
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{value}</span>
      </div>
      <div className="h-1.5 bg-border rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  )
}

export default function ActiveInterviewPage() {
  const router = useRouter()
  const params = useParams()
  const sessionId = params.sessionId as string

  const [questions, setQuestions] = useState<Question[]>([])
  const [answers, setAnswers] = useState<Answer[]>([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [answerText, setAnswerText] = useState('')
  const [mode, setMode] = useState<'practice' | 'timed' | 'full'>('practice')
  const [timeLeft, setTimeLeft] = useState<number | null>(null)
  const [inputMode, setInputMode] = useState<'text' | 'voice'>('text')
  const [submitting, setSubmitting] = useState(false)
  const [scores, setScores] = useState<ScoreState>({})
  const [scoringIds, setScoringIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [completing, setCompleting] = useState(false)

  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const startTimeRef = useRef<number>(Date.now())

  const speech = useSpeech()

  // SSE: real-time score updates
  useSSE(sessionId, useCallback((event) => {
    if (event.type === 'score-update') {
      setScores(s => ({ ...s, [event.answerId]: event.scores }))
      setScoringIds(s => { const n = new Set(s); n.delete(event.answerId); return n })
    }
    if (event.type === 'scoring-start') {
      setScoringIds(s => new Set([...s, event.answerId]))
    }
    if (event.type === 'scoring-error') {
      setScoringIds(s => { const n = new Set(s); n.delete(event.answerId); return n })
      toast.error('Scoring failed for one answer')
    }
  }, []))

  // Load session state
  useEffect(() => {
    interviewApi.state(sessionId).then(data => {
      setQuestions(data.questions)
      setAnswers(data.answers || [])
      setMode(data.interview.mode as any)
      const answeredCount = data.answers?.length || 0
      setCurrentIdx(answeredCount < data.questions.length ? answeredCount : 0)
      setLoading(false)
    }).catch(() => { toast.error('Session not found'); router.push('/interview') })
  }, [sessionId, router])

  // Timer for timed mode
  useEffect(() => {
    if (mode !== 'timed' || !questions[currentIdx]) return
    const limit = questions[currentIdx].timeLimitSeconds || 120
    setTimeLeft(limit)
    startTimeRef.current = Date.now()
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t == null || t <= 1) {
          clearInterval(timerRef.current!)
          return 0
        }
        return t - 1
      })
    }, 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [currentIdx, mode, questions])

  // Auto-fill from speech
  useEffect(() => {
    if (speech.transcript) setAnswerText(speech.transcript)
  }, [speech.transcript])

  const currentQuestion = questions[currentIdx]
  const isLastQuestion = currentIdx >= questions.length - 1

  const handleSubmit = async () => {
    if (!currentQuestion || (!answerText.trim() && !speech.transcript.trim())) {
      toast.error('Please type or speak your answer first')
      return
    }
    setSubmitting(true)
    if (timerRef.current) clearInterval(timerRef.current)

    const elapsed = Math.round((Date.now() - startTimeRef.current) / 1000)
    const text = answerText.trim() || speech.transcript.trim()

    try {
      await interviewApi.submitAnswer(sessionId, {
        questionId: currentQuestion.id,
        questionIndex: currentIdx,
        answerText: text,
        inputMethod: inputMode,
        timeSpentSeconds: elapsed,
        speechDurationSeconds: speech.durationSeconds || undefined,
      })

      speech.reset()
      setAnswerText('')

      if (isLastQuestion) {
        await handleComplete()
      } else {
        setCurrentIdx(i => i + 1)
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit answer')
    } finally {
      setSubmitting(false)
    }
  }

  const handleComplete = async () => {
    setCompleting(true)
    try {
      const result = await interviewApi.complete(sessionId)
      toast.success(`Interview complete! Score: ${result.overallScore}`)
      router.push(`/results/${sessionId}`)
    } catch {
      toast.error('Failed to complete session')
      setCompleting(false)
    }
  }

  const toggleVoice = () => {
    if (speech.recording) { speech.stop(); setInputMode('text') }
    else { speech.start(); setInputMode('voice') }
  }

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  )

  if (!currentQuestion) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
        <p className="font-semibold">All questions answered</p>
        <button onClick={handleComplete} disabled={completing} className="mt-4 bg-primary text-primary-foreground px-5 py-2 rounded-lg">
          {completing ? 'Finishing...' : 'View Results'}
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Progress bar */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 h-2 bg-border rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${((currentIdx) / questions.length) * 100}%` }}
            />
          </div>
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            {currentIdx + 1} / {questions.length}
          </span>
          {/* Timer */}
          {mode === 'timed' && timeLeft != null && (
            <span className={`text-sm font-mono font-bold ${timeLeft <= 15 ? 'text-red-500' : 'text-muted-foreground'}`}>
              {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
            </span>
          )}
        </div>

        {/* Question card */}
        <div className="border border-border rounded-xl p-6 mb-4">
          <div className="flex items-start justify-between gap-3 mb-4">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLOR[currentQuestion.category]}`}>
              {currentQuestion.category}
            </span>
            <span className="text-xs text-muted-foreground capitalize">{currentQuestion.difficulty}</span>
          </div>
          <p className="text-lg font-medium leading-relaxed">{currentQuestion.text}</p>
        </div>

        {/* Speech interim display */}
        {speech.recording && speech.interim && (
          <div className="border border-primary/30 rounded-lg px-4 py-2 mb-3 text-sm text-muted-foreground italic animate-pulse">
            {speech.interim}
          </div>
        )}

        {/* Answer input */}
        <div className="border border-border rounded-xl overflow-hidden mb-4">
          <textarea
            value={answerText}
            onChange={e => setAnswerText(e.target.value)}
            placeholder={speech.recording ? 'Listening... speak your answer' : 'Type your answer here...'}
            rows={6}
            disabled={speech.recording}
            className="w-full px-4 py-3 bg-background text-sm resize-none focus:outline-none disabled:opacity-60"
          />
          <div className="flex items-center justify-between px-4 py-2 border-t border-border bg-muted/30">
            <div className="flex items-center gap-2">
              {speech.supported && (
                <button
                  onClick={toggleVoice}
                  className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md transition-colors ${
                    speech.recording
                      ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20'
                      : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                  }`}
                >
                  {speech.recording ? <><MicOff className="w-3.5 h-3.5" /> Stop</> : <><Mic className="w-3.5 h-3.5" /> Record</>}
                </button>
              )}
              {speech.recording && (
                <span className="text-xs text-muted-foreground font-mono">
                  {Math.floor(speech.durationSeconds / 60)}:{String(speech.durationSeconds % 60).padStart(2, '0')}
                </span>
              )}
            </div>
            <span className="text-xs text-muted-foreground">{answerText.length} chars</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          {mode === 'practice' && (
            <button
              onClick={() => { setAnswerText(''); speech.reset(); setCurrentIdx(i => Math.min(i + 1, questions.length - 1)) }}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground border border-border px-4 py-2 rounded-lg"
            >
              <SkipForward className="w-4 h-4" /> Skip
            </button>
          )}
          <button
            onClick={handleSubmit}
            disabled={submitting || completing || (!answerText.trim() && !speech.transcript.trim())}
            className="flex-1 flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-lg py-2.5 font-medium disabled:opacity-50"
          >
            {submitting || completing
              ? <><Loader2 className="w-4 h-4 animate-spin" /> {completing ? 'Finishing...' : 'Submitting...'}</>
              : <><Send className="w-4 h-4" /> {isLastQuestion ? 'Submit & Finish' : 'Submit Answer'}</>
            }
          </button>
        </div>

        {/* Live score panel for previous answers */}
        {Object.keys(scores).length > 0 && (
          <div className="mt-6 border border-border rounded-xl p-4">
            <h3 className="text-sm font-semibold mb-3">Last Answer Score</h3>
            {(() => {
              const lastAnswerId = Object.keys(scores)[Object.keys(scores).length - 1]
              const s = scores[lastAnswerId]
              return (
                <div className="space-y-2">
                  <ScoreBar label="Relevance" value={s.relevance} />
                  <ScoreBar label="Depth" value={s.depth} />
                  <ScoreBar label="Clarity" value={s.clarity} />
                  <div className="pt-1 border-t border-border mt-2">
                    <div className="flex justify-between text-sm font-bold">
                      <span>Overall</span>
                      <span className={s.overall >= 80 ? 'text-green-500' : s.overall >= 60 ? 'text-yellow-500' : 'text-red-500'}>
                        {s.overall}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })()}
          </div>
        )}

        {/* Scoring spinner */}
        {scoringIds.size > 0 && (
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Scoring your answer...
          </div>
        )}
      </div>
    </div>
  )
}
