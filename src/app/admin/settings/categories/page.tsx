'use client'
import { createClient } from '@/lib/supabase/client'
import { useCallback, useEffect, useState } from 'react'

interface CatRow {
  id: string
  name: string
  parent_id: string | null
  level: number
  sort_order: number
}

export default function CategoryPage() {
  const supabase = createClient()
  const [rows, setRows] = useState<CatRow[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('categories')
      .select('id, name, parent_id, level, sort_order')
      .order('level', { ascending: true })
      .order('sort_order', { ascending: true })
    setRows(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const getChildren = (parentId: string | null) => rows.filter(r => r.parent_id === parentId)

  const toggleExpand = (id: string) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }))

  const startEdit = (row: CatRow) => {
    setEditingId(row.id)
    setEditingName(row.name)
  }

  const saveEdit = async (id: string) => {
    if (!editingName.trim()) return
    setSaving(true)
    await supabase
      .from('categories')
      .update({ name: editingName.trim() })
      .eq('id', id)
    setEditingId(null)
    setSaving(false)
    await load()
  }

  const addChild = async (parentId: string, level: number) => {
    const name = prompt('카테고리 이름:')
    if (!name?.trim()) return
    const siblings = rows.filter(r => r.parent_id === parentId)
    const sort_order = siblings.length
    await supabase.from('categories').insert({
      name: name.trim(),
      parent_id: parentId,
      level: level + 1,
      sort_order,
    })
    setExpanded(prev => ({ ...prev, [parentId]: true }))
    await load()
  }

  const addRoot = async () => {
    const name = prompt('대카테고리 이름:')
    if (!name?.trim()) return
    const roots = rows.filter(r => r.parent_id === null)
    await supabase.from('categories').insert({
      name: name.trim(),
      parent_id: null,
      level: 1,
      sort_order: roots.length,
    })
    await load()
  }

  const deleteRow = async (id: string) => {
    const hasChildren = rows.some(r => r.parent_id === id)
    if (hasChildren) {
      alert('하위 카테고리가 있으면 삭제할 수 없어요. 하위 먼저 삭제해주세요.')
      return
    }
    if (!confirm('삭제할까요?')) return
    await supabase.from('categories').delete().eq('id', id)
    await load()
  }

  const renderTree = (parentId: string | null, depth: number) => {
    const children = getChildren(parentId)
    if (children.length === 0) return null
    return children.map(row => {
      const hasChildren = rows.some(r => r.parent_id === row.id)
      const isExpanded = expanded[row.id]
      const isEditing = editingId === row.id
      const isConcern = row.level === 4
      return (
        <div key={row.id} style={{ marginLeft: depth * 16 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 10px',
              marginBottom: 4,
              background: isConcern ? 'rgba(201,169,110,0.08)' : 'rgba(255,255,255,0.03)',
              border: `0.5px solid ${isConcern ? 'rgba(201,169,110,0.25)' : 'rgba(255,255,255,0.08)'}`,
              borderRadius: 10,
            }}
          >
            {hasChildren ? (
              <button
                onClick={() => toggleExpand(row.id)}
                style={{
                  width: 20,
                  height: 20,
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  color: 'rgba(255,255,255,0.4)',
                  fontSize: 12,
                  flexShrink: 0,
                  padding: 0,
                  transform: isExpanded ? 'rotate(90deg)' : 'none',
                  transition: 'transform 0.15s',
                }}
              >
                ▶
              </button>
            ) : (
              <div style={{ width: 20, flexShrink: 0 }} />
            )}

            {isEditing ? (
              <input
                value={editingName}
                onChange={e => setEditingName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') void saveEdit(row.id)
                  if (e.key === 'Escape') setEditingId(null)
                }}
                autoFocus
                style={{
                  flex: 1,
                  fontSize: 13,
                  background: 'rgba(255,255,255,0.08)',
                  border: '0.5px solid rgba(123,94,167,0.5)',
                  borderRadius: 7,
                  padding: '4px 8px',
                  color: '#fff',
                }}
              />
            ) : (
              <span
                style={{
                  flex: 1,
                  fontSize: 13,
                  color: isConcern ? '#C9A96E' : 'rgba(255,255,255,0.85)',
                }}
              >
                {row.name}
              </span>
            )}

            <span
              style={{
                fontSize: 10,
                padding: '2px 6px',
                borderRadius: 20,
                background: 'rgba(123,94,167,0.15)',
                color: '#c4a7e7',
                border: '0.5px solid rgba(123,94,167,0.3)',
                flexShrink: 0,
              }}
            >
              {row.level}차
            </span>

            {isEditing ? (
              <>
                <button
                  onClick={() => void saveEdit(row.id)}
                  disabled={saving}
                  style={{
                    fontSize: 11,
                    padding: '4px 10px',
                    borderRadius: 7,
                    border: 'none',
                    background: '#7B5EA7',
                    color: '#fff',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  저장
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  style={{
                    fontSize: 11,
                    padding: '4px 10px',
                    borderRadius: 7,
                    border: '0.5px solid rgba(255,255,255,0.15)',
                    background: 'transparent',
                    color: 'rgba(255,255,255,0.5)',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  취소
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => startEdit(row)}
                  style={{
                    fontSize: 11,
                    padding: '4px 8px',
                    borderRadius: 7,
                    border: '0.5px solid rgba(255,255,255,0.1)',
                    background: 'transparent',
                    color: 'rgba(255,255,255,0.4)',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  수정
                </button>
                {row.level < 5 && (
                  <button
                    onClick={() => void addChild(row.id, row.level)}
                    style={{
                      fontSize: 11,
                      padding: '4px 8px',
                      borderRadius: 7,
                      border: '0.5px solid rgba(123,94,167,0.3)',
                      background: 'rgba(123,94,167,0.1)',
                      color: '#c4a7e7',
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    + 하위
                  </button>
                )}
                <button
                  onClick={() => void deleteRow(row.id)}
                  style={{
                    fontSize: 11,
                    padding: '4px 8px',
                    borderRadius: 7,
                    border: '0.5px solid rgba(224,80,80,0.3)',
                    background: 'transparent',
                    color: 'rgba(224,80,80,0.6)',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  삭제
                </button>
              </>
            )}
          </div>

          {isExpanded && renderTree(row.id, depth + 1)}
        </div>
      )
    })
  }

  return (
    <div
      style={{
        padding: '24px 20px',
        maxWidth: 900,
        color: '#fff',
        fontFamily: 'inherit',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
        }}
      >
        <div>
          <div style={{ fontSize: 18, fontWeight: 500, marginBottom: 4 }}>카테고리 관리</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
            1차(화장품/기기) → 2차(스킨케어/바디) → 3차(단계별) → 4차(고민별)
          </div>
        </div>
        <button
          onClick={() => void addRoot()}
          style={{
            padding: '9px 16px',
            borderRadius: 10,
            background: '#7B5EA7',
            border: 'none',
            color: '#fff',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          + 대카테고리 추가
        </button>
      </div>

      {loading ? (
        <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>불러오는 중...</div>
      ) : (
        <div>
          {renderTree(null, 0)}
          {rows.filter(r => r.parent_id === null).length === 0 && (
            <div
              style={{
                color: 'rgba(255,255,255,0.3)',
                fontSize: 13,
                textAlign: 'center',
                padding: 32,
              }}
            >
              카테고리가 없어요. 대카테고리를 추가해주세요.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
