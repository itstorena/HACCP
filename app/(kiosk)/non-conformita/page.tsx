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
export type NonConformitySource = 'receiving' | 'blast_chiller' | 'temperature' | 'cleaning' | 'lot' | 'allergen' | 'pest' | 'maintenance' | 'other'
export type NonConformitySeverity = 'low' | 'medium' | 'high' | 'critical'

export interface NonConformity {
  id: string
  source_type: NonConformitySource
  severity: NonConformitySeverity
  status: 'open' | 'in_progress' | 'closed' | 'void'
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
  const [form, setForm] = useState({
    source_type: 'other' as NonConformitySource,
    severity: 'medium' as NonConformitySeverity,
    title: '',
    description: '',
    immediate_action: '',
  })

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
    const { error } = await (supabase.from('non_conformities') as any).insert({
      source_type: form.source_type,
      severity: form.severity,
      title: form.title.trim(),
      description: form.description.trim(),
      immediate_action: form.immediate_action.trim(),
      detected_by: currentStaff?.id ?? null,
    })

    if (error) {
      addToast({ type: 'error', message: `Errore: ${error.message}` })
      setSaving(false)
      return
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
      setItems(prev => prev.map(row => row.id === item.id ? { ...row, status: 'in_progress' } : row))
      addToast({ type: 'info', message: 'Non conformità presa in carico.' })
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">⚠️ Non Conformità</h1>
          <p className="page-subtitle">Segnala problemi e azioni immediate durante il servizio</p>
        </div>
        <Link href="/temperature" className="btn btn--secondary">🌡️ Temperature</Link>
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
                {item.status === 'open' && (
                  <button className="btn btn--secondary btn--sm" onClick={() => markInProgress(item)}>
                    Prendi in carico
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
