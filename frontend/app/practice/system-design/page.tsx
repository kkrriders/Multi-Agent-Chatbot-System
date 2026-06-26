'use client'

import { useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { Sidebar } from '@/components/sidebar'
import { useRequireAuth } from '@/hooks/useRequireAuth'

const SystemDesignCanvas = dynamic(() => import('@/components/SystemDesignCanvas'), { ssr: false })

const PROMPTS = [
  {
    id: 'twitter',
    title: 'Design Twitter',
    difficulty: 'Hard',
    description: 'Design a simplified version of Twitter. Users can post tweets, follow other users, and see a home timeline showing tweets from people they follow. Scale to 300M daily active users.',
    requirements: [
      'Post tweets (text, up to 280 chars)',
      'Follow / unfollow users',
      'Home timeline (tweets from followed users)',
      'Search tweets by hashtag',
      'Trending topics',
    ],
    scaleHint: '300M DAU, 500M tweets/day, read-heavy (100:1 read:write)',
  },
  {
    id: 'url-shortener',
    title: 'Design a URL Shortener',
    difficulty: 'Medium',
    description: 'Design a URL shortening service like bit.ly. Given a long URL, generate a short alias. When users visit the short link, redirect them to the original URL.',
    requirements: [
      'Shorten a long URL to a unique short code',
      'Redirect short URL to original',
      'Custom aliases (optional)',
      'URL expiry / TTL',
      'Analytics (click counts per link)',
    ],
    scaleHint: '100M URLs stored, 1B redirects/day, 100:1 read:write ratio',
  },
  {
    id: 'netflix',
    title: 'Design Netflix',
    difficulty: 'Hard',
    description: 'Design a video streaming service like Netflix. Users can browse a catalog of movies/shows, stream content, and receive personalised recommendations.',
    requirements: [
      'Video upload & transcoding pipeline',
      'Adaptive bitrate streaming (ABR)',
      'Content delivery at global scale (CDN)',
      'Recommendation engine',
      'User watch history & resume playback',
    ],
    scaleHint: '200M subscribers, 15% of global internet traffic, 4K streaming',
  },
  {
    id: 'rate-limiter',
    title: 'Design a Rate Limiter',
    difficulty: 'Medium',
    description: 'Design a distributed rate limiting service that can throttle API requests per user, per IP, or globally. Must work across multiple API gateway instances.',
    requirements: [
      'Token bucket / sliding window algorithm',
      'Per-user and per-IP limits',
      'Distributed (works across N gateways)',
      'Low latency (< 1ms overhead)',
      'Admin API to update limits without restart',
    ],
    scaleHint: 'Handle 10M RPS across 100 gateway nodes',
  },
]

const DIFFICULTY_COLOR: Record<string, string> = {
  Easy: 'text-emerald-600 bg-emerald-50 border-emerald-200',
  Medium: 'text-amber-600 bg-amber-50 border-amber-200',
  Hard: 'text-red-600 bg-red-50 border-red-200',
}

export default function SystemDesignPracticePage() {
  const { loading: authLoading } = useRequireAuth()
  const [selectedPrompt, setSelectedPrompt] = useState(PROMPTS[0])
  const [canvasJson, setCanvasJson] = useState<string | null>(null)
  const [canvasKey, setCanvasKey] = useState(0)

  const handleCanvasChange = useCallback((json: string) => {
    setCanvasJson(json)
  }, [])

  const handleExport = () => {
    if (!canvasJson) {
      alert('Add some components to the canvas first.')
      return
    }
    const blob = new Blob([canvasJson], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${selectedPrompt.id}-diagram.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const selectPrompt = (p: typeof PROMPTS[0]) => {
    setSelectedPrompt(p)
    setCanvasJson(null)
    setCanvasKey(k => k + 1)
  }

  if (authLoading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <span className="material-symbols-outlined text-primary text-4xl animate-spin">sync</span>
    </div>
  )

  return (
    <div className="bg-background text-on-background min-h-screen flex font-sans antialiased">
      <Sidebar />

      <main className="flex-1 md:ml-64 pt-20 md:pt-8 px-4 md:px-6 pb-24 md:pb-8 w-full overflow-x-hidden flex flex-col" style={{ height: '100vh' }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-4 shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link href="/dashboard" className="text-slate-muted hover:text-primary text-xs font-medium flex items-center gap-1 transition-colors">
                <span className="material-symbols-outlined text-base">arrow_back</span>
                Dashboard
              </Link>
              <span className="text-slate-muted text-xs">/</span>
              <span className="text-xs text-on-surface font-medium">System Design Practice</span>
            </div>
            <h1 className="font-geist font-bold text-2xl md:text-3xl text-on-background">System Design Practice</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              className="inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-lg border border-outline-variant/30 text-slate-muted hover:text-primary hover:border-primary/40 transition-colors"
            >
              <span className="material-symbols-outlined text-base">download</span>
              <span className="hidden sm:inline">Export Diagram</span>
            </button>
            <Link
              href="/practice/coding"
              className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg border border-outline-variant/30 text-slate-muted hover:text-primary hover:border-primary/40 transition-colors"
            >
              <span className="material-symbols-outlined text-base">code</span>
              <span className="hidden sm:inline">Switch to Coding</span>
              <span className="sm:hidden">Code</span>
            </Link>
          </div>
        </div>

        {/* Two-column layout */}
        <div className="flex flex-col md:flex-row gap-4 flex-1 min-h-0">
          {/* Prompt panel */}
          <div className="md:w-72 shrink-0 flex flex-col gap-3">
            {/* Prompt list */}
            <div className="bg-white rounded-xl border border-outline-variant/15 overflow-hidden shadow-sm">
              <div className="px-4 py-3 border-b border-outline-variant/10 bg-surface-container-lowest/50">
                <p className="text-xs font-bold text-slate-muted uppercase tracking-wider">Prompts</p>
              </div>
              <div className="divide-y divide-outline-variant/10">
                {PROMPTS.map(p => (
                  <button
                    key={p.id}
                    onClick={() => selectPrompt(p)}
                    className={`w-full text-left px-4 py-3 flex items-center justify-between gap-2 transition-colors ${
                      selectedPrompt.id === p.id
                        ? 'bg-primary-container/10 text-primary'
                        : 'hover:bg-surface-container-lowest/50 text-on-surface'
                    }`}
                  >
                    <span className="text-sm font-medium">{p.title}</span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${DIFFICULTY_COLOR[p.difficulty]}`}>
                      {p.difficulty}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Prompt description */}
            <div className="bg-white rounded-xl border border-outline-variant/15 p-4 shadow-sm flex-1 overflow-y-auto">
              <div className="flex items-center gap-2 mb-3">
                <h2 className="font-geist font-semibold text-base text-on-surface">{selectedPrompt.title}</h2>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${DIFFICULTY_COLOR[selectedPrompt.difficulty]}`}>
                  {selectedPrompt.difficulty}
                </span>
              </div>
              <p className="text-sm text-slate-muted leading-relaxed mb-4">{selectedPrompt.description}</p>

              <div className="mb-3">
                <p className="text-xs font-bold text-on-surface uppercase tracking-wider mb-2">Requirements</p>
                <ul className="space-y-1.5">
                  {selectedPrompt.requirements.map((req, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-slate-muted">
                      <span className="material-symbols-outlined text-primary text-sm mt-0.5 shrink-0">check_circle</span>
                      {req}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex items-start gap-2 text-xs text-slate-400 bg-surface-container-lowest rounded-lg px-3 py-2 mt-3">
                <span className="material-symbols-outlined text-sm shrink-0 mt-0.5">bar_chart</span>
                <span>{selectedPrompt.scaleHint}</span>
              </div>
            </div>
          </div>

          {/* Canvas panel */}
          <div className="flex-1 bg-white rounded-xl border border-outline-variant/15 shadow-sm p-4 flex flex-col min-h-0" style={{ minHeight: 500 }}>
            <div className="flex items-center justify-between mb-3 shrink-0">
              <p className="text-xs font-bold text-slate-muted uppercase tracking-wider">Canvas</p>
              <p className="text-xs text-slate-400">Drag components from the palette · Connect nodes by dragging from handles</p>
            </div>
            <div className="flex-1 min-h-0">
              <SystemDesignCanvas
                key={canvasKey}
                onChange={handleCanvasChange}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
