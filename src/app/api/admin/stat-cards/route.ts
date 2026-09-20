import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tryCreateServiceClient } from '@/lib/supabase/service'
export async function POST() {
  const supabase = createClient()
  const svc = tryCreateServiceClient() ?? supabase
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const kstYmd = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(now)
  const dayStart = new Date(`${kstYmd}T00:00:00+09:00`).toISOString()
  const yesterday = new Date(new Date().setDate(new Date().getDate() - 1))
  const yesterdayStart = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(yesterday)
  const yesterdayStartIso = new Date(`${yesterdayStart}T00:00:00+09:00`).toISOString()
  const [hormone, reviews, toast, orders, todayVisitors, yesterdayResult, externalRaw, externalJoined] =
    await Promise.all([
      svc.from('hormone_cycle').select('track').not('track', 'is', null),
      svc.from('reviews').select('id,images,video_url,is_rebuy').gte('created_at', monthStart),
      svc.from('toast_transactions').select('amount,transaction_type').gte('created_at', dayStart),
      svc.from('orders').select('customer_id,status').gte('ordered_at', monthStart),
      svc.from('visitor_logs').select('ip,referrer,user_agent,page,created_at').gte('created_at', dayStart).order('created_at', { ascending: false }).limit(100),
      svc.from('visitor_logs').select('id', { count: 'exact', head: true }).gte('created_at', yesterdayStartIso).lt('created_at', dayStart),
      svc.from('external_customers').select('id', { count: 'exact', head: true }),
      svc.from('external_customers').select('id', { count: 'exact', head: true }).not('user_id', 'is', null),
    ])
  return NextResponse.json({
    hormone: hormone.data ?? [],
    reviews: reviews.data ?? [],
    toast: toast.data ?? [],
    orders: orders.data ?? [],
    todayVisitors: todayVisitors.data ?? [],
    yesterdayCount: yesterdayResult.count ?? 0,
    external: {
      total: externalRaw.count ?? 0,
      joined: externalJoined.count ?? 0,
      pct: externalRaw.count ? Math.round((externalJoined.count ?? 0) / externalRaw.count * 100) : 0,
    },
  })
}
