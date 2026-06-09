import type { StaffMember } from '@/store/staffStore'
interface AuditClient {
  from: (table: string) => any
}

export function getStaffAuditLabel(staff: StaffMember | null | undefined) {
  return staff ? `${staff.firstName} ${staff.lastName} (${staff.role})` : null
}

export async function writeAuditLog(
  supabase: AuditClient,
  params: {
    tableName: string
    recordId: string | null
    action: 'insert' | 'update' | 'delete' | 'login' | 'report' | 'print'
    staff?: StaffMember | null
    beforeData?: unknown
    afterData?: unknown
  }
) {
  const { error } = await supabase.from('audit_logs').insert({
    table_name: params.tableName,
    record_id: params.recordId,
    action: params.action,
    actor_id: params.staff?.id ?? null,
    actor_label: getStaffAuditLabel(params.staff),
    before_data: params.beforeData ?? null,
    after_data: params.afterData ?? null,
  })

  if (error) {
    console.warn('Audit log non registrato:', error.message)
  }
}
