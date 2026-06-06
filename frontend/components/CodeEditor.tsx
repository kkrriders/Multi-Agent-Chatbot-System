'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'

// Monaco must be loaded client-side only
const Editor = dynamic(() => import('@monaco-editor/react'), { ssr: false })

export const SUPPORTED_LANGUAGES = [
  { id: 'javascript', label: 'JavaScript' },
  { id: 'python',     label: 'Python'     },
  { id: 'java',       label: 'Java'       },
  { id: 'cpp',        label: 'C++'        },
  { id: 'typescript', label: 'TypeScript' },
  { id: 'go',         label: 'Go'         },
]

interface TestResult {
  input: string
  expectedOutput: string
  actualOutput: string
  passed: boolean
  hidden: boolean
  executionTimeMs: number | null
}

interface CodeScore {
  passed: number
  total: number
}

interface Props {
  starterCode?: string
  constraints?: string
  testResults?: TestResult[]
  codeScore?: CodeScore
  onChange?: (code: string, language: string) => void
  readonly?: boolean
}

export default function CodeEditor({ starterCode = '', constraints, testResults, codeScore, onChange, readonly = false }: Props) {
  const [language, setLanguage] = useState('javascript')
  const [code, setCode] = useState(starterCode)

  const handleCodeChange = (value: string | undefined) => {
    const v = value || ''
    setCode(v)
    onChange?.(v, language)
  }

  const handleLanguageChange = (lang: string) => {
    setLanguage(lang)
    onChange?.(code, lang)
  }

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Language selector + constraints */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {SUPPORTED_LANGUAGES.map(l => (
            <button
              key={l.id}
              onClick={() => !readonly && handleLanguageChange(l.id)}
              className={`text-xs px-3 py-1.5 rounded-lg font-semibold border transition-all ${
                language === l.id
                  ? 'bg-primary text-white border-primary'
                  : 'bg-surface text-slate-muted border-outline-variant/30 hover:border-primary/50'
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
        {constraints && (
          <span className="text-xs text-slate-400 italic">{constraints}</span>
        )}
      </div>

      {/* Monaco editor */}
      <div className="flex-1 rounded-xl overflow-hidden border border-outline-variant/20" style={{ minHeight: 320 }}>
        <Editor
          height="100%"
          language={language === 'cpp' ? 'cpp' : language}
          value={code}
          onChange={handleCodeChange}
          options={{
            readOnly: readonly,
            fontSize: 14,
            minimap: { enabled: false },
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            padding: { top: 12, bottom: 12 },
            theme: 'vs',
          }}
        />
      </div>

      {/* Test results */}
      {testResults && testResults.length > 0 && (
        <div className="rounded-xl border border-outline-variant/20 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 bg-surface-container/50 border-b border-outline-variant/15">
            <span className="text-sm font-semibold text-on-surface">Test Results</span>
            {codeScore && (
              <span className={`text-sm font-bold ${codeScore.passed === codeScore.total ? 'text-green-600' : 'text-red-500'}`}>
                {codeScore.passed}/{codeScore.total} passed
              </span>
            )}
          </div>
          <div className="divide-y divide-outline-variant/10">
            {testResults.map((tr, i) => (
              <div key={i} className={`flex items-start gap-3 px-4 py-3 text-xs ${tr.passed ? 'bg-green-50/50' : 'bg-red-50/50'}`}>
                <span className={`mt-0.5 material-symbols-outlined text-base ${tr.passed ? 'text-green-600' : 'text-red-500'}`}>
                  {tr.passed ? 'check_circle' : 'cancel'}
                </span>
                <div className="flex-1 min-w-0">
                  <span className="font-semibold text-on-surface">Case {i + 1}{tr.hidden ? ' (hidden)' : ''}</span>
                  {!tr.hidden && (
                    <div className="mt-1 grid grid-cols-3 gap-2 text-slate-500">
                      <div><span className="font-medium">Input:</span> <code className="bg-surface px-1 rounded">{tr.input}</code></div>
                      <div><span className="font-medium">Expected:</span> <code className="bg-surface px-1 rounded">{tr.expectedOutput}</code></div>
                      <div><span className="font-medium">Got:</span> <code className={`px-1 rounded ${tr.passed ? 'bg-green-100' : 'bg-red-100'}`}>{tr.actualOutput}</code></div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
