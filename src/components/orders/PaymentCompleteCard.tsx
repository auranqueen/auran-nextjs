'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type PaymentCompleteCardProps = {
  order: {
    id: string
    order_no: string | null
    status: string | null
    customer_id?: string | null
    total_amount: number | null
    final_amount: number | null
    coupon_discount: number | null
    point_used: number | null
    tracking_no: string | null
    courier: string | null
    ordered_at: string | null
    items: any
    shipping_fee?: number | null
    grade_discount?: number | null
    address?: string | null
    payment_method?: string | null
  }
  points: number
  charge_balance: number
  variant: 'history' | 'notification'
  status?: string | null
  onCancel?: () => void
  onReturn?: () => void
  address?: string | null
  payment_method?: string | null
}

function productNames(items: any): string[] {
  let arr = items
  if (typeof arr === 'string') {
    try {
      arr = JSON.parse(arr)
    } catch {
      return ['상품']
    }
  }
  if (!Array.isArray(arr)) return ['상품']
  return arr.map((i: any) => i.product_name || i.name || i.title || '상품').filter(Boolean)
}

function TrackingButton({
  courier,
  trackingNo,
  fullWidth,
}: {
  courier: string | null
  trackingNo: string | null
  fullWidth?: boolean
}) {
  const no = String(trackingNo || '').trim()
  if (!no) return null
  const url = (() => {
    const c = String(courier || '')
    if (c.includes('CJ') || c.includes('대한통운')) return `https://www.cjlogistics.com/ko/tool/parcel/tracking?gnbInvcNo=${encodeURIComponent(no)}`
    if (c.includes('한진')) return `https://www.hanjin.com/kor/CMS/DeliveryMgr/WaybillSch.do?mCode=MN038&schLang=KR&wblnumText2=${encodeURIComponent(no)}`
    if (c.includes('롯데')) return `https://www.lotteglogis.com/open/tracking?invno=${encodeURIComponent(no)}`
    if (c.includes('우체국')) return `https://service.epost.go.kr/trace.RetrieveDomRigiTraceList.comm?sid1=${encodeURIComponent(no)}`
    if (c.includes('로젠')) return `https://www.ilogen.com/m/personal/trace/${encodeURIComponent(no)}`
    return `https://www.cjlogistics.com/ko/tool/parcel/tracking?gnbInvcNo=${encodeURIComponent(no)}`
  })()
  return (
    <button
      type="button"
      className={`rounded-xl border border-[#7B5EA7]/40 bg-[#7B5EA7]/15 py-2.5 text-xs text-[#c4a7e7] transition hover:bg-[#7B5EA7]/25 ${fullWidth ? 'w-full' : 'px-3'}`}
      style={{ fontWeight: 500 }}
      onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
    >
      배송조회
    </button>
  )
}

