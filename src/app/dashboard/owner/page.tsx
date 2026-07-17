// ── OWNER (Salon)
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SalonDashClient from './client'
import OwnerDashClientV2 from './client-v2'
import OwnerHomeV3 from './OwnerHomeV3'
import type { SelfTierBrand } from './OwnerBrandSelfTierSection'
import { getOwnerLinkedBrandIds } from '@/lib/brand/getOwnerLinkedBrandIds'

export default async function OwnerDashboard({ searchParams }: { searchParams: { v?: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?role=owner')

  if (searchParams?.v === '2') {
    return <OwnerDashClientV2 />
  }

  const { data: profile } = await supabase.from('users').select('*').eq('auth_id', user.id).single()
  if (!profile) redirect('/login?role=owner')

  if (!searchParams?.v || searchParams?.v === '3') {
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
      .select('id, slug, avatar_url, owner_store_logo_url')
      .eq('auth_id', user.id)
      .maybeSingle()
    const ownerProfileId = profExtra?.id ? String(profExtra.id) : null
    // page.tsx의 profile 변수는 users row — links.owner_id = users.id
    const ownerUserId = String(profile.id)
    const linkedBrandIdsForFeed = await getOwnerLinkedBrandIds(supabase, user.id)
    if (linkedBrandIdsForFeed.length > 0) {
      const { data: post } = await supabase
        .from('brand_posts')
        .select('id, title, body, created_at, brand_id, brands(name)')
        .in('brand_id', linkedBrandIdsForFeed)
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

    const svcChange = svcPrev <= 0 ? (svcCur > 0 ? 100 : 0) : Math.round(((svcCur - svcPrev) / svcPrev) * 100)
    const prodChange = prodPrev <= 0 ? (prodCur > 0 ? 100 : 0) : Math.round(((prodCur - prodPrev) / prodPrev) * 100)
    const { data: brandCurRows } = await supabase
      .from('brand_product_orders')
      .select('owner_amount')
      .eq('salon_id', salon?.id)
      .not('status', 'in', '("결제대기","취소")')
      .gte('ordered_at', `${thisStart}T00:00:00`)
      .lte('ordered_at', `${thisEnd}T23:59:59`)
    const { data: brandPrevRows } = await supabase
      .from('brand_product_orders')
      .select('owner_amount')
      .eq('salon_id', salon?.id)
      .not('status', 'in', '("결제대기","취소")')
      .gte('ordered_at', `${prevStart}T00:00:00`)
      .lte('ordered_at', `${prevEnd}T23:59:59`)
    const brandCur = ((brandCurRows as any[]) || []).reduce((s, r) => s + Number(r.owner_amount || 0), 0)
    const brandPrev = ((brandPrevRows as any[]) || []).reduce((s, r) => s + Number(r.owner_amount || 0), 0)
    const brandChange = brandPrev <= 0 ? (brandCur > 0 ? 100 : 0) : Math.round(((brandCur - brandPrev) / brandPrev) * 100)

    const sixMonthsAgo = new Date(y, m - 5, 1)
    const trendStart = `${sixMonthsAgo.getFullYear()}-${pad(sixMonthsAgo.getMonth() + 1)}-01`
    const { data: trendBookings } = await supabase
      .from('bookings')
      .select('service_price, booking_date')
      .eq('owner_id', profile.id)
      .gte('booking_date', trendStart)
      .lte('booking_date', thisEnd)
    const { data: trendOrders } = await supabase
      .from('orders')
      .select('final_amount, ordered_at')
      .eq('owner_id', profile.id)
      .in('status', confirmedStatuses)
      .gte('ordered_at', `${trendStart}T00:00:00`)
      .lte('ordered_at', `${thisEnd}T23:59:59`)
    const monthlyTrend: { month: string; total: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(y, m - i, 1)
      const my = d.getFullYear()
      const mo = d.getMonth()
      const startMs = new Date(my, mo, 1).getTime()
      const endMs = new Date(my, mo + 1, 0, 23, 59, 59, 999).getTime()
      let total = 0
      for (const b of (trendBookings as any[]) || []) {
        const bd = new Date(String(b.booking_date)).getTime()
        if (bd >= startMs && bd <= endMs) total += Number(b.service_price || 0)
      }
      for (const o of (trendOrders as any[]) || []) {
        const od = new Date(String(o.ordered_at)).getTime()
        if (od >= startMs && od <= endMs) total += Number(o.final_amount || 0)
      }
      monthlyTrend.push({ month: `${mo + 1}월`, total })
    }

    const thirtyDaysAgo = new Date(now)
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const thirtyKey = `${thirtyDaysAgo.getFullYear()}-${pad(thirtyDaysAgo.getMonth() + 1)}-${pad(thirtyDaysAgo.getDate())}`
    const { data: recentBookings } = await supabase
      .from('bookings')
      .select('service_name')
      .eq('owner_id', profile.id)
      .gte('booking_date', thirtyKey)
    const svcMap: Record<string, number> = {}
    for (const b of (recentBookings as any[]) || []) {
      const name = String(b.service_name || '').trim() || '기타'
      svcMap[name] = (svcMap[name] || 0) + 1
    }
    const topServices = Object.entries(svcMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)

    const { data: recentOrders } = await supabase
      .from('orders')
      .select('id')
      .eq('owner_id', profile.id)
      .in('status', confirmedStatuses)
      .gte('ordered_at', `${thirtyKey}T00:00:00`)
    const recentOrderIds = ((recentOrders as any[]) || []).map((r) => r.id).filter(Boolean)
    let topProducts: { name: string; quantity: number }[] = []
    if (recentOrderIds.length) {
      const { data: itemRows } = await supabase
        .from('order_items')
        .select('product_name, quantity')
        .in('order_id', recentOrderIds)
      const prodMap: Record<string, number> = {}
      for (const it of (itemRows as any[]) || []) {
        const name = String(it.product_name || '').trim() || '기타'
        prodMap[name] = (prodMap[name] || 0) + Number(it.quantity || 0)
      }
      topProducts = Object.entries(prodMap)
        .map(([name, quantity]) => ({ name, quantity }))
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 3)
    }

    const salonId = salon?.id ? String(salon.id) : null
    const storeThumbnailUrl =
      (profExtra as any)?.owner_store_logo_url ||
      profExtra?.avatar_url ||
      salon?.avatar_url ||
      profile?.avatar_url ||
      null

    const tierBadgeBrands: Array<{
      brandId: string
      brandName: string
      packages: Array<{
        id: string
        tier_name: string
        price: number
        commission_rate: number
        product_scope?: string | null
      }>
      ownedGrade: string | null
      ownedPrice: number | null
      ownedCommissionRate: number | null
      paymentStatus: string | null
    }> = []
    if (ownerProfileId && profile.origin_track === 'B') {
      const { data: tierContractBrands } = await supabase
        .from('brands')
        .select('id, name')
        .eq('distribution_type', 'tier_contract')
      const tcRows = (tierContractBrands as any[]) || []
      if (tcRows.length) {
        const brandIds = tcRows.map((b) => String(b.id))
        const { data: pkgRows } = await supabase
          .from('brand_tier_packages')
          .select('id, brand_id, tier_name, price, commission_rate, product_scope')
          .in('brand_id', brandIds)
          .eq('is_active', true)
        const { data: gradeRows } = await supabase
          .from('brand_owner_grades')
          .select('brand_id, grade, payment_status, tier_package_id')
          .eq('owner_id', ownerProfileId)
          .in('brand_id', brandIds)
        const pkgsByBrand: Record<string, any[]> = {}
        for (const p of (pkgRows as any[]) || []) {
          const bid = String(p.brand_id)
          if (!pkgsByBrand[bid]) pkgsByBrand[bid] = []
          pkgsByBrand[bid].push(p)
        }
        const gradeByBrand: Record<
          string,
          { grade: string; payment_status: string; tier_package_id: string | null }
        > = {}
        for (const g of (gradeRows as any[]) || []) {
          gradeByBrand[String(g.brand_id)] = {
            grade: String(g.grade || ''),
            payment_status: String(g.payment_status || ''),
            tier_package_id: g.tier_package_id ? String(g.tier_package_id) : null,
          }
        }
        for (const b of tcRows) {
          const bid = String(b.id)
          const packages = (pkgsByBrand[bid] || [])
            .map((p) => ({
              id: String(p.id),
              tier_name: String(p.tier_name),
              price: Math.trunc(Number(p.price || 0)),
              commission_rate: Number(p.commission_rate ?? 0),
              product_scope: p.product_scope ?? null,
            }))
            .sort((a, b) => a.price - b.price)
          if (!packages.length) continue

          const owned = gradeByBrand[bid]
          const isPaid = owned?.payment_status === 'paid'
          const ownedPkg =
            isPaid && owned?.tier_package_id
              ? packages.find((p) => p.id === owned.tier_package_id) ?? null
              : null

          tierBadgeBrands.push({
            brandId: bid,
            brandName: String(b.name || '브랜드'),
            packages,
            ownedGrade: isPaid ? owned?.grade || null : null,
            ownedPrice: ownedPkg ? ownedPkg.price : null,
            ownedCommissionRate:
              ownedPkg && Number(ownedPkg.commission_rate) > 0
                ? Number(ownedPkg.commission_rate)
                : null,
            paymentStatus: owned?.payment_status || null,
          })
        }
      }
    }

    const BRAND_SELF_API: Record<string, string> = {
      civasan: '/api/payments/brand-self/civasan/create',
    }

    const selfTierBrands: SelfTierBrand[] = []
    if (ownerProfileId && profile.origin_track === 'A') {
      let linkedBrandIds: string[] = []

      // brand_owner_links.owner_id = users.id (profiles.id 금지)
      const { data: linkRows } = await supabase
        .from('brand_owner_links')
        .select('brand_id, status')
        .eq('owner_id', ownerUserId)
        .in('status', ['active', 'pending'])

      if (linkRows?.length) {
        linkedBrandIds = Array.from(
          new Set(linkRows.map((r: { brand_id: string }) => String(r.brand_id)).filter(Boolean)),
        )
      }

      if (linkedBrandIds.length) {
        const { data: selfBrandRows } = await supabase
          .from('brands')
          .select('id, name, slug, payapp_active')
          .in('id', linkedBrandIds)

        const eligible = ((selfBrandRows as any[]) || []).filter((b) => {
          const slug = String(b.slug || '').toLowerCase()
          return Boolean(BRAND_SELF_API[slug])
        })

        if (eligible.length) {
          const brandIds = eligible.map((b) => String(b.id))
          const { data: pkgRows } = await supabase
            .from('brand_tier_packages')
            .select('id, brand_id, tier_name, price, product_scope')
            .in('brand_id', brandIds)
            .eq('is_active', true)

          const { data: gradeRows } = await supabase
            .from('brand_owner_grades')
            .select('brand_id, grade, payment_status, tier_package_id')
            .eq('owner_id', ownerProfileId)
            .in('brand_id', brandIds)

          const pkgsByBrand: Record<string, any[]> = {}
          for (const p of (pkgRows as any[]) || []) {
            const bid = String(p.brand_id)
            if (!pkgsByBrand[bid]) pkgsByBrand[bid] = []
            pkgsByBrand[bid].push(p)
          }

          const gradeByBrand: Record<
            string,
            { grade: string; payment_status: string; tier_package_id: string | null }
          > = {}
          for (const g of (gradeRows as any[]) || []) {
            gradeByBrand[String(g.brand_id)] = {
              grade: String(g.grade || ''),
              payment_status: String(g.payment_status || ''),
              tier_package_id: g.tier_package_id ? String(g.tier_package_id) : null,
            }
          }

          for (const b of eligible) {
            const bid = String(b.id)
            const slug = String(b.slug || '').toLowerCase()
            const createApiPath = BRAND_SELF_API[slug]
            if (!createApiPath) continue

            const packages = (pkgsByBrand[bid] || [])
              .map((p) => ({
                id: String(p.id),
                tier_name: String(p.tier_name),
                price: Math.trunc(Number(p.price || 0)),
                product_scope: p.product_scope ?? null,
              }))
              .sort((a, b) => a.price - b.price)

            if (!packages.length) continue

            const owned = gradeByBrand[bid]
            const isPaid = owned?.payment_status === 'paid'
            const ownedPkg =
              isPaid && owned?.tier_package_id
                ? packages.find((p) => p.id === owned.tier_package_id) ?? null
                : null

            selfTierBrands.push({
              brandId: bid,
              brandName: String(b.name || '브랜드'),
              createApiPath,
              payappActive: Boolean(b.payapp_active),
              packages,
              ownedGrade: isPaid ? owned?.grade || null : null,
              ownedPrice: ownedPkg ? ownedPkg.price : null,
              paymentStatus: owned?.payment_status || null,
            })
          }
        }
      }
    }

    return (
      <OwnerHomeV3
        profile={profile}
        salon={salon}
        todayBookings={todayBookings || []}
        serviceRevenue={{ current: svcCur, previous: svcPrev, changePercent: svcChange }}
        productRevenue={{ current: prodCur, previous: prodPrev, changePercent: prodChange }}
        brandProductRevenue={{ current: brandCur, previous: brandPrev, changePercent: brandChange }}
        pendingCsCount={pendingCsCount}
        unreadChatCount={unreadChatCount}
        recentChats={recentChats}
        recruitedOwners={recruitedOwners}
        brandPost={brandPost}
        monthlyTrend={monthlyTrend}
        topServices={topServices}
        topProducts={topProducts}
        salonId={salonId}
        storeThumbnailUrl={storeThumbnailUrl}
        tierBadgeBrands={tierBadgeBrands}
        selfTierBrands={selfTierBrands}
      />
    )
  }

  if (searchParams?.v === '1') {
    const { data: salon } = await supabase.from('salons').select('*').eq('owner_id', profile.id).single()
    const { data: todayBookings } = await supabase
      .from('bookings')
      .select('*')
      .eq('owner_id', profile.id)
      .eq('booking_date', new Date().toISOString().slice(0, 10))
      .order('booking_time')

    return <SalonDashClient profile={profile} salon={salon} todayBookings={todayBookings || []} />
  }

  redirect('/dashboard/owner')
}
