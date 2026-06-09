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
  const [editingBatch, setEditingBatch] = useState<Batch | null>(null)
  const [qrUrl, setQrUrl] = useState<string>('')
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    expires_at: '',
    allergen_notes: '',
    quantity: '',
    unit: '',
    batch_status: 'valid' as Batch['batch_status'],
    is_active: true,
  })
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

  const openEditBatch = (batch: Batch) => {
    setEditingBatch(batch)
    setEditForm({
      name: batch.name,
      description: batch.description ?? '',
      expires_at: batch.expires_at.slice(0, 16),
      allergen_notes: batch.allergen_notes ?? '',
      quantity: batch.quantity === null ? '' : String(batch.quantity),
      unit: batch.unit ?? '',
      batch_status: batch.batch_status,
      is_active: batch.is_active,
    })
  }

  const handleUpdateBatch = async () => {
    if (!editingBatch || !editForm.name.trim() || !editForm.expires_at) return

    const quantity = editForm.quantity === '' ? null : Number(editForm.quantity)
    if (quantity !== null && !Number.isFinite(quantity)) return

    const { error } = await (supabase.from('internal_batches') as any)
      .update({
        name: editForm.name.trim(),
        description: editForm.description.trim() || null,
        expires_at: new Date(editForm.expires_at).toISOString(),
        allergen_notes: editForm.allergen_notes.trim() || null,
        quantity,
        unit: editForm.unit.trim() || null,
        batch_status: editForm.batch_status,
        is_active: editForm.is_active,
      })
      .eq('id', editingBatch.id)

    if (!error) {
      setEditingBatch(null)
      await load()
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">🏷️ Lotti Interni</h1>
          <p className="page-subtitle">Preparazioni interne con etichetta QR — {batches.length} registrati</p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
          <button className="btn btn--secondary" onClick={() => window.print()}>🖨️ Stampa registro</button>
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
                  {(batch.quantity || batch.unit) && (
                    <span>⚖️ Quantità: {batch.quantity ?? '—'} {batch.unit ?? ''}</span>
                  )}
                  {batch.source_supplier_batch_ids.length > 0 && (
                    <span>🔗 Materie prime collegate: {batch.source_supplier_batch_ids.length}</span>
                  )}
                  {batch.allergen_notes && (
                    <span>⚠️ Allergeni: {batch.allergen_notes}</span>
                  )}
                  <code style={{ fontSize: '0.7rem', background: 'var(--color-surface-2)', padding: '2px 6px', borderRadius: 4, width: 'fit-content' }}>
                    {batch.qr_code_token.slice(0, 16)}…
                  </code>
                </div>
                <div className="no-print" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)' }}>
                  <button
                    className="btn btn--secondary btn--sm"
                    onClick={() => showQR(batch)}
                  >
                    🏷️ Etichetta
                  </button>
                  <button
                    className="btn btn--secondary btn--sm"
                    onClick={() => openEditBatch(batch)}
                  >
                    Modifica
                  </button>
                </div>
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
                {selectedBatch.allergen_notes && (
                  <>
                    <br />
                    Allergeni: {selectedBatch.allergen_notes}
                  </>
                )}
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

      {editingBatch && (
        <div className="modal-overlay" onClick={() => setEditingBatch(null)}>
          <div className="modal" onClick={event => event.stopPropagation()}>
            <div className="modal__header">
              <h2 className="modal__title">Modifica lotto interno</h2>
              <button className="modal__close" onClick={() => setEditingBatch(null)}>×</button>
            </div>

            <div className="form-group">
              <label className="form-label">Nome</label>
              <input className="input" value={editForm.name} onChange={event => setEditForm(prev => ({ ...prev, name: event.target.value }))} />
            </div>

            <div className="form-group" style={{ marginTop: 'var(--space-4)' }}>
              <label className="form-label">Descrizione</label>
              <textarea className="input" rows={3} value={editForm.description} onChange={event => setEditForm(prev => ({ ...prev, description: event.target.value }))} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginTop: 'var(--space-4)' }}>
              <div className="form-group">
                <label className="form-label">Scadenza</label>
                <input type="datetime-local" className="input" value={editForm.expires_at} onChange={event => setEditForm(prev => ({ ...prev, expires_at: event.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Stato</label>
                <select className="input" value={editForm.batch_status} onChange={event => setEditForm(prev => ({ ...prev, batch_status: event.target.value as Batch['batch_status'] }))}>
                  <option value="valid">Valido</option>
                  <option value="blocked">Bloccato</option>
                  <option value="used">Usato</option>
                  <option value="discarded">Scartato</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-4)', marginTop: 'var(--space-4)' }}>
              <div className="form-group">
                <label className="form-label">Quantità</label>
                <input type="number" step="0.01" className="input" value={editForm.quantity} onChange={event => setEditForm(prev => ({ ...prev, quantity: event.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Unità</label>
                <input className="input" value={editForm.unit} onChange={event => setEditForm(prev => ({ ...prev, unit: event.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Attivo</label>
                <select className="input" value={String(editForm.is_active)} onChange={event => setEditForm(prev => ({ ...prev, is_active: event.target.value === 'true' }))}>
                  <option value="true">Sì</option>
                  <option value="false">No</option>
                </select>
              </div>
            </div>

            <div className="form-group" style={{ marginTop: 'var(--space-4)' }}>
              <label className="form-label">Allergeni</label>
              <textarea className="input" rows={2} value={editForm.allergen_notes} onChange={event => setEditForm(prev => ({ ...prev, allergen_notes: event.target.value }))} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'var(--space-6)' }}>
              <button className="btn btn--secondary" onClick={() => setEditingBatch(null)}>Annulla</button>
              <button className="btn btn--primary" onClick={handleUpdateBatch}>Salva modifiche</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
