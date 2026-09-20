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
  const kstYmd = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  const dayStartIso = new Date(`${kstYmd}T00:00:00+09:00`).toISOString()
  const [o, l, skinRes, clicksRes, purchRes] = await Promise.all([
    svc.from('orders').select('id,order_no,status,final_amount,ordered_at').order('ordered_at', { ascending: false }).limit(12),
    svc.from('login_logs').select('*').order('created_at', { ascending: false }).limit(12),
    svc.from('skin_cycle_analysis').select('auth_id,checkin_condition,hormone_stage').eq('record_date', kstYmd),
    svc.from('user_behavior_logs').select('id').eq('action_type', 'product_click').gte('created_at', dayStartIso),
    svc.from('user_behavior_logs').select('id,metadata').eq('action_type', 'purchase').gte('created_at', dayStartIso),
  ])
  return NextResponse.json({
    orders: o.data || [],
    logs: l.data || [],
    skin: skinRes.data || [],
    clicks: clicksRes.data || [],
    purchases: purchRes.data || [],
  })
}
