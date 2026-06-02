import Link from 'next/link'

const FEATURES = [
  {
    icon: 'speed',
    title: 'Real-time AI Scoring',
    desc: 'Get instant 0–100 scores across clarity, relevance, and confidence as you speak.',
    wide: true,
    score: 86,
  },
  {
    icon: 'mic',
    title: 'Speech Analysis',
    desc: 'Automatically detect filler words, monitor pace, and assess vocal confidence.',
    wide: false,
    accent: 'amber',
  },
  {
    icon: 'forum',
    title: 'Adaptive Follow-ups',
    desc: 'Experience dynamic questioning. The AI probes deeper based on your previous answers.',
    wide: false,
    accent: 'secondary',
  },
]

const STEPS = [
  { n: '1', icon: 'upload_file',      title: 'Upload CV',       desc: 'Share your resume so we can tailor the context.' },
  { n: '2', icon: 'person_search',    title: 'Pick Mode',       desc: 'Select from technical, behavioral, or mixed styles.' },
  { n: '3', icon: 'record_voice_over', title: 'Practice',       desc: 'Answer via voice or text in a realistic simulation.' },
  { n: '4', icon: 'insights',          title: 'Get Feedback',   desc: 'Review scores, transcripts, and improvement tips.' },
]

export default function LandingPage() {
  return (
    <div className="bg-background text-on-background min-h-screen flex flex-col antialiased">
      {/* Header */}
      <header className="bg-surface sticky top-0 border-b border-outline-variant/15 z-50">
        <div className="flex justify-between items-center w-full px-4 md:px-12 max-w-[1280px] mx-auto h-16">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-emerald-deep text-2xl icon-fill">psychology</span>
            <span className="font-geist font-bold text-emerald-deep text-xl">MockPrep</span>
          </div>
          <nav className="hidden md:flex items-center gap-8">
            {['Features', 'How it works', 'Pricing'].map(l => (
              <span key={l} className="text-slate-muted text-sm font-semibold cursor-pointer hover:text-primary transition-colors">{l}</span>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login" className="hidden md:block text-primary text-sm font-semibold hover:bg-surface-container-low px-4 py-2 rounded transition-colors">
              Log In
            </Link>
            <Link href="/signup" className="bg-emerald-deep text-white text-sm font-semibold px-5 py-2 rounded-lg hover:bg-primary transition-colors shadow-sm">
              Get Started
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-grow flex flex-col w-full">
        {/* Hero */}
        <section className="w-full px-4 md:px-12 max-w-[1280px] mx-auto py-16 md:py-24 flex flex-col lg:flex-row items-center gap-12">
          {/* Hero text */}
          <div className="w-full lg:w-1/2 flex flex-col gap-6 items-start text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary-container/10 border border-primary/20 rounded-full text-primary text-xs font-semibold">
              <span className="material-symbols-outlined text-base">bolt</span>
              AI-Powered Interview Coach
            </div>
            <h1 className="font-geist font-bold text-3xl md:text-5xl text-ink leading-tight tracking-tight">
              Master your next interview with{' '}
              <span className="text-emerald-deep">AI precision.</span>
            </h1>
            <p className="text-lg text-secondary leading-relaxed max-w-lg">
              Upload your resume, select your target role, and engage in realistic, adaptive mock interviews that build your confidence and refine your answers.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 mt-4 w-full sm:w-auto">
              <Link
                href="/signup"
                className="bg-emerald-deep text-white font-semibold text-sm px-6 py-3 rounded-lg hover:bg-primary transition-all shadow-sm flex items-center justify-center gap-2 group"
              >
                Start Free Trial
                <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">arrow_forward</span>
              </Link>
              <Link
                href="/login"
                className="bg-surface-container text-on-surface font-semibold text-sm px-6 py-3 rounded-lg hover:bg-surface-container-high transition-colors border border-outline-variant/30 flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined">play_circle</span>
                Sign In
              </Link>
            </div>
            <div className="flex items-center gap-4 mt-2 pt-6 border-t border-outline-variant/15 w-full">
              <div className="flex -space-x-2">
                {['👩', '👨', '👩'].map((e, i) => (
                  <div key={i} className="w-10 h-10 rounded-full border-2 border-surface bg-surface-container-high flex items-center justify-center text-lg">{e}</div>
                ))}
              </div>
              <p className="text-sm text-secondary">
                <strong className="text-ink">10,000+</strong> candidates prepped
              </p>
            </div>
          </div>

          {/* CV Upload card */}
          <div className="w-full lg:w-1/2 flex justify-center lg:justify-end">
            <div className="bg-white rounded-xl border border-outline-variant/20 p-6 md:p-8 w-full max-w-md shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgba(6,95,70,0.08)] transition-shadow duration-300 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary-container/5 rounded-bl-full -z-10 transition-transform group-hover:scale-110" />
              <div className="mb-6">
                <h3 className="font-geist font-semibold text-2xl text-ink">Upload your CV</h3>
                <p className="text-base text-secondary mt-1">We&apos;ll tailor the interview to your specific experience.</p>
              </div>
              <Link
                href="/signup"
                className="flex flex-col items-center justify-center w-full h-56 border-2 border-slate-muted/30 border-dashed rounded-lg cursor-pointer bg-surface-container-lowest hover:bg-surface-container-low transition-colors relative overflow-hidden"
              >
                <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, #065F46 1px, transparent 0)', backgroundSize: '16px 16px' }} />
                <div className="flex flex-col items-center justify-center pt-5 pb-6 z-10">
                  <div className="w-16 h-16 mb-4 rounded-full bg-emerald-deep/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <span className="material-symbols-outlined text-4xl text-emerald-deep opacity-80">description</span>
                  </div>
                  <p className="mb-2 text-sm font-semibold text-ink">
                    <span className="text-emerald-deep font-bold">Click to upload</span> or drag and drop
                  </p>
                  <p className="text-xs text-slate-muted">PDF, DOCX, or TXT (MAX. 5MB)</p>
                </div>
              </Link>
              <div className="mt-6 flex items-center gap-3">
                <span className="material-symbols-outlined text-slate-muted text-xl">lock</span>
                <p className="text-xs text-slate-muted flex-1">Your data is secure and never used to train public models.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Features Bento */}
        <section className="w-full bg-surface-container-low py-16 md:py-24 border-y border-outline-variant/10">
          <div className="px-4 md:px-12 max-w-[1280px] mx-auto">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <h2 className="font-geist font-bold text-2xl md:text-3xl text-ink mb-4">Everything you need to succeed</h2>
              <p className="text-lg text-secondary">Our AI doesn&apos;t just listen — it understands, evaluates, and coaches you to deliver your best performance.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Real-time Scoring — wide */}
              <div className="md:col-span-2 bg-white rounded-xl border border-outline-variant/20 p-6 md:p-8 flex flex-col md:flex-row gap-8 items-center relative overflow-hidden group">
                <div className="flex-1 z-10">
                  <div className="w-12 h-12 bg-primary-container/15 rounded-lg flex items-center justify-center mb-6">
                    <span className="material-symbols-outlined text-primary icon-fill text-2xl">speed</span>
                  </div>
                  <h3 className="font-geist font-semibold text-2xl text-ink mb-3">Real-time AI Scoring</h3>
                  <p className="text-base text-secondary">Get instant 0–100 scores across key metrics like clarity, relevance, and confidence as you speak.</p>
                </div>
                <div className="w-full md:w-5/12 h-40 bg-surface-container rounded-lg border border-outline-variant/10 flex items-center justify-center relative shadow-inner z-10">
                  <svg className="w-32 h-32 -rotate-90 transform" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" fill="none" r="40" stroke="#e1e3e4" strokeWidth="8" />
                    <circle cx="50" cy="50" fill="none" r="40" stroke="#10b981" strokeDasharray="251" strokeDashoffset="60" strokeWidth="8" className="transition-all duration-1000 ease-out" />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="font-geist font-bold text-3xl text-emerald-deep">86</span>
                    <span className="text-xs text-slate-muted uppercase tracking-wider">Score</span>
                  </div>
                </div>
                <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-emerald-deep/5 rounded-full blur-3xl z-0" />
              </div>

              {/* Speech Analysis */}
              <div className="md:col-span-1 bg-white rounded-xl border border-outline-variant/20 p-6 flex flex-col relative overflow-hidden">
                <div className="w-10 h-10 bg-amber-light rounded-lg flex items-center justify-center mb-5 z-10">
                  <span className="material-symbols-outlined text-tertiary-container icon-fill text-xl">mic</span>
                </div>
                <h3 className="text-[18px] font-semibold text-ink mb-2 z-10">Speech Analysis</h3>
                <p className="text-base text-secondary mb-6 z-10 flex-grow">Detect filler words, monitor pace, and assess vocal confidence automatically.</p>
                <div className="mt-auto z-10 space-y-2">
                  <div className="flex justify-between items-center bg-surface p-2 rounded border border-outline-variant/20">
                    <span className="text-xs text-slate-muted">Pacing</span>
                    <span className="text-xs text-primary font-semibold">Perfect</span>
                  </div>
                  <div className="flex justify-between items-center bg-surface p-2 rounded border border-outline-variant/20">
                    <span className="text-xs text-slate-muted">Filler Words</span>
                    <span className="text-xs text-error font-semibold">&ldquo;um&rdquo; (3)</span>
                  </div>
                </div>
              </div>

              {/* Adaptive Follow-ups */}
              <div className="md:col-span-1 bg-white rounded-xl border border-outline-variant/20 p-6 flex flex-col relative overflow-hidden">
                <div className="w-10 h-10 bg-secondary-container/30 rounded-lg flex items-center justify-center mb-5 z-10">
                  <span className="material-symbols-outlined text-secondary icon-fill text-xl">forum</span>
                </div>
                <h3 className="text-[18px] font-semibold text-ink mb-2 z-10">Adaptive Follow-ups</h3>
                <p className="text-base text-secondary z-10 mb-6">Dynamic questioning — the AI probes deeper based on your answers, just like a real interview.</p>
                <div className="mt-auto space-y-3 z-10">
                  <div className="bg-surface-container rounded-lg rounded-tl-none p-3 max-w-[85%] border border-outline-variant/10 text-xs text-secondary">
                    Could you elaborate on how you handled the team conflict?
                  </div>
                  <div className="bg-emerald-deep/10 rounded-lg rounded-tr-none p-3 max-w-[85%] ml-auto border border-primary/10 text-xs text-primary">
                    I scheduled a 1-on-1 to understand their perspective...
                  </div>
                </div>
              </div>

              {/* Personalized Feedback — wide */}
              <div className="md:col-span-2 bg-emerald-deep text-white rounded-xl p-6 md:p-8 flex flex-col md:flex-row gap-8 items-center relative overflow-hidden">
                <div className="absolute top-0 right-0 w-full h-full overflow-hidden pointer-events-none opacity-20 z-0">
                  <div className="absolute top-[-20%] right-[-10%] w-64 h-64 rounded-full bg-primary-fixed blur-2xl" />
                  <div className="absolute bottom-[-10%] left-[20%] w-48 h-48 rounded-full bg-inverse-primary blur-2xl" />
                </div>
                <div className="flex-1 z-10">
                  <h3 className="font-geist font-semibold text-2xl text-white mb-3 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary-fixed icon-fill">auto_awesome</span>
                    Personalized Action Plan
                  </h3>
                  <p className="text-base text-white/80 mb-6 max-w-md">
                    Receive a detailed breakdown of your performance with actionable advice on structuring answers using the STAR method.
                  </p>
                  <Link href="/signup" className="inline-block bg-white text-emerald-deep font-semibold text-sm px-5 py-2.5 rounded hover:bg-surface-container-lowest transition-colors">
                    Get Started Free
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="w-full py-16 md:py-24 bg-white">
          <div className="px-4 md:px-12 max-w-[1280px] mx-auto">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <h2 className="font-geist font-bold text-2xl md:text-3xl text-ink mb-4">How it works</h2>
              <p className="text-lg text-secondary">Four simple steps to interview readiness.</p>
            </div>
            <div className="relative">
              <div className="hidden md:block absolute top-12 left-[10%] right-[10%] h-0.5 bg-outline-variant/30 z-0" />
              <div className="grid grid-cols-1 md:grid-cols-4 gap-8 md:gap-4 relative z-10">
                {STEPS.map(s => (
                  <div key={s.n} className="flex flex-col items-center text-center group">
                    <div className="w-24 h-24 bg-surface rounded-full border-2 border-outline-variant/30 flex items-center justify-center mb-6 group-hover:border-primary group-hover:bg-primary-container/10 transition-colors shadow-sm relative">
                      <div className="absolute -top-2 -right-2 w-8 h-8 bg-emerald-deep text-white rounded-full flex items-center justify-center font-bold text-sm shadow-md">{s.n}</div>
                      <span className="material-symbols-outlined text-3xl text-secondary group-hover:text-primary transition-colors">{s.icon}</span>
                    </div>
                    <h4 className="text-[18px] font-semibold text-ink mb-2">{s.title}</h4>
                    <p className="text-sm text-slate-muted max-w-[200px]">{s.desc}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-16 text-center">
              <Link href="/signup" className="inline-block bg-emerald-deep text-white font-semibold text-lg px-8 py-3.5 rounded-lg hover:bg-primary transition-colors shadow-md">
                Start your first session
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-background w-full py-4 px-4 md:px-12 flex flex-col md:flex-row justify-between items-center max-w-[1280px] mx-auto border-t border-outline-variant/15 gap-4 md:gap-0">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-emerald-deep icon-fill text-xl">psychology</span>
          <span className="text-sm font-bold text-emerald-deep">MockPrep</span>
          <span className="text-xs text-slate-muted ml-2">© 2024 MockPrep AI. All rights reserved.</span>
        </div>
        <div className="flex items-center gap-6">
          {['Privacy Policy', 'Terms of Service', 'Support'].map(l => (
            <span key={l} className="text-xs text-slate-muted hover:text-emerald-deep transition-colors cursor-pointer">{l}</span>
          ))}
        </div>
      </footer>
    </div>
  )
}
