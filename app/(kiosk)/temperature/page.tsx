'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useStaffStore } from '@/store/staffStore'
import { useToastStore } from '@/store/toastStore'
import { formatDateTime, formatTemp } from '@/lib/utils/formatting'
import {
  EQUIPMENT_TYPE_LABELS,
  formatRange,
  inferTemperatureSeverity,
  isTemperatureCompliant,
} from '@/lib/utils/haccp'
export interface Equipment {
  id: string
  name: string
  equipment_type: 'fridge' | 'freezer' | 'blast_chiller' | 'hot_holding' | 'probe' | 'other'
  location: string | null
  min_temp: number | null
  max_temp: number | null
  check_frequency_hours: number
  is_active: boolean
  created_at: string
}

export interface TemperatureLog {
  id: string
  equipment_name: string
  temperature: number
  min_threshold: number | null
  max_threshold: number | null
  is_compliant: boolean
  recorded_by: string | null
  recorded_at: string
  equipment_id: string | null
  corrective_action: string | null
  notes: string | null
}

export default function TemperaturePage() {
  const supabase = createClient()
  const { currentStaff } = useStaffStore()
  const { addToast } = useToastStore()
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [logs, setLogs] = useState<TemperatureLog[]>([])
  const [selectedEquipmentId, setSelectedEquipmentId] = useState('')
  const [manualName, setManualName] = useState('')
  const [temperature, setTemperature] = useState('')
  const [notes, setNotes] = useState('')
  const [correctiveAction, setCorrectiveAction] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const selectedEquipment = useMemo(
    () => equipment.find(item => item.id === selectedEquipmentId) ?? null,
    [equipment, selectedEquipmentId]
  )

  const numericTemperature = Number(temperature)
  const previewCompliant = Number.isFinite(numericTemperature)
    ? isTemperatureCompliant(numericTemperature, selectedEquipment?.min_temp, selectedEquipment?.max_temp)
    : true

  const load = async () => {
    const today = new Date().toISOString().split('T')[0]
    const [equipmentRes, logsRes] = await Promise.all([
      (supabase.from('equipment') as any)
        .select('*')
        .eq('is_active', true)
        .order('name'),
      (supabase.from('temperature_logs') as any)
        .select('*')
        .gte('recorded_at', `${today}T00:00:00`)
        .order('recorded_at', { ascending: false })
        .limit(50),
    ])

    setEquipment(equipmentRes.data ?? [])
    setLogs(logsRes.data ?? [])
    if (!selectedEquipmentId && equipmentRes.data?.[0]) {
      setSelectedEquipmentId(equipmentRes.data[0].id)
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const handleSave = async () => {
    const value = Number(temperature)
    if (!Number.isFinite(value)) {
      addToast({ type: 'error', message: 'Inserisci una temperatura valida.' })
      return
    }

    const equipmentName = selectedEquipment?.name || manualName.trim()
    if (!equipmentName) {
      addToast({ type: 'error', message: 'Seleziona o inserisci una attrezzatura.' })
      return
    }

    const compliant = isTemperatureCompliant(value, selectedEquipment?.min_temp, selectedEquipment?.max_temp)
    if (!compliant && !correctiveAction.trim()) {
      addToast({ type: 'error', message: 'Per una temperatura fuori soglia serve una azione correttiva.' })
      return
    }

    setSaving(true)
    const { data, error } = await (supabase.from('temperature_logs') as any)
      .insert({
        equipment_id: selectedEquipment?.id ?? null,
        equipment_name: equipmentName,
        temperature: value,
        min_threshold: selectedEquipment?.min_temp ?? null,
        max_threshold: selectedEquipment?.max_temp ?? null,
        is_compliant: compliant,
        corrective_action: compliant ? null : correctiveAction.trim(),
        notes: notes.trim() || null,
        recorded_by: currentStaff?.id ?? null,
      })
      .select()
      .single()

    if (error) {
      addToast({ type: 'error', message: `Errore: ${error.message}` })
      setSaving(false)
      return
    }

    if (!compliant && data) {
      await (supabase.from('non_conformities') as any).insert({
        source_type: 'temperature',
        severity: inferTemperatureSeverity(value, selectedEquipment?.min_temp, selectedEquipment?.max_temp),
        title: `Temperatura fuori soglia - ${equipmentName}`,
        description: `${equipmentName}: rilevati ${value} C, soglia ${formatRange(selectedEquipment?.min_temp, selectedEquipment?.max_temp)}.`,
        detected_by: currentStaff?.id ?? null,
        related_table: 'temperature_logs',
        related_id: data.id,
        immediate_action: correctiveAction.trim(),
        corrective_action: correctiveAction.trim(),
      })
    }

    addToast({
      type: compliant ? 'success' : 'warning',
      message: compliant ? 'Temperatura registrata.' : 'Temperatura registrata e non conformità aperta.',
    })
    setTemperature('')
    setNotes('')
    setCorrectiveAction('')
    await load()
    setSaving(false)
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">🌡️ Temperature</h1>
          <p className="page-subtitle">Registro giornaliero frigo, freezer e attrezzature critiche</p>
        </div>
        <Link href="/non-conformita" className="btn btn--secondary">⚠️ Non conformità</Link>
      </div>

      <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)' }}>
          <div className="form-group">
            <label className="form-label">Attrezzatura</label>
            <select
              className="input"
              value={selectedEquipmentId}
              onChange={event => setSelectedEquipmentId(event.target.value)}
            >
              <option value="">Manuale</option>
              {equipment.map(item => (
                <option key={item.id} value={item.id}>
                  {item.name} - {EQUIPMENT_TYPE_LABELS[item.equipment_type]}
                </option>
              ))}
            </select>
          </div>

          {!selectedEquipment && (
            <div className="form-group">
              <label className="form-label">Nome manuale</label>
              <input
                className="input"
                value={manualName}
                onChange={event => setManualName(event.target.value)}
                placeholder="es. Banco frigo antipasti"
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Temperatura rilevata</label>
            <input
              className="input"
              type="number"
              step="0.1"
              value={temperature}
              onChange={event => setTemperature(event.target.value)}
              placeholder="es. 3.2"
            />
          </div>
        </div>

        {selectedEquipment && (
          <div style={{ marginTop: 'var(--space-3)', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
            Soglia: {formatRange(selectedEquipment.min_temp, selectedEquipment.max_temp)} · Frequenza: ogni {selectedEquipment.check_frequency_hours}h
          </div>
        )}

        {temperature && !previewCompliant && (
          <div className="form-group" style={{ marginTop: 'var(--space-4)' }}>
            <label className="form-label">Azione correttiva obbligatoria</label>
            <textarea
              className="input"
              value={correctiveAction}
              onChange={event => setCorrectiveAction(event.target.value)}
              rows={3}
              placeholder="es. Spostati alimenti in altro frigo, avvisata manutenzione, verificato prodotto..."
            />
          </div>
        )}

        <div className="form-group" style={{ marginTop: 'var(--space-4)' }}>
          <label className="form-label">Note</label>
          <textarea
            className="input"
            value={notes}
            onChange={event => setNotes(event.target.value)}
            rows={2}
            placeholder="Note opzionali"
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-4)' }}>
          <button className="btn btn--primary btn--lg" onClick={handleSave} disabled={saving}>
            {saving ? <><div className="spinner" style={{ width: 18, height: 18 }} /> Salvataggio...</> : '💾 Registra temperatura'}
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-12)' }}>
          <div className="spinner" style={{ width: 40, height: 40 }} />
        </div>
      ) : logs.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon">🌡️</div>
          <div className="empty-state__title">Nessuna temperatura registrata oggi</div>
          <p className="empty-state__desc">Registra il primo controllo giornaliero.</p>
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Ora</th>
                <th>Attrezzatura</th>
                <th>Temperatura</th>
                <th>Soglia</th>
                <th>Stato</th>
                <th>Azione</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr key={log.id}>
                  <td>{formatDateTime(log.recorded_at)}</td>
                  <td style={{ fontWeight: 600 }}>{log.equipment_name}</td>
                  <td>{formatTemp(log.temperature)}</td>
                  <td style={{ color: 'var(--color-text-muted)' }}>{formatRange(log.min_threshold, log.max_threshold)}</td>
                  <td>
                    <span className={`badge ${log.is_compliant ? 'badge--success' : 'badge--danger'}`}>
                      {log.is_compliant ? 'Conforme' : 'Fuori soglia'}
                    </span>
                  </td>
                  <td style={{ color: 'var(--color-text-muted)' }}>{log.corrective_action ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
