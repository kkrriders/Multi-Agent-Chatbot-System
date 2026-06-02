'use client'

import { useEffect, useState } from 'react'
import { progress as progressApi } from '@/lib/api'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { Nav } from '@/components/nav'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { Flame, TrendingUp, AlertTriangle, CheckCircle2 } from 'lucide-react'

export default function ProgressPage() {
  useRequireAuth()
  const [summary, setSummary] = useState<{ weakAreas?: string[]; strongAreas?: string[]; cvGaps?: string[]; avgTechnical?: number | null } | null>(null)
  const [streak, setStreak] = useState(0)
  const [timeline, setTimeline] = useState<Array<{ interviewId: string; observations: Array<{ type: string; score?: number; timestamp?: string; concept?: string }> }>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      progressApi.summary().then(d => setSummary(d.summary)),
      progressApi.streak().then(d => setStreak(d.streak)),
      progressApi.timeline().then(d => setTimeline(d.timeline as typeof timeline)),
    ]).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const chartData = timeline.flatMap(session =>
    session.observations
      .filter(o => o.type === 'technical_accuracy' && typeof o.score === 'number')
      .map(o => ({
        date: o.timestamp ? new Date(o.timestamp).toLocaleDateString('en', { month: 'short', day: 'numeric' }) : '',
        score: o.score,
        concept: o.concept,
      }))
  ).slice(-20)

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
    </div>
  )

  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <div className="pt-14">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <h1 className="text-2xl font-bold mb-6">Progress</h1>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            <div className="border border-border rounded-xl p-4">
              <Flame className="w-5 h-5 text-orange-400 mb-2" />
              <div className="text-2xl font-bold">{streak}d</div>
              <div className="text-xs text-muted-foreground">Current Streak</div>
            </div>
            <div className="border border-border rounded-xl p-4">
              <TrendingUp className="w-5 h-5 text-primary mb-2" />
              <div className="text-2xl font-bold">{summary?.avgTechnical ?? '—'}</div>
              <div className="text-xs text-muted-foreground">Avg Technical</div>
            </div>
            <div className="border border-border rounded-xl p-4">
              <AlertTriangle className="w-5 h-5 text-yellow-400 mb-2" />
              <div className="text-2xl font-bold">{summary?.weakAreas?.length ?? 0}</div>
              <div className="text-xs text-muted-foreground">Weak Areas</div>
            </div>
            <div className="border border-border rounded-xl p-4">
              <CheckCircle2 className="w-5 h-5 text-green-400 mb-2" />
              <div className="text-2xl font-bold">{summary?.strongAreas?.length ?? 0}</div>
              <div className="text-xs text-muted-foreground">Strong Areas</div>
            </div>
          </div>

          {chartData.length > 1 && (
            <div className="border border-border rounded-xl p-5 mb-6">
              <h2 className="font-semibold mb-4">Score Over Time</h2>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="score" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-4 mb-6">
            {(summary?.weakAreas?.length ?? 0) > 0 && (
              <div className="border border-border rounded-xl p-4">
                <h2 className="font-semibold mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-400" /> Weak Areas
                </h2>
                <div className="flex flex-wrap gap-2">
                  {summary?.weakAreas?.map((a: string) => (
                    <span key={a} className="text-xs bg-red-500/10 text-red-400 px-2.5 py-1 rounded-full">{a}</span>
                  ))}
                </div>
              </div>
            )}
            {(summary?.strongAreas?.length ?? 0) > 0 && (
              <div className="border border-border rounded-xl p-4">
                <h2 className="font-semibold mb-3 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-400" /> Strong Areas
                </h2>
                <div className="flex flex-wrap gap-2">
                  {summary?.strongAreas?.map((a: string) => (
                    <span key={a} className="text-xs bg-green-500/10 text-green-400 px-2.5 py-1 rounded-full">{a}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {(summary?.cvGaps?.length ?? 0) > 0 && (
            <div className="border border-border rounded-xl p-4">
              <h2 className="font-semibold mb-3">CV Skill Gaps</h2>
              <div className="flex flex-wrap gap-2">
                {summary?.cvGaps?.map((g: string) => (
                  <span key={g} className="text-xs bg-muted text-muted-foreground px-2.5 py-1 rounded-full">{g}</span>
                ))}
              </div>
            </div>
          )}

          {chartData.length === 0 && !(summary?.weakAreas?.length) && (
            <div className="text-center py-16 border border-dashed border-border rounded-xl">
              <TrendingUp className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">Complete an interview to start tracking progress</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