export default function PaymentCompleteCard({
  order,
  points,
  charge_balance,
  variant,
  status: statusProp,
  onCancel,
  onReturn,
}: PaymentCompleteCardProps) {
  const supabase = createClient()
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [showReturnModal, setShowReturnModal] = useState(false)
  const names = productNames(order.items)
  const titleText = names.length > 0 ? names.join(', ') : '상품'
  const totalAmount = Number(order.total_amount || 0)
  const finalAmount = Number(order.final_amount || 0)
  const couponDisc = Number(order.coupon_discount || 0)
  const pointUsed = Number(order.point_used || 0)
  const shippingFee = Number(order.shipping_fee || 0)
  const gradeDisc = Number(order.grade_discount || 0)

  const line = (label: string, value: string, valueClass?: string) => (
    <div className="flex justify-between gap-3 text-xs" style={{ fontWeight: 500 }}>
      <span className="text-white/55">{label}</span>
      <span className={valueClass ?? 'text-white/90'}>{value}</span>
    </div>
  )

  const st = String(statusProp ?? order.status ?? '')
  const canShowCancelBtn = st === '주문확인' || st === '발송준비'
  const canShowReturnBtn = st === '배송완료'

  const cancelModal =
    showCancelModal ? (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          minHeight: 200,
          background: 'rgba(0,0,0,0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 20,
          borderRadius: 'inherit',
        }}
      >
        <div
          style={{
            background: '#1a1820',
            borderRadius: 12,
            padding: 20,
            maxWidth: 280,
            width: '100%',
            textAlign: 'center',
            border: '1px solid rgba(123,94,167,0.35)',
          }}
        >
          <div style={{ fontSize: 14, color: '#fff', marginBottom: 16, fontWeight: 500 }}>주문을 취소할까요?</div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button
              type="button"
              onClick={() => setShowCancelModal(false)}
              style={{
                padding: '8px 14px',
                borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.2)',
                background: 'transparent',
                color: 'rgba(255,255,255,0.75)',
                fontSize: 12,
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              닫기
            </button>
            <button
              type="button"
              onClick={() => {
                void (async () => {
                  const { error } = await supabase
                    .from('orders')
                    .update({ status: '취소', request_type: 'cancel' } as any)
                    .eq('id', order.id)
                  if (error) return
                  onCancel?.()
                  setShowCancelModal(false)
                })()
              }}
              style={{
                padding: '8px 14px',
                borderRadius: 10,
                border: 'none',
                background: '#7B5EA7',
                color: '#fff',
                fontSize: 12,
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              취소하기
            </button>
          </div>
        </div>
      </div>
    ) : null

  const returnModal =
    showReturnModal ? (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          minHeight: 200,
          background: 'rgba(0,0,0,0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 20,
          borderRadius: 'inherit',
        }}
      >
        <form
          style={{
            background: '#1a1820',
            borderRadius: 12,
            padding: 16,
            maxWidth: 320,
            width: '100%',
            border: '1px solid rgba(123,94,167,0.35)',
          }}
          onSubmit={(e) => {
            e.preventDefault()
            void (async () => {
              const fd = new FormData(e.currentTarget)
              const kind = String(fd.get('return_kind') || 'return') === 'exchange' ? 'exchange' : 'return'
              const reason = String(fd.get('return_reason') || '').trim()
              const memo = String(fd.get('return_memo') || '').trim().slice(0, 100)
              const reasonLabel =
                reason === 'change_mind'
                  ? '단순변심'
                  : reason === 'defect'
                    ? '상품불량'
                    : reason === 'wrong_ship'
                      ? '오배송'
                      : reason === 'etc'
                        ? '기타'
                        : ''
              const return_reason = [reasonLabel, memo].filter(Boolean).join(' · ')
              const { error: upErr } = await supabase
                .from('orders')
                .update({
                  status: '반품요청',
                  request_type: kind,
                  return_reason,
                } as any)
                .eq('id', order.id)
              if (upErr) return
              const cid = order.customer_id
              if (cid) {
                const { data: channelRow } = await supabase
                  .from('chat_channels')
                  .select('id')
                  .eq('user_id', cid)
                  .eq('channel_type', 'owner')
                  .maybeSingle()
                if (channelRow?.id) {
                  await supabase.from('consultation_messages').insert({
                    channel_id: channelRow.id,
                    user_id: cid,
                    message_kind: 'order_return',
                    content: `${kind === 'exchange' ? '교환' : '반품'} 신청 · ${reasonLabel || reason || '-'}`,
                    order_id: order.id,
                    is_from_customer: true,
                  } as any)
                }
              }
              onReturn?.()
              setShowReturnModal(false)
            })()
          }}
        >
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <label style={{ flex: 1, cursor: 'pointer' }}>
              <input type="radio" name="return_kind" value="exchange" defaultChecked style={{ marginRight: 6 }} />
              <span style={{ fontSize: 12, color: '#e8dff5', fontWeight: 500 }}>교환</span>
            </label>
            <label style={{ flex: 1, cursor: 'pointer' }}>
              <input type="radio" name="return_kind" value="return" style={{ marginRight: 6 }} />
              <span style={{ fontSize: 12, color: '#e8dff5', fontWeight: 500 }}>반품</span>
            </label>
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 6, fontWeight: 500 }}>사유</div>
          <select
            name="return_reason"
            required
            style={{
              width: '100%',
              marginBottom: 10,
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(0,0,0,0.25)',
              color: '#fff',
              fontSize: 12,
              padding: '8px 10px',
              fontWeight: 500,
            }}
            defaultValue=""
          >
            <option value="" disabled>
              선택
            </option>
            <option value="change_mind">단순변심</option>
            <option value="defect">상품불량</option>
            <option value="wrong_ship">오배송</option>
            <option value="etc">기타</option>
          </select>
          <textarea
            name="return_memo"
            maxLength={100}
            rows={3}
            placeholder="메모 (선택, 최대 100자)"
            style={{
              width: '100%',
              boxSizing: 'border-box',
              marginBottom: 12,
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(0,0,0,0.25)',
              color: '#fff',
              fontSize: 12,
              padding: '8px 10px',
              resize: 'none',
              fontWeight: 500,
            }}
          />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => setShowReturnModal(false)}
              style={{
                padding: '8px 14px',
                borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.2)',
                background: 'transparent',
                color: 'rgba(255,255,255,0.75)',
                fontSize: 12,
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              닫기
            </button>
            <button
              type="submit"
              style={{
                padding: '8px 14px',
                borderRadius: 10,
                border: 'none',
                background: '#7B5EA7',
                color: '#fff',
                fontSize: 12,
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              신청하기
            </button>
          </div>
        </form>
      </div>
    ) : null

  if (variant === 'notification') {
    return (
      <>
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0D0B09] text-white">
          <div className="space-y-3 p-4">
            <div className="text-sm text-white/90" style={{ fontWeight: 500 }}>
              {titleText}
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs text-white/50" style={{ fontWeight: 500 }}>
                최종 결제
              </span>
              <span className="text-base text-[#7B5EA7]" style={{ fontWeight: 500 }}>
                {finalAmount.toLocaleString()}원
              </span>
            </div>
            <div className="rounded-xl border border-[#7B5EA7]/25 bg-[#7B5EA7]/10 px-3 py-2 text-xs text-[#7B5EA7]" style={{ fontWeight: 500 }}>
              🍞 배송완료 후 토스트가 적립돼요
            </div>
            <div className="flex gap-2">
              {canShowCancelBtn ? (
                <button
                  type="button"
                  className="flex-1 rounded-xl border border-white/15 bg-white/5 py-2.5 text-xs text-white/80 transition hover:bg-white/10"
                  style={{ fontWeight: 500 }}
                  onClick={() => setShowCancelModal(true)}
                >
                  주문취소
                </button>
              ) : null}
              {String(order.tracking_no || '').trim() ? (
                <div className="min-w-0 flex-1">
                  <TrackingButton courier={order.courier} trackingNo={order.tracking_no} fullWidth />
                </div>
              ) : (
                <button
                  type="button"
                  disabled
                  className="flex-1 rounded-xl border border-white/10 bg-transparent py-2.5 text-xs text-white/35"
                  style={{ fontWeight: 500 }}
                >
                  배송조회
                </button>
              )}
            </div>
          </div>
          {cancelModal}
          {returnModal}
        </div>
      </>
    )
  }

  return (
    <>
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0D0B09] text-white">
      <div className="px-4 py-3 text-sm text-white" style={{ backgroundColor: '#7B5EA7', fontWeight: 500 }}>
        주문 {order.order_no || order.id}
      </div>
      <div className="space-y-4 p-4">
        <div>
          <div className="mb-2 text-xs text-white/45" style={{ fontWeight: 500 }}>
            상품
          </div>
          <div className="text-sm text-white/90" style={{ fontWeight: 500 }}>
            {names.length > 0 ? (
              names.map((n, i) => <div key={i}>{n}</div>)
            ) : (
              <div>상품</div>
            )}
          </div>
          {order.ordered_at ? (
            <div className="mt-1 text-[11px] text-white/40" style={{ fontWeight: 500 }}>
              {new Date(order.ordered_at).toLocaleString('ko-KR')}
            </div>
          ) : null}
        </div>

        <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <div className="text-xs text-white/55" style={{ fontWeight: 500 }}>
            결제내역
          </div>
          <div className="space-y-1.5">
            {totalAmount > 0 ? line('상품금액', `${totalAmount.toLocaleString()}원`) : null}
            {shippingFee > 0 ? line('배송비', `${shippingFee.toLocaleString()}원`) : null}
            {gradeDisc > 0 ? line('등급할인', `-${gradeDisc.toLocaleString()}원`, 'text-[#534AB7]') : null}
            {couponDisc > 0 ? line('쿠폰할인', `-${couponDisc.toLocaleString()}원`, 'text-[#534AB7]') : null}
            {pointUsed > 0 ? line('토스트사용', `-${pointUsed.toLocaleString()}P`, 'text-[#7B5EA7]') : null}
            {finalAmount > 0 ? line('최종결제금액', `${finalAmount.toLocaleString()}원`, 'text-[#7B5EA7]') : null}
          </div>
        </div>

        <div className="rounded-xl border border-[#7B5EA7]/20 bg-[#7B5EA7]/10 px-3 py-2 text-xs text-white/80" style={{ fontWeight: 500 }}>
          배송이 완료되면 토스트가 자동으로 적립돼요.
        </div>

        <div className="flex flex-wrap gap-2">
          <span
            className="inline-flex items-center rounded-full border border-[#7B5EA7]/35 bg-[#7B5EA7]/15 px-3 py-1 text-xs text-[#7B5EA7]"
            style={{ fontWeight: 500 }}
          >
            🍞 토스트 {Number(points || 0).toLocaleString()}T
          </span>
          <span
            className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80"
            style={{ fontWeight: 500 }}
          >
            AURAN PAY {Number(charge_balance || 0).toLocaleString()}원
          </span>
        </div>

        <div className="space-y-1 text-xs text-white/55" style={{ fontWeight: 500 }}>
          <div className="flex justify-between gap-2">
            <span className="text-white/45">배송지</span>
            <span className="text-right text-white/70">{order.address || '—'}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-white/45">결제수단</span>
            <span className="text-right text-white/70">
              {(() => {
                const m = String(order.payment_method || '')
                if (m === '1') return '신용카드'
                if (m === '2') return '계좌이체'
                if (m === '3') return '가상계좌'
                if (m === '4') return '휴대폰'
                return m || '—'
              })()}
            </span>
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          {canShowReturnBtn ? (
            <button
              type="button"
              className="flex-1 rounded-xl border border-white/15 bg-white/5 py-2.5 text-xs text-white/85 transition hover:bg-white/10"
              style={{ fontWeight: 500 }}
              onClick={() => setShowReturnModal(true)}
            >
              교환·반품
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => {
              const arr = typeof order.items === 'string' ? JSON.parse(order.items) : order.items
              const productId = arr?.[0]?.product_id
              if (productId) window.location.href = `/products/${productId}`
            }}
            className="flex-1 rounded-xl border border-[#7B5EA7]/40 bg-[#7B5EA7]/20 py-2.5 text-xs text-[#e8d5ff] transition hover:bg-[#7B5EA7]/30"
            style={{ fontWeight: 500 }}
          >
            재구매
          </button>
        </div>
        {cancelModal}
        {returnModal}
      </div>
      </div>
    </>
  )
}
