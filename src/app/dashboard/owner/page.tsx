// ── OWNER (Salon)
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SalonDashClient from './client'
import OwnerHomeV3 from './OwnerHomeV3'
import type { SelfTierBrand } from './OwnerBrandSelfTierSection'
import { getOwnerLinkedBrandIds } from '@/lib/brand/getOwnerLinkedBrandIds'

export default async function OwnerDashboard({ searchParams }: { searchParams: { v?: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?role=owner')

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
    const sixMonthsAgo = new Date(y, m - 5, 1)
    const trendStart = `${sixMonthsAgo.getFullYear()}-${pad(sixMonthsAgo.getMonth() + 1)}-01`
    const thirtyDaysAgo = new Date(now)
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const thirtyKey = `${thirtyDaysAgo.getFullYear()}-${pad(thirtyDaysAgo.getMonth() + 1)}-${pad(thirtyDaysAgo.getDate())}`
    // page.tsx의 profile 변수는 users row — links.owner_id = users.id
    const ownerUserId = String(profile.id)
    const isTrackB = profile.origin_track === 'B'
    const isTrackA = profile.origin_track === 'A'

    // ── 웨이브2: profile 이후 병렬 (A/B 슬롯은 트랙별로만 실제 쿼리)
    const [
      { data: svcCurRows },
      { data: svcPrevRows },
      { data: todayBookings },
      { data: trendBookings },
      { data: recentBookings },
      { data: prodCurRows },
      { data: prodPrevRows },
      { data: myOrderIds },
      { data: trendOrders },
      { data: recentOrders },
      { data: salon },
      { data: channels },
      { data: profExtra },
      linkedBrandIdsForFeed,
      recruitedResult,
      linkRowsResult,
    ] = await Promise.all([
      supabase.from('bookings').select('service_price').eq('owner_id', profile.id).gte('booking_date', thisStart).lte('booking_date', thisEnd),
      supabase.from('bookings').select('service_price').eq('owner_id', profile.id).gte('booking_date', prevStart).lte('booking_date', prevEnd),
      supabase.from('bookings').select('*').eq('owner_id', profile.id).eq('booking_date', todayKey).order('booking_time'),
      supabase.from('bookings').select('service_price, booking_date').eq('owner_id', profile.id).gte('booking_date', trendStart).lte('booking_date', thisEnd),
      supabase.from('bookings').select('service_name').eq('owner_id', profile.id).gte('booking_date', thirtyKey),
      supabase.from('orders').select('final_amount').eq('owner_id', profile.id).in('status', confirmedStatuses).gte('ordered_at', `${thisStart}T00:00:00`).lte('ordered_at', `${thisEnd}T23:59:59`),
      supabase.from('orders').select('final_amount').eq('owner_id', profile.id).in('status', confirmedStatuses).gte('ordered_at', `${prevStart}T00:00:00`).lte('ordered_at', `${prevEnd}T23:59:59`),
      supabase.from('orders').select('id').eq('owner_id', profile.id).limit(500),
      supabase.from('orders').select('final_amount, ordered_at').eq('owner_id', profile.id).in('status', confirmedStatuses).gte('ordered_at', `${trendStart}T00:00:00`).lte('ordered_at', `${thisEnd}T23:59:59`),
      supabase.from('orders').select('id').eq('owner_id', profile.id).in('status', confirmedStatuses).gte('ordered_at', `${thirtyKey}T00:00:00`),
      supabase.from('salons').select('*').eq('owner_id', profile.id).single(),
      supabase.from('chat_channels').select('id,title,preview_text,last_message_at,unread_count').eq('channel_type', 'owner').eq('owner_id', profile.id).order('last_message_at', { ascending: false }),
      supabase.from('profiles').select('id, slug, avatar_url, owner_store_logo_url').eq('auth_id', user.id).maybeSingle(),
      getOwnerLinkedBrandIds(supabase, user.id),
      isTrackB
        ? supabase.from('users').select('id, name').eq('referred_by', profile.id).eq('role', 'owner')
        : Promise.resolve({ data: null as { id: string; name: string }[] | null }),
      isTrackA
        ? supabase.from('brand_owner_links').select('brand_id, status').eq('owner_id', ownerUserId).in('status', ['active', 'pending'])
        : Promise.resolve({ data: null as { brand_id: string; status: string }[] | null }),
    ])

    const svcCur = ((svcCurRows as any[]) || []).reduce((s, r) => s + Number(r.service_price || 0), 0)
    const svcPrev = ((svcPrevRows as any[]) || []).reduce((s, r) => s + Number(r.service_price || 0), 0)
    const prodCur = ((prodCurRows as any[]) || []).reduce((s, r) => s + Number(r.final_amount || 0), 0)
    const prodPrev = ((prodPrevRows as any[]) || []).reduce((s, r) => s + Number(r.final_amount || 0), 0)
    const orderIds = ((myOrderIds as any[]) || []).map((r) => r.id).filter(Boolean)
    const recentOrderIds = ((recentOrders as any[]) || []).map((r) => r.id).filter(Boolean)
    const chRows = (channels as any[]) || []
    const unreadChatCount = chRows.reduce((s, c) => s + Math.max(0, Number(c.unread_count || 0)), 0)
    const recentChats = chRows.slice(0, 3).map((c) => ({
      id: c.id,
      title: c.title ?? null,
      preview_text: c.preview_text ?? null,
      last_message_at: c.last_message_at ?? null,
      unread_count: Number(c.unread_count || 0),
    }))
    const ownerProfileId = profExtra?.id ? String(profExtra.id) : null
    const recruitedList = isTrackB ? (((recruitedResult as any).data as any[]) || []) : []

    let linkedBrandIds: string[] = []
    if (isTrackA && (linkRowsResult as any)?.data?.length) {
      linkedBrandIds = Array.from(
        new Set(
          ((linkRowsResult as any).data as any[])
            .map((r: { brand_id: string }) => String(r.brand_id))
            .filter(Boolean),
        ),
      )
    }

    // ── 웨이브3: W2 결과 의존 병렬 (모집원장 orders = 원본과 동일 개별 쿼리, 실행만 병렬)
    const [
      csCountResult,
      { data: brandCurRows },
      { data: brandPrevRows },
      { data: post },
      { data: itemRows },
      recruitedOwners,
      { data: tierContractBrands },
      { data: selfBrandRows },
    ] = await Promise.all([
      orderIds.length
        ? supabase
            .from('cs_requests')
            .select('id', { count: 'exact', head: true })
            .in('order_id', orderIds)
            .eq('status', 'pending')
        : Promise.resolve({ count: 0 }),
      supabase
        .from('brand_product_orders')
        .select('owner_amount')
        .eq('salon_id', salon?.id)
        .not('status', 'in', '("결제대기","취소")')
        .gte('ordered_at', `${thisStart}T00:00:00`)
        .lte('ordered_at', `${thisEnd}T23:59:59`),
      supabase
        .from('brand_product_orders')
        .select('owner_amount')
        .eq('salon_id', salon?.id)
        .not('status', 'in', '("결제대기","취소")')
        .gte('ordered_at', `${prevStart}T00:00:00`)
        .lte('ordered_at', `${prevEnd}T23:59:59`),
      linkedBrandIdsForFeed.length > 0
        ? supabase
            .from('brand_posts')
            .select('id, title, body, created_at, brand_id, brands(name)')
            .in('brand_id', linkedBrandIdsForFeed)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      recentOrderIds.length
        ? supabase.from('order_items').select('product_name, quantity').in('order_id', recentOrderIds)
        : Promise.resolve({ data: null }),
      isTrackB
        ? Promise.all(
            recruitedList.map(async (o: { id: string; name?: string | null }) => {
              const { data: ors } = await supabase
                .from('orders')
                .select('final_amount')
                .eq('owner_id', o.id)
                .in('status', confirmedStatuses)
                .gte('ordered_at', `${thisStart}T00:00:00`)
                .lte('ordered_at', `${thisEnd}T23:59:59`)
              const monthSales = ((ors as any[]) || []).reduce((s, r) => s + Number(r.final_amount || 0), 0)
              return { id: o.id, name: o.name || '원장', monthSales }
            }),
          )
        : Promise.resolve([] as Array<{ id: string; name: string; monthSales: number }>),
      isTrackB
        ? supabase.from('brands').select('id, name, company_id').eq('distribution_type', 'tier_contract')
        : Promise.resolve({ data: null }),
      isTrackA && linkedBrandIds.length
        ? supabase.from('brands').select('id, name, company_id').in('id', linkedBrandIds)
        : Promise.resolve({ data: null }),
    ])

    const pendingCsCount = (csCountResult as any).count || 0
    const brandCur = ((brandCurRows as any[]) || []).reduce((s, r) => s + Number(r.owner_amount || 0), 0)
    const brandPrev = ((brandPrevRows as any[]) || []).reduce((s, r) => s + Number(r.owner_amount || 0), 0)

    let brandPost: {
      id: string
      title: string | null
      body: string
      created_at: string
      brand_name?: string | null
    } | null = null
    if (post) {
      brandPost = {
        id: post.id,
        title: post.title,
        body: post.body,
        created_at: post.created_at,
        brand_name: (post as any).brands?.name ?? null,
      }
    }

    const svcChange = svcPrev <= 0 ? (svcCur > 0 ? 100 : 0) : Math.round(((svcCur - svcPrev) / svcPrev) * 100)
    const prodChange = prodPrev <= 0 ? (prodCur > 0 ? 100 : 0) : Math.round(((prodCur - prodPrev) / prodPrev) * 100)
    const brandChange = brandPrev <= 0 ? (brandCur > 0 ? 100 : 0) : Math.round(((brandCur - brandPrev) / brandPrev) * 100)

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

    const svcMap: Record<string, number> = {}
    for (const b of (recentBookings as any[]) || []) {
      const name = String(b.service_name || '').trim() || '기타'
      svcMap[name] = (svcMap[name] || 0) + 1
    }
    const topServices = Object.entries(svcMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)

    let topProducts: { name: string; quantity: number }[] = []
    if (recentOrderIds.length) {
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

    // ── 웨이브4-B (Track B only — A와 혼입 금지)
    if (ownerProfileId && isTrackB) {
      const tcRows = (tierContractBrands as any[]) || []
      const companyIds = Array.from(new Set(tcRows.map((b) => String(b.company_id || '')).filter(Boolean)))
      if (companyIds.length) {
        const [{ data: companyRows }, { data: pkgRows }, { data: gradeRows }] = await Promise.all([
          supabase.from('brand_companies').select('id, name').in('id', companyIds),
          supabase
            .from('brand_tier_packages')
            .select('id, company_id, tier_name, price, commission_rate, product_scope')
            .in('company_id', companyIds)
            .eq('is_active', true),
          supabase
            .from('brand_owner_grades')
            .select('company_id, grade, payment_status, tier_package_id')
            .eq('owner_id', ownerProfileId)
            .eq('origin_track', 'B')
            .in('company_id', companyIds),
        ])
        const pkgsByCompany: Record<string, any[]> = {}
        for (const p of (pkgRows as any[]) || []) {
          const cid = String(p.company_id)
          if (!pkgsByCompany[cid]) pkgsByCompany[cid] = []
          pkgsByCompany[cid].push(p)
        }
        const gradeByCompany: Record<
          string,
          { grade: string; payment_status: string; tier_package_id: string | null }
        > = {}
        for (const g of (gradeRows as any[]) || []) {
          gradeByCompany[String(g.company_id)] = {
            grade: String(g.grade || ''),
            payment_status: String(g.payment_status || ''),
            tier_package_id: g.tier_package_id ? String(g.tier_package_id) : null,
          }
        }
        for (const c of (companyRows as any[]) || []) {
          const cid = String(c.id)
          const packages = (pkgsByCompany[cid] || [])
            .map((p) => ({
              id: String(p.id),
              tier_name: String(p.tier_name),
              price: Math.trunc(Number(p.price || 0)),
              commission_rate: Number(p.commission_rate ?? 0),
              product_scope: p.product_scope ?? null,
            }))
            .sort((a, b) => a.price - b.price)
          if (!packages.length) continue
          const owned = gradeByCompany[cid]
          const isPaid = owned?.payment_status === 'paid'
          const ownedPkg =
            isPaid && owned?.tier_package_id
              ? packages.find((p) => p.id === owned.tier_package_id) ?? null
              : null
          tierBadgeBrands.push({
            brandId: cid,
            brandName: String(c.name || '회사'),
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

    const BRAND_SELF_API_BY_COMPANY: Record<string, string> = {
      'c1a78c33-4001-4de9-b22d-e94cf815cf33': '/api/payments/brand-self/civasan/create',
    }

    const selfTierBrands: SelfTierBrand[] = []

    // ── 웨이브4-A (Track A only — B와 혼입 금지)
    if (ownerProfileId && isTrackA && linkedBrandIds.length) {
      const companyIds = Array.from(
        new Set(
          ((selfBrandRows as any[]) || [])
            .map((b) => (b.company_id ? String(b.company_id) : ''))
            .filter((cid) => cid && BRAND_SELF_API_BY_COMPANY[cid]),
        ),
      )
      if (companyIds.length) {
        const [{ data: companyRows }, { data: pkgRows }, { data: gradeRows }] = await Promise.all([
          supabase.from('brand_companies').select('id, name, payapp_active').in('id', companyIds),
          supabase
            .from('brand_tier_packages')
            .select('id, company_id, tier_name, price, product_scope')
            .in('company_id', companyIds)
            .eq('is_active', true),
          supabase
            .from('brand_owner_grades')
            .select('company_id, grade, payment_status, tier_package_id')
            .eq('owner_id', ownerProfileId)
            .in('company_id', companyIds),
        ])
        const pkgsByCompany: Record<string, any[]> = {}
        for (const p of (pkgRows as any[]) || []) {
          const cid = String(p.company_id)
          if (!pkgsByCompany[cid]) pkgsByCompany[cid] = []
          pkgsByCompany[cid].push(p)
        }
        const gradeByCompany: Record<
          string,
          { grade: string; payment_status: string; tier_package_id: string | null }
        > = {}
        for (const g of (gradeRows as any[]) || []) {
          gradeByCompany[String(g.company_id)] = {
            grade: String(g.grade || ''),
            payment_status: String(g.payment_status || ''),
            tier_package_id: g.tier_package_id ? String(g.tier_package_id) : null,
          }
        }
        for (const c of (companyRows as any[]) || []) {
          const cid = String(c.id)
          const createApiPath = BRAND_SELF_API_BY_COMPANY[cid]
          if (!createApiPath) continue
          const packages = (pkgsByCompany[cid] || [])
            .map((p) => ({
              id: String(p.id),
              tier_name: String(p.tier_name),
              price: Math.trunc(Number(p.price || 0)),
              product_scope: p.product_scope ?? null,
            }))
            .sort((a, b) => a.price - b.price)
          if (!packages.length) continue
          const owned = gradeByCompany[cid]
          const isPaid = owned?.payment_status === 'paid'
          const ownedPkg =
            isPaid && owned?.tier_package_id
              ? packages.find((p) => p.id === owned.tier_package_id) ?? null
              : null
          selfTierBrands.push({
            brandId: cid,
            brandName: String(c.name || '회사'),
            createApiPath,
            payappActive: Boolean(c.payapp_active),
            packages,
            ownedGrade: isPaid ? owned?.grade || null : null,
            ownedPrice: ownedPkg ? ownedPkg.price : null,
            paymentStatus: owned?.payment_status || null,
          })
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
