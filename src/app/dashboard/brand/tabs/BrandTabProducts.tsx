'use client'

import { useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import ProductThumbnail from '@/components/ProductThumbnail'

const CARD: CSSProperties = {
  background: '#1a1520',
  border: '0.5px solid rgba(255,255,255,0.07)',
  borderRadius: 10,
  padding: 14,
  marginBottom: 10,
}
const PURPLE = '#7B5EA7'
const TEXT = 'rgba(255,255,255,0.65)'
const SUB = 'rgba(255,255,255,0.3)'

type Row = Record<string, unknown>

interface Props {
  rows: Row[]
  tab: 'pending' | 'active' | 'hidden'
  onTabChange: (t: 'pending' | 'active' | 'hidden') => void
  onEdit: (p: Row) => void
  onNew: () => void
  currentBrandName?: string
}

function rowBrandId(row: Row): string {
  return String(row.brand_id || '')
}

function rowBrandName(row: Row): string {
  return String((row.brands as { name?: string } | null)?.name || '브랜드')
}

function badge(p: Row) {
  const s = String(p.status || '')
  if (s === 'active') return { t: '판매중', bg: 'rgba(76,175,80,0.15)', color: '#4CAF50' }
  if (s === 'hidden' || s === 'discontinued') return { t: '숨김', bg: 'rgba(255,255,255,0.07)', color: SUB }
  return { t: '승인 대기', bg: 'rgba(255,193,7,0.15)', color: '#FFC107' }
}

export default function BrandTabProducts({
  rows,
  tab,
  onTabChange,
  onEdit,
  onNew,
  currentBrandName = '',
}: Props) {
  const [brandFilter, setBrandFilter] = useState<'all' | string>('all')

  const brandOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const row of rows) {
      const id = rowBrandId(row)
      if (!id) continue
      if (!map.has(id)) map.set(id, rowBrandName(row))
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ko'))
  }, [rows])

  const activeCountByBrandId = useMemo(() => {
    const counts = new Map<string, number>()
    for (const row of rows) {
      if (String(row.status || '') !== 'active') continue
      const id = rowBrandId(row)
      if (!id) continue
      counts.set(id, (counts.get(id) || 0) + 1)
    }
    return counts
  }, [rows])

  const totalActiveCount = useMemo(
    () => rows.filter((row) => String(row.status || '') === 'active').length,
    [rows],
  )

  const brandFilteredRows = useMemo(() => {
    if (brandFilter === 'all') return rows
    return rows.filter((row) => rowBrandId(row) === brandFilter)
  }, [rows, brandFilter])

  const counts = useMemo(() => {
    let pending = 0
    let active = 0
    let hidden = 0
    for (const row of brandFilteredRows) {
      const st = String(row.status || '')
      if (st === 'active') active++
      else if (st === 'hidden' || st === 'discontinued') hidden++
      else pending++
    }
    return { pending, active, hidden }
  }, [brandFilteredRows])

  const filtered = useMemo(() => {
    return brandFilteredRows.filter((row) => {
      const st = String(row.status || '')
      if (tab === 'active') return st === 'active'
      if (tab === 'hidden') return st === 'hidden' || st === 'discontinued'
      return !['active', 'hidden', 'discontinued'].includes(st)
    })
  }, [brandFilteredRows, tab])

  const pillStyle = (selected: boolean): CSSProperties => ({
    fontSize: 12,
    padding: '5px 14px',
    borderRadius: 20,
    border: `0.5px solid ${selected ? PURPLE : 'rgba(255,255,255,0.1)'}`,
    background: selected ? 'rgba(123,94,167,0.2)' : 'transparent',
    color: selected ? '#c4a7e7' : SUB,
    cursor: 'pointer',
  })

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          marginBottom: 10,
          flexWrap: 'wrap',
        }}
      >
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: '#c4a7e7',
            padding: '6px 12px',
            borderRadius: 8,
            background: 'rgba(123,94,167,0.15)',
            border: '1px solid rgba(123,94,167,0.35)',
          }}
        >
          등록 기본 브랜드:{' '}
          <span style={{ color: '#fff' }}>{currentBrandName || '—'}</span>
        </div>
        <button
          type="button"
          onClick={onNew}
          style={{
            fontSize: 12,
            padding: '6px 14px',
            borderRadius: 8,
            border: 'none',
            background: PURPLE,
            color: '#fff',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          + 새 제품 등록
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => setBrandFilter('all')}
          style={pillStyle(brandFilter === 'all')}
        >
          전체 (판매중 {totalActiveCount})
        </button>
        {brandOptions.map((brand) => (
          <button
            key={brand.id}
            type="button"
            onClick={() => setBrandFilter(brand.id)}
            style={pillStyle(brandFilter === brand.id)}
          >
            {brand.name} (판매중 {activeCountByBrandId.get(brand.id) || 0})
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        {(
          [
            { key: 'pending', label: '승인 대기' },
            { key: 'active', label: '판매중' },
            { key: 'hidden', label: '숨김' },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => onTabChange(t.key)}
            style={pillStyle(tab === t.key)}
          >
            {t.label} ({counts[t.key]})
          </button>
        ))}
      </div>

      <div style={CARD}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 24, color: SUB, fontSize: 13 }}>
            이 탭에 표시할 제품이 없습니다.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map((p) => {
              const b = badge(p)
              const showBrandBadge = brandFilter === 'all'
              return (
                <div key={String(p.id)} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div style={{ width: 56, height: 56, borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
                    <ProductThumbnail
                      src={typeof p.thumb_img === 'string' ? p.thumb_img : null}
                      alt={String(p.name || '')}
                      size={56}
                    />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13,
                        color: TEXT,
                        marginBottom: 4,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {String(p.name || '이름 없음')}
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {showBrandBadge && (
                        <span
                          style={{
                            fontSize: 10,
                            padding: '2px 8px',
                            borderRadius: 10,
                            background: 'rgba(123,94,167,0.15)',
                            color: '#c4a7e7',
                          }}
                        >
                          {rowBrandName(p)}
                        </span>
                      )}
                      <span
                        style={{
                          fontSize: 11,
                          padding: '2px 8px',
                          borderRadius: 10,
                          background: b.bg,
                          color: b.color,
                        }}
                      >
                        {b.t}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onEdit(p)}
                    style={{
                      fontSize: 11,
                      padding: '4px 12px',
                      borderRadius: 6,
                      border: '0.5px solid rgba(255,255,255,0.15)',
                      background: 'transparent',
                      color: SUB,
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    수정
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
