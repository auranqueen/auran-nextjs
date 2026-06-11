'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const BG = '#0D0B09'
const CARD_BG = '#181520'
const BORDER = 'rgba(255,255,255,0.07)'
const P = '#7B5EA7'
const GOLD = '#C9A96E'
const TEXT_MAIN = 'rgba(255,255,255,0.9)'
const TEXT_SUB = 'rgba(255,255,255,0.45)'

type MainTab = 'bookings' | 'coupons' | 'care'
type CouponSubTab = 'usable' | 'used'

type BookingRow = {
  id: string
  service_name: string
  booking_date: string
  booking_time: string
  status: string
  salon_id: string | null
  salons: { name: string | null } | { name: string | null }[] | null
}

type CouponRow = {
  id: string
  status: string
  issued_at: string | null
  used_at: string | null
  expired_at: string | null
  coupons: {
    name: string | null
    discount_type: string | null
    discount_value: number | null
    description: string | null
    type?: string | null
    discount_amount?: number | null
    discount_rate?: number | null
  } | null
}

type CareCardRow = {
  id: string
  title: string
  care: string
  quote: string
  phase_tags: string[] | null
  category_tags: string[] | null
  created_at: string
}

function fmtDateTimeKo(iso: string | null | undefined, time?: string | null) {
  if (!iso) return '—'
  try {
    const base = time ? `${iso}T${time}` : iso
    const d = new Date(base)
    if (!Number.isFinite(d.getTime())) {
      return new Date(iso).toLocaleDateString('ko-KR', {
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })
    }
    return d.toLocaleString('ko-KR', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return '—'
  }
}

function fmtDateKo(iso: string | null | undefined) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('ko-KR', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
  } catch {
    return '—'
  }
}

function salonName(row: BookingRow): string {
  const s = row.salons
  if (!s) return '—'
  if (Array.isArray(s)) return String(s[0]?.name || '—')
  return String(s.name || '—')
}

function statusBadgeStyle(status: string): { bg: string; color: string } {
  const s = String(status || '')
  if (s.includes('완료')) return { bg: 'rgba(123,94,167,0.2)', color: P }
  if (s.includes('취소')) return { bg: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.3)' }
  return { bg: 'rgba(201,169,110,0.15)', color: GOLD }
}

function couponDiscountLabel(c: CouponRow['coupons']) {
  if (!c) return '—'
  const dt = String(c.discount_type || (c.type === 'rate' ? 'rate' : 'amount') || '')
  let val = c.discount_value
  if (val == null && c.discount_amount != null) val = Number(c.discount_amount)
  if (val == null && c.discount_rate != null) val = Number(c.discount_rate)
  if (val == null) return '—'
  if (dt === 'percent' || dt === 'rate') return `${val}%`
  return `${Number(val).toLocaleString('ko-KR')}원`
}

