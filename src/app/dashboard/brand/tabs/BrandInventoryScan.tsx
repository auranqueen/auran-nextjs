'use client'
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { CSSProperties } from 'react'
const PURPLE = '#7B5EA7'
const TEXT = 'rgba(255,255,255,0.65)'
const SUB = 'rgba(255,255,255,0.3)'
const CARD: CSSProperties = { background: '#1a1520', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 14, marginBottom: 10 }
interface InventoryRow {
  id: string
  product_name: string
  total_stock: number
  safety_stock: number
}
interface LotRow {
  id: string
  inventory_id: string
  lot_number: string
  remaining_qty: number
  expires_at: string | null
  brand_inventory: { product_name: string } | null
}
interface LogRow {
  id: string
  type: string
  qty: number
  memo: string | null
  staff_name: string | null
  created_at: string
  brand_inventory: { product_name: string } | null
}
interface Props {
  brandId: string | null
  brandName: string
}
export default function BrandInventoryScan({ brandId, brandName }: Props) {
  const supabase = createClient()
  const [mode, setMode] = useState<'in' | 'out'>('in')
  const [inventories, setInventories] = useState<InventoryRow[]>([])
  const [lots, setLots] = useState<LotRow[]>([])
  const [logs, setLogs] = useState<LogRow[]>([])
  const [selInv, setSelInv] = useState('')
  const [selLot, setSelLot] = useState('')
  const [qty, setQty] = useState(1)
  const [staffName, setStaffName] = useState('')
  const [memo, setMemo] = useState('')
  const [barcodeInput, setBarcodeInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const barcodeRef = useRef<HTMLInputElement>(null)
  const showToast = (t: string) => { setToast(t); setTimeout(() => setToast(''), 2500) }
  const loadData = useCallback(async () => {
    if (!brandId) return
    const [{ data: invData }, { data: lotData }, { data: logData }] = await Promise.all([
      supabase.from('brand_inventory').select('id, product_name, total_stock, safety_stock').eq('brand_id', brandId).order('product_name'),
      supabase.from('brand_inventory_lots').select('id, inventory_id, lot_number, remaining_qty, expires_at, brand_inventory(product_name)').eq('brand_id', brandId).eq('status', 'active').order('expires_at', { ascending: true }),
      supabase.from('brand_stock_logs').select('id, type, qty, memo, staff_name, created_at, brand_inventory(product_name)').eq('brand_id', brandId).order('created_at', { ascending: false }).limit(20),
    ])
    setInventories((invData || []) as InventoryRow[])
    setLots((lotData || []) as unknown as LotRow[])
    setLogs((logData || []) as unknown as LogRow[])
  }, [brandId])
  useEffect(() => { void loadData() }, [loadData])
  const filteredLots = lots.filter(l => l.inventory_id === selInv)
  const handleBarcodeInput = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && barcodeInput.trim()) {
      const matched = lots.find(l => l.lot_number === barcodeInput.trim())
      if (matched) {
        setSelInv(matched.inventory_id)
        setSelLot(matched.id)
        showToast(`스캔 완료: ${(matched.brand_inventory as { product_name?: string })?.product_name} — ${matched.lot_number}`)
      } else {
        showToast('일치하는 로트 없음: ' + barcodeInput.trim())
      }
      setBarcodeInput('')
    }
  }
  const processIO = async () => {
    if (!selInv || !qty || !brandId) { showToast('제품과 수량을 선택해주세요'); return }
    const inv = inventories.find(i => i.id === selInv)
    if (!inv) return
    if (mode === 'out' && inv.total_stock < qty) { showToast(`재고 부족! 현재 ${inv.total_stock}개`); return }
    setSaving(true)
    const before = inv.total_stock
    const after = mode === 'in' ? before + qty : before - qty
    const { error } = await supabase.from('brand_stock_logs').insert({
      brand_id: brandId,
      inventory_id: selInv,
      lot_id: selLot || null,
      type: mode,
      qty,
      before_qty: before,
      after_qty: after,
      ref_type: 'manual',
      staff_name: staffName || '담당자',
      memo: memo || (mode === 'in' ? '수동 입고' : '수동 출고'),
    })
    if (!error) {
      if (mode === 'in') {
        await supabase.rpc('increment_inventory_stock', { p_inventory_id: selInv, p_qty: qty })
      } else {
        await supabase.rpc('decrement_inventory_stock', { p_inventory_id: selInv, p_qty: qty })
      }
      if (selLot) {
        const lot = lots.find(l => l.id === selLot)
        if (lot) {
          const newRem = mode === 'in' ? lot.remaining_qty + qty : Math.max(0, lot.remaining_qty - qty)
          await supabase.from('brand_inventory_lots').update({ remaining_qty: newRem }).eq('id', selLot)
        }
      }
      if (mode === 'out' && after <= inv.safety_stock && inv.safety_stock > 0) {
        await supabase.from('brand_messages').insert({
          brand_id: brandId,
          message_type: 'auto_order',
          target_type: 'all',
          title: `⚠️ ${inv.product_name} 안전재고 이하`,
          body: `${inv.product_name} 재고가 ${after}개로 안전재고(${inv.safety_stock}개) 이하입니다. 생산 발주를 검토해주세요.`,
          send_count: 1,
        })
        showToast(`⚠️ ${inv.product_name} 안전재고 이하! 본사 알림 발송`)
      } else {
        showToast(`${inv.product_name} ${qty}개 ${mode === 'in' ? '입고' : '출고'} 완료! 재고: ${after}개`)
      }
      setQty(1); setMemo(''); setSelLot('')
      void loadData()
    } else {
      showToast('처리 실패: ' + error.message)
    }
    setSaving(false)
  }
  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime()
    const m = Math.floor(diff / 60000)
    if (m < 1) return '방금'
    if (m < 60) return `${m}분 전`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}시간 전`
    return `${Math.floor(h / 24)}일 전`
  }
  return (
    <div>
      {toast && <div style={{ position: 'fixed', top: 14, left: '50%', transform: 'translateX(-50%)', background: PURPLE, color: '#fff', fontSize: 12, padding: '7px 18px', borderRadius: 20, zIndex: 999, whiteSpace: 'nowrap' }}>{toast}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
        {([['in','입고 (+)','#4CAF50'],['out','출고 (-)','#E53935']] as const).map(([m, label, color]) => (
          <button key={m} type="button" onClick={() => setMode(m)}
            style={{ padding: 10, borderRadius: 8, border: `2px solid ${mode === m ? color : 'rgba(255,255,255,0.1)'}`, background: mode === m ? `${color}18` : 'transparent', color: mode === m ? color : SUB, fontSize: 13, cursor: 'pointer' }}>
            {label}
          </button>
        ))}
      </div>
      <div style={CARD}>
        <div style={{ fontSize: 11, color: SUB, marginBottom: 6 }}>바코드 스캐너 또는 QR 스캔</div>
        <input
          ref={barcodeRef}
          value={barcodeInput}
          onChange={e => setBarcodeInput(e.target.value)}
          onKeyDown={handleBarcodeInput}
          placeholder="스캔 후 자동 입력 (Enter로 확인)"
          style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: `0.5px solid ${barcodeInput ? PURPLE : 'rgba(255,255,255,0.1)'}`, borderRadius: 7, padding: '9px 10px', fontSize: 12, color: TEXT, outline: 'none', marginBottom: 8 }}
        />
        <button type="button" onClick={() => showToast('카메라 스캔 — ZXing 구현 예정')}
          style={{ width: '100%', padding: '8px', borderRadius: 7, border: `0.5px solid ${PURPLE}`, background: 'rgba(123,94,167,0.1)', color: '#c4a7e7', fontSize: 12, cursor: 'pointer' }}>
          📷 카메라로 QR/바코드 스캔
        </button>
      </div>
      <div style={CARD}>
        <div style={{ fontSize: 11, color: SUB, marginBottom: 8 }}>제품 선택</div>
        <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 5, marginBottom: 12 }}>
          {inventories.map(inv => (
            <button key={inv.id} type="button" onClick={() => { setSelInv(inv.id); setSelLot('') }}
              style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: `0.5px solid ${selInv === inv.id ? PURPLE : 'rgba(255,255,255,0.1)'}`, background: selInv === inv.id ? 'rgba(123,94,167,0.2)' : 'transparent', color: selInv === inv.id ? '#c4a7e7' : SUB, cursor: 'pointer' }}>
              {inv.product_name}
              <span style={{ marginLeft: 4, fontSize: 10, color: inv.total_stock <= inv.safety_stock ? '#E53935' : SUB }}>({inv.total_stock})</span>
            </button>
          ))}
        </div>
        {selInv && filteredLots.length > 0 && (
          <>
            <div style={{ fontSize: 11, color: SUB, marginBottom: 6 }}>로트 선택 (FIFO)</div>
            <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 5, marginBottom: 12 }}>
              {filteredLots.map(lot => (
                <button key={lot.id} type="button" onClick={() => setSelLot(lot.id)}
                  style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: `0.5px solid ${selLot === lot.id ? 'rgba(41,182,246,0.6)' : 'rgba(255,255,255,0.1)'}`, background: selLot === lot.id ? 'rgba(41,182,246,0.1)' : 'transparent', color: selLot === lot.id ? 'rgba(41,182,246,0.9)' : SUB, cursor: 'pointer' }}>
                  {lot.lot_number} ({lot.remaining_qty.toLocaleString()}개)
                </button>
              ))}
            </div>
          </>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 10, color: SUB, marginBottom: 3 }}>수량</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button type="button" onClick={() => setQty(q => Math.max(1, q-1))}
                style={{ width: 28, height: 28, borderRadius: 5, border: '0.5px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: TEXT, fontSize: 14, cursor: 'pointer' }}>−</button>
              <input type="number" value={qty} onChange={e => setQty(Math.max(1, Number(e.target.value)))} min={1}
                style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 5, padding: '5px 8px', fontSize: 13, color: TEXT, outline: 'none', textAlign: 'center' as const }} />
              <button type="button" onClick={() => setQty(q => q+1)}
                style={{ width: 28, height: 28, borderRadius: 5, border: 'none', background: PURPLE, color: '#fff', fontSize: 14, cursor: 'pointer' }}>+</button>
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: SUB, marginBottom: 3 }}>담당자</div>
            <input value={staffName} onChange={e => setStaffName(e.target.value)} placeholder="이름 입력"
              style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 5, padding: '5px 8px', fontSize: 12, color: TEXT, outline: 'none' }} />
          </div>
        </div>
        <input value={memo} onChange={e => setMemo(e.target.value)} placeholder="메모 (선택)"
          style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 7, padding: '7px 10px', fontSize: 12, color: TEXT, outline: 'none', marginBottom: 10 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: 6, marginBottom: 10, fontSize: 11, color: SUB }}>
          🔒 처리 후 수정 불가 · 담당자 이름 자동 기록
        </div>
        <button type="button" onClick={processIO} disabled={saving}
          style={{ width: '100%', padding: '10px', borderRadius: 8, border: 'none', background: saving ? 'rgba(123,94,167,0.4)' : mode === 'in' ? '#4CAF50' : '#E53935', color: '#fff', fontSize: 13, cursor: saving ? 'not-allowed' : 'pointer' }}>
          {saving ? '처리 중...' : `${mode === 'in' ? '입고' : '출고'} ${qty}개 확정`}
        </button>
      </div>
      <div style={CARD}>
        <div style={{ fontSize: 12, color: SUB, marginBottom: 10 }}>최근 입출고 이력 (수정 불가)</div>
        {logs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '16px 0', color: SUB, fontSize: 12 }}>이력이 없어요</div>
        ) : logs.map((log, i) => (
          <div key={log.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 0', borderBottom: i < logs.length - 1 ? '0.5px solid rgba(255,255,255,0.05)' : 'none' }}>
            <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>{log.type === 'in' ? '⬇️' : '⬆️'}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, color: TEXT, marginBottom: 1 }}>{(log.brand_inventory as { product_name?: string })?.product_name}</div>
              <div style={{ fontSize: 11, color: SUB }}>{log.memo} · {log.staff_name}</div>
            </div>
            <div style={{ textAlign: 'right' as const, flexShrink: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: log.type === 'in' ? '#4CAF50' : '#E53935' }}>{log.type === 'in' ? '+' : '-'}{log.qty}개</div>
              <div style={{ fontSize: 10, color: SUB }}>{timeAgo(log.created_at)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
