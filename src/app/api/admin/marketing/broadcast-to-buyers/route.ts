import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tryCreateServiceClient } from '@/lib/supabase/service'
import { sendPpurioSms } from '@/lib/ppurio/sendAlimtalk'
import { findSalonChannel } from '@/lib/chat/findSalonChannel'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const buyerIds: string[] = Array.isArray(body?.buyerIds) ? body.buyerIds.map((x: any) => String(x)) : []
  const message = String(body?.message || '').trim()
  if (buyerIds.length === 0 || !message) {
    return NextResponse.json({ ok: false, error: 'missing_params' }, { status: 400 })
  }

  const client = tryCreateServiceClient() || supabase
  const { data: rows } = await client
    .from('external_customers')
    .select('id,name,phone,auran_joined,auran_user_id,owner_id')
    .in('id', buyerIds)
  const customers = (rows as any[]) || []

  let success = 0
  let failed = 0
  let noChannel = 0

  for (const c of customers) {
    if (c.auran_joined && c.auran_user_id) {
      // 가입 회원 → 살롱 상담 채널에 인앱 메시지
      const channelId = await findSalonChannel(client, c.owner_id, c.auran_user_id)
      if (!channelId) { noChannel++; continue }
      const now = new Date().toISOString()
      const { error } = await client.from('salon_messages').insert({
        channel_id: channelId,
        sender_id: c.owner_id,
        sender_type: 'owner',
        body: message,
        is_from_customer: false,
        message_kind: 'text',
      } as any)
      if (error) { failed++; continue }
      await client.from('chat_channels').update({
        last_message: message,
        last_message_at: now,
        unread_count: 1,
      }).eq('id', channelId)
      success++
    } else {
      // 미가입 외부고객 → SMS 발송
      const phone = String(c.phone || '')
      if (!phone) { failed++; continue }
      const r = await sendPpurioSms({ phone, message })
      if (r.ok) success++
      else failed++
    }
  }

  return NextResponse.json({ ok: true, success, failed, noChannel })
}
