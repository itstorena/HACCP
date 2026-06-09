'use client'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatDateTime, formatCountdown, formatTemp } from '@/lib/utils/formatting'
import { BLAST_CYCLE_TARGETS, getCycleProgress, getRemainingMinutes } from '@/lib/utils/compliance'
import type { Database } from '@/types/database'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'

type BlastLog = Database['public']['Tables']['blast_chiller_logs']['Row']

export default function AbbattimentoPage() {
  const supabase = createClient()
  const [activeCycles, setActiveCycles] = useState<BlastLog[]>([])
  const [recentCycles, setRecentCycles] = useState<BlastLog[]>([])
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)

  const load = useCallback(async () => {
    const { data } = await (supabase.from('blast_chiller_logs') as any)
      .select('*')
      .order('start_time', { ascending: false })
      .limit(50)

    const active = ((data as BlastLog[]) ?? []).filter(c => !c.end_time)
    const recent = ((data as BlastLog[]) ?? []).filter(c => c.end_time).slice(0, 20)
    setActiveCycles(active)
    setRecentCycles(recent)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const channel = supabase
      .channel('blast-chiller-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'blast_chiller_logs' },
        (payload: RealtimePostgresChangesPayload<BlastLog>) => {
          if (payload.eventType === 'INSERT') {
            setActiveCycles(p => [payload.new, ...p])
          } else if (payload.eventType === 'UPDATE') {
            if (payload.new.end_time) {
              setActiveCycles(p => p.filter(c => c.id !== payload.new.id))
              setRecentCycles(p => [payload.new, ...p.slice(0, 19)])
            } else {
              setActiveCycles(p => p.map(c => c.id === payload.new.id ? payload.new : c))
            }
          }
        }
      )
      .subscribe()

    // Tick per aggiornare countdown ogni secondo
    const interval = setInterval(() => setTick(t => t + 1), 1000)
    return () => { supabase.removeChannel(channel); clearInterval(interval) }
  }, [load])

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">🧊 Abbattitore</h1>
          <p className="page-subtitle">
            {activeCycles.length > 0
              ? `${activeCycles.length} cicl${activeCycles.length === 1 ? 'o' : 'i'} attiv${activeCycles.length === 1 ? 'o' : 'i'}`
              : 'Nessun ciclo attivo'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
          <div className="realtime-dot" />
          <Link href="/abbattimento/nuovo" className="btn btn--primary">
            🧊 Avvia Ciclo
          </Link>
        </div>
      </div>

      {/* Active cycles */}
      {activeCycles.length > 0 && (
        <div style={{ marginBottom: 'var(--space-8)' }}>
          <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, marginBottom: 'var(--space-4)' }}>
            ⏳ Cicli in Corso
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--space-4)' }}>
            {activeCycles.map((cycle) => {
              const target = BLAST_CYCLE_TARGETS[cycle.cycle_type]
              const remaining = getRemainingMinutes(cycle.start_time, cycle.target_time_minutes) * 60 * 1000
              const progress = getCycleProgress(cycle.start_time, cycle.target_time_minutes)
              const isOvertime = remaining <= 0

              return (
                <div key={cycle.id} className={`blast-card blast-card--active blast-card--${cycle.cycle_type === 'positive_3c' ? 'positive' : 'negative'}`}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {target.label}
                      </div>
                      <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginTop: 'var(--space-1)' }}>
                        Avviato {formatDateTime(cycle.start_time)}
                      </div>
                    </div>
                    <span className="badge badge--warning">IN CORSO</span>
                  </div>

                  <div className="blast-card__countdown" style={{ color: isOvertime ? 'var(--color-danger)' : 'var(--color-primary)' }}>
                    {isOvertime ? '⚠️ SCADUTO' : formatCountdown(remaining)}
                  </div>

                  <div>
                    <div className="blast-card__progress">
                      <div
                        className="blast-card__progress-fill"
                        style={{
                          width: `${progress}%`,
                          background: isOvertime
                            ? 'linear-gradient(90deg, var(--color-danger), #dc2626)'
                            : undefined
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: 'var(--space-1)' }}>
                      <span>Temp. inizio: {formatTemp(cycle.start_temp)}</span>
                      <span>Target: {target.targetTemp}°C in {cycle.target_time_minutes}min</span>
                    </div>
                  </div>

                  <Link
                    href={`/abbattimento/${cycle.id}/chiudi`}
                    className="btn btn--danger btn--full"
                  >
                    🏁 Chiudi Ciclo
                  </Link>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-12)' }}>
          <div className="spinner" style={{ width: 40, height: 40 }} />
        </div>
      )}

      {!loading && activeCycles.length === 0 && (
        <div style={{
          background: 'var(--color-success-dim)',
          border: '1px solid rgba(16,185,129,0.3)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-6)',
          textAlign: 'center',
          marginBottom: 'var(--space-8)',
        }}>
          <div style={{ fontSize: '2rem', marginBottom: 'var(--space-2)' }}>✅</div>
          <div style={{ fontWeight: 600 }}>Nessun ciclo attivo</div>
          <p style={{ fontSize: 'var(--text-sm)' }}>Abbattitore libero</p>
        </div>
      )}

      {/* Recent cycles */}
      {recentCycles.length > 0 && (
        <div>
          <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, marginBottom: 'var(--space-4)' }}>
            📋 Cicli Recenti
          </h2>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Inizio</th>
                  <th>Fine</th>
                  <th>T. Inizio</th>
                  <th>T. Fine</th>
                  <th>Conformità</th>
                </tr>
              </thead>
              <tbody>
                {recentCycles.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>
                        {c.cycle_type === 'positive_3c' ? '🌡️ Positivo' : '❄️ Negativo'}
                      </span>
                    </td>
                    <td style={{ color: 'var(--color-text-muted)' }}>{formatDateTime(c.start_time)}</td>
                    <td style={{ color: 'var(--color-text-muted)' }}>{c.end_time ? formatDateTime(c.end_time) : '—'}</td>
                    <td>{formatTemp(c.start_temp)}</td>
                    <td>{formatTemp(c.end_temp)}</td>
                    <td>
                      <span className={`badge ${c.is_compliant ? 'badge--success' : 'badge--danger'}`}>
                        {c.is_compliant ? 'Conforme' : 'Non Conforme'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
