import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tryCreateServiceClient } from '@/lib/supabase/service'

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
      body: '두 달마다, 오랜이 고른 리추얼이 도착해요',
      is_read: false,
    } as any)
  }

  await client
    .from('membership_gifts')
    .update({ status: 'claimed', claimed_by: recipientId, claimed_at: new Date().toISOString() })
    .eq('id', gift.id)
    .eq('status', 'paid')

  return NextResponse.json({ ok: true })
}
