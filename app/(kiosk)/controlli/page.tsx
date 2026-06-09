'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useStaffStore } from '@/store/staffStore'
import { useToastStore } from '@/store/toastStore'
import { formatDateTime } from '@/lib/utils/formatting'
import { CHECK_TYPE_LABELS } from '@/lib/utils/haccp'
import { writeAuditLog } from '@/lib/utils/auditLog'
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
  const [editingCheck, setEditingCheck] = useState<OperationalCheck | null>(null)
  const [form, setForm] = useState({
    check_type: 'cleaning' as OperationalCheckType,
    area: 'Cucina',
    item: '',
    expected_result: '',
    actual_result: '',
    is_compliant: true,
    corrective_action: '',
  })
  const [editForm, setEditForm] = useState({
    check_type: 'cleaning' as OperationalCheckType,
    area: '',
    item: '',
    expected_result: '',
    actual_result: '',
    is_compliant: true,
    corrective_action: '',
  })
  const canDeleteRecords = currentStaff?.role === 'manager'

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

    if (data) {
      await writeAuditLog(supabase, {
        tableName: 'operational_checks',
        recordId: data.id,
        action: 'insert',
        staff: currentStaff,
        afterData: data,
      })
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

  const openEditCheck = (check: OperationalCheck) => {
    setEditingCheck(check)
    setEditForm({
      check_type: check.check_type,
      area: check.area,
      item: check.item,
      expected_result: check.expected_result ?? '',
      actual_result: check.actual_result ?? '',
      is_compliant: check.is_compliant,
      corrective_action: check.corrective_action ?? '',
    })
  }

  const handleUpdateCheck = async () => {
    if (!editingCheck) return
    if (!editForm.area.trim() || !editForm.item.trim()) {
      addToast({ type: 'error', message: 'Area e voce controllo sono obbligatorie.' })
      return
    }
    if (!editForm.is_compliant && !editForm.corrective_action.trim()) {
      addToast({ type: 'error', message: 'Per un controllo non conforme serve una azione correttiva.' })
      return
    }

    setSaving(true)
    const { error } = await supabase
      .from('operational_checks')
      .update({
        check_type: editForm.check_type,
        area: editForm.area.trim(),
        item: editForm.item.trim(),
        expected_result: editForm.expected_result.trim() || null,
        actual_result: editForm.actual_result.trim() || null,
        is_compliant: editForm.is_compliant,
        corrective_action: editForm.is_compliant ? null : editForm.corrective_action.trim(),
      })
      .eq('id', editingCheck.id)

    if (error) {
      addToast({ type: 'error', message: `Errore: ${error.message}` })
      setSaving(false)
      return
    }

    if (!editForm.is_compliant) {
      const { data: existing } = await (supabase.from('non_conformities') as any)
        .select('id')
        .eq('related_table', 'operational_checks')
        .eq('related_id', editingCheck.id)
        .limit(1)

      if (!existing || existing.length === 0) {
        await supabase.from('non_conformities').insert({
          source_type: editForm.check_type === 'pest_control' ? 'pest' : editForm.check_type === 'maintenance' ? 'maintenance' : editForm.check_type === 'allergen_control' ? 'allergen' : 'cleaning',
          severity: editForm.check_type === 'pest_control' || editForm.check_type === 'allergen_control' ? 'high' : 'medium',
          title: `Controllo non conforme - ${editForm.item}`,
          description: `${editForm.area}: ${editForm.actual_result || 'esito non conforme'}. Atteso: ${editForm.expected_result || 'non specificato'}.`,
          detected_by: currentStaff?.id ?? null,
          related_table: 'operational_checks',
          related_id: editingCheck.id,
          immediate_action: editForm.corrective_action.trim(),
          corrective_action: editForm.corrective_action.trim(),
        })
      }
    }

    await writeAuditLog(supabase, {
      tableName: 'operational_checks',
      recordId: editingCheck.id,
      action: 'update',
      staff: currentStaff,
      beforeData: editingCheck,
      afterData: {
        check_type: editForm.check_type,
        area: editForm.area.trim(),
        item: editForm.item.trim(),
        expected_result: editForm.expected_result.trim() || null,
        actual_result: editForm.actual_result.trim() || null,
        is_compliant: editForm.is_compliant,
        corrective_action: editForm.is_compliant ? null : editForm.corrective_action.trim(),
      },
    })

    addToast({ type: 'success', message: 'Controllo aggiornato.' })
    setEditingCheck(null)
    await load()
    setSaving(false)
  }

  const handleDeleteCheck = async (check: OperationalCheck) => {
    if (!canDeleteRecords) {
      addToast({ type: 'error', message: 'Eliminazione consentita solo a manager o amministratore.' })
      return
    }

    const confirmed = window.confirm(`Eliminare il controllo "${check.item}" del ${formatDateTime(check.checked_at)}? Usa questa funzione solo per errori umani di inserimento.`)
    if (!confirmed) return

    setSaving(true)
    await writeAuditLog(supabase, {
      tableName: 'operational_checks',
      recordId: check.id,
      action: 'delete',
      staff: currentStaff,
      beforeData: check,
      afterData: { reason: 'Eliminazione per errore umano confermata dall operatore' },
    })

    await (supabase.from('non_conformities') as any)
      .delete()
      .eq('related_table', 'operational_checks')
      .eq('related_id', check.id)

    const { error } = await supabase
      .from('operational_checks')
      .delete()
      .eq('id', check.id)

    if (error) {
      addToast({ type: 'error', message: `Eliminazione non riuscita: ${error.message}` })
      setSaving(false)
      return
    }

    addToast({ type: 'success', message: 'Controllo eliminato.' })
    setChecks(prev => prev.filter(item => item.id !== check.id))
    if (editingCheck?.id === check.id) setEditingCheck(null)
    setSaving(false)
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">🧽 Controlli</h1>
          <p className="page-subtitle">Pulizie, infestanti, allergeni, olio, manutenzioni e formazione</p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <button className="btn btn--secondary" onClick={() => window.print()}>🖨️ Stampa registro</button>
          <Link href="/non-conformita" className="btn btn--secondary">⚠️ Non conformità</Link>
        </div>
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
                <th className="no-print">Azioni</th>
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
                  <td className="no-print">
                    <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                      <button className="btn btn--secondary btn--sm" onClick={() => openEditCheck(check)}>
                        Modifica
                      </button>
                      {canDeleteRecords && (
                        <button className="btn btn--danger btn--sm" onClick={() => handleDeleteCheck(check)} disabled={saving}>
                          Elimina
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

      {editingCheck && (
        <div className="modal-overlay" onClick={() => setEditingCheck(null)}>
          <div className="modal" onClick={event => event.stopPropagation()}>
            <div className="modal__header">
              <h2 className="modal__title">Modifica controllo</h2>
              <button className="modal__close" onClick={() => setEditingCheck(null)}>×</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
              <div className="form-group">
                <label className="form-label">Tipo</label>
                <select className="input" value={editForm.check_type} onChange={event => setEditForm(prev => ({ ...prev, check_type: event.target.value as OperationalCheckType }))}>
                  {Object.entries(CHECK_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Esito</label>
                <select className="input" value={String(editForm.is_compliant)} onChange={event => setEditForm(prev => ({ ...prev, is_compliant: event.target.value === 'true' }))}>
                  <option value="true">Conforme</option>
                  <option value="false">Non conforme</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginTop: 'var(--space-4)' }}>
              <div className="form-group">
                <label className="form-label">Area</label>
                <input className="input" value={editForm.area} onChange={event => setEditForm(prev => ({ ...prev, area: event.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Voce</label>
                <input className="input" value={editForm.item} onChange={event => setEditForm(prev => ({ ...prev, item: event.target.value }))} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginTop: 'var(--space-4)' }}>
              <div className="form-group">
                <label className="form-label">Atteso</label>
                <textarea className="input" rows={2} value={editForm.expected_result} onChange={event => setEditForm(prev => ({ ...prev, expected_result: event.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Rilevato</label>
                <textarea className="input" rows={2} value={editForm.actual_result} onChange={event => setEditForm(prev => ({ ...prev, actual_result: event.target.value }))} />
              </div>
            </div>

            {!editForm.is_compliant && (
              <div className="form-group" style={{ marginTop: 'var(--space-4)' }}>
                <label className="form-label">Azione correttiva</label>
                <textarea className="input" rows={3} value={editForm.corrective_action} onChange={event => setEditForm(prev => ({ ...prev, corrective_action: event.target.value }))} />
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)', marginTop: 'var(--space-6)', flexWrap: 'wrap' }}>
              {canDeleteRecords ? (
                <button className="btn btn--danger" onClick={() => handleDeleteCheck(editingCheck)} disabled={saving}>
                  Elimina
                </button>
              ) : <span />}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
                <button className="btn btn--secondary" onClick={() => setEditingCheck(null)}>Annulla</button>
                <button className="btn btn--primary" onClick={handleUpdateCheck} disabled={saving}>
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
