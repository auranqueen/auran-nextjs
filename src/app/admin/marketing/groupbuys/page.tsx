'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type ProductPick = { id: string; name: string; retail_price: number | null }

function toDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function defaultEndsAtLocal(): string {
  const d = new Date(Date.now() + 7 * 86400000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const label = (t: string, sz: number) => (
  <div style={{ fontSize: sz, color: 'rgba(255,255,255,0.45)', marginBottom: 4 }}>{t}</div>
)

const inp = {
  width: '100%' as const,
  padding: '10px 12px',
  borderRadius: 8,
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)',
  color: '#fff',
  fontSize: 13,
  fontWeight: 400,
  boxSizing: 'border-box' as const,
}

async function syncProductGroupBuy(productId: string, isGroupbuy: boolean, count: number) {
  const supabase = createClient()
  return supabase.from('products').update({ is_groupbuy: isGroupbuy, groupbuy_count: count }).eq('id', productId)
}

export default function GroupBuysAdminPage() {
  const supabase = createClient()
  const [items, setItems] = useState<any[]>([])
  const [creating, setCreating] = useState(false)

  const [pq, setPq] = useState('')
  const [picks, setPicks] = useState<ProductPick[]>([])
  const [pickOpen, setPickOpen] = useState(false)
  const [sel, setSel] = useState<ProductPick | null>(null)

  const [targetCount, setTargetCount] = useState(200)
  const [currentCount, setCurrentCount] = useState(0)
  const [discountRate, setDiscountRate] = useState(30)
  const [originalPrice, setOriginalPrice] = useState(0)
  const [groupPrice, setGroupPrice] = useState(0)
  const [endsAt, setEndsAt] = useState(defaultEndsAtLocal)
  const [giftTitle, setGiftTitle] = useState('')
  const [giftDescription, setGiftDescription] = useState('')
  const [giftPoints, setGiftPoints] = useState(500)
  const [isActiveNew, setIsActiveNew] = useState(true)

  const loadItems = () => {
    void supabase
      .from('group_buys')
      .select('*, product:products(id, name, retail_price, thumb_img, brands(name))')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data) setItems(data)
      })
  }

  useEffect(() => {
    loadItems()
  }, [])

  useEffect(() => {
    const q = pq.trim()
    if (q.length < 1) {
      setPicks([])
      return
    }
    const t = setTimeout(() => {
      void supabase
        .from('products')
        .select('id, name, retail_price')
        .ilike('name', `%${q}%`)
        .eq('is_active', true)
        .limit(12)
        .then(({ data }) => {
          setPicks((data as ProductPick[]) || [])
        })
    }, 220)
    return () => clearTimeout(t)
  }, [pq])

  const pickProduct = (p: ProductPick) => {
    setSel(p)
    const r = Number(p.retail_price ?? 0)
    setOriginalPrice(r)
    setGroupPrice(Math.round(r * (1 - discountRate / 100)))
    setPickOpen(false)
    setPq(p.name)
  }

  const onDiscountChange = (v: number) => {
    setDiscountRate(v)
    setGroupPrice(Math.round(originalPrice * (1 - v / 100)))
  }

  const onOriginalChange = (v: number) => {
    setOriginalPrice(v)
    setGroupPrice(Math.round(v * (1 - discountRate / 100)))
  }

  const createGroupBuy = async () => {
    if (!sel?.id) {
      alert('제품을 선택해 주세요.')
      return
    }
    if (!endsAt.trim()) {
      alert('마감 일시를 입력해 주세요.')
      return
    }
    const endsIso = new Date(endsAt).toISOString()
    if (Number.isNaN(new Date(endsAt).getTime())) {
      alert('마감 일시 형식을 확인해 주세요.')
      return
    }
    setCreating(true)
    const { error } = await supabase.from('group_buys').insert({
      product_id: sel.id,
      target_count: targetCount,
      current_count: currentCount,
      discount_rate: discountRate,
      original_price: originalPrice,
      group_price: groupPrice,
      ends_at: endsIso,
      gift_title: giftTitle.trim() || null,
      gift_description: giftDescription.trim() || null,
      gift_points: giftPoints,
      is_active: isActiveNew,
    } as any)
    setCreating(false)
    if (error) {
      alert(error.message)
      return
    }
    const { error: syncErr } = await syncProductGroupBuy(sel.id, isActiveNew, currentCount)
    if (syncErr) {
      alert('제품 공구 표시 동기화 실패: ' + syncErr.message)
    }
    loadItems()
    alert('공구가 등록되었습니다.')
  }

  const patchLocal = (id: string, field: string, value: any) => {
    setItems(prev => prev.map(i => (i.id === id ? { ...i, [field]: value } : i)))
  }

  const saveRow = async (row: any) => {
    const endsRaw = row._endsLocal != null ? row._endsLocal : toDatetimeLocalValue(row.ends_at)
    const endsIso = endsRaw ? new Date(endsRaw).toISOString() : row.ends_at
    const { error } = await supabase
      .from('group_buys')
      .update({
        original_price: Number(row.original_price),
        group_price: Number(row.group_price),
        discount_rate: Number(row.discount_rate),
        target_count: Number(row.target_count),
        current_count: Number(row.current_count),
        ends_at: endsIso,
        gift_title: row.gift_title,
        gift_description: row.gift_description,
        gift_points: Number(row.gift_points),
        is_active: !!row.is_active,
      })
      .eq('id', row.id)
    if (error) {
      alert(error.message)
      return
    }
    const pid = row.product_id as string | undefined
    if (pid) {
      const { error: syncErr } = await syncProductGroupBuy(pid, !!row.is_active, Number(row.current_count))
      if (syncErr) {
        alert('제품 공구 표시 동기화 실패: ' + syncErr.message)
      }
    }
    loadItems()
    alert('저장되었습니다.')
  }

  const deleteRow = async (row: { id: string; product_id?: string | null }) => {
    if (!confirm('이 공구를 삭제할까요?')) return
    const pid = row.product_id as string | undefined | null
    if (pid) {
      const { error: syncErr } = await syncProductGroupBuy(pid, false, 0)
      if (syncErr) {
        alert('제품 공구 해제 실패: ' + syncErr.message)
        return
      }
    }
    const { error } = await supabase.from('group_buys').delete().eq('id', row.id)
    if (error) {
      alert(error.message)
      return
    }
    setItems(prev => prev.filter(i => i.id !== row.id))
  }

  return (
    <div style={{ padding: 24, background: '#0D0B09', minHeight: '100vh', color: '#e8e4df', fontWeight: 400 }}>
      <div style={{ fontSize: 22, color: '#C9A96E', marginBottom: 8 }}>공동구매</div>
      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 28 }}>신규 등록 · 목록 인라인 수정</div>

      {/* 새 공구 */}
      <div
        style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 14,
          padding: 20,
          marginBottom: 28,
        }}
      >
        <div style={{ fontSize: 16, color: 'rgba(201,169,110,0.95)', marginBottom: 16 }}>새 공구 만들기</div>

        <div style={{ position: 'relative', marginBottom: 14 }}>
          {label('제품명 검색', 11)}
          <input
            value={pq}
            onChange={e => {
              setPq(e.target.value)
              setPickOpen(true)
            }}
            onFocus={() => setPickOpen(true)}
            placeholder="제품명 입력"
            style={inp}
          />
          {pickOpen && picks.length > 0 && (
            <div
              style={{
                position: 'absolute',
                zIndex: 20,
                left: 0,
                right: 0,
                top: '100%',
                marginTop: 4,
                maxHeight: 220,
                overflow: 'auto',
                background: '#14110e',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 8,
                boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
              }}
            >
              {picks.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => pickProduct(p)}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '10px 12px',
                    background: 'transparent',
                    border: 'none',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                    color: '#fff',
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ fontSize: 13 }}>{p.name}</span>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginLeft: 8 }}>
                    {Number(p.retail_price ?? 0).toLocaleString()}원
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {sel && (
          <div style={{ fontSize: 12, color: 'rgba(201,169,110,0.75)', marginBottom: 16 }}>
            선택: {sel.name} · 정가 {Number(sel.retail_price ?? 0).toLocaleString()}원
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}>
          <div>
            {label('목표 인원', 11)}
            <input
              type="number"
              value={targetCount}
              onChange={e => setTargetCount(Number(e.target.value))}
              style={inp}
            />
          </div>
          <div>
            {label('현재 인원', 11)}
            <input
              type="number"
              value={currentCount}
              onChange={e => setCurrentCount(Number(e.target.value))}
              style={inp}
            />
          </div>
          <div>
            {label('할인율 (%)', 11)}
            <input
              type="number"
              value={discountRate}
              onChange={e => onDiscountChange(Number(e.target.value))}
              style={inp}
            />
          </div>
          <div>
            {label('정가 (원)', 11)}
            <input
              type="number"
              value={originalPrice || ''}
              onChange={e => onOriginalChange(Number(e.target.value))}
              style={inp}
            />
          </div>
          <div>
            {label('공구가 (원)', 11)}
            <input
              type="number"
              value={groupPrice || ''}
              onChange={e => setGroupPrice(Number(e.target.value))}
              style={inp}
            />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            {label('마감 (일시)', 11)}
            <input type="datetime-local" value={endsAt} onChange={e => setEndsAt(e.target.value)} style={inp} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            {label('달성 문구 (gift_title)', 11)}
            <input value={giftTitle} onChange={e => setGiftTitle(e.target.value)} style={inp} placeholder="선택" />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            {label('선물 설명', 11)}
            <input value={giftDescription} onChange={e => setGiftDescription(e.target.value)} style={inp} />
          </div>
          <div>
            {label('포인트', 11)}
            <input
              type="number"
              value={giftPoints}
              onChange={e => setGiftPoints(Number(e.target.value))}
              style={inp}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
            <label style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={isActiveNew} onChange={e => setIsActiveNew(e.target.checked)} />
              공개
            </label>
          </div>
        </div>

        <button
          type="button"
          disabled={creating}
          onClick={() => void createGroupBuy()}
          style={{
            marginTop: 18,
            padding: '12px 20px',
            borderRadius: 10,
            border: 'none',
            background: '#C9A96E',
            color: '#111',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          {creating ? '등록 중…' : '공구 만들기'}
        </button>
      </div>

      {/* 목록 */}
      <div style={{ fontSize: 16, color: 'rgba(201,169,110,0.9)', marginBottom: 14 }}>등록된 공구</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {items.map(row => (
          <div
            key={row.id}
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 14,
              padding: 18,
            }}
          >
            <div style={{ display: 'flex', gap: 12, marginBottom: 14, alignItems: 'center' }}>
              {row.product?.thumb_img && (
                <img
                  src={row.product.thumb_img}
                  alt=""
                  style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover' }}
                />
              )}
              <div>
                <div style={{ fontSize: 14 }}>{row.product?.name || '제품'}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>
                  {row.current_count}/{row.target_count}명 · 할인 {row.discount_rate}%
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10 }}>
              <div>
                {label('정가', 10)}
                <input
                  type="number"
                  value={row.original_price ?? ''}
                  onChange={e => patchLocal(row.id, 'original_price', Number(e.target.value))}
                  style={{ ...inp, fontSize: 12 }}
                />
              </div>
              <div>
                {label('공구가', 10)}
                <input
                  type="number"
                  value={row.group_price ?? ''}
                  onChange={e => patchLocal(row.id, 'group_price', Number(e.target.value))}
                  style={{ ...inp, fontSize: 12 }}
                />
              </div>
              <div>
                {label('할인%', 10)}
                <input
                  type="number"
                  value={row.discount_rate ?? ''}
                  onChange={e => patchLocal(row.id, 'discount_rate', Number(e.target.value))}
                  style={{ ...inp, fontSize: 12 }}
                />
              </div>
              <div>
                {label('목표', 10)}
                <input
                  type="number"
                  value={row.target_count ?? ''}
                  onChange={e => patchLocal(row.id, 'target_count', Number(e.target.value))}
                  style={{ ...inp, fontSize: 12 }}
                />
              </div>
              <div>
                {label('현재', 10)}
                <input
                  type="number"
                  value={row.current_count ?? ''}
                  onChange={e => patchLocal(row.id, 'current_count', Number(e.target.value))}
                  style={{ ...inp, fontSize: 12 }}
                />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                {label('마감', 10)}
                <input
                  type="datetime-local"
                  value={row._endsLocal ?? toDatetimeLocalValue(row.ends_at)}
                  onChange={e => patchLocal(row.id, '_endsLocal', e.target.value)}
                  style={{ ...inp, fontSize: 12 }}
                />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                {label('달성 문구', 10)}
                <input
                  value={row.gift_title || ''}
                  onChange={e => patchLocal(row.id, 'gift_title', e.target.value)}
                  style={{ ...inp, fontSize: 12 }}
                />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                {label('선물 설명', 10)}
                <input
                  value={row.gift_description || ''}
                  onChange={e => patchLocal(row.id, 'gift_description', e.target.value)}
                  style={{ ...inp, fontSize: 12 }}
                />
              </div>
              <div>
                {label('포인트', 10)}
                <input
                  type="number"
                  value={row.gift_points ?? ''}
                  onChange={e => patchLocal(row.id, 'gift_points', Number(e.target.value))}
                  style={{ ...inp, fontSize: 12 }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input
                    type="checkbox"
                    checked={!!row.is_active}
                    onChange={e => patchLocal(row.id, 'is_active', e.target.checked)}
                  />
                  공개
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              <button
                type="button"
                onClick={() => void saveRow(row)}
                style={{
                  padding: '10px 16px',
                  borderRadius: 8,
                  border: 'none',
                  background: 'rgba(201,169,110,0.35)',
                  color: '#f5f0e6',
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                저장
              </button>
              <button
                type="button"
                onClick={() => void deleteRow(row)}
                style={{
                  padding: '10px 16px',
                  borderRadius: 8,
                  border: '1px solid rgba(220,100,100,0.4)',
                  background: 'transparent',
                  color: 'rgba(255,160,160,0.85)',
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                삭제
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
