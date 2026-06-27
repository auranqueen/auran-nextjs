'use client'
import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { CSSProperties } from 'react'
const CARD: CSSProperties = { background: '#1a1520', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 14, marginBottom: 10 }
const PURPLE = '#7B5EA7'
const GOLD = '#C9A96E'
const TEXT = 'rgba(255,255,255,0.65)'
const SUB = 'rgba(255,255,255,0.3)'
const GREEN = 'rgba(76,175,80,0.8)'
const BORDER = 'rgba(255,255,255,0.05)'
const PROMOS = [
  { key: '5+1', desc: '5개 구매 +1개 증정' },
  { key: '5+5', desc: '5개 구매 +5개 증정' },
  { key: '10+3', desc: '10개 구매 +3개 증정' },
  { key: '10+4', desc: '10개 구매 +4개 증정' },
  { key: '10+5', desc: '10개 구매 +5개 증정' },
  { key: '10+10', desc: '10개 구매 +10개 증정' },
]
const GRADE_PROMOS = [
  { grade: '메디슈티컬', color: '#E53935', promos: '10+10 / 10+5', point: '구매액의 3%' },
  { grade: '프리미엄전문점', color: '#C9A96E', promos: '10+5 / 10+4', point: '구매액의 2%' },
  { grade: '전문점', color: '#9C7FD4', promos: '10+3 / 5+5', point: '구매액의 1.5%' },
  { grade: '취급점', color: '#64B5F6', promos: '10+1 / 5+1', point: '구매액의 1%' },
]
const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending:   { label: '접수 대기', color: 'rgba(255,193,7,0.8)' },
  approved:  { label: '승인됨',    color: GREEN },
  shipping:  { label: '배송중',    color: 'rgba(41,182,246,0.8)' },
  done:      { label: '완료',      color: 'rgba(255,255,255,0.3)' },
  cancelled: { label: '취소',      color: 'rgba(229,57,53,0.7)' },
}
interface OrderRow {
  id: string
  owner_name: string | null
  salon_name: string | null
  grade: string | null
  status: string
  items: Array<{ name: string; qty: number }>
  promo_applied: string | null
  points_earned: number
  created_at: string
  courier: string | null
  tracking_no: string | null
  shipped_at: string | null
  logistics_staff: string | null
}
interface Props {
  brandId: string | null
  brandName: string
}
export default function BrandTabOrders({ brandId, brandName }: Props) {
  const supabase = createClient()
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  const [subTab, setSubTab] = useState<'pending' | 'all'>('pending')
  const [trackingInputs, setTrackingInputs] = useState<Record<string, { courier: string; no: string }>>({})
  const showToast = (t: string) => { setToast(t); setTimeout(() => setToast(''), 2500) }
  const fetchOrders = useCallback(async () => {
    if (!brandId) return
    setLoading(true)
    const { data } = await supabase
      .from('brand_orders')
      .select('id, owner_name, salon_name, grade, status, items, promo_applied, points_earned, created_at, courier, tracking_no, shipped_at, logistics_staff')
      .eq('brand_id', brandId)
      .order('created_at', { ascending: false })
      .limit(50)
    setOrders((data || []) as OrderRow[])
    setLoading(false)
  }, [brandId])
  useEffect(() => { void fetchOrders() }, [fetchOrders])
  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase
      .from('brand_orders')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (!error) {
      setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o))
      showToast(STATUS_MAP[status]?.label + ' 처리됨!')
      if ((status === 'approved' || status === 'shipping' || status === 'done') && brandId) {
        const order = orders.find(o => o.id === id)
        const msgMap: Record<string, string> = {
          approved: `발주가 승인됐어요. ${order?.promo_applied ? order.promo_applied + ' 적용 완료.' : ''} 곧 발송 예정입니다.`,
          shipping: `주문하신 제품이 발송됐어요. 곧 도착할 예정입니다.`,
          done:     `배송이 완료됐어요. 제품을 확인해주세요 💜`,
        }
        const titleMap: Record<string, string> = {
          approved: `${brandName} 발주 승인 완료`,
          shipping: `${brandName} 발주 배송 시작`,
          done:     `${brandName} 배송 완료`,
        }
        await supabase.from('brand_messages').insert({
          brand_id: brandId,
          message_type: `auto_order`,
          target_type: 'all',
          title: titleMap[status] || `${brandName} 발주 상태 변경`,
          body: msgMap[status] || `발주 상태가 ${STATUS_MAP[status]?.label}으로 변경됐습니다.`,
          send_count: 1,
        })
      }
    }
  }
  const shipOrder = async (order: OrderRow) => {
    const input = trackingInputs[order.id]
    if (!input?.courier || !input?.no.trim()) {
      showToast('택배사와 운송장 번호를 입력해주세요')
      return
    }
    if (!brandId) return
    const now = new Date().toISOString()
    const { error } = await supabase
      .from('brand_orders')
      .update({
        status: 'shipping',
        courier: input.courier,
        tracking_no: input.no.trim(),
        shipped_at: now,
        updated_at: now,
      })
      .eq('id', order.id)
    if (!error) {
      setOrders(prev => prev.map(o =>
        o.id === order.id
          ? { ...o, status: 'shipping', courier: input.courier, tracking_no: input.no.trim(), shipped_at: now }
          : o
      ))
      setTrackingInputs(prev => { const n = {...prev}; delete n[order.id]; return n })
      await supabase.from('brand_messages').insert({
        brand_id: brandId,
        message_type: 'auto_order',
        target_type: 'all',
        title: `${brandName} 발주 배송 시작`,
        body: `주문하신 제품이 발송됐어요. 택배사: ${input.courier} · 운송장: ${input.no.trim()}`,
        send_count: 1,
      })
      const { data: alreadyLogged } = await supabase
        .from('brand_stock_logs')
        .select('id')
        .eq('brand_id', brandId)
        .eq('ref_type', 'order')
        .eq('ref_id', order.id)
        .maybeSingle()
      if (!alreadyLogged) {
        const items = Array.isArray(order.items) ? order.items : []
        for (const item of items) {
          const { data: invRow } = await supabase
            .from('brand_inventory')
            .select('id, total_stock')
            .eq('brand_id', brandId)
            .eq('product_name', item.name)
            .maybeSingle()
          if (invRow) {
            await supabase.rpc('decrement_inventory_stock', {
              p_inventory_id: invRow.id,
              p_qty: item.qty,
            })
            await supabase.from('brand_stock_logs').insert({
              brand_id: brandId,
              inventory_id: invRow.id,
              type: 'out',
              qty: item.qty,
              before_qty: invRow.total_stock,
              after_qty: Math.max(0, invRow.total_stock - item.qty),
              ref_type: 'order',
              ref_id: order.id,
              staff_name: '발주 자동 출고',
              memo: `발주 출고: ${item.name} ${item.qty}개`,
            })
            if (invRow.total_stock - item.qty <= 0) {
              await supabase.from('brand_messages').insert({
                brand_id: brandId,
                message_type: 'auto_order',
                target_type: 'all',
                title: `⚠️ ${item.name} 재고 소진 임박`,
                body: `${item.name} 재고가 ${Math.max(0, invRow.total_stock - item.qty)}개 남았습니다. 생산 발주를 검토해주세요.`,
                send_count: 1,
              })
            }
          }
        }
      }
      showToast('배송 처리 완료! 원장님 오렌톡 자동 발송됨')
    } else {
      showToast('처리 실패: ' + error.message)
    }
  }
  const filtered = subTab === 'pending'
    ? orders.filter(o => o.status === 'pending')
    : orders
  const pendingCount = orders.filter(o => o.status === 'pending').length
  return (
    <div>
      {toast && (
        <div style={{ position: 'fixed', top: 14, left: '50%', transform: 'translateX(-50%)', background: PURPLE, color: '#fff', fontSize: 12, padding: '7px 18px', borderRadius: 20, zIndex: 999 }}>{toast}</div>
      )}
      {/* 등급별 프로모션 */}
      <div style={CARD}>
        <div style={{ fontSize: 12, color: SUB, marginBottom: 12 }}>📊 등급별 프로모션 · 적립 포인트</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '0.5px solid rgba(255,255,255,0.08)' }}>
                {['등급', '프로모션', '적립 포인트'].map(h => (
                  <th key={h} style={{ padding: '8px 6px', color: SUB, textAlign: 'left', fontWeight: 400 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {GRADE_PROMOS.map(g => (
                <tr key={g.grade} style={{ borderBottom: '0.5px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding: '8px 6px' }}>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: `${g.color}22`, color: g.color, border: `0.5px solid ${g.color}55` }}>{g.grade}</span>
                  </td>
                  <td style={{ padding: '8px 6px', color: g.color }}>{g.promos}</td>
                  <td style={{ padding: '8px 6px', color: GREEN }}>{g.point}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ marginTop: 10, fontSize: 11, color: SUB, padding: '8px 10px', background: 'rgba(123,94,167,0.05)', borderRadius: 7, border: '0.5px solid rgba(123,94,167,0.15)' }}>
          💡 포인트는 시바산 제품 구매 시 1T = ₩1 · 현금 전환 불가
        </div>
      </div>
      {/* 프로모션 종류 */}
      <div style={CARD}>
        <div style={{ fontSize: 12, color: SUB, marginBottom: 12 }}>📋 프로모션 종류</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
          {PROMOS.map(p => (
            <div key={p.key} style={{ background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: '10px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: 14, color: PURPLE, marginBottom: 4 }}>{p.key}</div>
              <div style={{ fontSize: 10, color: SUB }}>{p.desc}</div>
            </div>
          ))}
        </div>
      </div>
      {/* 접수된 발주 */}
      <div style={CARD}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: SUB }}>
            📥 발주 내역
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
                    {items.map((it, ii) => `${it.name} ${it.qty}ea`).join(' · ')}
                    {o.promo_applied && <span style={{ marginLeft: 6, color: GOLD }}>{o.promo_applied} 적용</span>}
                  </div>
                )}
                {o.points_earned > 0 && (
                  <div style={{ fontSize: 11, color: GREEN, marginBottom: 8 }}>포인트 {o.points_earned.toLocaleString()}T 적립</div>
                )}
                {o.status === 'approved' && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 11, color: SUB, marginBottom: 6 }}>📦 운송장 입력 → 저장 시 자동 발송완료</div>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
                      {(['CJ대한통운','한진','로젠','우체국','롯데'] as const).map(c => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setTrackingInputs(prev => ({ ...prev, [o.id]: { courier: c, no: prev[o.id]?.no || '' } }))}
                          style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, border: `0.5px solid ${trackingInputs[o.id]?.courier === c ? PURPLE : 'rgba(255,255,255,0.1)'}`, background: trackingInputs[o.id]?.courier === c ? 'rgba(123,94,167,0.2)' : 'transparent', color: trackingInputs[o.id]?.courier === c ? '#c4a7e7' : SUB, cursor: 'pointer' }}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input
                        value={trackingInputs[o.id]?.no || ''}
                        onChange={e => setTrackingInputs(prev => ({ ...prev, [o.id]: { courier: prev[o.id]?.courier || '', no: e.target.value } }))}
                        placeholder="운송장 번호 입력"
                        style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 7, padding: '7px 10px', fontSize: 12, color: TEXT, outline: 'none' }}
                      />
                      <button
                        type="button"
                        onClick={() => shipOrder(o)}
                        style={{ padding: '7px 14px', borderRadius: 7, border: 'none', background: PURPLE, color: '#fff', fontSize: 12, cursor: 'pointer', flexShrink: 0 }}
                      >
                        발송완료
                      </button>
                    </div>
                  </div>
                )}
                {o.status === 'shipping' && o.tracking_no && (
                  <div style={{ marginTop: 6, fontSize: 11, color: 'rgba(41,182,246,0.8)' }}>
                    📦 {o.courier} · {o.tracking_no}
                    {o.shipped_at && <span style={{ color: SUB, marginLeft: 6 }}>{new Date(o.shipped_at).toLocaleDateString('ko-KR')} 발송</span>}
                  </div>
                )}
                {o.status === 'pending' && (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button type="button" onClick={() => updateStatus(o.id, 'approved')}
                      style={{ fontSize: 11, padding: '4px 12px', borderRadius: 6, border: 'none', background: PURPLE, color: '#fff', cursor: 'pointer' }}>
                      승인
                    </button>
                    <button type="button" onClick={() => updateStatus(o.id, 'shipping')}
                      style={{ fontSize: 11, padding: '4px 12px', borderRadius: 6, border: '0.5px solid rgba(41,182,246,0.3)', background: 'rgba(41,182,246,0.08)', color: 'rgba(41,182,246,0.8)', cursor: 'pointer' }}>
                      배송중
                    </button>
                    <button type="button" onClick={() => updateStatus(o.id, 'cancelled')}
                      style={{ fontSize: 11, padding: '4px 12px', borderRadius: 6, border: '0.5px solid rgba(229,57,53,0.3)', background: 'rgba(229,57,53,0.08)', color: 'rgba(229,57,53,0.7)', cursor: 'pointer' }}>
                      취소
                    </button>
                  </div>
                )}
                {o.status === 'shipping' && (
                  <button type="button" onClick={() => updateStatus(o.id, 'done')}
                    style={{ fontSize: 11, padding: '4px 12px', borderRadius: 6, border: '0.5px solid rgba(76,175,80,0.3)', background: 'rgba(76,175,80,0.08)', color: GREEN, cursor: 'pointer' }}>
                    배송 완료
                  </button>
                )}
              </div>
            )
          })
        )}
      </div>
      {/* 아레테 포인트 */}
      <div style={CARD}>
        <div style={{ fontSize: 12, color: SUB, marginBottom: 10 }}>👑 아레테클럽 포인트 현황</div>
        <div style={{ fontSize: 11, color: SUB, padding: '8px 10px', background: 'rgba(201,169,110,0.04)', borderRadius: 7, border: '0.5px solid rgba(201,169,110,0.15)' }}>
          💡 아레테 포인트 + 발주 적립 포인트 → 시바산 제품 구매 시 통합 사용
        </div>
      </div>
    </div>
  )
}
