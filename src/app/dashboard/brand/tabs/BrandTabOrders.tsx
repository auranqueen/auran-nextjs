'use client'
import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import BrandOrdersPromoSettings from '../components/BrandOrdersPromoSettings'
import BrandOrdersSummary from '../components/BrandOrdersSummary'
import type { CSSProperties } from 'react'
const CARD: CSSProperties = { background: '#1a1520', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 14, marginBottom: 10 }
const PURPLE = '#7B5EA7'
const GOLD = '#C9A96E'
const TEXT = 'rgba(255,255,255,0.65)'
const SUB = 'rgba(255,255,255,0.3)'
const GREEN = 'rgba(76,175,80,0.8)'
const BORDER = 'rgba(255,255,255,0.05)'
const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending:   { label: '접수 대기', color: 'rgba(255,193,7,0.8)' },
  approved:  { label: '승인됨',    color: GREEN },
  shipping:  { label: '배송중',    color: 'rgba(41,182,246,0.8)' },
  done:      { label: '완료',      color: 'rgba(255,255,255,0.3)' },
  cancelled: { label: '취소',      color: 'rgba(229,57,53,0.7)' },
}
function formatOrderItemLine(it: { name: string; qty: number; bonus?: number }): string {
  const bonus = Math.trunc(Number(it.bonus) || 0)
  return `${it.name} ${it.qty}ea${bonus > 0 ? ` (+${bonus} 증정)` : ''}`
}
interface OrderRow {
  id: string
  owner_name: string | null
  salon_name: string | null
  grade: string | null
  status: string
  items: Array<{ name: string; qty: number; bonus?: number }>
  promo_applied: string | null
  points_earned: number
  created_at: string
}
interface Props {
  myBrands: { id: string; name: string }[]
}
export default function BrandTabOrders({ myBrands }: Props) {
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null)
  const brandId = selectedBrandId
  const brandName = myBrands.find((b) => b.id === brandId)?.name || ''
  const supabase = createClient()
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  const [subTab, setSubTab] = useState<'pending' | 'all'>('pending')
  const showToast = (t: string) => { setToast(t); setTimeout(() => setToast(''), 2500) }

  const handleBrandChange = (id: string | null) => {
    setSelectedBrandId(id)
    if (typeof window === 'undefined') return
    if (id) localStorage.setItem('brand-tab-selection', id)
    else localStorage.removeItem('brand-tab-selection')
  }

  useEffect(() => {
    if (typeof window === 'undefined') return
    const saved = localStorage.getItem('brand-tab-selection')
    if (saved && myBrands.some((b) => b.id === saved)) setSelectedBrandId(saved)
  }, [myBrands])

  const fetchOrders = useCallback(async () => {
    if (!brandId) return
    setLoading(true)
    const { data } = await supabase
      .from('brand_orders')
      .select('id, owner_name, salon_name, grade, status, items, promo_applied, points_earned, created_at')
      .eq('brand_id', brandId)
      .order('created_at', { ascending: false })
      .limit(50)
    setOrders((data || []) as OrderRow[])
    setLoading(false)
  }, [brandId])
  useEffect(() => { void fetchOrders() }, [fetchOrders])

  const updateStatus = async (id: string, status: 'approved' | 'cancelled') => {
    const { error } = await supabase
      .from('brand_orders')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (!error) {
      setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o))
      showToast(STATUS_MAP[status]?.label + ' 처리됨!')
      if (status === 'approved' && brandId) {
        const order = orders.find(o => o.id === id)
        await supabase.from('brand_messages').insert({
          brand_id: brandId,
          message_type: 'auto_order',
          target_type: 'all',
          title: `${brandName} 발주 승인 완료`,
          body: `발주가 승인됐어요. ${order?.promo_applied ? order.promo_applied + ' 적용 완료.' : ''} 곧 발송 예정입니다.`,
          send_count: 1,
        })
      }
    }
  }

  const filtered = subTab === 'pending'
    ? orders.filter(o => o.status === 'pending')
    : orders
  const pendingCount = orders.filter(o => o.status === 'pending').length
  return (
    <div>
      <BrandOrdersSummary
        myBrands={myBrands}
        selectedBrandId={selectedBrandId}
        onBrandChange={handleBrandChange}
      />
      {!selectedBrandId ? (
        <div style={{ textAlign: 'center', padding: 24, color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>
          특정 브랜드를 선택하세요
        </div>
      ) : (
      <>
      {toast && (
        <div style={{ position: 'fixed', top: 14, left: '50%', transform: 'translateX(-50%)', background: PURPLE, color: '#fff', fontSize: 12, padding: '7px 18px', borderRadius: 20, zIndex: 999 }}>{toast}</div>
      )}
      <BrandOrdersPromoSettings brandId={selectedBrandId} />
      <div style={CARD}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: SUB }}>
            📥 발주 관리
            {pendingCount > 0 && (
              <span style={{ marginLeft: 6, fontSize: 11, padding: '1px 7px', borderRadius: 10, background: 'rgba(255,193,7,0.15)', color: 'rgba(255,193,7,0.9)' }}>
                대기 {pendingCount}건
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['pending', 'all'] as const).map(t => (
              <button key={t} type="button" onClick={() => setSubTab(t)}
                style={{ fontSize: 11, padding: '2px 10px', borderRadius: 20, border: `0.5px solid ${subTab === t ? PURPLE : 'rgba(255,255,255,0.1)'}`, background: subTab === t ? 'rgba(123,94,167,0.2)' : 'transparent', color: subTab === t ? '#c4a7e7' : SUB, cursor: 'pointer' }}>
                {t === 'pending' ? '대기중' : '전체'}
              </button>
            ))}
          </div>
        </div>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 20, color: SUB, fontSize: 12 }}>불러오는 중...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 20, color: SUB, fontSize: 12 }}>
            {subTab === 'pending' ? '대기중인 발주가 없어요' : '아직 접수된 발주가 없어요'}
          </div>
        ) : (
          filtered.map((o, i) => {
            const st = STATUS_MAP[o.status] || { label: o.status, color: SUB }
            const items = Array.isArray(o.items) ? o.items : []
            return (
              <div key={o.id} style={{ padding: '12px 0', borderBottom: i < filtered.length - 1 ? `0.5px solid ${BORDER}` : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <span style={{ fontSize: 13, color: TEXT }}>{o.owner_name || '원장님'}</span>
                      {o.grade && (
                        <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 10, background: 'rgba(123,94,167,0.15)', color: '#c4a7e7', border: '0.5px solid rgba(123,94,167,0.3)' }}>{o.grade}</span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: SUB }}>{o.salon_name || '-'} · {new Date(o.created_at).toLocaleDateString('ko-KR')}</div>
                  </div>
                  <span style={{ fontSize: 11, padding: '2px 9px', borderRadius: 10, background: `${st.color}22`, color: st.color, border: `0.5px solid ${st.color}55`, flexShrink: 0 }}>{st.label}</span>
                </div>
                {items.length > 0 && (
                  <div style={{ fontSize: 11, color: SUB, marginBottom: 6 }}>
                    {items.map((it) => formatOrderItemLine(it)).join(' · ')}
                    {o.promo_applied && <span style={{ marginLeft: 6, color: GOLD }}>{o.promo_applied} 적용</span>}
                  </div>
                )}
                {o.points_earned > 0 && (
                  <div style={{ fontSize: 11, color: GREEN, marginBottom: 8 }}>포인트 {o.points_earned.toLocaleString()}T 적립</div>
                )}
                {o.status === 'pending' && (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button type="button" onClick={() => updateStatus(o.id, 'approved')}
                      style={{ fontSize: 11, padding: '4px 12px', borderRadius: 6, border: 'none', background: PURPLE, color: '#fff', cursor: 'pointer' }}>
                      승인
                    </button>
                    <button type="button" onClick={() => updateStatus(o.id, 'cancelled')}
                      style={{ fontSize: 11, padding: '4px 12px', borderRadius: 6, border: '0.5px solid rgba(229,57,53,0.3)', background: 'rgba(229,57,53,0.08)', color: 'rgba(229,57,53,0.7)', cursor: 'pointer' }}>
                      취소
                    </button>
                  </div>
                )}
                {o.status === 'approved' && (
                  <div style={{ fontSize: 11, color: SUB, marginTop: 4 }}>
                    승인됨 · 발송은 재고·물류 → 발송 처리에서 진행하세요
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
      <div style={CARD}>
        <div style={{ fontSize: 12, color: SUB, marginBottom: 10 }}>👑 아레테클럽 포인트 현황</div>
        <div style={{ fontSize: 11, color: SUB, padding: '8px 10px', background: 'rgba(201,169,110,0.04)', borderRadius: 7, border: '0.5px solid rgba(201,169,110,0.15)' }}>
          💡 아레테 포인트 + 발주 적립 포인트 → 시바산 제품 구매 시 통합 사용
        </div>
      </div>
      </>
      )}
    </div>
  )
}
