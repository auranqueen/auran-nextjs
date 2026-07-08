// ── OWNER (Salon)
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SalonDashClient from './client'
import OwnerDashClientV2 from './client-v2'
import OwnerHomeV3 from './OwnerHomeV3'

export default async function OwnerDashboard({ searchParams }: { searchParams: { v?: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?role=owner')

  if (searchParams?.v === '2') {
    return <OwnerDashClientV2 />
  }

  const { data: profile } = await supabase.from('users').select('*').eq('auth_id', user.id).single()
  if (!profile) redirect('/login?role=owner')

  if (searchParams?.v === '3') {
    const now = new Date()
    const y = now.getFullYear()
    const m = now.getMonth()
    const pad = (n: number) => String(n).padStart(2, '0')
    const thisStart = `${y}-${pad(m + 1)}-01`
    const thisEnd = `${y}-${pad(m + 1)}-${pad(new Date(y, m + 1, 0).getDate())}`
    const prevY = m === 0 ? y - 1 : y
    const prevMo = m === 0 ? 12 : m
    const prevStart = `${prevY}-${pad(prevMo)}-01`
    const prevEnd = `${prevY}-${pad(prevMo)}-${pad(new Date(prevY, prevMo, 0).getDate())}`
    const todayKey = `${y}-${pad(m + 1)}-${pad(now.getDate())}`
    const confirmedStatuses = ['구매확정', '완료', 'completed']

    const { data: svcCurRows } = await supabase
      .from('bookings')
      .select('service_price')
      .eq('owner_id', profile.id)
      .gte('booking_date', thisStart)
      .lte('booking_date', thisEnd)
    const { data: svcPrevRows } = await supabase
      .from('bookings')
      .select('service_price')
      .eq('owner_id', profile.id)
      .gte('booking_date', prevStart)
      .lte('booking_date', prevEnd)
    const svcCur = ((svcCurRows as any[]) || []).reduce((s, r) => s + Number(r.service_price || 0), 0)
    const svcPrev = ((svcPrevRows as any[]) || []).reduce((s, r) => s + Number(r.service_price || 0), 0)

    const { data: prodCurRows } = await supabase
      .from('orders')
      .select('final_amount')
      .eq('owner_id', profile.id)
      .in('status', confirmedStatuses)
      .gte('ordered_at', `${thisStart}T00:00:00`)
      .lte('ordered_at', `${thisEnd}T23:59:59`)
    const { data: prodPrevRows } = await supabase
      .from('orders')
      .select('final_amount')
      .eq('owner_id', profile.id)
      .in('status', confirmedStatuses)
      .gte('ordered_at', `${prevStart}T00:00:00`)
      .lte('ordered_at', `${prevEnd}T23:59:59`)
    const prodCur = ((prodCurRows as any[]) || []).reduce((s, r) => s + Number(r.final_amount || 0), 0)
    const prodPrev = ((prodPrevRows as any[]) || []).reduce((s, r) => s + Number(r.final_amount || 0), 0)

    const { data: salon } = await supabase.from('salons').select('*').eq('owner_id', profile.id).single()
    const { data: todayBookings } = await supabase
      .from('bookings')
      .select('*')
      .eq('owner_id', profile.id)
      .eq('booking_date', todayKey)
      .order('booking_time')

    const { data: myOrderIds } = await supabase.from('orders').select('id').eq('owner_id', profile.id).limit(500)
    const orderIds = ((myOrderIds as any[]) || []).map((r) => r.id).filter(Boolean)
    let pendingCsCount = 0
    if (orderIds.length) {
      const { count } = await supabase
        .from('cs_requests')
        .select('id', { count: 'exact', head: true })
        .in('order_id', orderIds)
        .eq('status', 'pending')
      pendingCsCount = count || 0
    }

    const { data: channels } = await supabase
      .from('chat_channels')
      .select('id,title,preview_text,last_message_at,unread_count')
      .eq('channel_type', 'owner')
      .eq('owner_id', profile.id)
      .order('last_message_at', { ascending: false })
    const chRows = (channels as any[]) || []
    const unreadChatCount = chRows.reduce((s, c) => s + Math.max(0, Number(c.unread_count || 0)), 0)
    const recentChats = chRows.slice(0, 3).map((c) => ({
      id: c.id,
      title: c.title ?? null,
      preview_text: c.preview_text ?? null,
      last_message_at: c.last_message_at ?? null,
      unread_count: Number(c.unread_count || 0),
    }))

    const { data: recruited } = await supabase
      .from('users')
      .select('id, name')
      .eq('referred_by', profile.id)
      .eq('role', 'owner')
    const recruitedOwners = [] as Array<{ id: string; name: string; monthSales: number }>
    for (const o of (recruited as any[]) || []) {
      const { data: ors } = await supabase
        .from('orders')
        .select('final_amount')
        .eq('owner_id', o.id)
        .in('status', confirmedStatuses)
        .gte('ordered_at', `${thisStart}T00:00:00`)
        .lte('ordered_at', `${thisEnd}T23:59:59`)
      const monthSales = ((ors as any[]) || []).reduce((s, r) => s + Number(r.final_amount || 0), 0)
      recruitedOwners.push({ id: o.id, name: o.name || '원장', monthSales })
    }

    let brandPost: {
      id: string
      title: string | null
      body: string
      created_at: string
      brand_name?: string | null
    } | null = null
    const { data: profExtra } = await supabase
      .from('profiles')
      .select('trade_brands, preferred_brands')
      .eq('auth_id', user.id)
      .maybeSingle()
    const brandNames: string[] =
      Array.isArray(profExtra?.trade_brands) && (profExtra.trade_brands as any[]).length > 0
        ? (profExtra!.trade_brands as any[]).map(String)
        : Array.isArray(profExtra?.preferred_brands)
          ? (profExtra!.preferred_brands as any[]).map(String)
          : []
    if (brandNames.length > 0) {
      const { data: bRows } = await supabase.from('brands').select('id, name').in('name', brandNames)
      const ids = ((bRows as any[]) || []).map((b) => b.id)
      if (ids.length) {
        const { data: post } = await supabase
          .from('brand_posts')
          .select('id, title, body, created_at, brand_id, brands(name)')
          .in('brand_id', ids)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (post) {
          brandPost = {
            id: post.id,
            title: post.title,
            body: post.body,
            created_at: post.created_at,
            brand_name: (post as any).brands?.name ?? null,
          }
        }
      }
    }

    const svcChange = svcPrev <= 0 ? (svcCur > 0 ? 100 : 0) : Math.round(((svcCur - svcPrev) / svcPrev) * 100)
    const prodChange = prodPrev <= 0 ? (prodCur > 0 ? 100 : 0) : Math.round(((prodCur - prodPrev) / prodPrev) * 100)

    return (
      <OwnerHomeV3
        profile={profile}
        salon={salon}
        todayBookings={todayBookings || []}
        serviceRevenue={{ current: svcCur, previous: svcPrev, changePercent: svcChange }}
        productRevenue={{ current: prodCur, previous: prodPrev, changePercent: prodChange }}
        pendingCsCount={pendingCsCount}
        unreadChatCount={unreadChatCount}
        recentChats={recentChats}
        recruitedOwners={recruitedOwners}
        brandPost={brandPost}
      />
    )
  }

  const { data: salon } = await supabase.from('salons').select('*').eq('owner_id', profile.id).single()
  const { data: todayBookings } = await supabase
    .from('bookings')
    .select('*')
    .eq('owner_id', profile.id)
    .eq('booking_date', new Date().toISOString().slice(0, 10))
    .order('booking_time')

  return <SalonDashClient profile={profile} salon={salon} todayBookings={todayBookings || []} />
}
