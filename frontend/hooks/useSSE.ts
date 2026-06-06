import { useEffect, useRef, useCallback } from 'react'
import { API_URL } from '@/lib/config'

export type SSEEvent =
  | { type: 'connected'; sessionId: string }
  | { type: 'scoring-start'; answerId: string }
  | { type: 'score-update'; answerId: string; scores: { relevance: number; depth: number; clarity: number; overall: number }; testResults?: Array<{ input: string; expectedOutput: string; actualOutput: string; passed: boolean; hidden: boolean; executionTimeMs: number | null }> }
  | { type: 'scoring-error'; answerId: string; error: string }
  | { type: 'integrity-update'; answerId: string; integrityScore: number; integrityFlag: string }
  | { type: 'follow-up'; answerId: string; action: 'follow_up' | 'probe_deeper' | 'challenge'; response: string }
  | { type: 'speech-event'; data: unknown }
  | { type: 'timer-tick'; remaining: number }
  | { type: 'session-ended'; sessionId: string }

type Handler = (event: SSEEvent) => void

export function useSSE(sessionId: string | null, onEvent: Handler) {
  const esRef = useRef<EventSource | null>(null)
  const handlerRef = useRef(onEvent)
  handlerRef.current = onEvent

  const connect = useCallback(() => {
    if (!sessionId) return
    esRef.current?.close()

    const es = new EventSource(`${API_URL}/api/interview/stream/${sessionId}`, { withCredentials: true })

    const handle = (eventName: string, e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data)
        if (typeof data !== 'object' || data === null || Array.isArray(data)) return
        const VALID_TYPES = new Set(['connected','scoring-start','score-update','scoring-error','follow-up','speech-event','timer-tick','session-ended','integrity-update'])
        if (!VALID_TYPES.has(eventName)) return
        handlerRef.current({ type: eventName as SSEEvent['type'], ...data })
      } catch { /* skip malformed */ }
    }

    const events: SSEEvent['type'][] = [
      'connected', 'scoring-start', 'score-update', 'scoring-error',
      'follow-up', 'speech-event', 'timer-tick', 'session-ended', 'integrity-update',
    ]
    events.forEach(name => es.addEventListener(name, (e) => handle(name, e as MessageEvent)))

    es.onerror = () => {
      es.close()
      setTimeout(connect, 3000)
    }

    esRef.current = es
  }, [sessionId])

  useEffect(() => {
    connect()
    return () => { esRef.current?.close() }
  }, [connect])
}
