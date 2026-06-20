import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tryCreateServiceClient } from '@/lib/supabase/service'
import { sendPpurioAlimtalk } from '@/lib/ppurio/sendAlimtalk'

// 선물 정보 조회 (토큰으로, 표시용)
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token') || ''
  if (!token) return NextResponse.json({ ok: false, error: 'no_token' }, { status: 400 })
  const client = tryCreateServiceClient() || createClient()
  const { data: gift } = await client
    .from('membership_gifts')
    .select('id, plan_id, sender_name, message, status, membership_plans(name)')
    .eq('claim_token', token)
    .maybeSingle()
  if (!gift) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  return NextResponse.json({
    ok: true,
    plan_name: (gift as any).membership_plans?.name ?? '멤버십',
    sender_name: (gift as any).sender_name ?? null,
    message: (gift as any).message ?? null,
    status: (gift as any).status,
  })
}

// 선물 받기 (로그인 필요)
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'not_logged_in' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const token = String(body?.token || '')
  if (!token) return NextResponse.json({ ok: false, error: 'no_token' }, { status: 400 })

  const client = tryCreateServiceClient() || supabase

  const { data: urow } = await client.from('users').select('id').eq('auth_id', user.id).maybeSingle()
  const recipientId = (urow as any)?.id
  if (!recipientId) return NextResponse.json({ ok: false, error: 'no_user' }, { status: 400 })

  const { data: gift } = await client
    .from('membership_gifts')
    .select('id, plan_id, gifted_by, status')
    .eq('claim_token', token)
    .maybeSingle()
  if (!gift) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  if (gift.status === 'claimed') return NextResponse.json({ ok: false, error: 'already_claimed' }, { status: 409 })
  if (gift.status !== 'paid') return NextResponse.json({ ok: false, error: 'not_paid' }, { status: 400 })

  const { data: existing } = await client
    .from('user_memberships')
    .select('id')
    .eq('source_type', 'membership_gift')
    .eq('source_id', gift.id)
    .maybeSingle()

  if (!existing) {
    const { data: plan } = await client
      .from('membership_plans')
      .select('shipments_per_year, interval_months')
      .eq('id', gift.plan_id)
      .maybeSingle()
    const total = Number((plan as any)?.shipments_per_year ?? 6)
    const interval = Number((plan as any)?.interval_months ?? 2)
    const now = new Date()
    const expires = new Date(now); expires.setFullYear(expires.getFullYear() + 1)
    const next = new Date(now); next.setMonth(next.getMonth() + interval)
    const { error: insErr } = await client.from('user_memberships').insert({
      user_id: recipientId,
      plan_id: gift.plan_id,
      status: 'active',
      started_at: now.toISOString(),
      expires_at: expires.toISOString(),
      shipments_total: total,
      shipments_remaining: total,
      next_shipment_date: next.toISOString().slice(0, 10),
      gifted_by: gift.gifted_by,
      source_type: 'membership_gift',
      source_id: gift.id,
    } as any)
    if (insErr) return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 })
    await client.from('notifications').insert({
      user_id: recipientId,
      type: 'promo',
      title: 'ORÆN PRIVÉ 멤버십이 시작됐어요 💜',
      body: '두 달마다, 오렌이 고른 리추얼이 도착해요',
      is_read: false,
    } as any)
  }

  await client
    .from('membership_gifts')
    .update({ status: 'claimed', claimed_by: recipientId, claimed_at: new Date().toISOString() })
    .eq('id', gift.id)
    .eq('status', 'paid')

  try {
    const { data: userRow } = await client
      .from('users')
      .select('phone, name, id')
      .eq('id', recipientId)
      .maybeSingle()
    const name = (userRow as any)?.name || '고객'
    // 알림톡
    if ((userRow as any)?.phone) {
      await sendPpurioAlimtalk({
        phone: (userRow as any).phone,
        message: `[ORÆN PRIVÉ] ${name}님, 선물 멤버십을 수령했어요 💜\n\n배송지를 등록해주세요:\nhttps://auran.kr/my/addresses\n첫 리추얼이 곧 출발할 예정이에요!`,
        title: 'ORÆN PRIVÉ 선물 수령 완료',
      }).catch(() => {})
    }
    // 상담톡
    let channelId: string | null = null
    const { data: chRow } = await client
      .from('chat_channels')
      .select('id')
      .eq('user_id', recipientId)
      .eq('channel_type', 'owner')
      .maybeSingle()
    channelId = (chRow as any)?.id || null
    if (!channelId) {
      const { data: newCh } = await client
        .from('chat_channels')
        .insert({ user_id: recipientId, channel_type: 'owner', title: '원장님 상담', preview_text: 'ORÆN PRIVÉ 선물 멤버십이 도착했어요 🎁', unread_count: 1, is_online: false } as any)
        .select('id').maybeSingle()
      channelId = (newCh as any)?.id || null
    }
    if (channelId) {
      await client.from('consultation_messages').insert({
        channel_id: channelId,
        sender_id: recipientId,
        message: `${name}님, ORÆN PRIVÉ 선물 멤버십을 수령하셨어요 🎁\n\n배송지를 등록해주시면 첫 리추얼을 보내드릴게요:\nauran.kr/my/addresses\n\n궁금한 점은 언제든 말씀해주세요 💜`,
        message_kind: 'text',
        is_from_customer: false,
      } as any)
      await client.from('chat_channels').update({ last_message: 'ORÆN PRIVÉ 선물 멤버십이 도착했어요 🎁', last_message_at: new Date().toISOString(), unread_count: 1, preview_text: 'ORÆN PRIVÉ 선물 멤버십이 도착했어요 🎁' }).eq('id', channelId)
    }
  } catch (_) {}

  return NextResponse.json({ ok: true })
}

export async function PATCH(req: NextRequest) {
  try {
    const { token, name, phone, address, detail } = await req.json()
    if (!token || !name || !phone || !address) {
      return NextResponse.json({ error: 'missing fields' }, { status: 400 })
    }
    const client = tryCreateServiceClient()
    if (!client) return NextResponse.json({ error: 'service_unavailable' }, { status: 503 })
    const { error } = await client
      .from('membership_gifts')
      .update({
        shipping_name: name,
        shipping_phone: phone,
        shipping_address: address,
        shipping_detail: detail || null,
        shipping_status: 'address_received',
      })
      .eq('claim_token', token)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    try {
      const { data: giftD } = await client
        .from('membership_gifts')
        .select('gifted_by')
        .eq('claim_token', token)
        .maybeSingle()
      const ownerId = (giftD as any)?.gifted_by
      if (ownerId) {
        await client.from('notifications').insert({
          user_id: ownerId,
          type: 'promo',
          title: '배송지가 등록됐어요 📦',
          body: '받는 분이 배송지를 등록했어요. 발송을 준비해주세요!',
          link_url: '/admin/membership/gifts',
          is_read: false,
        } as any)
      }
    } catch (_) {}
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
