'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { CSSProperties } from 'react'
const CARD: CSSProperties = { background: '#1a1520', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 14, marginBottom: 10 }
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
      setLoading(false)
    }
    void fetch()
  }, [brandId, brandName])
  const kpis = [
    { label: '연결 원장님', value: loading ? '-' : `${ownerCount ?? 0}명`, color: PURPLE },
    { label: '등록 제품', value: loading ? '-' : `${productCount ?? 0}개`, color: GOLD },
    { label: '판매중', value: loading ? '-' : `${activeCount ?? 0}개`, color: '#a07fd4' },
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
            style={{ width: '100%', padding: '7px', borderRadius: 7, border: '0.5px solid rgba(123,94,167,0.4)', background: 'rgba(123,94,167,0.08)', color: '#c4a7e7', fontSize: 12, cursor: 'pointer' }}>
            🟠 소진 마케팅 기획하러 가기 →
          </button>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 10 }}>
        {kpis.map(k => (
          <div key={k.label} style={{ ...CARD, textAlign: 'center', marginBottom: 0 }}>
            <div style={{ fontSize: 20, color: k.color, marginBottom: 4 }}>{k.value}</div>
            <div style={{ fontSize: 11, color: SUB }}>{k.label}</div>
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
                style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, border: `0.5px solid ${PURPLE}`, background: 'rgba(123,94,167,0.15)', color: '#c4a7e7', cursor: 'pointer', flexShrink: 0, marginLeft: 8 }}
              >
                {a.action}
              </button>
            </div>
          ))
        )}
      </div>
      <div style={CARD}>
        <div style={{ fontSize: 12, color: SUB, marginBottom: 10 }}>📦 이번달 TOP 제품</div>
        {topProducts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 16, color: SUB, fontSize: 12 }}>제품을 등록하면 여기에 표시됩니다</div>
        ) : (
          topProducts.map((p, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < topProducts.length - 1 ? '0.5px solid rgba(255,255,255,0.05)' : 'none' }}>
              <span style={{ fontSize: 12, color: TEXT }}>{p.name}</span>
              <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: 'rgba(76,175,80,0.1)', color: 'rgba(76,175,80,0.8)' }}>판매중</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
