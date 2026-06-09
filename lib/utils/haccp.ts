import type {
  EquipmentType,
  NonConformitySeverity,
  NonConformitySource,
  NonConformityStatus,
  OperationalCheckType,
} from '@/types/database'

export const EQUIPMENT_TYPE_LABELS: Record<EquipmentType, string> = {
  fridge: 'Frigorifero',
  freezer: 'Freezer',
  blast_chiller: 'Abbattitore',
  hot_holding: 'Mantenimento caldo',
  probe: 'Sonda',
  other: 'Altro',
}

export const CHECK_TYPE_LABELS: Record<OperationalCheckType, string> = {
  cleaning: 'Pulizia',
  oil_quality: 'Olio frittura',
  pest_control: 'Infestanti',
  allergen_control: 'Allergeni',
  maintenance: 'Manutenzione',
  training: 'Formazione',
  generic: 'Generico',
}

export const NON_CONFORMITY_SOURCE_LABELS: Record<NonConformitySource, string> = {
  receiving: 'Ricevimento merci',
  blast_chiller: 'Abbattitore',
  temperature: 'Temperatura',
  cleaning: 'Pulizia',
  lot: 'Lotto',
  allergen: 'Allergeni',
  pest: 'Infestanti',
  maintenance: 'Manutenzione',
  other: 'Altro',
}

export const SEVERITY_LABELS: Record<NonConformitySeverity, string> = {
  low: 'Bassa',
  medium: 'Media',
  high: 'Alta',
  critical: 'Critica',
}

export const STATUS_LABELS: Record<NonConformityStatus, string> = {
  open: 'Aperta',
  in_progress: 'In gestione',
  closed: 'Chiusa',
  void: 'Annullata',
}

export const SEVERITY_BADGE_CLASS: Record<NonConformitySeverity, string> = {
  low: 'badge--neutral',
  medium: 'badge--warning',
  high: 'badge--danger',
  critical: 'badge--danger',
}

export const STATUS_BADGE_CLASS: Record<NonConformityStatus, string> = {
  open: 'badge--danger',
  in_progress: 'badge--warning',
  closed: 'badge--success',
  void: 'badge--neutral',
}

export function isTemperatureCompliant(
  temperature: number,
  minThreshold?: number | null,
  maxThreshold?: number | null
): boolean {
  if (minThreshold !== null && minThreshold !== undefined && temperature < minThreshold) return false
  if (maxThreshold !== null && maxThreshold !== undefined && temperature > maxThreshold) return false
  return true
}

export function inferTemperatureSeverity(
  temperature: number,
  minThreshold?: number | null,
  maxThreshold?: number | null
): NonConformitySeverity {
  const lowerDelta = minThreshold !== null && minThreshold !== undefined ? minThreshold - temperature : 0
  const upperDelta = maxThreshold !== null && maxThreshold !== undefined ? temperature - maxThreshold : 0
  const delta = Math.max(lowerDelta, upperDelta)

  if (delta >= 8) return 'critical'
  if (delta >= 4) return 'high'
  if (delta > 0) return 'medium'
  return 'low'
}

export function formatRange(min?: number | null, max?: number | null): string {
  if (min !== null && min !== undefined && max !== null && max !== undefined) {
    return `${min} / ${max} C`
  }
  if (min !== null && min !== undefined) return `min ${min} C`
  if (max !== null && max !== undefined) return `max ${max} C`
  return 'Soglia non impostata'
}
