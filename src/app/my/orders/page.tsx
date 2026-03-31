'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const BG = '#0D0B09'
const GOLD = '#C9A96E'
const CARD_BG = 'rgba(255,255,255,0.03)'
const CARD_BORDER = '1px solid rgba(255,255,255,0.07)'
const TEXT_MUTED = 'rgba(255,255,255,0.55)'

type OrderRow = {
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
}

const tabs = ['전체', '배송중', '배송완료', '취소/환불'] as const

function getTrackingUrl(courier: string, trackingNo: string) {
  if (!trackingNo) return ''
  if (courier.includes('CJ') || courier.includes('대한통운')) return `https://www.cjlogistics.com/ko/tool/parcel/tracking?gnbInvcNo=${encodeURIComponent(trackingNo)}`
  if (courier.includes('한진')) return `https://www.hanjin.com/kor/CMS/DeliveryMgr/WaybillSch.do?mCode=MN038&schLang=KR&wblnumText2=${encodeURIComponent(trackingNo)}`
  if (courier.includes('롯데')) return `https://www.lotteglogis.com/open/tracking?invno=${encodeURIComponent(trackingNo)}`
  if (courier.includes('우체국')) return `https://service.epost.go.kr/trace.RetrieveDomRigiTraceList.comm?sid1=${encodeURIComponent(trackingNo)}`
  if (courier.includes('로젠')) return `https://www.ilogen.com/m/personal/trace/${encodeURIComponent(trackingNo)}`
  return `https://www.cjlogistics.com/ko/tool/parcel/tracking?gnbInvcNo=${encodeURIComponent(trackingNo)}`
}

function getStatusBadge(status: string) {
  if (status.includes('배송중')) return { bg: 'rgba(80,140,255,0.2)', color: '#8ab0ff' }
  if (status.includes('완료')) return { bg: 'rgba(100,200,120,0.2)', color: '#88d59a' }
  if (status.includes('취소') || status.includes('환불')) return { bg: 'rgba(220,100,100,0.2)', color: '#ef9a9a' }
  return { bg: 'rgba(201,169,110,0.15)', color: GOLD }
}

export default function MyOrdersPage() {
  const router = useRouter()
  const supabase = createClient()
  const [tab, setTab] = useState<(typeof tabs)[number]>('전체')
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const run = async () => {
      const { data } = await supabase.auth.getUser()
      const user = data.user
      if (!user) {
        setLoading(false)
        return
      }
      const { data: rows } = await supabase
        .from('orders')
        .select('id, order_no, status, total_amount, final_amount, coupon_discount, point_used, tracking_no, courier, ordered_at, items')
        .eq('customer_id', user.id)
        .order('ordered_at', { ascending: false })
      setOrders((rows as OrderRow[]) || [])
      setLoading(false)
    }
    run()
  }, [supabase])

  const filtered = useMemo(() => {
    if (tab === '전체') return orders
    if (tab === '배송중') return orders.filter((o) => String(o.status || '').includes('배송중'))
    if (tab === '배송완료') return orders.filter((o) => String(o.status || '').includes('완료'))
    return orders.filter((o) => {
      const s = String(o.status || '')
      return s.includes('취소') || s.includes('환불')
    })
  }, [orders, tab])

  return (
    <div style={{ background: BG, minHeight: '100vh', maxWidth: 390, margin: '0 auto', color: '#fff', paddingBottom: 20 }}>
      <header style={{ position: 'sticky', top: 0, zIndex: 20, display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', background: 'rgba(13,11,9,0.96)', borderBottom: CARD_BORDER }}>
        <button onClick={() => router.back()} style={{ border: 'none', background: 'transparent', color: '#fff', fontSize: 18, cursor: 'pointer' }}>←</button>
        <div style={{ fontSize: 16, fontWeight: 600 }}>주문 내역</div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, padding: 16 }}>
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              border: tab === t ? '1px solid #7B5EA7' : CARD_BORDER,
              color: tab === t ? '#bfa2ec' : TEXT_MUTED,
              background: tab === t ? 'rgba(123,94,167,0.16)' : CARD_BG,
              fontSize: 12,
              borderRadius: 10,
              padding: '9px 0',
              cursor: 'pointer',
            }}
          >
            {t}
          </button>
        ))}
      </div>

      <div style={{ padding: '0 16px' }}>
        {loading ? <div style={{ color: TEXT_MUTED, fontSize: 13 }}>불러오는 중...</div> : null}
        {!loading && filtered.length === 0 ? <div style={{ color: TEXT_MUTED, fontSize: 13 }}>주문 내역이 없어요</div> : null}
        {filtered.map((order) => {
          const status = String(order.status || '주문접수')
          const badge = getStatusBadge(status)
          const items = Array.isArray(order.items) ? order.items : []
          const names = items
            .map((it: any) => it?.product_name || it?.name || it?.title)
            .filter(Boolean)
            .slice(0, 3)
          return (
            <div key={order.id} style={{ background: CARD_BG, border: CARD_BORDER, borderRadius: 14, padding: 14, marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontFamily: 'monospace', fontSize: 11, color: TEXT_MUTED }}>{order.order_no || order.id}</span>
                <span style={{ background: badge.bg, color: badge.color, borderRadius: 999, padding: '3px 8px', fontSize: 10 }}>{status}</span>
              </div>
              <div style={{ fontSize: 11, color: TEXT_MUTED, marginBottom: 8 }}>
                주문일: {order.ordered_at ? new Date(order.ordered_at).toLocaleDateString('ko-KR') : '-'}
              </div>
              <div style={{ fontSize: 12, lineHeight: 1.8 }}>
                <div>정가: {(order.total_amount || 0).toLocaleString()}원</div>
                <div>쿠폰할인: -{(order.coupon_discount || 0).toLocaleString()}원</div>
                <div>토스트: -{(order.point_used || 0).toLocaleString()}P</div>
                <div style={{ color: GOLD }}>실결제: {(order.final_amount || 0).toLocaleString()}원</div>
              </div>
              {names.length > 0 ? (
                <div style={{ marginTop: 8, fontSize: 11, color: TEXT_MUTED }}>
                  제품: {names.join(', ')}
                </div>
              ) : null}
              {status.includes('배송중') && order.tracking_no ? (
                <button
                  onClick={() => window.open(getTrackingUrl(String(order.courier || ''), String(order.tracking_no || '')), '_blank', 'noopener,noreferrer')}
                  style={{ marginTop: 10, width: '100%', border: '1px solid #7B5EA7', color: '#bfa2ec', background: 'transparent', borderRadius: 10, padding: '8px 0', fontSize: 12, cursor: 'pointer' }}
                >
                  🚚 배송조회
                </button>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
