'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import ToastContainer from '@/components/ui/Toast'
import { useToastStore } from '@/store/toastStore'

const navItems = [
  { href: '/manager', label: 'Dashboard', icon: '📊', exact: true },
  { href: '/manager/staff', label: 'Staff', icon: '👤' },
  { href: '/manager/report', label: 'Report HACCP', icon: '📄' },
]

export default function ManagerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { toasts } = useToastStore()

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
          <div style={{ marginTop: 'auto', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--color-border)' }}>
            <Link href="/login" className="sidebar__link">
              <span>🚪</span>
              Torna al Kiosk
            </Link>
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
