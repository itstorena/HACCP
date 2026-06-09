'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useStaffStore } from '@/store/staffStore'
import { useToastStore } from '@/store/toastStore'
import { formatDateTime, formatCountdown, formatTemp } from '@/lib/utils/formatting'
import { BLAST_CYCLE_TARGETS, getCycleProgress, getRemainingMinutes } from '@/lib/utils/compliance'
import { writeAuditLog } from '@/lib/utils/auditLog'
import type { Database } from '@/types/database'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'

type BlastLog = Database['public']['Tables']['blast_chiller_logs']['Row']

export default function AbbattimentoPage() {
  const supabase = useMemo(() => createClient(), [])
  const { currentStaff } = useStaffStore()
  const { addToast } = useToastStore()
  const [activeCycles, setActiveCycles] = useState<BlastLog[]>([])
  const [recentCycles, setRecentCycles] = useState<BlastLog[]>([])
  const [loading, setLoading] = useState(true)
  const [, setTick] = useState(0)
  const canDeleteRecords = currentStaff?.role === 'manager'

  const load = useCallback(async () => {
    const { data } = await (supabase.from('blast_chiller_logs') as any)
      .select('*')
      .order('start_time', { ascending: false })
      .limit(50)

    const rows = ((data as BlastLog[]) ?? [])
    setActiveCycles(rows.filter(cycle => !cycle.end_time))
    setRecentCycles(rows.filter(cycle => cycle.end_time).slice(0, 20))
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    void load()
    const channel = supabase
      .channel('blast-chiller-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'blast_chiller_logs' },
        (payload: RealtimePostgresChangesPayload<BlastLog>) => {
          if (payload.eventType === 'INSERT') {
            setActiveCycles(prev => [payload.new, ...prev])
          } else if (payload.eventType === 'UPDATE') {
            if (payload.new.end_time) {
              setActiveCycles(prev => prev.filter(cycle => cycle.id !== payload.new.id))
              setRecentCycles(prev => [payload.new, ...prev.slice(0, 19)])
            } else {
              setActiveCycles(prev => prev.map(cycle => cycle.id === payload.new.id ? payload.new : cycle))
            }
          } else if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as Partial<BlastLog>).id
            setActiveCycles(prev => prev.filter(cycle => cycle.id !== deletedId))
            setRecentCycles(prev => prev.filter(cycle => cycle.id !== deletedId))
          }
        }
      )
      .subscribe()

    const interval = setInterval(() => setTick(tick => tick + 1), 1000)
    return () => {
      void supabase.removeChannel(channel)
      clearInterval(interval)
    }
  }, [load, supabase])

  const handleDeleteCycle = async (cycle: BlastLog) => {
    if (!canDeleteRecords) {
      addToast({ type: 'error', message: 'Eliminazione consentita solo a manager o amministratore.' })
      return
    }

    const confirmed = window.confirm(`Eliminare il ciclo abbattitore avviato il ${formatDateTime(cycle.start_time)}? Usa questa funzione solo per errori umani di inserimento.`)
    if (!confirmed) return

    await writeAuditLog(supabase, {
      tableName: 'blast_chiller_logs',
      recordId: cycle.id,
      action: 'delete',
      staff: currentStaff,
      beforeData: cycle,
      afterData: { reason: 'Eliminazione per errore umano confermata dall operatore' },
    })

    await (supabase.from('non_conformities') as any)
      .delete()
      .eq('related_table', 'blast_chiller_logs')
      .eq('related_id', cycle.id)

    const { error } = await (supabase.from('blast_chiller_logs') as any)
      .delete()
      .eq('id', cycle.id)

    if (error) {
      addToast({ type: 'error', message: `Eliminazione non riuscita: ${error.message}` })
      return
    }

    setActiveCycles(prev => prev.filter(item => item.id !== cycle.id))
    setRecentCycles(prev => prev.filter(item => item.id !== cycle.id))
    addToast({ type: 'success', message: 'Ciclo abbattitore eliminato.' })
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Abbattitore</h1>
          <p className="page-subtitle">
            {activeCycles.length > 0
              ? `${activeCycles.length} cicl${activeCycles.length === 1 ? 'o' : 'i'} attiv${activeCycles.length === 1 ? 'o' : 'i'}`
              : 'Nessun ciclo attivo'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
          <div className="realtime-dot" />
          <Link href="/abbattimento/nuovo" className="btn btn--primary">
            Avvia ciclo
          </Link>
        </div>
      </div>

      {activeCycles.length > 0 && (
        <div style={{ marginBottom: 'var(--space-8)' }}>
          <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, marginBottom: 'var(--space-4)' }}>
            Cicli in corso
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--space-4)' }}>
            {activeCycles.map(cycle => {
              const target = BLAST_CYCLE_TARGETS[cycle.cycle_type]
              const targetTemp = cycle.target_temp ?? target.targetTemp
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
                    <span className="badge badge--warning">In corso</span>
                  </div>

                  <div className="blast-card__countdown" style={{ color: isOvertime ? 'var(--color-danger)' : 'var(--color-primary)' }}>
                    {isOvertime ? 'Scaduto' : formatCountdown(remaining)}
                  </div>

                  <div>
                    <div className="blast-card__progress">
                      <div
                        className="blast-card__progress-fill"
                        style={{
                          width: `${progress}%`,
                          background: isOvertime
                            ? 'linear-gradient(90deg, var(--color-danger), #dc2626)'
                            : undefined,
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: 'var(--space-1)' }}>
                      <span>Temp. inizio: {formatTemp(cycle.start_temp)}</span>
                      <span>Target: {targetTemp} C in {cycle.target_time_minutes} min</span>
                    </div>
                  </div>

                  <div className="no-print" style={{ display: 'grid', gridTemplateColumns: canDeleteRecords ? '1fr 1fr' : '1fr', gap: 'var(--space-2)' }}>
                    <Link
                      href={`/abbattimento/${cycle.id}/chiudi`}
                      className="btn btn--danger"
                    >
                      Chiudi ciclo
                    </Link>
                    {canDeleteRecords && (
                      <button className="btn btn--secondary" onClick={() => handleDeleteCycle(cycle)}>
                        Elimina
                      </button>
                    )}
                  </div>
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
          <div style={{ fontWeight: 600 }}>Nessun ciclo attivo</div>
          <p style={{ fontSize: 'var(--text-sm)' }}>Abbattitore libero</p>
        </div>
      )}

      {recentCycles.length > 0 && (
        <div>
          <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, marginBottom: 'var(--space-4)' }}>
            Cicli recenti
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
                  <th>Conformita</th>
                  <th className="no-print">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {recentCycles.map(cycle => (
                  <tr key={cycle.id}>
                    <td>
                      <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>
                        {cycle.cycle_type === 'positive_3c' ? 'Positivo' : 'Negativo'}
                      </span>
                    </td>
                    <td style={{ color: 'var(--color-text-muted)' }}>{formatDateTime(cycle.start_time)}</td>
                    <td style={{ color: 'var(--color-text-muted)' }}>{cycle.end_time ? formatDateTime(cycle.end_time) : '-'}</td>
                    <td>{formatTemp(cycle.start_temp)}</td>
                    <td>{formatTemp(cycle.end_temp)}</td>
                    <td>
                      <span className={`badge ${cycle.is_compliant ? 'badge--success' : 'badge--danger'}`}>
                        {cycle.is_compliant ? 'Conforme' : 'Non conforme'}
                      </span>
                    </td>
                    <td className="no-print">
                      {canDeleteRecords && (
                        <button className="btn btn--danger btn--sm" onClick={() => handleDeleteCycle(cycle)}>
                          Elimina
                        </button>
                      )}
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
