'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { auth } from '@/lib/api'
import { clearAuth } from '@/lib/auth'
import { toast } from 'sonner'
import { ThemeToggle } from '@/components/ThemeToggle'

const NAV_ITEMS = [
  { href: '/dashboard',              label: 'Overview',          icon: 'dashboard' },
  { href: '/practice/coding',        label: 'Practice',          icon: 'code',        activePrefix: '/practice' },
  { href: '/progress',               label: 'Performance',       icon: 'insights' },
  { href: '/achievements',           label: 'Achievements',      icon: 'emoji_events' },
  { href: '/upload',                 label: 'CV Analysis',       icon: 'description' },
  { href: '/profile',                label: 'Settings',          icon: 'settings' },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()

  const handleLogout = async () => {
    try { await auth.logout() } catch { /* ignore */ }
    clearAuth()
    router.push('/login')
    toast.success('Signed out')
  }

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col py-6 px-4 glass-nav border-r border-outline-variant/10 shadow-sm fixed left-0 top-0 bottom-0 h-full w-64 z-40">
        <div className="px-2 mb-10">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-emerald-deep/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-emerald-deep icon-fill text-xl">psychology</span>
            </div>
            <div>
              <h1 className="font-geist font-bold text-emerald-deep text-lg leading-tight">MockPrep</h1>
              <span className="text-[11px] font-semibold text-slate-muted uppercase tracking-wider">AI Interview Coach</span>
            </div>
          </div>
        </div>

        <nav className="flex-1 flex flex-col gap-2">
          {NAV_ITEMS.map(item => {
            const active = pathname === item.href || (item.href !== '/dashboard' && (item.activePrefix ? pathname.startsWith(item.activePrefix) : pathname.startsWith(item.href)))
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors duration-200 active:scale-95 text-sm ${
                  active
                    ? 'bg-secondary-container/20 text-on-secondary-container font-semibold'
                    : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high/50'
                }`}
              >
                <span className={`material-symbols-outlined text-xl ${active ? 'icon-fill' : ''}`}>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="mt-auto space-y-4">
          <Link
            href="/interview"
            className="w-full flex items-center justify-center gap-2 bg-primary text-on-primary text-sm font-semibold py-2 rounded-xl hover:brightness-90 hover:scale-[1.02] hover:shadow-[0_4px_15px_rgba(0,0,0,0.2)] transition-all duration-300"
          >
            <span className="material-symbols-outlined text-base">play_arrow</span>
            Start Practice
          </Link>
          <div className="flex items-center gap-2 pt-4 border-t border-outline-variant/10">
            <button
              onClick={handleLogout}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-surface-container-lowest border border-outline-variant/30 rounded-lg text-slate-muted hover:bg-surface-container-low hover:text-error transition-colors text-sm shadow-sm"
            >
              <span className="material-symbols-outlined text-base">logout</span>
              Sign Out
            </button>
            <ThemeToggle />
          </div>
        </div>
      </aside>

      {/* Mobile Top Bar */}
      <header className="md:hidden flex justify-between items-center w-full px-4 h-16 glass-nav border-b border-outline-variant/10 fixed top-0 z-50">
        <Link href="/dashboard" className="font-geist font-bold text-emerald-deep text-lg">MockPrep</Link>
        <button className="text-on-surface">
          <span className="material-symbols-outlined">menu</span>
        </button>
      </header>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 w-full glass-nav border-t border-outline-variant/10 flex justify-around items-center h-16 z-50 px-2 shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.05)]">
        {NAV_ITEMS.slice(0, 4).map(item => {
          const active = pathname === item.href || (item.href !== '/dashboard' && (item.activePrefix ? pathname.startsWith(item.activePrefix) : pathname.startsWith(item.href)))
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-1 w-16 transition-colors ${active ? 'text-primary' : 'text-slate-muted hover:text-primary'}`}
            >
              <span className={`material-symbols-outlined ${active ? 'icon-fill' : ''}`}>{item.icon}</span>
              <span className="text-[10px] font-medium">{item.label.split(' ')[0]}</span>
            </Link>
          )
        })}
      </nav>
    </>
  )
}
