'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface Stats {
  blastToday: number
  nonCompliantMonth: number
  expiringBatches: number
  staffCount: number
  supplierToday: number
  openNonConformities: number
  tempOutOfRangeToday: number
  checksToday: number
  failedChecksToday: number
}

export default function ManagerPage() {
  const supabase = createClient()
  const [stats, setStats] = useState<Stats | null>(null)
  const [recentLogs, setRecentLogs] = useState<unknown[]>([])
  const [recentNonConformities, setRecentNonConformities] = useState<Record<string, unknown>[]>([])

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
      supabase.from('non_conformities').select('id', { count: 'exact' }).in('status', ['open', 'in_progress']),
      supabase.from('temperature_logs').select('id', { count: 'exact' }).eq('is_compliant', false).gte('recorded_at', `${today}T00:00:00`),
      supabase.from('operational_checks').select('id', { count: 'exact' }).gte('checked_at', `${today}T00:00:00`),
      supabase.from('operational_checks').select('id', { count: 'exact' }).eq('is_compliant', false).gte('checked_at', `${today}T00:00:00`),
      supabase.from('non_conformities').select('*').order('detected_at', { ascending: false }).limit(8),
    ]).then(([blast, nonCompl, expiring, staff, suppliers, logs, openNc, tempKo, checks, failedChecks, recentNc]) => {
      setStats({
        blastToday: blast.count ?? 0,
        nonCompliantMonth: nonCompl.count ?? 0,
        expiringBatches: expiring.count ?? 0,
        staffCount: staff.count ?? 0,
        supplierToday: suppliers.count ?? 0,
        openNonConformities: openNc.count ?? 0,
        tempOutOfRangeToday: tempKo.count ?? 0,
        checksToday: checks.count ?? 0,
        failedChecksToday: failedChecks.count ?? 0,
      })
      setRecentLogs(logs.data ?? [])
      setRecentNonConformities((recentNc.data ?? []) as Record<string, unknown>[])
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
            <Link href="/abbattimento" className="kpi-card kpi-card--primary">
              <div className="kpi-label">Cicli Abbattitore Oggi</div>
              <div className="kpi-value">{stats.blastToday}</div>
            </Link>
            <Link href="/manager/non-conformita" className={`kpi-card kpi-card--${stats.nonCompliantMonth > 0 ? 'danger' : 'success'}`}>
              <div className="kpi-label">Non Conformità (mese)</div>
              <div className="kpi-value">{stats.nonCompliantMonth}</div>
            </Link>
            <Link href="/manager/non-conformita" className={`kpi-card kpi-card--${stats.openNonConformities > 0 ? 'danger' : 'success'}`}>
              <div className="kpi-label">NC Aperte</div>
              <div className="kpi-value">{stats.openNonConformities}</div>
            </Link>
            <Link href="/lotti" className={`kpi-card kpi-card--${stats.expiringBatches > 0 ? 'danger' : 'success'}`}>
              <div className="kpi-label">Lotti in Scadenza 48h</div>
              <div className="kpi-value">{stats.expiringBatches}</div>
            </Link>
            <Link href="/temperature" className={`kpi-card kpi-card--${stats.tempOutOfRangeToday > 0 ? 'danger' : 'success'}`}>
              <div className="kpi-label">Temperature KO Oggi</div>
              <div className="kpi-value">{stats.tempOutOfRangeToday}</div>
            </Link>
            <Link href="/controlli" className={`kpi-card kpi-card--${stats.failedChecksToday > 0 ? 'danger' : 'success'}`}>
              <div className="kpi-label">Controlli Oggi</div>
              <div className="kpi-value">{stats.checksToday}</div>
              <div className="kpi-sub">{stats.failedChecksToday} non conformi</div>
            </Link>
            <Link href="/manager/staff" className="kpi-card kpi-card--info">
              <div className="kpi-label">Staff Attivo</div>
              <div className="kpi-value">{stats.staffCount}</div>
            </Link>
            <Link href="/fornitori" className="kpi-card kpi-card--primary">
              <div className="kpi-label">Fornitori Oggi</div>
              <div className="kpi-value">{stats.supplierToday}</div>
            </Link>
          </div>

          {recentNonConformities.length > 0 && (
            <div style={{ marginBottom: 'var(--space-8)' }}>
              <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, marginBottom: 'var(--space-4)' }}>
                ⚠️ Ultime Non Conformità
              </h2>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Titolo</th>
                      <th>Origine</th>
                      <th>Gravità</th>
                      <th>Stato</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentNonConformities.map((item) => (
                      <tr key={item.id as string}>
                        <td>{new Date(item.detected_at as string).toLocaleString('it-IT')}</td>
                        <td style={{ fontWeight: 600 }}>{item.title as string}</td>
                        <td>{item.source_type as string}</td>
                        <td>{item.severity as string}</td>
                        <td>
                          <span className={`badge ${(item.status as string) === 'closed' ? 'badge--success' : 'badge--warning'}`}>
                            {item.status as string}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

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
