'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { confirmOrderById } from '@/lib/orders/confirmOrder'

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
  delivered_at?: string | null
  confirmed_at?: string | null
  auto_confirm_at?: string | null
  referrer_user_id?: string | null
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
  const [toast, setToast] = useState('')
  const [autoConfirmDays, setAutoConfirmDays] = useState(7)
  const [reviewPromptOrderId, setReviewPromptOrderId] = useState('')

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 2200)
    return () => clearTimeout(t)
  }, [toast])

  useEffect(() => {
    const run = async () => {
      const { data } = await supabase.auth.getUser()
      const user = data.user
      if (!user) {
        setLoading(false)
        return
      }
      const { data: autoRow } = await supabase.from('admin_settings').select('value').eq('category', 'order').eq('key', 'auto_confirm_days').maybeSingle()
      setAutoConfirmDays(Math.max(1, Math.floor(Number((autoRow as { value?: string } | null)?.value ?? 7))))
      const { data: rows } = await supabase
        .from('orders')
        .select('id, order_no, status, total_amount, final_amount, coupon_discount, point_used, tracking_no, courier, ordered_at, delivered_at, confirmed_at, auto_confirm_at, referrer_user_id, items')
        .eq('customer_id', user.id)
        .order('ordered_at', { ascending: false })
      const nextRows = (rows as OrderRow[]) || []
      setOrders(nextRows)

      const { data: me } = await supabase.from('users').select('id').eq('auth_id', user.id).maybeSingle()
      if (me?.id) {
        for (const o of nextRows) {
          if (!String(o.status || '').includes('배송완료')) continue
          const base = new Date(o.delivered_at || o.ordered_at || '').getTime()
          if (!base) continue
          const day = Math.floor((Date.now() - base) / 86400000)
          const key = `order:${o.id}`
          const entries =
            day >= 6
              ? [{ t: '내일 자동확정 돼요 ⏰', b: `${key} 지금 확정하고 토스트 받아요` }]
              : day >= 3
                ? [{ t: '구매확정 잊지 마세요 🥺', b: `${key} D-4 남았어요! 확정하면 토스트 드려요` }]
                : day >= 1
                  ? [{ t: '📦 상품 잘 받으셨나요?', b: `${key} 구매확정하면 토스트 적립돼요 💜` }]
                  : []
          for (const e of entries) {
            const { data: exists } = await supabase.from('notifications').select('id').eq('user_id', me.id).eq('title', e.t).eq('body', e.b).limit(1)
            if (!exists || exists.length === 0) {
              await supabase.from('notifications').insert({ user_id: me.id, type: 'promo', title: e.t, body: e.b, icon: '📦', is_read: false } as any)
            }
          }
        }
      }
      setLoading(false)
    }
    run()
  }, [supabase])

  const confirmOrder = async (orderId: string) => {
    const res = await confirmOrderById(supabase as any, orderId)
    if (!res.ok) return
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? {
              ...o,
              status: '구매확정',
              confirmed_at: new Date().toISOString(),
            }
          : o
      )
    )
    setToast('구매확정 완료! 토스트 적립됐어요 ✨')
    setReviewPromptOrderId(orderId)
  }

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
              {status.includes('배송완료') ? (
                <div style={{ marginTop: 10 }}>
                  <button
                    type="button"
                    onClick={() => void confirmOrder(order.id)}
                    style={{ width: '100%', border: 'none', background: '#7B5EA7', color: '#fff', borderRadius: 12, padding: 10, fontSize: 12, cursor: 'pointer', fontWeight: 600 }}
                  >
                    구매확정하기 💜
                  </button>
                  <div style={{ marginTop: 6, fontSize: 10, color: 'rgba(255,255,255,0.4)', whiteSpace: 'pre-line' as const }}>
                    {`확정하면 토스트 적립돼요 ✨\n${(() => {
                      const base = new Date(order.delivered_at || order.ordered_at || '').getTime()
                      const remain = Math.max(0, autoConfirmDays - Math.floor((Date.now() - base) / 86400000))
                      return `D-${remain}일 후 자동확정`
                    })()}`}
                  </div>
                </div>
              ) : null}
              {reviewPromptOrderId === order.id ? (
                <div style={{ marginTop: 10, background: 'rgba(123,94,167,0.12)', border: '1px solid rgba(123,94,167,0.3)', borderRadius: 10, padding: '10px 12px' }}>
                  <div style={{ fontSize: 11, color: '#c4a7e7', marginBottom: 8 }}>리뷰 작성하면 +50T 추가 적립!</div>
                  <button type="button" onClick={() => router.push('/my/reviews/new')} style={{ border: 'none', background: '#7B5EA7', color: '#fff', borderRadius: 8, padding: '6px 10px', fontSize: 11, cursor: 'pointer' }}>
                    리뷰 쓰기
                  </button>
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
      {toast ? (
        <div style={{ position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: 24, background: 'rgba(123,94,167,0.95)', color: '#fff', borderRadius: 10, padding: '10px 14px', fontSize: 12, zIndex: 60 }}>
          {toast}
        </div>
      ) : null}
    </div>
  )
}
