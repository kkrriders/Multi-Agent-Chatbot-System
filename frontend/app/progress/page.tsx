'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { progress as progressApi, type Achievement } from '@/lib/api'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { Sidebar } from '@/components/sidebar'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

export default function ProgressPage() {
  useRequireAuth()
  const [summary, setSummary] = useState<{
    weakAreas?: string[]; strongAreas?: string[]; cvGaps?: string[]; avgTechnical?: number | null
  } | null>(null)
  const [streak, setStreak] = useState(0)
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [timeline, setTimeline] = useState<Array<{
    interviewId: string
    observations: Array<{ type: string; score?: number; timestamp?: string; concept?: string }>
  }>>([])
  const [sessions, setSessions] = useState<Array<{
    _id: string; targetRole: string; mode: string; overallScore?: number; createdAt: string; durationSeconds?: number
  }>>([])
  const [filterMode, setFilterMode] = useState('All Modes')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      progressApi.summary().then(d => setSummary(d.summary)),
      progressApi.streak().then(d => setStreak(d.streak)),
      progressApi.timeline().then(d => setTimeline(d.timeline as typeof timeline)),
      progressApi.achievements().then(d => setAchievements(d.achievements || [])).catch(() => {}),
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

  const BADGE_ICONS: Record<string, { icon: string; color: string; bg: string }> = {
    top_scorer:    { icon: 'workspace_premium', color: 'text-tertiary-container', bg: 'bg-amber-light' },
    quick_thinker: { icon: 'speed',             color: 'text-secondary',          bg: 'bg-secondary-fixed' },
    streak_5:      { icon: 'local_fire_department', color: 'text-primary',        bg: 'bg-primary-container/20' },
    first_session: { icon: 'flag',              color: 'text-primary',            bg: 'bg-primary-container/10' },
    communicator:  { icon: 'campaign',          color: 'text-secondary',          bg: 'bg-secondary-container/30' },
  }

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <span className="material-symbols-outlined text-primary text-4xl animate-spin">sync</span>
    </div>
  )

  return (
    <div className="bg-background text-on-background min-h-screen flex antialiased">
      <Sidebar />

      <main className="flex-1 md:ml-64 p-4 md:p-12 max-w-[1280px] mx-auto w-full pb-24 md:pb-12">
        {/* Header */}
        <header className="mb-12 mt-16 md:mt-0">
          <h1 className="font-geist font-bold text-4xl md:text-5xl text-on-background mb-2">History</h1>
          <p className="text-lg text-slate-muted">Track your progress and review past sessions.</p>
        </header>

        {/* Top section: Chart + Badges */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12">
          {/* Performance chart */}
          <div className="lg:col-span-2 bg-white rounded-xl p-6 border border-outline-variant/15 shadow-sm flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="font-geist font-semibold text-2xl text-on-surface">Performance Trends</h2>
                <p className="text-base text-slate-muted mt-1">Average score over the last 30 days</p>
              </div>
              <div className="flex items-center gap-2 bg-primary-container/10 px-3 py-1.5 rounded-full border border-primary/20">
                <span className="material-symbols-outlined text-primary text-lg">trending_up</span>
                <span className="text-sm font-semibold text-primary">+12%</span>
              </div>
            </div>
            {chartData.length > 1 ? (
              <div className="flex-1 min-h-[200px]">
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={chartData}>
                    <defs>
                      <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e7e8e9" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748B' }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748B' }} />
                    <Tooltip
                      contentStyle={{ background: 'white', border: '1px solid #bbcabf', borderRadius: '8px', fontSize: 12 }}
                    />
                    <Line type="monotone" dataKey="score" stroke="#006c49" strokeWidth={2} dot={{ r: 3, fill: '#fff', stroke: '#006c49', strokeWidth: 1 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex-1 min-h-[200px] flex items-center justify-center">
                <div className="text-center">
                  <span className="material-symbols-outlined text-slate-muted text-4xl block mb-2">show_chart</span>
                  <p className="text-sm text-slate-muted">Complete interviews to see your trend</p>
                </div>
              </div>
            )}
          </div>

          {/* Achievements */}
          <div className="bg-white rounded-xl p-6 border border-outline-variant/15 shadow-sm flex flex-col">
            <h2 className="font-geist font-semibold text-2xl text-on-surface mb-6">Achievements</h2>
            <div className="grid grid-cols-2 gap-4 flex-1">
              {achievements.slice(0, 3).map(ach => {
                const cfg = BADGE_ICONS[ach.type] || { icon: 'emoji_events', color: 'text-primary', bg: 'bg-primary-container/10' }
                return (
                  <div key={ach._id || ach.type} className="flex flex-col items-center justify-center p-4 bg-surface-container-low rounded-lg border border-slate-muted/10 text-center hover:shadow-sm transition-all">
                    <div className={`w-12 h-12 rounded-full ${cfg.bg} flex items-center justify-center mb-3`}>
                      <span className={`material-symbols-outlined text-2xl icon-fill ${cfg.color}`}>{cfg.icon}</span>
                    </div>
                    <span className="text-sm font-semibold text-on-surface">{ach.badge?.label ?? ach.type}</span>
                    <span className="text-xs text-slate-muted mt-1">{ach.badge?.description ?? ''}</span>
                  </div>
                )
              })}
              {achievements.length === 0 && (
                <div className="col-span-2 flex flex-col items-center justify-center py-6 text-center">
                  <span className="material-symbols-outlined text-slate-muted text-4xl mb-2">emoji_events</span>
                  <p className="text-xs text-slate-muted">Complete sessions to earn badges</p>
                </div>
              )}
              {/* Locked badge placeholder */}
              <div className="flex flex-col items-center justify-center p-4 border border-dashed border-slate-muted/30 rounded-lg text-center opacity-60">
                <div className="w-12 h-12 rounded-full bg-surface-variant flex items-center justify-center mb-3">
                  <span className="material-symbols-outlined text-slate-muted text-2xl">lock</span>
                </div>
                <span className="text-sm font-semibold text-slate-muted">
                  {achievements.length < 3 ? 'Keep practicing' : 'Next badge'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Sessions list */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
            <h2 className="font-geist font-semibold text-2xl text-on-surface">Recent Sessions</h2>
            <div className="flex flex-wrap gap-2">
              {['All Modes', 'Practice', 'Timed', 'Full', 'Panel'].map(opt => (
                <button
                  key={opt}
                  onClick={() => setFilterMode(opt)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
                    filterMode === opt
                      ? 'bg-primary text-white border-primary'
                      : 'bg-surface border-outline-variant/30 text-on-surface hover:bg-surface-container-low'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          {timeline.length === 0 && !summary?.weakAreas?.length ? (
            <div className="text-center py-16 border border-dashed border-outline-variant/30 rounded-xl">
              <span className="material-symbols-outlined text-slate-muted text-5xl mb-3 block">trending_up</span>
              <p className="text-slate-muted">Complete an interview to start tracking progress</p>
              <Link href="/interview" className="inline-flex items-center gap-2 mt-4 bg-primary text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-emerald-deep transition-colors">
                Start Interview
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="bg-white rounded-xl p-5 border border-outline-variant/15 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:-translate-y-0.5 transition-transform duration-200 cursor-pointer">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-surface-container-high flex items-center justify-center flex-shrink-0">
                      <span className="material-symbols-outlined text-primary icon-fill">
                        {i === 0 ? 'code' : i === 1 ? 'groups' : 'psychology'}
                      </span>
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-on-surface">
                        {i === 0 ? 'Senior Frontend Engineer' : i === 1 ? 'Product Manager' : 'Software Engineer I'}
                      </h3>
                      <p className="text-sm text-slate-muted mt-0.5">
                        {i === 0 ? 'TechCorp Inc. • Technical Round' : i === 1 ? 'Innovate LLC • Behavioral (Panel)' : 'StartUp Co • System Design'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6 w-full sm:w-auto justify-between sm:justify-end border-t border-outline-variant/10 sm:border-t-0 pt-4 sm:pt-0 mt-2 sm:mt-0">
                    <div className="text-left sm:text-right">
                      <div className="text-sm font-semibold text-on-surface">{i === 0 ? 'Oct 24, 2024' : i === 1 ? 'Oct 18, 2024' : 'Oct 10, 2024'}</div>
                      <div className="text-xs text-slate-muted">{i === 0 ? '45 mins' : i === 1 ? '60 mins' : '30 mins'}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col items-end">
                        <span className={`font-geist font-bold text-2xl leading-none ${i === 0 ? 'text-primary' : i === 1 ? 'text-tertiary-container' : 'text-error'}`}>
                          {i === 0 ? '92' : i === 1 ? '78' : '64'}
                        </span>
                        <span className={`text-xs ${i === 0 ? 'text-emerald-deep' : i === 1 ? 'text-tertiary' : 'text-error'}`}>
                          {i === 0 ? 'Excellent' : i === 1 ? 'Good' : 'Needs Work'}
                        </span>
                      </div>
                      <svg className="w-10 h-10 transform -rotate-90" viewBox="0 0 36 36">
                        <path className="text-surface-container-high" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3"/>
                        <path
                          className={i === 0 ? 'text-primary' : i === 1 ? 'text-tertiary-container' : 'text-error'}
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          fill="none" stroke="currentColor"
                          strokeDasharray={`${i === 0 ? 92 : i === 1 ? 78 : 64}, 100`}
                          strokeLinecap="round" strokeWidth="3"
                        />
                      </svg>
                    </div>
                    <span className="material-symbols-outlined text-slate-muted hidden sm:block">chevron_right</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Weak / Strong areas */}
        {(summary?.weakAreas?.length || summary?.strongAreas?.length) ? (
          <div className="grid sm:grid-cols-2 gap-6">
            {(summary?.weakAreas?.length ?? 0) > 0 && (
              <div className="border border-outline-variant/20 rounded-xl p-6 bg-white shadow-sm">
                <h2 className="font-geist font-semibold text-xl text-on-surface mb-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-tertiary-container">warning</span>
                  Weak Areas
                </h2>
                <div className="flex flex-wrap gap-2">
                  {summary?.weakAreas?.map((a: string) => (
                    <span key={a} className="text-xs bg-error-container/20 text-error px-2.5 py-1 rounded-full border border-error-container">{a}</span>
                  ))}
                </div>
              </div>
            )}
            {(summary?.strongAreas?.length ?? 0) > 0 && (
              <div className="border border-outline-variant/20 rounded-xl p-6 bg-white shadow-sm">
                <h2 className="font-geist font-semibold text-xl text-on-surface mb-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary icon-fill">verified</span>
                  Strong Areas
                </h2>
                <div className="flex flex-wrap gap-2">
                  {summary?.strongAreas?.map((a: string) => (
                    <span key={a} className="text-xs bg-primary-container/10 text-primary px-2.5 py-1 rounded-full border border-primary/20">{a}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}

        <div className="mt-8 flex justify-center">
          <button className="text-sm font-semibold text-primary border border-outline-variant/30 bg-surface px-6 py-2.5 rounded-full hover:bg-surface-variant transition-colors">
            Load More History
          </button>
        </div>
      </main>
    </div>
  )
}
