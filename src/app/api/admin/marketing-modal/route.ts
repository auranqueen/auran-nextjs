import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tryCreateServiceClient } from '@/lib/supabase/service'
export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const svc = tryCreateServiceClient() ?? supabase
  const { data: profile } = await svc.from('profiles').select('role').eq('auth_id', user.id).maybeSingle()
  if ((profile as any)?.role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const body = await req.json().catch(() => ({}))
  const { action, rows } = body
  if (action === 'list') {
    const [{ data: mem }, { data: prof }, { data: items }] = await Promise.all([
      svc.from('user_memberships').select('user_id, status, shipments_remaining, next_shipment_date, membership_plans(name), users!user_memberships_user_id_fkey(name, email)').eq('status', 'active'),
      svc.from('profiles').select('auth_id, total_purchase_amount, grade').order('total_purchase_amount', { ascending: false }).limit(100),
      svc.from('order_items').select('product_name, quantity, subtotal').limit(2000),
    ])
    // N+1 해결: auth_id 목록으로 users 한 번에 조회
    const authIds = ((prof || []) as any[]).map((p: any) => p.auth_id).filter(Boolean)
    let usersMap: Record<string, any> = {}
    if (authIds.length) {
      const { data: urows } = await svc.from('users').select('id, name, email, auth_id').in('auth_id', authIds)
      for (const u of (urows || []) as any[]) {
        usersMap[u.auth_id] = u
      }
    }
    const profWithUsers = ((prof || []) as any[]).map((p: any) => ({ ...p, users: usersMap[p.auth_id] || null }))
    return NextResponse.json({ memberships: mem || [], profiles: profWithUsers, orderItems: items || [] })
  }
  if (action === 'notify') {
    const { error } = await svc.from('notifications').insert(rows)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }
  return NextResponse.json({ error: 'unknown action' }, { status: 400 })
}
