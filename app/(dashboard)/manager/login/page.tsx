'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useToastStore } from '@/store/toastStore'

export default function ManagerLoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const { addToast } = useToastStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      addToast({ type: 'error', message: 'Inserisci email e password' })
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      addToast({ type: 'error', message: `Errore login: ${error.message}` })
      setLoading(false)
      return
    }

    addToast({ type: 'success', message: '🔓 Login effettuato con successo!' })
    router.push('/manager')
    router.refresh()
  }

  return (
    <div style={{ width: '100%', maxWidth: 420, padding: 'var(--space-4)' }}>
      <div className="card card--glass card--elevated" style={{ border: '1px solid var(--color-border)' }}>
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
          <span style={{ fontSize: '3rem' }}>🍽️</span>
          <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, marginTop: 'var(--space-2)' }}>
            HACCP <span style={{ color: 'var(--color-primary)' }}>Manager</span>
          </h1>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginTop: 'var(--space-1)' }}>
            Accedi al pannello di controllo
          </p>
        </div>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div className="form-group">
            <label className="form-label">Email *</label>
            <input
              type="email"
              className="input"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="manager@ristorante.it"
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password *</label>
            <input
              type="password"
              className="input"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn--primary btn--full"
            style={{ marginTop: 'var(--space-4)', minHeight: '56px' }}
            disabled={loading}
          >
            {loading ? (
              <>
                <div className="spinner" style={{ width: 20, height: 20 }} />
                Accesso in corso…
              </>
            ) : (
              '🔓 Accedi'
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
