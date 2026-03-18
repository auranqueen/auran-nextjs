import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ hasPin: false, lockedUntil: null, minutesLeft: null }, { status: 200 })
    }

    const { data: row } = await supabase
      .from('users')
      .select('payment_pin_hash, pin_locked_until')
      .eq('auth_id', user.id)
      .single()

    const hasPin = !!row?.payment_pin_hash
    const lockedUntil = row?.pin_locked_until || null
    let minutesLeft: number | null = null
    if (lockedUntil) {
      const until = new Date(lockedUntil)
      if (until > new Date()) minutesLeft = Math.ceil((until.getTime() - Date.now()) / 60000)
    }

    return NextResponse.json({ hasPin, lockedUntil, minutesLeft })
  } catch {
    return NextResponse.json({ hasPin: false, lockedUntil: null, minutesLeft: null }, { status: 200 })
  }
}
