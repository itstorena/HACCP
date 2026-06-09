'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToastStore } from '@/store/toastStore'
import { ROLE_LABELS } from '@/lib/utils/formatting'
import { hashPin } from '@/lib/auth/pin'
import type { Database } from '@/types/database'

type StaffMember = Database['public']['Tables']['staff_members']['Row']

export default function StaffPage() {
  const supabase = createClient()
  const { addToast } = useToastStore()
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ first_name: '', last_name: '', role: 'cook' as StaffMember['role'], pin: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase
      .from('staff_members')
      .select('*')
      .order('first_name')
      .then(({ data }) => { setStaff(data ?? []); setLoading(false) })
  }, [])

  const handleCreate = async () => {
    if (!form.first_name || !form.last_name || !form.pin || form.pin.length < 4) {
      addToast({ type: 'error', message: 'Compila tutti i campi. PIN minimo 4 cifre.' })
      return
    }
    setSaving(true)
    const res = await fetch('/api/hash-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: form.pin }),
    })
    const { hash } = await res.json()

    type StaffInsert = Database['public']['Tables']['staff_members']['Insert']
    const insertData: StaffInsert = {
      first_name: form.first_name,
      last_name: form.last_name,
      role: form.role,
      pin_hash: hash,
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from('staff_members') as any).insert(insertData).select().single()

    if (error) {
      addToast({ type: 'error', message: `Errore: ${error.message}` })
    } else {
      setStaff(p => [...p, data])
      addToast({ type: 'success', message: `✅ Staff ${form.first_name} creato!` })
      setShowForm(false)
      setForm({ first_name: '', last_name: '', role: 'cook', pin: '' })
    }
    setSaving(false)
  }

  const toggleActive = async (member: StaffMember) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('staff_members') as any)
      .update({ is_active: !member.is_active })
      .eq('id', member.id)

    if (!error) {
      setStaff(p => p.map(s => s.id === member.id ? { ...s, is_active: !s.is_active } : s))
      addToast({ type: 'info', message: `${member.first_name} ${member.is_active ? 'disattivato' : 'attivato'}` })
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">👤 Gestione Staff</h1>
          <p className="page-subtitle">{staff.length} membri del personale</p>
        </div>
        <button className="btn btn--primary" onClick={() => setShowForm(s => !s)}>
          {showForm ? '✕ Annulla' : '+ Nuovo Staff'}
        </button>
      </div>

      {showForm && (
        <div className="card card--elevated" style={{ marginBottom: 'var(--space-6)' }}>
          <h2 style={{ marginBottom: 'var(--space-5)' }}>Nuovo Membro Staff</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)' }}>
            <div className="form-group">
              <label className="form-label">Nome *</label>
              <input
                className="input"
                value={form.first_name}
                onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))}
                placeholder="Nome"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Cognome *</label>
              <input
                className="input"
                value={form.last_name}
                onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))}
                placeholder="Cognome"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Ruolo</label>
              <select
                className="input"
                value={form.role}
                onChange={e => setForm(f => ({ ...f, role: e.target.value as StaffMember['role'] }))}
              >
                <option value="chef">Chef</option>
                <option value="cook">Cuoco</option>
                <option value="cleaner">Addetto Pulizie</option>
                <option value="manager">Manager</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">PIN (4-6 cifre) *</label>
              <input
                className="input"
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={form.pin}
                onChange={e => setForm(f => ({ ...f, pin: e.target.value.replace(/\D/g, '') }))}
                placeholder="••••"
              />
            </div>
          </div>
          <div style={{ marginTop: 'var(--space-4)', display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn--primary" onClick={handleCreate} disabled={saving}>
              {saving ? <><div className="spinner" style={{ width: 18, height: 18 }} /> Salvataggio…</> : '💾 Crea Staff'}
            </button>
          </div>
        </div>
      )}

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
                <th>Ruolo</th>
                <th>Stato</th>
                <th>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {staff.map(s => (
                <tr key={s.id}>
                  <td style={{ fontWeight: 600 }}>{s.first_name} {s.last_name}</td>
                  <td>
                    <span className="badge badge--neutral">{ROLE_LABELS[s.role]}</span>
                  </td>
                  <td>
                    <span className={`badge ${s.is_active ? 'badge--success' : 'badge--neutral'}`}>
                      {s.is_active ? 'Attivo' : 'Disattivo'}
                    </span>
                  </td>
                  <td>
                    <button
                      className={`btn btn--sm ${s.is_active ? 'btn--secondary' : 'btn--success'}`}
                      onClick={() => toggleActive(s)}
                    >
                      {s.is_active ? 'Disattiva' : 'Attiva'}
                    </button>
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
