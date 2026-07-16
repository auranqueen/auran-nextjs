'use client'
import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { CSSProperties } from 'react'
const CARD: CSSProperties = { background: '#1a1520', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 14, marginBottom: 10 }
const PURPLE = '#7B5EA7'
const GOLD = '#C9A96E'
const TEXT = 'rgba(255,255,255,0.65)'
const SUB = 'rgba(255,255,255,0.3)'
const BORDER = 'rgba(255,255,255,0.05)'
const GREEN = 'rgba(76,175,80,0.8)'
interface KpiData {
  orderCount: number
  ownerCount: number
  productCount: number
  activeCount: number
}
interface OrderRow {
  id: string
  owner_name: string | null
  status: string
  items: Array<{ name: string; qty: number }>
  created_at: string
}
interface Props {
  brandId: string | null
  brandName: string
}
export default function BrandTabData({ brandId, brandName }: Props) {
  const supabase = createClient()
  const [kpi, setKpi] = useState<KpiData>({ orderCount: 0, ownerCount: 0, productCount: 0, activeCount: 0 })
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [thisMonthOrders, setThisMonthOrders] = useState<Array<{ id: string; status: string; items: Array<{ name: string; qty: number }> }>>([])
  const [ownerCount, setOwnerCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [subTab, setSubTab] = useState<'orders' | 'products'>('orders')
  const fetchData = useCallback(async () => {
    if (!brandId) return
    setLoading(true)
    const now = new Date()
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const [
      { count: orderCount },
      { count: productCount },
      { count: activeCount },
      { data: thisMonthOrders },
      { data: recentOrders },
      { count: linkedOwnerCount },
    ] = await Promise.all([
      supabase.from('brand_orders').select('id', { count: 'exact', head: true })
        .eq('brand_id', brandId).gte('created_at', firstDay),
      supabase.from('products').select('id', { count: 'exact', head: true })
        .eq('brand_id', brandId).is('deleted_at', null),
      supabase.from('products').select('id', { count: 'exact', head: true })
        .eq('brand_id', brandId).eq('status', 'active').is('deleted_at', null),
      supabase.from('brand_orders').select('id, status, items')
        .eq('brand_id', brandId).gte('created_at', firstDay),
      supabase.from('brand_orders').select('id, owner_name, status, items, created_at')
        .eq('brand_id', brandId).order('created_at', { ascending: false }).limit(10),
      // BrandTabHome과 동일: brand_owner_links active
      supabase.from('brand_owner_links').select('id', { count: 'exact', head: true })
        .eq('brand_id', brandId).eq('status', 'active'),
    ])
    const cnt = linkedOwnerCount ?? 0
    setOwnerCount(cnt)
    setKpi({
      orderCount: orderCount ?? 0,
      ownerCount: cnt,
      productCount: productCount ?? 0,
      activeCount: activeCount ?? 0,
    })
    setOrders((recentOrders || []) as OrderRow[])
    setThisMonthOrders((thisMonthOrders || []) as Array<{ id: string; status: string; items: Array<{ name: string; qty: number }> }>)
    setLoading(false)
  }, [brandId])
  useEffect(() => { void fetchData() }, [fetchData])
  // 아이템별 집계
  const itemMap: Record<string, number> = {}
  thisMonthOrders.forEach(o => {
    const items = Array.isArray(o.items) ? o.items : []
    items.forEach(it => {
      itemMap[it.name] = (itemMap[it.name] || 0) + (it.qty || 1)
    })
  })
  const topItems = Object.entries(itemMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
  // 상태별 집계
  const statusCounts = thisMonthOrders.reduce((acc, o) => {
    acc[o.status] = (acc[o.status] || 0) + 1
    return acc
  }, {} as Record<string, number>)
  const kpis = [
    { label: '이번달 발주', value: `${kpi.orderCount}건`, color: PURPLE },
    { label: '연결 원장님', value: `${kpi.ownerCount}명`, color: GOLD },
    { label: '등록 제품', value: `${kpi.productCount}개`, color: '#a07fd4' },
    { label: '판매중', value: `${kpi.activeCount}개`, color: GREEN },
  ]
  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime()
    const m = Math.floor(diff / 60000)
    if (m < 1) return '방금 전'
    if (m < 60) return `${m}분 전`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}시간 전`
    return `${Math.floor(h / 24)}일 전`
  }
  return (
    <div>
      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8, marginBottom: 10 }}>
        {kpis.map(k => (
          <div key={k.label} style={{ ...CARD, marginBottom: 0, textAlign: 'center' }}>
            <div style={{ fontSize: 20, color: k.color, marginBottom: 4 }}>
              {loading ? '-' : k.value}
            </div>
            <div style={{ fontSize: 11, color: SUB }}>{k.label}</div>
          </div>
        ))}
      </div>
      {/* 서브탭 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        {([{ key: 'orders', label: '📦 발주 현황' }, { key: 'products', label: '🧴 제품 현황' }] as const).map(t => (
          <button key={t.key} type="button" onClick={() => setSubTab(t.key)}
            style={{ fontSize: 12, padding: '5px 14px', borderRadius: 20, border: `0.5px solid ${subTab === t.key ? PURPLE : 'rgba(255,255,255,0.1)'}`, background: subTab === t.key ? 'rgba(123,94,167,0.2)' : 'transparent', color: subTab === t.key ? '#c4a7e7' : SUB, cursor: 'pointer' }}>
            {t.label}
          </button>
        ))}
      </div>
      {subTab === 'orders' && (
        <>
          {/* 발주 상태 요약 */}
          <div style={CARD}>
            <div style={{ fontSize: 12, color: SUB, marginBottom: 12 }}>📊 이번달 발주 상태</div>
            {loading ? (
              <div style={{ textAlign: 'center', padding: 16, color: SUB, fontSize: 12 }}>불러오는 중...</div>
            ) : orders.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 16, color: SUB, fontSize: 12 }}>발주 데이터가 없어요</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                {[
                  { label: '대기중', key: 'pending', color: 'rgba(255,193,7,0.8)' },
                  { label: '승인됨', key: 'approved', color: GREEN },
                  { label: '완료', key: 'done', color: SUB },
                ].map(s => (
                  <div key={s.key} style={{ background: 'rgba(255,255,255,0.02)', border: '0.5px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '10px 8px', textAlign: 'center' }}>
                    <div style={{ fontSize: 18, color: s.color, marginBottom: 4 }}>{statusCounts[s.key] || 0}</div>
                    <div style={{ fontSize: 11, color: SUB }}>{s.label}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          {/* 최근 발주 */}
          <div style={CARD}>
            <div style={{ fontSize: 12, color: SUB, marginBottom: 12 }}>📋 최근 발주</div>
            {loading ? (
              <div style={{ textAlign: 'center', padding: 16, color: SUB, fontSize: 12 }}>불러오는 중...</div>
            ) : orders.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 16, color: SUB, fontSize: 12 }}>발주 내역이 없어요</div>
            ) : (
              orders.map((o, i) => (
                <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: i < orders.length - 1 ? `0.5px solid ${BORDER}` : 'none' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: TEXT, marginBottom: 2 }}>{o.owner_name || '원장님'}</div>
                    <div style={{ fontSize: 11, color: SUB, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {Array.isArray(o.items) && o.items.length > 0
                        ? o.items.map(it => `${it.name} ${it.qty}ea`).join(' · ')
                        : '항목 없음'}
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: SUB, flexShrink: 0 }}>{timeAgo(o.created_at)}</div>
                </div>
              ))
            )}
          </div>
        </>
      )}
      {subTab === 'products' && (
        <>
          {/* TOP 제품 */}
          <div style={CARD}>
            <div style={{ fontSize: 12, color: SUB, marginBottom: 12 }}>🏆 발주 TOP 제품</div>
            {topItems.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 16, color: SUB, fontSize: 12 }}>발주 데이터가 쌓이면 표시됩니다</div>
            ) : (
              topItems.map(([name, qty], i) => (
                <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <span style={{ fontSize: 11, color: SUB, width: 16, flexShrink: 0 }}>{i + 1}</span>
                  <span style={{ fontSize: 12, color: TEXT, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                  <div style={{ width: 80, height: 5, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden', flexShrink: 0 }}>
                    <div style={{ width: `${Math.min(100, (qty / (topItems[0]?.[1] || 1)) * 100)}%`, height: '100%', background: PURPLE, borderRadius: 3 }} />
                  </div>
                  <span style={{ fontSize: 11, color: SUB, width: 32, textAlign: 'right', flexShrink: 0 }}>{qty}ea</span>
                </div>
              ))
            )}
          </div>
          {/* 제품 현황 */}
          <div style={CARD}>
            <div style={{ fontSize: 12, color: SUB, marginBottom: 12 }}>🧴 제품 현황</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8 }}>
              {[
                { label: '전체 등록', value: kpi.productCount, color: TEXT },
                { label: '판매중', value: kpi.activeCount, color: GREEN },
                { label: '승인 대기', value: kpi.productCount - kpi.activeCount, color: 'rgba(255,193,7,0.8)' },
                { label: '발주 TOP 종류', value: topItems.length, color: PURPLE },
              ].map(item => (
                <div key={item.label} style={{ background: 'rgba(255,255,255,0.02)', border: '0.5px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '10px 8px', textAlign: 'center' }}>
                  <div style={{ fontSize: 18, color: item.color, marginBottom: 4 }}>{loading ? '-' : item.value}</div>
                  <div style={{ fontSize: 11, color: SUB }}>{item.label}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
