/**
 * Formatta una data in italiano
 */
export function formatDate(date: string | Date, options?: Intl.DateTimeFormatOptions): string {
  return new Date(date).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...options,
  })
}

/**
 * Formatta data e ora in italiano
 */
export function formatDateTime(date: string | Date): string {
  return new Date(date).toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Formatta solo l'ora
 */
export function formatTime(date: string | Date): string {
  return new Date(date).toLocaleTimeString('it-IT', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Formatta minuti come "1h 30m" o "45m"
 */
export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

/**
 * Formatta countdown da millisecondi
 */
export function formatCountdown(remainingMs: number): string {
  if (remainingMs <= 0) return '00:00'
  const totalSeconds = Math.floor(remainingMs / 1000)
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/**
 * Formatta temperatura con °C
 */
export function formatTemp(temp: number | null | undefined): string {
  if (temp === null || temp === undefined) return '—'
  return `${temp > 0 ? '+' : ''}${temp}°C`
}

/**
 * Ritorna iniziali del nome (per avatar fallback)
 */
export function getInitials(firstName: string, lastName: string): string {
  return `${firstName[0]}${lastName[0]}`.toUpperCase()
}

/**
 * Mappa il ruolo in italiano
 */
export const ROLE_LABELS: Record<string, string> = {
  chef: 'Chef',
  cook: 'Cuoco',
  cleaner: 'Addetto Pulizie',
  manager: 'Manager',
}

/**
 * Mappa risk level in italiano
 */
export const RISK_LABELS: Record<string, string> = {
  high: 'Alto',
  medium: 'Medio',
  low: 'Basso',
}
