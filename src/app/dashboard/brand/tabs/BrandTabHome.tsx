'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { CSSProperties } from 'react'
const CARD: CSSProperties = { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: 12, marginBottom: 10 }
const PURPLE = '#7B5EA7'
const GOLD = '#C9A96E'
const TEXT = 'rgba(255,255,255,0.65)'
const SUB = 'rgba(255,255,255,0.3)'
interface Props {
  brandName: string
  brandId: string | null
  activeBrandId: string | null
  onTabChange: (tab: string) => void
}
export default function BrandTabHome({ brandName, brandId, activeBrandId, onTabChange }: Props) {
  const supabase = createClient()
  const [ownerCount, setOwnerCount] = useState<number | null>(null)
  const [productCount, setProductCount] = useState<number | null>(null)
  const [activeCount, setActiveCount] = useState<number | null>(null)
  const [topProducts, setTopProducts] = useState<Array<{ name: string; status: string }>>([])
  const [loading, setLoading] = useState(true)
  const [expiringLots, setExpiringLots] = useState<Array<{ product_name: string; lot_number: string; days: number; remaining_qty: number }>>([])
  const [recentTalks, setRecentTalks] = useState<Array<{ owner_name: string; preview: string; unread: boolean; updated_at: string }>>([])
  const [recentOrders, setRecentOrders] = useState<Array<{ order_no: string; product_name: string; amount: number; status: string }>>([])
  const [sampleRequests, setSampleRequests] = useState<Array<{ owner_name: string; product_name: string; status: string }>>([])
  const [monthSales, setMonthSales] = useState<number>(0)
  const [closedEvents, setClosedEvents] = useState<string[]>([])
  const [pendingOrders, setPendingOrders] = useState<number>(0)
  useEffect(() => {
    if (!brandId) return
    const fetch = async () => {
      setLoading(true)
      // 제품 수 집계
      const [{ count: total }, { count: active }] = await Promise.all([
        supabase.from('products').select('id', { count: 'exact', head: true }).eq('brand_id', brandId).is('deleted_at', null),
        supabase.from('products').select('id', { count: 'exact', head: true }).eq('brand_id', brandId).eq('status', 'active').is('deleted_at', null),
      ])
      setProductCount(total ?? 0)
      setActiveCount(active ?? 0)
      // TOP 제품 (최근 active 5개)
      const { data: prods } = await supabase
        .from('products')
        .select('name, status')
        .eq('brand_id', brandId)
        .eq('status', 'active')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(5)
      setTopProducts(prods || [])
      // 연결 원장님 수 (profiles.trade_brands에 brandName 포함)
      const { data: profiles } = await supabase
        .from('profiles')
        .select('trade_brands, preferred_brands')
      if (profiles) {
          const cnt = profiles.filter((p: any) => {
            const brands = Array.isArray(p.trade_brands) && p.trade_brands.length > 0
              ? p.trade_brands
              : (Array.isArray(p.preferred_brands) ? p.preferred_brands : [])
            return brands.some((b: string) => b === brandName)
          }).length
        setOwnerCount(cnt)
      }
      const { data: lotData } = await supabase
        .from('brand_inventory_lots')
        .select('lot_number, remaining_qty, expires_at, brand_inventory(product_name)')
        .eq('brand_id', brandId)
        .eq('status', 'active')
        .not('expires_at', 'is', null)
        .order('expires_at', { ascending: true })
      if (lotData) {
        const now2 = Date.now()
        setExpiringLots((lotData as any[])
          .map(l => ({
            product_name: (l.brand_inventory as any)?.product_name || '',
            lot_number: l.lot_number,
            remaining_qty: l.remaining_qty,
            days: Math.floor((new Date(l.expires_at).getTime() - now2) / 86400000),
          }))
          .filter(l => l.days <= 330))
      }
      // 오렌상담톡 최근 3건
      const { data: talks } = await supabase
        .from('chat_channels')
        .select('id, last_message, last_message_at, unread_count, owner_id, users!owner_id(name)')
        .eq('channel_type', 'owner')
        .not('last_message', 'is', null)
        .order('last_message_at', { ascending: false })
        .limit(3)
      if (talks) {
        setRecentTalks(talks.map((t: any) => ({
          owner_name: t.users?.name || '원장님',
          preview: t.last_message || '',
          unread: (t.unread_count || 0) > 0,
          updated_at: t.last_message_at || '',
        })))
      }
      // 최근 주문 4건
      const { data: orders } = await supabase
        .from('brand_orders')
        .select('id, product_name, total_amount, status, created_at')
        .eq('brand_id', brandId)
        .order('created_at', { ascending: false })
        .limit(4)
      if (orders) {
        setRecentOrders(orders.map((o: any) => ({
          order_no: `#${String(o.id).slice(0, 8).toUpperCase()}`,
          product_name: o.product_name || '-',
          amount: o.total_amount || 0,
          status: o.status || 'pending',
        })))
        setPendingOrders(orders.filter((o: any) => o.status === 'pending').length)
      }
      // 샘플 발송 최근 4건
      const { data: samples } = await supabase
        .from('brand_samples')
        .select('owner_name, product_name, status')
        .eq('brand_id', brandId)
        .order('created_at', { ascending: false })
        .limit(4)
      if (samples) setSampleRequests(samples as any[])
      // 이달 판매액 (orders 테이블)
      const thisMonth = new Date(); thisMonth.setDate(1); thisMonth.setHours(0, 0, 0, 0)
      const { data: salesData } = await supabase
        .from('orders')
        .select('final_price')
        .gte('created_at', thisMonth.toISOString())
        .in('status', ['paid', 'shipped', 'delivered'])
      if (salesData) setMonthSales(salesData.reduce((sum: number, o: any) => sum + (o.final_price || 0), 0))
      setLoading(false)
    }
    void fetch()
  }, [brandId, brandName])
  const kpis = [
    { label: '이달 판매액', value: loading ? '-' : `₩${(monthSales / 10000).toFixed(0)}만`, color: '#fff' },
    { label: '처리대기 주문', value: loading ? '-' : `${pendingOrders}`, color: pendingOrders > 0 ? '#e8a500' : '#fff' },
    { label: '임박재고 D-30', value: loading ? '-' : `${expiringLots.filter(l => l.days <= 30).length}`, color: expiringLots.filter(l => l.days <= 30).length > 0 ? '#e85555' : '#fff' },
    { label: '활성 원장님', value: loading ? '-' : `${ownerCount ?? 0}명`, color: PURPLE },
    { label: '등록 제품', value: loading ? '-' : `${productCount ?? 0}개`, color: GOLD },
  ]
  const alerts = [
    ...(productCount === 0 ? [{ text: '제품을 등록하고 원장님과 연결을 시작해보세요', action: '제품 등록', tab: 'products' }] : []),
    ...(ownerCount === 0 ? [{ text: '원장님 네트워크를 설정하세요', action: '원장님 관리', tab: 'owners' }] : []),
    ...(productCount !== null && productCount > 0 && ownerCount !== null && ownerCount > 0 ? [{ text: '발주 프로모션을 설정해보세요', action: '발주 설정', tab: 'orders' }] : []),
  ]
  return (
    <div>
      {expiringLots.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: '#FF8C00', marginBottom: 6 }}>🟠 소진 관리 필요 재고 {expiringLots.length}건</div>
          {expiringLots.slice(0, 3).map((lot, i) => (
            <div key={i} onClick={() => onTabChange('inventory')}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: lot.days <= 30 ? 'rgba(229,57,53,0.08)' : lot.days <= 90 ? 'rgba(255,107,53,0.08)' : lot.days <= 180 ? 'rgba(201,169,110,0.08)' : 'rgba(255,140,0,0.08)', border: `0.5px solid ${lot.days <= 30 ? 'rgba(229,57,53,0.3)' : lot.days <= 90 ? 'rgba(255,107,53,0.3)' : lot.days <= 180 ? 'rgba(201,169,110,0.3)' : 'rgba(255,140,0,0.3)'}`, borderRadius: 8, marginBottom: 5, cursor: 'pointer' }}>
              <span style={{ fontSize: 13 }}>{lot.days <= 30 ? '🚨' : lot.days <= 90 ? '🔴' : lot.days <= 180 ? '🟡' : '🟠'}</span>
              <span style={{ fontSize: 12, color: lot.days <= 30 ? '#E53935' : lot.days <= 90 ? '#FF6B35' : lot.days <= 180 ? '#C9A96E' : '#FF8C00', flex: 1, minWidth: 0 }}>{lot.product_name} · 잔여 {lot.remaining_qty.toLocaleString()}개</span>
              <span style={{ fontSize: 11, color: lot.days <= 30 ? '#E53935' : lot.days <= 90 ? '#FF6B35' : lot.days <= 180 ? '#C9A96E' : '#FF8C00', flexShrink: 0 }}>D-{lot.days}</span>
            </div>
          ))}
          <button type="button" onClick={() => onTabChange('inventory')}
            style={{ width: '100%', padding: '7px', borderRadius: 7, border: '1px solid rgba(123,94,167,0.3)', background: 'transparent', color: '#c4a8f0', fontSize: 12, cursor: 'pointer' }}>
            🟠 소진 마케팅 기획하러 가기 →
          </button>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 8, marginBottom: 12 }}>
        {kpis.map(k => (
          <div key={k.label} style={{ ...CARD, textAlign: 'center', marginBottom: 0 }}>
            <div style={{ fontSize: 18, color: k.color, marginBottom: 4, fontWeight: 500 }}>{k.value}</div>
            <div style={{ fontSize: 10, color: SUB }}>{k.label}</div>
          </div>
        ))}
      </div>
      <div style={CARD}>
        <div style={{ fontSize: 12, color: SUB, marginBottom: 10 }}>🔔 지금 챙겨야 할 것들</div>
        {alerts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 16, color: SUB, fontSize: 12 }}>모든 설정이 완료됐어요 💜</div>
        ) : (
          alerts.map((a, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < alerts.length - 1 ? '0.5px solid rgba(255,255,255,0.05)' : 'none' }}>
              <span style={{ fontSize: 12, color: TEXT }}>{a.text}</span>
              <button
                type="button"
                onClick={() => onTabChange(a.tab)}
                style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, border: '1px solid rgba(123,94,167,0.35)', background: 'rgba(123,94,167,0.08)', color: '#c4a8f0', cursor: 'pointer', flexShrink: 0, marginLeft: 8 }}
              >
                {a.action}
              </button>
            </div>
          ))
        )}
      </div>
      {/* 3단: 오렌상담톡 + 최근주문 + 재고현황 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
        <div style={CARD}>
          <div style={{ fontSize: 10, color: SUB, marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
            <span>💬 오렌상담톡</span>
            <span style={{ cursor: 'pointer' }} onClick={() => onTabChange('orentalk')}>전체 ›</span>
          </div>
          {recentTalks.length === 0 ? (
            <div style={{ fontSize: 11, color: SUB, textAlign: 'center', padding: 12 }}>대화 없음</div>
          ) : recentTalks.map((t, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 0', borderBottom: i < recentTalks.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: t.unread ? '#e85555' : 'transparent', flexShrink: 0 }} />
              <div style={{ fontSize: 10, color: GOLD, width: 52, flexShrink: 0 }}>{t.owner_name}</div>
              <div style={{ fontSize: 10, color: TEXT, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.preview}</div>
            </div>
          ))}
        </div>
        <div style={CARD}>
          <div style={{ fontSize: 10, color: SUB, marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
            <span>🛒 최근 주문</span>
            <span style={{ cursor: 'pointer' }} onClick={() => onTabChange('orders')}>전체 ›</span>
          </div>
          {recentOrders.length === 0 ? (
            <div style={{ fontSize: 11, color: SUB, textAlign: 'center', padding: 12 }}>주문 없음</div>
          ) : recentOrders.map((o, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 0', borderBottom: i < recentOrders.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
              <div style={{ fontSize: 9, color: SUB, width: 44, flexShrink: 0 }}>{o.order_no}</div>
              <div style={{ fontSize: 10, color: TEXT, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.product_name}</div>
              <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: o.status === 'pending' ? 'rgba(232,165,0,0.15)' : 'rgba(60,184,100,0.12)', color: o.status === 'pending' ? '#e8a500' : '#3db864', flexShrink: 0 }}>
                {o.status === 'pending' ? '대기' : '완료'}
              </span>
            </div>
          ))}
        </div>
        <div style={CARD}>
          <div style={{ fontSize: 10, color: SUB, marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
            <span>📦 재고 현황</span>
            <span style={{ cursor: 'pointer' }} onClick={() => onTabChange('inventory')}>전체 ›</span>
          </div>
          {expiringLots.length === 0 ? (
            <div style={{ fontSize: 11, color: SUB, textAlign: 'center', padding: 12 }}>재고 없음</div>
          ) : expiringLots.slice(0, 4).map((l, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 0', borderBottom: i < Math.min(expiringLots.length, 4) - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
              <div style={{ fontSize: 10, color: TEXT, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.product_name}</div>
              <div style={{ width: 40, height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.08)', flexShrink: 0 }}>
                <div style={{ height: 3, borderRadius: 2, width: `${Math.min(100, l.remaining_qty / 10)}%`, background: l.days <= 30 ? '#e85555' : l.days <= 90 ? '#e8a500' : '#3db864' }} />
              </div>
              <div style={{ fontSize: 9, color: l.days <= 30 ? '#e85555' : l.days <= 90 ? '#e8a500' : '#3db864', flexShrink: 0 }}>D-{l.days}</div>
            </div>
          ))}
        </div>
      </div>
      {/* 2단: 마케팅 + 샘플발송 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div style={{ ...CARD, marginBottom: 0, background: 'rgba(123,94,167,0.06)', border: '1px solid rgba(123,94,167,0.15)' }}>
          <div style={{ fontSize: 10, color: SUB, marginBottom: 10, display: 'flex', justifyContent: 'space-between' }}>
            <span>📣 마케팅·이벤트</span>
            <span style={{ cursor: 'pointer' }} onClick={() => onTabChange('live')}>전체 ›</span>
          </div>
          {!closedEvents.includes('promo') && (
            <div style={{ background: 'rgba(232,85,85,0.06)', border: '1px solid rgba(232,85,85,0.15)', borderRadius: 7, padding: '8px 10px', marginBottom: 7 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: 'rgba(232,85,85,0.2)', color: '#e85555' }}>진행중</span>
                  <span style={{ fontSize: 11, color: TEXT }}>이달 프로모션 이벤트</span>
                </div>
                <button type="button" onClick={() => setClosedEvents(p => [...p, 'promo'])}
                  style={{ background: 'none', border: 'none', color: SUB, fontSize: 14, cursor: 'pointer', lineHeight: 1, padding: '0 2px' }}>×</button>
              </div>
              <div style={{ fontSize: 10, color: SUB, marginBottom: 7 }}>~6/30 · 참여 원장님 8명</div>
              <button type="button" onClick={() => onTabChange('live')}
                style={{ fontSize: 10, padding: '4px 10px', borderRadius: 5, border: '1px solid rgba(232,85,85,0.3)', background: 'transparent', color: '#e85555', cursor: 'pointer' }}>
                관리하기 →
              </button>
            </div>
          )}
          {!closedEvents.includes('bundle') && (
            <div style={{ background: 'rgba(123,94,167,0.08)', border: '1px solid rgba(123,94,167,0.2)', borderRadius: 7, padding: '8px 10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: 'rgba(123,94,167,0.25)', color: '#c4a8f0' }}>번들</span>
                  <span style={{ fontSize: 11, color: TEXT }}>아레테클럽 번들 구성</span>
                </div>
                <button type="button" onClick={() => setClosedEvents(p => [...p, 'bundle'])}
                  style={{ background: 'none', border: 'none', color: SUB, fontSize: 14, cursor: 'pointer', lineHeight: 1, padding: '0 2px' }}>×</button>
              </div>
              <div style={{ fontSize: 10, color: SUB, marginBottom: 7 }}>마감 D-12 · 발송 대상 12명</div>
              <button type="button" onClick={() => onTabChange('inventory')}
                style={{ fontSize: 10, padding: '4px 10px', borderRadius: 5, border: '1px solid rgba(123,94,167,0.35)', background: 'transparent', color: '#c4a8f0', cursor: 'pointer' }}>
                번들 구성하기 →
              </button>
            </div>
          )}
          {closedEvents.length === 2 && (
            <div style={{ textAlign: 'center', padding: 12, fontSize: 11, color: SUB }}>
              진행중 이벤트가 없어요
              <span style={{ display: 'block', fontSize: 10, marginTop: 4, cursor: 'pointer', color: '#7B5EA7' }}
                onClick={() => setClosedEvents([])}>다시 보기</span>
            </div>
          )}
        </div>
        <div style={{ ...CARD, marginBottom: 0 }}>
          <div style={{ fontSize: 10, color: SUB, marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
            <span>🎁 샘플 발송</span>
            <span style={{ cursor: 'pointer' }} onClick={() => onTabChange('sample')}>전체 ›</span>
          </div>
          {sampleRequests.length === 0 ? (
            <div style={{ fontSize: 11, color: SUB, textAlign: 'center', padding: 12 }}>샘플 요청 없음</div>
          ) : sampleRequests.map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 0', borderBottom: i < sampleRequests.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
              <div style={{ fontSize: 10, color: TEXT, flex: 1 }}>{s.owner_name}</div>
              <div style={{ fontSize: 9, color: SUB, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.product_name}</div>
              <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: s.status === 'requested' ? 'rgba(232,165,0,0.15)' : 'rgba(60,184,100,0.12)', color: s.status === 'requested' ? '#e8a500' : '#3db864', flexShrink: 0 }}>
                {s.status === 'requested' ? '요청' : '완료'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
