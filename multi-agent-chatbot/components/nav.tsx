'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { auth } from '@/lib/api'
import { BrainCircuit, UploadCloud, Play, BarChart2, Trophy, BookOpen, LogOut } from 'lucide-react'

const NAV_ITEMS = [
  { href: '/dashboard',    label: 'Dashboard',  icon: BrainCircuit },
  { href: '/upload',       label: 'CV',         icon: UploadCloud },
  { href: '/interview',    label: 'Interview',  icon: Play },
  { href: '/progress',     label: 'Progress',   icon: BarChart2 },
  { href: '/leaderboard',  label: 'Rankings',   icon: Trophy },
  { href: '/questions',    label: 'Questions',  icon: BookOpen },
]

export function Nav() {
  const pathname = usePathname()
  const router = useRouter()

  const handleLogout = async () => {
    try { await auth.logout() } catch { /* ignore */ }
    router.push('/login')
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-2 font-bold text-lg">
          <BrainCircuit className="w-5 h-5 text-primary" />
          MockPrep
        </Link>

        <div className="flex items-center gap-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
                pathname.startsWith(href)
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{label}</span>
            </Link>
          ))}

          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors ml-2"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </nav>
  )
}
