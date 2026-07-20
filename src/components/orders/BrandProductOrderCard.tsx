'use client'
const BORDER = 'rgba(255,255,255,0.08)'
const PURPLE = '#7B5EA7'
const GOLD = '#C9A96E'
const TEXT_SUB = 'rgba(255,255,255,0.55)'
const STATUS_LABEL: Record<string, { label: string; bg: string; color: string }> = {
  '결제완료': { label: '결제완료', bg: 'rgba(239,159,39,0.15)', color: '#EF9F27' },
  '배송중': { label: '배송중', bg: 'rgba(55,138,221,0.15)', color: '#7FB2E8' },
  '배송완료': { label: '배송완료', bg: 'rgba(123,94,167,0.15)', color: '#C9BEDD' },
  '구매확정': { label: '구매확정', bg: 'rgba(99,153,34,0.15)', color: '#97C459' },
}
function getTrackingUrl(courier: string, trackingNo: string) {
  if (!trackingNo) return ''
  if (courier.includes('CJ') || courier.includes('대한통운')) return `https://www.cjlogistics.com/ko/tool/parcel/tracking?gnbInvcNo=${encodeURIComponent(trackingNo)}`
  if (courier.includes('한진')) return `https://www.hanjin.com/kor/CMS/DeliveryMgr/WaybillSch.do?mCode=MN038&schLang=KR&wblnumText2=${encodeURIComponent(trackingNo)}`
  if (courier.includes('롯데')) return `https://www.lotteglogis.com/open/tracking?invno=${encodeURIComponent(trackingNo)}`
  if (courier.includes('우체국')) return `https://service.epost.go.kr/trace.RetrieveDomRigiTraceList.comm?sid1=${encodeURIComponent(trackingNo)}`
  if (courier.includes('로젠')) return `https://www.ilogen.com/m/personal/trace/${encodeURIComponent(trackingNo)}`
  return `https://www.cjlogistics.com/ko/tool/parcel/tracking?gnbInvcNo=${encodeURIComponent(trackingNo)}`
}
interface Props {
  order: {
    id: string
    order_no: string
    status: string
    final_amount: number
    courier: string | null
    tracking_no: string | null
    ordered_at: string
    items: { product_name: string; quantity: number }[]
  }
  onConfirm: (orderId: string) => void
  confirming: boolean
}
export default function BrandProductOrderCard({ order, onConfirm, confirming }: Props) {
  const statusInfo = STATUS_LABEL[order.status] || { label: order.status, bg: 'rgba(255,255,255,0.08)', color: '#fff' }
  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', border: `0.5px solid ${BORDER}`, borderRadius: 12, padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 11, background: statusInfo.bg, color: statusInfo.color, padding: '3px 10px', borderRadius: 6 }}>{statusInfo.label}</span>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{new Date(order.ordered_at).toLocaleDateString('ko-KR')}</span>
      </div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
        <div style={{ width: 44, height: 44, borderRadius: 8, background: 'rgba(123,94,167,0.15)', flexShrink: 0 }} />
        <div>
          <div style={{ fontSize: 13, color: '#fff' }}>{order.items.map(i => i.product_name).join(', ')}</div>
          <div style={{ fontSize: 12, color: TEXT_SUB, marginTop: 2 }}>{order.final_amount.toLocaleString()}원</div>
        </div>
      </div>
      {order.status === '결제완료' && (
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>배송 준비중이에요</div>
      )}
      {order.status === '배송중' && (
        <a
          href={getTrackingUrl(order.courier || '', order.tracking_no || '')}
          target="_blank"
          rel="noreferrer"
          style={{ display: 'block', textAlign: 'center', border: `0.5px solid ${BORDER}`, color: GOLD, borderRadius: 8, padding: 9, fontSize: 12, textDecoration: 'none' }}
        >
          배송조회
        </a>
      )}
      {order.status === '배송완료' && (
        <>
          <div style={{ display: 'flex', gap: 8 }}>
            <a
              href={getTrackingUrl(order.courier || '', order.tracking_no || '')}
              target="_blank"
              rel="noreferrer"
              style={{ flex: 1, textAlign: 'center', border: `0.5px solid ${BORDER}`, color: GOLD, borderRadius: 8, padding: 9, fontSize: 12, textDecoration: 'none' }}
            >
              배송조회
            </a>
            <button
              onClick={() => onConfirm(order.id)}
              disabled={confirming}
              style={{ flex: 1, border: 'none', background: PURPLE, color: '#fff', borderRadius: 8, padding: 9, fontSize: 12 }}
            >
              구매확정
            </button>
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 8 }}>
            14일 후 자동으로 구매확정돼요 · 리뷰를 쓰면 바로 확정돼요
          </div>
        </>
      )}
    </div>
  )
}
