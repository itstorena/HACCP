'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useStaffStore } from '@/store/staffStore'
import { useToastStore } from '@/store/toastStore'
import { formatDateTime } from '@/lib/utils/formatting'
import { CHECK_TYPE_LABELS } from '@/lib/utils/haccp'
import type { Database, OperationalCheckType } from '@/types/database'

type OperationalCheck = Database['public']['Tables']['operational_checks']['Row']

const QUICK_TEMPLATES: Array<{
  type: OperationalCheckType
  area: string
  item: string
  expected: string
}> = [
  { type: 'cleaning', area: 'Cucina', item: 'Superfici preparazione', expected: 'Pulite, sanificate, asciutte' },
  { type: 'cleaning', area: 'Cucina', item: 'Taglieri e coltelli', expected: 'Puliti, separati per uso, sanificati' },
  { type: 'oil_quality', area: 'Frittura', item: 'Olio friggitrice', expected: 'Colore/odore idonei o valore test nei limiti' },
  { type: 'pest_control', area: 'Locale', item: 'Tracce infestanti', expected: 'Assenza tracce, esche integre se presenti' },
  { type: 'allergen_control', area: 'Preparazione', item: 'Separazione allergeni', expected: 'Utensili e superfici dedicati o sanificati' },
  { type: 'maintenance', area: 'Attrezzature', item: 'Sonde e termometri', expected: 'Puliti, integri, disponibili' },
]

