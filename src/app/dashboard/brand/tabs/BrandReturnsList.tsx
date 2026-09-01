'use client'
import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { CSSProperties } from 'react'
const PURPLE = '#7B5EA7'
const TEXT = 'rgba(255,255,255,0.65)'
const SUB = 'rgba(255,255,255,0.3)'
const GREEN = '#4CAF50'
const DANGER = '#E53935'
const GOLD = '#C9A96E'
const CARD: CSSProperties = { background: '#1a1520', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 14, marginBottom: 10 }
const STATUS_MAP: Record<string, { label: string; color: string }> = {
  requested: { label: '검토중', color: GOLD },
  approved:  { label: '승인됨', color: GREEN },
  received:  { label: '수령완료', color: 'rgba(41,182,246,0.8)' },
  done:      { label: '처리완료', color: SUB },
  denied:    { label: '반려', color: DANGER },
}
interface ReturnItem {
  product_id?: string | null
  name?: string
  qty?: number
  unit_price?: number
  line_amount?: number
  bonus?: number
  promo?: string | null
}
interface ReturnRow {
  id: string
  type: string
  reason_code: string
  reason_detail: string | null
  status: string
  qty: number
  return_code: string | null
  photos: string[]
  requested_by: string | null
  approved_by: string | null
  received_by: string | null
  denied_reason: string | null
  condition: string | null
  process: string | null
  created_at: string
  order_id: string | null
  items: ReturnItem[] | null
}
function isGiftReturnLine(i: ReturnItem) {
  return Math.trunc(Number(i.unit_price) || 0) === 0 && Math.trunc(Number(i.line_amount) || 0) === 0
}
interface Props { brandId: string | null; companyBrandIds: string[] }
export default function BrandReturnsList({ brandId, companyBrandIds }: Props) {
  const supabase = createClient()
  const [returns, setReturns] = useState<ReturnRow[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  const [filter, setFilter] = useState<'all' | 'requested' | 'approved' | 'received' | 'done'>('all')
  const [denyId, setDenyId] = useState<string | null>(null)
  const [denyReason, setDenyReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const showToast = (t: string) => { setToast(t); setTimeout(() => setToast(''), 2500) }
  const loadData = useCallback(async () => {
    if (!companyBrandIds.length) return
    setLoading(true)
    const { data } = await supabase
      .from('brand_returns')
      .select('id, type, reason_code, reason_detail, status, qty, return_code, photos, requested_by, approved_by, received_by, denied_reason, condition, process, created_at, order_id, items')
      .in('brand_id', companyBrandIds)
      .order('created_at', { ascending: false })
      .limit(30)
    setReturns((data || []) as ReturnRow[])
    setLoading(false)
  }, [companyBrandIds])
  useEffect(() => { void loadData() }, [loadData])
  const generateCode = () => {
    const now = new Date()
    return `RTN-${now.getFullYear().toString().slice(2)}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}-${String(Math.floor(Math.random()*1000)).padStart(3,'0')}`
  }
  const approve = async (id: string) => {
    setSaving(true)
    const code = generateCode()
    const { error } = await supabase
      .from('brand_returns')
      .update({ status: 'approved', return_code: code, approved_by: '본사 담당자' })
      .eq('id', id)
    if (!error) {
      setReturns(prev => prev.map(r => r.id === id ? { ...r, status: 'approved', return_code: code } : r))
      const row = returns.find(r => r.id === id)
      let targetOwnerId: string | null = null
      if (row?.order_id) {
        const { data: ord } = await supabase.from('brand_orders').select('profile_id').eq('id', row.order_id).maybeSingle()
        targetOwnerId = ord?.profile_id || row.requested_by || null
      } else if (row?.requested_by) {
        targetOwnerId = row.requested_by
      }
      await supabase.from('brand_messages').insert({
        brand_id: brandId,
        message_type: 'auto_order',
        target_type: targetOwnerId ? 'selected' : 'all',
        target_owner_id: targetOwnerId,
        title: '반품·교환 승인 완료',
        body: `반품·교환 신청이 승인됐어요. 반품 코드: ${code}\n코드를 제품과 함께 보내주세요.`,
        send_count: 1,
      })
      showToast(`승인 완료! 코드: ${code} · 원장님 오렌톡 발송됨`)
    } else {
      showToast('처리 실패: ' + error.message)
    }
    setSaving(false)
  }
  const deny = async (id: string) => {
    if (!denyReason.trim()) { showToast('반려 사유를 입력해주세요'); return }
    setSaving(true)
    const { error } = await supabase
      .from('brand_returns')
      .update({ status: 'denied', denied_reason: denyReason.trim() })
      .eq('id', id)
    if (!error) {
      setReturns(prev => prev.map(r => r.id === id ? { ...r, status: 'denied', denied_reason: denyReason } : r))
      const row = returns.find(r => r.id === id)
      let targetOwnerId: string | null = null
      if (row?.order_id) {
        const { data: ord } = await supabase.from('brand_orders').select('profile_id').eq('id', row.order_id).maybeSingle()
        targetOwnerId = ord?.profile_id || row.requested_by || null
      } else if (row?.requested_by) {
        targetOwnerId = row.requested_by
      }
      await supabase.from('brand_messages').insert({
        brand_id: brandId,
        message_type: 'auto_order',
        target_type: targetOwnerId ? 'selected' : 'all',
        target_owner_id: targetOwnerId,
        title: '반품·교환 반려 안내',
        body: `반품·교환 신청이 반려됐어요. 사유: ${denyReason.trim()}`,
        send_count: 1,
      })
      setDenyId(null); setDenyReason('')
      showToast('반려 처리 완료 · 원장님 오렌톡 발송됨')
    } else {
      showToast('처리 실패: ' + error.message)
    }
    setSaving(false)
  }
  const filtered = filter === 'all' ? returns : returns.filter(r => r.status === filter)
  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime()
    const d = Math.floor(diff / 86400000)
    if (d < 1) return '오늘'
    if (d < 7) return `${d}일 전`
    return new Date(iso).toLocaleDateString('ko-KR')
  }
  if (loading) return <div style={{ padding: 20, color: SUB, textAlign: 'center', fontSize: 13 }}>불러오는 중...</div>
  return (
    <div>
      {toast && <div style={{ position: 'fixed', top: 14, left: '50%', transform: 'translateX(-50%)', background: PURPLE, color: '#fff', fontSize: 12, padding: '7px 18px', borderRadius: 20, zIndex: 999, whiteSpace: 'nowrap' }}>{toast}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 12 }}>
        {[
          { label: '신청', val: returns.length, color: PURPLE },
          { label: '검토중', val: returns.filter(r => r.status === 'requested').length, color: GOLD },
          { label: '승인됨', val: returns.filter(r => r.status === 'approved').length, color: GREEN },
          { label: '완료', val: returns.filter(r => r.status === 'done').length, color: SUB },
        ].map(k => (
          <div key={k.label} style={{ background: '#1a1520', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 10, textAlign: 'center' as const }}>
            <div style={{ fontSize: 16, fontWeight: 500, color: k.color, marginBottom: 2 }}>{k.val}</div>
            <div style={{ fontSize: 11, color: SUB }}>{k.label}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const, marginBottom: 12 }}>
        {(['all','requested','approved','received','done'] as const).map(f => (
          <button key={f} type="button" onClick={() => setFilter(f)}
            style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, border: `0.5px solid ${filter === f ? PURPLE : 'rgba(255,255,255,0.1)'}`, background: filter === f ? 'rgba(123,94,167,0.2)' : 'transparent', color: filter === f ? '#c4a7e7' : SUB, cursor: 'pointer' }}>
            {f === 'all' ? '전체' : STATUS_MAP[f]?.label}
          </button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <div style={CARD}>
          <div style={{ textAlign: 'center', padding: '20px 0', color: SUB, fontSize: 13 }}>반품·교환 신청이 없어요</div>
        </div>
      ) : filtered.map(r => {
        const st = STATUS_MAP[r.status] || { label: r.status, color: SUB }
        return (
          <div
            key={r.id}
            style={{ ...CARD, cursor: 'pointer' }}
            onClick={() => setExpandedId((id) => id === r.id ? null : r.id)}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, flexWrap: 'wrap' as const }}>
                  <span style={{ fontSize: 11, padding: '1px 8px', borderRadius: 10, background: r.type === 'exchange' ? 'rgba(123,94,167,0.2)' : 'rgba(229,57,53,0.1)', color: r.type === 'exchange' ? '#c4a7e7' : DANGER }}>
                    {r.type === 'exchange' ? '교환' : '반품'}
                  </span>
                  <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 10, background: `${st.color}18`, color: st.color }}>{st.label}</span>
                </div>
                <div style={{ fontSize: 13, color: TEXT, marginBottom: 2 }}>{r.reason_code} · {r.qty}개</div>
                {r.reason_detail && <div style={{ fontSize: 11, color: SUB, marginBottom: 2 }}>{r.reason_detail}</div>}
                {r.return_code && <div style={{ fontSize: 11, color: GREEN }}>코드: {r.return_code}</div>}
                {r.condition && <div style={{ fontSize: 11, color: SUB }}>수령 상태: {r.condition} · {r.process}</div>}
                {r.denied_reason && <div style={{ fontSize: 11, color: DANGER }}>반려 사유: {r.denied_reason}</div>}
              </div>
              <span style={{ fontSize: 11, color: SUB, flexShrink: 0 }}>{timeAgo(r.created_at)}</span>
            </div>
            {expandedId === r.id && Array.isArray(r.items) && r.items.length > 0 && (
              <div style={{ marginBottom: 10, padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.03)' }}>
                {r.items.map((it, idx) => {
                  const giftSku = isGiftReturnLine(it)
                  const bonus = Math.trunc(Number(it.bonus) || 0)
                  return (
                    <div key={`${it.product_id || it.name}-${idx}`} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: TEXT, padding: '3px 0' }}>
                      <span style={{ flex: 1 }}>{it.name || '품목'} · {Math.trunc(Number(it.qty) || 0)}개</span>
                      {giftSku && (
                        <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 8, background: 'rgba(123,94,167,0.2)', color: '#c4a7e7' }}>증정</span>
                      )}
                      {bonus > 0 && (
                        <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 8, background: 'rgba(123,94,167,0.2)', color: '#c4a7e7' }}>+{bonus} 증정</span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
            {expandedId === r.id && (!Array.isArray(r.items) || r.items.length === 0) && (
              <div style={{ fontSize: 11, color: SUB, marginBottom: 10 }}>품목 스냅샷이 없는 이전 신청이에요</div>
            )}
            {Array.isArray(r.photos) && r.photos.length > 0 && (
              <div style={{ display: 'flex', gap: 6, marginBottom: 8 }} onClick={(e) => e.stopPropagation()}>
                {r.photos.slice(0,3).map((p, pi) => (
                  <div key={pi} style={{ width: 48, height: 48, borderRadius: 6, background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>📷</div>
                ))}
              </div>
            )}
            {r.status === 'requested' && (
              <div onClick={(e) => e.stopPropagation()}>
                {denyId === r.id ? (
                  <div>
                    <input value={denyReason} onChange={e => setDenyReason(e.target.value)} placeholder="반려 사유 입력"
                      style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '7px 10px', fontSize: 12, color: TEXT, outline: 'none', marginBottom: 6 }} />
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button type="button" onClick={() => void deny(r.id)} disabled={saving}
                        style={{ flex: 1, padding: '6px', borderRadius: 6, border: 'none', background: DANGER, color: '#fff', fontSize: 11, cursor: 'pointer' }}>반려 확정</button>
                      <button type="button" onClick={() => { setDenyId(null); setDenyReason('') }}
                        style={{ padding: '6px 10px', borderRadius: 6, border: '0.5px solid rgba(255,255,255,0.1)', background: 'transparent', color: SUB, fontSize: 11, cursor: 'pointer' }}>취소</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button type="button" onClick={() => void approve(r.id)} disabled={saving}
                      style={{ flex: 1, padding: '7px', borderRadius: 6, border: 'none', background: 'rgba(76,175,80,0.15)', color: GREEN, fontSize: 12, cursor: 'pointer' }}>
                      ✅ 승인 + 코드 발급
                    </button>
                    <button type="button" onClick={() => setDenyId(r.id)}
                      style={{ padding: '7px 12px', borderRadius: 6, border: `0.5px solid rgba(229,57,53,0.3)`, background: 'rgba(229,57,53,0.08)', color: DANGER, fontSize: 12, cursor: 'pointer' }}>
                      반려
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
