'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import QRCode from 'qrcode'
import { createClient } from '@/lib/supabase/client'
import { formatDateTime } from '@/lib/utils/formatting'
import { getBatchExpiryStatus } from '@/lib/utils/compliance'
import type { Database } from '@/types/database'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'

type Batch = Database['public']['Tables']['internal_batches']['Row']

const EXPIRY_CONFIG = {
  expired: { label: 'Scaduto', cls: 'badge--danger' },
  expiring: { label: 'In Scadenza', cls: 'badge--warning' },
  ok: { label: 'Valido', cls: 'badge--success' },
}

export default function LottiPage() {
  const supabase = createClient()
  const [batches, setBatches] = useState<Batch[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null)
  const [qrUrl, setQrUrl] = useState<string>('')
  const qrRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('internal_batches')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)
    setBatches(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const channel = supabase
      .channel('internal-batches-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'internal_batches' },
        (payload: RealtimePostgresChangesPayload<Batch>) => {
          if (payload.eventType === 'INSERT') setBatches(p => [payload.new, ...p])
          else if (payload.eventType === 'UPDATE') setBatches(p => p.map(b => b.id === payload.new.id ? payload.new : b))
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [load])

  const showQR = useCallback(async (batch: Batch) => {
    setSelectedBatch(batch)
    const url = await QRCode.toDataURL(batch.qr_code_token, {
      width: 200,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    })
    setQrUrl(url)
  }, [])

  const printLabel = useCallback(() => {
    window.print()
  }, [])

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">🏷️ Lotti Interni</h1>
          <p className="page-subtitle">Preparazioni interne con etichetta QR — {batches.length} registrati</p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
          <Link href="/lotti/scansiona" className="btn btn--secondary">📷 Scansiona QR</Link>
          <Link href="/lotti/nuovo" className="btn btn--primary">+ Nuovo Lotto</Link>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-12)' }}>
          <div className="spinner" style={{ width: 40, height: 40 }} />
        </div>
      ) : batches.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon">🏷️</div>
          <div className="empty-state__title">Nessun lotto interno</div>
          <p className="empty-state__desc">Crea il primo lotto interno con etichetta QR</p>
          <Link href="/lotti/nuovo" className="btn btn--primary">+ Crea primo lotto</Link>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--space-4)' }}>
          {batches.map((batch) => {
            const status = getBatchExpiryStatus(batch.expires_at)
            const cfg = EXPIRY_CONFIG[status]
            return (
              <div
                key={batch.id}
                className="card"
                style={{ cursor: 'pointer', transition: 'all var(--transition-fast)' }}
                onMouseOver={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-primary)' }}
                onMouseOut={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border)' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-3)' }}>
                  <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 700 }}>{batch.name}</h3>
                  <span className={`badge ${cfg.cls}`}>{cfg.label}</span>
                </div>
                {batch.description && (
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-3)' }}>
                    {batch.description}
                  </p>
                )}
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', marginBottom: 'var(--space-4)' }}>
                  <span>📅 Preparato: {formatDateTime(batch.prepared_at)}</span>
                  <span>⏰ Scade: {formatDateTime(batch.expires_at)}</span>
                  <code style={{ fontSize: '0.7rem', background: 'var(--color-surface-2)', padding: '2px 6px', borderRadius: 4, width: 'fit-content' }}>
                    {batch.qr_code_token.slice(0, 16)}…
                  </code>
                </div>
                <button
                  className="btn btn--secondary btn--sm btn--full"
                  onClick={() => showQR(batch)}
                >
                  🏷️ Mostra Etichetta QR
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* QR Modal */}
      {selectedBatch && (
        <div className="modal-overlay" onClick={() => setSelectedBatch(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal__header">
              <h2 className="modal__title">🏷️ Etichetta QR</h2>
              <button className="modal__close" onClick={() => setSelectedBatch(null)}>×</button>
            </div>

            {/* QR Label - printable */}
            <div ref={qrRef} className="qr-label" style={{ margin: '0 auto', background: 'white', borderRadius: 'var(--radius-lg)' }}>
              <div className="qr-label__title">{selectedBatch.name}</div>
              {selectedBatch.description && (
                <div className="qr-label__info">{selectedBatch.description}</div>
              )}
              {qrUrl && <img src={qrUrl} alt="QR Code" style={{ width: 200, height: 200 }} />}
              <div className="qr-label__info">
                Prep.: {formatDateTime(selectedBatch.prepared_at)}<br />
                Scad.: {formatDateTime(selectedBatch.expires_at)}
              </div>
              <div style={{ fontSize: '0.65rem', color: '#888', fontFamily: 'monospace' }}>
                {selectedBatch.qr_code_token}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-6)', justifyContent: 'flex-end' }}>
              <button className="btn btn--secondary" onClick={() => setSelectedBatch(null)}>Chiudi</button>
              <button className="btn btn--primary" onClick={printLabel}>🖨️ Stampa Etichetta</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
