'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import type { FormEvent } from 'react'
import Link from 'next/link'
import { formatDateTime } from '@/lib/utils/formatting'
import { getBatchExpiryStatus } from '@/lib/utils/compliance'
import type { Html5Qrcode } from 'html5-qrcode'

interface BatchInfo {
  id: string
  name: string
  description: string | null
  prepared_at: string
  expires_at: string
  qr_code_token: string
  prepared_by: { first_name: string; last_name: string } | null
}

function isLocalhost() {
  if (typeof window === 'undefined') return false
  return ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname)
}

function waitForPaint() {
  return new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
}

export default function ScansionaPage() {
  const [scanning, setScanning] = useState(false)
  const [result, setResult] = useState<BatchInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [manualToken, setManualToken] = useState('')
  const scannerInstanceRef = useRef<Html5Qrcode | null>(null)
  const qrFileInputRef = useRef<HTMLInputElement>(null)

  const stopActiveScanner = useCallback(async () => {
    const scanner = scannerInstanceRef.current
    scannerInstanceRef.current = null
    if (!scanner) return

    try {
      if (scanner.isScanning) await scanner.stop()
    } catch {}

    try {
      scanner.clear()
    } catch {}
  }, [])

  const stopScanner = useCallback(async () => {
    await stopActiveScanner()
    setScanning(false)
  }, [stopActiveScanner])

  const lookupToken = useCallback(async (token: string) => {
    if (!token) {
      setError('Token QR vuoto o non leggibile.')
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch(`/api/qr/${encodeURIComponent(token)}`)
      const data = await res.json()
      if (res.ok) {
        setResult(data.batch)
      } else {
        setError(`Lotto non trovato per token: ${token}`)
      }
    } catch {
      setError('Errore di rete durante la ricerca del lotto.')
    } finally {
      setLoading(false)
    }
  }, [])

  const startScanner = useCallback(async () => {
    setResult(null)
    setError(null)

    if (typeof window === 'undefined') return
    if (!window.isSecureContext && !isLocalhost()) {
      setError('La camera del telefono richiede HTTPS. Usa il sito Vercel o carica una foto del QR.')
      return
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera non disponibile in questo browser. Puoi comunque caricare una foto del QR.')
      return
    }

    try {
      await stopActiveScanner()
      setScanning(true)
      await waitForPaint()

      const { Html5Qrcode } = await import('html5-qrcode')
      const scanner = new Html5Qrcode('qr-reader')
      scannerInstanceRef.current = scanner
      let handled = false

      await scanner.start(
        { facingMode: { ideal: 'environment' } },
        {
          fps: 10,
          qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
            const edge = Math.floor(Math.min(viewfinderWidth, viewfinderHeight) * 0.72)
            const size = Math.max(220, Math.min(edge, 320))
            return { width: size, height: size }
          },
          aspectRatio: 1.7777778,
          disableFlip: false,
        },
        async (decodedText: string) => {
          if (handled) return
          handled = true
          await stopScanner()
          await lookupToken(decodedText.trim())
        },
        () => {}
      )
    } catch (scanError) {
      console.error(scanError)
      await stopActiveScanner()
      setScanning(false)
      setError('Impossibile avviare la camera. Controlla i permessi o usa una foto del QR.')
    }
  }, [lookupToken, stopActiveScanner, stopScanner])

  const scanQrFromFile = useCallback(async (file?: File) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Carica una foto o immagine del QR code.')
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      await stopScanner()
      const { Html5Qrcode } = await import('html5-qrcode')
      const fileScanner = new Html5Qrcode('qr-file-reader')
      const decodedText = await fileScanner.scanFile(file, false)
      try {
        fileScanner.clear()
      } catch {}
      await lookupToken(decodedText.trim())
    } catch (fileError) {
      console.error(fileError)
      setError('QR non leggibile dalla foto. Prova con un inquadramento piu nitido.')
    } finally {
      setLoading(false)
    }
  }, [lookupToken, stopScanner])

  const submitManualToken = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    await stopScanner()
    await lookupToken(manualToken.trim())
  }

  useEffect(() => {
    return () => { void stopActiveScanner() }
  }, [stopActiveScanner])

  const expiryStatus = result ? getBatchExpiryStatus(result.expires_at) : null
  const statusConfig = {
    expired: { cls: 'badge--danger', label: 'Scaduto' },
    expiring: { cls: 'badge--warning', label: 'In scadenza' },
    ok: { cls: 'badge--success', label: 'Valido' },
  }

  return (
    <div style={{ maxWidth: 560, margin: '0 auto' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Scansione QR</h1>
          <p className="page-subtitle">Verifica rapidamente un lotto interno</p>
        </div>
        <Link href="/lotti" className="btn btn--ghost">Torna indietro</Link>
      </div>

      <input
        ref={qrFileInputRef}
        type="file"
        accept="image/*,.jpg,.jpeg,.png,.webp"
        capture="environment"
        style={{ display: 'none' }}
        onChange={event => {
          const file = event.currentTarget.files?.[0]
          event.currentTarget.value = ''
          void scanQrFromFile(file)
        }}
      />
      <div id="qr-file-reader" style={{ display: 'none' }} />

      {!scanning && !result && (
        <div className="card" style={{ textAlign: 'center', padding: 'var(--space-12)' }}>
          <h2 style={{ marginBottom: 'var(--space-2)' }}>Scanner QR</h2>
          <p style={{ marginBottom: 'var(--space-6)' }}>
            Inquadra il QR dell'etichetta oppure carica una foto se il browser blocca la camera.
          </p>
          <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
            <button className="btn btn--primary btn--lg" onClick={startScanner}>
              Avvia camera
            </button>
            <button className="btn btn--secondary btn--lg" onClick={() => qrFileInputRef.current?.click()}>
              Leggi QR da foto
            </button>
          </div>
          <form onSubmit={submitManualToken} style={{ display: 'grid', gap: 'var(--space-3)', marginTop: 'var(--space-6)' }}>
            <input
              className="input"
              value={manualToken}
              onChange={event => setManualToken(event.target.value)}
              placeholder="Token QR manuale"
            />
            <button className="btn btn--secondary" type="submit">
              Cerca token
            </button>
          </form>
        </div>
      )}

      {scanning && (
        <div className="card">
          <div id="qr-reader" style={{ width: '100%', minHeight: 320 }} />
          <button
            className="btn btn--secondary btn--full"
            style={{ marginTop: 'var(--space-4)' }}
            onClick={() => { void stopScanner() }}
          >
            Annulla
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
          <strong>{error}</strong>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
            <button className="btn btn--secondary btn--sm" onClick={startScanner}>
              Riprova camera
            </button>
            <button className="btn btn--secondary btn--sm" onClick={() => qrFileInputRef.current?.click()}>
              Usa foto
            </button>
          </div>
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
              Torna indietro
            </button>
            <button className="btn btn--primary" onClick={startScanner}>
              Nuova scansione
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
