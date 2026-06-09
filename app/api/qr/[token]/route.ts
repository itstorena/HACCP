import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('internal_batches')
    .select(`
      *,
      prepared_by:staff_members(id, first_name, last_name, role)
    `)
    .eq('qr_code_token', token)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Lotto non trovato' }, { status: 404 })
  }

  return NextResponse.json({ batch: data })
}
