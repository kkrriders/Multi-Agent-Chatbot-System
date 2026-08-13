'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { cv as cvApi, type CandidateProfile } from '@/lib/api'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { Sidebar } from '@/components/sidebar'
import { Topbar } from '@/components/Topbar'
import { toast } from 'sonner'

export default function UploadPage() {
  const { loading: authLoading } = useRequireAuth()
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [profile, setProfile] = useState<CandidateProfile | null>(null)
  const [jd, setJd] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [gaps, setGaps] = useState<{ fitScore: number | null; missingSkills: string[]; matchedSkills: string[] } | null>(null)
  const [dragging, setDragging] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) setFile(f)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) setFile(f)
  }

  const handleUpload = async () => {
    if (!file) return
    setUploading(true)
    try {
      const data = await cvApi.upload(file)
      setProfile(data.profile)
      setFile(null)
      if (data.partial) {
        toast.warning('CV uploaded, but AI extraction was unavailable. Skills may be empty — you can still start an interview.')
      } else {
        toast.success('CV parsed successfully')
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const handleGapAnalysis = async () => {
    if (!jd.trim()) return
    setAnalyzing(true)
    try {
      const data = await cvApi.analyzeGap(jd)
      setGaps(data)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Analysis failed')
    } finally {
      setAnalyzing(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Delete your CV? This cannot be undone. You will need to re-upload before starting an interview.')) return
    setDeleting(true)
    try {
      await cvApi.deleteProfile()
      setProfile(null)
      setGaps(null)
      setJd('')
      toast.success('CV deleted')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setDeleting(false)
    }
  }

  if (authLoading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <span className="material-symbols-outlined text-primary text-4xl animate-spin">sync</span>
    </div>
  )

  return (
    <div className="bg-background text-on-background antialiased min-h-screen flex">
      <Sidebar />
      <Topbar title="Profile & CV Analysis" />

      <main className="flex-1 md:ml-64 pt-20 md:pt-24 px-4 md:px-12 pb-24 md:pb-12 w-full max-w-[1280px] mx-auto space-y-10 overflow-x-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Upload */}
          <div className="lg:col-span-4 space-y-6">
            <div
              onDrop={handleDrop}
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onClick={() => fileRef.current?.click()}
              className={`panel rounded-xl p-6 flex flex-col items-center justify-center text-center border-dashed border-2 transition-all cursor-pointer group min-h-[240px] ${
                dragging ? 'border-primary bg-primary-container/10' : 'border-secondary/30'
              }`}
            >
              <input ref={fileRef} type="file" accept=".pdf,.docx,.txt" onChange={handleFile} className="hidden" />
              <div className="w-16 h-16 rounded-full bg-secondary-container/20 flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-secondary-container/40 transition-transform duration-300">
                <span className="material-symbols-outlined text-3xl text-secondary">cloud_upload</span>
              </div>
              {file ? (
                <>
                  <h3 className="text-sm font-bold text-primary mb-1">{file.name}</h3>
                  <p className="text-xs text-on-surface-variant">{(file.size / 1024).toFixed(0)} KB — ready to upload</p>
                </>
              ) : (
                <>
                  <h3 className="text-sm font-bold text-primary mb-1">{profile ? 'Upload New CV' : 'Upload Your CV'}</h3>
                  <p className="text-xs text-on-surface-variant mb-4">Drag and drop your PDF, DOCX, or TXT here</p>
                </>
              )}
              {file && (
                <button
                  onClick={e => { e.stopPropagation(); handleUpload() }}
                  disabled={uploading}
                  className="mt-4 px-4 py-2 bg-primary text-white rounded-xl text-sm font-semibold hover:brightness-90 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {uploading ? <><span className="material-symbols-outlined animate-spin text-base">sync</span>Parsing…</> : 'Upload & Parse'}
                </button>
              )}
              {!file && (
                <button className="px-4 py-2 bg-secondary/10 text-secondary border border-secondary/20 rounded-xl text-sm font-semibold hover:bg-secondary/20 transition-colors">
                  Browse Files
                </button>
              )}
            </div>

            {profile && (
              <div className="panel rounded-xl p-4">
                <div className="flex items-center justify-between p-2 rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-secondary icon-fill">verified_user</span>
                    <div>
                      <p className="text-sm font-medium text-primary">{profile.name || 'Your CV'}</p>
                      <p className="text-xs text-on-surface-variant">Parsed <span className="font-mono">{profile.parsedAt ? new Date(profile.parsedAt).toLocaleDateString() : 'recently'}</span></p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-outline-variant/10">
                  <button onClick={handleDelete} disabled={deleting} className="text-xs font-semibold text-error hover:text-error/70 transition-colors disabled:opacity-50">
                    {deleting ? 'Deleting…' : 'Delete CV'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Analysis Results */}
          <div className="lg:col-span-8 space-y-6">
            {profile ? (
              <>
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                  <div>
                    <h2 className="font-heading text-3xl font-bold text-primary mb-1">{profile.name || 'Your CV'}</h2>
                    <p className="text-lg text-on-surface-variant">{profile.skills?.length ? `${profile.skills.length} skills extracted` : 'Analysis complete'}</p>
                  </div>
                  <div className="flex items-center gap-2 bg-surface-container-highest/40 px-4 py-2 rounded-full w-fit shadow-sm border border-secondary/10">
                    <span className="material-symbols-outlined text-secondary text-sm">check_circle</span>
                    <span className="text-sm font-medium text-on-surface-variant">Analysis Complete</span>
                  </div>
                </div>

                {/* Bento: Gauge + Skill Gaps */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="panel rounded-xl p-6 flex flex-col items-center justify-center relative overflow-hidden">
                    <div className="absolute -top-10 -right-10 w-32 h-32 bg-secondary-fixed/30 rounded-full blur-2xl" />
                    <h3 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-6 w-full text-left">Role Match Score</h3>
                    {gaps?.fitScore != null ? (
                      <div className="relative w-40 h-40 flex items-center justify-center">
                        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                          <circle cx="50" cy="50" r="40" fill="none" stroke="var(--color-surface-variant)" strokeWidth="8" opacity="0.3" />
                          <circle
                            cx="50" cy="50" r="40" fill="none" stroke="var(--color-secondary)" strokeWidth="8" strokeLinecap="round"
                            strokeDasharray={`${gaps.fitScore * 2.512} 251.2`}
                          />
                        </svg>
                        <div className="absolute flex flex-col items-center">
                          <span className="stat-tile-value font-heading font-mono text-3xl text-primary">{gaps.fitScore}%</span>
                          <span className="text-xs text-secondary">{gaps.fitScore >= 75 ? 'Strong Match' : gaps.fitScore >= 50 ? 'Good Match' : 'Needs Work'}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center text-center py-6">
                        <span className="material-symbols-outlined text-4xl text-on-surface-variant mb-2">insights</span>
                        <p className="text-xs text-on-surface-variant">Paste a job description below to see your match score.</p>
                      </div>
                    )}
                  </div>

                  <div className="panel rounded-xl p-6 flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Skill Gaps</h3>
                      <span className="material-symbols-outlined text-outline">work</span>
                    </div>
                    <div className="flex-1 flex flex-col justify-center">
                      {gaps?.missingSkills?.length ? (
                        <div className="flex items-start gap-4 mb-4">
                          <div className="w-8 h-8 rounded-full bg-error-container/50 flex items-center justify-center shrink-0">
                            <span className="material-symbols-outlined text-error text-sm">warning</span>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-primary">{gaps.missingSkills.length} skills missing</p>
                            <p className="text-xs text-on-surface-variant mt-1">{gaps.missingSkills.slice(0, 4).join(', ')}{gaps.missingSkills.length > 4 ? '…' : ''}</p>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-on-surface-variant">Run a gap analysis (below) to see missing vs. matched skills for a target role.</p>
                      )}
                      {gaps?.matchedSkills?.length ? (
                        <div className="bg-surface-container-low p-2 rounded-lg border border-outline-variant/20">
                          <p className="text-xs font-semibold text-secondary mb-1">Matched Skills</p>
                          <p className="text-xs text-on-surface-variant">{gaps.matchedSkills.slice(0, 6).join(', ')}</p>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>

                {/* Skills pill cloud */}
                {(profile.skills?.length ?? 0) > 0 && (
                  <div className="panel rounded-xl p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <span className="material-symbols-outlined text-secondary">psychology_alt</span>
                      <h3 className="text-xs font-bold text-primary uppercase tracking-wider">AI Extracted Skills</h3>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {profile.skills.map(s => (
                        <span key={s} className="px-2 py-1 bg-secondary-fixed/20 text-on-secondary-fixed-variant rounded-full text-xs font-medium border border-secondary-fixed/30 hover:scale-105 hover:bg-secondary-fixed hover:text-on-secondary-fixed transition-all cursor-default">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Experience timeline */}
                {(profile.experience?.length ?? 0) > 0 && (
                  <div className="panel rounded-xl p-6">
                    <h3 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-4">Experience Summary</h3>
                    <div className="relative pl-4 border-l-2 border-outline-variant/30 space-y-6">
                      {profile.experience.map((e, i) => (
                        <div key={i} className="relative">
                          <div className={`absolute -left-[25px] top-1 w-4 h-4 rounded-full border-4 border-surface ${i === 0 ? 'bg-secondary' : 'bg-outline-variant'}`} />
                          <h4 className="font-bold text-primary text-lg">{e.role}</h4>
                          <p className="text-xs text-secondary mb-2">{e.company}{e.duration ? ` • ${e.duration}` : ''}</p>
                          {e.description && <p className="text-sm text-on-surface-variant">{e.description}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* JD gap analysis input */}
                <div className="panel rounded-xl p-6">
                  <h3 className="text-xs font-bold text-on-surface uppercase tracking-wider mb-4">Paste a job description to analyze</h3>
                  <textarea
                    value={jd} onChange={e => setJd(e.target.value)}
                    placeholder="Paste key requirements from the job description here..." rows={4} maxLength={10000}
                    className="w-full border border-outline-variant/50 rounded-lg px-4 py-3 bg-surface-container-lowest text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all resize-none mb-4"
                  />
                  <button
                    onClick={handleGapAnalysis}
                    disabled={!jd.trim() || analyzing}
                    className="bg-primary hover:brightness-90 text-white text-sm font-semibold py-2 px-6 rounded-lg transition-colors flex justify-center items-center gap-2 disabled:opacity-50 shadow-sm"
                  >
                    {analyzing ? (
                      <><span className="material-symbols-outlined animate-spin text-base">sync</span>Analyzing…</>
                    ) : (
                      <><span className="material-symbols-outlined">auto_fix_high</span>Analyze with AI</>
                    )}
                  </button>
                </div>

                <div className="flex justify-center">
                  <button
                    onClick={() => router.push('/interview')}
                    className="inline-flex items-center gap-2 bg-primary text-white text-base font-semibold px-8 py-3 rounded-lg hover:brightness-90 transition-colors shadow-sm"
                  >
                    Start Interview <span className="material-symbols-outlined">arrow_forward</span>
                  </button>
                </div>
              </>
            ) : (
              <div className="panel rounded-xl p-10 flex flex-col items-center justify-center text-center min-h-[300px]">
                <span className="material-symbols-outlined text-5xl text-on-surface-variant mb-4">description</span>
                <h2 className="font-heading text-2xl font-bold text-primary mb-2">No CV on file yet</h2>
                <p className="text-sm text-on-surface-variant max-w-sm">Upload your resume on the left and we&apos;ll extract your skills and experience to personalise your interview questions.</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
