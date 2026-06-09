'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { useStaffStore } from '@/store/staffStore'
import { useToastStore } from '@/store/toastStore'
import Link from 'next/link'

const schema = z.object({
  name: z.string().min(2, 'Nome obbligatorio (min. 2 caratteri)'),
  description: z.string().optional(),
  expires_hours: z.number().min(1, 'Minimo 1 ora').max(720, 'Massimo 30 giorni'),
})

type FormData = z.infer<typeof schema>

export default function NuovoLottoPage() {
  const router = useRouter()
  const supabase = createClient()
  const { currentStaff } = useStaffStore()
  const { addToast } = useToastStore()
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { expires_hours: 24 },
  })

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    const expires_at = new Date(Date.now() + data.expires_hours * 3600000).toISOString()

    const { error } = await (supabase.from('internal_batches') as any).insert({
      name: data.name,
      description: data.description ?? null,
      expires_at,
      prepared_by: currentStaff?.id ?? null,
    })

    if (error) {
      addToast({ type: 'error', message: `Errore: ${error.message}` })
      setLoading(false)
      return
    }

    addToast({ type: 'success', message: '✅ Lotto creato! Etichetta QR disponibile nella lista.' })
    router.push('/lotti')
  }

  const expiryPresets = [
    { label: '4h', hours: 4 },
    { label: '12h', hours: 12 },
    { label: '24h', hours: 24 },
    { label: '48h', hours: 48 },
    { label: '72h', hours: 72 },
    { label: '7gg', hours: 168 },
  ]

  return (
    <div style={{ maxWidth: 580, margin: '0 auto' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Nuovo Lotto Interno</h1>
          <p className="page-subtitle">Crea una preparazione con etichetta QR</p>
        </div>
        <Link href="/lotti" className="btn btn--ghost">← Torna indietro</Link>
      </div>

      <div className="card">
        <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          <div className="form-group">
            <label className="form-label">Nome Preparazione *</label>
            <input {...register('name')} className="input" placeholder="es. Ragù di carne, Besciamella…" autoFocus />
            {errors.name && <span className="form-error">{errors.name.message}</span>}
          </div>

          <div className="form-group">
            <label className="form-label">Descrizione</label>
            <textarea {...register('description')} className="input" placeholder="Ingredienti, note…" rows={3} />
          </div>

          <div className="form-group">
            <label className="form-label">Validità *</label>
            <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', marginBottom: 'var(--space-3)' }}>
              {expiryPresets.map(p => (
                <button
                  key={p.label}
                  type="button"
                  className="btn btn--secondary btn--sm"
                  onClick={() => {
                    const el = document.getElementById('expires_hours') as HTMLInputElement
                    if (el) el.value = String(p.hours)
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <input
                id="expires_hours"
                type="number"
                {...register('expires_hours', { valueAsNumber: true })}
                className="input"
                style={{ maxWidth: 120 }}
                min={1}
                max={720}
              />
              <span style={{ color: 'var(--color-text-muted)' }}>ore dalla preparazione</span>
            </div>
            {errors.expires_hours && <span className="form-error">{errors.expires_hours.message}</span>}
          </div>

          <div style={{ background: 'var(--color-primary-dim)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)', fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
            <strong style={{ color: 'var(--color-primary)' }}>ℹ️ Token QR</strong> — Il codice QR viene generato automaticamente al salvataggio. Potrai stampare l'etichetta dalla lista lotti.
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
            <Link href="/lotti" className="btn btn--secondary">Annulla</Link>
            <button type="submit" className="btn btn--primary btn--lg" disabled={loading}>
              {loading ? <><div className="spinner" style={{ width: 20, height: 20 }} /> Creazione…</> : '🏷️ Crea Lotto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
