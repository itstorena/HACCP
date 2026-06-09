'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ROLE_LABELS } from '@/lib/utils/formatting'
import { EQUIPMENT_TYPE_LABELS } from '@/lib/utils/haccp'
import type { Database } from '@/types/database'

type PlanItem = Database['public']['Tables']['haccp_plan_items']['Row']
type BlastProfile = Database['public']['Tables']['blast_chiller_profiles']['Row']
type Equipment = Database['public']['Tables']['equipment']['Row']

export default function PianoHaccpPage() {
  const supabase = createClient()
  const [planItems, setPlanItems] = useState<PlanItem[]>([])
  const [profiles, setProfiles] = useState<BlastProfile[]>([])
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('haccp_plan_items').select('*').eq('is_active', true).order('area'),
      supabase.from('blast_chiller_profiles').select('*').eq('is_active', true).order('label'),
      supabase.from('equipment').select('*').eq('is_active', true).order('name'),
    ]).then(([planRes, profileRes, equipmentRes]) => {
      setPlanItems(planRes.data ?? [])
      setProfiles(profileRes.data ?? [])
      setEquipment(equipmentRes.data ?? [])
      setLoading(false)
    })
  }, [])

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">📋 Piano HACCP</h1>
          <p className="page-subtitle">CCP, limiti critici, frequenze, azioni correttive e attrezzature</p>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-12)' }}>
          <div className="spinner" style={{ width: 40, height: 40 }} />
        </div>
      ) : (
        <>
          <div className="kpi-grid" style={{ marginBottom: 'var(--space-8)' }}>
            <div className="kpi-card kpi-card--primary">
              <div className="kpi-label">Procedure Attive</div>
              <div className="kpi-value">{planItems.length}</div>
            </div>
            <div className="kpi-card kpi-card--danger">
              <div className="kpi-label">CCP</div>
              <div className="kpi-value">{planItems.filter(item => item.is_ccp).length}</div>
            </div>
            <div className="kpi-card kpi-card--info">
              <div className="kpi-label">Profili Abbattitore</div>
              <div className="kpi-value">{profiles.length}</div>
            </div>
            <div className="kpi-card kpi-card--success">
              <div className="kpi-label">Attrezzature</div>
              <div className="kpi-value">{equipment.length}</div>
            </div>
          </div>

          <section style={{ marginBottom: 'var(--space-8)' }}>
            <h2 style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-4)' }}>Procedure e CCP</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 'var(--space-4)' }}>
              {planItems.map(item => (
                <article key={item.id} className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                    <div>
                      <div style={{ color: 'var(--color-primary)', fontSize: 'var(--text-xs)', fontWeight: 700 }}>{item.code} · {item.area}</div>
                      <h3 style={{ fontSize: 'var(--text-lg)', marginTop: 'var(--space-1)' }}>{item.process_step}</h3>
                    </div>
                    <span className={`badge ${item.is_ccp ? 'badge--danger' : 'badge--neutral'}`}>{item.is_ccp ? 'CCP' : 'PRP'}</span>
                  </div>
                  <p style={{ fontSize: 'var(--text-sm)' }}><strong>Pericolo:</strong> {item.hazard}</p>
                  <p style={{ fontSize: 'var(--text-sm)' }}><strong>Misura:</strong> {item.control_measure}</p>
                  <div style={{ background: 'var(--color-surface-2)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)', marginTop: 'var(--space-3)', fontSize: 'var(--text-sm)' }}>
                    <strong>Limite:</strong> {item.critical_limit}<br />
                    <strong>Frequenza:</strong> {item.monitoring_frequency}<br />
                    <strong>Responsabile:</strong> {ROLE_LABELS[item.owner_role]}
                  </div>
                  <p style={{ fontSize: 'var(--text-sm)', marginTop: 'var(--space-3)' }}><strong>Azione correttiva:</strong> {item.corrective_action}</p>
                </article>
              ))}
            </div>
          </section>

          <section style={{ marginBottom: 'var(--space-8)' }}>
            <h2 style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-4)' }}>Profili abbattitore</h2>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Profilo</th>
                    <th>Ciclo</th>
                    <th>Categoria</th>
                    <th>Target</th>
                    <th>Tempo</th>
                    <th>Riferimento</th>
                  </tr>
                </thead>
                <tbody>
                  {profiles.map(profile => (
                    <tr key={profile.id}>
                      <td style={{ fontWeight: 600 }}>{profile.label}</td>
                      <td>{profile.cycle_type === 'positive_3c' ? '+3°C' : '-18°C'}</td>
                      <td>{profile.product_category}</td>
                      <td>{profile.target_temp}°C</td>
                      <td>{profile.target_time_minutes} min</td>
                      <td style={{ color: 'var(--color-text-muted)' }}>{profile.legal_reference ?? 'Piano HACCP'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-4)' }}>Attrezzature monitorate</h2>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Tipo</th>
                    <th>Area</th>
                    <th>Soglia</th>
                    <th>Frequenza</th>
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
