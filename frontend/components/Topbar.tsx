'use client'

import { getCachedUser } from '@/lib/auth'

interface Props {
  title?: string
  showSearch?: boolean
}

export function Topbar({ title, showSearch = false }: Props) {
  const user = getCachedUser()
  const initials = (user?.fullName || user?.email || '?').trim().charAt(0).toUpperCase()

  return (
    <header className="hidden md:flex justify-between items-center px-6 h-16 glass-nav border-b border-outline-variant/10 fixed top-0 right-0 w-[calc(100%-16rem)] z-30">
      {title ? (
        <h2 className="font-geist font-bold text-xl text-primary">{title}</h2>
      ) : (
        <div />
      )}

      <div className="flex items-center gap-4">
        {showSearch && (
          <div className="relative focus-within:ring-2 focus-within:ring-secondary/50 rounded-full bg-surface-container-lowest border border-outline-variant/50 flex items-center px-2 py-1">
            <span className="material-symbols-outlined text-on-surface-variant text-sm mr-1">search</span>
            <input
              type="text"
              placeholder="Search..."
              className="bg-transparent border-none focus:ring-0 focus:outline-none text-sm text-on-surface w-48"
            />
          </div>
        )}
        <button className="text-on-surface-variant hover:bg-surface-container-highest/30 rounded-full transition-all p-2" aria-label="Notifications">
          <span className="material-symbols-outlined">notifications</span>
        </button>
        <div className="w-8 h-8 rounded-full overflow-hidden border border-outline-variant/20 flex items-center justify-center bg-primary-container/20 text-on-primary-container text-xs font-bold">
          {user?.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatarUrl} alt="User avatar" className="w-full h-full object-cover" />
          ) : (
            initials
          )}
        </div>
      </div>
    </header>
  )
}
