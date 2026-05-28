'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { checkAuth } from '@/lib/auth'
import { interview, progress as progressApi } from '@/lib/api'
import { Nav } from '@/components/nav'
import { Play, UploadCloud, BarChart2, Trophy, Flame, Target, Clock } from 'lucide-react'

export default function DashboardPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [sessions, setSessions] = useState<any[]>([])
  const [streak, setStreak] = useState(0)
  const [summary, setSummary] = useState<any>(null)

  useEffect(() => {
    checkAuth().then(user => {
      if (!user) { router.push('/login'); return }
      Promise.all([
        interview.history().then(d => setSessions(d.sessions || [])).catch(() => {}),
        progressApi.streak().then(d => setStreak(d.streak || 0)).catch(() => {}),
        progressApi.summary().then(d => setSummary(d.summary)).catch(() => {}),
      ]).finally(() => setLoading(false))
    })
  }, [router])

  const completed = sessions.filter(s => s.status === 'completed')
  const avgScore = completed.length
    ? Math.round(completed.reduce((s, c) => s + (c.overallScore || 0), 0) / completed.length)
    : null

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
    </div>
  )

  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <div className="pt-14">
        <div className="max-w-5xl mx-auto px-4 py-8">
          <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

          {/* Stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            {[
              { icon: Target,  label: 'Sessions',    value: completed.length },
              { icon: Trophy,  label: 'Avg Score',   value: avgScore != null ? `${avgScore}` : '—' },
              { icon: Flame,   label: 'Streak',      value: `${streak}d` },
              { icon: BarChart2, label: 'Weak Areas', value: summary?.weakAreas?.length ?? '—' },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="border border-border rounded-xl p-4">
                <Icon className="w-5 h-5 text-primary mb-2" />
                <div className="text-2xl font-bold">{value}</div>
                <div className="text-xs text-muted-foreground">{label}</div>
              </div>
            ))}
          </div>

          {/* Quick actions */}
          <div className="grid sm:grid-cols-3 gap-4 mb-8">
            <Link href="/interview" className="flex items-center gap-3 border border-border rounded-xl p-4 hover:border-primary hover:bg-primary/5 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Play className="w-5 h-5 text-primary" />
              </div>
              <div>
                <div className="font-semibold text-sm">Start Interview</div>
                <div className="text-xs text-muted-foreground">Practice, timed, or full mock</div>
              </div>
            </Link>
            <Link href="/upload" className="flex items-center gap-3 border border-border rounded-xl p-4 hover:border-primary hover:bg-primary/5 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <UploadCloud className="w-5 h-5 text-primary" />
              </div>
              <div>
                <div className="font-semibold text-sm">Upload CV</div>
                <div className="text-xs text-muted-foreground">Parse skills & experience</div>
              </div>
            </Link>
            <Link href="/progress" className="flex items-center gap-3 border border-border rounded-xl p-4 hover:border-primary hover:bg-primary/5 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <BarChart2 className="w-5 h-5 text-primary" />
              </div>
              <div>
                <div className="font-semibold text-sm">View Progress</div>
                <div className="text-xs text-muted-foreground">Trends & weak areas</div>
              </div>
            </Link>
          </div>

          {/* Recent sessions */}
          {sessions.length > 0 && (
            <div>
              <h2 className="font-semibold mb-3">Recent Sessions</h2>
              <div className="space-y-2">
                {sessions.slice(0, 5).map(s => (
                  <div key={s._id} className="flex items-center justify-between border border-border rounded-lg px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <div className="text-sm font-medium">{s.targetRole || 'Interview'} — {s.mode}</div>
                        <div className="text-xs text-muted-foreground">{new Date(s.createdAt).toLocaleDateString()}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {s.overallScore != null && (
                        <span className={`text-sm font-bold ${s.overallScore >= 80 ? 'text-green-500' : s.overallScore >= 60 ? 'text-yellow-500' : 'text-red-500'}`}>
                          {s.overallScore}
                        </span>
                      )}
                      {s.status === 'completed' && (
                        <Link href={`/results/${s._id}`} className="text-xs text-primary underline underline-offset-2">Results</Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {sessions.length === 0 && (
            <div className="text-center py-12 border border-dashed border-border rounded-xl">
              <Play className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground mb-4">No interviews yet — start your first session</p>
              <Link href="/interview" className="bg-primary text-primary-foreground px-5 py-2 rounded-lg font-medium text-sm">
                Start Interview
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
