'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToastStore } from '@/store/toastStore'
import { ROLE_LABELS } from '@/lib/utils/formatting'
import type { Database } from '@/types/database'

type StaffMember = Database['public']['Tables']['staff_members']['Row']

export default function StaffPage() {
  const supabase = createClient()
  const { addToast } = useToastStore()
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)
  
  // Create form state
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [createForm, setCreateForm] = useState({ first_name: '', last_name: '', role: 'cook' as StaffMember['role'], pin: '' })
  
  // Edit form state
  const [editingMember, setEditingMember] = useState<StaffMember | null>(null)
  const [editForm, setEditForm] = useState({ first_name: '', last_name: '', role: 'cook' as StaffMember['role'], pin: '' })
  
  const [saving, setSaving] = useState(false)

  const loadStaff = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('staff_members')
      .select('*')
      .order('first_name')
    setStaff((data as StaffMember[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    loadStaff()
  }, [])

  const handleCreate = async () => {
    if (!createForm.first_name || !createForm.last_name || !createForm.pin || createForm.pin.length < 4) {
      addToast({ type: 'error', message: 'Compila tutti i campi obbligatori. PIN minimo 4 cifre.' })
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/hash-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: createForm.pin }),
      })
      const { hash } = await res.json()

      type StaffInsert = Database['public']['Tables']['staff_members']['Insert']
      const insertData: StaffInsert = {
        first_name: createForm.first_name,
        last_name: createForm.last_name,
        role: createForm.role,
        pin_hash: hash,
      }
      
      const { data, error } = await (supabase.from('staff_members') as any)
        .insert(insertData)
        .select()
        .single()

      if (error) {
        addToast({ type: 'error', message: `Errore creazione: ${error.message}` })
      } else {
        setStaff(p => [...p, data as StaffMember])
        addToast({ type: 'success', message: `✅ Staff ${createForm.first_name} creato!` })
        setShowCreateForm(false)
        setCreateForm({ first_name: '', last_name: '', role: 'cook', pin: '' })
      }
    } catch (e: any) {
      addToast({ type: 'error', message: `Errore: ${e.message}` })
    }
    setSaving(false)
  }

  const handleStartEdit = (member: StaffMember) => {
    setEditingMember(member)
    setEditForm({
      first_name: member.first_name,
      last_name: member.last_name,
      role: member.role,
      pin: '', // Lascia vuoto se non vuole cambiare PIN
    })
    setShowCreateForm(false)
  }

  const handleSaveEdit = async () => {
    if (!editingMember) return
    if (!editForm.first_name || !editForm.last_name) {
      addToast({ type: 'error', message: 'Nome e Cognome sono obbligatori.' })
      return
    }
    if (editForm.pin && editForm.pin.length < 4) {
      addToast({ type: 'error', message: 'Il PIN deve essere di almeno 4 cifre.' })
      return
    }

    setSaving(true)
    try {
      let hash = null
      if (editForm.pin) {
        const res = await fetch('/api/hash-pin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin: editForm.pin }),
        })
        const data = await res.json()
        hash = data.hash
      }

      const updateData: any = {
        first_name: editForm.first_name,
        last_name: editForm.last_name,
        role: editForm.role,
      }
      if (hash) {
        updateData.pin_hash = hash
      }

      const { data, error } = await (supabase.from('staff_members') as any)
        .update(updateData)
        .eq('id', editingMember.id)
        .select()
        .single()

      if (error) {
        addToast({ type: 'error', message: `Errore modifica: ${error.message}` })
      } else {
        setStaff(p => p.map(s => s.id === editingMember.id ? (data as StaffMember) : s))
        addToast({ type: 'success', message: `✅ Staff ${editForm.first_name} modificato!` })
        setEditingMember(null)
      }
    } catch (e: any) {
      addToast({ type: 'error', message: `Errore: ${e.message}` })
    }
    setSaving(false)
  }

  const toggleActive = async (member: StaffMember) => {
    const { error } = await (supabase.from('staff_members') as any)
      .update({ is_active: !member.is_active })
      .eq('id', member.id)

    if (!error) {
      setStaff(p => p.map(s => s.id === member.id ? { ...s, is_active: !s.is_active } : s))
      addToast({ type: 'info', message: `${member.first_name} ${member.is_active ? 'disattivato' : 'attivato'}` })
    } else {
      addToast({ type: 'error', message: `Errore: ${error.message}` })
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">👤 Gestione Staff</h1>
          <p className="page-subtitle">{staff.length} membri del personale</p>
        </div>
        {!editingMember && (
          <button className="btn btn--primary" onClick={() => { setShowCreateForm(s => !s); setEditingMember(null) }}>
            {showCreateForm ? '✕ Annulla' : '+ Nuovo Staff'}
          </button>
        )}
      </div>

      {/* Form di Creazione */}
      {showCreateForm && (
        <div className="card card--elevated" style={{ marginBottom: 'var(--space-6)' }}>
          <h2 style={{ marginBottom: 'var(--space-5)' }}>Nuovo Membro Staff</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)' }}>
            <div className="form-group">
              <label className="form-label">Nome *</label>
              <input
                className="input"
                value={createForm.first_name}
                onChange={e => setCreateForm(f => ({ ...f, first_name: e.target.value }))}
                placeholder="Nome"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Cognome *</label>
              <input
                className="input"
                value={createForm.last_name}
                onChange={e => setCreateForm(f => ({ ...f, last_name: e.target.value }))}
                placeholder="Cognome"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Ruolo</label>
              <select
                className="input"
                value={createForm.role}
                onChange={e => setCreateForm(f => ({ ...f, role: e.target.value as StaffMember['role'] }))}
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
                value={createForm.pin}
                onChange={e => setCreateForm(f => ({ ...f, pin: e.target.value.replace(/\D/g, '') }))}
                placeholder="••••"
              />
            </div>
          </div>
          <div style={{ marginTop: 'var(--space-4)', display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
            <button className="btn btn--secondary" onClick={() => setShowCreateForm(false)}>Annulla</button>
            <button className="btn btn--primary" onClick={handleCreate} disabled={saving}>
              {saving ? <><div className="spinner" style={{ width: 18, height: 18 }} /> Salvataggio…</> : '💾 Crea Staff'}
            </button>
          </div>
        </div>
      )}

      {/* Form di Modifica */}
      {editingMember && (
        <div className="card card--elevated" style={{ marginBottom: 'var(--space-6)', border: '1px solid var(--color-primary)' }}>
          <h2 style={{ marginBottom: 'var(--space-5)' }}>Modifica Staff: {editingMember.first_name} {editingMember.last_name}</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)' }}>
            <div className="form-group">
              <label className="form-label">Nome *</label>
              <input
                className="input"
                value={editForm.first_name}
                onChange={e => setEditForm(f => ({ ...f, first_name: e.target.value }))}
                placeholder="Nome"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Cognome *</label>
              <input
                className="input"
                value={editForm.last_name}
                onChange={e => setEditForm(f => ({ ...f, last_name: e.target.value }))}
                placeholder="Cognome"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Ruolo</label>
              <select
                className="input"
                value={editForm.role}
                onChange={e => setEditForm(f => ({ ...f, role: e.target.value as StaffMember['role'] }))}
              >
                <option value="chef">Chef</option>
                <option value="cook">Cuoco</option>
                <option value="cleaner">Addetto Pulizie</option>
                <option value="manager">Manager</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Nuovo PIN (lascia vuoto per non cambiarlo)</label>
              <input
                className="input"
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={editForm.pin}
                onChange={e => setEditForm(f => ({ ...f, pin: e.target.value.replace(/\D/g, '') }))}
                placeholder="••••"
              />
            </div>
          </div>
          <div style={{ marginTop: 'var(--space-4)', display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
            <button className="btn btn--secondary" onClick={() => setEditingMember(null)}>Annulla</button>
            <button className="btn btn--primary" onClick={handleSaveEdit} disabled={saving}>
              {saving ? <><div className="spinner" style={{ width: 18, height: 18 }} /> Salvataggio…</> : '💾 Salva Modifiche'}
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
                    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                      <button
                        className="btn btn--sm btn--secondary"
                        onClick={() => handleStartEdit(s)}
                      >
                        ✏️ Modifica
                      </button>
                      <button
                        className={`btn btn--sm ${s.is_active ? 'btn--ghost' : 'btn--success'}`}
                        onClick={() => toggleActive(s)}
                        style={{ color: s.is_active ? 'var(--color-danger)' : undefined }}
                      >
                        {s.is_active ? 'Disattiva' : 'Attiva'}
                      </button>
                    </div>
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
