import { useState, useRef, useCallback, useEffect } from 'react'
import { speech } from '../lib/api'

interface SpeechState {
  supported: boolean
  recording: boolean
  transcript: string
  interim: string
  durationSeconds: number
  transcribing: boolean
  usingFallback: boolean
}

interface UseSpeechReturn extends SpeechState {
  start: () => void
  stop: () => void
  reset: () => void
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SpeechRecognitionAny = any

declare global {
  interface Window {
    SpeechRecognition: SpeechRecognitionAny
    webkitSpeechRecognition: SpeechRecognitionAny
  }
}

const INITIAL_STATE: SpeechState = {
  supported: false,
  recording: false,
  transcript: '',
  interim: '',
  durationSeconds: 0,
  transcribing: false,
  usingFallback: false,
}

export function useSpeech(): UseSpeechReturn {
  const recRef      = useRef<SpeechRecognitionAny>(null)
  const mediaRecRef = useRef<MediaRecorder | null>(null)
  const chunksRef   = useRef<Blob[]>([])
  const timerRef    = useRef<NodeJS.Timeout | null>(null)
  const startTimeRef = useRef<number>(0)

  const [state, setState] = useState<SpeechState>(INITIAL_STATE)

  useEffect(() => {
    const hasSpeechAPI = !!(window.SpeechRecognition || window.webkitSpeechRecognition)
    const hasMediaRecorder = !!window.MediaRecorder
    setState(s => ({
      ...s,
      supported: hasSpeechAPI || hasMediaRecorder,
      usingFallback: !hasSpeechAPI && hasMediaRecorder,
    }))
  }, [])

  // ── Timer shared by both paths ────────────────────────────────────────────

  function startTimer() {
    startTimeRef.current = Date.now()
    timerRef.current = setInterval(() => {
      setState(s => ({ ...s, durationSeconds: Math.round((Date.now() - startTimeRef.current) / 1000) }))
    }, 1000)
  }

  function stopTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  // ── Web Speech API path ───────────────────────────────────────────────────

  const startNative = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return

    const rec = new SR()
    rec.continuous = true
    rec.interimResults = true
    rec.lang = 'en-US'

    let final = ''

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript
        if (e.results[i].isFinal) final += t + ' '
        else interim = t
      }
      setState(s => ({ ...s, transcript: final, interim }))
    }

    rec.onerror = () => setState(s => ({ ...s, recording: false, interim: '' }))
    rec.onend   = () => {
      setState(s => ({ ...s, recording: false, interim: '' }))
      stopTimer()
    }

    recRef.current = rec
    rec.start()
    startTimer()
    setState(s => ({ ...s, recording: true, transcript: '', interim: '', durationSeconds: 0 }))
  }, [])

  const stopNative = useCallback(() => {
    recRef.current?.stop()
    stopTimer()
    setState(s => ({ ...s, recording: false, interim: '' }))
  }, [])

  // ── MediaRecorder (Whisper) fallback path ─────────────────────────────────

  const startFallback = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')
          ? 'audio/ogg;codecs=opus'
          : ''

      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      chunksRef.current = []

      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }

      rec.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        stopTimer()

        const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' })
        chunksRef.current = []

        if (blob.size === 0) {
          setState(s => ({ ...s, recording: false, transcribing: false }))
          return
        }

        setState(s => ({ ...s, recording: false, transcribing: true }))
        try {
          const text = await speech.transcribe(blob)
          setState(s => ({ ...s, transcript: text, transcribing: false }))
        } catch {
          setState(s => ({ ...s, transcribing: false }))
        }
      }

      mediaRecRef.current = rec
      rec.start(250) // collect chunks every 250 ms
      startTimer()
      setState(s => ({ ...s, recording: true, transcript: '', interim: '', durationSeconds: 0, transcribing: false }))
    } catch {
      // Mic permission denied or MediaRecorder unavailable
      setState(s => ({ ...s, recording: false }))
    }
  }, [])

  const stopFallback = useCallback(() => {
    mediaRecRef.current?.stop()
    stopTimer()
    // transcribing state set in onstop handler
  }, [])

  // ── Public API ────────────────────────────────────────────────────────────

  const start = useCallback(() => {
    const hasSpeechAPI = !!(window.SpeechRecognition || window.webkitSpeechRecognition)
    if (hasSpeechAPI) startNative()
    else startFallback()
  }, [startNative, startFallback])

  const stop = useCallback(() => {
    const hasSpeechAPI = !!(window.SpeechRecognition || window.webkitSpeechRecognition)
    if (hasSpeechAPI) stopNative()
    else stopFallback()
  }, [stopNative, stopFallback])

  const reset = useCallback(() => {
    recRef.current?.stop()
    mediaRecRef.current?.stop()
    stopTimer()
    setState(INITIAL_STATE)
  }, [])

  return { ...state, start, stop, reset }
}
