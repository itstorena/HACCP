'use client'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils/formatting'
import { RISK_LABELS, formatTemp } from '@/lib/utils/formatting'
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
  const [editingBatch, setEditingBatch] = useState<Batch | null>(null)
  const [editForm, setEditForm] = useState({
    product_name: '',
    supplier_name: '',
    original_lot_code: '',
    document_number: '',
    delivery_date: '',
    expiry_date: '',
    received_temp: '',
    quantity: '',
    unit: '',
    risk_level: 'medium' as Batch['risk_level'],
    packaging_ok: true,
    label_ok: true,
    accepted: true,
    is_compliant: true,
    rejection_reason: '',
    notes: '',
  })

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

  const openEditBatch = (batch: Batch) => {
    setEditingBatch(batch)
    setEditForm({
      product_name: batch.product_name,
      supplier_name: batch.supplier_name,
      original_lot_code: batch.original_lot_code ?? '',
      document_number: batch.document_number ?? '',
      delivery_date: batch.delivery_date,
      expiry_date: batch.expiry_date,
      received_temp: batch.received_temp === null ? '' : String(batch.received_temp),
      quantity: batch.quantity === null ? '' : String(batch.quantity),
      unit: batch.unit ?? '',
      risk_level: batch.risk_level,
      packaging_ok: batch.packaging_ok,
      label_ok: batch.label_ok,
      accepted: batch.accepted,
      is_compliant: batch.is_compliant,
      rejection_reason: batch.rejection_reason ?? '',
      notes: batch.notes ?? '',
    })
  }

  const handleUpdateBatch = async () => {
    if (!editingBatch) return
    if (!editForm.product_name.trim() || !editForm.supplier_name.trim() || !editForm.delivery_date || !editForm.expiry_date) return

    const receivedTemp = editForm.received_temp === '' ? null : Number(editForm.received_temp)
    const quantity = editForm.quantity === '' ? null : Number(editForm.quantity)
    if (receivedTemp !== null && !Number.isFinite(receivedTemp)) return
    if (quantity !== null && !Number.isFinite(quantity)) return

    const computedCompliance = editForm.is_compliant && editForm.packaging_ok && editForm.label_ok && editForm.accepted
    const { error } = await (supabase.from('supplier_batches') as any)
      .update({
        product_name: editForm.product_name.trim(),
        supplier_name: editForm.supplier_name.trim(),
        original_lot_code: editForm.original_lot_code.trim() || null,
        document_number: editForm.document_number.trim() || null,
        delivery_date: editForm.delivery_date,
        expiry_date: editForm.expiry_date,
        received_temp: receivedTemp,
        quantity,
        unit: editForm.unit.trim() || null,
        risk_level: editForm.risk_level,
        packaging_ok: editForm.packaging_ok,
        label_ok: editForm.label_ok,
        accepted: editForm.accepted,
        is_compliant: computedCompliance,
        rejection_reason: editForm.rejection_reason.trim() || null,
        notes: editForm.notes.trim() || null,
      })
      .eq('id', editingBatch.id)

    if (error) return
    setEditingBatch(null)
    await load()
  }

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
          <button className="btn btn--secondary" onClick={() => window.print()}>
            🖨️ Stampa registro
          </button>
          <Link href="/fornitori/ocr" className="btn btn--secondary">
            📄 OCR Fattura/DDT
          </Link>
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
                <th>DDT</th>
                <th>Quantità</th>
                <th>T. Ric.</th>
                <th>Consegna</th>
                <th>Scadenza</th>
                <th>Rischio</th>
                <th>Stato</th>
                <th className="no-print">Azioni</th>
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
                  <td style={{ color: 'var(--color-text-muted)' }}>{b.document_number ?? '—'}</td>
                  <td>{b.quantity ?? '—'} {b.unit ?? ''}</td>
                  <td>{formatTemp(b.received_temp)}</td>
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
                      {b.accepted === false ? 'Rifiutato' : b.is_compliant ? 'Conforme' : 'Non Conforme'}
                    </span>
                  </td>
                  <td className="no-print">
                    <button className="btn btn--secondary btn--sm" onClick={() => openEditBatch(b)}>
                      Modifica
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editingBatch && (
        <div className="modal-overlay" onClick={() => setEditingBatch(null)}>
          <div className="modal" onClick={event => event.stopPropagation()}>
            <div className="modal__header">
              <h2 className="modal__title">Modifica lotto fornitore</h2>
              <button className="modal__close" onClick={() => setEditingBatch(null)}>×</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
              <div className="form-group">
                <label className="form-label">Prodotto</label>
                <input className="input" value={editForm.product_name} onChange={event => setEditForm(prev => ({ ...prev, product_name: event.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Fornitore</label>
                <input className="input" value={editForm.supplier_name} onChange={event => setEditForm(prev => ({ ...prev, supplier_name: event.target.value }))} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginTop: 'var(--space-4)' }}>
              <div className="form-group">
                <label className="form-label">Lotto</label>
                <input className="input" value={editForm.original_lot_code} onChange={event => setEditForm(prev => ({ ...prev, original_lot_code: event.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Documento / DDT</label>
                <input className="input" value={editForm.document_number} onChange={event => setEditForm(prev => ({ ...prev, document_number: event.target.value }))} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-4)', marginTop: 'var(--space-4)' }}>
              <div className="form-group">
                <label className="form-label">Consegna</label>
                <input type="date" className="input" value={editForm.delivery_date} onChange={event => setEditForm(prev => ({ ...prev, delivery_date: event.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Scadenza</label>
                <input type="date" className="input" value={editForm.expiry_date} onChange={event => setEditForm(prev => ({ ...prev, expiry_date: event.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">T. ricevimento</label>
                <input type="number" step="0.1" className="input" value={editForm.received_temp} onChange={event => setEditForm(prev => ({ ...prev, received_temp: event.target.value }))} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginTop: 'var(--space-4)' }}>
              <div className="form-group">
                <label className="form-label">Quantità</label>
                <input type="number" step="0.01" className="input" value={editForm.quantity} onChange={event => setEditForm(prev => ({ ...prev, quantity: event.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Unità</label>
                <input className="input" value={editForm.unit} onChange={event => setEditForm(prev => ({ ...prev, unit: event.target.value }))} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-4)', marginTop: 'var(--space-4)' }}>
              <div className="form-group">
                <label className="form-label">Rischio</label>
                <select className="input" value={editForm.risk_level} onChange={event => setEditForm(prev => ({ ...prev, risk_level: event.target.value as Batch['risk_level'] }))}>
                  <option value="low">Basso</option>
                  <option value="medium">Medio</option>
                  <option value="high">Alto</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Imballo</label>
                <select className="input" value={String(editForm.packaging_ok)} onChange={event => setEditForm(prev => ({ ...prev, packaging_ok: event.target.value === 'true' }))}>
                  <option value="true">Integro</option>
                  <option value="false">Danneggiato</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Etichetta</label>
                <select className="input" value={String(editForm.label_ok)} onChange={event => setEditForm(prev => ({ ...prev, label_ok: event.target.value === 'true' }))}>
                  <option value="true">Leggibile</option>
                  <option value="false">Non idonea</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Accettazione</label>
                <select className="input" value={String(editForm.accepted)} onChange={event => setEditForm(prev => ({ ...prev, accepted: event.target.value === 'true' }))}>
                  <option value="true">Accettato</option>
                  <option value="false">Rifiutato</option>
                </select>
              </div>
            </div>

            <div className="form-group" style={{ marginTop: 'var(--space-4)' }}>
              <label className="form-label">Motivo rifiuto / riserva</label>
              <textarea className="input" rows={2} value={editForm.rejection_reason} onChange={event => setEditForm(prev => ({ ...prev, rejection_reason: event.target.value }))} />
            </div>

            <div className="form-group" style={{ marginTop: 'var(--space-4)' }}>
              <label className="form-label">Note</label>
              <textarea className="input" rows={2} value={editForm.notes} onChange={event => setEditForm(prev => ({ ...prev, notes: event.target.value }))} />
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
