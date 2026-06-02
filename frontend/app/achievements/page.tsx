'use client'

import { useEffect, useState } from 'react'
import { progress as progressApi, type Achievement } from '@/lib/api'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { Sidebar } from '@/components/sidebar'

// ── All badge definitions (mirrors the server model) ────────────────────────

const ALL_BADGES: Record<string, {
  label: string
  description: string
  icon: string
  iconBg: string
  iconColor: string
  hint: string
  tier: 'bronze' | 'silver' | 'gold'
}> = {
  first_interview: {
    label: 'First Interview',
    description: 'Completed your first mock interview.',
    icon: 'flag',
    iconBg: 'bg-primary-container/20',
    iconColor: 'text-primary',
    hint: 'Complete any interview session to unlock.',
    tier: 'bronze',
  },
  score_80_plus: {
    label: 'High Performer',
    description: 'Scored 80 or above in a single session.',
    icon: 'grade',
    iconBg: 'bg-emerald-deep/10',
    iconColor: 'text-emerald-deep',
    hint: 'Score 80+ overall in any interview session.',
    tier: 'silver',
  },
  perfect_score: {
    label: 'Perfect Score',
    description: 'Answered a question with a perfect 100.',
    icon: 'military_tech',
    iconBg: 'bg-amber-light',
    iconColor: 'text-tertiary-container',
    hint: 'Score 100 on any single answer.',
    tier: 'gold',
  },
  streak_3: {
    label: '3-Day Streak',
    description: 'Practiced 3 days in a row.',
    icon: 'local_fire_department',
    iconBg: 'bg-orange-100',
    iconColor: 'text-orange-500',
    hint: 'Practice on 3 consecutive days.',
    tier: 'bronze',
  },
  streak_7: {
    label: 'Week Warrior',
    description: 'Practiced every day for a full week.',
    icon: 'local_fire_department',
    iconBg: 'bg-amber-light',
    iconColor: 'text-tertiary-container',
    hint: 'Practice on 7 consecutive days.',
    tier: 'silver',
  },
  streak_30: {
    label: 'Monthly Champion',
    description: 'Practiced every single day for 30 days.',
    icon: 'local_fire_department',
    iconBg: 'bg-error-container/30',
    iconColor: 'text-error',
    hint: 'Practice on 30 consecutive days.',
    tier: 'gold',
  },
  ten_sessions: {
    label: 'Dedicated Learner',
    description: 'Completed 10 interview sessions.',
    icon: 'school',
    iconBg: 'bg-secondary-container/40',
    iconColor: 'text-secondary',
    hint: 'Complete 10 sessions total to unlock.',
    tier: 'silver',
  },
  full_mock: {
    label: 'Full Mock Complete',
    description: 'Finished a complete end-to-end mock interview.',
    icon: 'cases',
    iconBg: 'bg-surface-container-high',
    iconColor: 'text-on-surface',
    hint: 'Start and complete a Full Mock session.',
    tier: 'silver',
  },
  speech_master: {
    label: 'Speech Master',
    description: 'Gave a full voice answer with zero filler words.',
    icon: 'campaign',
    iconBg: 'bg-primary-container/15',
    iconColor: 'text-primary',
    hint: 'Complete a voice answer (20+ words) with no "um", "uh", or "like".',
    tier: 'gold',
  },
  improvement_10: {
    label: 'On The Rise',
    description: 'Improved your overall score by 10+ points across sessions.',
    icon: 'trending_up',
    iconBg: 'bg-primary-container/20',
    iconColor: 'text-emerald-deep',
    hint: 'Improve your score by 10 points from your first to latest session.',
    tier: 'silver',
  },
}

const TIER_CONFIG = {
  bronze: { label: 'Bronze', color: 'text-amber-600',  ring: 'ring-amber-300/60',  glow: 'shadow-amber-100' },
  silver: { label: 'Silver', color: 'text-slate-muted', ring: 'ring-slate-300/60',  glow: 'shadow-slate-100' },
  gold:   { label: 'Gold',   color: 'text-yellow-600',  ring: 'ring-yellow-300/60', glow: 'shadow-yellow-100' },
}

