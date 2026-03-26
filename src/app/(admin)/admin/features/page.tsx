'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type FeatureItem = {
  id: string
  icon: string | null
  name: string
  description: string | null
  categories: string[] | null
  release_date: string | null
  is_active: boolean | null
}

const BG = '#0D0B09'
const GOLD = '#C9A96E'
const PURPLE = '#7B5EA7'

const CATEGORY_LABELS: Record<string, string> = {
  onboarding: '온보딩',
  notice: '공지',
  guide: '가이드',
  magazine: '매거진',
}

const CATEGORY_COLORS: Record<string, string> = {
  onboarding: '#7B5EA7',
  notice: '#ff6b6b',
  guide: '#C9A96E',
  magazine: '#6bcb77',
}

function normalizeCategories(value: any): string[] {
  if (Array.isArray(value)) return value.map(v => String(v))
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) return parsed.map(v => String(v))
    } catch {
      return value.split(',').map(v => v.trim()).filter(Boolean)
    }
  }
  return []
}

export default function AdminFeaturesPage() {
  const supabase = createClient()

  const [items, setItems] = useState<FeatureItem[]>([])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<FeatureItem | null>(null)
  const [loading, setLoading] = useState(false)

  const [icon, setIcon] = useState('✨')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [categories, setCategories] = useState<string[]>([])
  const [releaseDate, setReleaseDate] = useState('')
  const [isActive, setIsActive] = useState(true)

  const sorted = useMemo(() => {
    return [...items].sort((a, b) => {
      const at = new Date(a.release_date || 0).getTime()
      const bt = new Date(b.release_date || 0).getTime()
      return bt - at
    })
  }, [items])

  const resetForm = () => {
    setEditing(null)
    setIcon('✨')
    setName('')
    setDescription('')
    setCategories([])
    setReleaseDate('')
    setIsActive(true)
  }

  const load = async () => {
    const { data } = await supabase
      .from('feature_releases')
      .select('*')
      .order('release_date', { ascending: false })
      .limit(100)
    const rows = (data || []).map((r: any) => ({
      id: String(r.id),
      icon: r.icon ?? null,
      name: String(r.name || ''),
      description: r.description ?? null,
      categories: normalizeCategories(r.categories),
      release_date: r.release_date ?? null,
      is_active: r.is_active ?? true,
    }))
    setItems(rows)
  }

  useEffect(() => {
    void load()
  }, [])

  const openCreate = () => {
    resetForm()
    setOpen(true)
  }

  const openEdit = (item: FeatureItem) => {
    setEditing(item)
    setIcon(item.icon || '✨')
    setName(item.name || '')
    setDescription(item.description || '')
    setCategories(item.categories || [])
    setReleaseDate(item.release_date ? String(item.release_date).slice(0, 10) : '')
    setIsActive(Boolean(item.is_active))
    setOpen(true)
  }

  const toggleCategory = (value: string) => {
    setCategories(prev => (prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]))
  }

  const save = async () => {
    if (!name.trim()) return
    setLoading(true)
    const payload = {
      icon: icon.trim() || '✨',
      name: name.trim(),
      description: description.trim() || null,
      categories,
      release_date: releaseDate || null,
      is_active: isActive,
    }
    if (editing?.id) {
      await supabase.from('feature_releases').update(payload).eq('id', editing.id)
    } else {
      await supabase.from('feature_releases').insert(payload)
    }

    if (categories.includes('notice')) {
      await supabase.from('notices').insert({
        title: `${icon || '✨'} ${name.trim()} 새로 생겼어요!`,
        body: description.trim() || '',
        type: 'feature',
        is_important: false,
      })
    }

    setOpen(false)
    resetForm()
    await load()
    setLoading(false)
  }

  const removeItem = async (id: string) => {
    await supabase.from('feature_releases').delete().eq('id', id)
    await load()
  }

  const toggleActive = async (item: FeatureItem) => {
    await supabase
      .from('feature_releases')
      .update({ is_active: !item.is_active })
      .eq('id', item.id)
    await load()
  }

  return (
    <div style={{ minHeight: '100vh', background: BG, color: '#fff', padding: 20 }}>
      <div style={{ maxWidth: 860, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 18, color: GOLD }}>기능 출시 관리</div>
          <button
            type="button"
            onClick={openCreate}
            style={{ border: 'none', borderRadius: 10, background: PURPLE, color: '#fff', fontSize: 13, padding: '10px 14px', cursor: 'pointer' }}
          >
            새 기능 등록
          </button>
        </div>

        <div style={{ display: 'grid', gap: 10 }}>
          {sorted.map(item => (
            <div key={item.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 15, marginBottom: 4 }}>
                    {item.icon || '✨'} {item.name}
                  </div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 8 }}>
                    {item.description || ''}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                    {(item.categories || []).map(c => (
                      <span
                        key={c}
                        style={{
                          fontSize: 10,
                          borderRadius: 999,
                          padding: '3px 8px',
                          color: '#fff',
                          background: CATEGORY_COLORS[c] || 'rgba(255,255,255,0.2)',
                        }}
                      >
                        {CATEGORY_LABELS[c] || c}
                      </span>
                    ))}
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>
                    출시일: {item.release_date ? String(item.release_date).slice(0, 10) : '-'}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => void toggleActive(item)}
                    style={{
                      border: '1px solid rgba(255,255,255,0.2)',
                      borderRadius: 999,
                      background: item.is_active ? 'rgba(107,203,119,0.2)' : 'rgba(255,255,255,0.08)',
                      color: '#fff',
                      fontSize: 11,
                      padding: '4px 10px',
                      cursor: 'pointer',
                    }}
                  >
                    {item.is_active ? '활성' : '비활성'}
                  </button>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => openEdit(item)}
                      style={{ border: 'none', borderRadius: 8, background: 'rgba(123,94,167,0.2)', color: '#fff', fontSize: 11, padding: '6px 10px', cursor: 'pointer' }}
                    >
                      수정
                    </button>
                    <button
                      type="button"
                      onClick={() => void removeItem(item.id)}
                      style={{ border: 'none', borderRadius: 8, background: 'rgba(255,107,107,0.2)', color: '#fff', fontSize: 11, padding: '6px 10px', cursor: 'pointer' }}
                    >
                      삭제
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {open ? (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ width: 'min(560px, 100%)', background: '#171411', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: 16 }}>
            <div style={{ fontSize: 15, marginBottom: 12 }}>{editing ? '기능 수정' : '기능 등록'}</div>
            <input
              value={icon}
              onChange={e => setIcon(e.target.value)}
              placeholder="아이콘 (이모지)"
              style={{ width: '100%', marginBottom: 8, padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: 13, boxSizing: 'border-box' }}
            />
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="기능명"
              style={{ width: '100%', marginBottom: 8, padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: 13, boxSizing: 'border-box' }}
            />
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="설명"
              rows={4}
              style={{ width: '100%', marginBottom: 10, padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: 13, boxSizing: 'border-box' }}
            />

            <div style={{ fontSize: 12, marginBottom: 6 }}>카테고리</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
              {['onboarding', 'notice', 'guide', 'magazine'].map(c => (
                <label key={c} style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input
                    type="checkbox"
                    checked={categories.includes(c)}
                    onChange={() => toggleCategory(c)}
                  />
                  {CATEGORY_LABELS[c]}
                </label>
              ))}
            </div>

            <input
              type="date"
              value={releaseDate}
              onChange={e => setReleaseDate(e.target.value)}
              style={{ width: '100%', marginBottom: 10, padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: 13, boxSizing: 'border-box' }}
            />
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, marginBottom: 12 }}>
              <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} />
              활성여부
            </label>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => {
                  setOpen(false)
                  resetForm()
                }}
                style={{ border: '1px solid rgba(255,255,255,0.2)', borderRadius: 10, background: 'transparent', color: '#fff', fontSize: 13, padding: '10px 12px', cursor: 'pointer' }}
              >
                취소
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => void save()}
                style={{ border: 'none', borderRadius: 10, background: PURPLE, color: '#fff', fontSize: 13, padding: '10px 12px', cursor: 'pointer' }}
              >
                저장
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

