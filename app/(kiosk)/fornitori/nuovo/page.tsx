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
  product_name: z.string().min(2, 'Inserisci il nome del prodotto'),
  supplier_name: z.string().min(2, 'Inserisci il nome del fornitore'),
  original_lot_code: z.string().optional(),
  delivery_date: z.string().min(1, 'Data consegna obbligatoria'),
  expiry_date: z.string().min(1, 'Data scadenza obbligatoria'),
  risk_level: z.enum(['high', 'medium', 'low']),
  is_compliant: z.boolean(),
  notes: z.string().optional(),
}).refine(d => new Date(d.expiry_date) > new Date(d.delivery_date), {
  message: 'La data di scadenza deve essere successiva alla data di consegna',
  path: ['expiry_date'],
})

type FormData = z.infer<typeof schema>

export default function NuovoFornitorePage() {
  const router = useRouter()
  const supabase = createClient()
  const { currentStaff } = useStaffStore()
  const { addToast } = useToastStore()
  const [loading, setLoading] = useState(false)

  const today = new Date().toISOString().split('T')[0]

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      delivery_date: today,
      risk_level: 'medium',
      is_compliant: true,
    },
  })

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    const { error } = await (supabase.from('supplier_batches') as any).insert({
      ...data,
      registered_by: currentStaff?.id ?? null,
    })

    if (error) {
      addToast({ type: 'error', message: `Errore: ${error.message}` })
      setLoading(false)
      return
    }

    addToast({ type: 'success', message: '✅ Lotto fornitore registrato!' })
    router.push('/fornitori')
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Nuovo Fornitore</h1>
          <p className="page-subtitle">Registra un lotto in ingresso</p>
        </div>
        <Link href="/fornitori" className="btn btn--ghost">← Torna indietro</Link>
      </div>

      <div className="card">
        <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
            <div className="form-group">
              <label className="form-label">Nome Prodotto *</label>
              <input {...register('product_name')} className="input" placeholder="es. Filetto di manzo" />
              {errors.product_name && <span className="form-error">{errors.product_name.message}</span>}
            </div>
            <div className="form-group">
              <label className="form-label">Fornitore *</label>
              <input {...register('supplier_name')} className="input" placeholder="es. Macelleria Rossi" />
              {errors.supplier_name && <span className="form-error">{errors.supplier_name.message}</span>}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">N° Lotto Fornitore</label>
            <input {...register('original_lot_code')} className="input" placeholder="es. LOT-2024-001 (opzionale)" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
            <div className="form-group">
              <label className="form-label">Data Consegna *</label>
              <input type="date" {...register('delivery_date')} className="input" />
              {errors.delivery_date && <span className="form-error">{errors.delivery_date.message}</span>}
            </div>
            <div className="form-group">
              <label className="form-label">Data Scadenza *</label>
              <input type="date" {...register('expiry_date')} className="input" />
              {errors.expiry_date && <span className="form-error">{errors.expiry_date.message}</span>}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
            <div className="form-group">
              <label className="form-label">Livello di Rischio *</label>
              <select {...register('risk_level')} className="input">
                <option value="low">🟢 Basso</option>
                <option value="medium">🟡 Medio</option>
                <option value="high">🔴 Alto</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Conformità</label>
              <select
                {...register('is_compliant', { setValueAs: v => v === 'true' })}
                className="input"
              >
                <option value="true">✅ Conforme</option>
                <option value="false">❌ Non Conforme</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Note</label>
            <textarea {...register('notes')} className="input" placeholder="Note aggiuntive (opzionale)" rows={3} />
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
            <Link href="/fornitori" className="btn btn--secondary">Annulla</Link>
            <button type="submit" className="btn btn--primary btn--lg" disabled={loading}>
              {loading ? <><div className="spinner" style={{ width: 20, height: 20 }} /> Salvataggio…</> : '💾 Salva Lotto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