export default function MyManagePage() {
  const router = useRouter()
  const [authReady, setAuthReady] = useState(false)
  const [publicUserId, setPublicUserId] = useState<string | null>(null)
  const [userName, setUserName] = useState('')
  const [userGrade, setUserGrade] = useState('')
  const [activeTab, setActiveTab] = useState<MainTab>('bookings')
  const [couponSubTab, setCouponSubTab] = useState<CouponSubTab>('usable')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [bookings, setBookings] = useState<BookingRow[]>([])
  const [coupons, setCoupons] = useState<CouponRow[]>([])
  const [careCards, setCareCards] = useState<CareCardRow[]>([])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      const sb = createClient()
      const { data: { user } } = await sb.auth.getUser()
      if (!user) {
        router.push('/login?role=customer&redirect=/my/manage')
        return
      }
      const { data: profile } = await sb
        .from('users')
        .select('id, name, customer_grade')
        .eq('auth_id', user.id)
        .maybeSingle()
      if (cancelled) return
      if (!profile?.id) {
        router.push('/login?role=customer&redirect=/my/manage')
        return
      }
      setPublicUserId(String(profile.id))
      setUserName(String((profile as { name?: string }).name || ''))
      setUserGrade(String((profile as { customer_grade?: string }).customer_grade || ''))
      setAuthReady(true)
    }
    void run()
    return () => { cancelled = true }
  }, [router])

  const fetchTab = useCallback(async (tab: MainTab, uid: string, authUid: string) => {
    setLoading(true)
    setError(false)
    const sb = createClient()
    try {
      if (tab === 'bookings') {
        const { data, error: qErr } = await sb
          .from('bookings')
          .select('id, service_name, booking_date, booking_time, status, salon_id, salons(name)')
          .eq('customer_id', uid)
          .order('booking_date', { ascending: false })
          .limit(20)
        if (qErr) throw qErr
        setBookings((data || []) as BookingRow[])
      } else if (tab === 'coupons') {
        const { data, error: qErr } = await sb
          .from('user_coupons')
          .select('id, status, issued_at, used_at, expired_at, coupons(name, discount_type, discount_value, description, type, discount_amount, discount_rate)')
          .eq('user_id', authUid)
          .order('issued_at', { ascending: false })
        if (qErr) throw qErr
        const rows = (data || []).map((uc: Record<string, unknown>) => {
          const emb = uc.coupons
          const couponRow = emb && typeof emb === 'object' && !Array.isArray(emb)
            ? emb
            : Array.isArray(emb) && emb[0]
              ? emb[0]
              : null
          return { ...uc, coupons: couponRow } as CouponRow
        })
        setCoupons(rows)
      } else {
        const { data, error: qErr } = await sb
          .from('body_care_cards')
          .select('id, title, care, quote, phase_tags, category_tags, created_at')
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(20)
        if (qErr) throw qErr
        setCareCards((data || []) as CareCardRow[])
      }
    } catch {
      setError(true)
      if (tab === 'bookings') setBookings([])
      if (tab === 'coupons') setCoupons([])
      if (tab === 'care') setCareCards([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!authReady || !publicUserId) return
    let cancelled = false
    const sb = createClient()
    const run = async () => {
      setLoading(true)
      setError(false)
      try {
        const { data: { user } } = await sb.auth.getUser()
        if (!user || cancelled) return
        await fetchTab(activeTab, publicUserId, user.id)
      } catch {
        if (!cancelled) setError(true)
      }
    }
    void run()
    return () => { cancelled = true }
  }, [authReady, publicUserId, activeTab, fetchTab])

  const filteredCoupons = useMemo(() => {
    if (couponSubTab === 'usable') return coupons.filter((c) => c.status === 'unused')
    return coupons.filter((c) => c.status === 'used')
  }, [coupons, couponSubTab])

  const mainTabs: { key: MainTab; label: string }[] = [
    { key: 'bookings', label: '예약내역' },
    { key: 'coupons', label: '관리권·쿠폰' },
    { key: 'care', label: '케어카드' },
  ]

  if (!authReady) {
    return (
      <div style={{ minHeight: '100vh', background: BG, color: TEXT_SUB, fontSize: 13, padding: 24 }}>
        불러오는 중…
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh',
      maxWidth: 390,
      margin: '0 auto',
      background: BG,
      color: TEXT_MAIN,
      fontFamily: "'Noto Sans KR', sans-serif",
      paddingBottom: 32,
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 16px 0',
      }}>
        <button
          type="button"
          onClick={() => router.back()}
          style={{
            border: 'none',
            background: 'transparent',
            color: TEXT_SUB,
            fontSize: 20,
            cursor: 'pointer',
            padding: 4,
          }}
        >
          ‹
        </button>
        <div style={{ fontSize: 16, color: TEXT_MAIN }}>내 관리</div>
        <div style={{ width: 28 }} />
      </div>

      {userName ? (
        <div style={{ textAlign: 'center', fontSize: 11, color: TEXT_SUB, marginTop: 8 }}>
          {userName}{userGrade ? ` · ${userGrade}` : ''}
        </div>
      ) : null}

      <div style={{
        display: 'flex',
        margin: '16px 16px 0',
        borderBottom: `1px solid ${BORDER}`,
      }}>
        {mainTabs.map((t) => {
          const on = activeTab === t.key
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveTab(t.key)}
              style={{
                flex: 1,
                padding: '12px 0',
                border: 'none',
                background: 'transparent',
                color: on ? TEXT_MAIN : TEXT_SUB,
                fontSize: 13,
                cursor: 'pointer',
                borderBottom: on ? `2px solid ${P}` : '2px solid transparent',
                marginBottom: -1,
                fontFamily: 'inherit',
              }}
            >
              {t.label}
            </button>
          )
        })}
      </div>

      <div style={{ padding: '16px', opacity: loading ? 0.4 : 1 }}>
        {loading ? (
          <div style={{ textAlign: 'center', fontSize: 13, color: TEXT_SUB, padding: '24px 0' }}>
            불러오는 중…
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', fontSize: 13, color: TEXT_SUB, padding: '24px 0' }}>
            잠시 후 다시 시도해주세요
          </div>
        ) : activeTab === 'bookings' ? (
          bookings.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🗓️</div>
              <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.7)', marginBottom: 8 }}>아직 예약 내역이 없어요</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginBottom: 24 }}>살롱 예약 후 내역이 표시돼요</div>
              <a href="/booking" style={{ display: 'inline-block', padding: '10px 24px', borderRadius: 20, background: '#7B5EA7', color: '#fff', fontSize: 13, textDecoration: 'none' }}>살롱 예약하기</a>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {bookings.map((b) => {
                const badge = statusBadgeStyle(b.status)
                return (
                  <div
                    key={b.id}
                    style={{
                      background: CARD_BG,
                      border: `1px solid ${BORDER}`,
                      borderRadius: 14,
                      padding: '14px 16px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div style={{ fontSize: 16, color: TEXT_MAIN }}>{b.service_name || '예약'}</div>
                      <span style={{
                        fontSize: 11,
                        padding: '4px 10px',
                        borderRadius: 999,
                        background: badge.bg,
                        color: badge.color,
                      }}>
                        {b.status}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, color: TEXT_SUB, marginBottom: 6 }}>{salonName(b)}</div>
                    <div style={{ fontSize: 12, color: TEXT_SUB }}>
                      {fmtDateTimeKo(b.booking_date, b.booking_time)}
                    </div>
                  </div>
                )
              })}
            </div>
          )
        ) : activeTab === 'coupons' ? (
          <>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              {([
                ['usable', '사용가능'],
                ['used', '사용완료'],
              ] as const).map(([key, label]) => {
                const on = couponSubTab === key
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setCouponSubTab(key)}
                    style={{
                      flex: 1,
                      padding: '9px 0',
                      borderRadius: 10,
                      border: on ? `1px solid ${P}` : `1px solid ${BORDER}`,
                      background: on ? 'rgba(123,94,167,0.15)' : 'transparent',
                      color: on ? TEXT_MAIN : TEXT_SUB,
                      fontSize: 12,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
            {filteredCoupons.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>🎫</div>
                <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.7)', marginBottom: 8 }}>보유한 쿠폰이 없어요</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>원장님께 관리권·쿠폰을 받으면 여기에 표시돼요</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {filteredCoupons.map((row) => (
                  <div
                    key={row.id}
                    style={{
                      background: CARD_BG,
                      border: `1px solid ${BORDER}`,
                      borderRadius: 14,
                      padding: '14px 16px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 15, color: TEXT_MAIN, marginBottom: 4 }}>
                          {row.coupons?.name || '쿠폰'}
                        </div>
                        {row.coupons?.description ? (
                          <div style={{ fontSize: 12, color: TEXT_SUB, lineHeight: 1.5 }}>
                            {row.coupons.description}
                          </div>
                        ) : null}
                      </div>
                      <div style={{ fontSize: 16, color: GOLD, flexShrink: 0 }}>
                        {couponDiscountLabel(row.coupons)}
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: TEXT_SUB, marginTop: 10 }}>
                      {fmtDateKo(row.issued_at)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : careCards.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>💆</div>
            <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.7)', marginBottom: 8 }}>케어카드가 없어요</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>시술 완료 후 원장님이 발송한 케어카드가 여기에 표시돼요</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {careCards.map((card) => {
              const phase = card.phase_tags?.[0] || '케어'
              return (
                <div
                  key={card.id}
                  style={{
                    background: CARD_BG,
                    border: `1px solid ${BORDER}`,
                    borderRadius: 14,
                    padding: '14px 16px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{
                      fontSize: 10,
                      padding: '3px 8px',
                      borderRadius: 999,
                      background: P,
                      color: '#fff',
                    }}>
                      {phase}
                    </span>
                    <div style={{ fontSize: 15, color: TEXT_MAIN }}>{card.title}</div>
                  </div>
                  <div style={{
                    fontSize: 13,
                    color: TEXT_SUB,
                    lineHeight: 1.55,
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}>
                    {card.care}
                  </div>
                  <div style={{ fontSize: 11, color: TEXT_SUB, marginTop: 10 }}>
                    {fmtDateKo(card.created_at)}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
