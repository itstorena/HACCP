'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToastStore } from '@/store/toastStore'
import { formatDateTime } from '@/lib/utils/formatting'
import {
  NON_CONFORMITY_SOURCE_LABELS,
  SEVERITY_BADGE_CLASS,
  SEVERITY_LABELS,
  STATUS_BADGE_CLASS,
  STATUS_LABELS,
} from '@/lib/utils/haccp'
import type { Database, NonConformityStatus } from '@/types/database'

type NonConformity = Database['public']['Tables']['non_conformities']['Row']

export default function ManagerNonConformitaPage() {
  const supabase = createClient()
  const { addToast } = useToastStore()
  const [items, setItems] = useState<NonConformity[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'active' | 'all' | NonConformityStatus>('active')
  const [selected, setSelected] = useState<NonConformity | null>(null)
  const [closing, setClosing] = useState(false)
  const [form, setForm] = useState({
    corrective_action: '',
    preventive_action: '',
    manager_notes: '',
  })

  const load = async () => {
    let query = supabase
      .from('non_conformities')
      .select('*')
      .order('detected_at', { ascending: false })
      .limit(200)

    if (filter === 'active') query = query.in('status', ['open', 'in_progress'])
    else if (filter !== 'all') query = query.eq('status', filter)

    const { data } = await query
    setItems(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [filter])

  const openCloseModal = (item: NonConformity) => {
    setSelected(item)
    setForm({
      corrective_action: item.corrective_action ?? item.immediate_action ?? '',
      preventive_action: item.preventive_action ?? '',
      manager_notes: item.manager_notes ?? '',
    })
  }

  const updateStatus = async (item: NonConformity, status: NonConformityStatus) => {
    const { error } = await supabase
      .from('non_conformities')
      .update({ status })
      .eq('id', item.id)

    if (!error) {
      addToast({ type: 'info', message: 'Stato aggiornato.' })
      await load()
    }
  }

  const closeSelected = async () => {
    if (!selected) return
    if (!form.corrective_action.trim()) {
      addToast({ type: 'error', message: 'Azione correttiva obbligatoria.' })
      return
    }

    setClosing(true)
    const { error } = await supabase
      .from('non_conformities')
      .update({
        status: 'closed',
        corrective_action: form.corrective_action.trim(),
        preventive_action: form.preventive_action.trim() || null,
        manager_notes: form.manager_notes.trim() || null,
        closed_at: new Date().toISOString(),
      })
      .eq('id', selected.id)

    if (error) {
      addToast({ type: 'error', message: `Errore: ${error.message}` })
      setClosing(false)
      return
    }

    addToast({ type: 'success', message: 'Non conformità chiusa.' })
    setSelected(null)
    await load()
    setClosing(false)
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">⚠️ Non Conformità</h1>
          <p className="page-subtitle">Gestione azioni correttive, prevenzione e chiusura manager</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-5)', flexWrap: 'wrap' }}>
        {[
          ['active', 'Aperte'],
          ['all', 'Tutte'],
          ['open', 'Nuove'],
          ['in_progress', 'In gestione'],
          ['closed', 'Chiuse'],
        ].map(([value, label]) => (
          <button
            key={value}
            className={`btn btn--sm ${filter === value ? 'btn--primary' : 'btn--secondary'}`}
            onClick={() => setFilter(value as typeof filter)}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-12)' }}>
          <div className="spinner" style={{ width: 40, height: 40 }} />
        </div>
      ) : items.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon">✅</div>
          <div className="empty-state__title">Nessuna non conformità</div>
          <p className="empty-state__desc">Cambia filtro o attendi nuove segnalazioni operative.</p>
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Origine</th>
                <th>Titolo</th>
                <th>Gravità</th>
                <th>Stato</th>
                <th>Azione immediata</th>
                <th>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id}>
                  <td>{formatDateTime(item.detected_at)}</td>
                  <td>{NON_CONFORMITY_SOURCE_LABELS[item.source_type]}</td>
                  <td style={{ fontWeight: 600 }}>{item.title}</td>
                  <td><span className={`badge ${SEVERITY_BADGE_CLASS[item.severity]}`}>{SEVERITY_LABELS[item.severity]}</span></td>
                  <td><span className={`badge ${STATUS_BADGE_CLASS[item.status]}`}>{STATUS_LABELS[item.status]}</span></td>
                  <td style={{ color: 'var(--color-text-muted)' }}>{item.immediate_action ?? '—'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                      {item.status === 'open' && (
                        <button className="btn btn--secondary btn--sm" onClick={() => updateStatus(item, 'in_progress')}>
                          In gestione
                        </button>
                      )}
                      {item.status !== 'closed' && item.status !== 'void' && (
                        <button className="btn btn--primary btn--sm" onClick={() => openCloseModal(item)}>
                          Chiudi
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal" onClick={event => event.stopPropagation()}>
            <div className="modal__header">
              <h2 className="modal__title">Chiudi non conformità</h2>
              <button className="modal__close" onClick={() => setSelected(null)}>×</button>
            </div>

            <div style={{ marginBottom: 'var(--space-4)' }}>
              <h3 style={{ fontSize: 'var(--text-lg)' }}>{selected.title}</h3>
              <p style={{ fontSize: 'var(--text-sm)' }}>{selected.description}</p>
            </div>

            <div className="form-group">
              <label className="form-label">Azione correttiva</label>
              <textarea
                className="input"
                rows={3}
                value={form.corrective_action}
                onChange={event => setForm(prev => ({ ...prev, corrective_action: event.target.value }))}
              />
            </div>

            <div className="form-group" style={{ marginTop: 'var(--space-4)' }}>
              <label className="form-label">Azione preventiva</label>
              <textarea
                className="input"
                rows={3}
                value={form.preventive_action}
                onChange={event => setForm(prev => ({ ...prev, preventive_action: event.target.value }))}
                placeholder="Come evitare che si ripeta"
              />
            </div>

            <div className="form-group" style={{ marginTop: 'var(--space-4)' }}>
              <label className="form-label">Note manager</label>
              <textarea
                className="input"
                rows={2}
                value={form.manager_notes}
                onChange={event => setForm(prev => ({ ...prev, manager_notes: event.target.value }))}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'var(--space-6)' }}>
              <button className="btn btn--secondary" onClick={() => setSelected(null)}>Annulla</button>
              <button className="btn btn--primary" onClick={closeSelected} disabled={closing}>
                {closing ? <><div className="spinner" style={{ width: 18, height: 18 }} /> Chiusura...</> : 'Chiudi NC'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
