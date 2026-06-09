'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useStaffStore } from '@/store/staffStore'
import { useToastStore } from '@/store/toastStore'
import { formatDateTime } from '@/lib/utils/formatting'
import {
  NON_CONFORMITY_SOURCE_LABELS,
  SEVERITY_BADGE_CLASS,
  SEVERITY_LABELS,
  STATUS_BADGE_CLASS,
  STATUS_LABELS,
} from '@/lib/utils/haccp'
import { writeAuditLog } from '@/lib/utils/auditLog'
export type NonConformitySource = 'receiving' | 'blast_chiller' | 'temperature' | 'cleaning' | 'lot' | 'allergen' | 'pest' | 'maintenance' | 'other'
export type NonConformitySeverity = 'low' | 'medium' | 'high' | 'critical'
export type NonConformityStatus = 'open' | 'in_progress' | 'closed' | 'void'

export interface NonConformity {
  id: string
  source_type: NonConformitySource
  severity: NonConformitySeverity
  status: NonConformityStatus
  title: string
  description: string
  detected_at: string
  detected_by: string | null
  immediate_action: string | null
  corrective_action: string | null
  preventive_action: string | null
  closed_at: string | null
  closed_by: string | null
  manager_notes: string | null
  created_at: string
}

export default function NonConformitaPage() {
  const supabase = createClient()
  const { currentStaff } = useStaffStore()
  const { addToast } = useToastStore()
  const [items, setItems] = useState<NonConformity[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingItem, setEditingItem] = useState<NonConformity | null>(null)
  const [form, setForm] = useState({
    source_type: 'other' as NonConformitySource,
    severity: 'medium' as NonConformitySeverity,
    title: '',
    description: '',
    immediate_action: '',
  })
  const [editForm, setEditForm] = useState({
    source_type: 'other' as NonConformitySource,
    severity: 'medium' as NonConformitySeverity,
    status: 'open' as NonConformityStatus,
    title: '',
    description: '',
    immediate_action: '',
    corrective_action: '',
    preventive_action: '',
    manager_notes: '',
  })
  const canDeleteRecords = currentStaff?.role === 'manager'

  const load = async () => {
    const { data } = await (supabase.from('non_conformities') as any)
      .select('*')
      .in('status', ['open', 'in_progress'])
      .order('detected_at', { ascending: false })
      .limit(50)

    setItems((data as NonConformity[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const handleCreate = async () => {
    if (!form.title.trim() || !form.description.trim() || !form.immediate_action.trim()) {
      addToast({ type: 'error', message: 'Titolo, descrizione e azione immediata sono obbligatori.' })
      return
    }

    setSaving(true)
    const { data, error } = await (supabase.from('non_conformities') as any)
      .insert({
        source_type: form.source_type,
        severity: form.severity,
        title: form.title.trim(),
        description: form.description.trim(),
        immediate_action: form.immediate_action.trim(),
        detected_by: currentStaff?.id ?? null,
      })
      .select()
      .single()

    if (error) {
      addToast({ type: 'error', message: `Errore: ${error.message}` })
      setSaving(false)
      return
    }

    if (data) {
      await writeAuditLog(supabase, {
        tableName: 'non_conformities',
        recordId: data.id,
        action: 'insert',
        staff: currentStaff,
        afterData: data,
      })
    }

    addToast({ type: 'success', message: 'Non conformità aperta.' })
    setForm({
      source_type: 'other',
      severity: 'medium',
      title: '',
      description: '',
      immediate_action: '',
    })
    await load()
    setSaving(false)
  }

  const markInProgress = async (item: NonConformity) => {
    const { error } = await (supabase.from('non_conformities') as any)
      .update({ status: 'in_progress' })
      .eq('id', item.id)

    if (!error) {
      await writeAuditLog(supabase, {
        tableName: 'non_conformities',
        recordId: item.id,
        action: 'update',
        staff: currentStaff,
        beforeData: item,
        afterData: { status: 'in_progress' },
      })
      setItems(prev => prev.map(row => row.id === item.id ? { ...row, status: 'in_progress' } : row))
      addToast({ type: 'info', message: 'Non conformità presa in carico.' })
    }
  }

  const openEditItem = (item: NonConformity) => {
    setEditingItem(item)
    setEditForm({
      source_type: item.source_type,
      severity: item.severity,
      status: item.status,
      title: item.title,
      description: item.description,
      immediate_action: item.immediate_action ?? '',
      corrective_action: item.corrective_action ?? '',
      preventive_action: item.preventive_action ?? '',
      manager_notes: item.manager_notes ?? '',
    })
  }

  const handleUpdateItem = async () => {
    if (!editingItem) return
    if (!editForm.title.trim() || !editForm.description.trim()) {
      addToast({ type: 'error', message: 'Titolo e descrizione sono obbligatori.' })
      return
    }

    setSaving(true)
    const closingNow = editForm.status === 'closed' && editingItem.status !== 'closed'
    const { error } = await (supabase.from('non_conformities') as any)
      .update({
        source_type: editForm.source_type,
        severity: editForm.severity,
        status: editForm.status,
        title: editForm.title.trim(),
        description: editForm.description.trim(),
        immediate_action: editForm.immediate_action.trim() || null,
        corrective_action: editForm.corrective_action.trim() || null,
        preventive_action: editForm.preventive_action.trim() || null,
        manager_notes: editForm.manager_notes.trim() || null,
        closed_at: closingNow ? new Date().toISOString() : editingItem.closed_at,
        closed_by: closingNow ? currentStaff?.id ?? null : editingItem.closed_by,
      })
      .eq('id', editingItem.id)

    if (error) {
      addToast({ type: 'error', message: `Errore: ${error.message}` })
      setSaving(false)
      return
    }

    addToast({ type: 'success', message: 'Non conformità aggiornata.' })
    await writeAuditLog(supabase, {
      tableName: 'non_conformities',
      recordId: editingItem.id,
      action: 'update',
      staff: currentStaff,
      beforeData: editingItem,
      afterData: {
        source_type: editForm.source_type,
        severity: editForm.severity,
        status: editForm.status,
        title: editForm.title.trim(),
        description: editForm.description.trim(),
        immediate_action: editForm.immediate_action.trim() || null,
        corrective_action: editForm.corrective_action.trim() || null,
        preventive_action: editForm.preventive_action.trim() || null,
        manager_notes: editForm.manager_notes.trim() || null,
      },
    })
    setEditingItem(null)
    await load()
    setSaving(false)
  }

  const handleDeleteItem = async (item: NonConformity) => {
    if (!canDeleteRecords) {
      addToast({ type: 'error', message: 'Eliminazione consentita solo a manager o amministratore.' })
      return
    }

    const confirmed = window.confirm(`Eliminare la non conformita "${item.title}" del ${formatDateTime(item.detected_at)}? Usa questa funzione solo per errori umani di inserimento.`)
    if (!confirmed) return

    setSaving(true)
    await writeAuditLog(supabase, {
      tableName: 'non_conformities',
      recordId: item.id,
      action: 'delete',
      staff: currentStaff,
      beforeData: item,
      afterData: { reason: 'Eliminazione per errore umano confermata dall operatore' },
    })

    const { error } = await (supabase.from('non_conformities') as any)
      .delete()
      .eq('id', item.id)

    if (error) {
      addToast({ type: 'error', message: `Eliminazione non riuscita: ${error.message}` })
      setSaving(false)
      return
    }

    addToast({ type: 'success', message: 'Non conformita eliminata.' })
    setItems(prev => prev.filter(row => row.id !== item.id))
    if (editingItem?.id === item.id) setEditingItem(null)
    setSaving(false)
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">⚠️ Non Conformità</h1>
          <p className="page-subtitle">Segnala problemi e azioni immediate durante il servizio</p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <button className="btn btn--secondary" onClick={() => window.print()}>🖨️ Stampa registro</button>
          <Link href="/temperature" className="btn btn--secondary">🌡️ Temperature</Link>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)' }}>
          <div className="form-group">
            <label className="form-label">Origine</label>
            <select
              className="input"
              value={form.source_type}
              onChange={event => setForm(prev => ({ ...prev, source_type: event.target.value as NonConformitySource }))}
            >
              {Object.entries(NON_CONFORMITY_SOURCE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Gravità</label>
            <select
              className="input"
              value={form.severity}
              onChange={event => setForm(prev => ({ ...prev, severity: event.target.value as NonConformitySeverity }))}
            >
              {Object.entries(SEVERITY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-group" style={{ marginTop: 'var(--space-4)' }}>
          <label className="form-label">Titolo</label>
          <input
            className="input"
            value={form.title}
            onChange={event => setForm(prev => ({ ...prev, title: event.target.value }))}
            placeholder="es. Frigo antipasti sopra soglia"
          />
        </div>

        <div className="form-group" style={{ marginTop: 'var(--space-4)' }}>
          <label className="form-label">Descrizione</label>
          <textarea
            className="input"
            value={form.description}
            onChange={event => setForm(prev => ({ ...prev, description: event.target.value }))}
            rows={3}
            placeholder="Cosa è successo, prodotto coinvolto, lotto, temperatura, area..."
          />
        </div>

        <div className="form-group" style={{ marginTop: 'var(--space-4)' }}>
          <label className="form-label">Azione immediata</label>
          <textarea
            className="input"
            value={form.immediate_action}
            onChange={event => setForm(prev => ({ ...prev, immediate_action: event.target.value }))}
            rows={3}
            placeholder="es. Prodotto isolato, responsabile avvisato, attrezzatura disattivata..."
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-4)' }}>
          <button className="btn btn--danger btn--lg" onClick={handleCreate} disabled={saving}>
            {saving ? <><div className="spinner" style={{ width: 18, height: 18 }} /> Salvataggio...</> : '⚠️ Apri non conformità'}
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-12)' }}>
          <div className="spinner" style={{ width: 40, height: 40 }} />
        </div>
      ) : items.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon">✅</div>
          <div className="empty-state__title">Nessuna non conformità aperta</div>
          <p className="empty-state__desc">Le segnalazioni aperte compariranno qui.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 'var(--space-4)' }}>
          {items.map(item => (
            <div key={item.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                <div>
                  <h2 style={{ fontSize: 'var(--text-lg)' }}>{item.title}</h2>
                  <p style={{ fontSize: 'var(--text-xs)', marginTop: 'var(--space-1)' }}>
                    {formatDateTime(item.detected_at)} · {NON_CONFORMITY_SOURCE_LABELS[item.source_type]}
                  </p>
                </div>
                <span className={`badge ${SEVERITY_BADGE_CLASS[item.severity]}`}>{SEVERITY_LABELS[item.severity]}</span>
              </div>

              <p style={{ fontSize: 'var(--text-sm)', marginBottom: 'var(--space-3)' }}>{item.description}</p>

              <div style={{ background: 'var(--color-surface-2)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)' }}>
                <strong>Azione:</strong> {item.immediate_action ?? '—'}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-3)' }}>
                <span className={`badge ${STATUS_BADGE_CLASS[item.status]}`}>{STATUS_LABELS[item.status]}</span>
                <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  {item.status === 'open' && (
                    <button className="btn btn--secondary btn--sm" onClick={() => markInProgress(item)}>
                      Prendi in carico
                    </button>
                  )}
                  <button className="btn btn--secondary btn--sm" onClick={() => openEditItem(item)}>
                    Modifica
                  </button>
                  {canDeleteRecords && (
                    <button className="btn btn--danger btn--sm" onClick={() => handleDeleteItem(item)} disabled={saving}>
                      Elimina
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {editingItem && (
        <div className="modal-overlay" onClick={() => setEditingItem(null)}>
          <div className="modal" onClick={event => event.stopPropagation()}>
            <div className="modal__header">
              <h2 className="modal__title">Modifica non conformità</h2>
              <button className="modal__close" onClick={() => setEditingItem(null)}>×</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
              <div className="form-group">
                <label className="form-label">Origine</label>
                <select className="input" value={editForm.source_type} onChange={event => setEditForm(prev => ({ ...prev, source_type: event.target.value as NonConformitySource }))}>
                  {Object.entries(NON_CONFORMITY_SOURCE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Gravità</label>
                <select className="input" value={editForm.severity} onChange={event => setEditForm(prev => ({ ...prev, severity: event.target.value as NonConformitySeverity }))}>
                  {Object.entries(SEVERITY_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group" style={{ marginTop: 'var(--space-4)' }}>
              <label className="form-label">Stato</label>
              <select className="input" value={editForm.status} onChange={event => setEditForm(prev => ({ ...prev, status: event.target.value as NonConformityStatus }))}>
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ marginTop: 'var(--space-4)' }}>
              <label className="form-label">Titolo</label>
              <input className="input" value={editForm.title} onChange={event => setEditForm(prev => ({ ...prev, title: event.target.value }))} />
            </div>

            <div className="form-group" style={{ marginTop: 'var(--space-4)' }}>
              <label className="form-label">Descrizione</label>
              <textarea className="input" rows={3} value={editForm.description} onChange={event => setEditForm(prev => ({ ...prev, description: event.target.value }))} />
            </div>

            <div className="form-group" style={{ marginTop: 'var(--space-4)' }}>
              <label className="form-label">Azione immediata</label>
              <textarea className="input" rows={2} value={editForm.immediate_action} onChange={event => setEditForm(prev => ({ ...prev, immediate_action: event.target.value }))} />
            </div>

            <div className="form-group" style={{ marginTop: 'var(--space-4)' }}>
              <label className="form-label">Azione correttiva</label>
              <textarea className="input" rows={2} value={editForm.corrective_action} onChange={event => setEditForm(prev => ({ ...prev, corrective_action: event.target.value }))} />
            </div>

            <div className="form-group" style={{ marginTop: 'var(--space-4)' }}>
              <label className="form-label">Azione preventiva</label>
              <textarea className="input" rows={2} value={editForm.preventive_action} onChange={event => setEditForm(prev => ({ ...prev, preventive_action: event.target.value }))} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)', marginTop: 'var(--space-6)', flexWrap: 'wrap' }}>
              {canDeleteRecords ? (
                <button className="btn btn--danger" onClick={() => handleDeleteItem(editingItem)} disabled={saving}>
                  Elimina
                </button>
              ) : <span />}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
                <button className="btn btn--secondary" onClick={() => setEditingItem(null)}>Annulla</button>
                <button className="btn btn--primary" onClick={handleUpdateItem} disabled={saving}>
                  {saving ? 'Salvataggio...' : 'Salva modifiche'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
