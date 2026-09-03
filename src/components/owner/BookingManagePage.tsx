'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useOwnerBookingRealtime } from '@/hooks/useOwnerBookingRealtime'
import { useSalonBookingMessage } from '@/hooks/useSalonBookingMessage'
import { notifySceneConfirmedReward } from '@/lib/orenScene/scenePaymentNotifications'
import ChartsSection from '@/app/dashboard/owner/charts-v2/ChartsSection'
import ChartPopup from '@/app/dashboard/owner/charts-v2/ChartPopup'

const BG = '#ffffff'
const SURFACE = '#f9f8fc'
const PURPLE = '#7B5EA7'
const PURPLE_LIGHT = '#EDE9F7'
const TEXT = '#1A1A2E'
const TEXT_SUB = '#888888'
const BORDER = '#ede9f7'

type TabKey = 'today' | 'upcoming' | 'past' | 'charts'

type BookingRow = {
  id: string
  booking_date?: string | null
  booking_time?: string | null
  service_name?: string | null
  service_price?: number | null
  status?: string | null
  // TEMP 191: 수동추가 응급조치. external_customers 통합 시 정리
  customer_name?: string | null
  customer_id?: string | null
  external_customer_id?: string | null
  notes?: string | null
  purchase_id?: string | null
  displayName?: string
}

function dateKey(d = new Date()) {
  return d.toISOString().slice(0, 10)
}

function shiftDate(key: string, days: number) {
  const d = new Date(`${key}T12:00:00`)
  d.setDate(d.getDate() + days)
  return dateKey(d)
}

function fmtDateKo(key: string) {
  try {
    return new Date(`${key}T12:00:00`).toLocaleDateString('ko-KR', {
      timeZone: 'Asia/Seoul',
      month: 'long',
      day: 'numeric',
      weekday: 'short',
    })
  } catch {
    return key
  }
}

function fmtTime(t?: string | null) {
  return String(t || '').slice(0, 5) || '—'
}

function statusLabel(status?: string | null) {
  const s = String(status || '').toLowerCase()
  if (s === 'pending') return '대기'
  if (s === 'confirmed' || s === '예약확정') return '예약확정'
  if (s === 'completed' || s === '완료') return '완료'
  if (s === 'cancelled' || s === '취소') return '취소'
  if (s === 'rejected' || s === '거절') return '거절'
  return status || '예정'
}

function statusStyle(status?: string | null) {
  const s = String(status || '').toLowerCase()
  if (s === 'completed' || s === '완료') return { bg: PURPLE_LIGHT, color: PURPLE }
  if (s === 'confirmed' || s === '예약확정') return { bg: 'rgba(76,173,126,0.12)', color: '#4cad7e' }
  if (s === 'cancelled' || s === 'rejected' || s === '취소' || s === '거절') return { bg: SURFACE, color: TEXT_SUB }
  return { bg: 'rgba(201,169,110,0.12)', color: '#C9A96E' }
}

function isDone(status?: string | null) {
  const s = String(status || '').toLowerCase()
  return s === 'completed' || s === '완료' || s === 'cancelled' || s === 'rejected' || s === '취소' || s === '거절'
}

