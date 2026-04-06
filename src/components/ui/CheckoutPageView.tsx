'use client'

import { useState } from 'react'
import ProductThumbnail from '@/components/ui/ProductThumbnail'
import {
  computeCouponDiscount,
  isCouponApplicableForOrder,
  isCouponExpiredForUser,
  type OrderLineForCoupon,
} from '@/lib/coupon/computeDiscount'

function toNum(v: unknown) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export type CheckoutUcRow = {
  id: string
  status: string
  coupon_id: string
  expired_at?: string | null
  coupons: any
}

type Props = {
  toast: string
  loading: boolean
  orderedProducts: any[]
  qtyList: number[]
  giftTo: string
  recipientName: string
  setRecipientName: (v: string) => void
  recipientPhone: string
  setRecipientPhone: (v: string) => void
  address: string
  setAddress: (v: string) => void
  subtotal: number
  afterGrade: number
  isFounder?: boolean
  founderDiscountAmt?: number
  gradeDiscount?: number
  gradeDiscountAmt?: number
  gradeName?: string
  couponDiscount: number
  applicableCheckoutCoupons: CheckoutUcRow[]
  selectedUserCouponId: string | null
  setSelectedUserCouponId: (id: string | null) => void
  maxCouponPct: number
  payWithToast: boolean
  setPayWithToast: (v: boolean) => void
  toastDraftWon: number | null
  setToastDraftWon: (v: number | null) => void
  goodsAfterPoints: number
  payWithOran: boolean
  setPayWithOran: (v: boolean) => void
  oranDraftWon: number | null
  setOranDraftWon: (v: number | null) => void
  oranUsed: number
  toastUsed: number
  pointUsed: number
  points: number
  balance: number
  toastRate: number
  usePoints: boolean
  setUsePoints: (v: boolean) => void
  pointInput: number
  setPointInput: (v: number) => void
  maxPointsUsable: number
  maxPointRate: number
  needCharge: number
  paying: boolean
  showChargeOption: boolean
  chargeSheetOpen: boolean
  setChargeSheetOpen: (v: boolean) => void
  couponSheetOpen: boolean
  setCouponSheetOpen: (v: boolean) => void
  userCoupons: CheckoutUcRow[]
  authUid: string | null
  orderLines: OrderLineForCoupon[]
  shippingFee?: number
  extraShippingFee?: number
  freeShippingThreshold?: number
  onPay: (allowCharge: boolean) => void
  onPayBankTransfer?: () => void | Promise<void>
  onChargeKrw: (krw: number) => void
}

