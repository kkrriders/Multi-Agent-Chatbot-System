'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { auth } from '@/lib/api'
import { clearAuth } from '@/lib/auth'
import { toast } from 'sonner'

const NAV_ITEMS = [
  { href: '/dashboard',     label: 'Overview',          icon: 'dashboard' },
  { href: '/interview',     label: 'Start Interview',   icon: 'play_arrow' },
  { href: '/progress',      label: 'Performance',       icon: 'insights' },
  { href: '/achievements',  label: 'Achievements',      icon: 'emoji_events' },
  { href: '/upload',        label: 'CV Analysis',       icon: 'description' },
  { href: '/profile',       label: 'Settings',          icon: 'settings' },
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
      <aside className="hidden md:flex flex-col py-6 bg-surface-container-low border-r border-outline-variant/10 fixed left-0 top-0 bottom-0 h-full w-64 z-40">
        <div className="px-6 mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-deep/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-emerald-deep icon-fill text-xl">psychology</span>
            </div>
            <div>
              <h1 className="font-geist font-bold text-emerald-deep text-lg leading-tight">MockPrep</h1>
              <span className="text-xs text-slate-muted">Interview Coach</span>
            </div>
          </div>
        </div>

        <nav className="flex-1 flex flex-col gap-1 px-2">
          {NAV_ITEMS.map(item => {
            const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 border-l-4 rounded-r-lg transition-all active:scale-95 font-medium text-sm ${
                  active
                    ? 'text-primary font-bold border-primary bg-primary-container/10'
                    : 'text-slate-muted border-transparent hover:bg-surface-container-high hover:text-primary'
                }`}
              >
                <span className={`material-symbols-outlined text-xl ${active ? 'icon-fill' : ''}`}>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="px-4 mt-auto">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-outline-variant/30 rounded-lg text-slate-muted hover:bg-surface-container-lowest hover:text-error transition-colors text-sm shadow-sm"
          >
            <span className="material-symbols-outlined text-base">logout</span>
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile Top Bar */}
      <header className="md:hidden flex justify-between items-center w-full px-4 h-16 bg-surface border-b border-outline-variant/15 fixed top-0 z-50">
        <Link href="/dashboard" className="font-geist font-bold text-emerald-deep text-lg">MockPrep</Link>
        <button className="text-on-surface">
          <span className="material-symbols-outlined">menu</span>
        </button>
      </header>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 w-full bg-surface border-t border-outline-variant/15 flex justify-around items-center h-16 z-50 px-2 shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.05)]">
        {[NAV_ITEMS[0], NAV_ITEMS[1], NAV_ITEMS[2], NAV_ITEMS[3]].map(item => {
          const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
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
