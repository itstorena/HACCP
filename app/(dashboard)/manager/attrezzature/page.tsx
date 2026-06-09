'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToastStore } from '@/store/toastStore'
import { EQUIPMENT_TYPE_LABELS } from '@/lib/utils/haccp'
import type { Database, EquipmentType } from '@/types/database'

type Equipment = Database['public']['Tables']['equipment']['Row']

const defaultForm = {
  name: '',
  equipment_type: 'fridge' as EquipmentType,
  location: '',
  min_temp: '',
  max_temp: '',
  check_frequency_hours: '24',
  is_active: true,
}

export default function AttrezzaturePage() {
  const supabase = createClient()
  const { addToast } = useToastStore()
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<Equipment | null>(null)
  const [form, setForm] = useState(defaultForm)

  const load = async () => {
    const { data } = await supabase
      .from('equipment')
      .select('*')
      .order('is_active', { ascending: false })
      .order('name')

    setEquipment(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const resetForm = () => {
    setEditing(null)
    setForm(defaultForm)
  }

  const openEdit = (item: Equipment) => {
    setEditing(item)
    setForm({
      name: item.name,
      equipment_type: item.equipment_type,
      location: item.location ?? '',
      min_temp: item.min_temp === null ? '' : String(item.min_temp),
      max_temp: item.max_temp === null ? '' : String(item.max_temp),
      check_frequency_hours: String(item.check_frequency_hours),
      is_active: item.is_active,
    })
  }

  const save = async () => {
    if (!form.name.trim()) {
      addToast({ type: 'error', message: 'Nome attrezzatura obbligatorio.' })
      return
    }

    const minTemp = form.min_temp === '' ? null : Number(form.min_temp)
    const maxTemp = form.max_temp === '' ? null : Number(form.max_temp)
    const frequency = Number(form.check_frequency_hours)

    if ((minTemp !== null && !Number.isFinite(minTemp)) || (maxTemp !== null && !Number.isFinite(maxTemp)) || !Number.isFinite(frequency)) {
      addToast({ type: 'error', message: 'Soglie e frequenza devono essere valori numerici.' })
      return
    }

    setSaving(true)
    const payload = {
      name: form.name.trim(),
      equipment_type: form.equipment_type,
      location: form.location.trim() || null,
      min_temp: minTemp,
      max_temp: maxTemp,
      check_frequency_hours: Math.max(1, Math.round(frequency)),
      is_active: form.is_active,
    }

    const result = editing
      ? await supabase.from('equipment').update(payload).eq('id', editing.id)
      : await supabase.from('equipment').insert(payload)

    if (result.error) {
      addToast({ type: 'error', message: `Errore: ${result.error.message}` })
      setSaving(false)
      return
    }

    addToast({ type: 'success', message: editing ? 'Attrezzatura aggiornata.' : 'Attrezzatura creata.' })
    resetForm()
    await load()
    setSaving(false)
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">🌡️ Attrezzature</h1>
          <p className="page-subtitle">Configura frigo, freezer, abbattitori, sonde e soglie per i registri temperatura</p>
        </div>
        <button className="btn btn--secondary" onClick={() => window.print()}>🖨️ Stampa elenco</button>
      </div>

      <div className="card no-print" style={{ marginBottom: 'var(--space-6)' }}>
        <h2 style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-4)' }}>
          {editing ? 'Modifica attrezzatura' : 'Nuova attrezzatura'}
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-4)' }}>
          <div className="form-group">
            <label className="form-label">Nome</label>
            <input className="input" value={form.name} onChange={event => setForm(prev => ({ ...prev, name: event.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Tipo</label>
            <select className="input" value={form.equipment_type} onChange={event => setForm(prev => ({ ...prev, equipment_type: event.target.value as EquipmentType }))}>
              {Object.entries(EQUIPMENT_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Area</label>
            <input className="input" value={form.location} onChange={event => setForm(prev => ({ ...prev, location: event.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Min °C</label>
            <input type="number" step="0.1" className="input" value={form.min_temp} onChange={event => setForm(prev => ({ ...prev, min_temp: event.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Max °C</label>
            <input type="number" step="0.1" className="input" value={form.max_temp} onChange={event => setForm(prev => ({ ...prev, max_temp: event.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Frequenza ore</label>
            <input type="number" className="input" value={form.check_frequency_hours} onChange={event => setForm(prev => ({ ...prev, check_frequency_hours: event.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Stato</label>
            <select className="input" value={String(form.is_active)} onChange={event => setForm(prev => ({ ...prev, is_active: event.target.value === 'true' }))}>
              <option value="true">Attiva</option>
              <option value="false">Disattiva</option>
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'var(--space-4)' }}>
          {editing && <button className="btn btn--secondary" onClick={resetForm}>Annulla</button>}
          <button className="btn btn--primary" onClick={save} disabled={saving}>
            {saving ? 'Salvataggio...' : editing ? 'Salva modifiche' : 'Crea attrezzatura'}
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-12)' }}>
          <div className="spinner" style={{ width: 40, height: 40 }} />
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Tipo</th>
                <th>Area</th>
                <th>Soglia</th>
                <th>Frequenza</th>
                <th>Stato</th>
                <th className="no-print">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {equipment.map(item => (
                <tr key={item.id}>
                  <td style={{ fontWeight: 600 }}>{item.name}</td>
                  <td>{EQUIPMENT_TYPE_LABELS[item.equipment_type]}</td>
                  <td>{item.location ?? '—'}</td>
                  <td>{item.min_temp ?? '—'} / {item.max_temp ?? '—'} °C</td>
                  <td>ogni {item.check_frequency_hours}h</td>
                  <td>
                    <span className={`badge ${item.is_active ? 'badge--success' : 'badge--neutral'}`}>
                      {item.is_active ? 'Attiva' : 'Disattiva'}
                    </span>
                  </td>
                  <td className="no-print">
                    <button className="btn btn--secondary btn--sm" onClick={() => openEdit(item)}>Modifica</button>
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
