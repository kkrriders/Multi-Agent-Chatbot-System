'use client'

import { useEffect, useState, useCallback } from 'react'
import { questions as questionsApi, type Question } from '@/lib/api'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { Nav } from '@/components/nav'
import { Plus, Trash2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

const CATEGORIES = ['technical', 'behavioral', 'situational', 'intro', 'closing'] as const
const DIFFICULTIES = ['easy', 'medium', 'hard'] as const
const ROLES = ['General', 'Frontend Dev', 'Backend Dev', 'Full Stack Dev', 'Data Scientist', 'Product Manager', 'DevOps Engineer']

type Category = typeof CATEGORIES[number]
type Difficulty = typeof DIFFICULTIES[number]

export default function QuestionsPage() {
  useRequireAuth()
  const [items, setItems] = useState<Question[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState({ category: '', difficulty: '', role: '' })
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ text: '', category: 'technical' as Category, role: 'General', difficulty: 'medium' as Difficulty, expectedKeywords: '' })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await questionsApi.list({
        category: filter.category || undefined,
        difficulty: filter.difficulty || undefined,
        role: filter.role || undefined,
        limit: 50,
      })
      setItems(data.questions)
      setTotal(data.total)
    } catch { toast.error('Failed to load questions') }
    finally { setLoading(false) }
  }, [filter])

  useEffect(() => { load() }, [load])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await questionsApi.create({
        text: form.text,
        category: form.category,
        role: form.role,
        difficulty: form.difficulty,
        expectedKeywords: form.expectedKeywords.split(',').map(s => s.trim()).filter(Boolean) as string[] & typeof form.expectedKeywords,
      })
      toast.success('Question created')
      setShowForm(false)
      setForm({ text: '', category: 'technical', role: 'General', difficulty: 'medium', expectedKeywords: '' })
      load()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await questionsApi.deactivate(id)
      setItems(prev => prev.filter(q => q.id !== id))
      toast.success('Question removed')
    } catch { toast.error('Failed to remove') }
  }

  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <div className="pt-14">
        <div className="max-w-5xl mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold">Question Bank</h1>
              <p className="text-muted-foreground text-sm">{total} questions</p>
            </div>
            <button
              onClick={() => setShowForm(s => !s)}
              className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium"
            >
              <Plus className="w-4 h-4" /> Add Question
            </button>
          </div>

          {showForm && (
            <form onSubmit={handleCreate} className="border border-border rounded-xl p-5 mb-6 space-y-4">
              <h2 className="font-semibold">New Question</h2>
              <textarea
                value={form.text} onChange={e => setForm(f => ({ ...f, text: e.target.value }))}
                placeholder="Question text" rows={3} required
                className="w-full border border-border rounded-lg px-3 py-2 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              />
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Category</label>
                  <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value as Category }))}
                    className="mt-1 w-full border border-border rounded-lg px-3 py-2 bg-background text-sm focus:outline-none"
                  >
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Difficulty</label>
                  <select value={form.difficulty} onChange={e => setForm(f => ({ ...f, difficulty: e.target.value as Difficulty }))}
                    className="mt-1 w-full border border-border rounded-lg px-3 py-2 bg-background text-sm focus:outline-none"
                  >
                    {DIFFICULTIES.map(d => <option key={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Role</label>
                  <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                    className="mt-1 w-full border border-border rounded-lg px-3 py-2 bg-background text-sm focus:outline-none"
                  >
                    {ROLES.map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Expected Keywords (comma-separated)</label>
                <input type="text" value={form.expectedKeywords} onChange={e => setForm(f => ({ ...f, expectedKeywords: e.target.value }))}
                  placeholder="e.g. REST, API, caching"
                  className="mt-1 w-full border border-border rounded-lg px-3 py-2 bg-background text-sm focus:outline-none"
                />
              </div>
              <div className="flex gap-3">
                <button type="submit" disabled={saving}
                  className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 flex items-center gap-2"
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Save Question
                </button>
                <button type="button" onClick={() => setShowForm(false)}
                  className="border border-border px-4 py-2 rounded-lg text-sm"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          <div className="flex flex-wrap gap-3 mb-5">
            {[
              { label: 'All Categories', key: 'category', options: ['', ...CATEGORIES] },
              { label: 'All Difficulties', key: 'difficulty', options: ['', ...DIFFICULTIES] },
              { label: 'All Roles', key: 'role', options: ['', ...ROLES] },
            ].map(({ label, key, options }) => (
              <select
                key={key}
                value={filter[key as keyof typeof filter]}
                onChange={e => setFilter(f => ({ ...f, [key]: e.target.value }))}
                className="border border-border rounded-lg px-3 py-1.5 bg-background text-sm focus:outline-none"
              >
                <option value="">{label}</option>
                {options.filter(Boolean).map(o => <option key={o}>{o}</option>)}
              </select>
            ))}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-border rounded-xl">
              <p className="text-muted-foreground">No questions match the filters</p>
            </div>
          ) : (
            <div className="space-y-2">
              {items.map(q => (
                <div key={q.id} className="flex items-start gap-4 border border-border rounded-xl px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{q.text}</p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      <span className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full">{q.category}</span>
                      <span className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full capitalize">{q.difficulty}</span>
                    </div>
                  </div>
                  <button onClick={() => handleDelete(q.id)} className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0 mt-0.5">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
