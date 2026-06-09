'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils/formatting'

interface Stats {
  blastToday: number
  nonCompliantMonth: number
  expiringBatches: number
  staffCount: number
  supplierToday: number
}

export default function ManagerPage() {
  const supabase = createClient()
  const [stats, setStats] = useState<Stats | null>(null)
  const [recentLogs, setRecentLogs] = useState<unknown[]>([])

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0]
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
    const in48h = new Date(Date.now() + 48 * 3600000).toISOString()

    Promise.all([
      supabase.from('blast_chiller_logs').select('id', { count: 'exact' }).gte('created_at', `${today}T00:00:00`),
      supabase.from('blast_chiller_logs').select('id', { count: 'exact' }).eq('is_compliant', false).gte('created_at', monthStart),
      supabase.from('internal_batches').select('id', { count: 'exact' }).lte('expires_at', in48h).eq('is_active', true),
      supabase.from('staff_members').select('id', { count: 'exact' }).eq('is_active', true),
      supabase.from('supplier_batches').select('id', { count: 'exact' }).gte('created_at', `${today}T00:00:00`),
      supabase.from('blast_chiller_logs').select('*, internal_batches(name)').order('created_at', { ascending: false }).limit(10),
    ]).then(([blast, nonCompl, expiring, staff, suppliers, logs]) => {
      setStats({
        blastToday: blast.count ?? 0,
        nonCompliantMonth: nonCompl.count ?? 0,
        expiringBatches: expiring.count ?? 0,
        staffCount: staff.count ?? 0,
        supplierToday: suppliers.count ?? 0,
      })
      setRecentLogs(logs.data ?? [])
    })
  }, [])

  const now = new Date()

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">📊 Dashboard Manager</h1>
          <p className="page-subtitle">
            {now.toLocaleDateString('it-IT', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </div>

      {!stats ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-12)' }}>
          <div className="spinner" style={{ width: 40, height: 40 }} />
        </div>
      ) : (
        <>
          <div className="kpi-grid" style={{ marginBottom: 'var(--space-8)' }}>
            <div className="kpi-card kpi-card--primary">
              <div className="kpi-label">Cicli Abbattitore Oggi</div>
              <div className="kpi-value">{stats.blastToday}</div>
            </div>
            <div className={`kpi-card kpi-card--${stats.nonCompliantMonth > 0 ? 'danger' : 'success'}`}>
              <div className="kpi-label">Non Conformità (mese)</div>
              <div className="kpi-value">{stats.nonCompliantMonth}</div>
            </div>
            <div className={`kpi-card kpi-card--${stats.expiringBatches > 0 ? 'danger' : 'success'}`}>
              <div className="kpi-label">Lotti in Scadenza 48h</div>
              <div className="kpi-value">{stats.expiringBatches}</div>
            </div>
            <div className="kpi-card kpi-card--info">
              <div className="kpi-label">Staff Attivo</div>
              <div className="kpi-value">{stats.staffCount}</div>
            </div>
            <div className="kpi-card kpi-card--primary">
              <div className="kpi-label">Fornitori Oggi</div>
              <div className="kpi-value">{stats.supplierToday}</div>
            </div>
          </div>

          {/* Ultimi log */}
          <div>
            <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, marginBottom: 'var(--space-4)' }}>
              🧊 Ultimi Cicli Abbattitore
            </h2>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Tipo</th>
                    <th>Lotto</th>
                    <th>Inizio</th>
                    <th>T. Iniziale</th>
                    <th>T. Finale</th>
                    <th>Conformità</th>
                  </tr>
                </thead>
                <tbody>
                  {(recentLogs as Record<string, unknown>[]).map((log) => (
                    <tr key={log.id as string}>
                      <td>{(log.cycle_type as string) === 'positive_3c' ? '🌡️ +3°C' : '❄️ -18°C'}</td>
                      <td style={{ color: 'var(--color-text-muted)' }}>
                        {((log.internal_batches as Record<string, unknown>)?.name as string) ?? '—'}
                      </td>
                      <td style={{ color: 'var(--color-text-muted)' }}>
                        {new Date(log.start_time as string).toLocaleString('it-IT')}
                      </td>
                      <td>{log.start_temp ? `+${log.start_temp}°C` : '—'}</td>
                      <td>{log.end_temp !== null ? `${log.end_temp}°C` : '—'}</td>
                      <td>
                        <span className={`badge ${(log.is_compliant as boolean) ? 'badge--success' : 'badge--danger'}`}>
                          {(log.is_compliant as boolean) ? 'Conforme' : 'Non Conforme'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
