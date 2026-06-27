'use client'
import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { CSSProperties } from 'react'
const PURPLE = '#7B5EA7'
const TEXT = 'rgba(255,255,255,0.65)'
const SUB = 'rgba(255,255,255,0.3)'
const CARD: CSSProperties = { background: '#1a1520', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 14, marginBottom: 10 }
interface LotRow {
  id: string
  inventory_id: string
  lot_number: string
  initial_qty: number
  remaining_qty: number
  produced_at: string | null
  expires_at: string | null
  status: string
  brand_inventory: { product_name: string } | null
}
interface InventoryRow {
  id: string
  product_name: string
}
interface Props {
  brandId: string | null
}
export default function BrandInventoryLots({ brandId }: Props) {
  const supabase = createClient()
  const [lots, setLots] = useState<LotRow[]>([])
  const [inventories, setInventories] = useState<InventoryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [selInv, setSelInv] = useState('')
  const [lotNum, setLotNum] = useState('')
  const [lotQty, setLotQty] = useState(0)
  const [prodDate, setProdDate] = useState('')
  const [expDate, setExpDate] = useState('')
  const [saving, setSaving] = useState(false)
  const showToast = (t: string) => { setToast(t); setTimeout(() => setToast(''), 2500) }
  const autoLotNum = (count: number) => {
    const now = new Date()
    return `LOT-${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(count+1).padStart(3,'0')}`
  }
  const loadData = useCallback(async () => {
    if (!brandId) return
    setLoading(true)
    const [{ data: lotData }, { data: invData }] = await Promise.all([
      supabase.from('brand_inventory_lots')
        .select('id, inventory_id, lot_number, initial_qty, remaining_qty, produced_at, expires_at, status, brand_inventory(product_name)')
        .eq('brand_id', brandId)
        .order('created_at', { ascending: false })
        .limit(30),
      supabase.from('brand_inventory')
        .select('id, product_name')
        .eq('brand_id', brandId)
        .order('product_name'),
    ])
    setLots((lotData || []) as unknown as LotRow[])
    setInventories((invData || []) as InventoryRow[])
    setLoading(false)
  }, [brandId])
  useEffect(() => { void loadData() }, [loadData])
  const daysLeft = (exp: string | null) => {
    if (!exp) return null
    return Math.floor((new Date(exp).getTime() - Date.now()) / 86400000)
  }
  const expStatus = (days: number | null) => {
    if (days === null) return { color: SUB, label: '기한 없음' }
    if (days < 0) return { color: '#E53935', label: '만료됨' }
    if (days < 90) return { color: '#E53935', label: `D-${days} 임박!` }
    if (days < 180) return { color: '#C9A96E', label: `D-${days} 주의` }
    return { color: '#4CAF50', label: `D-${days}` }
  }
  const addLot = async () => {
    if (!selInv || !lotQty || !brandId) { showToast('제품과 수량을 입력해주세요'); return }
    setSaving(true)
    const num = lotNum.trim() || autoLotNum(lots.length)
    const { error } = await supabase.from('brand_inventory_lots').insert({
      brand_id: brandId,
      inventory_id: selInv,
      lot_number: num,
      initial_qty: lotQty,
      remaining_qty: lotQty,
      produced_at: prodDate || null,
      expires_at: expDate || null,
      status: 'active',
    })
    if (!error) {
      await supabase.from('brand_stock_logs').insert({
        brand_id: brandId,
        inventory_id: selInv,
        type: 'in',
        qty: lotQty,
        before_qty: 0,
        after_qty: lotQty,
        ref_type: 'lot_in',
        memo: `로트 입고: ${num}`,
      })
      await supabase.rpc('increment_inventory_stock', { p_inventory_id: selInv, p_qty: lotQty })
      const inv = inventories.find(i => i.id === selInv)
      setLotNum(''); setLotQty(0); setProdDate(''); setExpDate('')
      setShowForm(false)
      showToast(`${inv?.product_name || '제품'} ${lotQty.toLocaleString()}개 입고 완료!`)
      void loadData()
    } else {
      showToast('입고 실패: ' + error.message)
    }
    setSaving(false)
  }
  if (loading) return <div style={{ padding: 20, color: SUB, textAlign: 'center', fontSize: 13 }}>불러오는 중...</div>
  return (
    <div>
      {toast && <div style={{ position: 'fixed', top: 14, left: '50%', transform: 'translateX(-50%)', background: PURPLE, color: '#fff', fontSize: 12, padding: '7px 18px', borderRadius: 20, zIndex: 999, whiteSpace: 'nowrap' }}>{toast}</div>}
      <div style={CARD}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontSize: 12, color: SUB }}>로트 목록 ({lots.length}건)</span>
          <button type="button" onClick={() => { setShowForm(v => !v); if (!showForm) setLotNum(autoLotNum(lots.length)) }}
            style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, border: `0.5px solid ${PURPLE}`, background: 'rgba(123,94,167,0.15)', color: '#c4a7e7', cursor: 'pointer' }}>
            + 로트 입고
          </button>
        </div>
        {showForm && (
          <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: 12, marginBottom: 12 }}>
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 10, color: SUB, marginBottom: 5 }}>제품 선택</div>
              <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 5 }}>
                {inventories.map(inv => (
                  <button key={inv.id} type="button" onClick={() => setSelInv(inv.id)}
                    style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, border: `0.5px solid ${selInv === inv.id ? PURPLE : 'rgba(255,255,255,0.1)'}`, background: selInv === inv.id ? 'rgba(123,94,167,0.2)' : 'transparent', color: selInv === inv.id ? '#c4a7e7' : SUB, cursor: 'pointer' }}>
                    {inv.product_name}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 10, color: SUB, marginBottom: 3 }}>로트번호</div>
                <input value={lotNum} onChange={e => setLotNum(e.target.value)}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '5px 8px', fontSize: 11, color: TEXT, outline: 'none' }} />
              </div>
              <div>
                <div style={{ fontSize: 10, color: SUB, marginBottom: 3 }}>입고 수량</div>
                <input type="number" value={lotQty || ''} onChange={e => setLotQty(Number(e.target.value))} placeholder="예: 10000"
                  style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '5px 8px', fontSize: 12, color: TEXT, outline: 'none' }} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 10, color: SUB, marginBottom: 3 }}>생산일</div>
                <input type="date" value={prodDate} onChange={e => setProdDate(e.target.value)}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '5px 8px', fontSize: 11, color: TEXT, outline: 'none' }} />
              </div>
              <div>
                <div style={{ fontSize: 10, color: SUB, marginBottom: 3 }}>유통기한</div>
                <input type="date" value={expDate} onChange={e => setExpDate(e.target.value)}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '5px 8px', fontSize: 11, color: TEXT, outline: 'none' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button type="button" onClick={addLot} disabled={saving}
                style={{ flex: 1, padding: '7px', borderRadius: 6, border: 'none', background: PURPLE, color: '#fff', fontSize: 12, cursor: 'pointer' }}>
                {saving ? '등록 중...' : '입고 등록'}
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                style={{ padding: '7px 12px', borderRadius: 6, border: '0.5px solid rgba(255,255,255,0.1)', background: 'transparent', color: SUB, fontSize: 12, cursor: 'pointer' }}>
                취소
              </button>
            </div>
          </div>
        )}
        {lots.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px 0', color: SUB, fontSize: 13 }}>등록된 로트가 없어요</div>
        ) : lots.map((lot, i) => {
          const days = daysLeft(lot.expires_at)
          const exp = expStatus(days)
          const pct = lot.initial_qty > 0 ? Math.round(lot.remaining_qty / lot.initial_qty * 100) : 0
          return (
            <div key={lot.id} style={{ paddingBottom: 12, marginBottom: 12, borderBottom: i < lots.length - 1 ? '0.5px solid rgba(255,255,255,0.05)' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' as const }}>
                  <span style={{ fontSize: 11, padding: '1px 8px', borderRadius: 10, background: 'rgba(41,182,246,0.1)', color: 'rgba(41,182,246,0.8)' }}>{lot.lot_number}</span>
                  <span style={{ fontSize: 11, color: exp.color }}>{exp.label}</span>
                </div>
                <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 10, background: lot.status === 'active' ? 'rgba(76,175,80,0.1)' : 'rgba(255,255,255,0.05)', color: lot.status === 'active' ? '#4CAF50' : SUB }}>
                  {lot.status === 'active' ? '활성' : lot.status === 'depleted' ? '소진' : '폐기'}
                </span>
              </div>
              <div style={{ fontSize: 13, color: TEXT, marginBottom: 4 }}>
                {(lot.brand_inventory as { product_name?: string })?.product_name || '제품'}
              </div>
              <div style={{ fontSize: 11, color: SUB, marginBottom: 6 }}>
                생산 {lot.initial_qty.toLocaleString()}개 · 잔여 {lot.remaining_qty.toLocaleString()}개
                {lot.expires_at && ` · 유통기한 ${new Date(lot.expires_at).toLocaleDateString('ko-KR')}`}
              </div>
              <div style={{ height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: days !== null && days < 90 ? '#E53935' : PURPLE, borderRadius: 2 }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
