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
  }
}

export default function TabBrandSelector({ myBrands, storageKey, onSelect }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const brandIdsKey = myBrands.map((b) => b.id).join('|')

  useEffect(() => {
    if (!myBrands.length) {
      setSelectedId(null)
      return
    }
    let initial = myBrands[0].id
    try {
      const saved = typeof window !== 'undefined' ? localStorage.getItem(storageKey) : null
      if (saved && myBrands.some((b) => b.id === saved)) initial = saved
    } catch {
      /* ignore */
    }
    setSelectedId(initial)
    onSelect(initial)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- brandIdsKey / storageKey only (avoid myBrands ref churn)
  }, [brandIdsKey, storageKey])

  if (!myBrands.length) return null

  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
      <span style={{ fontSize: 11, color: SUB, marginRight: 2 }}>브랜드</span>
      {myBrands.map((b) => (
        <button
          key={b.id}
          type="button"
          onClick={() => {
            setSelectedId(b.id)
            try {
              localStorage.setItem(storageKey, b.id)
            } catch {
              /* ignore */
            }
            onSelect(b.id)
          }}
          style={pillStyle(selectedId === b.id)}
        >
          {b.name}
        </button>
      ))}
    </div>
  )
}
