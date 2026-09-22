import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tryCreateServiceClient } from '@/lib/supabase/service'
export async function POST() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const svc = tryCreateServiceClient() ?? supabase
  const { data: profile } = await svc.from('profiles').select('role').eq('auth_id', user.id).maybeSingle()
  if ((profile as any)?.role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const [{ data: planData }, { data: subData }] = await Promise.all([
    svc.from('subscription_plans').select('*').order('sort_order', { ascending: true }).limit(200),
    svc.from('owner_subscriptions').select('*').order('created_at', { ascending: false }).limit(500),
  ])
  const subList = (subData || []) as any[]
  const ownerIds = Array.from(new Set(subList.map((s) => String(s.owner_id || '')).filter(Boolean)))
  let users: any[] = []
  if (ownerIds.length) {
    const { data: urows } = await svc.from('users').select('id,name,email').in('id', ownerIds)
    users = urows || []
  }
  return NextResponse.json({ plans: planData || [], subs: subList, users })
}
