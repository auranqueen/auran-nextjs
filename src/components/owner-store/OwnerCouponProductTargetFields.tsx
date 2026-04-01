'use client'

import { useMemo, useState, type CSSProperties } from 'react'

export type OwnerCouponProductRow = {
  id: string
  name: string
  thumbnail_url?: string | null
}

type Props = {
  products: OwnerCouponProductRow[]
  target: 'all' | 'product'
  onTargetChange: (v: 'all' | 'product') => void
  selectedProductIds: string[]
  onSelectedProductIdsChange: (ids: string[]) => void
}

const inputStyle: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  marginTop: 8,
  borderRadius: 10,
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(255,255,255,0.04)',
  color: '#fff',
  padding: '10px 12px',
  fontSize: 12,
}

export default function OwnerCouponProductTargetFields({
  products,
  target,
  onTargetChange,
  selectedProductIds,
  onSelectedProductIdsChange,
}: Props) {
  const [q, setQ] = useState('')

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return products
    return products.filter((p) => String(p.name || '').toLowerCase().includes(s))
  }, [products, q])

  const toggle = (id: string) => {
    const set = new Set(selectedProductIds)
    if (set.has(id)) set.delete(id)
    else set.add(id)
    onSelectedProductIdsChange(Array.from(set))
  }

  const selectAllFiltered = () => {
    const ids = new Set(selectedProductIds)
    for (const p of filtered) ids.add(p.id)
    onSelectedProductIdsChange(Array.from(ids))
  }

  const clearSelection = () => onSelectedProductIdsChange([])

  return (
    <div style={{ marginTop: 10 }}>
      <label style={{ display: 'block', fontSize: 11 }}>
        <input type="radio" checked={target === 'all'} onChange={() => onTargetChange('all')} /> 전체 제품
      </label>
      <label style={{ display: 'block', fontSize: 11, marginTop: 4 }}>
        <input type="radio" checked={target === 'product'} onChange={() => onTargetChange('product')} /> 특정 제품 선택
      </label>

      {target === 'product' ? (
        <div
          style={{
            marginTop: 10,
            padding: 10,
            borderRadius: 12,
            border: '1px solid rgba(255,255,255,0.1)',
            background: 'rgba(0,0,0,0.25)',
          }}
        >
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', lineHeight: 1.45 }}>
            제품 연동(저장·적용)은 추후 반영됩니다. 지금은 선택 UI만 사용할 수 있어요.
          </div>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="제품명 검색…"
            style={inputStyle}
          />
          <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={selectAllFiltered}
              style={{
                border: '1px solid rgba(201,169,110,0.35)',
                background: 'rgba(201,169,110,0.1)',
                color: '#C9A96E',
                borderRadius: 8,
                padding: '6px 10px',
                fontSize: 10,
                cursor: 'pointer',
              }}
            >
              보이는 목록 전부 선택
            </button>
            <button
              type="button"
              onClick={clearSelection}
              style={{
                border: '1px solid rgba(255,255,255,0.12)',
                background: 'transparent',
                color: 'rgba(255,255,255,0.7)',
                borderRadius: 8,
                padding: '6px 10px',
                fontSize: 10,
                cursor: 'pointer',
              }}
            >
              선택 해제
            </button>
          </div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 8 }}>
            선택됨 {selectedProductIds.length}개
          </div>
          <div style={{ maxHeight: 200, overflowY: 'auto', marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {filtered.length === 0 ? (
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>제품이 없거나 검색 결과가 없어요</div>
            ) : (
              filtered.map((p) => {
                const checked = selectedProductIds.includes(p.id)
                return (
                  <label
                    key={p.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '8px 10px',
                      borderRadius: 10,
                      border: `1px solid ${checked ? 'rgba(123,94,167,0.45)' : 'rgba(255,255,255,0.08)'}`,
                      background: checked ? 'rgba(123,94,167,0.12)' : 'rgba(255,255,255,0.03)',
                      cursor: 'pointer',
                    }}
                  >
                    <input type="checkbox" checked={checked} onChange={() => toggle(p.id)} />
                    {p.thumbnail_url ? (
                      <img src={p.thumbnail_url} alt="" width={36} height={36} style={{ borderRadius: 8, objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(255,255,255,0.06)' }} />
                    )}
                    <span style={{ fontSize: 12, color: '#fff', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.name || '(이름 없음)'}
                    </span>
                  </label>
                )
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
