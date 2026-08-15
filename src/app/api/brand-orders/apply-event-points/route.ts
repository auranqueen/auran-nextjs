import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tryCreateServiceClient } from '@/lib/supabase/service'
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'not_logged_in' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const pointsByOrder = (body?.points_by_order || {}) as Record<string, number>
  const earnedByOrder = (body?.earned_by_order || {}) as Record<string, number>
  const orderIds = Array.from(new Set([...Object.keys(pointsByOrder), ...Object.keys(earnedByOrder)]))
  if (!orderIds.length) {
    return NextResponse.json({ ok: false, error: 'no_orders' }, { status: 400 })
  }
  const { data: profile } = await supabase.from('profiles').select('id').eq('auth_id', user.id).maybeSingle()
  if (!profile?.id) return NextResponse.json({ ok: false, error: 'profile_missing' }, { status: 400 })
  const svc = tryCreateServiceClient()
  if (!svc) return NextResponse.json({ ok: false, error: 'service_unavailable' }, { status: 500 })
  const { data: orderRows } = await svc
    .from('brand_orders')
    .select('id, profile_id')
    .in('id', orderIds)
  const validIds = (orderRows || [])
    .filter((o: { profile_id: string }) => o.profile_id === profile.id)
    .map((o: { id: string }) => o.id)
  for (const id of validIds) {
    const pts = Math.trunc(Number(pointsByOrder[id]) || 0)
    const earned = Math.trunc(Number(earnedByOrder[id]) || 0)
    const update: Record<string, number> = {}
    if (pts > 0) update.points_used = pts
    if (earnedByOrder[id] !== undefined && earned >= 0) update.points_earned = earned
    if (Object.keys(update).length > 0) {
      await svc.from('brand_orders').update(update).eq('id', id)
    }
  }
  return NextResponse.json({ ok: true, updated: validIds.length })
}
