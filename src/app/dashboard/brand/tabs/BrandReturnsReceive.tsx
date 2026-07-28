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
const CONDITIONS = ['정상', '파손·불량', '유통기한 문제', '기타'] as const
const RESTOCK_ALLOWED_CONDITIONS = ['정상']
interface ReturnRow {
  id: string
  type: string
  reason_code: string
  status: string
  qty: number
  return_code: string | null
  inventory_id: string | null
  created_at: string
}
interface Props { brandId: string | null }
export default function BrandReturnsReceive({ brandId }: Props) {
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
    if (!brandId) return
    setLoading(true)
    const { data } = await supabase
      .from('brand_returns')
      .select('id, type, reason_code, status, qty, return_code, inventory_id, created_at')
      .eq('brand_id', brandId)
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
    setPending((data || []) as ReturnRow[])
    setLoading(false)
  }, [brandId])
  useEffect(() => { void loadPending() }, [loadPending])
  const searchCode = () => {
    if (!codeInput.trim()) { showToast('코드를 입력해주세요'); return }
    const found = pending.find(r => r.return_code === codeInput.trim())
    if (found) { setMatched(found); showToast(`코드 확인됨: ${found.reason_code} · ${found.qty}개`) }
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
    const { error } = await supabase
      .from('brand_returns')
      .update({
        status: isRestock ? 'done' : 'received',
        condition,
        process: isRestock ? 'restock' : 'dispose',
        received_by: staffName.trim(),
      })
      .eq('id', matched.id)
    if (!error) {
      if (isRestock && matched.inventory_id) {
        await supabase.rpc('increment_inventory_stock', { p_inventory_id: matched.inventory_id, p_qty: matched.qty })
        await supabase.from('brand_stock_logs').insert({
          brand_id: brandId,
          inventory_id: matched.inventory_id,
          type: 'return_in',
          qty: matched.qty,
          before_qty: 0,
          after_qty: matched.qty,
          ref_type: 'return',
          ref_id: matched.id,
          staff_name: staffName.trim(),
          memo: `반품 입고: ${matched.reason_code} · ${condition}`,
        })
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
      await supabase.from('brand_messages').insert({
        brand_id: brandId,
        message_type: 'auto_order',
        target_type: 'all',
        title: `반품 수령 완료`,
        body: `반품 제품이 수령됐어요. 상태: ${condition} · 처리: ${isRestock ? '재고 반영' : '폐기 처리(본사 확인 필요)'}`,
        send_count: 1,
      })
      setDone(true)
      showToast(isRestock ? '수령 완료! 재고 자동 반영됨' : '수령 완료! 폐기 기록 저장됨')
      void loadPending()
    } else {
      showToast('처리 실패: ' + error.message)
    }
    setSaving(false)
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
            <div style={{ fontSize: 12, color: SUB }}>수량: {matched.qty}개 · 코드: {matched.return_code}</div>
          </div>
          <div style={CARD}>
            <div style={{ fontSize: 11, color: SUB, marginBottom: 8 }}>수령 상태 선택 (필수)</div>
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
              onClick={() => { setCodeInput(r.return_code || ''); setMatched(r) }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: TEXT }}>{r.type === 'exchange' ? '교환' : '반품'} · {r.reason_code} · {r.qty}개</div>
                <div style={{ fontSize: 11, color: GREEN }}>{r.return_code}</div>
              </div>
              <span style={{ fontSize: 11, color: SUB }}>탭하여 선택</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
