'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useStaffStore } from '@/store/staffStore'
import { useToastStore } from '@/store/toastStore'
import { parseSupplierDocumentText, type ParsedSupplierDocumentItem } from '@/lib/utils/supplierDocumentOcr'
import type { SupplierDocumentType } from '@/types/database'

type OcrStatus = 'idle' | 'reading' | 'ready' | 'saving'

function createEmptyItem(): ParsedSupplierDocumentItem {
  return {
    product_name: '',
    original_lot_code: '',
    expiry_date: '',
    quantity: '',
    unit: '',
    notes: '',
    source_line: '',
  }
}

function isLocalhost() {
  if (typeof window === 'undefined') return false
  return ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname)
}

export default function FornitoreOcrPage() {
  const router = useRouter()
  const supabase = createClient()
  const { currentStaff } = useStaffStore()
  const { addToast } = useToastStore()
  const [status, setStatus] = useState<OcrStatus>('idle')
  const [progress, setProgress] = useState('')
  const [imagePreview, setImagePreview] = useState('')
  const [ocrText, setOcrText] = useState('')
  const [ocrConfidence, setOcrConfidence] = useState<number | null>(null)
  const [documentType, setDocumentType] = useState<SupplierDocumentType>('ddt')
  const [supplierName, setSupplierName] = useState('')
  const [documentNumber, setDocumentNumber] = useState('')
  const [documentDate, setDocumentDate] = useState('')
  const [deliveryDate, setDeliveryDate] = useState(() => new Date().toISOString().split('T')[0])
  const [riskLevel, setRiskLevel] = useState<'low' | 'medium' | 'high'>('medium')
  const [items, setItems] = useState<ParsedSupplierDocumentItem[]>([])
  const [cameraActive, setCameraActive] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cameraStreamRef = useRef<MediaStream | null>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)
  const imagePreviewRef = useRef('')

  const canSave = useMemo(
    () => supplierName.trim() && deliveryDate && items.some(item => item.product_name.trim() && item.expiry_date),
    [supplierName, deliveryDate, items]
  )

  const stopDocumentCamera = useCallback(() => {
    cameraStreamRef.current?.getTracks().forEach(track => track.stop())
    cameraStreamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setCameraActive(false)
  }, [])

  useEffect(() => {
    return () => {
      stopDocumentCamera()
      if (imagePreviewRef.current) URL.revokeObjectURL(imagePreviewRef.current)
    }
  }, [stopDocumentCamera])

  const handleFile = useCallback(async (file?: File) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      addToast({ type: 'error', message: 'Carica una foto o immagine del documento. Per PDF usa una foto o screenshot della pagina.' })
      return
    }

    if (imagePreviewRef.current) URL.revokeObjectURL(imagePreviewRef.current)
    imagePreviewRef.current = URL.createObjectURL(file)
    setImagePreview(imagePreviewRef.current)
    setStatus('reading')
    setProgress('Preparazione OCR...')

    try {
      const { recognize } = await import('tesseract.js')
      const result = await recognize(file, 'ita+eng', {
        logger: message => {
          if (message.status) {
            const pct = Math.round((message.progress ?? 0) * 100)
            setProgress(`${message.status} ${pct}%`)
          }
        },
      })

      const text = result.data.text ?? ''
      const parsed = parseSupplierDocumentText(text)
      setOcrText(text)
      setOcrConfidence(result.data.confidence ?? null)
      setSupplierName(parsed.supplier_name)
      setDocumentNumber(parsed.document_number)
      setDocumentDate(parsed.document_date)
      if (parsed.document_date) setDeliveryDate(parsed.document_date)
      setItems(parsed.items.length > 0 ? parsed.items : [createEmptyItem()])
      setStatus('ready')
      addToast({ type: 'success', message: `OCR completato: ${parsed.items.length} righe proposte.` })
    } catch (error) {
      console.error(error)
      setStatus('idle')
      addToast({ type: 'error', message: 'OCR non riuscito. Prova con una foto piu nitida e ben illuminata.' })
    }
  }, [addToast])

  const startDocumentCamera = useCallback(async () => {
    if (typeof window === 'undefined') return
    if (!window.isSecureContext && !isLocalhost()) {
      addToast({ type: 'error', message: 'La camera richiede HTTPS. Usa il sito Vercel oppure carica una foto.' })
      return
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      addToast({ type: 'error', message: 'Camera non disponibile in questo browser. Usa scatto da app foto o galleria.' })
      return
    }

    try {
      stopDocumentCamera()
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      })
      cameraStreamRef.current = stream
      setCameraActive(true)
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
    } catch (error) {
      console.error(error)
      stopDocumentCamera()
      addToast({ type: 'error', message: 'Impossibile aprire la camera. Controlla i permessi o usa una foto.' })
    }
  }, [addToast, stopDocumentCamera])

  const captureDocumentPhoto = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || video.readyState < 2) {
      addToast({ type: 'error', message: 'Camera non pronta. Attendi un istante e riprova.' })
      return
    }

    const width = video.videoWidth || 1280
    const height = video.videoHeight || 720
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) {
      addToast({ type: 'error', message: 'Acquisizione immagine non disponibile.' })
      return
    }

    context.drawImage(video, 0, 0, width, height)
    canvas.toBlob(blob => {
      if (!blob) {
        addToast({ type: 'error', message: 'Foto non acquisita. Riprova.' })
        return
      }
      const file = new File([blob], `documento-fornitore-${Date.now()}.jpg`, { type: 'image/jpeg' })
      stopDocumentCamera()
      void handleFile(file)
    }, 'image/jpeg', 0.92)
  }, [addToast, handleFile, stopDocumentCamera])

  const handleFileInput = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    stopDocumentCamera()
    void handleFile(file)
  }

  const updateItem = (index: number, patch: Partial<ParsedSupplierDocumentItem>) => {
    setItems(prev => prev.map((item, i) => i === index ? { ...item, ...patch } : item))
  }

  const removeItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index))
  }

  const reparseText = () => {
    const parsed = parseSupplierDocumentText(ocrText)
    setSupplierName(prev => prev || parsed.supplier_name)
    setDocumentNumber(prev => prev || parsed.document_number)
    setDocumentDate(prev => prev || parsed.document_date)
    setItems(parsed.items.length > 0 ? parsed.items : [createEmptyItem()])
    addToast({ type: 'info', message: 'Testo rianalizzato.' })
  }

  const handleSave = async () => {
    if (!supplierName.trim()) {
      addToast({ type: 'error', message: 'Nome fornitore obbligatorio.' })
      return
    }

    const validItems = items.filter(item => item.product_name.trim())
    const missingExpiry = validItems.some(item => !item.expiry_date)
    if (validItems.length === 0 || missingExpiry) {
      addToast({ type: 'error', message: 'Ogni riga da salvare deve avere prodotto e scadenza.' })
      return
    }

    setStatus('saving')
    const { data: document, error: documentError } = await (supabase.from('supplier_documents') as any)
      .insert({
        document_type: documentType,
        supplier_name: supplierName.trim(),
        document_number: documentNumber.trim() || null,
        document_date: documentDate || null,
        ocr_text: ocrText || null,
        ocr_confidence: ocrConfidence,
        parsed_by: currentStaff?.id ?? null,
      })
      .select()
      .single()

    if (documentError || !document) {
      addToast({ type: 'error', message: `Errore documento: ${documentError?.message ?? 'salvataggio non riuscito'}` })
      setStatus('ready')
      return
    }

    const batchRows = validItems.map(item => ({
      product_name: item.product_name.trim(),
      supplier_name: supplierName.trim(),
      original_lot_code: item.original_lot_code.trim() || null,
      supplier_document_id: document.id,
      document_number: documentNumber.trim() || null,
      delivery_date: deliveryDate,
      expiry_date: item.expiry_date,
      quantity: item.quantity ? Number(item.quantity) : null,
      unit: item.unit.trim() || null,
      risk_level: riskLevel,
      is_compliant: true,
      accepted: true,
      packaging_ok: true,
      label_ok: Boolean(item.original_lot_code.trim()),
      registered_by: currentStaff?.id ?? null,
      notes: item.notes.trim() || null,
      ocr_source_text: item.source_line || null,
    }))

    const { data: batches, error: batchError } = await (supabase.from('supplier_batches') as any)
      .insert(batchRows)
      .select('id, product_name')

    if (batchError || !batches) {
      addToast({ type: 'error', message: `Errore lotti: ${batchError?.message ?? 'salvataggio non riuscito'}` })
      setStatus('ready')
      return
    }

    const itemRows = validItems.map((item, index) => ({
      supplier_document_id: document.id,
      supplier_batch_id: batches[index]?.id ?? null,
      product_name: item.product_name.trim(),
      original_lot_code: item.original_lot_code.trim() || null,
      expiry_date: item.expiry_date || null,
      quantity: item.quantity ? Number(item.quantity) : null,
      unit: item.unit.trim() || null,
      notes: item.notes.trim() || item.source_line || null,
    }))

    await (supabase.from('supplier_document_items') as any).insert(itemRows)

    addToast({ type: 'success', message: `${batches.length} lotti fornitore creati dal documento.` })
    router.push('/fornitori')
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">OCR Fattura / DDT</h1>
          <p className="page-subtitle">Acquisisci il documento e conferma materiali, lotti e scadenze</p>
        </div>
        <Link href="/fornitori" className="btn btn--ghost">Torna ai fornitori</Link>
      </div>

      <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 380px) 1fr', gap: 'var(--space-6)' }}>
          <div>
            <div className="form-group">
              <label className="form-label">Foto documento</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                <button type="button" className="btn btn--primary" onClick={startDocumentCamera}>
                  Apri camera
                </button>
                <button type="button" className="btn btn--secondary" onClick={() => galleryInputRef.current?.click()}>
                  Carica foto
                </button>
              </div>
              <button type="button" className="btn btn--secondary" onClick={() => cameraInputRef.current?.click()}>
                Scatta con app foto
              </button>
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*,.jpg,.jpeg,.png,.webp"
                capture="environment"
                style={{ display: 'none' }}
                onChange={handleFileInput}
              />
              <input
                ref={galleryInputRef}
                type="file"
                accept="image/*,.jpg,.jpeg,.png,.webp"
                style={{ display: 'none' }}
                onChange={handleFileInput}
              />
            </div>

            {cameraActive && (
              <div style={{ marginTop: 'var(--space-4)', display: 'grid', gap: 'var(--space-3)' }}>
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  style={{ width: '100%', aspectRatio: '3 / 4', objectFit: 'cover', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: '#000' }}
                />
                <canvas ref={canvasRef} style={{ display: 'none' }} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                  <button type="button" className="btn btn--primary" onClick={captureDocumentPhoto}>
                    Acquisisci foto
                  </button>
                  <button type="button" className="btn btn--secondary" onClick={stopDocumentCamera}>
                    Chiudi camera
                  </button>
                </div>
              </div>
            )}

            {imagePreview && (
              <img
                src={imagePreview}
                alt="Anteprima documento"
                style={{ width: '100%', marginTop: 'var(--space-4)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}
              />
            )}
            {status === 'reading' && (
              <div style={{ marginTop: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <div className="spinner" />
                <span style={{ color: 'var(--color-text-muted)' }}>{progress}</span>
              </div>
            )}
          </div>

          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-4)' }}>
              <div className="form-group">
                <label className="form-label">Tipo documento</label>
                <select className="input" value={documentType} onChange={event => setDocumentType(event.target.value as SupplierDocumentType)}>
                  <option value="ddt">DDT</option>
                  <option value="invoice">Fattura</option>
                  <option value="receipt">Scontrino</option>
                  <option value="other">Altro</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Fornitore</label>
                <input className="input" value={supplierName} onChange={event => setSupplierName(event.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Numero documento</label>
                <input className="input" value={documentNumber} onChange={event => setDocumentNumber(event.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Data documento</label>
                <input type="date" className="input" value={documentDate} onChange={event => setDocumentDate(event.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Data consegna</label>
                <input type="date" className="input" value={deliveryDate} onChange={event => setDeliveryDate(event.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Rischio default</label>
                <select className="input" value={riskLevel} onChange={event => setRiskLevel(event.target.value as typeof riskLevel)}>
                  <option value="low">Basso</option>
                  <option value="medium">Medio</option>
                  <option value="high">Alto</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      {ocrText && (
        <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
          <div className="page-header" style={{ marginBottom: 'var(--space-4)' }}>
            <div>
              <h2 style={{ fontSize: 'var(--text-lg)' }}>Testo OCR</h2>
              <p className="page-subtitle">Confidenza: {ocrConfidence === null ? '-' : `${Math.round(ocrConfidence)}%`}</p>
            </div>
            <button className="btn btn--secondary" onClick={reparseText}>Rianalizza testo</button>
          </div>
          <textarea
            className="input"
            rows={8}
            value={ocrText}
            onChange={event => setOcrText(event.target.value)}
          />
        </div>
      )}

      <div className="card">
        <div className="page-header" style={{ marginBottom: 'var(--space-4)' }}>
          <div>
            <h2 style={{ fontSize: 'var(--text-lg)' }}>Righe fornitura</h2>
            <p className="page-subtitle">Correggi i dati prima di creare i lotti fornitore</p>
          </div>
          <button className="btn btn--secondary" onClick={() => setItems(prev => [...prev, createEmptyItem()])}>
            + Riga
          </button>
        </div>

        {items.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__title">Nessuna riga proposta</div>
            <p className="empty-state__desc">Carica una foto del documento o aggiungi righe manualmente.</p>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Prodotto</th>
                  <th>Lotto</th>
                  <th>Scadenza</th>
                  <th>Quantita</th>
                  <th>Unita</th>
                  <th>Note</th>
                  <th>Azioni</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr key={index}>
                    <td><input className="input input--sm" value={item.product_name} onChange={event => updateItem(index, { product_name: event.target.value })} /></td>
                    <td><input className="input input--sm" value={item.original_lot_code} onChange={event => updateItem(index, { original_lot_code: event.target.value })} /></td>
                    <td><input type="date" className="input input--sm" value={item.expiry_date} onChange={event => updateItem(index, { expiry_date: event.target.value })} /></td>
                    <td><input type="number" step="0.01" className="input input--sm" value={item.quantity} onChange={event => updateItem(index, { quantity: event.target.value })} /></td>
                    <td><input className="input input--sm" value={item.unit} onChange={event => updateItem(index, { unit: event.target.value })} /></td>
                    <td><input className="input input--sm" value={item.notes} onChange={event => updateItem(index, { notes: event.target.value })} /></td>
                    <td><button className="btn btn--danger btn--sm" onClick={() => removeItem(index)}>Rimuovi</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'var(--space-6)' }}>
          <Link href="/fornitori" className="btn btn--secondary">Annulla</Link>
          <button className="btn btn--primary btn--lg" onClick={handleSave} disabled={!canSave || status === 'saving'}>
            {status === 'saving' ? <><div className="spinner" style={{ width: 18, height: 18 }} /> Salvataggio...</> : 'Crea lotti da documento'}
          </button>
        </div>
      </div>
    </div>
  )
}
