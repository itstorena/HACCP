'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { useToastStore } from '@/store/toastStore'
import { useStaffStore } from '@/store/staffStore'
import { checkBlastComplianceAgainstTarget, BLAST_CYCLE_TARGETS } from '@/lib/utils/compliance'
import { formatDateTime, formatTemp } from '@/lib/utils/formatting'
import Link from 'next/link'
import type { Database } from '@/types/database'

type BlastLog = Database['public']['Tables']['blast_chiller_logs']['Row']

const schema = z.object({
  end_temp: z.number().min(-40, 'Temperatura minima -40°C').max(40, 'Temperatura massima 40°C'),
  corrective_action: z.string().optional(),
  notes: z.string().optional(),
})

type FormData = z.infer<typeof schema>

export default function ChiudiCicloPage() {
  const params = useParams()
  const id = params.id as string
  const router = useRouter()
  const supabase = createClient()
  const { addToast } = useToastStore()
  const { currentStaff } = useStaffStore()
  const [cycle, setCycle] = useState<BlastLog | null>(null)
  const [loading, setLoading] = useState(false)
  const [fetchLoading, setFetchLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('blast_chiller_logs')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        setCycle(data)
        setFetchLoading(false)
      })
  }, [id])

  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema) as any,
  })

  const endTemp = watch('end_temp')
  const targetTemp = cycle?.target_temp ?? (cycle ? BLAST_CYCLE_TARGETS[cycle.cycle_type].targetTemp : 0)
  const isCompliant = cycle
    ? checkBlastComplianceAgainstTarget(cycle.start_time, new Date().toISOString(), endTemp, targetTemp, cycle.target_time_minutes)
    : null

  const onSubmit = async (data: FormData) => {
    if (!cycle) return
    setLoading(true)

    const endTime = new Date().toISOString()
    const cycleTargetTemp = cycle.target_temp ?? BLAST_CYCLE_TARGETS[cycle.cycle_type].targetTemp
    const compliant = checkBlastComplianceAgainstTarget(cycle.start_time, endTime, data.end_temp, cycleTargetTemp, cycle.target_time_minutes)

    const { error } = await (supabase.from('blast_chiller_logs') as any)
      .update({
        end_time: endTime,
        end_temp: data.end_temp,
        is_compliant: compliant,
        corrective_action: !compliant ? (data.corrective_action ?? null) : null,
        verified_by: currentStaff?.id ?? null,
        notes: data.notes ?? null,
      })
      .eq('id', id)

    if (error) {
      addToast({ type: 'error', message: `Errore: ${error.message}` })
      setLoading(false)
      return
    }

    if (!compliant) {
      await supabase.from('non_conformities').insert({
        source_type: 'blast_chiller',
        severity: 'high',
        title: 'Ciclo abbattitore non conforme',
        description: `Temperatura finale ${data.end_temp} C su target ${cycleTargetTemp} C entro ${cycle.target_time_minutes} minuti.`,
        detected_by: currentStaff?.id ?? null,
        related_table: 'blast_chiller_logs',
        related_id: id,
        immediate_action: data.corrective_action ?? 'Lotto isolato in attesa di valutazione.',
        corrective_action: data.corrective_action ?? null,
      })
    }

    addToast({
      type: compliant ? 'success' : 'warning',
      message: compliant
        ? '✅ Ciclo chiuso — CONFORME alle norme HACCP'
        : '⚠️ Ciclo chiuso — NON CONFORME. Azione correttiva registrata.',
      duration: 6000,
    })
    router.push('/abbattimento')
  }

  if (fetchLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-12)' }}>
        <div className="spinner" style={{ width: 40, height: 40 }} />
      </div>
    )
  }

  if (!cycle) return (
    <div className="empty-state">
      <div className="empty-state__icon">❌</div>
      <div className="empty-state__title">Ciclo non trovato</div>
      <Link href="/abbattimento" className="btn btn--primary">← Torna all'abbattitore</Link>
    </div>
  )

  const target = BLAST_CYCLE_TARGETS[cycle.cycle_type]

  return (
    <div style={{ maxWidth: 560, margin: '0 auto' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">🏁 Chiudi Ciclo</h1>
          <p className="page-subtitle">{target.label}</p>
        </div>
        <Link href="/abbattimento" className="btn btn--ghost">← Torna indietro</Link>
      </div>

      {/* Cycle summary */}
      <div className="card card--elevated" style={{ marginBottom: 'var(--space-5)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', fontSize: 'var(--text-sm)' }}>
          <div>
            <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Avviato</div>
            <div style={{ fontWeight: 600 }}>{formatDateTime(cycle.start_time)}</div>
          </div>
          <div>
            <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Temperatura Iniziale</div>
            <div style={{ fontWeight: 600 }}>{formatTemp(cycle.start_temp)}</div>
          </div>
          <div>
            <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Target</div>
            <div style={{ fontWeight: 600 }}>≤{targetTemp}°C in {cycle.target_time_minutes}min</div>
          </div>
          {endTemp !== undefined && isCompliant !== null && (
            <div>
              <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Conformità Prevista</div>
              <span className={`badge ${isCompliant ? 'badge--success' : 'badge--danger'}`}>
                {isCompliant ? '✅ Conforme' : '❌ Non Conforme'}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>

          <div className="form-group">
            <label className="form-label">Temperatura Finale (°C) *</label>
            <input
              type="number"
              step="0.1"
              {...register('end_temp', { valueAsNumber: true })}
              className="input"
              placeholder="es. 2.5"
              autoFocus
            />
            {errors.end_temp && <span className="form-error">{errors.end_temp.message}</span>}
            {endTemp !== undefined && isCompliant === false && (
              <div style={{ color: 'var(--color-warning)', fontSize: 'var(--text-sm)', marginTop: 'var(--space-1)' }}>
                ⚠️ Temperatura sopra il target ({targetTemp}°C) — ciclo NON conforme
              </div>
            )}
          </div>

          {isCompliant === false && (
            <div className="form-group">
              <label className="form-label">Azione Correttiva *</label>
              <textarea
                {...register('corrective_action')}
                className="input"
                placeholder="Descrivi l'azione correttiva adottata…"
                rows={3}
                required
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Note</label>
            <textarea {...register('notes')} className="input" placeholder="Note aggiuntive (opzionale)" rows={2} />
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
            <Link href="/abbattimento" className="btn btn--secondary">Annulla</Link>
            <button type="submit" className="btn btn--danger btn--lg" disabled={loading}>
              {loading
                ? <><div className="spinner" style={{ width: 20, height: 20 }} /> Chiusura…</>
                : '🏁 Chiudi e Registra'
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
