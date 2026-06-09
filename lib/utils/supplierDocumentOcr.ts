export interface ParsedSupplierDocumentItem {
  product_name: string
  original_lot_code: string
  expiry_date: string
  quantity: string
  unit: string
  notes: string
  source_line: string
}

export interface ParsedSupplierDocument {
  supplier_name: string
  document_number: string
  document_date: string
  items: ParsedSupplierDocumentItem[]
}

const UNIT_PATTERN = /(kg|g|gr|l|lt|pz|pezzi|conf|cartoni|vaschette|bottiglie)/i

function toIsoDate(value: string): string {
  const match = value.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/)
  if (!match) return ''

  const day = match[1].padStart(2, '0')
  const month = match[2].padStart(2, '0')
  const rawYear = match[3]
  const year = rawYear.length === 2 ? `20${rawYear}` : rawYear
  return `${year}-${month}-${day}`
}

function cleanProductName(line: string): string {
  return line
    .replace(/\b(lotto|lot|batch|scad(?:enza)?|exp|q\.?ta|qtà|quantità|qty)\b[:\s-]*/gi, ' ')
    .replace(/\d+[,.]?\d*\s*(kg|g|gr|l|lt|pz|pezzi|conf|cartoni|vaschette|bottiglie)\b/gi, ' ')
    .replace(/\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function parseItemLine(line: string): ParsedSupplierDocumentItem | null {
  const normalized = line.replace(/\s+/g, ' ').trim()
  if (normalized.length < 6) return null

  const lower = normalized.toLowerCase()
  const looksLikeItem = UNIT_PATTERN.test(normalized)
    || /\b(lotto|lot|scad|exp|qty|q\.?ta|qtà)\b/i.test(normalized)
  const looksLikeHeader = /\b(totale|iva|imponibile|pagamento|banca|iban|telefono|email|p\.?\s*iva|codice fiscale)\b/i.test(lower)

  if (!looksLikeItem || looksLikeHeader) return null

  const lotMatch = normalized.match(/\b(?:lotto|lot|batch)\s*[:#-]?\s*([A-Z0-9._/-]{3,})/i)
  const expiryMatch = normalized.match(/\b(?:scad(?:enza)?|exp)\s*[:#-]?\s*(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})/i)
    ?? normalized.match(/(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})/)
  const qtyMatch = normalized.match(/(\d+[,.]?\d*)\s*(kg|g|gr|l|lt|pz|pezzi|conf|cartoni|vaschette|bottiglie)\b/i)

  const productName = cleanProductName(normalized)
  if (productName.length < 3) return null

  return {
    product_name: productName,
    original_lot_code: lotMatch?.[1] ?? '',
    expiry_date: expiryMatch ? toIsoDate(expiryMatch[1]) : '',
    quantity: qtyMatch?.[1]?.replace(',', '.') ?? '',
    unit: qtyMatch?.[2]?.toLowerCase() ?? '',
    notes: '',
    source_line: normalized,
  }
}

export function parseSupplierDocumentText(text: string): ParsedSupplierDocument {
  const lines = text
    .split(/\r?\n/)
    .map(line => line.replace(/[|]/g, ' ').trim())
    .filter(Boolean)

  const docNumberLine = lines.find(line => /\b(fattura|ddt|documento|doc\.?|n\.|numero)\b/i.test(line))
  const docNumberMatch = docNumberLine?.match(/\b(?:fattura|ddt|documento|doc\.?|n\.|numero)\s*[:#-]?\s*([A-Z0-9._/-]{2,})/i)
    ?? docNumberLine?.match(/\b([A-Z0-9]{2,}[/-]\d{1,})\b/i)
  const dateLine = lines.find(line => /\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}/.test(line))
  const supplierLine = lines.find(line => {
    const isMeta = /\b(fattura|ddt|documento|data|totale|iva|pagamento|lotto|scad)\b/i.test(line)
    return !isMeta && /[A-Za-zÀ-ÿ]{3,}/.test(line)
  })

  const items = lines
    .map(parseItemLine)
    .filter((item): item is ParsedSupplierDocumentItem => Boolean(item))

  return {
    supplier_name: supplierLine ?? '',
    document_number: docNumberMatch?.[1] ?? '',
    document_date: dateLine ? toIsoDate(dateLine) : '',
    items,
  }
}
