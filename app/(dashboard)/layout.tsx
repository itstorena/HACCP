'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import ToastContainer from '@/components/ui/Toast'
import { useToastStore } from '@/store/toastStore'
import { createClient } from '@/lib/supabase/client'

const navItems = [
  { href: '/manager', label: 'Dashboard', icon: '📊', exact: true },
  { href: '/manager/piano-haccp', label: 'Piano HACCP', icon: '📋' },
  { href: '/manager/non-conformita', label: 'Non Conformità', icon: '⚠️' },
  { href: '/manager/report', label: 'Report HACCP', icon: '📄' },
  { href: '/manager/staff', label: 'Staff', icon: '👤' },
]

export default function ManagerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const { toasts } = useToastStore()

  const isLogin = pathname === '/manager/login'

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/manager/login')
    router.refresh()
  }

  if (isLogin) {
    return (
      <div style={{
        minHeight: '100svh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--color-bg)',
        color: 'var(--color-text)',
      }}>
        {children}
        <ToastContainer toasts={toasts} />
      </div>
    )
  }

  return (
    <div className="dashboard-layout">
      <aside className="sidebar">
        <div className="sidebar__logo">
          🍽️ HACCP <span>Manager</span>
        </div>
        <nav className="sidebar__nav">
          {navItems.map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`sidebar__link ${active ? 'sidebar__link--active' : ''}`}
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
            )
          })}
          
          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <button
              onClick={handleLogout}
              className="sidebar__link"
              style={{
                background: 'transparent',
                border: 'none',
                width: '100%',
                textAlign: 'left',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: 'inherit',
                color: 'var(--color-danger)',
              }}
            >
              <span>🚪</span>
              Logout
            </button>
            <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-2)' }}>
              <Link href="/login" className="sidebar__link">
                <span>🖥️</span>
                Torna al Kiosk
              </Link>
            </div>
          </div>
        </nav>
      </aside>
      <main className="dashboard-main">
        {children}
      </main>
      <ToastContainer toasts={toasts} />
    </div>
  )
}
