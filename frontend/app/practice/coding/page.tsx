'use client'

import { useState, useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { Sidebar } from '@/components/sidebar'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { questions as questionsApi, practice as practiceApi, type CodingEvalResult } from '@/lib/api'

const CodeEditor = dynamic(() => import('@/components/CodeEditor'), { ssr: false })

type Language = 'javascript' | 'python' | 'java' | 'cpp' | 'typescript' | 'go'

interface Problem {
  id: string
  title: string
  difficulty: 'Easy' | 'Medium' | 'Hard'
  description: string
  constraints: string
  starterCode: Record<Language, string>
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

function buildStarterCode(jsStarter: string | null | undefined, title: string): Record<Language, string> {
  const fn = title.toLowerCase().replace(/[^a-z0-9]+(.)/g, (_, c) => c.toUpperCase())
  return {
    javascript: jsStarter || `function ${fn}() {\n  // Your solution here\n}`,
    typescript: jsStarter
      ? jsStarter.replace(/^function (\w+)\(([^)]*)\)/, `function $1($2): unknown`)
      : `function ${fn}(): unknown {\n  // Your solution here\n}`,
    python: `def ${fn.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '')}():\n    # Your solution here\n    pass`,
    java: `class Solution {\n    public Object ${fn}() {\n        // Your solution here\n    }\n}`,
    cpp: `class Solution {\npublic:\n    auto ${fn}() {\n        // Your solution here\n    }\n};`,
    go: `func ${fn}() interface{} {\n    // Your solution here\n}`,
  }
}

export default function CodingPracticePage() {
  const { loading: authLoading } = useRequireAuth()
  const [problems, setProblems] = useState<Problem[]>([])
  const [fetching, setFetching] = useState(true)
  const [selectedProblem, setSelectedProblem] = useState<Problem | null>(null)
  const [language, setLanguage] = useState<Language>('javascript')
  const [editorKey, setEditorKey] = useState(0)
  const [difficultyFilter, setDifficultyFilter] = useState('All')
  const [evalResult, setEvalResult] = useState<CodingEvalResult | null>(null)
  const [evaluating, setEvaluating] = useState(false)
  const [evalError, setEvalError] = useState<string | null>(null)
  const codeRef = useRef<string>('')

  useEffect(() => {
    questionsApi.list({ category: 'coding', limit: 100 })
      .then(({ questions }) => {
        const mapped: Problem[] = questions.map(q => ({
          id: q.id,
          title: extractTitle(q.text),
          difficulty: (q.difficulty.charAt(0).toUpperCase() + q.difficulty.slice(1)) as 'Easy' | 'Medium' | 'Hard',
          description: extractDescription(q.text),
          constraints: q.constraints || '',
          starterCode: buildStarterCode(q.starterCode, extractTitle(q.text)),
        }))
        setProblems(mapped)
        if (mapped.length > 0) setSelectedProblem(mapped[0])
      })
      .catch(() => {})
      .finally(() => setFetching(false))
  }, [])

  const filtered = difficultyFilter === 'All'
    ? problems
    : problems.filter(p => p.difficulty === difficultyFilter)

  const selectProblem = (p: Problem) => {
    setSelectedProblem(p)
    setEvalResult(null)
    setEvalError(null)
    setEditorKey(k => k + 1)
    codeRef.current = p.starterCode[language] || p.starterCode.javascript
  }

  const handleGetFeedback = async () => {
    if (!selectedProblem) return
    const code = codeRef.current
    if (!code || code.trim().length < 5) {
      setEvalError('Write some code before requesting feedback.')
      return
    }
    setEvaluating(true)
    setEvalResult(null)
    setEvalError(null)
    try {
      const result = await practiceApi.evaluateCoding(selectedProblem.id, code, language)
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
              <span className="text-xs text-on-surface font-medium">Code Practice</span>
            </div>
            <h1 className="font-geist font-bold text-2xl md:text-3xl text-on-background">Code Practice</h1>
          </div>
          <Link
            href="/practice/system-design"
            className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg border border-outline-variant/30 text-slate-muted hover:text-primary hover:border-primary/40 transition-colors"
          >
            <span className="material-symbols-outlined text-base">schema</span>
            <span className="hidden sm:inline">Switch to System Design</span>
            <span className="sm:hidden">Design</span>
          </Link>
        </div>

        {/* Two-column layout */}
        <div className="flex flex-col md:flex-row gap-4 flex-1 min-h-0">
          {/* Problem panel */}
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

            {/* Problem list */}
            <div className="bg-white rounded-xl border border-outline-variant/15 overflow-hidden shadow-sm flex flex-col min-h-0 flex-1">
              <div className="px-4 py-3 border-b border-outline-variant/10 bg-surface-container-lowest/50 shrink-0">
                <p className="text-xs font-bold text-slate-muted uppercase tracking-wider">
                  {fetching ? 'Loading…' : `${filtered.length} Problem${filtered.length !== 1 ? 's' : ''}`}
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
                    onClick={() => selectProblem(p)}
                    className={`w-full text-left px-4 py-3 flex items-center justify-between gap-2 transition-colors ${
                      selectedProblem?.id === p.id
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

            {/* Problem description */}
            {selectedProblem && (
              <div className="bg-white rounded-xl border border-outline-variant/15 p-4 shadow-sm shrink-0">
                <div className="flex items-center gap-2 mb-3">
                  <h2 className="font-geist font-semibold text-base text-on-surface">{selectedProblem.title}</h2>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${DIFFICULTY_COLOR[selectedProblem.difficulty]}`}>
                    {selectedProblem.difficulty}
                  </span>
                </div>
                <p className="text-sm text-slate-muted leading-relaxed mb-3">{selectedProblem.description}</p>
                {selectedProblem.constraints && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-surface-container-lowest rounded-lg px-3 py-2">
                    <span className="material-symbols-outlined text-sm">timer</span>
                    {selectedProblem.constraints}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Editor panel */}
          <div className="flex-1 flex flex-col gap-3 min-h-0">
            {selectedProblem && (
              <>
                <div className="bg-white rounded-xl border border-outline-variant/15 shadow-sm flex-1 p-4 flex flex-col min-h-0" style={{ minHeight: 400 }}>
                  <div className="flex items-center justify-between mb-3 shrink-0">
                    <p className="text-xs font-bold text-slate-muted uppercase tracking-wider">Editor</p>
                    <button
                      onClick={handleGetFeedback}
                      disabled={evaluating}
                      className="inline-flex items-center gap-1.5 bg-primary text-white text-xs font-semibold px-4 py-1.5 rounded-lg hover:bg-emerald-deep transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {evaluating ? (
                        <span className="material-symbols-outlined text-sm animate-spin">sync</span>
                      ) : (
                        <span className="material-symbols-outlined text-sm">smart_toy</span>
                      )}
                      {evaluating ? 'Evaluating…' : 'Get Feedback'}
                    </button>
                  </div>
                  <div className="flex-1 min-h-0">
                    <CodeEditor
                      key={`${selectedProblem.id}-${editorKey}`}
                      starterCode={selectedProblem.starterCode[language] || selectedProblem.starterCode.javascript}
                      constraints={selectedProblem.constraints}
                      onChange={(code, lang) => {
                        codeRef.current = code
                        setLanguage(lang as Language)
                      }}
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
                    <div className={`px-4 py-3 flex items-center gap-3 ${
                      evalResult.verdict === 'correct' ? 'bg-emerald-50 border-b border-emerald-100' :
                      evalResult.verdict === 'partial' ? 'bg-amber-50 border-b border-amber-100' :
                      'bg-red-50 border-b border-red-100'
                    }`}>
                      <span className={`material-symbols-outlined text-xl ${
                        evalResult.verdict === 'correct' ? 'text-emerald-600' :
                        evalResult.verdict === 'partial' ? 'text-amber-600' : 'text-red-500'
                      }`}>
                        {evalResult.verdict === 'correct' ? 'check_circle' : evalResult.verdict === 'partial' ? 'pending' : 'cancel'}
                      </span>
                      <div>
                        <p className="text-sm font-bold text-on-surface capitalize">{evalResult.verdict}</p>
                        <p className="text-xs text-slate-muted">{evalResult.approachUsed}</p>
                      </div>
                      <div className="ml-auto text-right">
                        <p className="text-2xl font-bold text-on-surface">{evalResult.score}</p>
                        <p className="text-[10px] text-slate-muted uppercase tracking-wider">/ 100</p>
                      </div>
                      <button onClick={() => setEvalResult(null)} className="text-slate-400 hover:text-slate-600 ml-2">
                        <span className="material-symbols-outlined text-sm">close</span>
                      </button>
                    </div>

                    <div className="px-4 py-3 space-y-3">
                      <p className="text-xs text-slate-muted leading-relaxed">{evalResult.feedback}</p>

                      {evalResult.strengths.length > 0 && (
                        <div>
                          <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider mb-1.5">Strengths</p>
                          <ul className="space-y-1">
                            {evalResult.strengths.map((s, i) => (
                              <li key={i} className="flex items-start gap-2 text-xs text-on-surface">
                                <span className="material-symbols-outlined text-emerald-500 text-sm mt-0.5 shrink-0">check</span>
                                {s}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {evalResult.issues.length > 0 && (
                        <div>
                          <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider mb-1.5">Issues / Improvements</p>
                          <ul className="space-y-1">
                            {evalResult.issues.map((issue, i) => (
                              <li key={i} className="flex items-start gap-2 text-xs text-on-surface">
                                <span className="material-symbols-outlined text-amber-500 text-sm mt-0.5 shrink-0">warning</span>
                                {issue}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
