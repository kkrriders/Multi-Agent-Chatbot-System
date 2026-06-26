'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { Sidebar } from '@/components/sidebar'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { questions as questionsApi, type Question } from '@/lib/api'

const CodeEditor = dynamic(() => import('@/components/CodeEditor'), { ssr: false })

const DIFFICULTY_COLOR: Record<string, string> = {
  easy:   'text-emerald-600 bg-emerald-50 border-emerald-200',
  medium: 'text-amber-600 bg-amber-50 border-amber-200',
  hard:   'text-red-600 bg-red-50 border-red-200',
}

function extractTitle(text: string): string {
  // "Two Sum — Given an array..." → "Two Sum"
  const dashIdx = text.indexOf(' — ')
  if (dashIdx !== -1) return text.slice(0, dashIdx).trim()
  // Fallback: first 50 chars
  return text.length > 50 ? text.slice(0, 50).trim() + '…' : text.trim()
}

function makeStarterCode(q: Question, lang: string): string {
  const js = q.starterCode || '// Your solution here'
  if (lang === 'javascript') return js
  if (lang === 'typescript') return js.replace(/function (\w+)\(([^)]*)\)/, 'function $1($2): unknown')
  if (lang === 'python') {
    const match = js.match(/function (\w+)\(([^)]*)\)/)
    if (match) {
      const name = match[1].replace(/([A-Z])/g, '_$1').toLowerCase()
      return `def ${name}(${match[2]}):\n    # Your solution here\n    pass`
    }
    return '# Your solution here\npass'
  }
  if (lang === 'java') return `class Solution {\n    public Object solve() {\n        // Your solution here\n        return null;\n    }\n}`
  if (lang === 'cpp') return `class Solution {\npublic:\n    // Your solution here\n};`
  if (lang === 'go') return `func solve() interface{} {\n    // Your solution here\n    return nil\n}`
  return js
}

type Language = 'javascript' | 'python' | 'java' | 'cpp' | 'typescript' | 'go'

export default function CodingPracticePage() {
  const { loading: authLoading } = useRequireAuth()
  const [problems, setProblems]           = useState<Question[]>([])
  const [loading, setLoading]             = useState(true)
  const [selected, setSelected]           = useState<Question | null>(null)
  const [language, setLanguage]           = useState<Language>('javascript')
  const [editorKey, setEditorKey]         = useState(0)
  const [filterDiff, setFilterDiff]       = useState('')

  useEffect(() => {
    questionsApi.list({ category: 'coding', limit: 100 })
      .then(data => {
        setProblems(data.questions)
        if (data.questions.length > 0) setSelected(data.questions[0])
      })
      .finally(() => setLoading(false))
  }, [])

  const selectProblem = (q: Question) => {
    setSelected(q)
    setEditorKey(k => k + 1)
  }

  const visible = filterDiff
    ? problems.filter(p => p.difficulty === filterDiff)
    : problems

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

            {/* Problem list */}
            <div className="bg-white rounded-xl border border-outline-variant/15 overflow-hidden shadow-sm flex-1 flex flex-col min-h-0">
              <div className="px-4 py-3 border-b border-outline-variant/10 bg-surface-container-lowest/50 shrink-0 flex items-center justify-between">
                <p className="text-xs font-bold text-slate-muted uppercase tracking-wider">Problems</p>
                <span className="text-xs text-slate-400">{visible.length}</span>
              </div>
              <div className="overflow-y-auto flex-1 divide-y divide-outline-variant/10">
                {loading ? (
                  <div className="flex items-center justify-center py-10">
                    <span className="material-symbols-outlined text-primary animate-spin">sync</span>
                  </div>
                ) : visible.length === 0 ? (
                  <p className="text-xs text-slate-muted text-center py-8">No problems found</p>
                ) : visible.map(p => (
                  <button
                    key={p.id}
                    onClick={() => selectProblem(p)}
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

          {/* Right pane */}
          <div className="flex-1 flex flex-col gap-3 min-h-0">
            {selected ? (
              <>
                {/* Problem description */}
                <div className="bg-white rounded-xl border border-outline-variant/15 p-4 shadow-sm shrink-0">
                  <div className="flex items-center gap-2 mb-2">
                    <h2 className="font-geist font-semibold text-base text-on-surface">{extractTitle(selected.text)}</h2>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${DIFFICULTY_COLOR[selected.difficulty] ?? ''}`}>
                      {selected.difficulty.charAt(0).toUpperCase() + selected.difficulty.slice(1)}
                    </span>
                  </div>
                  <p className="text-sm text-slate-muted leading-relaxed">{selected.text}</p>
                  {selected.constraints && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-surface-container-lowest rounded-lg px-3 py-2 mt-3">
                      <span className="material-symbols-outlined text-sm">timer</span>
                      {selected.constraints}
                    </div>
                  )}
                  {selected.expectedKeywords && selected.expectedKeywords.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {selected.expectedKeywords.map(kw => (
                        <span key={kw} className="text-[10px] bg-surface-container px-2 py-0.5 rounded-full text-slate-muted border border-outline-variant/20">{kw}</span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Editor */}
                <div className="bg-white rounded-xl border border-outline-variant/15 shadow-sm flex-1 p-4 flex flex-col min-h-0" style={{ minHeight: 360 }}>
                  <div className="flex items-center justify-between mb-3 shrink-0">
                    <p className="text-xs font-bold text-slate-muted uppercase tracking-wider">Editor</p>
                  </div>
                  <div className="flex-1 min-h-0">
                    <CodeEditor
                      key={`${selected.id}-${editorKey}`}
                      starterCode={makeStarterCode(selected, language)}
                      constraints={selected.constraints ?? undefined}
                      onChange={(_, lang) => setLanguage(lang as Language)}
                    />
                  </div>
                </div>
              </>
            ) : !loading && (
              <div className="flex-1 flex items-center justify-center text-slate-muted text-sm">
                Select a problem to start
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
