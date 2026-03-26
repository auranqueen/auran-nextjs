'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type GuideItem = {
  id: string
  icon: string | null
  name: string
  description: string | null
  categories: string[] | null
}

const PURPLE = '#7B5EA7'

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

export default function AuranGuide() {
  const supabase = createClient()
  const [items, setItems] = useState<GuideItem[]>([])
  const [doneMap, setDoneMap] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const raw = typeof window !== 'undefined' ? localStorage.getItem('auran_guide_done') : null
    if (raw) {
      try {
        setDoneMap(JSON.parse(raw))
      } catch {
        setDoneMap({})
      }
    }
  }, [])

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('feature_releases')
        .select('*')
        .order('release_date', { ascending: false })
        .limit(100)
      const rows = (data || [])
        .map((r: any) => ({
          id: String(r.id),
          icon: r.icon ?? null,
          name: String(r.name || ''),
          description: r.description ?? null,
          categories: normalizeCategories(r.categories),
        }))
        .filter((r: GuideItem) => (r.categories || []).includes('guide'))
      setItems(rows)
    }
    void load()
  }, [supabase])

  const completed = useMemo(() => items.filter(i => doneMap[i.id]).length, [items, doneMap])
  const total = items.length
  const ratio = total > 0 ? Math.round((completed / total) * 100) : 0

  const toggleDone = async (item: GuideItem) => {
    const next = !doneMap[item.id]
    const nextMap = { ...doneMap, [item.id]: next }
    setDoneMap(nextMap)
    if (typeof window !== 'undefined') {
      localStorage.setItem('auran_guide_done', JSON.stringify(nextMap))
    }
    if (!next) return

    const { data: userData } = await supabase.auth.getUser()
    const uid = userData.user?.id
    if (!uid) return

    const { data: prof } = await supabase
      .from('profiles')
      .select('id, point')
      .eq('id', uid)
      .maybeSingle()
    const current = Number(prof?.point ?? 0)
    await supabase
      .from('profiles')
      .update({ point: current + 100 })
      .eq('id', uid)
  }

  return (
    <div style={{ background: 'rgba(123,94,167,0.06)', border: '1px solid rgba(123,94,167,0.25)', borderRadius: 14, padding: 14 }}>
      <div style={{ fontSize: 16, color: '#fff', marginBottom: 8 }}>AURAN 100% 활용하기</div>
      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', marginBottom: 6 }}>
        완료 {completed}/{total} 💜
      </div>
      <div style={{ width: '100%', height: 8, background: 'rgba(255,255,255,0.1)', borderRadius: 999, overflow: 'hidden', marginBottom: 12 }}>
        <div style={{ width: `${ratio}%`, height: '100%', background: PURPLE }} />
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        {items.map(item => {
          const done = Boolean(doneMap[item.id])
          return (
            <div
              key={item.id}
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 12,
                padding: 12,
                opacity: done ? 0.5 : 1,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ fontSize: 20, lineHeight: 1 }}>{item.icon || '💜'}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: '#fff', marginBottom: 3 }}>
                    {item.name} {done ? '✅' : ''}
                  </div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>{item.description || ''}</div>
                </div>
                <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
                  <input
                    type="checkbox"
                    checked={done}
                    onChange={() => void toggleDone(item)}
                  />
                  완료
                </label>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

