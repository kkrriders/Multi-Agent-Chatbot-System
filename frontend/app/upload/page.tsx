'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { cv as cvApi, type CandidateProfile } from '@/lib/api'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { Nav } from '@/components/nav'
import { UploadCloud, CheckCircle, ArrowRight, Loader2 } from 'lucide-react'
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

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) setFile(f)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f) setFile(f)
  }

  const handleUpload = async () => {
    if (!file) return
    setUploading(true)
    try {
      const data = await cvApi.upload(file)
      setProfile(data.profile)
      toast.success('CV parsed successfully')
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

  if (authLoading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
    </div>
  )

  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <div className="pt-14">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <h1 className="text-2xl font-bold mb-1">Upload Your CV</h1>
          <p className="text-muted-foreground mb-6">PDF, DOCX, or TXT — max 5 MB. We&apos;ll extract your skills and tailor interview questions to your background.</p>

          {!profile ? (
            <div className="space-y-4">
              <div
                onDrop={handleDrop}
                onDragOver={e => e.preventDefault()}
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-border rounded-xl p-12 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-all"
              >
                <input ref={fileRef} type="file" accept=".pdf,.docx,.txt" onChange={handleFile} className="hidden" />
                <UploadCloud className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                {file ? (
                  <div>
                    <p className="font-medium">{file.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">{(file.size / 1024).toFixed(0)} KB</p>
                  </div>
                ) : (
                  <div>
                    <p className="font-medium">Drop your CV here or click to browse</p>
                    <p className="text-sm text-muted-foreground mt-1">Supports PDF, DOCX, TXT</p>
                  </div>
                )}
              </div>

              <button
                onClick={handleUpload}
                disabled={!file || uploading}
                className="w-full bg-primary text-primary-foreground rounded-lg py-3 font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {uploading ? <><Loader2 className="w-4 h-4 animate-spin" /> Parsing CV...</> : 'Upload & Parse'}
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex items-center gap-3 border border-green-500/30 bg-green-500/5 rounded-xl px-4 py-3">
                <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                <div>
                  <p className="font-medium">CV parsed successfully</p>
                  {profile.name && <p className="text-sm text-muted-foreground">{profile.name}</p>}
                </div>
              </div>

              {(profile.skills?.length ?? 0) > 0 && (
                <div className="border border-border rounded-xl p-4">
                  <h2 className="font-semibold mb-3">Extracted Skills ({profile.skills?.length})</h2>
                  <div className="flex flex-wrap gap-1.5">
                    {profile.skills?.slice(0, 30).map((s: string) => (
                      <span key={s} className="text-xs bg-secondary text-secondary-foreground px-2.5 py-1 rounded-full">{s}</span>
                    ))}
                  </div>
                </div>
              )}

              {(profile.experience?.length ?? 0) > 0 && (
                <div className="border border-border rounded-xl p-4">
                  <h2 className="font-semibold mb-3">Experience</h2>
                  <div className="space-y-2">
                    {profile.experience?.slice(0, 4).map((e, i: number) => (
                      <div key={i} className="text-sm">
                        <span className="font-medium">{e.role}</span>
                        {e.company && <span className="text-muted-foreground"> @ {e.company}</span>}
                        {e.duration && <span className="text-muted-foreground"> · {e.duration}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="border border-border rounded-xl p-4">
                <h2 className="font-semibold mb-2">Skill Gap Analysis (optional)</h2>
                <p className="text-xs text-muted-foreground mb-3">Paste a job description to see which skills you&apos;re missing</p>
                <textarea
                  value={jd} onChange={e => setJd(e.target.value)}
                  placeholder="Paste job description here..." rows={4} maxLength={10000}
                  className="w-full border border-border rounded-lg px-3 py-2 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none mb-3"
                />
                <button
                  onClick={handleGapAnalysis} disabled={!jd.trim() || analyzing}
                  className="w-full border border-border rounded-lg py-2 text-sm font-medium hover:bg-accent disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {analyzing ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Analyzing...</> : 'Analyze Gaps'}
                </button>

                {gaps && (
                  <div className="mt-4 space-y-3">
                    {gaps.fitScore != null && (
                      <div className="text-center">
                        <span className={`text-3xl font-bold ${gaps.fitScore >= 70 ? 'text-green-500' : gaps.fitScore >= 50 ? 'text-yellow-500' : 'text-red-500'}`}>
                          {gaps.fitScore}%
                        </span>
                        <p className="text-xs text-muted-foreground">Role fit score</p>
                      </div>
                    )}
                    {(gaps.missingSkills?.length ?? 0) > 0 && (
                      <div>
                        <p className="text-xs font-medium text-red-400 mb-1">Missing Skills</p>
                        <div className="flex flex-wrap gap-1">
                          {gaps.missingSkills?.map((s: string) => (
                            <span key={s} className="text-xs bg-red-500/10 text-red-400 px-2 py-0.5 rounded-full">{s}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {(gaps.matchedSkills?.length ?? 0) > 0 && (
                      <div>
                        <p className="text-xs font-medium text-green-400 mb-1">Matched Skills</p>
                        <div className="flex flex-wrap gap-1">
                          {gaps.matchedSkills?.slice(0, 15).map((s: string) => (
                            <span key={s} className="text-xs bg-green-500/10 text-green-400 px-2 py-0.5 rounded-full">{s}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <button
                onClick={() => router.push('/interview')}
                className="w-full bg-primary text-primary-foreground rounded-lg py-3 font-medium flex items-center justify-center gap-2"
              >
                Start Interview <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
