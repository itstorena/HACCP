'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { formatDateTime } from '@/lib/utils/formatting'
import { getBatchExpiryStatus } from '@/lib/utils/compliance'

interface BatchInfo {
  id: string
  name: string
  description: string | null
  prepared_at: string
  expires_at: string
  qr_code_token: string
  prepared_by: { first_name: string; last_name: string } | null
}

export default function ScansionaPage() {
  const [scanning, setScanning] = useState(false)
  const [result, setResult] = useState<BatchInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const scannerRef = useRef<HTMLDivElement>(null)
  const scannerInstanceRef = useRef<unknown>(null)

  const startScanner = async () => {
    setScanning(true)
    setResult(null)
    setError(null)

    try {
      // Dynamic import per evitare SSR issues
      const { Html5QrcodeScanner } = await import('html5-qrcode')
      const scanner = new Html5QrcodeScanner(
        'qr-reader',
        { fps: 10, qrbox: { width: 250, height: 250 } },
        false
      )
      scannerInstanceRef.current = scanner

      scanner.render(
        async (decodedText: string) => {
          scanner.clear()
          setScanning(false)
          await lookupToken(decodedText.trim())
        },
        (err: unknown) => { /* scan in progress, ignore */ }
      )
    } catch (e) {
      setError('Impossibile avviare la camera. Verifica i permessi.')
      setScanning(false)
    }
  }

  const stopScanner = async () => {
    if (scannerInstanceRef.current) {
      try {
        await (scannerInstanceRef.current as { clear: () => Promise<void> }).clear()
      } catch {}
    }
    setScanning(false)
  }

  const lookupToken = async (token: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/qr/${encodeURIComponent(token)}`)
      const data = await res.json()
      if (res.ok) {
        setResult(data.batch)
      } else {
        setError(`Lotto non trovato per token: ${token}`)
      }
    } catch {
      setError('Errore di rete durante la ricerca del lotto')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    return () => { stopScanner() }
  }, [])

  const expiryStatus = result ? getBatchExpiryStatus(result.expires_at) : null
  const statusConfig = {
    expired: { cls: 'badge--danger', label: '⚠️ SCADUTO' },
    expiring: { cls: 'badge--warning', label: '⏰ In Scadenza' },
    ok: { cls: 'badge--success', label: '✅ Valido' },
  }

  return (
    <div style={{ maxWidth: 560, margin: '0 auto' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">📷 Scansiona QR</h1>
          <p className="page-subtitle">Verifica rapidamente un lotto interno</p>
        </div>
        <Link href="/lotti" className="btn btn--ghost">← Torna indietro</Link>
      </div>

      {!scanning && !result && (
        <div className="card" style={{ textAlign: 'center', padding: 'var(--space-12)' }}>
          <div style={{ fontSize: '4rem', marginBottom: 'var(--space-4)' }}>📷</div>
          <h2 style={{ marginBottom: 'var(--space-2)' }}>Scanner QR</h2>
          <p style={{ marginBottom: 'var(--space-6)' }}>
            Posiziona il QR code dell'etichetta davanti alla camera
          </p>
          <button className="btn btn--primary btn--lg" onClick={startScanner}>
            Avvia Camera
          </button>
        </div>
      )}

      {scanning && (
        <div className="card">
          <div id="qr-reader" ref={scannerRef} style={{ width: '100%' }} />
          <button
            className="btn btn--secondary btn--full"
            style={{ marginTop: 'var(--space-4)' }}
            onClick={stopScanner}
          >
            ✕ Annulla
          </button>
        </div>
      )}

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-8)' }}>
          <div className="spinner" style={{ width: 40, height: 40 }} />
        </div>
      )}

      {error && (
        <div style={{
          background: 'var(--color-danger-dim)',
          border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-5)',
          color: 'var(--color-danger)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-3)',
        }}>
          <strong>❌ {error}</strong>
          <button className="btn btn--secondary btn--sm" style={{ width: 'fit-content' }} onClick={startScanner}>
            Riprova
          </button>
        </div>
      )}

      {result && expiryStatus && (
        <div className="card card--elevated">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-4)' }}>
            <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: 800 }}>{result.name}</h2>
            <span className={`badge ${statusConfig[expiryStatus].cls}`} style={{ fontSize: 'var(--text-sm)' }}>
              {statusConfig[expiryStatus].label}
            </span>
          </div>
          {result.description && (
            <p style={{ marginBottom: 'var(--space-4)' }}>{result.description}</p>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', fontSize: 'var(--text-sm)' }}>
            <div>
              <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 'var(--space-1)' }}>Preparato</div>
              <div>{formatDateTime(result.prepared_at)}</div>
            </div>
            <div>
              <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 'var(--space-1)' }}>Scadenza</div>
              <div style={{ color: expiryStatus === 'expired' ? 'var(--color-danger)' : expiryStatus === 'expiring' ? 'var(--color-warning)' : undefined, fontWeight: 600 }}>
                {formatDateTime(result.expires_at)}
              </div>
            </div>
            {result.prepared_by && (
              <div>
                <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 'var(--space-1)' }}>Preparato da</div>
                <div>{result.prepared_by.first_name} {result.prepared_by.last_name}</div>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-5)' }}>
            <button className="btn btn--secondary" onClick={() => { setResult(null); setError(null) }}>
              ← Torna indietro
            </button>
            <button className="btn btn--primary" onClick={startScanner}>
              📷 Nuova Scansione
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
