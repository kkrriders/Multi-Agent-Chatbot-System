'use client'

import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { Sidebar } from '@/components/sidebar'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { questions as questionsApi, type Question } from '@/lib/api'

const SystemDesignCanvas = dynamic(() => import('@/components/SystemDesignCanvas'), { ssr: false })

const DIFFICULTY_COLOR: Record<string, string> = {
  easy:   'text-emerald-600 bg-emerald-50 border-emerald-200',
  medium: 'text-amber-600 bg-amber-50 border-amber-200',
  hard:   'text-red-600 bg-red-50 border-red-200',
}

function extractTitle(text: string): string {
  // "Design WhatsApp — a real-time..." → "Design WhatsApp"
  const dashIdx = text.indexOf(' — ')
  if (dashIdx !== -1) return text.slice(0, dashIdx).trim()
  // Fallback: first sentence
  const dotIdx = text.indexOf('.')
  if (dotIdx !== -1 && dotIdx < 80) return text.slice(0, dotIdx).trim()
  return text.length > 60 ? text.slice(0, 60).trim() + '…' : text.trim()
}

export default function SystemDesignPracticePage() {
  const { loading: authLoading } = useRequireAuth()
  const [prompts, setPrompts]         = useState<Question[]>([])
  const [loading, setLoading]         = useState(true)
  const [selected, setSelected]       = useState<Question | null>(null)
  const [canvasJson, setCanvasJson]   = useState<string | null>(null)
  const [canvasKey, setCanvasKey]     = useState(0)
  const [filterDiff, setFilterDiff]   = useState('')

  useEffect(() => {
    questionsApi.list({ category: 'system_design', limit: 100 })
      .then(data => {
        setPrompts(data.questions)
        if (data.questions.length > 0) setSelected(data.questions[0])
      })
      .finally(() => setLoading(false))
  }, [])

  const handleCanvasChange = useCallback((json: string) => setCanvasJson(json), [])

  const handleExport = () => {
    if (!canvasJson || !selected) { alert('Add some components to the canvas first.'); return }
    const blob = new Blob([canvasJson], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${selected.id}-diagram.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const selectPrompt = (q: Question) => {
    setSelected(q)
    setCanvasJson(null)
    setCanvasKey(k => k + 1)
  }

  const visible = filterDiff ? prompts.filter(p => p.difficulty === filterDiff) : prompts

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
            {/* Difficulty filter */}
            <div className="flex gap-2">
              {['', 'easy', 'medium', 'hard'].map(d => (
                <button
                  key={d}
                  onClick={() => setFilterDiff(d)}
                  className={`text-xs px-3 py-1 rounded-full border font-semibold transition-all ${
                    filterDiff === d
                      ? 'bg-primary text-white border-primary'
                      : 'bg-white text-slate-muted border-outline-variant/30 hover:border-primary/50'
                  }`}
                >
                  {d === '' ? 'All' : d.charAt(0).toUpperCase() + d.slice(1)}
                </button>
              ))}
            </div>

            {/* Prompt list */}
            <div className="bg-white rounded-xl border border-outline-variant/15 overflow-hidden shadow-sm flex-1 flex flex-col min-h-0">
              <div className="px-4 py-3 border-b border-outline-variant/10 bg-surface-container-lowest/50 shrink-0 flex items-center justify-between">
                <p className="text-xs font-bold text-slate-muted uppercase tracking-wider">Prompts</p>
                <span className="text-xs text-slate-400">{visible.length}</span>
              </div>
              <div className="overflow-y-auto flex-1 divide-y divide-outline-variant/10">
                {loading ? (
                  <div className="flex items-center justify-center py-10">
                    <span className="material-symbols-outlined text-primary animate-spin">sync</span>
                  </div>
                ) : visible.length === 0 ? (
                  <p className="text-xs text-slate-muted text-center py-8">No prompts found</p>
                ) : visible.map(p => (
                  <button
                    key={p.id}
                    onClick={() => selectPrompt(p)}
                    className={`w-full text-left px-4 py-3 flex items-center justify-between gap-2 transition-colors ${
                      selected?.id === p.id
                        ? 'bg-primary-container/10 text-primary'
                        : 'hover:bg-surface-container-lowest/50 text-on-surface'
                    }`}
                  >
                    <span className="text-sm font-medium truncate">{extractTitle(p.text)}</span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${DIFFICULTY_COLOR[p.difficulty] ?? ''}`}>
                      {p.difficulty.charAt(0).toUpperCase() + p.difficulty.slice(1)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Canvas + description */}
          {selected ? (
            <div className="flex-1 flex flex-col gap-3 min-h-0">
              {/* Description */}
              <div className="bg-white rounded-xl border border-outline-variant/15 p-4 shadow-sm shrink-0">
                <div className="flex items-center gap-2 mb-2">
                  <h2 className="font-geist font-semibold text-base text-on-surface">{extractTitle(selected.text)}</h2>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${DIFFICULTY_COLOR[selected.difficulty] ?? ''}`}>
                    {selected.difficulty.charAt(0).toUpperCase() + selected.difficulty.slice(1)}
                  </span>
                </div>
                <p className="text-sm text-slate-muted leading-relaxed mb-3">{selected.text}</p>

                {selected.evaluationRubric && selected.evaluationRubric.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-on-surface uppercase tracking-wider mb-2">What to cover</p>
                    <ul className="space-y-1">
                      {selected.evaluationRubric.map((r, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-slate-muted">
                          <span className="material-symbols-outlined text-primary text-sm mt-0.5 shrink-0">check_circle</span>
                          {r}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Canvas */}
              <div className="flex-1 bg-white rounded-xl border border-outline-variant/15 shadow-sm p-4 flex flex-col min-h-0" style={{ minHeight: 400 }}>
                <div className="flex items-center justify-between mb-3 shrink-0">
                  <p className="text-xs font-bold text-slate-muted uppercase tracking-wider">Canvas</p>
                  <p className="text-xs text-slate-400 hidden sm:block">Drag components · Connect by pulling handles</p>
                </div>
                <div className="flex-1 min-h-0">
                  <SystemDesignCanvas
                    key={canvasKey}
                    initialDiagram={selected.templateDiagram ?? undefined}
                    onChange={handleCanvasChange}
                  />
                </div>
              </div>
            </div>
          ) : !loading && (
            <div className="flex-1 flex items-center justify-center text-slate-muted text-sm">
              Select a prompt to start
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
