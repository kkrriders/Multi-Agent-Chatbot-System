'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { interview, progress as progressApi, cv as cvApi, type Interview, type CandidateProfile } from '@/lib/api'
import { Sidebar } from '@/components/sidebar'
import { Topbar } from '@/components/Topbar'
import { getCachedUser } from '@/lib/auth'

const MODES = [
  { id: 'practice', label: 'Practice',        icon: 'mic',    desc: 'Untimed, specific topics.' },
  { id: 'timed',     label: 'Timed',           icon: 'timer',  desc: 'Simulate pressure.' },
  { id: 'full',      label: 'Full Behavioral', icon: 'groups', desc: 'STAR method focus.' },
  { id: 'panel',     label: 'Panel',           icon: 'forum',  desc: 'Multi-persona AI.' },
]

export default function DashboardPage() {
  const { loading: authLoading } = useRequireAuth()
  const [loading, setLoading] = useState(true)
  const [sessions, setSessions] = useState<Interview[]>([])
  const [streak, setStreak] = useState(0)
  const [summary, setSummary] = useState<{ weakAreas?: string[]; strongAreas?: string[]; avgTechnical?: number | null } | null>(null)
  const [profile, setProfile] = useState<CandidateProfile | null>(null)
  const user = getCachedUser()

  useEffect(() => {
    if (authLoading) return
    Promise.all([
      interview.history().then(d => setSessions(d.sessions || [])).catch(() => {}),
      progressApi.streak().then(d => setStreak(d.streak || 0)).catch(() => {}),
      progressApi.summary().then(d => setSummary(d.summary)).catch(() => {}),
      cvApi.profile().then(d => setProfile(d.profile)).catch(() => {}),
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
      <Topbar />

      <main className="flex-1 md:ml-64 pt-20 md:pt-24 px-margin-mobile md:px-margin-desktop pb-24 md:pb-12 w-full max-w-[1280px] mx-auto">
        {/* Welcome Header */}
        <div className="mb-xl">
          <h2 className="font-heading text-4xl md:text-5xl font-bold text-primary tracking-tight mb-2">Welcome back, {firstName}.</h2>
          <p className="text-lg text-on-surface-variant">Ready to ace your next interview?</p>
        </div>

        {/* Top Grid: Stats & Resume */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter mb-xl">
          {/* Avg Score */}
          <div className="glass-card rounded-xl p-lg flex flex-col justify-between relative overflow-hidden">
            <div className="absolute -top-8 -right-8 w-32 h-32 bg-secondary-fixed/30 rounded-full blur-2xl" />
            <div className="relative z-10">
              <h3 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-sm">Avg. Score</h3>
              <div className="flex items-end gap-2">
                <span className="font-heading text-4xl font-bold text-primary">{avgScore ?? '—'}</span>
                <span className="text-sm text-on-surface-variant pb-1">/100</span>
              </div>
            </div>
            <div className="mt-md w-full bg-surface-container-high rounded-full h-2 overflow-hidden relative z-10">
              <div
                className="bg-gradient-to-r from-secondary-container to-secondary h-full rounded-full transition-all duration-700"
                style={{ width: `${avgScore ?? 0}%` }}
              />
            </div>
          </div>

          {/* Sessions & Streak */}
          <div className="glass-card rounded-xl p-lg flex flex-col justify-between">
            <div className="flex justify-between items-start mb-md">
              <div>
                <h3 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-xs">Completed</h3>
                <span className="font-heading text-2xl font-bold text-primary">{completed.length} <span className="text-sm text-on-surface-variant font-normal">Sessions</span></span>
              </div>
              {streak > 0 && (
                <div className="bg-secondary-container/10 px-sm py-xs rounded-full border border-secondary/20 flex items-center gap-xs shrink-0">
                  <span className="material-symbols-outlined text-secondary text-base icon-fill">local_fire_department</span>
                  <span className="text-xs font-semibold text-secondary">{streak} Day Streak</span>
                </div>
              )}
            </div>
            <p className="text-sm text-on-surface-variant">
              {summary?.weakAreas?.length
                ? `Focus area: ${summary.weakAreas[0]}`
                : 'Consistent practice improves confidence by 40%.'}
            </p>
          </div>

          {/* Resume Status */}
          <div className="glass-card rounded-xl p-lg flex flex-col justify-between relative overflow-hidden group">
            <div className="relative z-10">
              <div className="flex items-center gap-sm mb-md">
                <span className="material-symbols-outlined text-secondary">description</span>
                <h3 className="text-xs font-semibold text-primary uppercase tracking-wider">Resume Status</h3>
              </div>
              <p className="text-sm text-on-surface-variant mb-md">
                {profile
                  ? `${profile.name || 'Your CV'} parsed successfully. AI context updated.`
                  : 'No CV on file yet — upload one to personalise your interviews.'}
              </p>
            </div>
            <Link
              href="/upload"
              className="relative z-10 self-start px-sm py-xs bg-secondary-container/20 text-on-secondary-container border border-secondary-container/50 rounded-full text-xs font-semibold uppercase hover:bg-secondary-container/30 transition-colors"
            >
              {profile ? 'Update Resume' : 'Upload Resume'}
            </Link>
            <div className="absolute -bottom-8 -right-8 w-32 h-32 bg-secondary-fixed opacity-20 rounded-full blur-2xl group-hover:scale-110 transition-transform duration-500" />
          </div>
        </div>

        {/* Interview Modes */}
        <div className="mb-xl">
          <h3 className="font-heading text-2xl font-bold text-primary mb-md">Select Mode</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-sm">
            {MODES.map(m => (
              <Link
                key={m.id}
                href="/interview"
                className="glass-card rounded-xl p-md flex flex-col items-start gap-md hover:bg-surface-container-lowest/80 transition-all duration-300 hover:scale-[1.03] text-left group"
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-transform group-hover:scale-110 ${
                  m.id === 'panel' ? 'bg-primary text-on-primary' : 'bg-secondary-container/20 text-secondary'
                }`}>
                  <span className="material-symbols-outlined">{m.icon}</span>
                </div>
                <div className="w-full">
                  <h4 className="text-sm font-semibold text-primary">{m.label}</h4>
                  <p className="text-xs text-on-surface-variant mt-1">{m.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent Sessions */}
        <div>
          <div className="flex justify-between items-end mb-md">
            <h3 className="font-heading text-2xl font-bold text-primary">Recent Sessions</h3>
            <Link href="/progress" className="text-xs font-semibold text-secondary hover:underline">View All</Link>
          </div>

          {sessions.length > 0 ? (
            <div className="glass-card rounded-xl overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-outline-variant/10">
                    <th className="py-md px-lg text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Role / Mode</th>
                    <th className="py-md px-lg text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Date</th>
                    <th className="py-md px-lg text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Score</th>
                    <th className="py-md px-lg text-xs font-semibold text-on-surface-variant uppercase tracking-wider text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/5">
                  {sessions.slice(0, 5).map(s => (
                    <tr key={s._id} className="hover:bg-surface-container-highest/20 transition-colors group">
                      <td className="py-md px-lg text-sm text-on-surface font-medium">
                        {s.targetRole || 'Interview'} <span className="text-on-surface-variant capitalize font-normal">— {s.mode}</span>
                      </td>
                      <td className="py-md px-lg text-sm text-on-surface-variant">{new Date(s.createdAt).toLocaleDateString()}</td>
                      <td className="py-md px-lg">
                        {s.overallScore != null ? (
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${scoreBadgeClass(s.overallScore)}`}>
                            {s.overallScore}/100
                          </span>
                        ) : (
                          <span className="text-xs text-on-surface-variant">—</span>
                        )}
                      </td>
                      <td className="py-md px-lg text-right">
                        {s.status === 'completed' && (
                          <Link href={`/results/${s._id}`} className={`text-sm font-semibold opacity-0 group-hover:opacity-100 transition-opacity ${s.overallScore != null ? scoreColor(s.overallScore) : 'text-primary'} hover:text-emerald-deep`}>
                            Review
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="glass-card rounded-xl border-dashed border-2 p-12 text-center">
              <span className="material-symbols-outlined text-slate-muted text-5xl mb-3 block">play_circle</span>
              <p className="text-slate-muted mb-6">No interviews yet — start your first session to see your progress here.</p>
              <Link href="/interview" className="inline-flex items-center gap-2 bg-primary text-white text-sm font-semibold px-6 py-3 rounded-lg hover:brightness-90 transition-colors shadow-sm">
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