export default function BookingManagePage() {
  const router = useRouter()
  const supabaseRef = useRef(createClient())

  const [loading, setLoading] = useState(true)
  const [ownerId, setOwnerId] = useState('')
  const [salonId, setSalonId] = useState('')
  const [tab, setTab] = useState<TabKey>('today')
  const [selectedDate, setSelectedDate] = useState(dateKey())
  const [rows, setRows] = useState<BookingRow[]>([])
  const [msg, setMsg] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [addName, setAddName] = useState('')
  const [addService, setAddService] = useState('')
  const [addPrice, setAddPrice] = useState('')
  const [addDate, setAddDate] = useState(dateKey())
  const [addTime, setAddTime] = useState('10:00')
  const [saving, setSaving] = useState(false)
  const [chartAsk, setChartAsk] = useState<BookingRow | null>(null)
  const [chartOpen, setChartOpen] = useState(false)
  const [chartCustomer, setChartCustomer] = useState<any>(null)
  const [chartInitials, setChartInitials] = useState<{ name?: string; service?: string; price?: string | number; date?: string }>({})

  const showToast = (text: string) => {
    setMsg(text)
    setTimeout(() => setMsg(''), 2200)
  }

  const loadBookings = async (oid: string, currentTab: TabKey, dayKey: string) => {
    if (currentTab === 'charts') return
    const sb = supabaseRef.current
    let q = sb
      .from('bookings')
      // TEMP 191: customer_name 읽기 — 수동추가 응급조치. external_customers 통합 시 정리
      .select('id, booking_date, booking_time, service_name, service_price, status, customer_name, customer_id, external_customer_id, notes, purchase_id')
      .eq('owner_id', oid)

    if (currentTab === 'today') {
      q = q.eq('booking_date', dayKey).order('booking_time', { ascending: true })
    } else if (currentTab === 'upcoming') {
      q = q.gte('booking_date', dateKey()).order('booking_date', { ascending: true }).order('booking_time', { ascending: true }).limit(80)
    } else {
      q = q.lt('booking_date', dateKey()).order('booking_date', { ascending: false }).order('booking_time', { ascending: false }).limit(80)
    }

    const { data } = await q
    const list = (data as BookingRow[]) || []

    const extIds = Array.from(new Set(list.map((b) => b.external_customer_id).filter(Boolean) as string[]))
    const userIds = Array.from(new Set(list.map((b) => b.customer_id).filter(Boolean) as string[]))

    // 웨이브3: 이름맵 병렬 (쿼리 조건·select 동일)
    const [{ data: extRows }, { data: userRows }] = await Promise.all([
      extIds.length
        ? sb.from('external_customers').select('id, name').in('id', extIds)
        : Promise.resolve({ data: null as { id: string; name?: string }[] | null }),
      userIds.length
        ? sb.from('users').select('id, name').in('id', userIds)
        : Promise.resolve({ data: null as { id: string; name?: string }[] | null }),
    ])

    const extMap = new Map<string, string>()
    for (const e of (extRows as { id: string; name?: string }[] | null) || []) {
      extMap.set(e.id, String(e.name || ''))
    }
    const userMap = new Map<string, string>()
    for (const u of (userRows as { id: string; name?: string }[] | null) || []) {
      userMap.set(u.id, String(u.name || ''))
    }

    setRows(
      list.map((b) => ({
        ...b,
        displayName:
          b.customer_name ||
          (b.external_customer_id ? extMap.get(b.external_customer_id) : '') ||
          (b.customer_id ? userMap.get(b.customer_id) : '') ||
          '고객',
      })),
    )
  }

  // 진입 1회: 게이트 유지 + 웨이브2(salons ∥ bookings(+이름맵))
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const sb = supabaseRef.current
      const { data: auth } = await sb.auth.getUser()
      const user = auth.user
      if (!user) {
        router.push('/login?role=owner')
        return
      }
      const { data: me } = await sb.from('users').select('id').eq('auth_id', user.id).maybeSingle()
      if (!me?.id || cancelled) {
        if (!cancelled) setLoading(false)
        return
      }
      const oid = String(me.id)
      setOwnerId(oid)

      const [{ data: salon }] = await Promise.all([
        sb.from('salons').select('id, services').eq('owner_id', oid).maybeSingle(),
        loadBookings(oid, tab, selectedDate),
      ])
      if (cancelled) return
      if (salon?.id) setSalonId(String(salon.id))
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
    // 탭/날짜는 아래 effect에서만 — auth/users/salons 재호출 방지
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  // 탭·날짜 변경: loadBookings만 (마운트 시 ownerId 미설정 → skip, 이중 호출 방지)
  useEffect(() => {
    if (!ownerId) return
    let cancelled = false
    ;(async () => {
      await loadBookings(ownerId, tab, selectedDate)
      if (!cancelled) setLoading(false)
    })()
    return () => {
      cancelled = true
    }
    // ownerId는 게이트용 early-return만 — deps에 넣으면 진입 직후 이중 loadBookings
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, selectedDate])

  useOwnerBookingRealtime(ownerId, () => { if (ownerId) void loadBookings(ownerId, tab, selectedDate) })

  const sendSalonBookingMessage = useSalonBookingMessage()

  const updateStatus = async (id: string, status: string) => {
    if (!ownerId) return
    const { error } = await supabaseRef.current
      .from('bookings')
      .update({ status })
      .eq('id', id)
      .eq('owner_id', ownerId)
    if (error) {
      showToast('변경 실패')
      return
    }

    const bookingForMsg = rows.find((bk) => bk.id === id)

    if (status === 'confirmed' && bookingForMsg && (bookingForMsg.customer_id || bookingForMsg.external_customer_id)) {
      const svcName = bookingForMsg.service_name ?? '관리'
      const scheduledAt = (bookingForMsg as { scheduled_at?: string | null }).scheduled_at
        ?? (bookingForMsg.booking_date ? `${bookingForMsg.booking_date}T${bookingForMsg.booking_time ?? '00:00'}` : null)
      const dateStr = scheduledAt
        ? new Date(scheduledAt).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
        : ''
      await sendSalonBookingMessage(
        ownerId,
        bookingForMsg.customer_id || null,
        bookingForMsg.external_customer_id || null,
        `${dateStr} ${svcName} 예약이 확정됐어요! 🌙`,
      )
    }

    if (status === 'completed' || status === 'cancelled') {
      const booking = rows.find(bk => bk.id === id)
      if (booking?.customer_id) {
        const purBaseQuery = supabaseRef.current
          .from('purchases')
          .select('id, used_sessions, total_sessions, payment_amount, platform_fee, owner_amount')
        const { data: pur } = booking.purchase_id
          ? await purBaseQuery.eq('id', booking.purchase_id).single()
          : await purBaseQuery
              .eq('customer_id', booking.customer_id)
              .eq('salon_id', salonId)
              .order('created_at', { ascending: false })
              .limit(1)
              .single()
        if (pur) {
          if (status === 'completed' && pur.used_sessions < pur.total_sessions) {
            const nextSession = pur.used_sessions + 1
            const totalSessions = pur.total_sessions || 1
            const perAmount = Math.floor((pur.payment_amount || 0) / totalSessions)
            const perFee = Math.floor((pur.platform_fee || 0) / totalSessions)
            const perOwner = Math.floor((pur.owner_amount || 0) / totalSessions)
            const isLastSession = nextSession >= totalSessions
            const amount = isLastSession ? (pur.payment_amount || 0) - perAmount * (totalSessions - 1) : perAmount
            const platformFee = isLastSession ? (pur.platform_fee || 0) - perFee * (totalSessions - 1) : perFee
            const ownerAmount = isLastSession ? (pur.owner_amount || 0) - perOwner * (totalSessions - 1) : perOwner
            await supabaseRef.current
              .from('purchases')
              .update({ used_sessions: nextSession })
              .eq('id', pur.id)
            await supabaseRef.current
              .from('purchase_session_usages')
              .insert({
                purchase_id: pur.id,
                booking_id: id,
                session_number: nextSession,
                amount,
                platform_fee: platformFee,
                owner_amount: ownerAmount,
              })
          } else if (status === 'cancelled' && pur.used_sessions > 0) {
            await supabaseRef.current
              .from('purchases')
              .update({ used_sessions: pur.used_sessions - 1 })
              .eq('id', pur.id)
            await supabaseRef.current
              .from('purchase_session_usages')
              .delete()
              .eq('purchase_id', pur.id)
              .eq('session_number', pur.used_sessions)
              .eq('settlement_status', 'pending')
          }
        }
      }
    }

    if (status === 'completed' || status === 'cancelled') {
      if (bookingForMsg && (bookingForMsg.customer_id || bookingForMsg.external_customer_id)) {
        const svcName = bookingForMsg.service_name ?? '관리'
        const scheduledAt = (bookingForMsg as { scheduled_at?: string | null }).scheduled_at
          ?? (bookingForMsg.booking_date ? `${bookingForMsg.booking_date}T${bookingForMsg.booking_time ?? '00:00'}` : null)
        const dateStr = scheduledAt
          ? new Date(scheduledAt).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
          : ''
        const msg = status === 'completed'
          ? `${svcName} 관리가 완료됐어요 💜\n홈케어 잊지 마세요!`
          : `${dateStr} ${svcName} 예약이 취소됐어요.\n남은 회차는 그대로 유지됩니다.`
        await sendSalonBookingMessage(
          ownerId,
          bookingForMsg.customer_id || null,
          bookingForMsg.external_customer_id || null,
          msg,
        )
      }
    }

    if (status === 'completed') {
      const booking = rows.find(bk => bk.id === id)
      if (booking?.customer_id) {
        const honeyBaseQuery = supabaseRef.current
          .from('purchases')
          .select('id, reviewer_id, honey_amount, source_scene_post_id')
        const { data: purchase } = booking.purchase_id
          ? await honeyBaseQuery.eq('id', booking.purchase_id).single()
          : await honeyBaseQuery
              .eq('customer_id', booking.customer_id)
              .eq('salon_id', salonId)
              .order('created_at', { ascending: false })
              .limit(1)
              .single()
        if (purchase) {
          const { data: salonData } = await supabaseRef.current
            .from('salons')
            .select('services')
            .eq('id', salonId)
            .single()
          const services = salonData?.services ?? []
          const svc = Array.isArray(services)
            ? services.find((s: { name?: string; honey_toast?: number }) => s.name === booking.service_name)
            : null
          const honeyAmt = svc?.honey_toast ?? 1000

          let rewardUserId: string | null = null
          const sourceScenePostId =
            typeof purchase.source_scene_post_id === 'string' && purchase.source_scene_post_id.trim()
              ? purchase.source_scene_post_id.trim()
              : null

          if (sourceScenePostId) {
            const { data: scenePost } = await supabaseRef.current
              .from('oren_scene_posts')
              .select('uploader_user_id')
              .eq('id', sourceScenePostId)
              .maybeSingle()
            rewardUserId = scenePost?.uploader_user_id || null
          } else if (purchase.reviewer_id) {
            rewardUserId = purchase.reviewer_id
          }

          if (rewardUserId) {
            await supabaseRef.current
              .from('honey_logs')
              .insert({
                reviewer_id: rewardUserId,
                buyer_id: booking.customer_id,
                purchase_id: purchase.id,
                salon_id: salonId,
                service_name: booking.service_name,
                amount: honeyAmt,
              })
            if (sourceScenePostId) {
              await supabaseRef.current.rpc('increment_toast', { uid: rewardUserId, amt: honeyAmt })
            } else {
              await supabaseRef.current
                .from('profiles')
                .update({ toast_balance: supabaseRef.current.rpc('increment_toast', { uid: purchase.reviewer_id, amt: honeyAmt }) })
            }
            await supabaseRef.current
              .from('purchases')
              .update({ honey_amount: honeyAmt })
              .eq('id', purchase.id)

            if (sourceScenePostId) {
              await notifySceneConfirmedReward(supabaseRef.current, {
                kind: 'booking',
                sourceScenePostId,
                amount: honeyAmt,
                uploaderUserId: rewardUserId,
              })
            } else {
              const { data: reviewerChannel } = await supabaseRef.current
                .from('chat_channels')
                .select('id')
                .eq('customer_id', purchase.reviewer_id)
                .eq('channel_type', 'salon')
                .eq('owner_id', ownerId)
                .order('created_at', { ascending: false })
                .limit(1)
                .single()
              if (reviewerChannel?.id) {
                await supabaseRef.current
                  .from('salon_messages')
                  .insert({
                    channel_id: reviewerChannel.id,
                    sender_id: ownerId,
                    sender_type: 'owner',
                    body: `꿀 떨어졌어요 🍯 +${honeyAmt}T\n내 리뷰를 보고 누군가 관리권을 구매했어요!\n토스트가 적립됐습니다 💜`,
                    is_from_customer: false,
                    message_kind: 'text',
                  })
              }
            }
          }
        }
      }
    }

    showToast('저장됐어요 💜')
    // 전체 loadBookings 대신 로컬 패치 (탭 날짜 조건에 안 맞으면 제거 — status만 바뀌면 보통 유지)
    setRows((prev) => {
      const patched = prev.map((b) => (b.id === id ? { ...b, status } : b))
      const updated = patched.find((b) => b.id === id)
      if (!updated) return prev
      const bd = String(updated.booking_date || '')
      const today = dateKey()
      let stays = true
      if (tab === 'today') stays = bd === selectedDate
      else if (tab === 'upcoming') stays = bd >= today
      else if (tab === 'past') stays = bd < today
      if (!stays) return prev.filter((b) => b.id !== id)
      return patched
    })
    if (status === 'completed' && bookingForMsg) {
      setChartAsk(bookingForMsg)
    }
  }

  const openChartForBooking = async (b: BookingRow) => {
    if (!ownerId) return
    setChartAsk(null)
    const sb = supabaseRef.current
    let customer: any = null
    if (b.external_customer_id) {
      const { data } = await sb.from('external_customers').select('*').eq('id', b.external_customer_id).maybeSingle()
      customer = data
    }
    const name = String(b.displayName || b.customer_name || '').trim()
    if (!customer && name) {
      const { data: found } = await sb.from('external_customers').select('*').eq('owner_id', ownerId).eq('name', name).limit(1).maybeSingle()
      customer = found
    }
    if (!customer) {
      const { data: created, error } = await sb
        .from('external_customers')
        .insert({
          name: name || '고객',
          owner_id: ownerId,
          auran_joined: false,
          visit_count: 0,
          auran_user_id: b.customer_id || null,
        } as any)
        .select('*')
        .single()
      if (error || !created) {
        showToast('차트 고객을 찾지 못했어요')
        return
      }
      customer = created
    }
    setChartCustomer(customer)
    setChartInitials({
      name: name || customer.name || '',
      service: b.service_name || '',
      price: b.service_price ?? '',
      date: b.booking_date || '',
    })
    setChartOpen(true)
  }

  const addBooking = async () => {
    if (!ownerId || !salonId) {
      showToast('샵 정보를 먼저 등록해주세요')
      return
    }
    if (!addName.trim() || !addService.trim() || !addDate || !addTime) {
      showToast('고객명·시술·날짜·시간을 입력해주세요')
      return
    }
    setSaving(true)
    // TEMP 191: customer_name 쓰기 — 수동추가 응급조치. external_customers 통합 시 정리
    const { error } = await supabaseRef.current.from('bookings').insert({
      owner_id: ownerId,
      salon_id: salonId,
      customer_name: addName.trim(),
      service_name: addService.trim(),
      service_price: Number(addPrice.replace(/[^\d]/g, '')) || 0,
      booking_date: addDate,
      booking_time: addTime,
      status: 'confirmed',
    })
    setSaving(false)
    if (error) {
      showToast('예약 추가 실패')
      return
    }
    setShowAdd(false)
    setAddName('')
    setAddService('')
    setAddPrice('')
    showToast('예약이 추가됐어요 💜')
    setTab('today')
    setSelectedDate(addDate)
    await loadBookings(ownerId, 'today', addDate)
  }

  const tabLabel = useMemo(() => {
    if (tab === 'today') return fmtDateKo(selectedDate)
    if (tab === 'upcoming') return '다가오는 예약'
    if (tab === 'charts') return '시술차트'
    return '지난 예약'
  }, [tab, selectedDate])

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'today', label: '오늘' },
    { key: 'upcoming', label: '예정' },
    { key: 'past', label: '지난' },
    { key: 'charts', label: '시술차트' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: BG, color: TEXT, paddingBottom: 88 }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', borderBottom: `0.5px solid ${BORDER}` }}>
        <button type="button" onClick={() => router.push('/dashboard/owner')} style={{ border: 'none', background: 'transparent', fontSize: 14, color: PURPLE, cursor: 'pointer' }}>
          ←
        </button>
        <div style={{ flex: 1, textAlign: 'center', fontSize: 16, fontWeight: 500 }}>예약 관리</div>
        <button type="button" onClick={() => setShowAdd(true)} style={{ border: 'none', background: PURPLE, color: '#fff', borderRadius: 8, padding: '6px 12px', fontSize: 13, cursor: 'pointer' }}>
          + 추가
        </button>
      </div>

      <div style={{ display: 'flex', margin: '0 16px', borderBottom: `1px solid ${BORDER}` }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            style={{
              flex: 1,
              padding: '12px 0',
              border: 'none',
              background: 'transparent',
              color: tab === t.key ? PURPLE : TEXT_SUB,
              fontSize: 13,
              cursor: 'pointer',
              borderBottom: tab === t.key ? `2px solid ${PURPLE}` : '2px solid transparent',
              marginBottom: -1,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'charts' ? (
        <ChartsSection />
      ) : (
      <div style={{ padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          {tab === 'today' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button type="button" onClick={() => setSelectedDate((d) => shiftDate(d, -1))} style={{ border: `1px solid ${BORDER}`, background: BG, borderRadius: 8, width: 32, height: 32, cursor: 'pointer' }}>‹</button>
              <span style={{ fontSize: 14, fontWeight: 500 }}>{tabLabel}</span>
              <button type="button" onClick={() => setSelectedDate((d) => shiftDate(d, 1))} style={{ border: `1px solid ${BORDER}`, background: BG, borderRadius: 8, width: 32, height: 32, cursor: 'pointer' }}>›</button>
            </div>
          ) : (
            <span style={{ fontSize: 14, fontWeight: 500 }}>{tabLabel}</span>
          )}
          <span style={{ fontSize: 12, color: TEXT_SUB }}>{rows.length}건</span>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 48, color: TEXT_SUB, fontSize: 13 }}>불러오는 중…</div>
        ) : rows.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 16px', color: TEXT_SUB, fontSize: 13, lineHeight: 1.7 }}>
            {tab === 'today' ? '이 날짜에 예약이 없어요 💜' : tab === 'upcoming' ? '다가오는 예약이 없어요' : '지난 예약 내역이 없어요'}
            <br />
            <button type="button" onClick={() => setShowAdd(true)} style={{ marginTop: 12, border: 'none', background: 'transparent', color: PURPLE, fontSize: 13, cursor: 'pointer' }}>
              + 예약 추가하기
            </button>
          </div>
        ) : (
          rows.map((b) => {
            const badge = statusStyle(b.status)
            const done = isDone(b.status)
            return (
              <div
                key={b.id}
                style={{
                  background: BG,
                  border: `0.5px solid ${BORDER}`,
                  borderRadius: 12,
                  padding: 14,
                  marginBottom: 10,
                  opacity: done ? 0.72 : 1,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ fontSize: 13, color: TEXT_SUB, minWidth: 44, paddingTop: 2 }}>{fmtTime(b.booking_time)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 15, fontWeight: 500 }}>{b.displayName}</span>
                      <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 20, background: badge.bg, color: badge.color }}>
                        {statusLabel(b.status)}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, color: TEXT_SUB, marginTop: 4 }}>{b.service_name || '시술'}</div>
                    {b.service_price ? (
                      <div style={{ fontSize: 12, color: PURPLE, marginTop: 2 }}>₩{Number(b.service_price).toLocaleString()}</div>
                    ) : null}
                    {tab !== 'today' && b.booking_date ? (
                      <div style={{ fontSize: 11, color: TEXT_SUB, marginTop: 4 }}>{fmtDateKo(b.booking_date)}</div>
                    ) : null}
                    {b.notes ? <div style={{ fontSize: 11, color: TEXT_SUB, marginTop: 6, lineHeight: 1.5 }}>{b.notes}</div> : null}
                  </div>
                </div>
                {!done ? (
                  <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                    {String(b.status || '').toLowerCase() === 'pending' ? (
                      <>
                        <button type="button" onClick={() => void updateStatus(b.id, 'confirmed')} style={{ flex: 1, minWidth: 72, padding: '8px 0', borderRadius: 8, border: `1px solid ${PURPLE}`, background: PURPLE_LIGHT, color: PURPLE, fontSize: 12, cursor: 'pointer' }}>
                          확정
                        </button>
                        <button type="button" onClick={() => void updateStatus(b.id, 'rejected')} style={{ flex: 1, minWidth: 72, padding: '8px 0', borderRadius: 8, border: `1px solid ${BORDER}`, background: BG, color: TEXT_SUB, fontSize: 12, cursor: 'pointer' }}>
                          거절
                        </button>
                      </>
                    ) : (
                      <>
                        <button type="button" onClick={() => void updateStatus(b.id, 'completed')} style={{ flex: 1, minWidth: 72, padding: '8px 0', borderRadius: 8, border: `1px solid ${PURPLE}`, background: PURPLE, color: '#fff', fontSize: 12, cursor: 'pointer' }}>
                          완료
                        </button>
                        <button type="button" onClick={() => void updateStatus(b.id, 'cancelled')} style={{ flex: 1, minWidth: 72, padding: '8px 0', borderRadius: 8, border: `1px solid ${BORDER}`, background: BG, color: TEXT_SUB, fontSize: 12, cursor: 'pointer' }}>
                          취소
                        </button>
                      </>
                    )}
                    <button type="button" onClick={() => router.push('/dashboard/owner/charts-v2')} style={{ padding: '8px 12px', borderRadius: 8, border: `1px solid ${BORDER}`, background: BG, color: PURPLE, fontSize: 12, cursor: 'pointer' }}>
                      차트
                    </button>
                  </div>
                ) : null}
              </div>
            )
          })
        )}
      </div>
      )}

      {showAdd ? (
        <>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100 }} onClick={() => setShowAdd(false)} />
          <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, maxWidth: 430, margin: '0 auto', background: BG, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, zIndex: 101 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: 15, fontWeight: 500 }}>예약 추가</div>
              <button type="button" onClick={() => setShowAdd(false)} style={{ border: 'none', background: 'transparent', fontSize: 18, color: TEXT_SUB, cursor: 'pointer' }}>×</button>
            </div>
            <input value={addName} onChange={(e) => setAddName(e.target.value)} placeholder="고객명 (예: 김민지)" style={{ width: '100%', padding: 12, borderRadius: 8, border: `1px solid ${BORDER}`, marginBottom: 8, boxSizing: 'border-box', fontSize: 14 }} />
            <input value={addService} onChange={(e) => setAddService(e.target.value)} placeholder="시술명 (예: 수분집중케어)" style={{ width: '100%', padding: 12, borderRadius: 8, border: `1px solid ${BORDER}`, marginBottom: 8, boxSizing: 'border-box', fontSize: 14 }} />
            <input value={addPrice} onChange={(e) => setAddPrice(e.target.value.replace(/[^\d]/g, ''))} placeholder="가격 (예: 90000)" style={{ width: '100%', padding: 12, borderRadius: 8, border: `1px solid ${BORDER}`, marginBottom: 8, boxSizing: 'border-box', fontSize: 14 }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
              <input type="date" value={addDate} onChange={(e) => setAddDate(e.target.value)} style={{ padding: 12, borderRadius: 8, border: `1px solid ${BORDER}`, fontSize: 14, boxSizing: 'border-box' }} />
              <input type="time" value={addTime} onChange={(e) => setAddTime(e.target.value)} style={{ padding: 12, borderRadius: 8, border: `1px solid ${BORDER}`, fontSize: 14, boxSizing: 'border-box' }} />
            </div>
            <button type="button" disabled={saving} onClick={() => void addBooking()} style={{ width: '100%', padding: 14, borderRadius: 10, border: 'none', background: PURPLE, color: '#fff', fontSize: 14, cursor: saving ? 'default' : 'pointer' }}>
              {saving ? '저장 중…' : '예약 저장 💜'}
            </button>
          </div>
        </>
      ) : null}

      {chartAsk ? (
        <div style={{ position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: 24, background: PURPLE, color: '#fff', borderRadius: 12, padding: '12px 16px', fontSize: 13, zIndex: 120, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' as const, maxWidth: '90%' }}>
          <span>차트를 바로 작성하시겠어요?</span>
          <button type="button" onClick={() => void openChartForBooking(chartAsk)} style={{ border: 'none', background: '#fff', color: PURPLE, borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}>
            예
          </button>
          <button type="button" onClick={() => setChartAsk(null)} style={{ border: '1px solid rgba(255,255,255,0.5)', background: 'transparent', color: '#fff', borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}>
            아니요
          </button>
        </div>
      ) : msg ? (
        <div style={{ position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: 24, background: PURPLE, color: '#fff', borderRadius: 12, padding: '10px 16px', fontSize: 13, zIndex: 110 }}>
          {msg}
        </div>
      ) : null}

      {ownerId && chartCustomer ? (
        <ChartPopup
          open={chartOpen}
          onClose={() => { setChartOpen(false); setChartCustomer(null) }}
          onSaved={() => { setChartOpen(false); setChartCustomer(null) }}
          customer={chartCustomer}
          ownerId={ownerId}
          initialCustomerName={chartInitials.name}
          initialServiceName={chartInitials.service}
          initialPrice={chartInitials.price}
          initialDate={chartInitials.date}
        />
      ) : null}
    </div>
  )
}
