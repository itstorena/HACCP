'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useStaffStore } from '@/store/staffStore'
import { useToastStore } from '@/store/toastStore'
import { useEffect } from 'react'
import { getInitials, ROLE_LABELS } from '@/lib/utils/formatting'
import ToastContainer from '@/components/ui/Toast'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: '🏠' },
  { href: '/fornitori', label: 'Fornitori', icon: '📦' },
  { href: '/lotti', label: 'Lotti', icon: '🏷️' },
  { href: '/abbattimento', label: 'Abbattitore', icon: '🧊' },
  { href: '/temperature', label: 'Temperature', icon: '🌡️' },
  { href: '/non-conformita', label: 'NC', icon: '⚠️' },
]

export default function KioskLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { currentStaff, logout, isSessionExpired, updateActivity } = useStaffStore()
  const { toasts } = useToastStore()

  // Protezione route kiosk
  useEffect(() => {
    if (pathname === '/login') return
    if (!currentStaff || isSessionExpired()) {
      logout()
      router.replace('/login')
    }
  }, [pathname, currentStaff, isSessionExpired, logout, router])

  // Reset inattività su interazione
  useEffect(() => {
    const handler = () => updateActivity()
    window.addEventListener('touchstart', handler)
    window.addEventListener('click', handler)
    return () => {
      window.removeEventListener('touchstart', handler)
      window.removeEventListener('click', handler)
    }
  }, [updateActivity])

  const isLoginPage = pathname === '/login'

  if (isLoginPage) {
    return (
      <div className="kiosk-layout">
        {children}
        <ToastContainer toasts={toasts} />
      </div>
    )
  }

  return (
    <div className="kiosk-layout">
      {/* Header */}
      <header className="kiosk-header">
        <div className="kiosk-header__logo">
          <span>🍽️</span>
          HACCP <span>Register</span>
        </div>
        {currentStaff && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>
                {currentStaff.firstName} {currentStaff.lastName}
              </div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                {ROLE_LABELS[currentStaff.role]}
              </div>
            </div>
            <div className="staff-avatar" style={{ width: 44, height: 44, fontSize: 'var(--text-base)' }}>
              {currentStaff.avatarUrl
                ? <img src={currentStaff.avatarUrl} alt="" />
                : getInitials(currentStaff.firstName, currentStaff.lastName)
              }
            </div>
            <button
              className="btn btn--ghost btn--sm"
              onClick={() => { logout(); router.replace('/login') }}
              title="Esci"
            >
              🚪
            </button>
          </div>
        )}
      </header>

      {/* Main content */}
      <main className="kiosk-main">
        {children}
      </main>

      {/* Bottom navigation */}
      <nav className="kiosk-nav">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`kiosk-nav-item ${pathname.startsWith(item.href) ? 'kiosk-nav-item--active' : ''}`}
          >
            <span style={{ fontSize: '1.5rem' }}>{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>

      <ToastContainer toasts={toasts} />
    </div>
  )
}
