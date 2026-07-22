'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { CSSProperties } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
const CARD: CSSProperties = { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: 12, marginBottom: 10 }
const PURPLE = '#7B5EA7'
const GOLD = '#C9A96E'
const TEXT = 'rgba(255,255,255,0.65)'
const SUB = 'rgba(255,255,255,0.3)'
const STATUS_LABEL: Record<string, string> = {
  pending: '접수 대기',
  approved: '승인됨',
  shipping: '배송중',
  done: '완료',
  cancelled: '취소',
}
function dayKey(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
interface Props {
  brandName: string
  brandId: string | null
  onTabChange: (tab: string) => void
}
export default function BrandTabHome({ brandId, onTabChange }: Props) {
  const supabase = createClient()
  const [ownerCount, setOwnerCount] = useState<number | null>(null)
  const [productCount, setProductCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [expiringLots, setExpiringLots] = useState<Array<{ product_name: string; lot_number: string; days: number; remaining_qty: number }>>([])
  const [recentTalks, setRecentTalks] = useState<Array<{ owner_name: string; preview: string; unread: boolean; updated_at: string }>>([])
  const [recentOrders, setRecentOrders] = useState<Array<{ order_no: string; product_name: string; amount: number; status: string }>>([])
  const [sampleRequests, setSampleRequests] = useState<Array<{ owner_name: string; product_name: string; status: string }>>([])
  const [monthSales, setMonthSales] = useState<number>(0)
  const [closedEvents, setClosedEvents] = useState<string[]>([])
  const [pendingOrders, setPendingOrders] = useState<number>(0)
  const [salesOpen, setSalesOpen] = useState(false)
  const [salesTrend, setSalesTrend] = useState<Array<{ day: string; label: string; amount: number }>>([])
  const [monthOrderList, setMonthOrderList] = useState<Array<{
    id: string
    created_at: string
    owner_name: string
    amount: number
    status: string
  }>>([])
  useEffect(() => {
    if (!brandId) return
    const fetch = async () => {
      setLoading(true)
      const { count: total } = await supabase
        .from('brand_products')
        .select('id', { count: 'exact', head: true })
        .eq('brand_id', brandId)
      setProductCount(total ?? 0)
      const { count: activeOwnerCount } = await supabase
        .from('brand_owner_links')
        .select('id', { count: 'exact', head: true })
        .eq('brand_id', brandId)
        .eq('status', 'active')
      setOwnerCount(activeOwnerCount ?? 0)
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
      const { data: orders } = await supabase
        .from('brand_orders')
        .select('id, items, total_amount, status, created_at')
        .eq('brand_id', brandId)
        .order('created_at', { ascending: false })
        .limit(4)
      if (orders) {
        setRecentOrders(orders.map((o: any) => {
          const itemList = Array.isArray(o.items) ? o.items : []
          const firstName = itemList[0]?.name || '-'
          const label = itemList.length > 1 ? `${firstName} 외 ${itemList.length - 1}건` : firstName
          return {
            order_no: `#${String(o.id).slice(0, 8).toUpperCase()}`,
            product_name: label,
            amount: o.total_amount || 0,
            status: o.status || 'pending',
          }
        }))
        setPendingOrders(orders.filter((o: any) => o.status === 'pending').length)
      }
      const { data: sampleSends } = await supabase
        .from('brand_sample_sends')
        .select('owner_name, status, brand_samples(product_name, brand_id)')
        .eq('brand_id', brandId)
        .order('created_at', { ascending: false })
        .limit(4)
      if (sampleSends) {
        setSampleRequests(sampleSends.map((s: any) => ({
          owner_name: s.owner_name || '-',
          product_name: (Array.isArray(s.brand_samples) ? s.brand_samples[0]?.product_name : s.brand_samples?.product_name) || '-',
          status: s.status || '-',
        })))
      }

      const thisMonth = new Date()
      thisMonth.setDate(1)
      thisMonth.setHours(0, 0, 0, 0)
      const { data: stockOrders } = await supabase
        .from('brand_orders')
        .select('total_amount')
        .eq('brand_id', brandId)
        .gte('created_at', thisMonth.toISOString())
        .neq('status', 'cancelled')
      const stockSum = (stockOrders || []).reduce((s, o) => s + (o.total_amount || 0), 0)
      setMonthSales(stockSum)

      const { data: monthRows } = await supabase
        .from('brand_orders')
        .select('id, total_amount, status, created_at, owner_name, profile_id, profiles(full_name)')
        .eq('brand_id', brandId)
        .gte('created_at', thisMonth.toISOString())
        .order('created_at', { ascending: false })
      setMonthOrderList((monthRows || []).map((o: any) => {
        const profileRef = o.profiles
        const profileName = Array.isArray(profileRef) ? profileRef[0]?.full_name : profileRef?.full_name
        return {
          id: o.id,
          created_at: o.created_at,
          owner_name: profileName || o.owner_name || '원장님',
          amount: Math.trunc(Number(o.total_amount) || 0),
          status: o.status || 'pending',
        }
      }))

      const since = new Date()
      since.setHours(0, 0, 0, 0)
      since.setDate(since.getDate() - 29)
      const sinceIso = since.toISOString()
      const [{ data: createdRows }, { data: cancelledRows }] = await Promise.all([
        supabase
          .from('brand_orders')
          .select('total_amount, created_at')
          .eq('brand_id', brandId)
          .gte('created_at', sinceIso),
        supabase
          .from('brand_orders')
          .select('total_amount, updated_at')
          .eq('brand_id', brandId)
          .eq('status', 'cancelled')
          .gte('updated_at', sinceIso),
      ])
      const createdByDay: Record<string, number> = {}
      const cancelledByDay: Record<string, number> = {}
      for (const o of createdRows || []) {
        if (!o.created_at) continue
        const k = dayKey(o.created_at)
        createdByDay[k] = (createdByDay[k] || 0) + (o.total_amount || 0)
      }
      for (const o of cancelledRows || []) {
        if (!(o as { updated_at?: string }).updated_at) continue
        const k = dayKey((o as { updated_at: string }).updated_at)
        cancelledByDay[k] = (cancelledByDay[k] || 0) + (o.total_amount || 0)
      }
      const trend: Array<{ day: string; label: string; amount: number }> = []
      for (let i = 0; i < 30; i++) {
        const d = new Date(since.getFullYear(), since.getMonth(), since.getDate() + i)
        const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        trend.push({
          day: k,
          label: `${d.getMonth() + 1}/${d.getDate()}`,
          amount: (createdByDay[k] || 0) - (cancelledByDay[k] || 0),
        })
      }
      setSalesTrend(trend)

      setLoading(false)
    }
    void fetch()
  }, [brandId, supabase])
  const kpis = [
    { key: 'sales', label: '이달 판매액', value: loading ? '-' : `₩${(monthSales / 10000).toFixed(0)}만`, color: '#fff' },
    { key: 'pending', label: '처리대기 주문', value: loading ? '-' : `${pendingOrders}`, color: pendingOrders > 0 ? '#e8a500' : '#fff' },
    { key: 'lots', label: '임박재고 D-30', value: loading ? '-' : `${expiringLots.filter(l => l.days <= 30).length}`, color: expiringLots.filter(l => l.days <= 30).length > 0 ? '#e85555' : '#fff' },
    { key: 'owners', label: '활성 원장님', value: loading ? '-' : `${ownerCount ?? 0}명`, color: PURPLE },
    { key: 'products', label: '등록 제품', value: loading ? '-' : `${productCount ?? 0}개`, color: GOLD },
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
          <div
            key={k.key}
            role={k.key === 'sales' ? 'button' : undefined}
            onClick={k.key === 'sales' ? () => setSalesOpen(v => !v) : undefined}
            style={{
              ...CARD,
              textAlign: 'center',
              marginBottom: 0,
              cursor: k.key === 'sales' ? 'pointer' : 'default',
              outline: k.key === 'sales' && salesOpen ? `1px solid ${GOLD}` : undefined,
            }}
          >
            <div style={{ fontSize: 18, color: k.color, marginBottom: 4, fontWeight: 500 }}>{k.value}</div>
            <div style={{ fontSize: 10, color: SUB }}>{k.label}</div>
          </div>
        ))}
      </div>
      {salesOpen && (
        <div style={{ ...CARD, marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontSize: 12, color: SUB }}>이달 재고발주 내역</div>
            <button
              type="button"
              onClick={() => setSalesOpen(false)}
              style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.12)', background: 'transparent', color: TEXT, cursor: 'pointer' }}
            >
              접기
            </button>
          </div>
          {monthOrderList.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 16, color: SUB, fontSize: 12 }}>이달 발주 내역이 없어요</div>
          ) : (
            monthOrderList.map((row) => {
              const cancelled = row.status === 'cancelled'
              return (
                <div
                  key={row.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 0',
                    borderBottom: '0.5px solid rgba(255,255,255,0.05)',
                    fontSize: 11,
                  }}
                >
                  <span style={{ color: SUB, width: 72, flexShrink: 0 }}>
                    {new Date(row.created_at).toLocaleDateString('ko-KR')}
                  </span>
                  <span style={{ color: TEXT, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {row.owner_name}
                  </span>
                  <span style={{ color: cancelled ? SUB : GOLD, flexShrink: 0 }}>
                    {cancelled ? '-' : ''}₩{row.amount.toLocaleString()}
                  </span>
                  <span
                    style={{
                      fontSize: 9,
                      padding: '2px 6px',
                      borderRadius: 4,
                      flexShrink: 0,
                      background: cancelled ? 'rgba(255,255,255,0.06)' : 'rgba(201,169,110,0.12)',
                      color: cancelled ? 'rgba(255,255,255,0.35)' : GOLD,
                    }}
                  >
                    {STATUS_LABEL[row.status] || row.status}
                  </span>
                </div>
              )
            })
          )}
        </div>
      )}
      <div style={{ ...CARD, marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: SUB, marginBottom: 10 }}>최근 30일 재고발주 매출</div>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 24, color: SUB, fontSize: 12 }}>불러오는 중…</div>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={salesTrend}>
              <XAxis
                dataKey="label"
                tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 9 }}
                axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 9 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${Math.round(Number(v) / 10000)}만`}
                width={36}
              />
              <Tooltip
                contentStyle={{
                  background: '#1a1520',
                  border: '0.5px solid rgba(201,169,110,0.35)',
                  borderRadius: 8,
                  fontSize: 11,
                  color: TEXT,
                }}
                formatter={(v: number) => [`₩${Number(v).toLocaleString()}`, '발주 매출']}
              />
              <Line type="monotone" dataKey="amount" stroke={GOLD} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
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
              <div style={{ fontSize: 10, color: SUB, marginBottom: 7 }}></div>
              <button type="button" onClick={() => onTabChange('live')}
                style={{ fontSize: 10, padding: '4px 10px', borderRadius: 5, border: '1px solid rgba(232,85,85,0.3)', background: 'transparent', color: '#e85555', cursor: 'pointer' }}>
                관리하기 →
              </button>
            </div>
          )}
          {!closedEvents.includes('bundle') && (
            <div style={{ background: 'rgba(123,94,167,0.08)', border: '1px solid rgba(123,94,167,0.2)', borderRadius: 7, padding: '8px 10px', marginBottom: 7 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: 'rgba(123,94,167,0.25)', color: '#c4a8f0' }}>번들</span>
                  <span style={{ fontSize: 11, color: TEXT }}>아레테클럽 번들 구성</span>
                </div>
                <button type="button" onClick={() => setClosedEvents(p => [...p, 'bundle'])}
                  style={{ background: 'none', border: 'none', color: SUB, fontSize: 14, cursor: 'pointer', lineHeight: 1, padding: '0 2px' }}>×</button>
              </div>
              <div style={{ fontSize: 10, color: SUB, marginBottom: 7 }}></div>
              <button type="button" onClick={() => onTabChange('inventory')}
                style={{ fontSize: 10, padding: '4px 10px', borderRadius: 5, border: '1px solid rgba(123,94,167,0.35)', background: 'transparent', color: '#c4a8f0', cursor: 'pointer' }}>
                번들 구성하기 →
              </button>
            </div>
          )}
          {!closedEvents.includes('live') && (
            <div style={{ background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 7, padding: '8px 10px', marginBottom: 7 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: 'rgba(59,130,246,0.2)', color: '#60a5fa' }}>예정</span>
                  <span style={{ fontSize: 11, color: TEXT }}>예정된 라이브</span>
                </div>
                <button type="button" onClick={() => setClosedEvents(p => [...p, 'live'])}
                  style={{ background: 'none', border: 'none', color: SUB, fontSize: 14, cursor: 'pointer', lineHeight: 1, padding: '0 2px' }}>×</button>
              </div>
              <button type="button" onClick={() => onTabChange('live')}
                style={{ fontSize: 10, padding: '4px 10px', borderRadius: 5, border: '1px solid rgba(59,130,246,0.25)', background: 'transparent', color: '#60a5fa', cursor: 'pointer' }}>
                라이브 관리 →
              </button>
            </div>
          )}
          {closedEvents.length >= 3 && (
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
