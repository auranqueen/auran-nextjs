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
  const [
    { data: salons },
    { data: op },
    { data: reps },
    { data: subs },
    { data: warns },
    { data: setRows },
    { data: pTx },
  ] = await Promise.all([
    svc.from('salons').select('id,owner_id,name,area,address,phone,status,created_at').order('created_at', { ascending: false }).limit(200),
    svc.from('profiles').select('*').eq('role', 'owner').order('created_at', { ascending: false }).limit(300),
    svc.from('owner_reports').select('*').order('created_at', { ascending: false }).limit(200),
    svc.from('owner_subscriptions').select('*').order('created_at', { ascending: false }).limit(300),
    svc.from('owner_warnings').select('*').order('created_at', { ascending: false }).limit(300),
    svc.from('admin_settings').select('value').eq('category', 'settlement').eq('key', 'owner_settlement_requires_chart').maybeSingle(),
    svc.from('point_transactions').select('amount,type').eq('type', 'prescription_commission').limit(500),
  ])
  const ownerIds = Array.from(new Set((salons || []).map((x: any) => x.owner_id).filter(Boolean)))
  let users: any[] = []
  if (ownerIds.length) {
    const { data: u } = await svc.from('users').select('id,name,email,status').in('id', ownerIds)
    users = u || []
  }
  return NextResponse.json({
    salons: salons || [],
    users,
    profiles: op || [],
    reports: reps || [],
    subscriptions: subs || [],
    warnings: warns || [],
    adminSettings: setRows,
    pointTransactions: pTx || [],
  })
}
