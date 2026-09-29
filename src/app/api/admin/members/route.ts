import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tryCreateAdminClient } from '@/lib/supabase/admin'

const MEMBER_COLUMNS = 'id,auth_id,name,email,role,status,points,is_founder,created_at,last_login_at,customer_grade'
const ALLOWED_STATUS = ['active', 'suspended']

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

  // ── init: 회원 목록 + 플랜 목록 ───────────────────────────────
  if (action === 'init') {
    const [{ data: members, error: mErr }, { data: plans }] = await Promise.all([
      svc.from('users')
        .select(MEMBER_COLUMNS)
        .order('created_at', { ascending: false })
        .limit(200),
      svc.from('membership_plans')
        .select('id,name,price')
        .eq('is_active', true)
        .order('display_order', { ascending: true }),
    ])
    if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 })
    return NextResponse.json({ members: members ?? [], plans: plans ?? [] })
  }

  // ── detail: 선택 회원의 주문·포인트·로그 ───────────────────────
  if (action === 'detail') {
    const memberId = typeof body.memberId === 'string' ? body.memberId : ''
    if (!memberId) return NextResponse.json({ error: 'memberId_required' }, { status: 400 })
    const [{ data: orders }, { data: points }, { data: logs }] = await Promise.all([
      svc.from('orders')
        .select('id,order_no,status,final_amount,ordered_at,order_items(product_name,quantity)')
        .eq('customer_id', memberId)
        .order('ordered_at', { ascending: false })
        .limit(30),
      svc.from('point_history')
        .select('id,type,amount,balance,description,created_at')
        .eq('user_id', memberId)
        .order('created_at', { ascending: false })
        .limit(30),
      svc.from('login_logs')
        .select('id,email,ip_address,user_agent,created_at')
        .eq('user_id', memberId)
        .order('created_at', { ascending: false })
        .limit(30),
    ])
    return NextResponse.json({ orders: orders ?? [], points: points ?? [], logs: logs ?? [] })
  }

  // ── setStatus: suspend / activate ─────────────────────────────
  if (action === 'setStatus') {
    const { memberId, status } = body
    if (typeof memberId !== 'string' || !memberId || !ALLOWED_STATUS.includes(status))
      return NextResponse.json({ error: 'invalid_params' }, { status: 400 })
    const { error } = await svc
      .from('users')
      .update({ status })
      .eq('id', memberId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  // ── toggleFounder ──────────────────────────────────────────────
  if (action === 'toggleFounder') {
    const { memberId, value } = body
    if (typeof memberId !== 'string' || !memberId || typeof value !== 'boolean')
      return NextResponse.json({ error: 'invalid_params' }, { status: 400 })
    const { error } = await svc
      .from('users')
      .update({ is_founder: value })
      .eq('id', memberId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'unknown action' }, { status: 400 })
}