export default function CheckoutPageView({
  toast,
  loading,
  orderedProducts,
  qtyList,
  giftTo,
  recipientName,
  setRecipientName,
  recipientPhone,
  setRecipientPhone,
  address,
  setAddress,
  subtotal,
  afterGrade,
  isFounder = false,
  founderDiscountAmt = 0,
  gradeDiscount = 0,
  gradeDiscountAmt = 0,
  gradeName = '',
  couponDiscount,
  applicableCheckoutCoupons,
  selectedUserCouponId,
  setSelectedUserCouponId,
  maxCouponPct,
  payWithToast,
  setPayWithToast,
  toastDraftWon,
  setToastDraftWon,
  goodsAfterPoints,
  payWithOran,
  setPayWithOran,
  oranDraftWon,
  setOranDraftWon,
  oranUsed,
  toastUsed,
  pointUsed,
  points,
  balance,
  toastRate,
  usePoints,
  setUsePoints,
  pointInput,
  setPointInput,
  maxPointsUsable,
  maxPointRate,
  needCharge,
  paying,
  showChargeOption,
  chargeSheetOpen,
  setChargeSheetOpen,
  couponSheetOpen,
  setCouponSheetOpen,
  userCoupons,
  authUid,
  orderLines,
  shippingFee = 0,
  extraShippingFee = 0,
  freeShippingThreshold = 0,
  onPay,
  onPayBankTransfer,
  onChargeKrw,
}: Props) {
  const toastHalfLocal = Math.min(balance, Math.floor((goodsAfterPoints * 1) / 2))
  const remBalAfterToast = Math.max(0, balance - toastUsed)
  const oranCapLocal = Math.min(remBalAfterToast, Math.max(0, goodsAfterPoints - toastUsed))
  const [useBankTransfer, setUseBankTransfer] = useState(false)
  const [receiptOn, setReceiptOn] = useState(true)
  const [receiptNum, setReceiptNum] = useState('')
  const [selectedChargeSummary, setSelectedChargeSummary] = useState('')
  const [customChargeOpen, setCustomChargeOpen] = useState(false)
  const [customChargeInput, setCustomChargeInput] = useState('')

  const closeChargeSheet = () => {
    setChargeSheetOpen(false)
    setSelectedChargeSummary('')
    setCustomChargeOpen(false)
    setCustomChargeInput('')
  }

  const pickChargeAmount = (label: string, krw: number) => {
    setCustomChargeOpen(false)
    setCustomChargeInput('')
    setSelectedChargeSummary(`${label} · ₩${krw.toLocaleString()} 선택됨`)
    onChargeKrw(krw)
  }

  return (
    <>
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(-1deg); }
          50% { transform: translateY(-10px) rotate(1deg); }
        }
      `}</style>
      <div style={{ padding: 16 }}>
        {toast && (
          <div style={{ marginBottom: 10, padding: 10, borderRadius: 10, border: '1px solid rgba(201,168,76,0.35)', background: 'rgba(201,168,76,0.12)', color: 'var(--gold)', fontSize: 12 }}>{toast}</div>
        )}
        {loading ? (
          <div style={{ color: 'var(--text3)', fontSize: 12 }}>불러오는 중...</div>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
              {orderedProducts.map((p, idx) => {
                const lineQty = qtyList[idx] ?? qtyList[0] ?? 1
                return (
                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: 10, borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          position: 'relative',
                          width: 44,
                          height: 44,
                          borderRadius: 10,
                          overflow: 'hidden',
                          flexShrink: 0,
                          background: 'rgba(0,0,0,0.2)',
                          animation: 'float 3s ease-in-out infinite',
                        }}
                      >
                        <ProductThumbnail src={p.thumb_img} alt={p.name || ''} fill objectFit="cover" />
                      </div>
                      <div style={{ color: '#fff', fontSize: 13, fontWeight: 700, minWidth: 0 }}>
                        {p.name} · {lineQty}개
                      </div>
                    </div>
                    <div style={{ color: 'var(--gold)', fontSize: 12, fontWeight: 800, flexShrink: 0 }}>₩{(toNum(p.retail_price) * lineQty).toLocaleString()}</div>
                  </div>
                )
              })}
            </div>

            {!!giftTo && <div style={{ marginBottom: 10, fontSize: 12, color: '#bcd6ff' }}>🎁 선물 주문 · 받는 분 ID: {giftTo}</div>}

            <div style={{ marginBottom: 12, padding: 12, borderRadius: 12, border: '1px solid var(--border)', background: 'rgba(255,255,255,0.04)' }}>
              <div style={{ fontSize: 13, fontWeight: 900, color: '#fff', marginBottom: 10 }}>배송 정보</div>
              <input type="text" placeholder="받는 분 이름" value={recipientName} onChange={e => setRecipientName(e.target.value)} style={{ width: '100%', marginBottom: 8, background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '10px 12px', color: '#fff' }} />
              <input type="tel" placeholder="연락처" value={recipientPhone} onChange={e => setRecipientPhone(e.target.value)} style={{ width: '100%', marginBottom: 8, background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '10px 12px', color: '#fff' }} />
              <textarea placeholder="주소" value={address} onChange={e => setAddress(e.target.value)} rows={2} style={{ width: '100%', background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '10px 12px', color: '#fff', resize: 'none' }} />
            </div>

            <div style={{ marginBottom: 12, padding: 12, borderRadius: 12, border: '1px solid var(--border)', background: 'rgba(255,255,255,0.04)' }}>
              <div style={{ fontSize: 13, fontWeight: 900, color: '#fff', marginBottom: 10 }}>금액 확인</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, color: '#fff', fontSize: 13 }}>
                <span>주문금액</span>
                <span>₩{subtotal.toLocaleString()}</span>
              </div>
              {isFounder && founderDiscountAmt > 0 ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, color: '#C9A96E', fontSize: 13 }}>
                  <span>👑 Founders 2% 할인</span>
                  <span>-₩{founderDiscountAmt.toLocaleString()}</span>
                </div>
              ) : null}
              {gradeDiscountAmt > 0 && gradeName ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, color: '#c4a5f5', fontSize: 13 }}>
                  <span>
                    {gradeName} 등급 {gradeDiscount}% 할인
                  </span>
                  <span>-₩{gradeDiscountAmt.toLocaleString()}</span>
                </div>
              ) : null}
              {couponDiscount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, color: '#7eb8ff', fontSize: 13 }}>
                  <span>🎫 쿠폰 할인</span>
                  <span>-₩{couponDiscount.toLocaleString()}</span>
                </div>
              )}
              {freeShippingThreshold > 0 && (
                <div style={{ marginBottom: 8, fontSize: 11, color: 'var(--text3)', lineHeight: 1.45 }}>
                  ₩{freeShippingThreshold.toLocaleString()} 이상 주문 시 기본 배송비 무료 · 제주·울릉 등 추가 배송비는 별도
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, color: 'rgba(255,255,255,0.88)', fontSize: 13 }}>
                <span>배송비</span>
                <span>{shippingFee > 0 ? `₩${shippingFee.toLocaleString()}` : '무료'}</span>
              </div>
              {extraShippingFee > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, color: '#9ecfff', fontSize: 13 }}>
                  <span>제주·산간 추가</span>
                  <span>+₩{extraShippingFee.toLocaleString()}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.08)', color: '#fff', fontSize: 14, fontWeight: 900 }}>
                <span>최종 결제 필요금액</span>
                <span>₩{needCharge.toLocaleString()}</span>
              </div>
            </div>

            <div style={{ marginBottom: 12, padding: 12, borderRadius: 12, border: '1px solid var(--border)', background: 'rgba(255,255,255,0.04)' }}>
              <div style={{ fontSize: 13, fontWeight: 900, color: '#fff', marginBottom: 10 }}>결제 수단 <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 400 }}>(중복 사용 가능)</span></div>

              <div style={{ marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: 'rgba(255,255,255,0.85)', marginBottom: 8 }}>🎟 쿠폰 선택</div>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10, fontSize: 12, color: 'rgba(255,255,255,0.9)', cursor: 'pointer' }}>
                  <input type="radio" name="checkout_coupon" checked={selectedUserCouponId === null} onChange={() => setSelectedUserCouponId(null)} />
                  <span>쿠폰 적용 안 함</span>
                </label>
                {applicableCheckoutCoupons.map(uc => {
                  const c = uc.coupons
                  if (!c) return null
                  const disc = computeCouponDiscount(afterGrade, c, { maxPercent: maxCouponPct })
                  const minO = Number(c.min_order || 0)
                  const exp = uc.expired_at || c.end_at
                  const expLabel = exp ? new Date(exp).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', month: '2-digit', day: '2-digit' }) : '—'
                  return (
                    <label
                      key={uc.id}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 10,
                        marginBottom: 10,
                        fontSize: 12,
                        color: 'rgba(255,255,255,0.92)',
                        cursor: 'pointer',
                        padding: '8px 10px',
                        borderRadius: 10,
                        border: selectedUserCouponId === uc.id ? '1px solid rgba(201,168,76,0.55)' : '1px solid rgba(255,255,255,0.08)',
                        background: selectedUserCouponId === uc.id ? 'rgba(201,168,76,0.08)' : 'transparent',
                      }}
                    >
                      <input type="radio" name="checkout_coupon" checked={selectedUserCouponId === uc.id} onChange={() => setSelectedUserCouponId(uc.id)} />
                      <span style={{ lineHeight: 1.45 }}>
                        <span style={{ fontWeight: 900 }}>{c.name}</span>
                        <br />
                        <span style={{ color: 'var(--gold)', fontWeight: 800 }}>−₩{disc.toLocaleString()}</span>
                        {' · '}
                        최소 ₩{minO.toLocaleString()} · ~{expLabel}
                      </span>
                    </label>
                  )
                })}
                {applicableCheckoutCoupons.length === 0 ? (
                  <div style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.5 }}>
                    이 주문 금액·상품 조건에 맞는 사용 가능 쿠폰이 없어요.
                  </div>
                ) : null}
                {couponDiscount > 0 && selectedUserCouponId ? (
                  <div style={{ marginTop: 8, fontSize: 13, fontWeight: 900, color: 'var(--gold)' }}>적용 시 −₩{couponDiscount.toLocaleString()}</div>
                ) : null}
                <button
                  type="button"
                  onClick={() => setCouponSheetOpen(true)}
                  style={{ marginTop: 8, fontSize: 11, color: 'var(--text3)', background: 'none', border: 'none', textDecoration: 'underline', cursor: 'pointer', padding: 0 }}
                >
                  전체 보유 쿠폰 목록
                </button>
              </div>

              <div style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: usePoints ? 8 : 0 }}>
                  <span style={{ fontSize: 12, color: '#fff' }}>💎 포인트 사용 · 보유 {points.toLocaleString()}P</span>
                  <button
                    type="button"
                    onClick={() => setUsePoints(!usePoints)}
                    style={{ width: 36, height: 20, borderRadius: 10, border: 'none', background: usePoints ? '#7B5EA7' : 'rgba(255,255,255,0.12)', cursor: 'pointer', position: 'relative', transition: 'background 0.2s' }}
                  >
                    <span style={{ position: 'absolute', width: 16, height: 16, borderRadius: '50%', background: '#fff', top: 2, left: usePoints ? 18 : 2, transition: 'left 0.2s' }} />
                  </button>
                </div>
                {usePoints && (
                  <input
                    type="text"
                    inputMode="numeric"
                    value={String(pointInput)}
                    onChange={(e) => setPointInput(Math.max(0, Math.floor(Number(e.target.value.replace(/\D/g, '') || 0))))}
                    style={{ width: '100%', boxSizing: 'border-box', marginTop: 4, background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '8px 10px', color: '#fff', fontSize: 12 }}
                  />
                )}
                {usePoints && <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>최대 {maxPointsUsable.toLocaleString()}P ({maxPointRate}% 한도)</div>}
              </div>

              <div style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: payWithToast ? 8 : 0 }}>
                  <span style={{ fontSize: 12, color: '#fff' }}>
                    🍞 토스트 · 보유 {Math.floor(balance / Math.max(1, toastRate)).toLocaleString()}T · ₩{balance.toLocaleString()}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const next = !payWithToast
                      if (next) setToastDraftWon(null)
                      setPayWithToast(next)
                    }}
                    style={{ width: 36, height: 20, borderRadius: 10, border: 'none', background: payWithToast ? '#7B5EA7' : 'rgba(255,255,255,0.12)', cursor: 'pointer', position: 'relative', transition: 'background 0.2s' }}
                  >
                    <span style={{ position: 'absolute', width: 16, height: 16, borderRadius: '50%', background: '#fff', top: 2, left: payWithToast ? 18 : 2, transition: 'left 0.2s' }} />
                  </button>
                </div>
                {payWithToast && (
                  <div style={{ marginTop: 6 }}>
                    <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 4 }}>사용 금액 (원)</div>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={String(toastDraftWon ?? toastHalfLocal)}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\D/g, '')
                        setToastDraftWon(raw === '' ? 0 : Math.floor(Number(raw)))
                      }}
                      style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '8px 10px', color: '#fff', fontSize: 12 }}
                    />
                    <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>₩{toastUsed.toLocaleString()} 차감 예정</div>
                  </div>
                )}
              </div>

              <div style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: payWithOran ? 8 : 0 }}>
                  <span style={{ fontSize: 12, color: '#fff' }}>💳 오랜페이 · 잔액 ₩{balance.toLocaleString()}</span>
                  <button
                    type="button"
                    onClick={() => {
                      const next = !payWithOran
                      if (next) setOranDraftWon(null)
                      setPayWithOran(next)
                    }}
                    style={{ width: 36, height: 20, borderRadius: 10, border: 'none', background: payWithOran ? '#7B5EA7' : 'rgba(255,255,255,0.12)', cursor: 'pointer', position: 'relative', transition: 'background 0.2s' }}
                  >
                    <span style={{ position: 'absolute', width: 16, height: 16, borderRadius: '50%', background: '#fff', top: 2, left: payWithOran ? 18 : 2, transition: 'left 0.2s' }} />
                  </button>
                </div>
                {payWithOran && (
                  <div style={{ marginTop: 6 }}>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                      <button
                        type="button"
                        onClick={() => setOranDraftWon(null)}
                        style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: oranDraftWon === null ? 'rgba(201,168,110,0.2)' : 'transparent', color: '#fff', fontSize: 11, fontWeight: 800, cursor: 'pointer' }}
                      >
                        전액 사용
                      </button>
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 4 }}>사용 금액 (원)</div>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={String(oranDraftWon ?? oranCapLocal)}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\D/g, '')
                        setOranDraftWon(raw === '' ? 0 : Math.floor(Number(raw)))
                      }}
                      style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '8px 10px', color: '#fff', fontSize: 12 }}
                    />
                    <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>₩{oranUsed.toLocaleString()} 차감 예정</div>
                  </div>
                )}
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: '#fff' }}>🏦 무통장 입금</span>
                  <button
                    type="button"
                    onClick={() => setUseBankTransfer(!useBankTransfer)}
                    style={{
                      width: 36,
                      height: 20,
                      borderRadius: 10,
                      border: 'none',
                      background: useBankTransfer ? '#7B5EA7' : 'rgba(255,255,255,0.12)',
                      cursor: 'pointer',
                      position: 'relative',
                      transition: 'background 0.2s',
                    }}
                  >
                    <span
                      style={{
                        position: 'absolute',
                        width: 16,
                        height: 16,
                        borderRadius: '50%',
                        background: '#fff',
                        top: 2,
                        left: useBankTransfer ? 18 : 2,
                        transition: 'left 0.2s',
                      }}
                    />
                  </button>
                </div>
                {useBankTransfer && (
                  <div
                    style={{
                      marginTop: 10,
                      padding: 10,
                      borderRadius: 10,
                      background: 'rgba(0,0,0,0.2)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      fontSize: 12,
                      color: 'rgba(255,255,255,0.9)',
                      lineHeight: 1.5,
                    }}
                  >
                    <div>계좌번호: 신한은행 110-123-456789 예금주: (주)오랜</div>
                    <div style={{ color: '#ff6b6b', marginTop: 6, fontWeight: 700 }}>입금기한: 24시간 이내</div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, cursor: 'pointer' }}>
                      <input type="checkbox" checked={receiptOn} onChange={(e) => setReceiptOn(e.target.checked)} />
                      <span>현금영수증 신청</span>
                    </label>
                    {receiptOn && (
                      <input
                        type="text"
                        placeholder="현금영수증 번호 (휴대폰/사업자번호)"
                        value={receiptNum}
                        onChange={(e) => setReceiptNum(e.target.value)}
                        style={{
                          width: '100%',
                          marginTop: 8,
                          boxSizing: 'border-box',
                          background: 'rgba(0,0,0,0.25)',
                          border: '1px solid rgba(255,255,255,0.12)',
                          borderRadius: 10,
                          padding: '8px 10px',
                          color: '#fff',
                          fontSize: 12,
                        }}
                      />
                    )}
                  </div>
                )}
              </div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 12, padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, color: '#fff', fontSize: 15, fontWeight: 900 }}>
                <span>최종 결제 필요금액</span>
                <span>₩{needCharge.toLocaleString()}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (useBankTransfer && onPayBankTransfer) void onPayBankTransfer()
                  else onPay(true)
                }}
                disabled={paying}
                style={{ width: '100%', height: 48, borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #C9A96E, #a07840)', color: '#000', fontWeight: 900, fontSize: 16, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                {paying
                  ? '결제 준비 중...'
                  : useBankTransfer
                    ? `무통장 입금하기 · ₩${needCharge.toLocaleString()}`
                    : `결제하기 · ₩${needCharge.toLocaleString()}`}
              </button>
            </div>
          </>
        )}
      </div>
      {chargeSheetOpen && (
        <div onClick={closeChargeSheet} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 130 }}>
          <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', bottom: 0, width: '100%', maxWidth: 480, background: '#11161b', borderTopLeftRadius: 18, borderTopRightRadius: 18, borderTop: '1px solid var(--border)', padding: 14 }}>
            <div style={{ fontSize: 14, color: '#fff', fontWeight: 800, marginBottom: 8 }}>토스트 충전 선택</div>
            {selectedChargeSummary ? (
              <div style={{ fontSize: 12, color: 'var(--gold)', marginBottom: 8, fontWeight: 700 }}>{selectedChargeSummary}</div>
            ) : null}
            <button
              type="button"
              onClick={() => pickChargeAmount('₩30만 (무통장+5% / 카드+2%)', 300_000)}
              style={{ width: '100%', height: 42, borderRadius: 10, border: '1px solid var(--border)', background: 'rgba(255,255,255,0.04)', color: '#fff', fontWeight: 800, marginTop: 8, textAlign: 'left', padding: '0 12px' }}
            >
              ₩30만 (무통장+5% / 카드+2%)
            </button>
            <button
              type="button"
              onClick={() => pickChargeAmount('₩50만', 500_000)}
              style={{ width: '100%', height: 42, borderRadius: 10, border: '1px solid var(--border)', background: 'rgba(255,255,255,0.04)', color: '#fff', fontWeight: 800, marginTop: 8, textAlign: 'left', padding: '0 12px' }}
            >
              ₩50만
            </button>
            <button
              type="button"
              onClick={() => pickChargeAmount('₩100만', 1_000_000)}
              style={{ width: '100%', height: 42, borderRadius: 10, border: '1px solid var(--border)', background: 'rgba(255,255,255,0.04)', color: '#fff', fontWeight: 800, marginTop: 8, textAlign: 'left', padding: '0 12px' }}
            >
              ₩100만
            </button>
            <button
              type="button"
              onClick={() => pickChargeAmount('₩150만', 1_500_000)}
              style={{ width: '100%', height: 42, borderRadius: 10, border: '1px solid var(--border)', background: 'rgba(255,255,255,0.04)', color: '#fff', fontWeight: 800, marginTop: 8, textAlign: 'left', padding: '0 12px' }}
            >
              ₩150만
            </button>
            <button
              type="button"
              onClick={() => pickChargeAmount('₩300만', 3_000_000)}
              style={{ width: '100%', height: 42, borderRadius: 10, border: '1px solid var(--border)', background: 'rgba(255,255,255,0.04)', color: '#fff', fontWeight: 800, marginTop: 8, textAlign: 'left', padding: '0 12px' }}
            >
              ₩300만
            </button>
            <button
              type="button"
              onClick={() => {
                setCustomChargeOpen(true)
                setSelectedChargeSummary('')
              }}
              style={{ width: '100%', height: 42, borderRadius: 10, border: '1px solid var(--border)', background: 'rgba(255,255,255,0.04)', color: '#fff', fontWeight: 800, marginTop: 8, textAlign: 'left', padding: '0 12px' }}
            >
              직접입력
            </button>
            {customChargeOpen && (
              <div style={{ marginTop: 10 }}>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="충전 금액 (원)"
                  value={customChargeInput}
                  onChange={(e) => setCustomChargeInput(e.target.value.replace(/[^\d]/g, ''))}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    height: 40,
                    borderRadius: 10,
                    border: '1px solid rgba(255,255,255,0.12)',
                    background: 'rgba(0,0,0,0.25)',
                    color: '#fff',
                    padding: '0 12px',
                    fontSize: 14,
                    marginBottom: 8,
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    const n = Number(customChargeInput)
                    if (!Number.isFinite(n) || n <= 0) return
                    pickChargeAmount('직접입력', Math.floor(n))
                  }}
                  style={{
                    width: '100%',
                    height: 40,
                    borderRadius: 10,
                    border: 'none',
                    background: 'rgba(201,168,110,0.25)',
                    color: '#fff',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  입력 금액으로 충전
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      {couponSheetOpen && (
        <div onClick={() => setCouponSheetOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 131 }}>
          <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', bottom: 0, width: '100%', maxWidth: 480, maxHeight: '72vh', overflow: 'auto', background: '#11161b', borderTopLeftRadius: 18, borderTopRightRadius: 18, borderTop: '1px solid var(--border)', padding: 14 }}>
            <div style={{ fontSize: 15, color: '#fff', fontWeight: 900, marginBottom: 10 }}>쿠폰 선택</div>
            <button type="button" onClick={() => { setSelectedUserCouponId(null); setCouponSheetOpen(false) }} style={{ width: '100%', padding: 10, marginBottom: 8, borderRadius: 10, border: '1px dashed var(--border)', background: 'transparent', color: 'var(--text3)', fontSize: 12 }}>
              쿠폰 적용 안 함
            </button>
            {userCoupons.map(uc => {
              const c = uc.coupons
              if (!c) return (
                <div key={uc.id} style={{ width: '100%', padding: 12, marginBottom: 8, borderRadius: 12, border: '1px solid var(--border)', background: 'rgba(0,0,0,0.2)', color: 'var(--text3)', fontSize: 12 }}>
                  쿠폰 정보를 불러오지 못했어요.
                </div>
              )
              const expired = isCouponExpiredForUser({ status: uc.status, expired_at: uc.expired_at }, c)
              const applicable = !!authUid && !expired && isCouponApplicableForOrder(c, orderLines, afterGrade, authUid)
              const disc = applicable ? computeCouponDiscount(afterGrade, c, { maxPercent: maxCouponPct }) : 0
              const ok = applicable && disc > 0
              const sel = selectedUserCouponId === uc.id
              const minO = Math.max(0, Number(c.min_order ?? 0))
              const subFail = !expired && afterGrade < minO
              const dt = (c.discount_type || (c.type === 'rate' ? 'rate' : 'amount')) as string
              const dv = c.discount_value != null ? Number(c.discount_value) : dt === 'rate' ? Number(c.discount_rate || 0) : Number(c.discount_amount || 0)
              const discLabel = dt === 'rate' ? `${dv}% 할인` : `₩${dv.toLocaleString()} 할인`
              return (
                <button key={uc.id} type="button" disabled={!ok} onClick={() => { if (!ok) return; setSelectedUserCouponId(uc.id); setCouponSheetOpen(false) }}
                  style={{ width: '100%', textAlign: 'left', padding: 12, marginBottom: 8, borderRadius: 12, border: sel ? '1px solid rgba(201,168,76,0.6)' : '1px solid var(--border)', background: ok ? 'rgba(201,168,76,0.08)' : 'rgba(0,0,0,0.2)', color: ok ? '#fff' : 'rgba(255,255,255,0.35)', cursor: ok ? 'pointer' : 'not-allowed' }}>
                  <div style={{ fontWeight: 900, fontSize: 13 }}>{c.name}</div>
                  <div style={{ fontSize: 12, marginTop: 4, color: ok ? 'var(--gold)' : 'inherit' }}>{discLabel}</div>
                  {!ok && <div style={{ fontSize: 11, marginTop: 6, color: '#888' }}>{expired ? '기간 만료' : subFail ? `최소 주문 ₩${minO.toLocaleString()} 미충족` : '이 상품에 적용 불가'}</div>}
                </button>
              )
            })}
            {userCoupons.length === 0 && <div style={{ fontSize: 12, color: 'var(--text3)' }}>사용 가능한 쿠폰이 없어요.</div>}
          </div>
        </div>
      )}
    </>
  )
}