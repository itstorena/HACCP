// Minuti target per tipo ciclo (normativa HACCP)
export const BLAST_CYCLE_TARGETS = {
  positive_3c: {
    minutes: 90,
    targetTemp: 3,
    label: 'Abbattimento Positivo (+3°C)',
    color: 'var(--color-warning)',
  },
  negative_18c: {
    minutes: 240,
    targetTemp: -18,
    label: 'Abbattimento Negativo (-18°C)',
    color: 'var(--color-primary)',
  },
} as const

/**
 * Calcola conformità ciclo abbattitore
 */
export function checkBlastCompliance(
  cycleType: 'positive_3c' | 'negative_18c',
  startTime: string,
  endTime: string,
  endTemp: number
): boolean {
  const target = BLAST_CYCLE_TARGETS[cycleType]
  const durationMs = new Date(endTime).getTime() - new Date(startTime).getTime()
  const durationMinutes = durationMs / (1000 * 60)

  if (cycleType === 'positive_3c') {
    return endTemp <= 3 && durationMinutes <= target.minutes
  } else {
    return endTemp <= -18 && durationMinutes <= target.minutes
  }
}

export function checkBlastComplianceAgainstTarget(
  startTime: string,
  endTime: string,
  endTemp: number,
  targetTemp: number,
  targetMinutes: number
): boolean {
  const durationMs = new Date(endTime).getTime() - new Date(startTime).getTime()
  const durationMinutes = durationMs / (1000 * 60)
  return endTemp <= targetTemp && durationMinutes <= targetMinutes
}

export function getCycleDurationMinutes(startTime: string, endTime: string): number {
  const durationMs = new Date(endTime).getTime() - new Date(startTime).getTime()
  return Math.max(0, Math.round(durationMs / (1000 * 60)))
}

/**
 * Calcola i minuti rimasti in un ciclo attivo
 */
export function getRemainingMinutes(startTime: string, targetMinutes: number): number {
  const elapsedMs = Date.now() - new Date(startTime).getTime()
  const elapsedMinutes = elapsedMs / (1000 * 60)
  return Math.max(0, targetMinutes - elapsedMinutes)
}

/**
 * Percentuale completamento ciclo
 */
export function getCycleProgress(startTime: string, targetMinutes: number): number {
  const elapsedMs = Date.now() - new Date(startTime).getTime()
  const elapsedMinutes = elapsedMs / (1000 * 60)
  return Math.min(100, (elapsedMinutes / targetMinutes) * 100)
}

/**
 * Controlla se un lotto è scaduto o in scadenza
 */
export function getBatchExpiryStatus(expiresAt: string): 'expired' | 'expiring' | 'ok' {
  const now = Date.now()
  const expiry = new Date(expiresAt).getTime()
  const diff = expiry - now
  const hours48 = 48 * 60 * 60 * 1000

  if (diff < 0) return 'expired'
  if (diff < hours48) return 'expiring'
  return 'ok'
}