function metaSummary(type: string, meta?: Record<string, unknown>): string | null {
  if (!meta) return null
  if (type === 'score_80_plus' && meta.score) return `Session score: ${meta.score}`
  if (type === 'streak_3' || type === 'streak_7' || type === 'streak_30') {
    if (meta.streak) return `${meta.streak}-day streak`
  }
  if (type === 'ten_sessions' && meta.count) return `After ${meta.count} sessions`
  if (type === 'improvement_10' && meta.from != null && meta.to != null) {
    return `Score went from ${meta.from} → ${meta.to}`
  }
  return null
}

export default function AchievementsPage() {
  useRequireAuth()
  const [earned, setEarned] = useState<Achievement[]>([])
  const [streak, setStreak] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      progressApi.achievements().then(d => setEarned(d.achievements || [])),
      progressApi.streak().then(d => setStreak(d.streak || 0)),
    ]).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const earnedMap = new Map(earned.map(a => [a.type, a]))
  const earnedCount = earnedMap.size
  const totalCount  = Object.keys(ALL_BADGES).length

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <span className="material-symbols-outlined text-primary text-4xl animate-spin">sync</span>
    </div>
  )

  return (
    <div className="bg-background text-on-background min-h-screen flex antialiased">
      <Sidebar />

      <main className="flex-1 md:ml-64 p-4 md:p-12 max-w-[1280px] mx-auto w-full pb-24 md:pb-12 pt-20 md:pt-12">

        {/* Header */}
        <div className="mb-10">
          <h1 className="font-geist font-bold text-4xl md:text-5xl text-on-background mb-2">Achievements</h1>
          <p className="text-lg text-slate-muted">Badges earned through consistent practice and strong performance.</p>
        </div>

        {/* Summary strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
          <div className="bg-white rounded-xl p-5 border border-outline-variant/15 shadow-sm text-center">
            <div className="font-geist font-bold text-4xl text-emerald-deep mb-1">{earnedCount}</div>
            <div className="text-xs text-slate-muted font-medium uppercase tracking-wider">Earned</div>
          </div>
          <div className="bg-white rounded-xl p-5 border border-outline-variant/15 shadow-sm text-center">
            <div className="font-geist font-bold text-4xl text-on-surface mb-1">{totalCount - earnedCount}</div>
            <div className="text-xs text-slate-muted font-medium uppercase tracking-wider">Locked</div>
          </div>
          <div className="bg-white rounded-xl p-5 border border-outline-variant/15 shadow-sm text-center">
            <div className="font-geist font-bold text-4xl text-tertiary-container mb-1">{streak}</div>
            <div className="text-xs text-slate-muted font-medium uppercase tracking-wider">Day Streak</div>
          </div>
          <div className="bg-white rounded-xl p-5 border border-outline-variant/15 shadow-sm text-center">
            <div className="font-geist font-bold text-4xl text-primary mb-1">
              {earnedCount > 0 ? Math.round((earnedCount / totalCount) * 100) : 0}%
            </div>
            <div className="text-xs text-slate-muted font-medium uppercase tracking-wider">Complete</div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mb-10 bg-white rounded-xl p-6 border border-outline-variant/15 shadow-sm">
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm font-semibold text-on-surface">Collection Progress</span>
            <span className="text-sm text-slate-muted">{earnedCount} / {totalCount}</span>
          </div>
          <div className="h-3 bg-surface-container rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-emerald-deep rounded-full transition-all duration-700"
              style={{ width: `${(earnedCount / totalCount) * 100}%` }}
            />
          </div>
          {earnedCount === totalCount && (
            <p className="text-sm text-primary font-semibold mt-3 flex items-center gap-2">
              <span className="material-symbols-outlined text-base icon-fill">celebration</span>
              You&apos;ve unlocked all badges — you&apos;re a MockPrep champion!
            </p>
          )}
        </div>

        {/* Earned section */}
        {earnedCount > 0 && (
          <div className="mb-10">
            <h2 className="font-geist font-semibold text-2xl text-on-surface mb-5 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary icon-fill">workspace_premium</span>
              Earned ({earnedCount})
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {Object.entries(ALL_BADGES)
                .filter(([type]) => earnedMap.has(type))
                .map(([type, def]) => {
                  const ach  = earnedMap.get(type)!
                  const tier = TIER_CONFIG[def.tier]
                  const meta = metaSummary(type, ach.metadata as Record<string, unknown>)
                  return (
                    <div
                      key={type}
                      className={`bg-white rounded-xl border border-outline-variant/15 p-6 flex flex-col items-center text-center shadow-sm ring-2 ${tier.ring} hover:shadow-md transition-all duration-200 hover:-translate-y-0.5`}
                    >
                      {/* Tier label */}
                      <span className={`text-[10px] font-bold uppercase tracking-widest mb-3 ${tier.color}`}>
                        {tier.label}
                      </span>

                      {/* Icon */}
                      <div className={`w-16 h-16 rounded-full ${def.iconBg} flex items-center justify-center mb-4 shadow-sm`}>
                        <span className={`material-symbols-outlined text-3xl icon-fill ${def.iconColor}`}>{def.icon}</span>
                      </div>

                      <h3 className="font-geist font-bold text-base text-on-surface mb-1">{def.label}</h3>
                      <p className="text-xs text-slate-muted leading-relaxed mb-3">{def.description}</p>

                      {meta && (
                        <span className="text-xs font-semibold text-primary bg-primary-container/10 px-2.5 py-1 rounded-full border border-primary/15 mb-3">
                          {meta}
                        </span>
                      )}

                      <div className="mt-auto pt-2 border-t border-outline-variant/10 w-full">
                        <p className="text-[10px] text-slate-muted">
                          Earned {new Date(ach.awardedAt).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                    </div>
                  )
                })}
            </div>
          </div>
        )}

        {/* Locked section */}
        {earnedCount < totalCount && (
          <div>
            <h2 className="font-geist font-semibold text-2xl text-on-surface mb-5 flex items-center gap-2">
              <span className="material-symbols-outlined text-slate-muted">lock</span>
              Locked ({totalCount - earnedCount})
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {Object.entries(ALL_BADGES)
                .filter(([type]) => !earnedMap.has(type))
                .map(([type, def]) => (
                  <div
                    key={type}
                    className="bg-surface-container-low rounded-xl border border-outline-variant/10 p-6 flex flex-col items-center text-center opacity-70 hover:opacity-90 transition-opacity"
                  >
                    {/* Tier label */}
                    <span className="text-[10px] font-bold uppercase tracking-widest mb-3 text-surface-dim">
                      {TIER_CONFIG[def.tier].label}
                    </span>

                    {/* Locked icon */}
                    <div className="w-16 h-16 rounded-full bg-surface-container-high flex items-center justify-center mb-4 relative">
                      <span className="material-symbols-outlined text-3xl text-surface-dim">{def.icon}</span>
                      <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-surface-container-highest border-2 border-surface-container-low flex items-center justify-center">
                        <span className="material-symbols-outlined text-[14px] text-slate-muted icon-fill">lock</span>
                      </div>
                    </div>

                    <h3 className="font-geist font-bold text-base text-on-surface-variant mb-1">{def.label}</h3>
                    <p className="text-xs text-slate-muted leading-relaxed mb-3">{def.description}</p>

                    <div className="mt-auto pt-2 border-t border-outline-variant/10 w-full">
                      <p className="text-[10px] text-slate-muted italic">{def.hint}</p>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {earnedCount === 0 && (
          <div className="text-center py-16 border border-dashed border-outline-variant/30 rounded-xl mt-8">
            <span className="material-symbols-outlined text-slate-muted text-6xl block mb-4">emoji_events</span>
            <h3 className="font-geist font-semibold text-xl text-on-surface mb-2">No badges yet</h3>
            <p className="text-slate-muted mb-6 max-w-sm mx-auto">
              Complete your first interview to start earning badges. Every session brings you closer to mastery.
            </p>
            <a
              href="/interview"
              className="inline-flex items-center gap-2 bg-primary text-white text-sm font-semibold px-6 py-3 rounded-lg hover:bg-emerald-deep transition-colors shadow-sm"
            >
              <span className="material-symbols-outlined text-base">play_arrow</span>
              Start an Interview
            </a>
          </div>
        )}
      </main>
    </div>
  )
}
