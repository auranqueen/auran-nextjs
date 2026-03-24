'use client'

import ProductThumbnail from '@/components/ui/ProductThumbnail'
import DashboardBottomNav from '@/components/DashboardBottomNav'
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
  couponDiscount: number
  applicableCheckoutCoupons: CheckoutUcRow[]
  selectedUserCouponId: string | null
  setSelectedUserCouponId: (id: string | null) => void
  maxCouponPct: number
  payWithToast: boolean
  setPayWithToast: (v: boolean) => void
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
  onPay: (allowCharge: boolean) => void
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
  couponDiscount,
  applicableCheckoutCoupons,
  selectedUserCouponId,
  setSelectedUserCouponId,
  maxCouponPct,
  payWithToast,
  setPayWithToast,
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
  onPay,
  onChargeKrw,
}: Props) {
  return (
    <>
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
                      <div style={{ position: 'relative', width: 44, height: 44, borderRadius: 10, overflow: 'hidden', flexShrink: 0, background: 'rgba(0,0,0,0.2)' }}>
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

            <div style={{ marginBottom: 12, padding: 12, borderRadius: 12, border: '1px solid var(--border)', background: 'rgba(255,255,255,0.04)' }}>
              <div style={{ fontSize: 13, fontWeight: 900, color: '#fff', marginBottom: 10 }}>🎟 쿠폰 선택</div>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10, fontSize: 12, color: 'rgba(255,255,255,0.9)', cursor: 'pointer' }}>
                <input type="radio" name="checkout_coupon" checked={selectedUserCouponId === null} onChange={() => setSelectedUserCouponId(null)} />
                <span>쿠폰 적용 안 함</span>
              </label>
              {applicableCheckoutCoupons.map(uc => {
                const c = uc.coupons
                if (!c) return null
                const disc = computeCouponDiscount(subtotal, c, { maxPercent: maxCouponPct })
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

            {!!giftTo && <div style={{ marginBottom: 10, fontSize: 12, color: '#bcd6ff' }}>🎁 선물 주문 · 받는 분 ID: {giftTo}</div>}

            <div style={{ marginBottom: 12, padding: 12, borderRadius: 12, border: '1px solid var(--border)', background: 'rgba(255,255,255,0.04)' }}>
              <div style={{ fontSize: 13, fontWeight: 900, color: '#fff', marginBottom: 10 }}>배송 정보</div>
              <input type="text" placeholder="받는 분 이름" value={recipientName} onChange={e => setRecipientName(e.target.value)} style={{ width: '100%', marginBottom: 8, background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '10px 12px', color: '#fff' }} />
              <input type="tel" placeholder="연락처" value={recipientPhone} onChange={e => setRecipientPhone(e.target.value)} style={{ width: '100%', marginBottom: 8, background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '10px 12px', color: '#fff' }} />
              <textarea placeholder="주소" value={address} onChange={e => setAddress(e.target.value)} rows={2} style={{ width: '100%', background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '10px 12px', color: '#fff', resize: 'none' }} />
            </div>

            <div style={{ marginBottom: 12, padding: 12, borderRadius: 12, border: '1px solid var(--border)', background: 'rgba(255,255,255,0.04)' }}>
              <div style={{ fontSize: 13, fontWeight: 900, color: '#fff', marginBottom: 8 }}>결제 수단</div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontSize: 12, color: '#fff' }}>
                <input type="radio" name="pay" checked={payWithToast} onChange={() => setPayWithToast(true)} />
                🍞 토스트 잔액으로 차감 (가능한 범위까지)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#fff' }}>
                <input type="radio" name="pay" checked={!payWithToast} onChange={() => setPayWithToast(false)} />
                💳 PayApp 카드 (토스트 미사용 · 남은 금액은 카드)
              </label>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 12, padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, color: '#fff', fontSize: 13 }}>
                <span>주문금액</span>
                <span>₩{subtotal.toLocaleString()}</span>
              </div>
              {couponDiscount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, color: '#7eb8ff', fontSize: 13 }}>
                  <span>🎫 쿠폰 할인</span>
                  <span>-₩{couponDiscount.toLocaleString()}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, color: '#4cad7e', fontSize: 13 }}>
                <span>🍞 토스트 사용</span>
                <span>-₩{toastUsed.toLocaleString()}</span>
              </div>
              <div style={{ marginBottom: 8, fontSize: 12, color: 'var(--text3)' }}>
                보유: {Math.floor(balance / Math.max(1, toastRate)).toLocaleString()}T (₩{balance.toLocaleString()})
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, color: '#c9a84c', fontSize: 13 }}>
                <span>✨ 포인트 사용</span>
                <span>-₩{pointUsed.toLocaleString()}</span>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: 12, color: 'var(--text3)' }}>
                <input type="checkbox" checked={usePoints} onChange={e => setUsePoints(e.target.checked)} />
                포인트 사용 (최대 {maxPointRate}%)
              </label>
              {usePoints && (
                <input type="number" min={0} max={maxPointsUsable} value={pointInput} onChange={e => setPointInput(Math.max(0, Math.min(maxPointsUsable, Number(e.target.value || 0))))} style={{ width: '100%', marginBottom: 8, background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '10px 12px', color: '#fff' }} />
              )}
              <div style={{ marginBottom: 8, fontSize: 12, color: 'var(--text3)' }}>
                보유: {points.toLocaleString()}P · 최대 ₩{maxPointsUsable.toLocaleString()}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.08)', color: '#fff', fontSize: 14, fontWeight: 900, marginBottom: 10 }}>
                <span>최종 결제금액</span>
                <span>₩{subtotal.toLocaleString()}</span>
              </div>

              {/* 결제 버튼 */}
              <button
                onClick={() => onPay(true)}
                disabled={paying}
                style={{ width: '100%', height: 48, borderRadius: 10, border: 'none', background: '#C9A96E', color: '#000', fontWeight: 900, fontSize: 16, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                {paying ? '결제 준비 중...' : `결제하기 · ₩${subtotal.toLocaleString()}`}
              </button>
            </div>
            <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text3)' }}>{`🍞 ${Math.floor(balance / Math.max(1, toastRate)).toLocaleString()}T 보유 (1T=${toastRate}원)`}</div>
          </>
        )}
      </div>
      {chargeSheetOpen && (
        <div onClick={() => setChargeSheetOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 130 }}>
          <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', bottom: 0, width: '100%', maxWidth: 480, background: '#11161b', borderTopLeftRadius: 18, borderTopRightRadius: 18, borderTop: '1px solid var(--border)', padding: 14 }}>
            <div style={{ fontSize: 14, color: '#fff', fontWeight: 800, marginBottom: 8 }}>토스트 충전 선택</div>
            {[{ t: 100, p: 10000 }, { t: 300, p: 30000, popular: true }, { t: 500, p: 50000 }, { t: 1000, p: 100000, bonus: 50 }].map(pkg => (
              <button key={pkg.t} type="button" onClick={() => onChargeKrw(pkg.p)} style={{ width: '100%', height: 42, borderRadius: 10, border: '1px solid var(--border)', background: 'rgba(255,255,255,0.04)', color: '#fff', fontWeight: 800, marginTop: 8, textAlign: 'left', padding: '0 12px' }}>
                🍞 {pkg.t.toLocaleString()}T ₩{pkg.p.toLocaleString()} {pkg.popular ? '[인기 🔥]' : ''} {pkg.bonus ? `(+${pkg.bonus}T 보너스)` : ''}
              </button>
            ))}
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
              const applicable = !!authUid && !expired && isCouponApplicableForOrder(c, orderLines, subtotal, authUid)
              const disc = applicable ? computeCouponDiscount(subtotal, c, { maxPercent: maxCouponPct }) : 0
              const ok = applicable && disc > 0
              const sel = selectedUserCouponId === uc.id
              const minO = Math.max(0, Number(c.min_order ?? 0))
              const subFail = !expired && subtotal < minO
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
      <DashboardBottomNav role="customer" />
    </>
  )
}