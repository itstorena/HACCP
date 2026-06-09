'use client'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToastStore } from '@/store/toastStore'
import type { Database, Json } from '@/types/database'

type AuditLog = Database['public']['Tables']['audit_logs']['Row']

const ACTION_LABELS: Record<AuditLog['action'], string> = {
  insert: 'Creazione',
  update: 'Modifica',
  delete: 'Eliminazione',
  login: 'Accesso',
  report: 'Report',
  print: 'Stampa',
}

const TABLE_LABELS: Record<string, string> = {
  audit_logs: 'Audit log',
  blast_chiller_logs: 'Abbattitore',
  equipment: 'Attrezzature',
  internal_batches: 'Lotti interni',
  non_conformities: 'Non conformita',
  operational_checks: 'Controlli',
  staff_members: 'Staff',
  supplier_batches: 'Forniture',
  temperature_logs: 'Temperature',
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatJsonValue(value: Json | undefined): string {
  if (value === undefined || value === null || value === '') return '-'
  if (typeof value === 'object') {
    if (Array.isArray(value)) return `${value.length} elementi`
    return JSON.stringify(value).slice(0, 80)
  }
  return String(value)
}

function summarizeJson(data: Json | null) {
  if (data === null) return 'Nessun dettaglio'
  if (typeof data !== 'object') return String(data)
  if (Array.isArray(data)) return `${data.length} valori registrati`

  const entries = Object.entries(data)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .slice(0, 4)

  if (entries.length === 0) return 'Nessun dettaglio'
  return entries.map(([key, value]) => `${key}: ${formatJsonValue(value)}`).join(' | ')
}

function prettyJson(data: Json | null) {
  return data === null ? 'null' : JSON.stringify(data, null, 2)
}

export default function AuditLogPage() {
  const supabase = createClient()
  const { addToast } = useToastStore()
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [actionFilter, setActionFilter] = useState<'all' | AuditLog['action']>('all')
  const [tableFilter, setTableFilter] = useState('all')

  const loadLogs = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(300)

    if (error) {
      addToast({ type: 'error', message: `Audit log non disponibile: ${error.message}` })
      setLogs([])
    } else {
      setLogs((data as AuditLog[]) ?? [])
    }

    setLoading(false)
  }

  useEffect(() => {
    loadLogs()
  }, [])

  const tableOptions = useMemo(
    () => Array.from(new Set(logs.map(log => log.table_name))).sort(),
    [logs]
  )

  const filteredLogs = useMemo(
    () => logs.filter(log => {
      const matchesAction = actionFilter === 'all' || log.action === actionFilter
      const matchesTable = tableFilter === 'all' || log.table_name === tableFilter
      return matchesAction && matchesTable
    }),
    [actionFilter, tableFilter, logs]
  )

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Audit Log</h1>
          <p className="page-subtitle">Registro operativo delle azioni effettuate dagli operatori</p>
        </div>
        <button className="btn btn--secondary" onClick={loadLogs} disabled={loading}>
          {loading ? 'Aggiornamento...' : 'Aggiorna'}
        </button>
      </div>

      <div className="card no-print" style={{ marginBottom: 'var(--space-6)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-4)' }}>
          <div className="form-group">
            <label className="form-label">Azione</label>
            <select className="input" value={actionFilter} onChange={event => setActionFilter(event.target.value as typeof actionFilter)}>
              <option value="all">Tutte</option>
              {Object.entries(ACTION_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Registro</label>
            <select className="input" value={tableFilter} onChange={event => setTableFilter(event.target.value)}>
              <option value="all">Tutti</option>
              {tableOptions.map(table => (
                <option key={table} value={table}>{TABLE_LABELS[table] ?? table}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Risultati</label>
            <input className="input" value={`${filteredLogs.length} su ${logs.length} azioni`} readOnly />
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-12)' }}>
          <div className="spinner" style={{ width: 40, height: 40 }} />
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="empty-state">
          <h3>Nessuna azione trovata</h3>
          <p>Modifica i filtri o aggiorna il registro.</p>
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Operatore</th>
                <th>Azione</th>
                <th>Registro</th>
                <th>Record</th>
                <th>Dettaglio</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map(log => (
                <tr key={log.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{formatDateTime(log.created_at)}</td>
                  <td>{log.actor_label ?? log.actor_id ?? 'Sistema'}</td>
                  <td>
                    <span className={`badge ${log.action === 'delete' ? 'badge--danger' : log.action === 'update' ? 'badge--warning' : 'badge--success'}`}>
                      {ACTION_LABELS[log.action]}
                    </span>
                  </td>
                  <td>{TABLE_LABELS[log.table_name] ?? log.table_name}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                    {log.record_id ? log.record_id.slice(0, 8) : '-'}
                  </td>
                  <td style={{ minWidth: 280, maxWidth: 520 }}>
                    <details>
                      <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
                        {summarizeJson(log.after_data ?? log.before_data)}
                      </summary>
                      <div style={{ display: 'grid', gap: 'var(--space-3)', marginTop: 'var(--space-3)' }}>
                        <div>
                          <div style={{ fontWeight: 700, marginBottom: 'var(--space-1)' }}>Prima</div>
                          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 220, overflow: 'auto', background: 'var(--color-bg-subtle)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)' }}>{prettyJson(log.before_data)}</pre>
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, marginBottom: 'var(--space-1)' }}>Dopo</div>
                          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 220, overflow: 'auto', background: 'var(--color-bg-subtle)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)' }}>{prettyJson(log.after_data)}</pre>
                        </div>
                      </div>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
