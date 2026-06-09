'use client'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils/formatting'
import { RISK_LABELS } from '@/lib/utils/formatting'
import type { Database } from '@/types/database'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'

type Batch = Database['public']['Tables']['supplier_batches']['Row']

const RISK_CLASS: Record<string, string> = {
  high: 'badge--danger',
  medium: 'badge--warning',
  low: 'badge--success',
}

export default function FornitoriPage() {
  const supabase = createClient()
  const [batches, setBatches] = useState<Batch[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all')

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('supplier_batches')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)
    setBatches(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const channel = supabase
      .channel('supplier-batches-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'supplier_batches' },
        (payload: RealtimePostgresChangesPayload<Batch>) => {
          if (payload.eventType === 'INSERT') {
            setBatches(prev => [payload.new, ...prev])
          } else if (payload.eventType === 'UPDATE') {
            setBatches(prev => prev.map(b => b.id === payload.new.id ? payload.new : b))
          } else if (payload.eventType === 'DELETE') {
            setBatches(prev => prev.filter(b => b.id !== payload.old.id))
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [load])

  const filtered = filter === 'all' ? batches : batches.filter(b => b.risk_level === filter)

  const isExpiringSoon = (date: string) => {
    const diff = new Date(date).getTime() - Date.now()
    return diff > 0 && diff < 3 * 24 * 3600000
  }
  const isExpired = (date: string) => new Date(date).getTime() < Date.now()

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">📦 Fornitori</h1>
          <p className="page-subtitle">Tracciabilità lotti in ingresso — {batches.length} registrati</p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <div className="realtime-dot" />
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>Live</span>
          </div>
          <Link href="/fornitori/nuovo" className="btn btn--primary">
            + Nuovo Fornitore
          </Link>
        </div>
      </div>

      {/* Filtri */}
      <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-5)', flexWrap: 'wrap' }}>
        {(['all', 'high', 'medium', 'low'] as const).map(f => (
          <button
            key={f}
            className={`btn btn--sm ${filter === f ? 'btn--primary' : 'btn--secondary'}`}
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? 'Tutti' : RISK_LABELS[f]}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-12)' }}>
          <div className="spinner" style={{ width: 40, height: 40 }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon">📦</div>
          <div className="empty-state__title">Nessun lotto registrato</div>
          <p className="empty-state__desc">Inizia registrando il primo lotto fornitore</p>
          <Link href="/fornitori/nuovo" className="btn btn--primary">
            + Registra primo lotto
          </Link>
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Prodotto</th>
                <th>Fornitore</th>
                <th>N° Lotto</th>
                <th>Consegna</th>
                <th>Scadenza</th>
                <th>Rischio</th>
                <th>Stato</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((b) => (
                <tr key={b.id}>
                  <td style={{ fontWeight: 600 }}>{b.product_name}</td>
                  <td style={{ color: 'var(--color-text-muted)' }}>{b.supplier_name}</td>
                  <td>
                    <code style={{ fontSize: 'var(--text-xs)', background: 'var(--color-surface-2)', padding: '2px 6px', borderRadius: 4 }}>
                      {b.original_lot_code ?? '—'}
                    </code>
                  </td>
                  <td style={{ color: 'var(--color-text-muted)' }}>{formatDate(b.delivery_date)}</td>
                  <td style={{ color: isExpired(b.expiry_date) ? 'var(--color-danger)' : isExpiringSoon(b.expiry_date) ? 'var(--color-warning)' : undefined }}>
                    {formatDate(b.expiry_date)}
                    {isExpired(b.expiry_date) && ' ⚠️'}
                    {isExpiringSoon(b.expiry_date) && !isExpired(b.expiry_date) && ' ⏰'}
                  </td>
                  <td>
                    <span className={`badge ${RISK_CLASS[b.risk_level]}`}>
                      {RISK_LABELS[b.risk_level]}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${b.is_compliant ? 'badge--success' : 'badge--danger'}`}>
                      {b.is_compliant ? 'Conforme' : 'Non Conforme'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
