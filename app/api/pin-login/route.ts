import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyPin } from '@/lib/auth/pin'

export async function POST(req: NextRequest) {
  try {
    const { staffId, pin } = await req.json()

    if (!staffId || !pin) {
      return NextResponse.json({ ok: false, error: 'Dati mancanti' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { data: staff, error } = await (supabase.from('staff_members') as any)
      .select('id, first_name, last_name, role, avatar_url, pin_hash, is_active')
      .eq('id', staffId)
      .eq('is_active', true)
      .single()

    if (error || !staff) {
      return NextResponse.json({ ok: false, error: 'Staff non trovato' }, { status: 404 })
    }

    const isValid = await verifyPin(pin, (staff as any).pin_hash)
    if (!isValid) {
      return NextResponse.json({ ok: false, error: 'PIN non corretto' }, { status: 401 })
    }

    return NextResponse.json({
      ok: true,
      staff: {
        id: (staff as any).id,
        firstName: (staff as any).first_name,
        lastName: (staff as any).last_name,
        role: (staff as any).role,
        avatarUrl: (staff as any).avatar_url,
      },
    })
  } catch (err) {
    console.error('PIN login error:', err)
    return NextResponse.json({ ok: false, error: 'Errore interno' }, { status: 500 })
  }
}
