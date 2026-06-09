'use client'
import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useStaffStore } from '@/store/staffStore'
import { useToastStore } from '@/store/toastStore'
import { getInitials, ROLE_LABELS } from '@/lib/utils/formatting'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database'

type StaffMember = Database['public']['Tables']['staff_members']['Row']

export default function LoginPage() {
  const router = useRouter()
  const { login } = useStaffStore()
  const { addToast } = useToastStore()
  const supabase = createClient()

  const [staff, setStaff] = useState<StaffMember[]>([])
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null)
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [staffLoading, setStaffLoading] = useState(true)

  // Carica staff al mount
  useState(() => {
    supabase
      .from('staff_members')
      .select('*')
      .eq('is_active', true)
      .order('first_name')
      .then(({ data }) => {
        setStaff(data ?? [])
        setStaffLoading(false)
      })
  })

  const handleKeyPress = useCallback((key: string) => {
    if (pin.length >= 6) return
    const newPin = pin + key
    setPin(newPin)
    setError(false)

    if (newPin.length >= 4) {
      handleLogin(newPin)
    }
  }, [pin, selectedStaff])

  const handleDelete = useCallback(() => {
    setPin(p => p.slice(0, -1))
    setError(false)
  }, [])

  const handleLogin = async (currentPin: string) => {
    if (!selectedStaff) return
    setLoading(true)
    try {
      const res = await fetch('/api/pin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffId: selectedStaff.id, pin: currentPin }),
      })
      const data = await res.json()
      if (data.ok) {
        login(data.staff)
        addToast({ type: 'success', message: `Benvenuto ${data.staff.firstName}! 👋` })
        router.replace('/dashboard')
      } else {
        setError(true)
        setPin('')
        setTimeout(() => setError(false), 800)
      }
    } catch {
      addToast({ type: 'error', message: 'Errore di rete. Riprova.' })
    } finally {
      setLoading(false)
    }
  }

  const pinKeys = ['1','2','3','4','5','6','7','8','9','','0','⌫']

  return (
    <div style={{
      minHeight: '100svh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 'var(--space-6)',
      gap: 'var(--space-8)',
      background: 'radial-gradient(ellipse at center top, #1a2a4a 0%, #0a0f1e 70%)',
    }}>
      {/* Logo */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: 'var(--space-2)' }}>🍽️</div>
        <h1 style={{ fontSize: 'var(--text-3xl)', fontWeight: 800 }}>
          HACCP <span style={{ color: 'var(--color-primary)' }}>Register</span>
        </h1>
        <p style={{ color: 'var(--color-text-muted)', marginTop: 'var(--space-2)' }}>
          Seleziona il tuo profilo per accedere
        </p>
      </div>

      {!selectedStaff ? (
        /* Staff Selection */
        <div style={{ width: '100%', maxWidth: 700 }}>
          {staffLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-12)' }}>
              <div className="spinner" style={{ width: 48, height: 48 }} />
            </div>
          ) : (
            <div className="staff-grid">
              {staff.map((s) => (
                <button
                  key={s.id}
                  className="staff-card"
                  onClick={() => setSelectedStaff(s)}
                  style={{ border: 'none', fontFamily: 'inherit' }}
                >
                  <div className="staff-avatar">
                    {s.avatar_url ? (
                      <img src={s.avatar_url} alt={`${s.first_name} ${s.last_name}`} />
                    ) : (
                      getInitials(s.first_name, s.last_name)
                    )}
                  </div>
                  <div className="staff-name">{s.first_name} {s.last_name}</div>
                  <div className="staff-role">{ROLE_LABELS[s.role]}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* PIN Entry */
        <div style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-xl)',
          padding: 'var(--space-8)',
          width: '100%',
          maxWidth: 360,
          boxShadow: 'var(--shadow-lg)',
        }}>
          {/* Selected staff info */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
            <div className="staff-avatar" style={{ width: 80, height: 80, fontSize: 'var(--text-2xl)' }}>
              {selectedStaff.avatar_url
                ? <img src={selectedStaff.avatar_url} alt="" />
                : getInitials(selectedStaff.first_name, selectedStaff.last_name)
              }
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: 'var(--text-lg)' }}>
                {selectedStaff.first_name} {selectedStaff.last_name}
              </div>
              <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
                {ROLE_LABELS[selectedStaff.role]}
              </div>
            </div>
          </div>

          <div className="pin-keypad">
            {/* PIN dots */}
            <div className="pin-display">
              {Array.from({ length: Math.max(4, pin.length) }).map((_, i) => (
                <div
                  key={i}
                  className={`pin-dot ${i < pin.length ? (error ? 'pin-dot--error' : 'pin-dot--filled') : ''}`}
                />
              ))}
            </div>

            {loading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--color-text-muted)' }}>
                <div className="spinner" />
                Verifica in corso…
              </div>
            )}

            {error && (
              <div style={{ color: 'var(--color-danger)', fontSize: 'var(--text-sm)', fontWeight: 600 }}>
                PIN non corretto. Riprova.
              </div>
            )}

            {/* Keypad */}
            <div className="pin-grid">
              {pinKeys.map((key, i) => {
                if (key === '') return <div key={i} className="pin-key pin-key--empty" />
                if (key === '⌫') return (
                  <button
                    key={i}
                    className="pin-key pin-key--delete"
                    onClick={handleDelete}
                    disabled={loading}
                    aria-label="Cancella"
                  >
                    {key}
                  </button>
                )
                return (
                  <button
                    key={i}
                    className="pin-key"
                    onClick={() => handleKeyPress(key)}
                    disabled={loading}
                    aria-label={key}
                  >
                    {key}
                  </button>
                )
              })}
            </div>

            <button
              className="btn btn--ghost btn--sm"
              onClick={() => { setSelectedStaff(null); setPin(''); setError(false) }}
            >
              ← Cambia profilo
            </button>
          </div>
        </div>
      )}

      {/* Manager link */}
      <a
        href="/manager"
        style={{
          fontSize: 'var(--text-sm)',
          color: 'var(--color-text-faint)',
          textDecoration: 'none',
        }}
      >
        Accesso Manager →
      </a>
    </div>
  )
}
