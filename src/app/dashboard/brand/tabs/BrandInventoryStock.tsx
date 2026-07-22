'use client'
import { useCallback, useEffect, useState } from 'react'
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
  moq: number
  lead_time_days: number
  alert_contact: string | null
  available_stock: number
}
interface Props {
  brandId: string | null
  brandName: string
  authId: string | null
}
export default function BrandInventoryStock({ brandId, brandName, authId }: Props) {
  const supabase = createClient()
  const [items, setItems] = useState<InventoryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [editSafety, setEditSafety] = useState(0)
  const [editContact, setEditContact] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [newProduct, setNewProduct] = useState('')
  const [newSafety, setNewSafety] = useState(0)
  const [newMoq, setNewMoq] = useState(1000)
  const [newLead, setNewLead] = useState(60)
  const [saving, setSaving] = useState(false)
  const [brandProducts, setBrandProducts] = useState<Array<{ id: string; name: string }>>([])
  const [selProductId, setSelProductId] = useState<string | null>(null)
  const showToast = (t: string) => { setToast(t); setTimeout(() => setToast(''), 2500) }
  const loadItems = useCallback(async () => {
    if (!brandId) return
    setLoading(true)
    const [{ data }, { data: prodData }] = await Promise.all([
      supabase
        .from('brand_inventory')
        .select('id, product_name, total_stock, safety_stock, moq, lead_time_days, alert_contact, available_stock')
        .eq('brand_id', brandId)
        .order('product_name'),
      supabase
        .from('brand_products')
        .select('id, name')
        .eq('brand_id', brandId)
        .order('name'),
    ])
    setItems((data || []) as InventoryRow[])
    setBrandProducts((prodData || []).map((p: { id: string; name: string }) => ({ id: p.id, name: p.name })))
    setLoading(false)
  }, [brandId])
  useEffect(() => { void loadItems() }, [loadItems])
  const stockStatus = (stock: number, safety: number) => {
    if (stock <= 0) return { label: '품절', color: '#E53935', bg: 'rgba(229,57,53,0.1)' }
    if (stock <= safety) return { label: '부족', color: '#E53935', bg: 'rgba(229,57,53,0.1)' }
    if (stock <= safety * 1.5) return { label: '주의', color: '#C9A96E', bg: 'rgba(201,169,110,0.1)' }
    return { label: '정상', color: '#4CAF50', bg: 'rgba(76,175,80,0.1)' }
  }
  const saveSafety = async (id: string) => {
    setSaving(true)
    const { error } = await supabase
      .from('brand_inventory')
      .update({ safety_stock: editSafety, alert_contact: editContact, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (!error) {
      setItems(prev => prev.map(it => it.id === id ? { ...it, safety_stock: editSafety, alert_contact: editContact } : it))
      setEditId(null)
      showToast('안전재고 설정 저장됨!')
      const item = items.find(it => it.id === id)
      if (item && item.total_stock <= editSafety && brandId) {
        await supabase.from('brand_messages').insert({
          brand_id: brandId,
          message_type: 'auto_order',
          target_type: 'all',
          title: `⚠️ ${item.product_name} 안전재고 이하`,
          body: `${item.product_name} 재고(${item.total_stock}개)가 안전재고(${editSafety}개) 이하입니다. 생산 발주를 검토해주세요.`,
          send_count: 1,
        })
      }
    } else {
      showToast('저장 실패: ' + error.message)
    }
    setSaving(false)
  }
  const addInventory = async () => {
    if (!newProduct.trim() || !brandId) { showToast('제품명을 입력해주세요'); return }
    setSaving(true)
    const { error } = await supabase
      .from('brand_inventory')
      .insert({
        brand_id: brandId,
        product_id: selProductId || null,
        product_name: newProduct.trim(),
        total_stock: 0,
        available_stock: 0,
        reserved_stock: 0,
        safety_stock: newSafety,
        moq: newMoq,
        lead_time_days: newLead,
      })
    if (!error) {
      setNewProduct(''); setNewSafety(0); setNewMoq(1000); setNewLead(60); setSelProductId(null)
      setShowAddForm(false)
      showToast('제품 재고 등록 완료!')
      void loadItems()
    } else {
      showToast('등록 실패: ' + error.message)
    }
    setSaving(false)
  }
  if (loading) return <div style={{ padding: 20, color: SUB, textAlign: 'center', fontSize: 13 }}>불러오는 중...</div>
  return (
    <div>
      {toast && <div style={{ position: 'fixed', top: 14, left: '50%', transform: 'translateX(-50%)', background: PURPLE, color: '#fff', fontSize: 12, padding: '7px 18px', borderRadius: 20, zIndex: 999, whiteSpace: 'nowrap' }}>{toast}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 12 }}>
        {[
          { label: '전체 재고', value: items.reduce((s, i) => s + i.total_stock, 0).toLocaleString() + '개', color: PURPLE },
          { label: '재고 부족', value: items.filter(i => i.total_stock <= i.safety_stock && i.safety_stock > 0).length + '종', color: '#E53935' },
          { label: '등록 제품', value: items.length + '종', color: '#4CAF50' },
        ].map(k => (
          <div key={k.label} style={{ background: '#1a1520', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 12, textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 500, color: k.color, marginBottom: 3 }}>{k.value}</div>
            <div style={{ fontSize: 11, color: SUB }}>{k.label}</div>
          </div>
        ))}
      </div>
      <div style={CARD}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontSize: 12, color: SUB }}>제품별 재고 현황</span>
          <button type="button" onClick={() => setShowAddForm(v => !v)}
            style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, border: `0.5px solid ${PURPLE}`, background: 'rgba(123,94,167,0.15)', color: '#c4a7e7', cursor: 'pointer' }}>
            + 제품 추가
          </button>
        </div>
        {showAddForm && (
          <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: 12, marginBottom: 12 }}>
            {brandProducts.length > 0 && (
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 10, color: SUB, marginBottom: 5 }}>등록된 제품에서 선택</div>
                <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 5, marginBottom: 8 }}>
                  {brandProducts.map(p => (
                    <button key={p.id} type="button"
                      onClick={() => { setSelProductId(p.id); setNewProduct(p.name) }}
                      style={{ fontSize: 11, padding: '3px 9px', borderRadius: 6, border: `0.5px solid ${selProductId === p.id ? PURPLE : 'rgba(255,255,255,0.1)'}`, background: selProductId === p.id ? 'rgba(123,94,167,0.2)' : 'transparent', color: selProductId === p.id ? '#c4a7e7' : SUB, cursor: 'pointer' }}>
                      {p.name}
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: 10, color: SUB, marginBottom: 4 }}>또는 직접 입력</div>
              </div>
            )}
            <input value={newProduct} onChange={e => { setNewProduct(e.target.value); setSelProductId(null) }} placeholder="제품명"
              style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 7, padding: '7px 10px', fontSize: 12, color: TEXT, outline: 'none', marginBottom: 8 }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 8 }}>
              {([
                { label: '안전재고', val: newSafety, set: setNewSafety },
                { label: 'MOQ', val: newMoq, set: setNewMoq },
                { label: '리드타임(일)', val: newLead, set: setNewLead },
              ] as const).map(f => (
                <div key={f.label}>
                  <div style={{ fontSize: 10, color: SUB, marginBottom: 3 }}>{f.label}</div>
                  <input type="number" value={f.val} onChange={e => f.set(Number(e.target.value))}
                    style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '5px 8px', fontSize: 12, color: TEXT, outline: 'none' }} />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button type="button" onClick={addInventory} disabled={saving}
                style={{ flex: 1, padding: '7px', borderRadius: 6, border: 'none', background: PURPLE, color: '#fff', fontSize: 12, cursor: 'pointer' }}>
                {saving ? '등록 중...' : '등록하기'}
              </button>
              <button type="button" onClick={() => setShowAddForm(false)}
                style={{ padding: '7px 12px', borderRadius: 6, border: '0.5px solid rgba(255,255,255,0.1)', background: 'transparent', color: SUB, fontSize: 12, cursor: 'pointer' }}>
                취소
              </button>
            </div>
          </div>
        )}
        {items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px 0', color: SUB, fontSize: 13 }}>등록된 제품이 없어요</div>
        ) : items.map((item, i) => {
          const st = stockStatus(item.total_stock, item.safety_stock)
          const pct = item.safety_stock > 0 ? Math.min(100, Math.round(item.total_stock / (item.safety_stock * 3) * 100)) : 50
          return (
            <div key={item.id} style={{ paddingBottom: 12, marginBottom: 12, borderBottom: i < items.length - 1 ? '0.5px solid rgba(255,255,255,0.05)' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 13, color: TEXT }}>{item.product_name}</span>
                  <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 10, background: st.bg, color: st.color }}>{st.label}</span>
                </div>
                <span style={{ fontSize: 13, fontWeight: 500, color: TEXT }}>{item.total_stock.toLocaleString()}개</span>
              </div>
              <div style={{ height: 5, background: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden', marginBottom: 6 }}>
                <div style={{ width: `${pct}%`, height: '100%', background: st.color, borderRadius: 3 }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, color: SUB }}>
                  안전재고 {item.safety_stock}개 · MOQ {item.moq.toLocaleString()}개 · {item.lead_time_days}일
                </span>
                <button type="button" onClick={() => { setEditId(item.id); setEditSafety(item.safety_stock); setEditContact(item.alert_contact || '') }}
                  style={{ fontSize: 11, padding: '2px 8px', borderRadius: 5, border: '0.5px solid rgba(255,255,255,0.1)', background: 'transparent', color: SUB, cursor: 'pointer' }}>
                  설정
                </button>
              </div>
              {editId === item.id && (
                <div style={{ marginTop: 8, background: 'rgba(255,255,255,0.03)', borderRadius: 7, padding: 10 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
                    <div>
                      <div style={{ fontSize: 10, color: SUB, marginBottom: 3 }}>안전재고 수량</div>
                      <input type="number" value={editSafety} onChange={e => setEditSafety(Number(e.target.value))}
                        style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '5px 8px', fontSize: 12, color: TEXT, outline: 'none' }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: SUB, marginBottom: 3 }}>알림 연락처</div>
                      <input value={editContact} onChange={e => setEditContact(e.target.value)} placeholder="010-0000-0000"
                        style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '5px 8px', fontSize: 12, color: TEXT, outline: 'none' }} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button type="button" onClick={() => saveSafety(item.id)} disabled={saving}
                      style={{ flex: 1, padding: '6px', borderRadius: 6, border: 'none', background: PURPLE, color: '#fff', fontSize: 11, cursor: 'pointer' }}>
                      저장
                    </button>
                    <button type="button" onClick={() => setEditId(null)}
                      style={{ padding: '6px 10px', borderRadius: 6, border: '0.5px solid rgba(255,255,255,0.1)', background: 'transparent', color: SUB, fontSize: 11, cursor: 'pointer' }}>
                      취소
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
