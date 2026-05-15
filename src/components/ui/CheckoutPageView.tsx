'use client'

import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import ProductThumbnail from '@/components/ui/ProductThumbnail'
import { createClient } from '@/lib/supabase/client'
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
  addressDetail: string
  setAddressDetail: (v: string) => void
  meId: string
  savedAddresses: any[]
  setSavedAddresses: (rows: any[]) => void
  addressSheetOpen: boolean
  setAddressSheetOpen: (v: boolean) => void
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
  afterCoupon: number
  payWithOran: boolean
  setPayWithOran: (v: boolean) => void
  oranDraftWon: number | null
  setOranDraftWon: (v: number | null) => void
  oranUsed: number
  toastUsed: number
  points: number
  balance: number
  toastRate: number
  needCharge: number
  groupbuyDiscount?: number
  timesaleDiscount?: number
  paying: boolean
  showChargeOption: boolean
  couponSheetOpen: boolean
  setCouponSheetOpen: (v: boolean) => void
  userCoupons: CheckoutUcRow[]
  setUserCoupons?: Dispatch<SetStateAction<CheckoutUcRow[]>>
  authUid: string | null
  orderLines: OrderLineForCoupon[]
  shippingFee?: number
  extraShippingFee?: number
  freeShippingThreshold?: number
  onPay: (allowCharge: boolean) => void
  onPayBankTransfer?: () => void | Promise<void>
  hasTimesaleOrGroupbuy?: boolean
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
  addressDetail,
  setAddressDetail,
  meId,
  savedAddresses,
  setSavedAddresses,
  addressSheetOpen,
  setAddressSheetOpen,
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
  afterCoupon,
  payWithOran,
  setPayWithOran,
  oranDraftWon,
  setOranDraftWon,
  oranUsed,
  toastUsed,
  points,
  balance,
  toastRate,
  needCharge,
  groupbuyDiscount = 0,
  timesaleDiscount = 0,
  paying,
  showChargeOption,
  couponSheetOpen,
  setCouponSheetOpen,
  userCoupons,
  setUserCoupons,
  authUid,
  orderLines,
  shippingFee = 0,
  extraShippingFee = 0,
  freeShippingThreshold = 0,
  onPay,
  onPayBankTransfer,
  hasTimesaleOrGroupbuy,
}: Props) {
  const supabase = createClient()
  const remBalAfterToast = Math.max(0, balance)
  const oranCapLocal = Math.min(remBalAfterToast, Math.max(0, afterCoupon - toastUsed))
  const toastTBalance = points + Math.floor(balance / Math.max(1, toastRate))
  const toastHalfLocal = Math.min(
    Math.floor(toastTBalance * 0.5),
    afterCoupon
  )
  const [useBankTransfer, setUseBankTransfer] = useState(false)
  const [receiptOn, setReceiptOn] = useState(true)
  const [receiptNum, setReceiptNum] = useState('')
  const [newAddressOpen, setNewAddressOpen] = useState(false)
  const [newRecipientName, setNewRecipientName] = useState('')
  const [newRecipientPhone, setNewRecipientPhone] = useState('')
  const [newAddress, setNewAddress] = useState('')
  const [newAddressDetail, setNewAddressDetail] = useState('')
  const [addressSaving, setAddressSaving] = useState(false)
  const [newAddrStep, setNewAddrStep] = useState(1)
  const [newAddressLabel, setNewAddressLabel] = useState('집')
  const [showToastTooltip, setShowToastTooltip] = useState(false)

  useEffect(() => {
    if (!newAddressOpen) {
      setNewAddrStep(1)
      setNewAddressLabel('집')
    }
  }, [newAddressOpen])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if ((window as any).daum?.Postcode) return
    const existing = document.querySelector('script[data-daum-postcode="true"]')
    if (existing) return
    const script = document.createElement('script')
    script.src = 'https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js'
    script.async = true
    script.setAttribute('data-daum-postcode', 'true')
    document.body.appendChild(script)
  }, [])

  const openAddressSearch = (onSelect: (addr: string) => void) => {
    if (!(window as any).daum?.Postcode) return
    new (window as any).daum.Postcode({
      oncomplete: (data: any) => onSelect(String(data?.roadAddress || '')),
    }).open()
  }

  const reloadSavedAddresses = async () => {
    if (!meId) return
    const { data } = await supabase
      .from('shipping_addresses')
      .select('*')
      .eq('user_id', meId)
      .order('is_default', { ascending: false })
    setSavedAddresses(data || [])
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
                const now = new Date()
                const retail = toNum(p.retail_price)
                const sale = toNum(p.sale_price)
                let showPromo = false
                let lineUnit = retail
                if (p.is_timesale && p.timesale_ends_at) {
                  const end = new Date(p.timesale_ends_at)
                  if (end > now) {
                    showPromo = true
                    lineUnit = sale
                  }
                } else if (p.is_groupbuy) {
                  showPromo = true
                  lineUnit = sale
                }
                const lineTotal = lineUnit * lineQty
                const retailLine = retail * lineQty
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
                      <div style={{ color: '#fff', fontSize: 13, fontWeight: 500, minWidth: 0 }}>
                        {p.name} · {lineQty}개
                      </div>
                    </div>
                    <div style={{ color: 'var(--gold)', fontSize: 12, fontWeight: 500, flexShrink: 0, textAlign: 'right' }}>
                      {showPromo && retailLine > lineTotal ? (
                        <span>
                          <span style={{ textDecoration: 'line-through', color: 'rgba(255,255,255,0.45)', marginRight: 6 }}>₩{retailLine.toLocaleString()}</span>
                          ₩{lineTotal.toLocaleString()}
                        </span>
                      ) : (
                        <>₩{lineTotal.toLocaleString()}</>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {!!giftTo && <div style={{ marginBottom: 10, fontSize: 12, color: '#bcd6ff' }}>🎁 선물 주문 · 받는 분 ID: {giftTo}</div>}

            <div style={{ marginBottom: 12, padding: 12, borderRadius: 12, border: '1px solid var(--border)', background: 'rgba(255,255,255,0.04)' }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#fff', marginBottom: 10 }}>배송 정보</div>
              {savedAddresses.length > 0 ? (
                <div style={{ padding: 12, borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(0,0,0,0.2)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>기본 배송지</div>
                    <button type="button" onClick={() => setAddressSheetOpen(true)} style={{ border: 'none', background: 'rgba(123,94,167,0.2)', color: '#d9c7ff', fontSize: 11, borderRadius: 8, padding: '5px 9px', cursor: 'pointer' }}>변경</button>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: '#fff', fontWeight: 500 }}>{recipientName || '-'}</span>
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>· {recipientPhone || '-'}</span>
                    {savedAddresses.some((a) => a.is_default === true && String(a.address || '') === String(address || '')) ? (
                      <span style={{ fontSize: 10, color: '#fff', background: '#7B5EA7', borderRadius: 999, padding: '2px 7px' }}>기본</span>
                    ) : null}
                  </div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', lineHeight: 1.5 }}>{address || '-'}</div>
                  <input
                    type="text"
                    placeholder="상세주소 (동/호수 등) *필수"
                    value={addressDetail}
                    onChange={(e) => setAddressDetail(e.target.value)}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      marginTop: 8,
                      background: 'rgba(0,0,0,0.25)',
                      border: `1px solid ${addressDetail.trim() ? 'rgba(255,255,255,0.12)' : 'rgba(220,80,80,0.6)'}`,
                      borderRadius: 10,
                      padding: '10px 12px',
                      color: '#fff',
                      fontSize: 13,
                    }}
                  />
                  {!addressDetail.trim() && (
                    <div style={{ fontSize: 11, color: 'rgba(220,80,80,0.8)', marginTop: 4 }}>상세주소를 입력해주세요</div>
                  )}
                </div>
              ) : (
                <>
                  <input type="text" placeholder="받는 분 이름" value={recipientName} onChange={e => setRecipientName(e.target.value)} style={{ width: '100%', marginBottom: 8, background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '10px 12px', color: '#fff' }} />
                  <input type="tel" placeholder="연락처" value={recipientPhone} onChange={e => setRecipientPhone(e.target.value)} style={{ width: '100%', marginBottom: 8, background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '10px 12px', color: '#fff' }} />
                  <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <input
                      type="text"
                      readOnly
                      placeholder="주소"
                      value={address}
                      style={{ flex: 1, background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '10px 12px', color: '#fff', fontSize: 13 }}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        openAddressSearch((nextAddress) => {
                          setAddress(nextAddress)
                          setAddressDetail('')
                        })
                      }
                      style={{ width: 56, flexShrink: 0, border: 'none', borderRadius: 10, background: '#7B5EA7', color: '#fff', fontSize: 12, cursor: 'pointer' }}
                    >
                      찾기
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder="상세주소 (동/호수 등)"
                    value={addressDetail}
                    onChange={(e) => setAddressDetail(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '10px 12px', color: '#fff', fontSize: 13 }}
                  />
                </>
              )}
            </div>

            <div style={{ marginBottom: 12, padding: 12, borderRadius: 12, border: '1px solid var(--border)', background: 'rgba(255,255,255,0.04)' }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#fff', marginBottom: 10 }}>금액 확인</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, color: '#fff', fontSize: 13 }}>
                <span>주문금액</span>
                <span>₩{subtotal.toLocaleString()}</span>
              </div>
              {timesaleDiscount > 0 ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, color: '#7ec8e8', fontSize: 13 }}>
                  <span>타임세일 할인</span>
                  <span>-₩{timesaleDiscount.toLocaleString()}</span>
                </div>
              ) : null}
              {groupbuyDiscount > 0 ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, color: '#9ecfff', fontSize: 13 }}>
                  <span>공구 할인</span>
                  <span>-₩{groupbuyDiscount.toLocaleString()}</span>
                </div>
              ) : null}
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
              {hasTimesaleOrGroupbuy && (
                <div style={{ fontSize: 11, color: 'rgba(255,180,100,0.8)', background: 'rgba(255,150,50,0.08)', border: '1px solid rgba(255,150,50,0.2)', borderRadius: 8, padding: '6px 10px', marginBottom: 6 }}>
                  타임세일·공구 상품은 토스트 사용이 불가해요
                </div>
              )}
              {toastUsed > 0 ? (
                <div style={{ marginBottom: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#c4a5f5', fontSize: 13 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>🍞 토스트 할인</span>
                      <button
                        type="button"
                        onClick={() => setShowToastTooltip((v) => !v)}
                        style={{
                          width: 16,
                          height: 16,
                          borderRadius: '50%',
                          border: '1px solid rgba(255,180,50,0.5)',
                          background: 'rgba(255,180,50,0.1)',
                          color: 'rgba(255,200,80,0.9)',
                          fontSize: 10,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        ?
                      </button>
                    </div>
                    <span>-₩{toastUsed.toLocaleString()}</span>
                  </div>
                  {showToastTooltip ? (
                    <div
                      style={{
                        marginTop: 6,
                        background: 'rgba(255,255,255,0.04)',
                        border: '0.5px solid rgba(255,180,50,0.25)',
                        borderRadius: 8,
                        padding: '10px 12px',
                        fontSize: 12,
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          padding: '4px 0',
                          borderBottom: '0.5px solid rgba(255,255,255,0.06)',
                          color: 'rgba(255,255,255,0.6)',
                        }}
                      >
                        <span>보유 토스트</span>
                        <span style={{ color: 'rgba(255,255,255,0.85)' }}>{toastTBalance.toLocaleString()}T</span>
                      </div>
                      {!['LUMIÈRE', 'REINE', 'NOIR', 'CÉLESTE'].includes(gradeName) ? (
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            padding: '4px 0',
                            borderBottom: '0.5px solid rgba(255,255,255,0.06)',
                            color: 'rgba(255,255,255,0.6)',
                          }}
                        >
                          <span>사용 한도 (보유의 50%)</span>
                          <span style={{ color: 'rgba(255,255,255,0.85)' }}>
                            {Math.floor(toastTBalance * 0.5).toLocaleString()}T
                          </span>
                        </div>
                      ) : null}
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', color: 'rgba(255,200,80,0.9)' }}>
                        <span>실제 사용</span>
                        <span>{toastUsed.toLocaleString()}T</span>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
              <div style={{ marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.85)', marginBottom: 8 }}>🎟 쿠폰 선택</div>
                {hasTimesaleOrGroupbuy && (
                  <div style={{ fontSize: 11, color: 'rgba(255,180,100,0.8)', background: 'rgba(255,150,50,0.08)', border: '1px solid rgba(255,150,50,0.2)', borderRadius: 8, padding: '6px 10px', marginBottom: 8 }}>
                    타임세일·공구 상품은 쿠폰 사용이 불가해요
                  </div>
                )}
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10, fontSize: 12, color: 'rgba(255,255,255,0.9)', cursor: 'pointer' }}>
                  <input type="radio" name="checkout_coupon" checked={selectedUserCouponId === null} onChange={() => setSelectedUserCouponId(null)} />
                  <span>쿠폰 적용 안 함</span>
                </label>
                {applicableCheckoutCoupons.map(uc => {
                  const c = uc.coupons
                  if (!c) return null
                  const disc = computeCouponDiscount(afterGrade, c, { maxPercent: maxCouponPct })
                  const minO = Number(c.min_order || 0)
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
                      <span style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: 13, color: '#c4a5f5' }}>
                        <span style={{ fontWeight: 500 }}>{c.name}</span>
                        <span>
                          {disc > 0 ? `-${disc.toLocaleString()}원` : ''}
                          {minO > 0 ? ` · ${minO.toLocaleString()}원 이상 구매시` : ''}
                        </span>
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
                  <div style={{ marginTop: 8, fontSize: 13, fontWeight: 500, color: 'var(--gold)' }}>적용 시 −₩{couponDiscount.toLocaleString()}</div>
                ) : null}
                <button
                  type="button"
                  onClick={() => setCouponSheetOpen(true)}
                  style={{ marginTop: 8, fontSize: 11, color: 'var(--text3)', background: 'none', border: 'none', textDecoration: 'underline', cursor: 'pointer', padding: 0 }}
                >
                  전체 보유 쿠폰 목록
                </button>
              </div>
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
            </div>

            <div style={{ marginBottom: 12, padding: 12, borderRadius: 12, border: '1px solid var(--border)', background: 'rgba(255,255,255,0.04)' }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#fff', marginBottom: 10 }}>결제 수단 <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 400 }}>(중복 사용 가능)</span></div>

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
                        style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: oranDraftWon === null ? 'rgba(201,168,110,0.2)' : 'transparent', color: '#fff', fontSize: 11, fontWeight: 500, cursor: 'pointer' }}
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
                    <div style={{ color: '#ff6b6b', marginTop: 6, fontWeight: 500 }}>입금기한: 24시간 이내</div>
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
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, color: '#fff', fontSize: 15, fontWeight: 500 }}>
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
                style={{ width: '100%', height: 48, borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #C9A96E, #a07840)', color: '#000', fontWeight: 500, fontSize: 16, cursor: 'pointer', fontFamily: 'inherit' }}
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
      {addressSheetOpen && (
        <>
          <div onClick={() => setAddressSheetOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 199, background: 'rgba(0,0,0,0.55)' }} />
          <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, maxHeight: '75vh', overflowY: 'auto', zIndex: 200, background: '#11161b', borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTop: '1px solid var(--border)', padding: 14 }}>
            <div style={{ fontSize: 15, fontWeight: 500, color: '#fff', marginBottom: 10 }}>배송지 선택</div>
            {savedAddresses.map((row) => {
              const lineAddress = String(row.address || '')
              const selected = lineAddress === String(address || '') && String(row.recipient_name || row.name || '') === String(recipientName || '')
              return (
                <label key={row.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, border: selected ? '1px solid rgba(201,168,76,0.6)' : '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: 10, marginBottom: 8, cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="saved_address_pick"
                    checked={selected}
                    onChange={() => {
                      setRecipientName(String(row.recipient_name || row.name || ''))
                      setRecipientPhone(String(row.phone || row.recipient_phone || ''))
                      setAddress(lineAddress)
                      setAddressDetail(String(row.address_detail || row.detail || ''))
                    }}
                  />
                  <span style={{ lineHeight: 1.45 }}>
                    <span style={{ fontWeight: 500, color: '#fff' }}>{row.label || '배송지'}</span>
                    {row.is_default === true ? <span style={{ marginLeft: 6, fontSize: 10, color: '#fff', background: '#7B5EA7', borderRadius: 999, padding: '2px 7px' }}>기본</span> : null}
                    <br />
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.86)' }}>{String(row.recipient_name || row.name || '-')} · {String(row.phone || row.recipient_phone || '-')}</span>
                    <br />
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.72)' }}>{lineAddress || '-'}</span>
                  </span>
                </label>
              )
            })}
            <button
              type="button"
              onClick={() => setNewAddressOpen((v) => !v)}
              style={{ width: '100%', marginTop: 4, marginBottom: 8, border: '1px dashed rgba(255,255,255,0.2)', background: 'transparent', color: 'var(--text3)', borderRadius: 10, padding: '9px 0', cursor: 'pointer' }}
            >
              + 새 배송지 추가
            </button>
            {newAddressOpen && (
              <div style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: 10, marginBottom: 10 }}>
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  <div style={{ flex: 1, textAlign: 'center', fontSize: 11, fontWeight: 500, color: newAddrStep === 1 ? '#fff' : 'rgba(255,255,255,0.45)', padding: '6px 0', borderRadius: 8, background: newAddrStep === 1 ? '#7B5EA7' : 'rgba(255,255,255,0.06)' }}>
                    1. 주소
                  </div>
                  <div style={{ flex: 1, textAlign: 'center', fontSize: 11, fontWeight: 500, color: newAddrStep === 2 ? '#fff' : 'rgba(255,255,255,0.45)', padding: '6px 0', borderRadius: 8, background: newAddrStep === 2 ? '#7B5EA7' : 'rgba(255,255,255,0.06)' }}>
                    2. 받는 분
                  </div>
                </div>
                {newAddrStep === 1 ? (
                  <>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#fff', marginBottom: 10 }}>주소를 입력해주세요</div>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                      <input
                        type="text"
                        readOnly
                        placeholder="주소"
                        value={newAddress}
                        style={{ flex: 1, boxSizing: 'border-box', background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '8px 10px', color: '#fff', fontSize: 12 }}
                      />
                      <button type="button" onClick={() => openAddressSearch((addr) => setNewAddress(addr))} style={{ width: 72, flexShrink: 0, border: 'none', borderRadius: 8, background: '#7B5EA7', color: '#fff', fontSize: 12, cursor: 'pointer' }}>
                        주소찾기
                      </button>
                    </div>
                    <input
                      type="text"
                      placeholder="상세주소"
                      value={newAddressDetail}
                      onChange={(e) => setNewAddressDetail(e.target.value)}
                      style={{ width: '100%', marginBottom: 10, boxSizing: 'border-box', background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '8px 10px', color: '#fff', fontSize: 12 }}
                    />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => {
                          setNewAddressOpen(false)
                          setNewAddrStep(1)
                        }}
                        style={{ flex: 1, border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, background: 'transparent', color: 'rgba(255,255,255,0.85)', fontSize: 12, padding: '8px 0', cursor: 'pointer' }}
                      >
                        취소
                      </button>
                      <button
                        type="button"
                        disabled={!newAddress.trim()}
                        onClick={() => setNewAddrStep(2)}
                        style={{ flex: 1, border: 'none', borderRadius: 8, background: '#7B5EA7', color: '#fff', fontSize: 12, padding: '8px 0', cursor: 'pointer', opacity: !newAddress.trim() ? 0.45 : 1 }}
                      >
                        다음
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#fff', marginBottom: 10 }}>받는 분 정보</div>
                    <div style={{ marginBottom: 10, padding: 10, borderRadius: 8, background: 'rgba(123, 94, 167, 0.35)', border: '1px solid rgba(123, 94, 167, 0.5)', fontSize: 12, color: 'rgba(255,255,255,0.95)', lineHeight: 1.5 }}>
                      {`${newAddress.trim()} ${newAddressDetail.trim()}`.trim() || '-'}
                    </div>
                    <input type="text" placeholder="이름" value={newRecipientName} onChange={(e) => setNewRecipientName(e.target.value)} style={{ width: '100%', marginBottom: 8, boxSizing: 'border-box', background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '8px 10px', color: '#fff', fontSize: 12 }} />
                    <input type="tel" placeholder="전화번호" value={newRecipientPhone} onChange={(e) => setNewRecipientPhone(e.target.value)} style={{ width: '100%', marginBottom: 8, boxSizing: 'border-box', background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '8px 10px', color: '#fff', fontSize: 12 }} />
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginBottom: 6 }}>배송지 이름</div>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                      {(['집', '회사', '기타'] as const).map((chip) => (
                        <button
                          key={chip}
                          type="button"
                          onClick={() => setNewAddressLabel(chip)}
                          style={{
                            flex: 1,
                            border: newAddressLabel === chip ? 'none' : '1px solid rgba(255,255,255,0.15)',
                            borderRadius: 999,
                            background: newAddressLabel === chip ? '#7B5EA7' : 'transparent',
                            color: '#fff',
                            fontSize: 11,
                            fontWeight: 500,
                            padding: '6px 0',
                            cursor: 'pointer',
                          }}
                        >
                          {chip}
                        </button>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="button" onClick={() => setNewAddrStep(1)} style={{ flex: 1, border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, background: 'transparent', color: 'rgba(255,255,255,0.85)', fontSize: 12, padding: '8px 0', cursor: 'pointer' }}>
                        ← 이전
                      </button>
                      <button
                        type="button"
                        disabled={addressSaving || !meId || !newRecipientName.trim() || !newRecipientPhone.trim() || !newAddress.trim()}
                        onClick={async () => {
                          if (!meId) return
                          setAddressSaving(true)
                          const finalAddress = newAddress.trim()
                          const { error } = await supabase.from('shipping_addresses').insert({
                            user_id: meId,
                            recipient_name: newRecipientName.trim(),
                            phone: newRecipientPhone.trim(),
                            address: finalAddress,
                            address_detail: newAddressDetail.trim() || null,
                            label: newAddressLabel,
                            is_default: savedAddresses.length === 0,
                          })
                          setAddressSaving(false)
                          if (error) return
                          await reloadSavedAddresses()
                          setRecipientName(newRecipientName.trim())
                          setRecipientPhone(newRecipientPhone.trim())
                          setAddress(finalAddress)
                          setNewAddressOpen(false)
                          setNewRecipientName('')
                          setNewRecipientPhone('')
                          setNewAddress('')
                          setNewAddressDetail('')
                        }}
                        style={{ flex: 1, border: 'none', borderRadius: 8, background: '#7B5EA7', color: '#fff', fontSize: 12, padding: '8px 0', cursor: 'pointer', opacity: addressSaving ? 0.7 : 1 }}
                      >
                        {addressSaving ? '저장 중...' : '저장하기'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
            <button type="button" onClick={() => setAddressSheetOpen(false)} style={{ width: '100%', border: 'none', borderRadius: 10, background: 'linear-gradient(135deg, #C9A96E, #a07840)', color: '#000', fontWeight: 500, padding: '11px 0', cursor: 'pointer' }}>
              이 주소로 배송
            </button>
          </div>
        </>
      )}
      {couponSheetOpen && (
        <div onClick={() => setCouponSheetOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 131 }}>
          <div onClick={e => e.stopPropagation()} style={{ position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: 0, width: '100%', maxWidth: 480, maxHeight: '72vh', overflow: 'auto', background: '#11161b', borderTopLeftRadius: 18, borderTopRightRadius: 18, borderTop: '1px solid var(--border)', padding: 14 }}>
            <div style={{ fontSize: 15, color: '#fff', fontWeight: 500, marginBottom: 10 }}>쿠폰 선택</div>
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
              const dv = (c.discount_value != null && Number(c.discount_value) !== 0) ? Number(c.discount_value) : dt === 'rate' ? Number(c.discount_rate || 0) : Number(c.discount_amount || 0)
              const discLabel = dt === 'rate' ? `${dv}% 할인` : `₩${dv.toLocaleString()} 할인`
              return (
                <button
                  key={uc.id}
                  type="button"
                  disabled={!ok}
                  onClick={async () => {
                    if (!ok) return
                    let finalId = uc.id
                    if (String(uc.id).startsWith('virtual_')) {
                      const { data: inserted } = await supabase
                        .from('user_coupons')
                        .upsert(
                          {
                            user_id: meId,
                            coupon_id: uc.coupon_id,
                            status: 'unused',
                            issued_at: new Date().toISOString(),
                          },
                          { onConflict: 'user_id,coupon_id' }
                        )
                        .select('id')
                        .maybeSingle()
                      if (inserted?.id) {
                        finalId = inserted.id
                        setUserCoupons?.((prev) =>
                          prev.map((row) =>
                            row.id === uc.id
                              ? {
                                  ...row,
                                  id: inserted.id,
                                }
                              : row
                          )
                        )
                      }
                    }
                    setSelectedUserCouponId(finalId)
                    setCouponSheetOpen(false)
                  }}
                  style={{ width: '100%', textAlign: 'left', padding: 12, marginBottom: 8, borderRadius: 12, border: sel ? '1px solid rgba(201,168,76,0.6)' : '1px solid var(--border)', background: ok ? 'rgba(201,168,76,0.08)' : 'rgba(0,0,0,0.2)', color: ok ? '#fff' : 'rgba(255,255,255,0.35)', cursor: ok ? 'pointer' : 'not-allowed' }}>
                  <div style={{ fontWeight: 500, fontSize: 13 }}>{c.name}</div>
                  <div style={{ fontSize: 12, marginTop: 4, color: ok ? 'var(--gold)' : 'inherit' }}>{discLabel}</div>
                  {!ok && <div style={{ fontSize: 11, marginTop: 6, color: '#888' }}>{expired ? '기간 만료' : subFail ? `₩${minO.toLocaleString()} 이상 구매시 적용` : '이 상품에 적용 불가'}</div>}
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