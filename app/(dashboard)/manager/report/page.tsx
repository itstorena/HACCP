'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDate, formatDateTime } from '@/lib/utils/formatting'

export default function ReportPage() {
  const supabase = createClient()
  const [month, setMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [data, setData] = useState<{
    blastLogs: Record<string, unknown>[]
    supplierBatches: Record<string, unknown>[]
    nonCompliant: number
    totalCycles: number
  } | null>(null)
  const [loading, setLoading] = useState(false)

  const loadReport = async () => {
    setLoading(true)
    const [year, mon] = month.split('-').map(Number)
    const start = new Date(year, mon - 1, 1).toISOString()
    const end = new Date(year, mon, 0, 23, 59, 59).toISOString()

    const [blastRes, supplierRes] = await Promise.all([
      supabase
        .from('blast_chiller_logs')
        .select('id, cycle_type, start_time, end_time, start_temp, end_temp, target_time_minutes, is_compliant, corrective_action, operator_id, notes, created_at, internal_batch_id')
        .gte('created_at', start)
        .lte('created_at', end)
        .order('start_time'),
      supabase
        .from('supplier_batches')
        .select('id, product_name, supplier_name, original_lot_code, delivery_date, expiry_date, risk_level, is_compliant, notes, created_at, registered_by')
        .gte('created_at', start)
        .lte('created_at', end)
        .order('created_at'),
    ])

    const blastLogs = (blastRes.data ?? []) as Record<string, unknown>[]
    const supplierBatches = (supplierRes.data ?? []) as Record<string, unknown>[]
    const nonCompliant = blastLogs.filter(l => !l.is_compliant).length

    setData({ blastLogs, supplierBatches, nonCompliant, totalCycles: blastLogs.length })
    setLoading(false)
  }

  const handlePrint = () => window.print()

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">📄 Report HACCP</h1>
          <p className="page-subtitle">Registro mensile per ispezione</p>
        </div>
        {data && (
          <button className="btn btn--primary" onClick={handlePrint}>🖨️ Stampa / PDF</button>
        )}
      </div>

      <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label">Seleziona Mese</label>
            <input
              type="month"
              className="input"
              value={month}
              onChange={e => setMonth(e.target.value)}
              style={{ maxWidth: 220 }}
            />
          </div>
          <button
            className="btn btn--primary"
            onClick={loadReport}
            disabled={loading}
            style={{ marginTop: 'var(--space-5)' }}
          >
            {loading ? <><div className="spinner" style={{ width: 18, height: 18 }} /> Caricamento…</> : '📊 Genera Report'}
          </button>
        </div>
      </div>

      {data && (
        <div id="report-content">
          {/* Summary */}
          <div className="kpi-grid" style={{ marginBottom: 'var(--space-6)' }}>
            <div className="kpi-card kpi-card--primary">
              <div className="kpi-label">Cicli Totali</div>
              <div className="kpi-value">{data.totalCycles}</div>
            </div>
            <div className={`kpi-card kpi-card--${data.nonCompliant > 0 ? 'danger' : 'success'}`}>
              <div className="kpi-label">Non Conformità</div>
              <div className="kpi-value">{data.nonCompliant}</div>
            </div>
            <div className="kpi-card kpi-card--info">
              <div className="kpi-label">Fornitori Registrati</div>
              <div className="kpi-value">{data.supplierBatches.length}</div>
            </div>
          </div>

          {/* Blast Chiller Table */}
          <div style={{ marginBottom: 'var(--space-6)' }}>
            <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, marginBottom: 'var(--space-4)' }}>
              🧊 Registro Abbattitore
            </h2>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Tipo</th>
                    <th>Lotto</th>
                    <th>T. Inizio</th>
                    <th>T. Fine</th>
                    <th>Durata</th>
                    <th>Conformità</th>
                    <th>Operatore</th>
                  </tr>
                </thead>
                <tbody>
                  {data.blastLogs.map((log) => {
                    const duration = log.end_time
                      ? Math.round((new Date(log.end_time as string).getTime() - new Date(log.start_time as string).getTime()) / 60000)
                      : null
                    const op = log.staff_members as Record<string, string> | null
                    return (
                      <tr key={log.id as string}>
                        <td>{formatDateTime(log.start_time as string)}</td>
                        <td>{(log.cycle_type as string) === 'positive_3c' ? '+3°C' : '-18°C'}</td>
                        <td>{((log.internal_batches as Record<string, unknown>)?.name as string) ?? '—'}</td>
                        <td>{log.start_temp ? `${log.start_temp}°C` : '—'}</td>
                        <td>{log.end_temp !== null ? `${log.end_temp}°C` : '—'}</td>
                        <td>{duration !== null ? `${duration} min` : 'In corso'}</td>
                        <td>
                          <span className={`badge ${(log.is_compliant as boolean) ? 'badge--success' : 'badge--danger'}`}>
                            {(log.is_compliant as boolean) ? '✅ Conforme' : '❌ Non Conforme'}
                          </span>
                        </td>
                        <td>{op ? `${op.first_name} ${op.last_name}` : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Suppliers Table */}
          <div>
            <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, marginBottom: 'var(--space-4)' }}>
              📦 Registro Fornitori
            </h2>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Prodotto</th>
                    <th>Fornitore</th>
                    <th>N° Lotto</th>
                    <th>Scadenza</th>
                    <th>Rischio</th>
                    <th>Conformità</th>
                  </tr>
                </thead>
                <tbody>
                  {data.supplierBatches.map((b) => (
                    <tr key={b.id as string}>
                      <td>{formatDate(b.created_at as string)}</td>
                      <td style={{ fontWeight: 600 }}>{b.product_name as string}</td>
                      <td>{b.supplier_name as string}</td>
                      <td><code>{(b.original_lot_code as string) ?? '—'}</code></td>
                      <td>{formatDate(b.expiry_date as string)}</td>
                      <td>
                        <span className={`badge ${(b.risk_level as string) === 'high' ? 'badge--danger' : (b.risk_level as string) === 'medium' ? 'badge--warning' : 'badge--success'}`}>
                          {(b.risk_level as string) === 'high' ? 'Alto' : (b.risk_level as string) === 'medium' ? 'Medio' : 'Basso'}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${(b.is_compliant as boolean) ? 'badge--success' : 'badge--danger'}`}>
                          {(b.is_compliant as boolean) ? '✅ Conforme' : '❌ Non Conforme'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
