'use client'
import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { notifyRestockIfNeeded } from '@/lib/brand/notifyRestock'
import { notifyOwners } from '@/lib/brand/notifyOwners'
import type { CSSProperties } from 'react'
const PURPLE = '#7B5EA7'
const TEXT = 'rgba(255,255,255,0.65)'
const SUB = 'rgba(255,255,255,0.3)'
const GREEN = '#4CAF50'
const DANGER = '#E53935'
const GOLD = '#C9A96E'
const CARD: CSSProperties = { background: '#1a1520', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 14, marginBottom: 10 }
const CONDITIONS = ['정상', '파손·불량', '유통기한 문제', '기타'] as const
const RESTOCK_ALLOWED_CONDITIONS = ['정상']
const REASON_CONDITION_MAP: Record<string, string> = {
  '제품 불량·파손': '파손·불량',
  '배송 중 파손': '파손·불량',
  '유통기한 임박': '유통기한 문제',
  '오배송': '정상',
  '수량 오류': '정상',
  '단순 변심': '정상',
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
  brand_id: string
  type: string
  reason_code: string
  reason_detail: string | null
  status: string
  qty: number
  return_code: string | null
  inventory_id: string | null
  photos: string[] | null
  created_at: string
  order_id: string | null
  requested_by: string | null
  items: ReturnItem[] | null
}
interface Props { brandId: string | null; companyBrandIds: string[] }

type InvHit = { id: string; total_stock: number; product_name: string | null; brand_id: string }

