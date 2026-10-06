'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type ProductPick = { id: string; name: string; retail_price: number | null }

type CommissionType = 'pct' | 'fixed'

const REWARD_TYPES = [
  { value: 'jam', label: '딸기잼' },
  { value: 'toast', label: '토스트' },
  { value: 'coupon', label: '쿠폰' },
  { value: 'gift', label: '실물선물' },
  { value: 'content', label: '콘텐츠' },
] as const

const COMMISSION_TYPES: { value: CommissionType; label: string }[] = [
  { value: 'pct', label: '퍼센트 (%)' },
  { value: 'fixed', label: '건당 고정금액 (원)' },
]

function defaultEndsAtLocal(): string {
  const d = new Date(Date.now() + 7 * 86400000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const label = (t: string, sz: number) => (
  <div style={{ fontSize: sz, color: '#666666', marginBottom: 4 }}>{t}</div>
)

const inp = {
  width: '100%' as const,
  padding: '10px 12px',
  borderRadius: 8,
  background: '#f8f8f8',
  border: '1px solid #e5e5e5',
  color: '#111111',
  fontSize: 13,
  fontWeight: 400,
  boxSizing: 'border-box' as const,
}

const chip = (active: boolean) => ({
  padding: '8px 12px',
  borderRadius: 8,
  border: active ? '1px solid #c9a84c' : '1px solid #e5e5e5',
  background: active ? 'rgba(201,169,110,0.15)' : '#f8f8f8',
  color: active ? '#c9a84c' : '#111111',
  fontSize: 12,
  fontWeight: 400,
  cursor: 'pointer',
})

async function syncProductGroupBuy(productId: string, isActive: boolean, count: number, groupPrice: number) {
  const supabase = createClient()
  if (isActive) {
    return supabase
      .from('products')
      .update({
        is_groupbuy: true,
        groupbuy_count: count,
        sale_price: groupPrice,
        is_timesale: false,
      })
      .eq('id', productId)
  }
  return supabase
    .from('products')
    .update({
      is_groupbuy: false,
      groupbuy_count: count,
      sale_price: null,
    })
    .eq('id', productId)
}

export default function GroupBuyCreateSheet({
  isOpen,
  onClose,
  onCreated,
}: {
  isOpen: boolean
  onClose: () => void
  onCreated: () => void
}) {
  const supabase = createClient()
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
  const [giftDescription, setGiftDescription] = useState('')
  const [giftPoints, setGiftPoints] = useState(500)
  const [isActiveNew, setIsActiveNew] = useState(true)
  const [achievementRewardType, setAchievementRewardType] = useState('jam')
  const [achievementRewardValue, setAchievementRewardValue] = useState('0')
  const [achievementMessage, setAchievementMessage] = useState(
    '함께라서 가능했어요, 딸기잼 선물이에요 🎉'
  )
  const [editorCommissionType, setEditorCommissionType] = useState<CommissionType>('pct')
  const [editorCommissionValue, setEditorCommissionValue] = useState(0)

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
    const commissionValue = Math.max(0, Math.floor(Number(editorCommissionValue) || 0))
    if (editorCommissionType === 'pct' && commissionValue > 100) {
      alert('퍼센트 수수료는 100 이하로 입력해 주세요.')
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
      gift_description: giftDescription.trim() || null,
      gift_points: giftPoints,
      is_active: isActiveNew,
      achievement_reward_type: achievementRewardType,
      achievement_reward_value: achievementRewardValue,
      achievement_message: achievementMessage,
      editor_commission_type: editorCommissionType,
      editor_commission_value: commissionValue,
    } as any)
    setCreating(false)
    if (error) {
      alert(error.message)
      return
    }
    const { error: syncErr } = await syncProductGroupBuy(sel.id, isActiveNew, currentCount, groupPrice)
    if (syncErr) {
      alert('제품 공구 표시 동기화 실패: ' + syncErr.message)
    }
    setPq('')
    setPicks([])
    setPickOpen(false)
    setSel(null)
    setTargetCount(200)
    setCurrentCount(0)
    setDiscountRate(30)
    setOriginalPrice(0)
    setGroupPrice(0)
    setEndsAt(defaultEndsAtLocal())
    setGiftDescription('')
    setGiftPoints(500)
    setIsActiveNew(true)
    setAchievementRewardType('jam')
    setAchievementRewardValue('0')
    setAchievementMessage('함께라서 가능했어요, 딸기잼 선물이에요 🎉')
    setEditorCommissionType('pct')
    setEditorCommissionValue(0)
    alert('공구가 등록되었습니다.')
    onCreated()
    onClose()
  }

  if (!isOpen) return null

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 220, background: 'rgba(0,0,0,0.5)' }}
      />
      <div
        role="dialog"
        aria-modal="true"
        style={{
          position: 'fixed',
          left: 0,
          bottom: 0,
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          zIndex: 221,
          background: '#ffffff',
          borderTop: '1px solid #e5e5e5',
          borderRadius: '16px 16px 0 0',
          color: '#111111',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ maxWidth: 560, margin: '0 auto', padding: '18px 18px 28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ fontSize: 16, color: '#c9a84c' }}>공구 등록</div>
            <button
              type="button"
              aria-label="닫기"
              onClick={onClose}
              style={{ border: 'none', background: 'transparent', color: '#666666', fontSize: 22, lineHeight: 1, cursor: 'pointer', padding: 4 }}
            >
              ×
            </button>
          </div>

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
                  background: '#ffffff',
                  border: '1px solid #e5e5e5',
                  borderRadius: 8,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
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
                      borderBottom: '1px solid #e5e5e5',
                      color: '#111111',
                      fontSize: 12,
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{ fontSize: 13 }}>{p.name}</span>
                    <span style={{ fontSize: 11, color: '#666666', marginLeft: 8 }}>
                      {Number(p.retail_price ?? 0).toLocaleString()}원
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {sel && (
            <div style={{ fontSize: 12, color: '#c9a84c', marginBottom: 16 }}>
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
              {label('할인 금액 (원)', 11)}
              <input
                type="number"
                disabled={originalPrice === 0}
                value={originalPrice === 0 ? '' : originalPrice - groupPrice}
                onChange={e => {
                  const op = originalPrice
                  if (!op) return
                  const raw = Number(e.target.value)
                  if (Number.isNaN(raw)) return
                  const amt = Math.max(0, Math.min(raw, op))
                  setGroupPrice(op - amt)
                  setDiscountRate(Math.round((amt / op) * 100))
                }}
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
              {label('선물 설명', 11)}
              <input value={giftDescription} onChange={e => setGiftDescription(e.target.value)} style={inp} />
            </div>
            <div>
              {label('토스트 (T)', 11)}
              <input
                type="number"
                value={giftPoints}
                onChange={e => setGiftPoints(Number(e.target.value))}
                style={inp}
              />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              {label('달성 보상 종류', 11)}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {REWARD_TYPES.map(r => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setAchievementRewardType(r.value)}
                    style={chip(achievementRewardType === r.value)}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              {label('보상 수량/내용', 11)}
              <input
                type="text"
                value={achievementRewardValue}
                onChange={e => setAchievementRewardValue(e.target.value)}
                style={inp}
              />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              {label('달성 멘트', 11)}
              <input
                type="text"
                value={achievementMessage}
                onChange={e => setAchievementMessage(e.target.value)}
                style={inp}
                placeholder="함께라서 가능했어요, 딸기잼 선물이에요 🎉"
              />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              {label('에디터 수수료 방식', 11)}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {COMMISSION_TYPES.map(c => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setEditorCommissionType(c.value)}
                    style={chip(editorCommissionType === c.value)}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              {label(editorCommissionType === 'pct' ? '에디터 수수료 (%)' : '에디터 수수료 (원)', 11)}
              <input
                type="number"
                min={0}
                max={editorCommissionType === 'pct' ? 100 : undefined}
                value={editorCommissionValue}
                onChange={e => setEditorCommissionValue(Number(e.target.value))}
                style={inp}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
              <label style={{ fontSize: 12, color: '#666666', display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" checked={isActiveNew} onChange={e => setIsActiveNew(e.target.checked)} />
                공개
              </label>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                padding: '12px 20px',
                borderRadius: 10,
                border: '1px solid #e5e5e5',
                background: 'transparent',
                color: '#111111',
                fontSize: 13,
                fontWeight: 400,
                cursor: 'pointer',
              }}
            >
              닫기
            </button>
            <button
              type="button"
              disabled={creating}
              onClick={() => void createGroupBuy()}
              style={{
                flex: 2,
                padding: '12px 20px',
                borderRadius: 10,
                border: 'none',
                background: '#C9A96E',
                color: '#111',
                fontSize: 13,
                fontWeight: 400,
                cursor: 'pointer',
              }}
            >
              {creating ? '등록 중…' : '공구 만들기'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
