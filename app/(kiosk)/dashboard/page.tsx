'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useStaffStore } from '@/store/staffStore'
import { formatDate, formatDateTime } from '@/lib/utils/formatting'
import { getBatchExpiryStatus } from '@/lib/utils/compliance'

interface DashboardStats {
  activeBlastCycles: number
  expiringBatches: number
  todaySuppliers: number
  nonCompliantToday: number
}

export default function DashboardPage() {
  const { currentStaff } = useStaffStore()
  const supabase = createClient()
  const [stats, setStats] = useState<DashboardStats>({
    activeBlastCycles: 0,
    expiringBatches: 0,
    todaySuppliers: 0,
    nonCompliantToday: 0,
  })
  const [loading, setLoading] = useState(true)
  const now = new Date()

  useEffect(() => {
    const load = async () => {
      const today = new Date().toISOString().split('T')[0]
      const in48h = new Date(Date.now() + 48 * 3600000).toISOString()

      const [blastRes, batchRes, supplierRes, nonComplRes] = await Promise.all([
        supabase.from('blast_chiller_logs').select('id', { count: 'exact' }).is('end_time', null),
        supabase.from('internal_batches').select('expires_at').eq('is_active', true).lte('expires_at', in48h),
        supabase.from('supplier_batches').select('id', { count: 'exact' }).gte('created_at', `${today}T00:00:00`),
        supabase.from('blast_chiller_logs').select('id', { count: 'exact' }).eq('is_compliant', false).gte('created_at', `${today}T00:00:00`),
      ])

      setStats({
        activeBlastCycles: blastRes.count ?? 0,
        expiringBatches: batchRes.data?.length ?? 0,
        todaySuppliers: supplierRes.count ?? 0,
        nonCompliantToday: nonComplRes.count ?? 0,
      })
      setLoading(false)
    }
    load()
  }, [])

  const quickActions = [
    { href: '/fornitori/nuovo', icon: '📦', label: 'Nuovo Fornitore', color: 'var(--color-info)' },
    { href: '/lotti/nuovo', icon: '🏷️', label: 'Nuovo Lotto', color: 'var(--color-success)' },
    { href: '/abbattimento/nuovo', icon: '🧊', label: 'Avvia Abbattimento', color: 'var(--color-primary)' },
    { href: '/lotti/scansiona', icon: '📷', label: 'Scansiona QR', color: 'var(--color-warning)' },
  ]

  return (
    <div>
      {/* Welcome */}
      <div style={{ marginBottom: 'var(--space-8)' }}>
        <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 800 }}>
          Buongiorno, {currentStaff?.firstName}! 👋
        </h1>
        <p style={{ color: 'var(--color-text-muted)', marginTop: 'var(--space-1)' }}>
          {now.toLocaleDateString('it-IT', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* KPI Cards */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-12)' }}>
          <div className="spinner" style={{ width: 40, height: 40 }} />
        </div>
      ) : (
        <div className="kpi-grid" style={{ marginBottom: 'var(--space-8)' }}>
          <div className={`kpi-card kpi-card--${stats.activeBlastCycles > 0 ? 'primary' : 'success'}`}>
            <div className="kpi-label">Cicli Attivi</div>
            <div className="kpi-value">{stats.activeBlastCycles}</div>
            <div className="kpi-sub">abbattitore in corso</div>
          </div>
          <div className={`kpi-card kpi-card--${stats.expiringBatches > 0 ? 'danger' : 'success'}`}>
            <div className="kpi-label">Lotti in Scadenza</div>
            <div className="kpi-value">{stats.expiringBatches}</div>
            <div className="kpi-sub">nelle prossime 48h</div>
          </div>
          <div className="kpi-card kpi-card--info">
            <div className="kpi-label">Fornitori Oggi</div>
            <div className="kpi-value">{stats.todaySuppliers}</div>
            <div className="kpi-sub">registrati oggi</div>
          </div>
          <div className={`kpi-card kpi-card--${stats.nonCompliantToday > 0 ? 'danger' : 'success'}`}>
            <div className="kpi-label">Non Conformi</div>
            <div className="kpi-value">{stats.nonCompliantToday}</div>
            <div className="kpi-sub">cicli oggi</div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div>
        <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, marginBottom: 'var(--space-4)' }}>
          Azioni Rapide
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 'var(--space-4)' }}>
          {quickActions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 'var(--space-3)',
                padding: 'var(--space-6)',
                background: 'var(--color-surface)',
                border: `2px solid var(--color-border)`,
                borderRadius: 'var(--radius-xl)',
                textDecoration: 'none',
                transition: 'all var(--transition-fast)',
                cursor: 'pointer',
              }}
              onMouseOver={(e) => {
                const el = e.currentTarget as HTMLElement
                el.style.borderColor = action.color
                el.style.transform = 'translateY(-4px)'
                el.style.boxShadow = `0 8px 24px ${action.color}33`
              }}
              onMouseOut={(e) => {
                const el = e.currentTarget as HTMLElement
                el.style.borderColor = 'var(--color-border)'
                el.style.transform = 'none'
                el.style.boxShadow = 'none'
              }}
            >
              <span style={{ fontSize: '2rem' }}>{action.icon}</span>
              <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text)', textAlign: 'center' }}>
                {action.label}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
