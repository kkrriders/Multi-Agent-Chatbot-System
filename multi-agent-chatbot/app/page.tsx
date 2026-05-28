import Link from 'next/link'
import { BrainCircuit, Mic, BarChart2, Trophy, CheckCircle, ArrowRight } from 'lucide-react'

const FEATURES = [
  { icon: BrainCircuit, title: 'AI Question Generation', desc: 'Questions tailored to your CV and target role' },
  { icon: CheckCircle,  title: 'Real-time Scoring',       desc: 'Relevance, depth, and clarity scored live (0–100)' },
  { icon: Mic,          title: 'Speech Analysis',          desc: 'Filler word detection, pace, and pronunciation score' },
  { icon: BarChart2,    title: 'Progress Tracking',        desc: 'Session-over-session improvement across all topics' },
  { icon: Trophy,       title: 'Gamification',             desc: 'Streaks, badges, and personal leaderboard' },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 pt-24 pb-16 text-center">
        <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-medium mb-6">
          <BrainCircuit className="w-4 h-4" />
          AI-Powered Mock Interviews
        </div>
        <h1 className="text-5xl font-bold tracking-tight mb-4">
          Ace your next interview<br />with AI feedback
        </h1>
        <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
          Upload your CV, pick a role, and get scored on every answer — live.
          Practice mode, timed mode, or a full end-to-end mock.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link
            href="/signup"
            className="bg-primary text-primary-foreground px-6 py-3 rounded-lg font-semibold flex items-center gap-2 hover:bg-primary/90 transition-colors"
          >
            Start for free <ArrowRight className="w-4 h-4" />
          </Link>
          <Link href="/login" className="border border-border px-6 py-3 rounded-lg font-semibold hover:bg-accent transition-colors">
            Sign in
          </Link>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 pb-24">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="border border-border rounded-xl p-5">
              <Icon className="w-8 h-8 text-primary mb-3" />
              <h3 className="font-semibold mb-1">{title}</h3>
              <p className="text-sm text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
