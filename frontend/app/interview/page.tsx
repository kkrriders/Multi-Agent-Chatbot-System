'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { interview as interviewApi } from '@/lib/api'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { Nav } from '@/components/nav'
import { Play, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

const MODES = [
  { id: 'practice', label: 'Practice',        desc: 'Unlimited time · Hints available · No pressure' },
  { id: 'timed',    label: 'Timed',           desc: 'Strict per-question limits · Real interview feel' },
  { id: 'full',     label: 'Full Mock',       desc: 'Intro → Technical → Behavioral → Closing' },
  { id: 'panel',    label: 'Panel Interview', desc: 'Alex (Technical) · Priya (Behavioral) · James (Bar Raiser)' },
]

export default function InterviewSetupPage() {
  const { loading: authLoading } = useRequireAuth()
  const router = useRouter()
  const [mode, setMode] = useState('practice')
  const [role, setRole] = useState('')
  const [jd, setJd] = useState('')
  const [loading, setLoading] = useState(false)

  const start = async () => {
    setLoading(true)
    try {
      const data = await interviewApi.start(mode, role || undefined, jd || undefined)
      router.push(`/interview/${data.sessionId}`)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to start interview')
      setLoading(false)
    }
  }

  if (authLoading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
    </div>
  )

  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <div className="pt-14">
        <div className="max-w-lg mx-auto px-4 py-8">
          <h1 className="text-2xl font-bold mb-1">Start Interview</h1>
          <p className="text-muted-foreground mb-6">Choose your mode and optionally paste a job description to tailor the questions</p>

          <div className="space-y-2 mb-6">
            {MODES.map(m => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={`w-full text-left border rounded-xl px-4 py-3 transition-all ${
                  mode === m.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{m.label}</span>
                  {mode === m.id && <Play className="w-4 h-4 text-primary" />}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{m.desc}</p>
              </button>
            ))}
          </div>

          <div className="mb-4">
            <label className="text-sm font-medium">Target Role <span className="text-muted-foreground font-normal">(optional)</span></label>
            <input
              value={role} onChange={e => setRole(e.target.value)}
              placeholder="e.g. Frontend Developer, Data Scientist"
              className="mt-1 w-full border border-border rounded-lg px-3 py-2 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="mb-6">
            <label className="text-sm font-medium">
              Job Description <span className="text-muted-foreground font-normal">(optional — tailors questions to this role)</span>
            </label>
            <textarea
              value={jd} onChange={e => setJd(e.target.value)}
              placeholder="Paste the job description here..."
              rows={5} maxLength={10000}
              className="mt-1 w-full border border-border rounded-lg px-3 py-2 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
            <p className="text-xs text-muted-foreground text-right">{jd.length}/10,000</p>
          </div>

          <button
            onClick={start} disabled={loading}
            className="w-full bg-primary text-primary-foreground rounded-lg py-3 font-medium disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating questions...</> : <><Play className="w-4 h-4" /> Start Interview</>}
          </button>
        </div>
      </div>
    </div>
  )
}
