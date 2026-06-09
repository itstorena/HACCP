import { NextRequest, NextResponse } from 'next/server'
import { hashPin } from '@/lib/auth/pin'

// API route sicura per hashare i PIN server-side
// Usata solo dalla pagina manager per creare nuovo staff
export async function POST(req: NextRequest) {
  try {
    const { pin } = await req.json()
    if (!pin || pin.length < 4) {
      return NextResponse.json({ error: 'PIN troppo corto' }, { status: 400 })
    }
    const hash = await hashPin(String(pin))
    return NextResponse.json({ hash })
  } catch {
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 })
  }
}
