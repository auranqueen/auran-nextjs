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
  const { statusFilter, df, dt } = body
  let pq = svc.from('partner_commissions' as any).select('*').order('created_at', { ascending: false }).limit(500)
  let oq = svc.from('owner_commissions' as any).select('*').order('created_at', { ascending: false }).limit(500)
  if (statusFilter) { pq = pq.eq('status', statusFilter); oq = oq.eq('status', statusFilter) }
  if (df) { pq = pq.gte('created_at', new Date(df).toISOString()); oq = oq.gte('created_at', new Date(df).toISOString()) }
  if (dt) {
    const e = new Date(dt); e.setHours(23, 59, 59, 999)
    pq = pq.lte('created_at', e.toISOString()); oq = oq.lte('created_at', e.toISOString())
  }
  const [{ data: pr }, { data: or }] = await Promise.all([pq, oq])
  const pl = (pr as any[]) || []
  const ol = (or as any[]) || []
  const userIds = Array.from(new Set([...pl.map((r: any) => String(r.partner_id || '')).filter(Boolean), ...ol.map((r: any) => String(r.owner_id || '')).filter(Boolean)]))
  const pids = Array.from(new Set([...pl.map((r: any) => String(r.product_id || '')), ...ol.map((r: any) => String(r.product_id || ''))].filter(Boolean)))
  const [usersRes, prodsRes] = await Promise.all([
    userIds.length ? svc.from('users').select('id,name').in('id', userIds) : Promise.resolve({ data: [] }),
    pids.length ? svc.from('products').select('id,name').in('id', pids) : Promise.resolve({ data: [] }),
  ])
  return NextResponse.json({ partnerRows: pl, ownerRows: ol, users: usersRes.data || [], products: prodsRes.data || [] })
}
