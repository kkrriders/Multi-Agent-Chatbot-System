import Link from 'next/link'

export function GuestLimitPrompt({ message }: { message?: string }) {
  return (
    <div className="rounded-xl border border-primary/20 bg-primary-container/10 p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
      <span className="material-symbols-outlined text-primary text-2xl shrink-0">lock</span>
      <div className="flex-1">
        <p className="text-sm font-semibold text-on-surface">You&apos;ve used your free tries</p>
        <p className="text-xs text-slate-muted mt-0.5">{message || 'Create a free account to keep practicing — unlimited sessions, full history, and progress tracking.'}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Link href="/login" className="text-xs font-semibold text-primary px-3 py-2 rounded-lg hover:bg-primary-container/20 transition-colors">
          Log in
        </Link>
        <Link href="/signup" className="text-xs font-semibold bg-primary text-on-primary px-4 py-2 rounded-lg hover:opacity-90 transition-opacity">
          Sign up free
        </Link>
      </div>
    </div>
  )
}
