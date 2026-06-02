'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { interview, progress as progressApi, type Interview } from '@/lib/api'
import { Sidebar } from '@/components/sidebar'
import { getCachedUser } from '@/lib/auth'

export default function DashboardPage() {
  const { loading: authLoading } = useRequireAuth()
  const [loading, setLoading] = useState(true)
  const [sessions, setSessions] = useState<Interview[]>([])
  const [streak, setStreak] = useState(0)
  const [summary, setSummary] = useState<{ weakAreas?: string[]; strongAreas?: string[]; avgTechnical?: number | null } | null>(null)
  const user = getCachedUser()

  useEffect(() => {
    if (authLoading) return
    Promise.all([
      interview.history().then(d => setSessions(d.sessions || [])).catch(() => {}),
      progressApi.streak().then(d => setStreak(d.streak || 0)).catch(() => {}),
      progressApi.summary().then(d => setSummary(d.summary)).catch(() => {}),
    ]).finally(() => setLoading(false))
  }, [authLoading])

  const completed = sessions.filter(s => s.status === 'completed')
  const avgScore = completed.length
    ? Math.round(completed.reduce((s, c) => s + (c.overallScore || 0), 0) / completed.length)
    : null

  const scoreColor = (s: number) => s >= 80 ? 'text-primary' : s >= 60 ? 'text-tertiary-container' : 'text-error'
  const scoreBadgeClass = (s: number) => s >= 80
    ? 'bg-primary-container/20 text-emerald-deep border-primary-container/30'
    : s >= 60
    ? 'bg-amber-light text-tertiary-container border-tertiary-container/10'
    : 'bg-error-container/20 text-error border-error-container/30'

  if (loading || authLoading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <span className="material-symbols-outlined text-primary text-4xl animate-spin">sync</span>
        <p className="text-sm text-slate-muted">Loading your dashboard…</p>
      </div>
    </div>
  )

  const firstName = user?.fullName?.split(' ')[0] || 'there'

  return (
    <div className="bg-background text-on-background min-h-screen flex antialiased">
      <Sidebar />

      <main className="flex-1 md:ml-64 pt-20 md:pt-8 px-4 md:px-12 pb-24 md:pb-12 w-full max-w-[1280px] mx-auto">
        {/* Header */}
        <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h2 className="font-geist font-bold text-2xl md:text-3xl text-on-surface mb-2">
              Ready for your next session, {firstName}?
            </h2>
            <p className="text-lg text-slate-muted">Your structured growth plan is on track. Let&apos;s keep the momentum going.</p>
          </div>
          <Link
            href="/interview"
            className="inline-flex items-center justify-center gap-2 bg-primary text-white text-sm font-semibold px-6 py-3 rounded-lg shadow-sm hover:bg-emerald-deep transition-colors"
          >
            <span className="material-symbols-outlined">play_arrow</span>
            Start New Interview
          </Link>
        </div>

        {/* Bento grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Left column: streak + weak area */}
          <div className="md:col-span-4 flex flex-col gap-6">
            {/* Streak */}
            <div className="bg-white rounded-xl p-6 border border-outline-variant/15 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)] relative overflow-hidden group hover:shadow-[0_8px_30px_-12px_rgba(0,108,73,0.1)] transition-shadow">
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-amber-light/30 rounded-full blur-2xl group-hover:bg-amber-light/50 transition-colors" />
              <div className="flex items-center gap-4 mb-4 relative z-10">
                <div className="w-12 h-12 bg-amber-light rounded-full flex items-center justify-center text-tertiary-container shadow-sm border border-tertiary-container/10">
                  <span className="material-symbols-outlined text-2xl icon-fill">local_fire_department</span>
                </div>
                <div>
                  <h3 className="font-geist font-semibold text-xl text-on-surface">
                    {streak > 0 ? `${streak} Day Streak!` : 'Start your streak!'}
                  </h3>
                  <p className="text-xs text-slate-muted">{streak > 0 ? "You're on fire. Keep practicing." : 'Practice daily to build momentum.'}</p>
                </div>
              </div>
              <div className="flex gap-1 relative z-10">
                {Array.from({ length: 7 }).map((_, i) => (
                  <div key={i} className={`h-2 flex-1 rounded-full ${i < streak ? 'bg-primary' : 'bg-surface-container'}`} />
                ))}
              </div>
            </div>

            {/* Weak area / focus */}
            {summary?.weakAreas && summary.weakAreas.length > 0 ? (
              <div className="bg-error-container/30 rounded-xl p-6 border border-error-container shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="material-symbols-outlined text-error text-lg">warning</span>
                    <h3 className="text-xs font-bold text-error uppercase tracking-wider">Focus Area</h3>
                  </div>
                  <p className="font-geist font-semibold text-lg text-on-surface mb-2">{summary.weakAreas[0]}</p>
                  <p className="text-xs text-slate-muted mb-4">Our AI detected this as an area needing improvement. Practice this to elevate your score.</p>
                </div>
                <Link href="/progress" className="w-full py-2 bg-white border border-error/20 text-error rounded-lg text-xs font-semibold hover:bg-error/5 transition-colors text-center block">
                  View Progress
                </Link>
              </div>
            ) : (
              <div className="bg-primary-container/10 rounded-xl p-6 border border-primary/20 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="material-symbols-outlined text-primary text-lg icon-fill">verified</span>
                    <h3 className="text-xs font-bold text-primary uppercase tracking-wider">All Clear</h3>
                  </div>
                  <p className="font-geist font-semibold text-lg text-on-surface mb-2">No weak areas yet</p>
                  <p className="text-xs text-slate-muted mb-4">Complete interviews to reveal personalized focus areas.</p>
                </div>
                <Link href="/interview" className="w-full py-2 bg-white border border-primary/20 text-primary rounded-lg text-xs font-semibold hover:bg-primary/5 transition-colors text-center block">
                  Start Interview
                </Link>
              </div>
            )}
          </div>

          {/* Performance overview */}
          <div className="md:col-span-8 bg-white rounded-xl p-6 border border-outline-variant/15 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)]">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-geist font-semibold text-xl text-on-surface">Performance Overview</h3>
              <Link href="/progress" className="text-primary hover:text-emerald-deep text-xs font-semibold flex items-center gap-1 transition-colors">
                Detailed Report <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </Link>
            </div>

            {avgScore != null ? (
              <div className="flex flex-col md:flex-row gap-8 items-center justify-center">
                <div className="w-full max-w-sm flex flex-col gap-6 p-4">
                  {[
                    { label: 'Sessions Completed', value: completed.length, max: Math.max(completed.length, 10), color: 'bg-primary' },
                    { label: 'Average Score', value: avgScore, max: 100, color: avgScore >= 70 ? 'bg-primary' : 'bg-amber-light border border-tertiary-container/20' },
                    { label: 'Strong Areas', value: summary?.strongAreas?.length || 0, max: Math.max(summary?.strongAreas?.length || 0, 5), color: 'bg-primary' },
                  ].map(({ label, value, max, color }) => (
                    <div key={label}>
                      <div className="flex justify-between text-xs mb-2">
                        <span className="text-on-surface font-semibold">{label}</span>
                        <span className="text-emerald-deep font-bold">{value}{label === 'Average Score' ? '%' : ''}</span>
                      </div>
                      <div className="w-full bg-surface-container rounded-full h-3 overflow-hidden border border-outline-variant/20">
                        <div className={`${color} h-3 rounded-full transition-all duration-700`} style={{ width: `${max > 0 ? (value / max) * 100 : 0}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="bg-surface-container-low rounded-lg p-5 border border-outline-variant/20 max-w-xs">
                  <div className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-primary mt-1 icon-fill">lightbulb</span>
                    <div>
                      <h4 className="text-sm font-semibold text-on-surface mb-1">AI Insight</h4>
                      <p className="text-sm text-slate-muted leading-relaxed">
                        {avgScore >= 75
                          ? 'Great scores! Focus on structured communication (STAR method) to reach the top tier.'
                          : 'Keep practicing consistently — scores typically improve 15% after 5 sessions.'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <span className="material-symbols-outlined text-slate-muted text-5xl mb-3">bar_chart</span>
                <p className="text-slate-muted text-sm">Complete your first interview to see performance analytics.</p>
              </div>
            )}
          </div>

          {/* Recent sessions table */}
          {sessions.length > 0 && (
            <div className="md:col-span-12 bg-white rounded-xl border border-outline-variant/15 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)] overflow-hidden mt-4">
              <div className="p-6 border-b border-outline-variant/15 flex justify-between items-center bg-surface-bright/50">
                <h3 className="font-geist font-semibold text-xl text-on-surface">Recent Sessions</h3>
                <Link href="/progress" className="text-xs text-slate-muted hover:text-primary transition-colors">View All</Link>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface-container-lowest text-xs text-slate-muted border-b border-outline-variant/15">
                      <th className="py-4 px-6 font-medium">Role / Mode</th>
                      <th className="py-4 px-6 font-medium">Date</th>
                      <th className="py-4 px-6 font-medium">Overall Score</th>
                      <th className="py-4 px-6 font-medium text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {sessions.slice(0, 5).map(s => (
                      <tr key={s._id} className="border-b border-outline-variant/10 hover:bg-surface-container-lowest/50 transition-colors group">
                        <td className="py-4 px-6 font-medium text-on-surface flex items-center gap-3">
                          <div className="w-8 h-8 rounded-md bg-surface-container flex items-center justify-center text-slate-muted border border-outline-variant/20">
                            <span className="material-symbols-outlined text-base">domain</span>
                          </div>
                          {s.targetRole || 'Interview'} — <span className="text-slate-muted capitalize">{s.mode}</span>
                        </td>
                        <td className="py-4 px-6 text-slate-muted">{new Date(s.createdAt).toLocaleDateString()}</td>
                        <td className="py-4 px-6">
                          {s.overallScore != null ? (
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${scoreBadgeClass(s.overallScore)}`}>
                              {s.overallScore}/100
                            </span>
                          ) : (
                            <span className="text-xs text-slate-muted">—</span>
                          )}
                        </td>
                        <td className="py-4 px-6 text-right">
                          {s.status === 'completed' && (
                            <Link href={`/results/${s._id}`} className={`text-sm font-semibold opacity-0 group-hover:opacity-100 transition-opacity ${s.overallScore && s.overallScore >= 0 ? scoreColor(s.overallScore) : 'text-primary'} hover:text-emerald-deep`}>
                              Review
                            </Link>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {sessions.length === 0 && (
            <div className="md:col-span-12 bg-white rounded-xl border border-dashed border-outline-variant/30 p-12 text-center mt-4">
              <span className="material-symbols-outlined text-slate-muted text-5xl mb-3 block">play_circle</span>
              <p className="text-slate-muted mb-6">No interviews yet — start your first session to see your progress here.</p>
              <Link href="/interview" className="inline-flex items-center gap-2 bg-primary text-white text-sm font-semibold px-6 py-3 rounded-lg hover:bg-emerald-deep transition-colors shadow-sm">
                <span className="material-symbols-outlined">play_arrow</span>
                Start Interview
              </Link>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
