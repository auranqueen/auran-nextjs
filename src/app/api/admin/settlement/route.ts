import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tryCreateAdminClient } from '@/lib/supabase/admin'

export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const svc = tryCreateAdminClient() ?? supabase
  const { data: profile } = await svc
    .from('profiles')
    .select('role')
    .eq('auth_id', user.id)
    .maybeSingle()
  if ((profile as any)?.role !== 'admin')
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const { action } = body

  // ── init: adminId + 정산대기 목록 ──────────────────────────────
  if (action === 'init') {
    const { data: userRow } = await svc
      .from('users')
      .select('id, role')
      .eq('auth_id', user.id)
      .maybeSingle()
    const adminId = (userRow as any)?.id ?? null
    const { data: settlements, error } = await svc
      .from('settlements')
      .select('id,target_id,target_role,target_name,amount,platform_fee,net_amount,period_start,period_end,status,created_at')
      .eq('status', '정산대기')
      .order('created_at', { ascending: false })
      .limit(500)
    return NextResponse.json({ adminId, settlements: settlements ?? [], error: error?.message })
  }

  // ── hold: 1건 보류 ─────────────────────────────────────────────
  if (action === 'hold') {
    const { id } = body
    const { error } = await svc
      .from('settlements')
      .update({ status: '보류' })
      .eq('id', id)
    return NextResponse.json({ error: error?.message })
  }

  // ── batchPay: 다건 정산완료 ────────────────────────────────────
  if (action === 'batchPay') {
    const { ids, adminId } = body
    const now = new Date().toISOString()
    const { error } = await svc
      .from('settlements')
      .update({ status: '정산완료', approved_by: adminId, approved_at: now, paid_at: now })
      .in('id', ids)
    return NextResponse.json({ error: error?.message })
  }

  // ── createFromOrders: 기간 내 커미션 합산 → 정산대기 생성 ──────
  if (action === 'createFromOrders') {
    const { periodStart, periodEnd } = body

    // 1) 배송완료 주문 커미션 조회
    const { data: orders, error: oErr } = await svc
      .from('orders')
      .select('id,partner_id,partner_commission,owner_id,owner_commission,delivered_at,status')
      .gte('delivered_at', periodStart)
      .lte('delivered_at', periodEnd)
      .eq('status', '배송완료')
    if (oErr) return NextResponse.json({ error: oErr.message })

    // 2) partner/owner 커미션 합산
    const partnerSum = new Map<string, number>()
    const ownerSum = new Map<string, number>()
    ;(orders || []).forEach((o: any) => {
      if (o.partner_id && o.partner_commission)
        partnerSum.set(o.partner_id, (partnerSum.get(o.partner_id) || 0) + Number(o.partner_commission || 0))
      if (o.owner_id && o.owner_commission)
        ownerSum.set(o.owner_id, (ownerSum.get(o.owner_id) || 0) + Number(o.owner_commission || 0))
    })
    const targetIds = Array.from(new Set([...Array.from(partnerSum.keys()), ...Array.from(ownerSum.keys())]))
    if (targetIds.length === 0)
      return NextResponse.json({ inserted: 0, message: '해당 기간에 생성할 정산 대상이 없습니다.' })

    // 3) 이름 조회
    const { data: users, error: uErr } = await svc
      .from('users')
      .select('id,name')
      .in('id', targetIds)
    if (uErr) return NextResponse.json({ error: uErr.message })
    const nameMap: Record<string, string> = {}
    ;(users || []).forEach((u: any) => (nameMap[u.id] = u.name))

    // 4) 중복 확인
    const { data: existing, error: eErr } = await svc
      .from('settlements')
      .select('id,target_id,target_role,period_start,period_end,status')
      .in('target_id', targetIds)
      .eq('status', '정산대기')
      .gte('period_start', periodStart)
      .lte('period_end', periodEnd)
      .limit(500)
    if (eErr) return NextResponse.json({ error: eErr.message })
    const existKey = new Set<string>()
    ;(existing || []).forEach((x: any) => {
      existKey.add(`${x.target_id}|${x.target_role}|${String(x.period_start).slice(0, 10)}|${String(x.period_end).slice(0, 10)}`)
    })
    const keyOf = (targetId: string, role: string) =>
      `${targetId}|${role}|${periodStart.slice(0, 10)}|${periodEnd.slice(0, 10)}`

    // 5) INSERT 행 구성
    const inserts: any[] = []
    partnerSum.forEach((amount, targetId) => {
      if (amount <= 0) return
      if (existKey.has(keyOf(targetId, 'partner'))) return
      inserts.push({
        target_id: targetId, target_role: 'partner',
        target_name: nameMap[targetId] || null,
        amount, platform_fee: 0, net_amount: amount,
        period_start: periodStart, period_end: periodEnd,
        status: '정산대기',
      })
    })
    ownerSum.forEach((amount, targetId) => {
      if (amount <= 0) return
      if (existKey.has(keyOf(targetId, 'owner'))) return
      inserts.push({
        target_id: targetId, target_role: 'owner',
        target_name: nameMap[targetId] || null,
        amount, platform_fee: 0, net_amount: amount,
        period_start: periodStart, period_end: periodEnd,
        status: '정산대기',
      })
    })
    if (inserts.length === 0)
      return NextResponse.json({ inserted: 0, message: '이미 생성된 정산대기(동일 기간)가 있어 추가 생성할 항목이 없습니다.' })

    const { error: insErr } = await svc.from('settlements').insert(inserts)
    if (insErr) return NextResponse.json({ error: insErr.message })
    return NextResponse.json({ inserted: inserts.length })
  }

  return NextResponse.json({ error: 'unknown action' }, { status: 400 })
}