async function matchInventoryForReturn(
  supabase: ReturnType<typeof createClient>,
  item: ReturnItem,
  brandId: string,
  companyBrandIds: string[],
): Promise<InvHit | null> {
  const companyIds = Array.from(new Set([brandId, ...companyBrandIds].filter(Boolean)))
  const lookup = async (scope: string[], byProductId: boolean) => {
    let q = supabase.from('brand_inventory').select('id, total_stock, product_name, brand_id').in('brand_id', scope)
    if (byProductId && item.product_id) q = q.eq('product_id', String(item.product_id))
    else q = q.eq('product_name', String(item.name || ''))
    const { data } = await q.limit(1).maybeSingle()
    return (data as InvHit | null) || null
  }
  if (item.product_id) {
    const byBrandId = await lookup([brandId], true)
    if (byBrandId) return byBrandId
    const byCompanyId = await lookup(companyIds, true)
    if (byCompanyId) return byCompanyId
  }
  if (item.name) {
    const byBrandName = await lookup([brandId], false)
    if (byBrandName) return byBrandName
    return lookup(companyIds, false)
  }
  return null
}
export default function BrandReturnsReceive({ brandId, companyBrandIds }: Props) {
  const supabase = createClient()
  const [codeInput, setCodeInput] = useState('')
  const [matched, setMatched] = useState<ReturnRow | null>(null)
  const [condition, setCondition] = useState('')
  const [process, setProcess] = useState('')
  const [disposeMemo, setDisposeMemo] = useState('')
  const [staffName, setStaffName] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [toast, setToast] = useState('')
  const [pending, setPending] = useState<ReturnRow[]>([])
  const [loading, setLoading] = useState(true)
  const showToast = (t: string) => { setToast(t); setTimeout(() => setToast(''), 2500) }
  const loadPending = useCallback(async () => {
    if (!companyBrandIds.length) return
    setLoading(true)
    const { data } = await supabase
      .from('brand_returns')
      .select('id, brand_id, type, reason_code, reason_detail, status, qty, return_code, inventory_id, photos, created_at, order_id, requested_by, items')
      .in('brand_id', companyBrandIds)
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
    setPending((data || []) as ReturnRow[])
    setLoading(false)
  }, [companyBrandIds])
  useEffect(() => { void loadPending() }, [loadPending])
  const selectMatch = (row: ReturnRow) => {
    setMatched(row)
    const suggested = REASON_CONDITION_MAP[row.reason_code] || ''
    setCondition(suggested)
    setProcess('')
    setDisposeMemo('')
  }
  const searchCode = () => {
    if (!codeInput.trim()) { showToast('코드를 입력해주세요'); return }
    const found = pending.find(r => r.return_code === codeInput.trim())
    if (found) { selectMatch(found); showToast(`코드 확인됨: ${found.reason_code} · ${found.qty}개`) }
    else showToast('일치하는 반품 코드 없음')
  }
  const selectCondition = (c: string) => {
    setCondition(c)
    if (!RESTOCK_ALLOWED_CONDITIONS.includes(c) && process === '재고 반영') {
      setProcess('')
    }
  }
  const availableProcesses = RESTOCK_ALLOWED_CONDITIONS.includes(condition)
    ? ['재고 반영', '폐기 (본사확인 필요)']
    : ['폐기 (본사확인 필요)']
  const completeReceive = async () => {
    if (!condition) { showToast('수령 상태를 선택해주세요'); return }
    if (!process) { showToast('처리 방법을 선택해주세요'); return }
    if (!staffName.trim()) { showToast('담당자 이름을 입력해주세요'); return }
    const isRestock = process === '재고 반영' && RESTOCK_ALLOWED_CONDITIONS.includes(condition)
    if (!isRestock && !disposeMemo.trim()) { showToast('폐기 사유 메모를 입력해주세요'); return }
    if (!matched || !brandId) return
    setSaving(true)
    const lines = Array.isArray(matched.items) ? matched.items : []
    const unmatched: string[] = []
    let restocked = 0
    try {
      if (isRestock) {
        if (lines.length === 0) {
          showToast('반품 품목(items)이 없어 재고를 반영할 수 없어요')
          return
        }
        for (const item of lines) {
          const bonusQty = Math.trunc(Number(item.bonus) || 0)
          const saleQty = Math.trunc(Number(item.qty) || 0)
          const outQty = saleQty + bonusQty
          if (outQty <= 0) continue
          const label = String(item.name || item.product_id || '품목')
          const giftSku = Math.trunc(Number(item.unit_price) || 0) === 0 && Math.trunc(Number(item.line_amount) || 0) === 0
          const invRow = await matchInventoryForReturn(supabase, item, matched.brand_id || brandId, companyBrandIds)
          if (!invRow) {
            unmatched.push(label)
            console.warn(`[반품입고 실패] 매칭 안 됨: ${label} (return ${matched.id})`)
            await supabase.from('brand_stock_logs').insert({
              brand_id: matched.brand_id || brandId,
              inventory_id: null,
              type: 'adjust',
              qty: outQty,
              before_qty: 0,
              after_qty: 0,
              ref_type: 'return',
              ref_id: matched.id,
              staff_name: staffName.trim(),
              memo: `재고매칭 실패로 미입고: ${label} (product_id: ${item.product_id || '없음'})`,
            })
            continue
          }
          await supabase.rpc('increment_inventory_stock', { p_inventory_id: invRow.id, p_qty: outQty })
          await notifyRestockIfNeeded(supabase, {
            brandId: invRow.brand_id || matched.brand_id || brandId,
            productName: invRow.product_name || label,
            beforeStock: Math.trunc(Number(invRow.total_stock) || 0),
          })
          const midStock = Math.trunc(Number(invRow.total_stock) || 0) + saleQty
          const logRows: Record<string, unknown>[] = []
          if (saleQty > 0) {
            logRows.push({
              brand_id: invRow.brand_id || matched.brand_id || brandId,
              inventory_id: invRow.id,
              type: 'return_in',
              qty: saleQty,
              before_qty: invRow.total_stock,
              after_qty: midStock,
              ref_type: 'return',
              ref_id: matched.id,
              staff_name: staffName.trim(),
              memo: `반품 입고(${giftSku ? '증정SKU' : '판매'}): ${label} ${saleQty}개 · ${condition}`,
              is_gift: giftSku,
            })
          }
          if (bonusQty > 0) {
            logRows.push({
              brand_id: invRow.brand_id || matched.brand_id || brandId,
              inventory_id: invRow.id,
              type: 'return_in',
              qty: bonusQty,
              before_qty: saleQty > 0 ? midStock : invRow.total_stock,
              after_qty: (saleQty > 0 ? midStock : Math.trunc(Number(invRow.total_stock) || 0)) + bonusQty,
              ref_type: 'return',
              ref_id: matched.id,
              staff_name: staffName.trim(),
              memo: `반품 입고(증정): ${label} ${bonusQty}개 · ${condition}`,
              is_gift: true,
            })
          }
          if (logRows.length > 0) {
            await supabase.from('brand_stock_logs').insert(logRows)
          }
          restocked += 1
        }
        if (restocked === 0) {
          showToast(`재고 매칭 실패로 입고되지 않았어요: ${unmatched.join(', ')}`)
          return
        }
      } else if (lines.length > 0) {
        for (const item of lines) {
          const outQty = Math.trunc(Number(item.qty) || 0) + Math.trunc(Number(item.bonus) || 0)
          if (outQty <= 0) continue
          const label = String(item.name || item.product_id || '품목')
          const invRow = await matchInventoryForReturn(supabase, item, matched.brand_id || brandId, companyBrandIds)
          if (!invRow) {
            unmatched.push(label)
            console.warn(`[반품폐기 로그] 매칭 안 됨: ${label} (return ${matched.id})`)
            await supabase.from('brand_stock_logs').insert({
              brand_id: matched.brand_id || brandId,
              inventory_id: null,
              type: 'adjust',
              qty: outQty,
              before_qty: 0,
              after_qty: 0,
              ref_type: 'dispose',
              ref_id: matched.id,
              staff_name: staffName.trim(),
              memo: `재고매칭 실패(폐기 기록만): ${label} (product_id: ${item.product_id || '없음'}) · ${disposeMemo.trim()}`,
            })
            continue
          }
          await supabase.from('brand_stock_logs').insert({
            brand_id: invRow.brand_id || matched.brand_id || brandId,
            inventory_id: invRow.id,
            type: 'out',
            qty: outQty,
            before_qty: 0,
            after_qty: 0,
            ref_type: 'dispose',
            ref_id: matched.id,
            staff_name: staffName.trim(),
            memo: `[폐기] ${condition} · ${disposeMemo.trim()} · ${label}`,
          })
        }
      } else if (matched.inventory_id) {
        await supabase.from('brand_stock_logs').insert({
          brand_id: brandId,
          inventory_id: matched.inventory_id,
          type: 'out',
          qty: matched.qty,
          before_qty: 0,
          after_qty: 0,
          ref_type: 'dispose',
          ref_id: matched.id,
          staff_name: staffName.trim(),
          memo: `[폐기] ${condition} · ${disposeMemo.trim()}`,
        })
      }

      const { error } = await supabase
        .from('brand_returns')
        .update({
          status: isRestock ? 'done' : 'received',
          condition,
          process: isRestock ? 'restock' : 'dispose',
          received_by: staffName.trim(),
        })
        .eq('id', matched.id)
      if (error) {
        showToast('처리 실패: ' + error.message)
        return
      }

      let targetOwnerId: string | null = null
      if (matched.order_id) {
        const { data: ord } = await supabase.from('brand_orders').select('profile_id').eq('id', matched.order_id).maybeSingle()
        targetOwnerId = (ord as { profile_id?: string } | null)?.profile_id || matched.requested_by || null
      } else if (matched.requested_by) {
        targetOwnerId = matched.requested_by
      }
      if (brandId) {
        const { data: brandRow } = await supabase.from('brands').select('company_id').eq('id', brandId).maybeSingle()
        const companyId = (brandRow as { company_id?: string | null } | null)?.company_id
        if (companyId) {
          await notifyOwners(supabase, {
            companyId: String(companyId),
            target: targetOwnerId ? { type: 'one', ownerId: targetOwnerId } : { type: 'all' },
            title: '반품 수령 완료',
            body: `반품 제품이 수령됐어요. 상태: ${condition} · 처리: ${isRestock ? '재고 반영' : '폐기 처리(본사 확인 필요)'}`,
          })
        }
      }
      setDone(true)
      if (unmatched.length > 0) {
        showToast(`${isRestock ? '수령 완료' : '폐기 기록'} · 매칭 실패 ${unmatched.length}건: ${unmatched.join(', ')}`)
      } else {
        showToast(isRestock ? '수령 완료! 재고 자동 반영됨' : '수령 완료! 폐기 기록 저장됨')
      }
      void loadPending()
    } finally {
      setSaving(false)
    }
  }
  if (loading) return <div style={{ padding: 20, color: SUB, textAlign: 'center', fontSize: 13 }}>불러오는 중...</div>
  return (
    <div>
      {toast && <div style={{ position: 'fixed', top: 14, left: '50%', transform: 'translateX(-50%)', background: PURPLE, color: '#fff', fontSize: 12, padding: '7px 18px', borderRadius: 20, zIndex: 999, whiteSpace: 'nowrap' }}>{toast}</div>}
      <div style={{ ...CARD, borderColor: 'rgba(201,169,110,0.3)' }}>
        <div style={{ fontSize: 12, color: GOLD, marginBottom: 10 }}>📦 반품 코드 확인 (필수)</div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          <input value={codeInput} onChange={e => setCodeInput(e.target.value.toUpperCase())} placeholder="RTN-XXXXXX-XXX"
            style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: `0.5px solid ${matched ? 'rgba(76,175,80,0.4)' : 'rgba(255,255,255,0.1)'}`, borderRadius: 7, padding: '8px 10px', fontSize: 13, color: TEXT, outline: 'none', letterSpacing: 1 }} />
          <button type="button" onClick={searchCode}
            style={{ padding: '8px 14px', borderRadius: 7, border: 'none', background: GOLD, color: '#fff', fontSize: 12, cursor: 'pointer', flexShrink: 0 }}>
            확인
          </button>
        </div>
        <div style={{ fontSize: 11, color: SUB }}>코드 없는 반품은 수령 불가 · 코드는 본사 승인 시 발급됩니다</div>
      </div>
      {matched && !done && (
        <>
          <div style={{ ...CARD, borderColor: 'rgba(76,175,80,0.3)' }}>
            <div style={{ fontSize: 11, color: GREEN, marginBottom: 8 }}>✓ 코드 확인됨</div>
            <div style={{ fontSize: 13, color: TEXT, marginBottom: 4 }}>{matched.type === 'exchange' ? '교환' : '반품'} · {matched.reason_code}</div>
            <div style={{ fontSize: 12, color: SUB, marginBottom: 8 }}>수량: {matched.qty}개 · 코드: {matched.return_code}</div>
            {Array.isArray(matched.items) && matched.items.length > 0 && (
              <div style={{ fontSize: 12, color: TEXT, marginBottom: 8 }}>
                {matched.items.map((it, idx) => {
                  const giftSku = Math.trunc(Number(it.unit_price) || 0) === 0 && Math.trunc(Number(it.line_amount) || 0) === 0
                  const bonus = Math.trunc(Number(it.bonus) || 0)
                  return (
                    <div key={`${it.product_id || it.name}-${idx}`} style={{ padding: '2px 0' }}>
                      {it.name || '품목'} · {Math.trunc(Number(it.qty) || 0)}개
                      {giftSku ? ' · 증정' : ''}
                      {bonus > 0 ? ` · +${bonus} 증정` : ''}
                    </div>
                  )
                })}
              </div>
            )}
            {matched.reason_detail && (
              <div style={{ fontSize: 12, color: TEXT, background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '8px 10px', marginBottom: matched.photos && matched.photos.length > 0 ? 8 : 0 }}>
                "{matched.reason_detail}"
              </div>
            )}
            {matched.photos && matched.photos.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
                {matched.photos.map((url) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={url} src={url} alt="" onClick={() => window.open(url, '_blank')} style={{ width: 56, height: 56, borderRadius: 8, objectFit: 'cover', cursor: 'pointer' }} />
                ))}
              </div>
            )}
          </div>
          <div style={CARD}>
            <div style={{ fontSize: 11, color: SUB, marginBottom: 8 }}>수령 상태 선택 (필수, 원장 신청사유 기준 자동선택됨 — 확인 후 필요시 변경)</div>
            <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 5, marginBottom: 12 }}>
              {CONDITIONS.map(c => (
                <button key={c} type="button" onClick={() => selectCondition(c)}
                  style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: `0.5px solid ${condition === c ? PURPLE : 'rgba(255,255,255,0.1)'}`, background: condition === c ? 'rgba(123,94,167,0.2)' : 'transparent', color: condition === c ? '#c4a7e7' : SUB, cursor: 'pointer' }}>
                  {c}
                </button>
              ))}
            </div>
            {condition && !RESTOCK_ALLOWED_CONDITIONS.includes(condition) && (
              <div style={{ fontSize: 11, color: DANGER, marginBottom: 10, padding: '6px 10px', background: 'rgba(229,57,53,0.08)', borderRadius: 6 }}>
                ⚠️ 정상 상태가 아니라 "재고 반영"은 선택할 수 없어요. 폐기 처리만 가능해요.
              </div>
            )}
            <div style={{ fontSize: 11, color: SUB, marginBottom: 8 }}>처리 방법 (필수)</div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
              {availableProcesses.map(p => (
                <button key={p} type="button" onClick={() => setProcess(p)}
                  style={{ flex: 1, padding: '7px', borderRadius: 6, border: `0.5px solid ${process === p ? (p.includes('폐기') ? DANGER : GREEN) : 'rgba(255,255,255,0.1)'}`, background: process === p ? (p.includes('폐기') ? 'rgba(229,57,53,0.1)' : 'rgba(76,175,80,0.1)') : 'transparent', color: process === p ? (p.includes('폐기') ? DANGER : GREEN) : SUB, fontSize: 11, cursor: 'pointer' }}>
                  {p}
                </button>
              ))}
            </div>
            {process.includes('폐기') && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: SUB, marginBottom: 6 }}>폐기 사유 메모 (필수)</div>
                <textarea value={disposeMemo} onChange={e => setDisposeMemo(e.target.value)} placeholder="예: 배송중 파손 확인, 재판매 불가"
                  rows={2}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(229,57,53,0.25)', borderRadius: 6, padding: '7px 10px', fontSize: 12, color: TEXT, outline: 'none', resize: 'none' as const }} />
              </div>
            )}
            <div style={{ fontSize: 11, color: SUB, marginBottom: 6 }}>담당자</div>
            <input value={staffName} onChange={e => setStaffName(e.target.value)} placeholder="이름 입력"
              style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '7px 10px', fontSize: 12, color: TEXT, outline: 'none', marginBottom: 10 }} />
            <div style={{ padding: '8px 10px', background: 'rgba(229,57,53,0.06)', border: '0.5px solid rgba(229,57,53,0.2)', borderRadius: 6, fontSize: 11, color: 'rgba(229,57,53,0.7)', marginBottom: 10, lineHeight: 1.6 }}>
              ⚠️ 처리 후 수정 불가 · 담당자 이름 자동 기록 · 본사 자동 통보
            </div>
            <button type="button" onClick={() => void completeReceive()} disabled={saving}
              style={{ width: '100%', padding: '10px', borderRadius: 8, border: 'none', background: saving ? 'rgba(123,94,167,0.4)' : PURPLE, color: '#fff', fontSize: 13, cursor: saving ? 'not-allowed' : 'pointer' }}>
              {saving ? '처리 중...' : '수령 처리 완료'}
            </button>
          </div>
        </>
      )}
      {done && (
        <div style={{ ...CARD, borderColor: 'rgba(76,175,80,0.3)' }}>
          <div style={{ fontSize: 13, color: GREEN, marginBottom: 4 }}>✓ 수령 처리 완료</div>
          <div style={{ fontSize: 12, color: SUB, marginBottom: 10 }}>본사 자동 통보됨 · 수정 불가 이력 저장됨</div>
          <button type="button" onClick={() => { setDone(false); setMatched(null); setCodeInput(''); setCondition(''); setProcess(''); setDisposeMemo(''); setStaffName('') }}
            style={{ width: '100%', padding: '8px', borderRadius: 6, border: '0.5px solid rgba(255,255,255,0.1)', background: 'transparent', color: SUB, fontSize: 12, cursor: 'pointer' }}>
            추가 수령 처리
          </button>
        </div>
      )}
      {pending.length > 0 && !matched && (
        <div style={CARD}>
          <div style={{ fontSize: 12, color: SUB, marginBottom: 10 }}>수령 대기 목록 ({pending.length}건)</div>
          {pending.map((r, i) => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: i < pending.length-1 ? '0.5px solid rgba(255,255,255,0.05)' : 'none', cursor: 'pointer' }}
              onClick={() => { setCodeInput(r.return_code || ''); selectMatch(r) }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: TEXT }}>{r.type === 'exchange' ? '교환' : '반품'} · {r.reason_code} · {r.qty}개</div>
                {Array.isArray(r.items) && r.items.length > 0 && (
                  <div style={{ fontSize: 11, color: SUB }}>
                    {r.items.slice(0, 2).map((it) => it.name).filter(Boolean).join(', ')}
                    {r.items.length > 2 ? ` 외 ${r.items.length - 2}` : ''}
                  </div>
                )}
                <div style={{ fontSize: 11, color: GREEN }}>{r.return_code}</div>
              </div>
              {r.photos && r.photos.length > 0 && (
                <span style={{ fontSize: 11, color: GOLD }}>📷 {r.photos.length}</span>
              )}
              <span style={{ fontSize: 11, color: SUB }}>탭하여 선택</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
