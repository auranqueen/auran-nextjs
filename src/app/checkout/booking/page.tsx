'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { createPayAppPayment } from '@/lib/payments/payapp'

const BG = '#0D0B09'
const PURPLE = '#7B5EA7'
const PURPLE_LIGHT = 'rgba(123,94,167,0.15)'
const GOLD = '#C9A96E'
const TEXT = '#ffffff'
const TEXT_SUB = 'rgba(255,255,255,0.55)'
const BORDER = 'rgba(255,255,255,0.08)'
const CARD = 'rgba(255,255,255,0.05)'
const SURFACE = 'rgba(255,255,255,0.08)'

const SESSION_OPTS = [
  { sessions: 1, label: '1회권', discount: 0 },
  { sessions: 5, label: '5회권', discount: 5 },
  { sessions: 10, label: '10회권', discount: 10 },
] as const

function BookingCheckoutInner() {
  const router = useRouter()
  const search = useSearchParams()
  const supabase = createClient()

  const salonId = search.get('salon_id') || ''
  const salonName = decodeURIComponent(search.get('salon_name') || '')
  const serviceName = decodeURIComponent(search.get('service_name') || '')
  const servicePrice = Number(search.get('service_price') || 0)
  const serviceCostRaw = Number(search.get('service_cost') || 0)
  const serviceCost = serviceCostRaw > 0 ? serviceCostRaw : servicePrice
  const partnerFeeRate = Number(search.get('partner_fee_rate') || 0)
  const reviewerId = search.get('reviewer_id') ?? ''

  const initialSessions = Number(search.get('sessions') || 1)
  const [sessions, setSessions] = useState(initialSessions)
  const [toastOn, setToastOn] = useState(false)
  const [toastInput, setToastInput] = useState(0)
  const [userToast, setUserToast] = useState(0)
  const [meId, setMeId] = useState('')
  const [paying, setPaying] = useState(false)
  const [loading, setLoading] = useState(true)
  const [toastMsg, setToastMsg] = useState('')

  const showToast = (msg: string) => setToastMsg(msg)

  useEffect(() => {
    if (!toastMsg) return
    const t = setTimeout(() => setToastMsg(''), 2000)
    return () => clearTimeout(t)
  }, [toastMsg])

  useEffect(() => {
    const run = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login?role=customer')
        return
      }
      const { data: urow } = await supabase.from('users').select('id,points').eq('auth_id', user.id).maybeSingle()
      if (!urow?.id) {
        router.push('/login?role=customer')
        return
      }
      setMeId(String(urow.id))
      setUserToast(Number(urow.points || 0))
      setLoading(false)
    }
    void run()
  }, [router])

  const basePrice = servicePrice * sessions
  const discount = SESSION_OPTS.find((o) => o.sessions === sessions)?.discount ?? 0
  const discountedPrice = Math.floor(basePrice * (1 - discount / 100))
  const costPrice = serviceCost * sessions
  const marginAmount = discountedPrice - costPrice
  const maxToastUsable = Math.min(userToast, Math.max(marginAmount, 0))
  const toastUsed = toastOn ? Math.min(toastInput, maxToastUsable) : 0
  const finalPrice = discountedPrice - toastUsed

  useEffect(() => {
    if (toastInput > maxToastUsable) setToastInput(maxToastUsable)
  }, [toastInput, maxToastUsable])

  const handlePay = () => {
    if (finalPrice < 1000) {
      showToast('금액이 너무 작아요')
      return
    }
    if (!meId) {
      router.push('/login?role=customer')
      return
    }
    setPaying(true)
    const targetId = [
      salonId,
      serviceName,
      servicePrice,
      sessions,
      partnerFeeRate,
      serviceCost,
      toastUsed,
      marginAmount,
      reviewerId,
    ].join('|')
    createPayAppPayment({
      kind: 'booking',
      amount: finalPrice,
      target_id: targetId,
    })
      .then((res) => {
        if (res.ok && res.pay_url) {
          window.location.href = res.pay_url
        } else {
          showToast('결제 오류가 발생했어요. 다시 시도해주세요.')
          setPaying(false)
        }
      })
      .catch(() => {
        showToast('결제 오류가 발생했어요.')
        setPaying(false)
      })
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: BG, color: TEXT_SUB, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>
        불러오는 중…
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: BG, color: TEXT, paddingBottom: 100, maxWidth: 480, margin: '0 auto', position: 'relative' }}>
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          background: BG,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: `0.5px solid ${BORDER}`,
        }}
      >
        <button
          type="button"
          onClick={() => router.back()}
          style={{ border: 'none', background: 'transparent', color: TEXT, fontSize: 14, cursor: 'pointer', minWidth: 44, textAlign: 'left' }}
        >
          ←
        </button>
        <div style={{ fontSize: 15, fontWeight: 500 }}>구매하기</div>
        <div style={{ width: 44 }} />
      </div>

      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* 카드 1: 구매 정보 */}
        <div style={{ background: CARD, border: `0.5px solid ${BORDER}`, borderRadius: 12, padding: '14px 15px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                background: PURPLE_LIGHT,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 18,
                flexShrink: 0,
              }}
            >
              💜
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500 }}>{salonName || '샵'}</div>
            </div>
          </div>
          <div style={{ fontSize: 13, color: TEXT, marginBottom: 4 }}>{serviceName || '시술'}</div>
          <div style={{ fontSize: 12, color: TEXT_SUB }}>1회 ₩{servicePrice.toLocaleString()}</div>
        </div>

        {/* 카드 2: 회차 선택 */}
        <div style={{ background: CARD, border: `0.5px solid ${BORDER}`, borderRadius: 12, padding: '14px 15px' }}>
          {initialSessions > 1 ? (
            <div style={{ fontSize: 13, color: TEXT_SUB, lineHeight: 1.5 }}>
              선택한 회차: {sessions}회권 (변경하려면 이전 화면으로)
            </div>
          ) : (
            <>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>회차 선택</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
            {SESSION_OPTS.map((opt) => {
              const optBase = servicePrice * opt.sessions
              const optFinal = Math.floor(optBase * (1 - opt.discount / 100))
              const selected = sessions === opt.sessions
              return (
                <button
                  key={opt.sessions}
                  type="button"
                  onClick={() => setSessions(opt.sessions)}
                  style={{
                    padding: '12px 8px',
                    borderRadius: 10,
                    border: selected ? `1.5px solid ${PURPLE}` : `0.5px solid ${BORDER}`,
                    background: selected ? PURPLE_LIGHT : SURFACE,
                    cursor: 'pointer',
                    textAlign: 'center',
                  }}
                >
                  {opt.discount > 0 ? (
                    <div style={{ fontSize: 9, color: GOLD, marginBottom: 4 }}>{opt.discount}%</div>
                  ) : (
                    <div style={{ height: 13 }} />
                  )}
                  <div style={{ fontSize: 12, fontWeight: 500, color: TEXT, marginBottom: 4 }}>{opt.label}</div>
                  {opt.discount > 0 ? (
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textDecoration: 'line-through', marginBottom: 2 }}>
                      ₩{optBase.toLocaleString()}
                    </div>
                  ) : null}
                  <div style={{ fontSize: 12, fontWeight: 500, color: GOLD }}>₩{optFinal.toLocaleString()}</div>
                </button>
              )
            })}
          </div>
          <div style={{ fontSize: 11, color: TEXT_SUB, lineHeight: 1.5 }}>
            결제 후 원하는 날짜에 예약하시면 돼요 💜
            <br />
            구매한 회차는 마이페이지에서 확인할 수 있어요.
          </div>
            </>
          )}
        </div>

        {/* 카드 3: 할인 안내 */}
        <div style={{ background: CARD, border: `0.5px solid ${BORDER}`, borderRadius: 12, padding: '14px 15px' }}>
          <div style={{ fontSize: 12, color: TEXT_SUB, lineHeight: 1.6 }}>
            관리권은 등급 할인이 적용되지 않아요.
            <br />
            원장님이 설정한 다회권 할인만 적용됩니다.
          </div>
        </div>

        {/* 카드 4: 토스트 사용 */}
        <div style={{ background: CARD, border: `0.5px solid ${BORDER}`, borderRadius: 12, padding: '14px 15px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 500 }}>토스트 사용</div>
            <button
              type="button"
              onClick={() => setToastOn((v) => !v)}
              style={{
                width: 44,
                height: 24,
                borderRadius: 12,
                border: 'none',
                background: toastOn ? PURPLE : SURFACE,
                cursor: 'pointer',
                position: 'relative',
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  top: 3,
                  left: toastOn ? 23 : 3,
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  background: '#fff',
                  transition: 'left 0.15s',
                }}
              />
            </button>
          </div>
          <div style={{ fontSize: 11, color: TEXT_SUB, marginBottom: toastOn ? 10 : 0 }}>
            보유 {userToast.toLocaleString()} T · 최대 {maxToastUsable.toLocaleString()} T 사용 가능
          </div>
          {toastOn ? (
            <>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                <input
                  type="number"
                  min={0}
                  max={maxToastUsable}
                  value={toastInput}
                  onChange={(e) => {
                    const v = Math.max(0, Math.floor(Number(e.target.value) || 0))
                    setToastInput(Math.min(v, maxToastUsable))
                  }}
                  style={{
                    flex: 1,
                    background: SURFACE,
                    border: `0.5px solid ${BORDER}`,
                    borderRadius: 8,
                    padding: '10px 12px',
                    color: TEXT,
                    fontSize: 14,
                  }}
                />
                <span style={{ fontSize: 13, color: TEXT_SUB, flexShrink: 0 }}>T</span>
                <button
                  type="button"
                  onClick={() => setToastInput(maxToastUsable)}
                  style={{
                    flexShrink: 0,
                    padding: '8px 10px',
                    borderRadius: 8,
                    border: `0.5px solid ${PURPLE}`,
                    background: 'transparent',
                    color: PURPLE,
                    fontSize: 11,
                    cursor: 'pointer',
                  }}
                >
                  최대 사용
                </button>
              </div>
              <div style={{ fontSize: 11, color: TEXT_SUB }}>최대 {maxToastUsable.toLocaleString()} T 사용 가능해요</div>
            </>
          ) : null}
        </div>

        {/* 카드 5: 결제 금액 */}
        <div style={{ background: CARD, border: `0.5px solid ${BORDER}`, borderRadius: 12, padding: '14px 15px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: TEXT_SUB, marginBottom: 6 }}>
            <span>정가</span>
            <span>₩{discountedPrice.toLocaleString()}</span>
          </div>
          {toastOn && toastUsed > 0 ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: GOLD, marginBottom: 6 }}>
              <span>토스트 사용</span>
              <span>-₩{toastUsed.toLocaleString()}</span>
            </div>
          ) : null}
          <div style={{ borderTop: `0.5px solid ${BORDER}`, marginTop: 10, paddingTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 500 }}>최종 결제금액</span>
            <span style={{ fontSize: 20, fontWeight: 600, color: GOLD }}>₩{finalPrice.toLocaleString()}</span>
          </div>
        </div>
      </div>

      <div
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          maxWidth: 480,
          margin: '0 auto',
          zIndex: 50,
          padding: '12px 16px calc(12px + env(safe-area-inset-bottom))',
          background: BG,
          borderTop: `0.5px solid ${BORDER}`,
        }}
      >
        <button
          type="button"
          disabled={paying || finalPrice < 1000}
          onClick={handlePay}
          style={{
            width: '100%',
            padding: 14,
            border: 'none',
            borderRadius: 12,
            background: paying || finalPrice < 1000 ? SURFACE : PURPLE,
            color: paying || finalPrice < 1000 ? 'rgba(255,255,255,0.3)' : '#fff',
            fontSize: 15,
            fontWeight: 500,
            cursor: paying || finalPrice < 1000 ? 'default' : 'pointer',
          }}
        >
          {paying ? '결제창으로 이동 중…' : `결제하기 ₩${finalPrice.toLocaleString()}`}
        </button>
      </div>

      {toastMsg ? (
        <div
          style={{
            position: 'fixed',
            left: '50%',
            transform: 'translateX(-50%)',
            bottom: 88,
            background: PURPLE,
            color: TEXT,
            borderRadius: 12,
            padding: '10px 16px',
            fontSize: 13,
            zIndex: 50,
            whiteSpace: 'nowrap',
          }}
        >
          {toastMsg}
        </div>
      ) : null}
    </div>
  )
}

export default function BookingCheckoutPage() {
  return (
    <Suspense
      fallback={
        <div style={{ minHeight: '100vh', background: BG, color: TEXT_SUB, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>
          불러오는 중…
        </div>
      }
    >
      <BookingCheckoutInner />
    </Suspense>
  )
}
