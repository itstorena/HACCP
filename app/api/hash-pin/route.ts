import { NextRequest, NextResponse } from 'next/server'
import { hashPin } from '@/lib/auth/pin'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
    }

    const { pin } = await req.json()
    const normalizedPin = String(pin ?? '')

    if (!/^\d{4,6}$/.test(normalizedPin)) {
      return NextResponse.json({ error: 'PIN non valido' }, { status: 400 })
    }

    const hash = await hashPin(normalizedPin)
    return NextResponse.json({ hash })
  } catch {
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 })
  }
}
