'use client'

import { useState, useRef } from 'react'
import { Sidebar } from '@/components/sidebar'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { getCachedUser } from '@/lib/auth'
import { cv as cvApi } from '@/lib/api'
import { toast } from 'sonner'

const TABS = ['Personal Info', 'Interview Preferences', 'Subscription', 'Security']

export default function ProfilePage() {
  const { loading: authLoading } = useRequireAuth()
  const user = getCachedUser()
  const [activeTab, setActiveTab] = useState(0)
  const [firstName, setFirstName] = useState(user?.fullName?.split(' ')[0] || '')
  const [lastName, setLastName] = useState(user?.fullName?.split(' ').slice(1).join(' ') || '')
  const [bio, setBio] = useState('')
  const [saving, setSaving] = useState(false)
  const [cvFile, setCvFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadedCv, setUploadedCv] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    await new Promise(r => setTimeout(r, 800)) // simulate save
    toast.success('Profile updated')
    setSaving(false)
  }

  const handleCvFile = (f: File) => {
    setCvFile(f)
    setUploadedCv(f.name)
  }

  const handleCvUpload = async () => {
    if (!cvFile) return
    setUploading(true)
    try {
      await cvApi.upload(cvFile)
      toast.success('CV uploaded and parsed successfully')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  if (authLoading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <span className="material-symbols-outlined text-primary text-4xl animate-spin">sync</span>
    </div>
  )

  return (
    <div className="bg-background text-on-background min-h-screen flex w-full overflow-x-hidden font-sans">
      <Sidebar />

      <div className="flex-1 flex flex-col md:ml-64 w-full min-h-screen">
        {/* Mobile header already in sidebar */}
        <main className="flex-1 p-4 md:p-12 max-w-[1280px] mx-auto w-full flex flex-col gap-8 md:gap-12 pt-20 md:pt-12">
          {/* Page title */}
          <div className="flex flex-col gap-2">
            <h2 className="font-geist font-bold text-2xl md:text-3xl text-on-surface">Profile &amp; Settings</h2>
            <p className="text-base text-slate-muted max-w-2xl">
              Manage your personal information, interview preferences, and account security. Keep your CV up to date for the best AI coaching experience.
            </p>
          </div>

          <div className="grid grid-cols-4 md:grid-cols-12 gap-6 items-start">
            {/* Sidebar tabs */}
            <div className="col-span-4 md:col-span-3 flex flex-col gap-2 sticky top-24">
              {TABS.map((tab, i) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(i)}
                  className={`text-left px-4 py-3 rounded-lg text-sm font-semibold flex items-center justify-between transition-colors ${
                    activeTab === i
                      ? 'bg-surface border border-outline-variant/15 text-primary shadow-sm'
                      : 'text-slate-muted hover:bg-surface-container-low'
                  }`}
                >
                  {tab}
                  {activeTab === i && <span className="material-symbols-outlined text-sm">chevron_right</span>}
                </button>
              ))}
            </div>

            {/* Content area */}
            <div className="col-span-4 md:col-span-9 flex flex-col gap-8">
              {/* Personal Info */}
              {activeTab === 0 && (
                <>
                  {/* Profile card */}
                  <section className="bg-surface rounded-xl border border-outline-variant/15 overflow-hidden flex flex-col md:flex-row shadow-sm">
                    {/* Avatar column */}
                    <div className="p-8 md:w-1/3 border-b md:border-b-0 md:border-r border-outline-variant/15 flex flex-col items-center text-center justify-center bg-surface-bright">
                      <div className="w-32 h-32 rounded-full overflow-hidden mb-4 border-4 border-surface-container relative group cursor-pointer bg-emerald-deep/10 flex items-center justify-center">
                        <span className="text-5xl">{user?.fullName?.[0] || '?'}</span>
                        <div className="absolute inset-0 bg-ink/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-full">
                          <span className="material-symbols-outlined text-white">photo_camera</span>
                        </div>
                      </div>
                      <h3 className="font-geist font-semibold text-2xl text-on-surface mb-1">{user?.fullName || 'Your Name'}</h3>
                      <p className="text-base text-slate-muted mb-4">Interview Candidate</p>
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-deep/10 text-emerald-deep text-xs font-semibold">
                        <span className="material-symbols-outlined text-sm icon-fill">verified</span>
                        Verified Account
                      </span>
                    </div>

                    {/* Form column */}
                    <div className="p-8 md:w-2/3 flex flex-col gap-6">
                      <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="flex flex-col gap-2">
                          <label className="text-xs font-medium text-on-surface-variant">First Name</label>
                          <input
                            value={firstName} onChange={e => setFirstName(e.target.value)}
                            className="w-full bg-surface-container-lowest border border-outline-variant/50 rounded-lg px-4 py-2.5 text-base text-on-surface focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
                          />
                        </div>
                        <div className="flex flex-col gap-2">
                          <label className="text-xs font-medium text-on-surface-variant">Last Name</label>
                          <input
                            value={lastName} onChange={e => setLastName(e.target.value)}
                            className="w-full bg-surface-container-lowest border border-outline-variant/50 rounded-lg px-4 py-2.5 text-base text-on-surface focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
                          />
                        </div>
                        <div className="flex flex-col gap-2 md:col-span-2">
                          <label className="text-xs font-medium text-on-surface-variant">Email Address</label>
                          <input
                            type="email" value={user?.email || ''} readOnly
                            className="w-full bg-surface-container-low border border-outline-variant/50 rounded-lg px-4 py-2.5 text-base text-slate-muted cursor-not-allowed outline-none"
                          />
                        </div>
                        <div className="flex flex-col gap-2 md:col-span-2">
                          <label className="text-xs font-medium text-on-surface-variant">Professional Bio</label>
                          <textarea
                            value={bio} onChange={e => setBio(e.target.value)}
                            placeholder="Tell us about your background and career goals..."
                            rows={3}
                            className="w-full bg-surface-container-lowest border border-outline-variant/50 rounded-lg px-4 py-2.5 text-base text-on-surface focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all resize-none"
                          />
                        </div>
                        <div className="flex justify-end md:col-span-2 pt-2">
                          <button
                            type="submit" disabled={saving}
                            className="bg-primary text-white text-sm font-semibold px-6 py-2.5 rounded-lg hover:bg-emerald-deep transition-colors shadow-sm disabled:opacity-60 flex items-center gap-2"
                          >
                            {saving ? <><span className="material-symbols-outlined animate-spin text-base">sync</span>Saving…</> : 'Save Changes'}
                          </button>
                        </div>
                      </form>
                    </div>
                  </section>

                  {/* CV Upload */}
                  <section className="bg-surface rounded-xl border border-outline-variant/15 p-8 shadow-sm">
                    <div className="flex flex-col gap-2 mb-6">
                      <h3 className="font-geist font-semibold text-2xl text-on-surface">Curriculum Vitae</h3>
                      <p className="text-base text-slate-muted">Upload your latest CV to provide context for your AI interview coach. PDF or Word documents up to 5MB.</p>
                    </div>
                    <div
                      onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleCvFile(f) }}
                      onDragOver={e => { e.preventDefault(); setDragging(true) }}
                      onDragLeave={() => setDragging(false)}
                      onClick={() => fileRef.current?.click()}
                      className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center cursor-pointer group relative overflow-hidden transition-all ${
                        dragging ? 'border-primary bg-primary-container/5' : 'border-slate-muted/40 bg-surface-bright hover:bg-surface-container-low'
                      }`}
                    >
                      <input ref={fileRef} type="file" accept=".pdf,.docx,.txt" onChange={e => { const f = e.target.files?.[0]; if (f) handleCvFile(f) }} className="hidden" />
                      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      <span className="material-symbols-outlined text-6xl text-slate-muted mb-4 group-hover:-translate-y-1 transition-transform duration-300">description</span>
                      {cvFile ? (
                        <div className="text-center">
                          <p className="text-sm font-semibold text-emerald-deep mb-1">{cvFile.name}</p>
                          <p className="text-xs text-slate-muted">Ready to upload</p>
                        </div>
                      ) : (
                        <>
                          <p className="text-sm font-semibold text-on-surface mb-2">
                            Drag &amp; drop your file here, or <span className="text-primary underline">browse</span>
                          </p>
                          <p className="text-xs text-slate-muted">Supported formats: .pdf, .docx, .txt</p>
                        </>
                      )}
                    </div>

                    {cvFile && (
                      <div className="mt-4 flex items-center gap-3 justify-between">
                        <div className="flex items-center gap-3 border border-outline-variant/15 rounded-lg p-4 bg-surface-container-lowest flex-1">
                          <div className="w-10 h-10 rounded bg-emerald-deep/10 flex items-center justify-center text-emerald-deep flex-shrink-0">
                            <span className="material-symbols-outlined icon-fill">picture_as_pdf</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-on-surface truncate">{cvFile.name}</p>
                            <p className="text-xs text-slate-muted">{(cvFile.size / 1024).toFixed(0)} KB</p>
                          </div>
                        </div>
                        <button
                          onClick={handleCvUpload} disabled={uploading}
                          className="bg-primary text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-emerald-deep transition-colors shadow-sm disabled:opacity-60 flex items-center gap-2 flex-shrink-0"
                        >
                          {uploading ? <><span className="material-symbols-outlined animate-spin text-base">sync</span>Uploading…</> : <><span className="material-symbols-outlined text-base">upload</span>Upload</>}
                        </button>
                      </div>
                    )}
                  </section>
                </>
              )}

              {/* Other tabs — coming soon */}
              {activeTab > 0 && (
                <section className="bg-surface rounded-xl border border-outline-variant/15 p-12 shadow-sm flex flex-col items-center justify-center text-center min-h-[300px]">
                  <span className="material-symbols-outlined text-slate-muted text-6xl mb-4">
                    {activeTab === 1 ? 'tune' : activeTab === 2 ? 'workspace_premium' : 'security'}
                  </span>
                  <h3 className="font-geist font-semibold text-2xl text-on-surface mb-2">{TABS[activeTab]}</h3>
                  <p className="text-slate-muted max-w-xs">This section is coming soon. Check back for updates.</p>
                </section>
              )}
            </div>
          </div>
        </main>

        <footer className="w-full py-3 px-4 md:px-12 flex flex-col md:flex-row justify-between items-center max-w-[1280px] mx-auto border-t border-outline-variant/15 bg-background mt-auto gap-4 md:gap-0">
          <div className="text-sm font-bold text-emerald-deep">MockPrep</div>
          <div className="text-xs text-slate-muted">© 2024 MockPrep AI. All rights reserved.</div>
          <div className="flex gap-6">
            {['Privacy Policy', 'Terms of Service', 'Support'].map(l => (
              <span key={l} className="text-xs text-slate-muted hover:text-emerald-deep transition-colors cursor-pointer">{l}</span>
            ))}
          </div>
        </footer>
      </div>
    </div>
  )
}