export default function ControlliPage() {
  const supabase = createClient()
  const { currentStaff } = useStaffStore()
  const { addToast } = useToastStore()
  const [checks, setChecks] = useState<OperationalCheck[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    check_type: 'cleaning' as OperationalCheckType,
    area: 'Cucina',
    item: '',
    expected_result: '',
    actual_result: '',
    is_compliant: true,
    corrective_action: '',
  })

  const load = async () => {
    const today = new Date().toISOString().split('T')[0]
    const { data } = await supabase
      .from('operational_checks')
      .select('*')
      .gte('checked_at', `${today}T00:00:00`)
      .order('checked_at', { ascending: false })
      .limit(80)

    setChecks(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const applyTemplate = (template: (typeof QUICK_TEMPLATES)[number]) => {
    setForm(prev => ({
      ...prev,
      check_type: template.type,
      area: template.area,
      item: template.item,
      expected_result: template.expected,
    }))
  }

  const handleSave = async () => {
    if (!form.area.trim() || !form.item.trim()) {
      addToast({ type: 'error', message: 'Area e voce controllo sono obbligatorie.' })
      return
    }

    if (!form.is_compliant && !form.corrective_action.trim()) {
      addToast({ type: 'error', message: 'Per un controllo non conforme serve una azione correttiva.' })
      return
    }

    setSaving(true)
    const { data, error } = await supabase
      .from('operational_checks')
      .insert({
        check_type: form.check_type,
        area: form.area.trim(),
        item: form.item.trim(),
        expected_result: form.expected_result.trim() || null,
        actual_result: form.actual_result.trim() || null,
        is_compliant: form.is_compliant,
        corrective_action: form.is_compliant ? null : form.corrective_action.trim(),
        checked_by: currentStaff?.id ?? null,
      })
      .select()
      .single()

    if (error) {
      addToast({ type: 'error', message: `Errore: ${error.message}` })
      setSaving(false)
      return
    }

    if (!form.is_compliant && data) {
      await supabase.from('non_conformities').insert({
        source_type: form.check_type === 'pest_control' ? 'pest' : form.check_type === 'maintenance' ? 'maintenance' : form.check_type === 'allergen_control' ? 'allergen' : 'cleaning',
        severity: form.check_type === 'pest_control' || form.check_type === 'allergen_control' ? 'high' : 'medium',
        title: `Controllo non conforme - ${form.item}`,
        description: `${form.area}: ${form.actual_result || 'esito non conforme'}. Atteso: ${form.expected_result || 'non specificato'}.`,
        detected_by: currentStaff?.id ?? null,
        related_table: 'operational_checks',
        related_id: data.id,
        immediate_action: form.corrective_action.trim(),
        corrective_action: form.corrective_action.trim(),
      })
    }

    addToast({ type: form.is_compliant ? 'success' : 'warning', message: form.is_compliant ? 'Controllo registrato.' : 'Controllo registrato e non conformità aperta.' })
    setForm({
      check_type: 'cleaning',
      area: 'Cucina',
      item: '',
      expected_result: '',
      actual_result: '',
      is_compliant: true,
      corrective_action: '',
    })
    await load()
    setSaving(false)
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">🧽 Controlli</h1>
          <p className="page-subtitle">Pulizie, infestanti, allergeni, olio, manutenzioni e formazione</p>
        </div>
        <Link href="/non-conformita" className="btn btn--secondary">⚠️ Non conformità</Link>
      </div>

      <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', marginBottom: 'var(--space-4)' }}>
          {QUICK_TEMPLATES.map(template => (
            <button
              key={`${template.type}-${template.item}`}
              className="btn btn--secondary btn--sm"
              type="button"
              onClick={() => applyTemplate(template)}
            >
              {template.item}
            </button>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)' }}>
          <div className="form-group">
            <label className="form-label">Tipo</label>
            <select
              className="input"
              value={form.check_type}
              onChange={event => setForm(prev => ({ ...prev, check_type: event.target.value as OperationalCheckType }))}
            >
              {Object.entries(CHECK_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Area</label>
            <input className="input" value={form.area} onChange={event => setForm(prev => ({ ...prev, area: event.target.value }))} />
          </div>

          <div className="form-group">
            <label className="form-label">Voce controllo</label>
            <input className="input" value={form.item} onChange={event => setForm(prev => ({ ...prev, item: event.target.value }))} placeholder="es. Banco preparazione" />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginTop: 'var(--space-4)' }}>
          <div className="form-group">
            <label className="form-label">Atteso</label>
            <textarea className="input" value={form.expected_result} onChange={event => setForm(prev => ({ ...prev, expected_result: event.target.value }))} rows={2} />
          </div>
          <div className="form-group">
            <label className="form-label">Rilevato</label>
            <textarea className="input" value={form.actual_result} onChange={event => setForm(prev => ({ ...prev, actual_result: event.target.value }))} rows={2} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 'var(--space-4)', marginTop: 'var(--space-4)' }}>
          <div className="form-group">
            <label className="form-label">Esito</label>
            <select
              className="input"
              value={String(form.is_compliant)}
              onChange={event => setForm(prev => ({ ...prev, is_compliant: event.target.value === 'true' }))}
            >
              <option value="true">Conforme</option>
              <option value="false">Non conforme</option>
            </select>
          </div>

          {!form.is_compliant && (
            <div className="form-group">
              <label className="form-label">Azione correttiva</label>
              <textarea className="input" value={form.corrective_action} onChange={event => setForm(prev => ({ ...prev, corrective_action: event.target.value }))} rows={2} />
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-4)' }}>
          <button className="btn btn--primary btn--lg" onClick={handleSave} disabled={saving}>
            {saving ? <><div className="spinner" style={{ width: 18, height: 18 }} /> Salvataggio...</> : '💾 Registra controllo'}
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-12)' }}>
          <div className="spinner" style={{ width: 40, height: 40 }} />
        </div>
      ) : checks.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon">🧽</div>
          <div className="empty-state__title">Nessun controllo oggi</div>
          <p className="empty-state__desc">Registra il primo controllo operativo del turno.</p>
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Ora</th>
                <th>Tipo</th>
                <th>Area</th>
                <th>Voce</th>
                <th>Esito</th>
                <th>Azione</th>
              </tr>
            </thead>
            <tbody>
              {checks.map(check => (
                <tr key={check.id}>
                  <td>{formatDateTime(check.checked_at)}</td>
                  <td>{CHECK_TYPE_LABELS[check.check_type]}</td>
                  <td>{check.area}</td>
                  <td style={{ fontWeight: 600 }}>{check.item}</td>
                  <td>
                    <span className={`badge ${check.is_compliant ? 'badge--success' : 'badge--danger'}`}>
                      {check.is_compliant ? 'Conforme' : 'Non conforme'}
                    </span>
                  </td>
                  <td style={{ color: 'var(--color-text-muted)' }}>{check.corrective_action ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
