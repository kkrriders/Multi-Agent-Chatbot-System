import { useState, useRef, useCallback, useEffect } from 'react'

interface SpeechState {
  supported: boolean
  recording: boolean
  transcript: string
  interim: string
  durationSeconds: number
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

export function useSpeech(): UseSpeechReturn {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recRef = useRef<any>(null)
  const [state, setState] = useState<SpeechState>({
    supported: false,
    recording: false,
    transcript: '',
    interim: '',
    durationSeconds: 0,
  })

  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const startTimeRef = useRef<number>(0)

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    setState(s => ({ ...s, supported: !!SR }))
  }, [])

  const start = useCallback(() => {
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

    rec.onerror = () => {
      setState(s => ({ ...s, recording: false, interim: '' }))
    }

    rec.onend = () => {
      setState(s => ({ ...s, recording: false, interim: '' }))
      if (timerRef.current) clearInterval(timerRef.current)
    }

    recRef.current = rec
    rec.start()
    startTimeRef.current = Date.now()

    timerRef.current = setInterval(() => {
      setState(s => ({ ...s, durationSeconds: Math.round((Date.now() - startTimeRef.current) / 1000) }))
    }, 1000)

    setState(s => ({ ...s, recording: true, transcript: '', interim: '', durationSeconds: 0 }))
  }, [])

  const stop = useCallback(() => {
    recRef.current?.stop()
    if (timerRef.current) clearInterval(timerRef.current)
    setState(s => ({ ...s, recording: false, interim: '' }))
  }, [])

  const reset = useCallback(() => {
    recRef.current?.stop()
    if (timerRef.current) clearInterval(timerRef.current)
    setState(s => ({ ...s, recording: false, transcript: '', interim: '', durationSeconds: 0 }))
  }, [])

  return { ...state, start, stop, reset }
}
