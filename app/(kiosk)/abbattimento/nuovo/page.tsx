'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { useStaffStore } from '@/store/staffStore'
import { useToastStore } from '@/store/toastStore'
import { BLAST_CYCLE_TARGETS } from '@/lib/utils/compliance'
import Link from 'next/link'
import type { Database } from '@/types/database'

type InternalBatch = Database['public']['Tables']['internal_batches']['Row']

const schema = z.object({
  cycle_type: z.enum(['positive_3c', 'negative_18c']),
  internal_batch_id: z.string().min(1, 'Seleziona un lotto'),
  start_temp: z.number().min(-30, 'Temperatura minima -30°C').max(100, 'Temperatura massima 100°C'),
  notes: z.string().optional(),
})

type FormData = z.infer<typeof schema>

export default function NuovoAbbattimentoPage() {
  const router = useRouter()
  const supabase = createClient()
  const { currentStaff } = useStaffStore()
  const { addToast } = useToastStore()
  const [batches, setBatches] = useState<InternalBatch[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    supabase
      .from('internal_batches')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => setBatches(data ?? []))
  }, [])

  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { cycle_type: 'positive_3c' },
  })

  const selectedType = watch('cycle_type')
  const target = BLAST_CYCLE_TARGETS[selectedType]

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    const { error } = await (supabase.from('blast_chiller_logs') as any).insert({
      cycle_type: data.cycle_type,
      internal_batch_id: data.internal_batch_id,
      start_temp: data.start_temp,
      target_time_minutes: target.minutes,
      operator_id: currentStaff?.id ?? null,
      notes: data.notes ?? null,
    })

    if (error) {
      addToast({ type: 'error', message: `Errore: ${error.message}` })
      setLoading(false)
      return
    }

    addToast({ type: 'success', message: '🧊 Ciclo abbattimento avviato!' })
    router.push('/abbattimento')
  }

  return (
    <div style={{ maxWidth: 580, margin: '0 auto' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Avvia Abbattimento</h1>
          <p className="page-subtitle">Nuovo ciclo abbattitore termico</p>
        </div>
        <Link href="/abbattimento" className="btn btn--ghost">← Torna indietro</Link>
      </div>

      <div className="card">
        <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>

          {/* Tipo ciclo */}
          <div className="form-group">
            <label className="form-label">Tipo Abbattimento *</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
              {(['positive_3c', 'negative_18c'] as const).map(type => {
                const t = BLAST_CYCLE_TARGETS[type]
                const selected = selectedType === type
                return (
                  <label
                    key={type}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 'var(--space-2)',
                      padding: 'var(--space-4)',
                      background: selected ? 'var(--color-primary-dim)' : 'var(--color-surface-2)',
                      border: `2px solid ${selected ? 'var(--color-primary)' : 'var(--color-border)'}`,
                      borderRadius: 'var(--radius-lg)',
                      cursor: 'pointer',
                      transition: 'all var(--transition-fast)',
                    }}
                  >
                    <input type="radio" {...register('cycle_type')} value={type} style={{ display: 'none' }} />
                    <div style={{ fontSize: 'var(--text-xl)' }}>
                      {type === 'positive_3c' ? '🌡️' : '❄️'}
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 'var(--text-sm)' }}>
                      {type === 'positive_3c' ? '+3°C' : '-18°C'}
                    </div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                      {t.minutes} minuti target
                    </div>
                  </label>
                )
              })}
            </div>
          </div>

          {/* Info ciclo selezionato */}
          <div style={{
            background: 'var(--color-primary-dim)',
            border: '1px solid rgba(245,158,11,0.3)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-4)',
            fontSize: 'var(--text-sm)',
          }}>
            <strong style={{ color: 'var(--color-primary)' }}>ℹ️ {target.label}</strong>
            <p style={{ marginTop: 'var(--space-1)', color: 'var(--color-text-muted)' }}>
              Target: ≤{target.targetTemp}°C in {target.minutes} minuti
            </p>
          </div>

          {/* Selezione lotto */}
          <div className="form-group">
            <label className="form-label">Lotto Interno *</label>
            <select {...register('internal_batch_id')} className="input">
              <option value="">— Seleziona lotto —</option>
              {batches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
            {errors.internal_batch_id && <span className="form-error">{errors.internal_batch_id.message}</span>}
          </div>

          {/* Temperatura iniziale */}
          <div className="form-group">
            <label className="form-label">Temperatura Iniziale (°C) *</label>
            <input
              type="number"
              step="0.1"
              {...register('start_temp', { valueAsNumber: true })}
              className="input"
              placeholder="es. 65"
            />
            {errors.start_temp && <span className="form-error">{errors.start_temp.message}</span>}
          </div>

          <div className="form-group">
            <label className="form-label">Note</label>
            <textarea {...register('notes')} className="input" placeholder="Note aggiuntive (opzionale)" rows={2} />
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
            <Link href="/abbattimento" className="btn btn--secondary">Annulla</Link>
            <button type="submit" className="btn btn--primary btn--lg" disabled={loading}>
              {loading
                ? <><div className="spinner" style={{ width: 20, height: 20 }} /> Avvio…</>
                : '🧊 Avvia Abbattimento'
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
