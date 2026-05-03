'use client'

type PaymentCompleteCardProps = {
  order: {
    id: string
    order_no: string | null
    status: string | null
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
  }
  points: number
  charge_balance: number
  variant: 'history' | 'notification'
}

function productNames(items: any): string[] {
  const arr = Array.isArray(items) ? items : []
  return arr
    .map((it: any) => String(it?.product_name || it?.name || it?.title || '').trim())
    .filter(Boolean)
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

export default function PaymentCompleteCard({ order, points, charge_balance, variant }: PaymentCompleteCardProps) {
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

  if (variant === 'notification') {
    return (
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0D0B09] text-white">
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
            <button
              type="button"
              className="flex-1 rounded-xl border border-white/15 bg-white/5 py-2.5 text-xs text-white/80 transition hover:bg-white/10"
              style={{ fontWeight: 500 }}
            >
              주문취소
            </button>
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
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0D0B09] text-white">
      <div className="px-4 py-3 text-sm text-white" style={{ backgroundColor: '#7B5EA7', fontWeight: 500 }}>
        주문 {order.order_no || order.id}
      </div>
      <div className="space-y-4 p-4">
        <div>
          <div className="mb-2 text-xs text-white/45" style={{ fontWeight: 500 }}>
            상품
          </div>
          <div className="text-sm text-white/90" style={{ fontWeight: 500 }}>
            {titleText}
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
            <span className="text-right text-white/70">—</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-white/45">결제수단</span>
            <span className="text-right text-white/70">—</span>
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            className="flex-1 rounded-xl border border-white/15 bg-white/5 py-2.5 text-xs text-white/85 transition hover:bg-white/10"
            style={{ fontWeight: 500 }}
          >
            교환·반품
          </button>
          <button
            type="button"
            className="flex-1 rounded-xl border border-[#7B5EA7]/40 bg-[#7B5EA7]/20 py-2.5 text-xs text-[#e8d5ff] transition hover:bg-[#7B5EA7]/30"
            style={{ fontWeight: 500 }}
          >
            재구매
          </button>
        </div>
      </div>
    </div>
  )
}
