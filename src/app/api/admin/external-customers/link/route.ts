import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tryCreateServiceClient } from '@/lib/supabase/service'
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const customerId = String(body?.customer_id || '')
  if (!customerId) return NextResponse.json({ ok: false, error: 'missing_customer_id' }, { status: 400 })
  const client = tryCreateServiceClient() || supabase
  // 1. external_customers 조회
  const { data: ec } = await client
    .from('external_customers')
    .select('id,name,phone,total_amount,auran_joined,auran_user_id')
    .eq('id', customerId)
    .maybeSingle()
  if (!ec) return NextResponse.json({ ok: false, error: 'customer_not_found' }, { status: 404 })
  if ((ec as any).auran_joined && (ec as any).auran_user_id) {
    return NextResponse.json({ ok: true, already: true, message: '이미 연결된 고객이에요' })
  }
  // 2. 전화번호로 AURAN users 매칭
  let auranUserId: string | null = null
  const phone = String((ec as any).phone || '').replace(/[^0-9]/g, '')
  if (phone.length >= 10) {
    const { data: matched } = await client
      .from('users')
      .select('id,name,points')
      .or(`phone.eq.${phone},phone.eq.0${phone.slice(-10)}`)
      .maybeSingle()
    if ((matched as any)?.id) auranUserId = (matched as any).id
  }
  // 3. external_customers 업데이트
  await client.from('external_customers').update({
    auran_joined: true,
    auran_user_id: auranUserId || undefined,
    updated_at: new Date().toISOString(),
  } as any).eq('id', customerId)
  // 4. 웰컴 토스트 지급 (외부 구매액 1%)
  let toastEarned = 0
  if (auranUserId) {
    const totalAmt = Number((ec as any).total_amount || 0)
    toastEarned = Math.floor(totalAmt * 0.01)
    if (toastEarned > 0) {
      await client.from('toast_transactions').insert({
        user_id: auranUserId,
        amount: toastEarned,
        transaction_type: 'earn',
        source_type: 'manual',
        reference_id: customerId,
      } as any)
      const { data: uRow } = await client.from('users').select('points').eq('id', auranUserId).maybeSingle()
      await client.from('users').update({
        points: (Number((uRow as any)?.points || 0)) + toastEarned
      }).eq('id', auranUserId)
      await client.from('notifications').insert({
        user_id: auranUserId,
        type: 'toast',
        title: `${toastEarned.toLocaleString()}T 웰컴 선물이에요 💜`,
        body: `그동안의 구매 감사해요. 웰컴 토스트 ${toastEarned.toLocaleString()}T를 드릴게요!`,
        link_url: '/wallet',
        is_read: false,
      } as any)
    }
  }
  // 5. 원장님 알림 (admin user에게)
  try {
    const { data: adminRows } = await client.from('users').select('id').eq('role', 'admin').limit(1)
    const adminId = (adminRows as any)?.[0]?.id
    if (adminId) {
      await client.from('notifications').insert({
        user_id: adminId,
        type: 'system',
        title: `${(ec as any).name}님이 AURAN에 가입했어요 💜`,
        body: `외부 구매 이력 · ₩${Number((ec as any).total_amount || 0).toLocaleString()}${toastEarned > 0 ? ` · 웰컴 ${toastEarned.toLocaleString()}T 지급` : ''}`,
        is_read: false,
      } as any)
    }
  } catch (_) {}
  return NextResponse.json({
    ok: true,
    matched: !!auranUserId,
    toast_earned: toastEarned,
    message: auranUserId
      ? `AURAN 회원 연결 완료 · 웰컴 ${toastEarned.toLocaleString()}T 지급`
      : '가입 확인 완료 (AURAN 계정 미매칭 — 전화번호 확인 필요)',
  })
}
