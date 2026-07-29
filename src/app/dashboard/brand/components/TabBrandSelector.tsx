'use client'
import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
const PURPLE = '#7B5EA7'
const SUB = 'rgba(255,255,255,0.3)'
export type TabBrandOption = { id: string; name: string }
interface Props {
  myBrands: TabBrandOption[]
  storageKey: string
  onSelect: (brandId: string) => void
  lowStockCounts?: Record<string, number>
  showAllOption?: boolean
}
function pillStyle(selected: boolean): CSSProperties {
  return {
    fontSize: 12,
    padding: '5px 14px',
    borderRadius: 20,
    border: `0.5px solid ${selected ? PURPLE : 'rgba(255,255,255,0.1)'}`,
    background: selected ? 'rgba(123,94,167,0.2)' : 'transparent',
    color: selected ? '#c4a7e7' : SUB,
    cursor: 'pointer',
    position: 'relative' as const,
  }
}
const badgeStyle: CSSProperties = {
  position: 'absolute',
  top: -6,
  right: -6,
  minWidth: 16,
  height: 16,
  padding: '0 3px',
  borderRadius: 20,
  background: '#E53935',
  color: '#fff',
  fontSize: 10,
  fontWeight: 700,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  lineHeight: 1,
}
export default function TabBrandSelector({ myBrands, storageKey, onSelect, lowStockCounts, showAllOption }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const brandIdsKey = myBrands.map((b) => b.id).join('|')
  useEffect(() => {
    if (!myBrands.length) {
      setSelectedId(null)
      return
    }
    let initial = showAllOption ? 'all' : myBrands[0].id
    try {
      const saved = typeof window !== 'undefined' ? localStorage.getItem(storageKey) : null
      if (saved && (saved === 'all' ? showAllOption : myBrands.some((b) => b.id === saved))) initial = saved
    } catch {
      /* ignore */
    }
    setSelectedId(initial)
    onSelect(initial)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- brandIdsKey / storageKey only (avoid myBrands ref churn)
  }, [brandIdsKey, storageKey, showAllOption])
  const select = (id: string) => {
    setSelectedId(id)
    try {
      localStorage.setItem(storageKey, id)
    } catch {
      /* ignore */
    }
    onSelect(id)
  }
  if (!myBrands.length) return null
  const totalLowStock = lowStockCounts ? Object.values(lowStockCounts).reduce((s, n) => s + n, 0) : 0
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
      <span style={{ fontSize: 11, color: SUB, marginRight: 2 }}>브랜드</span>
      {showAllOption && (
        <button type="button" onClick={() => select('all')} style={pillStyle(selectedId === 'all')}>
          전체
          {totalLowStock > 0 && <span style={badgeStyle}>{totalLowStock}</span>}
        </button>
      )}
      {myBrands.map((b) => {
        const count = lowStockCounts?.[b.id] || 0
        return (
          <button key={b.id} type="button" onClick={() => select(b.id)} style={pillStyle(selectedId === b.id)}>
            {b.name}
            {count > 0 && <span style={badgeStyle}>{count}</span>}
          </button>
        )
      })}
    </div>
  )
}
