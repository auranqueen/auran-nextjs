import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tryCreateServiceClient } from '@/lib/supabase/service'
function monthBounds() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
  return { start, end }
}
export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const svc = tryCreateServiceClient() ?? supabase
  const { data: profile } = await svc.from('profiles').select('role').eq('auth_id', user.id).maybeSingle()
  if ((profile as any)?.role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const { type } = await req.json().catch(() => ({}))
  if (!type) return NextResponse.json({ error: 'missing type' }, { status: 400 })
  const { start, end } = monthBounds()
  const table = type === 'partner' ? 'partner_commissions' : 'owner_commissions'
  const { data: rows } = await svc.from(table as any).select('*').eq('status', 'confirmed').gte('created_at', start.toISOString()).lte('created_at', end.toISOString())
  const list = (rows as any[]) || []
  if (!list.length) return NextResponse.json({ ok: true, empty: true })
  if (type === 'partner') {
    const byPartner: Record<string, any[]> = {}
    for (const r of list) { const k = String(r.partner_id || ''); if (!k) continue; if (!byPartner[k]) byPartner[k] = []; byPartner[k].push(r) }
    for (const pid of Object.keys(byPartner)) {
      const chunk = byPartner[pid]
      const sum = chunk.reduce((a: number, r: any) => a + Number(r.commission_amount || 0), 0)
      const { error: insErr } = await svc.from('partner_settlements' as any).insert({ partner_id: pid, period_start: start.toISOString().slice(0, 10), period_end: end.toISOString().slice(0, 10), total_commission: sum, settlement_amount: sum, net_amount: sum, status: 'paid' } as any)
      if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })
      const ids = chunk.map((r: any) => r.id)
      const { error: updErr } = await svc.from('partner_commissions' as any).update({ status: 'paid' } as any).in('id', ids)
      if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })
    }
  } else {
    const byOwner: Record<string, any[]> = {}
    for (const r of list) { const k = String(r.owner_id || ''); if (!k) continue; if (!byOwner[k]) byOwner[k] = []; byOwner[k].push(r) }
    for (const oid of Object.keys(byOwner)) {
      const chunk = byOwner[oid]
      const sum = chunk.reduce((a: number, r: any) => a + Number(r.commission_amount || 0), 0)
      const { error: insErr } = await svc.from('owner_settlements' as any).insert({ owner_id: oid, period_start: start.toISOString().slice(0, 10), period_end: end.toISOString().slice(0, 10), settlement_amount: sum, net_amount: sum, status: 'paid' } as any)
      if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })
      const ids = chunk.map((r: any) => r.id)
      const { error: updErr } = await svc.from('owner_commissions' as any).update({ status: 'paid' } as any).in('id', ids)
      if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })
    }
  }
  return NextResponse.json({ ok: true })
}
