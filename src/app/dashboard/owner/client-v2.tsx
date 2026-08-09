'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useIsTrackA } from '@/hooks/useIsTrackA'
import { getOwnerLinkedBrandIds } from '@/lib/brand/getOwnerLinkedBrandIds'
import SalonChatListPopup from './salon-chat/SalonChatListPopup'
import NewChatPopup from './salon-chat/NewChatPopup'
import OwnerV2LowerStack from './OwnerV2LowerStack'
import {
  canShowCyclePhase,
  getPhase,
  initials,
  parseMemo,
  parseTreatmentName,
  type BookingRow,
  type ExtCustomer,
  type PhaseInfo,
} from './client-v2-helpers'

const BG = '#ffffff'
const SURFACE = '#f9f8fc'
const PURPLE = '#7B5EA7'
const PURPLE_LIGHT = '#EEEDFE'
const GOLD = '#C9A96E'
const TEXT = '#1A1A2E'
const TEXT_SUB = '#888888'
const BORDER = '#ede9f7'

export default function OwnerDashClientV2() {
  const router = useRouter()
  const supabaseRef = useRef(createClient())
  const { isTrackA, ready } = useIsTrackA()

  const [loading, setLoading] = useState(true)
  const [ownerName, setOwnerName] = useState('원장님')
  const [ownerSlug, setOwnerSlug] = useState<string | null>(null)
  const [ownerAvatar, setOwnerAvatar] = useState<string | null>(null)
  const [ownerId, setOwnerId] = useState('')
  const [originTrack, setOriginTrack] = useState<string | null>(null)
  const [todayBookings, setTodayBookings] = useState<(BookingRow & { displayName: string; phase: PhaseInfo | null })[]>([])
  const [todayChartCount, setTodayChartCount] = useState(0)
  const [extCount, setExtCount] = useState(0)
  const [unreadChat, setUnreadChat] = useState(0)
  const [goldenCount, setGoldenCount] = useState(0)
  const [moonCount, setMoonCount] = useState(0)
  const [monthRevenue, setMonthRevenue] = useState(0)
  const [monthGoal, setMonthGoal] = useState(5000000)
  const [revisitRate, setRevisitRate] = useState(0)
  const [trendItems, setTrendItems] = useState<{ name: string; count: number }[]>([])
  const [tradeBrands, setTradeBrands] = useState<string[]>([])
  const [brandProducts, setBrandProducts] = useState<Array<{ id: string; name: string; thumb_img: string | null; brand_name: string }>>([])
  const [hormoneAlerts, setHormoneAlerts] = useState<{ name: string; days: number }[]>([])
  const [churnAlerts, setChurnAlerts] = useState<ExtCustomer[]>([])
  const [brandMessages, setBrandMessages] = useState<any[]>([])
  const [partnerCount, setPartnerCount] = useState(0)
  const [activeTab, setActiveTab] = useState('home')
  const [showChatList, setShowChatList] = useState(false)
  const [showNewChat, setShowNewChat] = useState(false)
  const [chatChannelId, setChatChannelId] = useState<string | null>(null)
  const [salonId, setSalonId] = useState<string>('')
  const [staffCount, setStaffCount] = useState<number>(1)
  const [roomCount, setRoomCount] = useState<number>(1)
  const [capacityToast, setCapacityToast] = useState('')

  const nowLine = useMemo(() => {
    const d = new Date()
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }, [])

  useEffect(() => {
    if (!capacityToast) return
    const t = setTimeout(() => setCapacityToast(''), 2000)
    return () => clearTimeout(t)
  }, [capacityToast])

  useEffect(() => {
    const run = async () => {
      const sb = supabaseRef.current
      const { data: auth } = await sb.auth.getUser()
      const user = auth.user
      if (!user) {
        router.push('/login?role=owner')
        return
      }

      const { data: me } = await sb.from('users').select('id,auth_id,name,role,origin_track').eq('auth_id', user.id).maybeSingle()
      if (!me?.id) return
      setOwnerId(String(me.id))
      setOriginTrack((me as { origin_track?: string | null }).origin_track ?? null)
      const { data: profileRow } = await sb
        .from('profiles')
        .select('id, slug, avatar_url')
        .eq('auth_id', user.id)
        .maybeSingle()
      const myProfileId = profileRow?.id ? String(profileRow.id) : ''
      if (profileRow?.slug) setOwnerSlug(String(profileRow.slug))
      if (profileRow?.avatar_url) setOwnerAvatar(String(profileRow.avatar_url))
      setOwnerName(String(me.name || '원장님'))

      const { data: salonRow } = await sb.from('salons').select('id,staff_count,room_count').eq('owner_id', me.id).maybeSingle()
      if (salonRow?.id) {
        setSalonId(String(salonRow.id))
        setStaffCount(Number(salonRow.staff_count ?? 1))
        setRoomCount(Number(salonRow.room_count ?? 1))
      }

      const todayKey = new Date().toISOString().slice(0, 10)
      const monthKey = todayKey.slice(0, 7)

      const [
        { data: bookings },
        { data: charts },
        { count: extTotal },
        { data: channels },
        { data: externals },
        { data: monthBookings },
        { data: monthCharts },
        { data: goalRow },
      ] = await Promise.all([
        sb.from('bookings').select('*').eq('owner_id', me.id).eq('booking_date', todayKey).order('booking_time'),
        sb.from('treatment_charts').select('id,treatment_date,treatment_items,admin_memo,external_customer_id').eq('owner_id', me.id).gte('treatment_date', `${todayKey}T00:00:00`).lte('treatment_date', `${todayKey}T23:59:59`),
        sb.from('external_customers').select('id', { count: 'exact', head: true }).eq('owner_id', me.id),
        sb.from('chat_channels').select('unread_count').eq('channel_type', 'owner').eq('owner_id', me.id),
        sb.from('external_customers').select('id,name,memo,auran_user_id,last_purchase_at,visit_count,auran_joined').eq('owner_id', me.id),
        sb.from('bookings').select('service_price,booking_date').eq('owner_id', me.id).gte('booking_date', `${monthKey}-01`).lte('booking_date', `${todayKey}`),
        sb.from('treatment_charts').select('treatment_items,admin_memo,treatment_date').eq('owner_id', me.id).gte('treatment_date', `${monthKey}-01T00:00:00`),
        sb.from('admin_settings').select('value').eq('key', 'owner_monthly_revenue_goal').maybeSingle(),
      ])

      setTodayChartCount(((charts as any[]) || []).length)
      setExtCount(extTotal || 0)
      setUnreadChat(((channels as any[]) || []).reduce((s, c) => s + Number(c.unread_count || 0), 0))

      const brandIds = await getOwnerLinkedBrandIds(sb, user.id)
      if (brandIds.length > 0) {
        const { data: brandRows } = await sb
          .from('brands')
          .select('id, name')
          .in('id', brandIds)
        setTradeBrands((brandRows || []).map((b: { name?: string }) => String(b.name || '')).filter(Boolean))

        const { data: prodRows } = await sb
          .from('products')
          .select('id, name, thumb_img, brands(name)')
          .in('brand_id', brandIds)
          .eq('status', 'active')
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(10)
        if (prodRows) {
          setBrandProducts(prodRows.map((p: any) => ({
            id: p.id,
            name: p.name || '',
            thumb_img: p.thumb_img || null,
            brand_name: p.brands?.name || '',
          })))
        }

        let bmQuery = sb
          .from('brand_messages')
          .select('id, title, body, message_type, created_at, brand_id, target_owner_id, brands(name)')
          .in('brand_id', brandIds)
          .order('created_at', { ascending: false })
          .limit(10)
        if (myProfileId) {
          bmQuery = bmQuery.or(`target_owner_id.is.null,target_owner_id.eq.${myProfileId}`)
        }
        const { data: bmData } = await bmQuery
        setBrandMessages((bmData || []) as any[])
      } else {
        setTradeBrands([])
        setBrandProducts([])
        setBrandMessages([])
      }

      const goalVal = Number((goalRow as any)?.value)
      setMonthGoal(!Number.isNaN(goalVal) && goalVal > 0 ? goalVal : 5000000)

      const extList = (externals as ExtCustomer[]) || []
      const extMap = new Map(extList.map((e) => [e.id, e]))

      let bookingRevenue = 0
      for (const b of (monthBookings as any[]) || []) bookingRevenue += Number(b.service_price || 0)
      let chartRevenue = 0
      for (const c of (monthCharts as any[]) || []) {
        const m = String(c.admin_memo || '').match(/시술금액:\s*₩?([\d,]+)/)
        if (m) chartRevenue += Number(m[1].replace(/,/g, ''))
      }
      setMonthRevenue(bookingRevenue + chartRevenue)

      const revisit = extList.filter((e) => Number(e.visit_count || 0) >= 2).length
      setRevisitRate(extList.length ? Math.round((revisit / extList.length) * 100) : 0)
      setPartnerCount(extList.filter((e) => e.auran_joined).length)

      const phaseCache: Record<string, PhaseInfo | null> = {}
      const getCustomerPhase = async (ext: ExtCustomer | undefined): Promise<PhaseInfo | null> => {
        if (!ext) return null
        if (phaseCache[ext.id]) return phaseCache[ext.id]
        let last: string | null = null
        let track: string | null = null
        let gender: string | null = null
        if (ext.auran_user_id) {
          const { data: hcRows } = await sb.from('hormone_cycle').select('last_period_date, track').eq('user_id', ext.auran_user_id).order('created_at', { ascending: false }).limit(1)
          const hcRow = ((hcRows as any[]) || [])[0]
          last = hcRow?.last_period_date ?? null
          track = hcRow?.track != null ? String(hcRow.track) : null
          const { data: uRow } = await sb.from('users').select('auth_id').eq('id', ext.auran_user_id).maybeSingle()
          if (uRow?.auth_id) {
            const { data: prof } = await sb.from('profiles').select('gender').eq('auth_id', uRow.auth_id).maybeSingle()
            gender = prof?.gender != null ? String(prof.gender) : null
          }
        }
        if (!last) {
          const m = parseMemo(ext.memo)
          if (m.birth_date && m.menstruation === '있음') last = String(m.birth_date)
        }
        const p = canShowCyclePhase(track, gender) ? getPhase(last) : null
        phaseCache[ext.id] = p
        return p
      }

      const enriched: (BookingRow & { displayName: string; phase: PhaseInfo | null })[] = []
      let gCount = 0
      let mCount = 0
      for (const b of (bookings as BookingRow[]) || []) {
        const ext = b.external_customer_id ? extMap.get(b.external_customer_id) : undefined
        const displayName = ext?.name || b.customer_name || '고객'
        const phase = await getCustomerPhase(ext)
        if (phase?.label === '황금기') gCount++
        if (phase?.label === '달빛기') mCount++
        enriched.push({ ...b, displayName, phase })
      }
      setTodayBookings(enriched)
      setGoldenCount(gCount)
      setMoonCount(mCount)

      const trendMap: Record<string, number> = {}
      for (const c of (monthCharts as any[]) || []) {
        const name = parseTreatmentName(c.treatment_items) || '기타'
        trendMap[name] = (trendMap[name] || 0) + 1
      }
      setTrendItems(Object.entries(trendMap).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count })))

      const alerts: { name: string; days: number }[] = []
      for (const ext of extList) {
        let last: string | null = null
        let track: string | null = null
        let gender: string | null = null
        if (ext.auran_user_id) {
          const { data: hcRows } = await sb.from('hormone_cycle').select('last_period_date, track').eq('user_id', ext.auran_user_id).order('created_at', { ascending: false }).limit(1)
          const hcRow = ((hcRows as any[]) || [])[0]
          last = hcRow?.last_period_date ?? null
          track = hcRow?.track != null ? String(hcRow.track) : null
          const { data: uRow } = await sb.from('users').select('auth_id').eq('id', ext.auran_user_id).maybeSingle()
          if (uRow?.auth_id) {
            const { data: prof } = await sb.from('profiles').select('gender').eq('auth_id', uRow.auth_id).maybeSingle()
            gender = prof?.gender != null ? String(prof.gender) : null
          }
        }
        if (!last || !canShowCyclePhase(track, gender)) continue
        for (const daysAhead of [1, 3]) {
          const target = new Date()
          target.setDate(target.getDate() + daysAhead)
          const diff = Math.floor((target.getTime() - new Date(last).getTime()) / 86400000)
          const day = ((diff % 28) + 28) % 28
          if (day >= 5 && day < 13) alerts.push({ name: ext.name, days: daysAhead })
        }
      }
      setHormoneAlerts(alerts.slice(0, 5))

      const cutoff = Date.now() - 60 * 86400000
      setChurnAlerts(extList.filter((e) => e.last_purchase_at && new Date(e.last_purchase_at).getTime() < cutoff).slice(0, 5))

      setLoading(false)
    }
    void run()
  }, [router])

  const summaryLine =
    todayBookings.length > 0
      ? `오늘 예약 ${todayBookings.length}명 · 황금기 고객 ${goldenCount}명`
      : '오늘 예약이 없어요. 여유로운 하루예요 💜'

  const tipLine =
    goldenCount > 0
      ? `오늘 황금기 고객 ${goldenCount}명 — MTS · 스피큘 · 필링 최적기예요`
      : moonCount > 0
        ? `오늘 달빛기 고객 ${moonCount}명 — 자극 최소화, 수분케어 추천해요`
        : todayBookings.length === 0
          ? '오늘은 여유롭게 고객 차트를 정리해보는 건 어떨까요? 💜'
          : '오늘도 고객님과 좋은 시간 보내세요 💜'

  const goalPct = monthGoal > 0 ? Math.min(100, Math.round((monthRevenue / monthGoal) * 100)) : 0
  const goalDone = monthRevenue >= monthGoal

  const updateSalonCapacity = async (field: 'staff_count' | 'room_count', value: number) => {
    if (!salonId) return
    await supabaseRef.current.from('salons').update({ [field]: value }).eq('id', salonId)
    if (field === 'staff_count') setStaffCount(value)
    else setRoomCount(value)
    setCapacityToast('저장됐어요 💜')
  }

  const card: React.CSSProperties = { background: BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 14 }
  const sectionLabel: React.CSSProperties = { fontSize: 13, fontWeight: 500, color: TEXT, marginBottom: 10, marginTop: 16 }

  const tabs = [
    { key: 'home', label: '홈', href: '/dashboard/owner?v=2' },
    { key: 'book', label: '예약', href: '/dashboard/owner/bookings' },
    { key: 'chart', label: '차트', href: '/dashboard/owner/charts-v2' },
    { key: 'cust', label: '고객', href: '/dashboard/owner/charts-v2' },
    { key: 'more', label: '더보기', href: '/dashboard/owner/store-decoration' },
  ]

  const quickMenusAll = [
    { icon: '📋', label: '관리 프로그램', sub: '등록 · 수정 · 관리', href: '/dashboard/owner/services' },
    { icon: '📋', label: '시술차트', sub: `오늘 ${todayChartCount}건 작성`, href: '/dashboard/owner/charts-v2' },
    { icon: '📅', label: '예약 관리', sub: `오늘 ${todayBookings.length}건`, href: '/dashboard/owner/bookings' },
    { icon: '👥', label: '고객 관리', sub: `${extCount}명`, href: '/dashboard/owner/charts-v2' },
    { icon: '⭐', label: '리뷰함', href: '/dashboard/owner/reviews' },
    { icon: '📦', label: '브랜드 발주', sub: tradeBrands.length ? `${tradeBrands[0]} 외 ${Math.max(0, tradeBrands.length - 1)}개` : '브랜드사를 설정해보세요', href: '/dashboard/owner/brand-orders' },
    ...(originTrack === 'B'
      ? [{ icon: '📦', label: '재고 발주', sub: '본사 재고 · 즉시 결제', href: '/dashboard/owner/hq-stock-orders' }]
      : []),
    { icon: '💬', label: '브랜드 소식', href: '/dashboard/owner/brand-community' },
    { icon: '🎁', label: '브랜드 샘플', href: '/dashboard/owner/brand-samples' },
    { icon: '🎓', label: '브랜드 라이브', href: '/dashboard/owner/brand-live' },
    { icon: '↩️', label: '반품 신청', href: '/dashboard/owner/brand-returns' },
    { icon: '🤝', label: '파트너스', sub: `유입 ${partnerCount}명`, href: '/dashboard/partner' },
    { icon: '💬', label: '샵 상담톡', sub: '고객 1:1 상담', onClick: () => setShowChatList(true) },
  ]

  const quickMenus = quickMenusAll.filter(
    (m) => m.href !== '/dashboard/owner/brand-orders' || (ready && isTrackA),
  )

  if (loading) {
    return <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center', color: TEXT_SUB, fontSize: 14 }}>불러오는 중…</div>
  }

  return (
    <div style={{ minHeight: '100vh', background: SURFACE, color: TEXT, paddingBottom: 88 }}>
      <div style={{ background: BG, padding: 16, borderBottom: `1px solid ${BORDER}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            onClick={() => { if (ownerSlug) router.push(`/owner/${ownerSlug}`) }}
            style={{
              width: 52, height: 52, borderRadius: '50%', flexShrink: 0, cursor: ownerSlug ? 'pointer' : 'default',
              background: ownerAvatar ? `url(${ownerAvatar}) center/cover` : PURPLE_LIGHT,
              border: `1.5px solid ${PURPLE}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, overflow: 'hidden',
            }}
          >
            {!ownerAvatar && '🌸'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, color: TEXT_SUB }}>안녕하세요</div>
            <div style={{ fontSize: 17, fontWeight: 500, marginTop: 4 }}>{ownerName}님 💜</div>
            <div style={{ fontSize: 12, color: PURPLE, marginTop: 8 }}>{summaryLine}</div>
          </div>
        </div>
      </div>

      <div style={{ padding: 16 }}>
        <button
          type="button"
          onClick={() => router.push('/dashboard/owner/chat/redirect')}
          style={{ width: '100%', background: PURPLE, color: '#fff', border: 'none', borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', position: 'relative' }}
        >
          <span style={{ fontSize: 20 }}>💬</span>
          <span style={{ fontSize: 15, fontWeight: 500 }}>상담톡</span>
          {unreadChat > 0 ? (
            <span style={{ marginLeft: 'auto', background: '#fff', color: PURPLE, fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 20 }}>
              {unreadChat}
            </span>
          ) : null}
        </button>

        <div style={{ marginTop: 12, background: PURPLE_LIGHT, borderRadius: 12, padding: 14, fontSize: 13, lineHeight: 1.6, color: TEXT }}>
          {tipLine}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 16 }}>
          {[
            ['이번 달 매출', `₩${monthRevenue.toLocaleString()}`],
            ['재방문율', `${revisitRate}%`],
            ['오늘 예약', `${todayBookings.length}건`],
            ['담당 고객', `${extCount}명`],
          ].map(([l, v]) => (
            <div key={String(l)} style={{ ...card, background: BG }}>
              <div style={{ fontSize: 11, color: TEXT_SUB }}>{l}</div>
              <div style={{ fontSize: 18, fontWeight: 500, color: PURPLE, marginTop: 6 }}>{v}</div>
            </div>
          ))}
        </div>

        <div style={sectionLabel}>오늘 예약 타임라인</div>
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, fontSize: 12, color: TEXT_SUB }}>
            <span>{new Date().toLocaleDateString('ko-KR')}</span>
            <span>총 {todayBookings.length}건</span>
          </div>
          {todayBookings.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 32, color: TEXT_SUB, fontSize: 13, lineHeight: 1.7 }}>
              오늘 예약이 없어요
              <br />
              예약을 추가해볼까요? 💜
              <br />
              <button type="button" onClick={() => router.push('/dashboard/owner/bookings')} style={{ marginTop: 12, border: 'none', background: 'transparent', color: PURPLE, fontSize: 13, cursor: 'pointer' }}>
                + 예약 추가하기
              </button>
            </div>
          ) : (
            todayBookings.map((b, idx) => {
              const done = b.status === '완료' || b.status === '예약확정'
              const showNow = b.booking_time && b.booking_time.slice(0, 5) <= nowLine && (idx === todayBookings.length - 1 || (todayBookings[idx + 1]?.booking_time || '') > nowLine)
              return (
                <div key={b.id}>
                  {showNow ? <div style={{ fontSize: 11, color: PURPLE, textAlign: 'center', margin: '8px 0' }}>— 지금 —</div> : null}
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 0', borderTop: idx ? `1px solid ${BORDER}` : 'none', opacity: done ? 0.55 : 1 }}>
                    <div style={{ fontSize: 12, color: TEXT_SUB, minWidth: 44 }}>{String(b.booking_time || '').slice(0, 5)}</div>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: PURPLE_LIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: PURPLE, fontWeight: 500 }}>
                      {initials(b.displayName)}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 14, fontWeight: 500 }}>{b.displayName}</span>
                        {b.phase ? (
                          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: PURPLE_LIGHT, color: PURPLE }}>
                            {b.phase.emoji} {b.phase.label}
                          </span>
                        ) : null}
                      </div>
                      <div style={{ fontSize: 12, color: TEXT_SUB, marginTop: 2 }}>{b.service_name || '시술'}</div>
                    </div>
                    <span style={{ fontSize: 10, padding: '4px 8px', borderRadius: 20, background: SURFACE, color: TEXT_SUB }}>{b.status || '예정'}</span>
                    <button type="button" onClick={() => router.push('/dashboard/owner/charts-v2')} style={{ border: `1px solid ${BORDER}`, background: BG, borderRadius: 20, padding: '6px 10px', fontSize: 11, color: PURPLE, cursor: 'pointer', minHeight: 44 }}>
                      차트 작성
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>

        <OwnerV2LowerStack
          card={card}
          sectionLabel={sectionLabel}
          staffCount={staffCount}
          roomCount={roomCount}
          onCapacity={(field, value) => void updateSalonCapacity(field, value)}
          hormoneAlerts={hormoneAlerts}
          churnAlerts={churnAlerts}
          tradeBrands={tradeBrands}
          brandMessages={brandMessages}
          brandProducts={brandProducts}
          ready={ready}
          isTrackA={!!isTrackA}
          monthRevenue={monthRevenue}
          monthGoal={monthGoal}
          goalPct={goalPct}
          goalDone={goalDone}
          trendItems={trendItems}
          quickMenus={quickMenus}
        />
      </div>

      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: BG, borderTop: `0.5px solid ${BORDER}`, display: 'flex', zIndex: 50 }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => {
              setActiveTab(t.key)
              router.push(t.href)
            }}
            style={{ flex: 1, border: 'none', background: 'transparent', padding: '10px 4px', fontSize: 11, color: activeTab === t.key ? PURPLE : TEXT_SUB, cursor: 'pointer' }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <SalonChatListPopup
        open={showChatList}
        onClose={() => setShowChatList(false)}
        ownerId={ownerId}
        onOpenChat={(channelId) => {
          setChatChannelId(channelId)
          router.push('/dashboard/owner/salon-chat/' + channelId)
        }}
        onNewChat={() => {
          setShowChatList(false)
          setShowNewChat(true)
        }}
      />
      <NewChatPopup
        open={showNewChat}
        onClose={() => setShowNewChat(false)}
        ownerId={ownerId}
        onCreated={(channelId) => {
          setShowNewChat(false)
          setChatChannelId(channelId)
          router.push('/dashboard/owner/salon-chat/' + channelId)
        }}
      />

      {capacityToast ? (
        <div style={{ position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: 100, background: PURPLE, color: '#fff', borderRadius: 12, padding: '10px 16px', fontSize: 13, zIndex: 50 }}>
          {capacityToast}
        </div>
      ) : null}
    </div>
  )
}
