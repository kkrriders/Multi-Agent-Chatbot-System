'use client'

import { useEffect, useState } from 'react'
import { progress as progressApi, type Achievement } from '@/lib/api'
import { Nav } from '@/components/nav'
import { Trophy, Medal, Award, Flame } from 'lucide-react'

const BADGE_ICON: Record<string, React.ReactNode> = {
  first_interview: <Award className="w-6 h-6 text-blue-400" />,
  score_80_plus:   <Trophy className="w-6 h-6 text-yellow-400" />,
  perfect_score:   <Trophy className="w-6 h-6 text-amber-400" />,
  streak_3:        <Flame className="w-6 h-6 text-orange-400" />,
  streak_7:        <Flame className="w-6 h-6 text-orange-500" />,
  streak_30:       <Flame className="w-6 h-6 text-red-500" />,
  ten_sessions:    <Medal className="w-6 h-6 text-purple-400" />,
  full_mock:       <Medal className="w-6 h-6 text-green-400" />,
  speech_master:   <Award className="w-6 h-6 text-cyan-400" />,
  improvement_10:  <TrendingUp className="w-6 h-6 text-emerald-400" />,
}

function TrendingUp({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m22 7-8.5 8.5-5-5L2 17" /><path d="M16 7h6v6" /></svg>
}

export default function LeaderboardPage() {
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [leaderboard, setLeaderboard] = useState<any[]>([])
  const [streak, setStreak] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      progressApi.achievements().then(d => setAchievements(d.achievements)),
      progressApi.leaderboard().then(d => setLeaderboard(d.leaderboard)),
      progressApi.streak().then(d => setStreak(d.streak)),
    ]).finally(() => setLoading(false))
  }, [])

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
          <h1 className="text-2xl font-bold mb-6">Rankings & Badges</h1>

          {/* Streak banner */}
          {streak > 0 && (
            <div className="flex items-center gap-3 border border-orange-500/30 bg-orange-500/5 rounded-xl px-4 py-3 mb-6">
              <Flame className="w-6 h-6 text-orange-400 flex-shrink-0" />
              <div>
                <p className="font-semibold">{streak}-day streak 🔥</p>
                <p className="text-xs text-muted-foreground">Keep practicing daily to maintain it</p>
              </div>
            </div>
          )}

          {/* Badges */}
          <div className="mb-8">
            <h2 className="font-semibold mb-4">Achievements ({achievements.length})</h2>
            {achievements.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {achievements.map(a => (
                  <div key={a._id} className="border border-border rounded-xl p-4 flex items-start gap-3">
                    <div className="flex-shrink-0 w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                      {BADGE_ICON[a.type] || <Award className="w-5 h-5 text-primary" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{a.badge.label}</p>
                      <p className="text-xs text-muted-foreground">{a.badge.description}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{new Date(a.awardedAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 border border-dashed border-border rounded-xl">
                <Award className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground text-sm">Complete your first interview to earn badges</p>
              </div>
            )}
          </div>

          {/* Personal leaderboard */}
          <div>
            <h2 className="font-semibold mb-4">Your Best Sessions</h2>
            {leaderboard.length > 0 ? (
              <div className="space-y-2">
                {leaderboard.map((s, i) => (
                  <div key={s._id} className="flex items-center gap-4 border border-border rounded-xl px-4 py-3">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                      i === 0 ? 'bg-yellow-500/20 text-yellow-400' :
                      i === 1 ? 'bg-gray-400/20 text-gray-400' :
                      i === 2 ? 'bg-amber-600/20 text-amber-600' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{s.targetRole || 'Interview'}</p>
                      <p className="text-xs text-muted-foreground capitalize">{s.mode} · {new Date(s.completedAt).toLocaleDateString()}</p>
                    </div>
                    <div className={`text-lg font-bold ${
                      s.overallScore >= 80 ? 'text-green-500' :
                      s.overallScore >= 60 ? 'text-yellow-500' : 'text-red-500'
                    }`}>
                      {s.overallScore}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 border border-dashed border-border rounded-xl">
                <Trophy className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground text-sm">No completed sessions yet</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
