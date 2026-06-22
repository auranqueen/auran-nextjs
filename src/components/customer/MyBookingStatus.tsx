'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const BG = '#0D0B09'
const CARD = '#181520'
const PURPLE = '#7B5EA7'
const GOLD = '#C9A96E'
const BORDER = '1px solid rgba(255,255,255,0.06)'
const TEXT = 'rgba(255,255,255,0.9)'
const TEXT_SUB = 'rgba(255,255,255,0.45)'

type SalonEmbed = { name?: string | null; category?: string | null }

type PurchaseRow = {
  id: string
  salon_id: string
  service_name?: string | null
  used_sessions: number
  total_sessions: number
  salons: SalonEmbed | SalonEmbed[] | null
}

type BookingRow = {
  id: string
  service_name?: string | null
  booking_date?: string | null
  booking_time?: string | null
  status?: string | null
}

function salonInfo(row: PurchaseRow) {
  const s = row.salons
  if (!s) return { name: '샵', category: null as string | null }
  if (Array.isArray(s)) return { name: String(s[0]?.name || '샵'), category: s[0]?.category ?? null }
  return { name: String(s.name || '샵'), category: s.category ?? null }
}

function salonIcon(category: string | null) {
  if (!category) return '✦'
  const c = category.toLowerCase()
  if (c.includes('피부') || c.includes('skin')) return '💆'
  if (c.includes('헤어') || c.includes('hair')) return '💇'
  if (c.includes('네일') || c.includes('nail')) return '💅'
  return '✦'
}

function fmtBookingDate(date?: string | null, time?: string | null) {
  if (!date) return '—'
  const t = time ? ` ${String(time).slice(0, 5)}` : ''
  try {
    return `${new Date(`${date}T12:00:00`).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}${t}`
  } catch {
    return date + t
  }
}

function isCompleted(status?: string | null) {
  const s = String(status || '').toLowerCase()
  return s === 'completed' || s === '완료' || s === 'confirmed' || s === '예약확정'
}

function isCancelled(status?: string | null) {
  const s = String(status || '').toLowerCase()
  return s === 'cancelled' || s === 'canceled' || s === '취소' || s === 'rejected' || s === '거절'
}

