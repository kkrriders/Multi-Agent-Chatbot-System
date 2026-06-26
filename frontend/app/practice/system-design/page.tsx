'use client'

import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { Sidebar } from '@/components/sidebar'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { questions as questionsApi, practice as practiceApi, type SystemDesignEvalResult } from '@/lib/api'

const SystemDesignCanvas = dynamic(() => import('@/components/SystemDesignCanvas'), { ssr: false })

interface Prompt {
  id: string
  title: string
  difficulty: 'Easy' | 'Medium' | 'Hard'
  description: string
  requirements: string[]
  templateDiagram: string | null
}

const DIFFICULTY_COLOR: Record<string, string> = {
  Easy: 'text-emerald-600 bg-emerald-50 border-emerald-200',
  Medium: 'text-amber-600 bg-amber-50 border-amber-200',
  Hard: 'text-red-600 bg-red-50 border-red-200',
}

function extractTitle(text: string): string {
  return text.split(' — ')[0].split('\n')[0].trim()
}

function extractDescription(text: string): string {
  const parts = text.split(' — ')
  return parts.length > 1 ? parts.slice(1).join(' — ').trim() : text
}

export default function SystemDesignPracticePage() {
  const { loading: authLoading } = useRequireAuth()
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [fetching, setFetching] = useState(true)
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null)
  const [canvasJson, setCanvasJson] = useState<string | null>(null)
  const [canvasKey, setCanvasKey] = useState(0)
  const [difficultyFilter, setDifficultyFilter] = useState('All')
  const [evalResult, setEvalResult] = useState<SystemDesignEvalResult | null>(null)
  const [evaluating, setEvaluating] = useState(false)
  const [evalError, setEvalError] = useState<string | null>(null)

  useEffect(() => {
    questionsApi.list({ category: 'system_design', limit: 100 })
      .then(({ questions }) => {
        const mapped: Prompt[] = questions.map(q => ({
          id: q.id,
          title: extractTitle(q.text),
          difficulty: (q.difficulty.charAt(0).toUpperCase() + q.difficulty.slice(1)) as 'Easy' | 'Medium' | 'Hard',
          description: extractDescription(q.text),
          requirements: q.evaluationRubric || [],
          templateDiagram: q.templateDiagram || null,
        }))
        setPrompts(mapped)
        if (mapped.length > 0) setSelectedPrompt(mapped[0])
      })
      .catch(() => {})
      .finally(() => setFetching(false))
  }, [])

  const filtered = difficultyFilter === 'All'
    ? prompts
    : prompts.filter(p => p.difficulty === difficultyFilter)

  const handleCanvasChange = useCallback((json: string) => {
    setCanvasJson(json)
  }, [])

  const handleExport = () => {
    if (!canvasJson || !selectedPrompt) {
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

  const selectPrompt = (p: Prompt) => {
    setSelectedPrompt(p)
    setCanvasJson(null)
    setCanvasKey(k => k + 1)
    setEvalResult(null)
    setEvalError(null)
  }

  const handleCheckDesign = async () => {
    if (!selectedPrompt || !canvasJson) {
      setEvalError('Add some components to the canvas first.')
      return
    }
    let parsed: { nodes?: unknown[]; edges?: unknown[] }
    try {
      parsed = JSON.parse(canvasJson)
    } catch {
      setEvalError('Canvas data is invalid.')
      return
    }
    const nodes = parsed.nodes || []
    if (nodes.length === 0) {
      setEvalError('Add some components to the canvas first.')
      return
    }
    setEvaluating(true)
    setEvalResult(null)
    setEvalError(null)
    try {
      const result = await practiceApi.evaluateSystemDesign(selectedPrompt.id, nodes, parsed.edges || [])
      setEvalResult(result)
    } catch (err: unknown) {
      setEvalError(err instanceof Error ? err.message : 'Evaluation failed. Try again.')
    } finally {
      setEvaluating(false)
    }
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
              onClick={handleCheckDesign}
              disabled={evaluating}
              className="inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-lg bg-primary text-white hover:bg-emerald-deep transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {evaluating ? (
                <span className="material-symbols-outlined text-base animate-spin">sync</span>
              ) : (
                <span className="material-symbols-outlined text-base">smart_toy</span>
              )}
              <span className="hidden sm:inline">{evaluating ? 'Evaluating…' : 'Check Design'}</span>
            </button>
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
            <div className="flex gap-1.5 flex-wrap shrink-0">
              {['All', 'Easy', 'Medium', 'Hard'].map(d => (
                <button
                  key={d}
                  onClick={() => setDifficultyFilter(d)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
                    difficultyFilter === d
                      ? 'bg-primary text-white border-primary'
                      : 'border-outline-variant/30 text-slate-muted hover:border-primary/40 hover:text-primary'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>

            {/* Prompt list */}
            <div className="bg-white rounded-xl border border-outline-variant/15 overflow-hidden shadow-sm flex flex-col min-h-0 flex-1">
              <div className="px-4 py-3 border-b border-outline-variant/10 bg-surface-container-lowest/50 shrink-0">
                <p className="text-xs font-bold text-slate-muted uppercase tracking-wider">
                  {fetching ? 'Loading…' : `${filtered.length} Prompt${filtered.length !== 1 ? 's' : ''}`}
                </p>
              </div>
              <div className="overflow-y-auto divide-y divide-outline-variant/10 flex-1">
                {fetching ? (
                  <div className="flex items-center justify-center py-10">
                    <span className="material-symbols-outlined text-primary text-3xl animate-spin">sync</span>
                  </div>
                ) : filtered.map(p => (
                  <button
                    key={p.id}
                    onClick={() => selectPrompt(p)}
                    className={`w-full text-left px-4 py-3 flex items-center justify-between gap-2 transition-colors ${
                      selectedPrompt?.id === p.id
                        ? 'bg-primary-container/10 text-primary'
                        : 'hover:bg-surface-container-lowest/50 text-on-surface'
                    }`}
                  >
                    <span className="text-sm font-medium truncate">{p.title}</span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${DIFFICULTY_COLOR[p.difficulty]}`}>
                      {p.difficulty}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Prompt description */}
            {selectedPrompt && (
              <div className="bg-white rounded-xl border border-outline-variant/15 p-4 shadow-sm shrink-0">
                <div className="flex items-center gap-2 mb-3">
                  <h2 className="font-geist font-semibold text-base text-on-surface">{selectedPrompt.title}</h2>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${DIFFICULTY_COLOR[selectedPrompt.difficulty]}`}>
                    {selectedPrompt.difficulty}
                  </span>
                </div>
                <p className="text-sm text-slate-muted leading-relaxed mb-4">{selectedPrompt.description}</p>

                {selectedPrompt.requirements.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-on-surface uppercase tracking-wider mb-2">What to cover</p>
                    <ul className="space-y-1.5">
                      {selectedPrompt.requirements.map((req, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-slate-muted">
                          <span className="material-symbols-outlined text-primary text-sm mt-0.5 shrink-0">check_circle</span>
                          {req}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Canvas + feedback column */}
          <div className="flex-1 flex flex-col gap-3 min-h-0">
            <div className="bg-white rounded-xl border border-outline-variant/15 shadow-sm p-4 flex flex-col" style={{ minHeight: 500 }}>
              <div className="flex items-center justify-between mb-3 shrink-0">
                <p className="text-xs font-bold text-slate-muted uppercase tracking-wider">Canvas</p>
                <p className="text-xs text-slate-400">Drag components from the palette · Connect nodes by dragging from handles</p>
              </div>
              <div className="flex-1 min-h-0">
                <SystemDesignCanvas
                  key={canvasKey}
                  onChange={handleCanvasChange}
                  {...(selectedPrompt?.templateDiagram ? { initialJson: selectedPrompt.templateDiagram } : {})}
                />
              </div>
            </div>

            {evalError && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 shrink-0 flex items-center gap-2">
                <span className="material-symbols-outlined text-red-500 text-sm">error</span>
                <p className="text-xs text-red-600">{evalError}</p>
                <button onClick={() => setEvalError(null)} className="ml-auto text-red-400 hover:text-red-600">
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              </div>
            )}

            {evalResult && (
              <div className="bg-white rounded-xl border border-outline-variant/15 shadow-sm shrink-0 overflow-hidden">
                {/* Score header */}
                <div className="px-4 py-3 border-b border-outline-variant/10 flex items-center gap-3">
                  <div className="flex-1">
                    <p className="text-sm font-bold text-on-surface">AI Feedback</p>
                    <p className="text-xs text-slate-muted leading-relaxed mt-0.5">{evalResult.feedback}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-3xl font-bold ${evalResult.score >= 70 ? 'text-emerald-600' : evalResult.score >= 40 ? 'text-amber-600' : 'text-red-500'}`}>
                      {evalResult.score}
                    </p>
                    <p className="text-[10px] text-slate-muted uppercase tracking-wider">/ 100</p>
                  </div>
                  <button onClick={() => setEvalResult(null)} className="text-slate-400 hover:text-slate-600 ml-1">
                    <span className="material-symbols-outlined text-sm">close</span>
                  </button>
                </div>

                {/* Rubric results */}
                <div className="px-4 py-3">
                  <p className="text-[10px] font-bold text-slate-muted uppercase tracking-wider mb-2">Rubric Checklist</p>
                  <ul className="space-y-2">
                    {evalResult.rubricResults.map((r, i) => (
                      <li key={i} className="flex items-start gap-2.5">
                        <span className={`material-symbols-outlined text-sm mt-0.5 shrink-0 ${
                          r.status === 'covered' ? 'text-emerald-500' :
                          r.status === 'partial' ? 'text-amber-500' : 'text-red-400'
                        }`}>
                          {r.status === 'covered' ? 'check_circle' : r.status === 'partial' ? 'pending' : 'cancel'}
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs text-on-surface">{r.item}</p>
                          {r.note && <p className="text-[11px] text-slate-muted mt-0.5">{r.note}</p>}
                        </div>
                      </li>
                    ))}
                  </ul>

                  {evalResult.topMissing.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-outline-variant/10">
                      <p className="text-[10px] font-bold text-red-600 uppercase tracking-wider mb-1.5">Key gaps to address</p>
                      <ul className="space-y-1">
                        {evalResult.topMissing.map((m, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs text-slate-muted">
                            <span className="material-symbols-outlined text-amber-500 text-sm mt-0.5 shrink-0">arrow_right</span>
                            {m}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
