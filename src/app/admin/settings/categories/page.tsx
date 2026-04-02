'use client'

import { createClient } from '@/lib/supabase/client'
import { useCallback, useEffect, useMemo, useState } from 'react'

type Cat = {
  id: string
  name: string
  parent_id: string | null
  level: number
  sort_order: number | null
}

type FlatRow = Cat & { depth: number }

export default function AdminCategoriesPage() {
  const supabase = createClient()
  const [rows, setRows] = useState<Cat[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  const [sheet, setSheet] = useState<Cat | null>(null)
  const [sheetName, setSheetName] = useState('')
  const [sheetSort, setSheetSort] = useState('0')
  const [savingSheet, setSavingSheet] = useState(false)

  const loadRows = useCallback(async () => {
    const { data, error } = await supabase
      .from('categories')
      .select('id,name,parent_id,level,sort_order')
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('name', { ascending: true })
    if (error) {
      setToast(error.message)
      setRows([])
      return
    }
    setRows((data || []) as Cat[])
  }, [supabase])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      await loadRows()
      if (!cancelled) setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [loadRows])

  const flatRows = useMemo(() => {
    const byParent = new Map<string | null, Cat[]>()
    for (const c of rows) {
      const k = c.parent_id == null || c.parent_id === '' ? null : String(c.parent_id)
      if (!byParent.has(k)) byParent.set(k, [])
      byParent.get(k)!.push(c)
    }
    byParent.forEach(arr => {
      arr.sort((a: Cat, b: Cat) => {
        const sa = a.sort_order ?? 0
        const sb = b.sort_order ?? 0
        if (sa !== sb) return sa - sb
        return (a.name || '').localeCompare(b.name || '', 'ko')
      })
    })
    const out: FlatRow[] = []
    const walk = (parentId: string | null, depth: number) => {
      const ch = byParent.get(parentId) || []
      for (const c of ch) {
        out.push({ ...c, depth })
        walk(String(c.id), depth + 1)
      }
    }
    walk(null, 0)
    return out
  }, [rows])

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2200)
  }

  const openSheet = (c: Cat) => {
    setSheet(c)
    setSheetName(c.name || '')
    setSheetSort(String(c.sort_order ?? 0))
  }

  const closeSheet = () => {
    setSheet(null)
    setSheetName('')
    setSheetSort('0')
  }

  const saveSheet = async () => {
    if (!sheet) return
    setSavingSheet(true)
    try {
      const so = Math.floor(Number(sheetSort) || 0)
      const { error } = await supabase
        .from('categories')
        .update({ name: sheetName.trim() || '이름 없음', sort_order: so } as any)
        .eq('id', sheet.id)
      if (error) throw error
      showToast('저장됨')
      closeSheet()
      await loadRows()
    } catch (e: unknown) {
      setToast(e instanceof Error ? e.message : '저장 실패')
    } finally {
      setSavingSheet(false)
    }
  }

  const addRoot = async () => {
    const siblings = rows.filter(r => r.parent_id == null || r.parent_id === '')
    const maxSort = siblings.reduce((m, r) => Math.max(m, r.sort_order ?? 0), -1)
    const { error } = await supabase
      .from('categories')
      .insert({
        name: '새 대분류',
        parent_id: null,
        level: 1,
        sort_order: maxSort + 1,
      } as any)
    if (error) {
      setToast(error.message)
      return
    }
    showToast('대분류 추가됨')
    await loadRows()
  }

  const addChild = async (parent: Cat) => {
    if ((parent.level ?? 1) >= 5) return
    const siblings = rows.filter(r => String(r.parent_id || '') === String(parent.id))
    const maxSort = siblings.reduce((m, r) => Math.max(m, r.sort_order ?? 0), -1)
    const nextLevel = (parent.level ?? 1) + 1
    const { error } = await supabase
      .from('categories')
      .insert({
        name: '새 하위',
        parent_id: parent.id,
        level: nextLevel,
        sort_order: maxSort + 1,
      } as any)
    if (error) {
      setToast(error.message)
      return
    }
    showToast('하위 카테고리 추가됨')
    await loadRows()
  }

  const moveRow = async (c: Cat, dir: -1 | 1) => {
    const pid = c.parent_id == null || c.parent_id === '' ? null : String(c.parent_id)
    const siblings = rows
      .filter(r => {
        const rp = r.parent_id == null || r.parent_id === '' ? null : String(r.parent_id)
        return rp === pid
      })
      .sort((a, b) => {
        const sa = a.sort_order ?? 0
        const sb = b.sort_order ?? 0
        if (sa !== sb) return sa - sb
        return (a.name || '').localeCompare(b.name || '', 'ko')
      })
    const i = siblings.findIndex(s => s.id === c.id)
    const j = i + dir
    if (i < 0 || j < 0 || j >= siblings.length) return
    const a = siblings[i]
    const b = siblings[j]
    const sa = a.sort_order ?? i
    const sb = b.sort_order ?? j
    const { error: e1 } = await supabase.from('categories').update({ sort_order: sb } as any).eq('id', a.id)
    if (e1) {
      setToast(e1.message)
      return
    }
    const { error: e2 } = await supabase.from('categories').update({ sort_order: sa } as any).eq('id', b.id)
    if (e2) {
      setToast(e2.message)
      return
    }
    showToast('순서 변경됨')
    await loadRows()
  }

  return (
    <div style={{ padding: '18px 16px 80px', maxWidth: 720, margin: '0 auto' }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 900, color: '#fff' }}>카테고리 관리</div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 6, lineHeight: 1.5 }}>
          대 → 중 → 소 → 세부 → 스킨태그 (5단계) · 노드를 눌러 이름·순서 수정 · ↑↓로 형제 간 순서 변경
        </div>
      </div>

      {toast ? (
        <div
          style={{
            marginBottom: 12,
            padding: '10px 12px',
            borderRadius: 10,
            background: 'rgba(201,168,76,0.12)',
            border: '1px solid rgba(201,168,76,0.35)',
            color: '#e8d4a8',
            fontSize: 12,
          }}
        >
          {toast}
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => void addRoot()}
        style={{
          marginBottom: 14,
          width: '100%',
          padding: '12px 14px',
          borderRadius: 12,
          border: '1px solid rgba(201,168,76,0.45)',
          background: 'rgba(201,168,76,0.15)',
          color: '#c9a84c',
          fontSize: 13,
          fontWeight: 800,
          cursor: 'pointer',
        }}
      >
        + 최상위(대분류) 추가
      </button>

      {loading ? (
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>불러오는 중…</div>
      ) : flatRows.length === 0 ? (
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>등록된 카테고리가 없습니다.</div>
      ) : (
        <div style={{ display: 'grid', gap: 6 }}>
          {flatRows.map(row => (
            <div
              key={row.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                flexWrap: 'wrap',
                padding: '10px 10px',
                borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.08)',
                background: 'rgba(255,255,255,0.03)',
                paddingLeft: 10 + row.depth * 14,
              }}
            >
              <button
                type="button"
                onClick={() => openSheet(row)}
                style={{
                  flex: 1,
                  minWidth: 120,
                  textAlign: 'left',
                  background: 'transparent',
                  border: 'none',
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  padding: '4px 0',
                }}
              >
                <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, marginRight: 6 }}>L{row.level}</span>
                {row.name}
              </button>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={() => void moveRow(row, -1)}
                  style={{
                    width: 36,
                    height: 34,
                    borderRadius: 10,
                    border: '1px solid rgba(255,255,255,0.12)',
                    background: 'rgba(255,255,255,0.06)',
                    color: '#fff',
                    fontSize: 14,
                    cursor: 'pointer',
                  }}
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => void moveRow(row, 1)}
                  style={{
                    width: 36,
                    height: 34,
                    borderRadius: 10,
                    border: '1px solid rgba(255,255,255,0.12)',
                    background: 'rgba(255,255,255,0.06)',
                    color: '#fff',
                    fontSize: 14,
                    cursor: 'pointer',
                  }}
                >
                  ↓
                </button>
                {(row.level ?? 1) < 5 ? (
                  <button
                    type="button"
                    onClick={() => void addChild(row)}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 10,
                      border: '1px solid rgba(76,173,126,0.35)',
                      background: 'rgba(76,173,126,0.12)',
                      color: '#7dce9a',
                      fontSize: 11,
                      fontWeight: 800,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    하위 추가
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}

      {sheet ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 200,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
          }}
        >
          <button
            type="button"
            aria-label="닫기"
            onClick={closeSheet}
            style={{
              flex: 1,
              minHeight: 48,
              border: 'none',
              cursor: 'pointer',
              background: 'rgba(0,0,0,0.45)',
            }}
          />
          <div
            style={{
              background: '#141414',
              borderTopLeftRadius: 18,
              borderTopRightRadius: 18,
              border: '1px solid rgba(255,255,255,0.12)',
              borderBottom: 'none',
              padding: '18px 16px 24px',
              maxHeight: '85vh',
              overflowY: 'auto',
              boxShadow: '0 -8px 40px rgba(0,0,0,0.5)',
            }}
          >
            <div
              style={{
                width: 40,
                height: 4,
                borderRadius: 99,
                background: 'rgba(255,255,255,0.15)',
                margin: '0 auto 16px',
              }}
            />
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginBottom: 10 }}>
              카테고리 수정 · L{sheet.level}
            </div>
            <label style={{ display: 'grid', gap: 6, marginBottom: 12 }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>이름</span>
              <input
                value={sheetName}
                onChange={e => setSheetName(e.target.value)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '12px 12px',
                  borderRadius: 12,
                  border: '1px solid rgba(255,255,255,0.12)',
                  background: '#0c0c0c',
                  color: '#fff',
                  fontSize: 15,
                }}
              />
            </label>
            <label style={{ display: 'grid', gap: 6, marginBottom: 16 }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>정렬 순서 (숫자 작을수록 위)</span>
              <input
                value={sheetSort}
                onChange={e => setSheetSort(e.target.value.replace(/[^0-9-]/g, ''))}
                inputMode="numeric"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '12px 12px',
                  borderRadius: 12,
                  border: '1px solid rgba(255,255,255,0.12)',
                  background: '#0c0c0c',
                  color: '#fff',
                  fontSize: 15,
                }}
              />
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button
                type="button"
                onClick={closeSheet}
                style={{
                  padding: '14px 12px',
                  borderRadius: 12,
                  border: '1px solid rgba(255,255,255,0.15)',
                  background: 'rgba(255,255,255,0.06)',
                  color: 'rgba(255,255,255,0.75)',
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                취소
              </button>
              <button
                type="button"
                disabled={savingSheet}
                onClick={() => void saveSheet()}
                style={{
                  padding: '14px 12px',
                  borderRadius: 12,
                  border: '1px solid rgba(201,168,76,0.45)',
                  background: 'rgba(201,168,76,0.2)',
                  color: '#c9a84c',
                  fontSize: 14,
                  fontWeight: 800,
                  cursor: 'pointer',
                  opacity: savingSheet ? 0.65 : 1,
                }}
              >
                {savingSheet ? '저장 중…' : '저장'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