export default function MyBookingStatus() {
  const router = useRouter()
  const supabaseRef = useRef(createClient())
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<PurchaseRow[]>([])
  const [popup, setPopup] = useState<PurchaseRow | null>(null)
  const [bookings, setBookings] = useState<BookingRow[]>([])
  const [bookingsLoading, setBookingsLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const sb = supabaseRef.current
      const { data: auth } = await sb.auth.getUser()
      const authUser = auth.user
      if (!authUser) {
        if (!cancelled) setLoading(false)
        return
      }
      const { data: me } = await sb.from('users').select('id').eq('auth_id', authUser.id).maybeSingle()
      if (!me?.id || cancelled) {
        if (!cancelled) setLoading(false)
        return
      }
      const { data } = await sb
        .from('purchases')
        .select('id, salon_id, service_name, used_sessions, total_sessions, salons(name, category)')
        .eq('customer_id', me.id)
        .order('purchased_at', { ascending: false })
      if (cancelled) return
      const list = ((data as PurchaseRow[]) || []).filter(
        (p) => Number(p.used_sessions) < Number(p.total_sessions),
      )
      setRows(list)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!popup) {
      setBookings([])
      return
    }
    let cancelled = false
    ;(async () => {
      setBookingsLoading(true)
      const sb = supabaseRef.current
      const { data: auth } = await sb.auth.getUser()
      const authUser = auth.user
      if (!authUser) {
        setBookingsLoading(false)
        return
      }
      const { data: me } = await sb.from('users').select('id').eq('auth_id', authUser.id).maybeSingle()
      if (!me?.id || cancelled) {
        setBookingsLoading(false)
        return
      }
      const { data } = await sb
        .from('bookings')
        .select('id, service_name, booking_date, booking_time, status')
        .eq('customer_id', me.id)
        .eq('salon_id', popup.salon_id)
        .order('booking_date', { ascending: false })
        .limit(20)
      if (!cancelled) {
        setBookings((data as BookingRow[]) || [])
        setBookingsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [popup])

  if (loading || rows.length === 0) return null

  const openPopup = (row: PurchaseRow) => setPopup(row)
  const closePopup = () => setPopup(null)

  const popupSalon = popup ? salonInfo(popup) : null
  const popupRemaining = popup ? Number(popup.total_sessions) - Number(popup.used_sessions) : 0
  const popupProgress = popup && Number(popup.total_sessions) > 0
    ? Math.min(100, (Number(popup.used_sessions) / Number(popup.total_sessions)) * 100)
    : 0

  return (
    <>
      <div style={{ padding: '16px 16px 0' }}>
        <div style={{ fontSize: 13, color: TEXT, marginBottom: 10, fontWeight: 400 }}>내 관리 현황</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {rows.map((row) => {
            const { name, category } = salonInfo(row)
            const used = Number(row.used_sessions) || 0
            const total = Number(row.total_sessions) || 0
            const remaining = total - used
            const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0
            return (
              <div
                key={row.id}
                onClick={() => openPopup(row)}
                style={{
                  background: CARD,
                  border: BORDER,
                  borderRadius: 12,
                  padding: '10px 8px',
                  cursor: 'pointer',
                  minHeight: 118,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                }}
              >
                <span style={{ fontSize: 20, lineHeight: 1, marginBottom: 6 }}>{salonIcon(category)}</span>
                <span
                  style={{
                    fontSize: 11,
                    color: TEXT,
                    fontWeight: 400,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    width: '100%',
                    marginBottom: 6,
                  }}
                >
                  {name}
                </span>
                <span style={{ fontSize: 22, color: PURPLE, fontWeight: 500, lineHeight: 1 }}>{remaining}</span>
                <span style={{ fontSize: 10, color: TEXT_SUB, marginTop: 2 }}>/ {total}회 남음</span>
                <div
                  style={{
                    width: '100%',
                    height: 4,
                    borderRadius: 2,
                    background: 'rgba(255,255,255,0.08)',
                    marginTop: 8,
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ width: `${pct}%`, height: '100%', background: PURPLE, borderRadius: 2 }} />
                </div>
              </div>
            )
          })}
          <div
            onClick={() => router.push('/booking')}
            style={{
              background: CARD,
              border: `1px dashed rgba(123,94,167,0.35)`,
              borderRadius: 12,
              padding: '10px 8px',
              cursor: 'pointer',
              minHeight: 118,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
            }}
          >
            <span style={{ fontSize: 22, color: PURPLE, fontWeight: 400 }}>+</span>
            <span style={{ fontSize: 10, color: TEXT_SUB, fontWeight: 400 }}>새 예약</span>
          </div>
        </div>
      </div>

      {popup && popupSalon ? (
        <div
          onClick={closePopup}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 200,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 340,
              background: CARD,
              border: BORDER,
              borderRadius: 16,
              padding: '18px 16px',
              maxHeight: '80vh',
              overflowY: 'auto',
            }}
          >
            <div style={{ fontSize: 15, color: TEXT, fontWeight: 400, marginBottom: 12 }}>{popupSalon.name}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 8 }}>
              <span style={{ fontSize: 28, color: PURPLE, fontWeight: 500 }}>{popupRemaining}</span>
              <span style={{ fontSize: 12, color: TEXT_SUB, fontWeight: 400 }}>회 남음</span>
            </div>
            <div
              style={{
                width: '100%',
                height: 6,
                borderRadius: 3,
                background: 'rgba(255,255,255,0.08)',
                marginBottom: 16,
                overflow: 'hidden',
              }}
            >
              <div style={{ width: `${popupProgress}%`, height: '100%', background: PURPLE, borderRadius: 3 }} />
            </div>
            <div style={{ fontSize: 11, color: TEXT_SUB, marginBottom: 8, fontWeight: 400 }}>예약 내역</div>
            {bookingsLoading ? (
              <div style={{ fontSize: 12, color: TEXT_SUB, padding: '12px 0', textAlign: 'center' }}>불러오는 중…</div>
            ) : bookings.length === 0 ? (
              <div style={{ fontSize: 12, color: TEXT_SUB, padding: '12px 0', textAlign: 'center' }}>예약 내역이 없어요</div>
            ) : (
              bookings.map((b) => {
                const done = isCompleted(b.status)
                const cancelled = isCancelled(b.status)
                return (
                  <div
                    key={b.id}
                    style={{
                      borderBottom: '1px solid rgba(255,255,255,0.06)',
                      padding: '10px 0',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 12, color: TEXT, fontWeight: 400, flex: 1, minWidth: 0 }}>
                        {b.service_name || '시술'}
                      </span>
                      {done ? (
                        <span
                          style={{
                            fontSize: 10,
                            padding: '3px 8px',
                            borderRadius: 20,
                            border: `1px solid ${PURPLE}`,
                            color: PURPLE,
                            fontWeight: 400,
                            flexShrink: 0,
                          }}
                        >
                          완료 · {popupRemaining}회 남음
                        </span>
                      ) : cancelled ? (
                        <span
                          style={{
                            fontSize: 10,
                            padding: '3px 8px',
                            borderRadius: 20,
                            border: '1px solid rgba(255,100,100,0.5)',
                            color: 'rgba(255,130,130,0.95)',
                            fontWeight: 400,
                            flexShrink: 0,
                          }}
                        >
                          취소
                        </span>
                      ) : (
                        <span style={{ fontSize: 10, color: GOLD, fontWeight: 400 }}>{b.status || '예정'}</span>
                      )}
                    </div>
                    <div style={{ fontSize: 10, color: TEXT_SUB, marginTop: 4, fontWeight: 400 }}>
                      {fmtBookingDate(b.booking_date, b.booking_time)}
                    </div>
                    {cancelled ? (
                      <div style={{ fontSize: 10, color: 'rgba(255,130,130,0.85)', marginTop: 4, fontWeight: 400 }}>
                        회차 복구됐어요
                      </div>
                    ) : null}
                  </div>
                )
              })
            )}
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <span
                onClick={closePopup}
                style={{
                  flex: 1,
                  textAlign: 'center',
                  padding: '12px 0',
                  borderRadius: 10,
                  border: BORDER,
                  color: TEXT_SUB,
                  fontSize: 13,
                  cursor: 'pointer',
                  fontWeight: 400,
                }}
              >
                닫기
              </span>
              <span
                onClick={() => {
                  closePopup()
                  router.push(`/salons/${popup.salon_id}`)
                }}
                style={{
                  flex: 1,
                  textAlign: 'center',
                  padding: '12px 0',
                  borderRadius: 10,
                  background: PURPLE,
                  color: '#fff',
                  fontSize: 13,
                  cursor: 'pointer',
                  fontWeight: 400,
                }}
              >
                예약하기
              </span>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
