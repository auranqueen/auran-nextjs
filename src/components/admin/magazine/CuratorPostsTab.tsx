'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import SlideUpSheet from '@/components/ui/SlideUpSheet'

type CuratorPost = {
  id: string
  title: string | null
  category: string | null
  is_published: boolean | null
  author_type: string | null
  created_by: string | null
  created_at: string
  slug: string | null
}

const nameOf = (p: Record<string, unknown>) =>
  String(p.full_name || p.name || p.nickname || p.email || '-')

const fmtDate = (s: string | null | undefined) => (s ? new Date(s).toLocaleString('ko-KR') : '-')

const publishBtn = {
  border: 'none',
  background: '#3db87a',
  color: '#fff',
  borderRadius: 7,
  padding: '5px 14px',
  fontSize: 12,
  cursor: 'pointer',
} as const

const cancelBtn = {
  border: 'none',
  background: '#f8d7da',
  color: '#58151c',
  borderRadius: 7,
  padding: '5px 14px',
  fontSize: 12,
  cursor: 'pointer',
} as const

function StatusBadge({ published }: { published: boolean }) {
  return published ? (
    <span style={{ background: '#d1e7dd', color: '#0a3622', borderRadius: 12, padding: '2px 10px', fontSize: 11 }}>✅ 발행됨</span>
  ) : (
    <span style={{ background: '#fff3cd', color: '#856404', borderRadius: 12, padding: '2px 10px', fontSize: 11 }}>⏳ 검토 대기</span>
  )
}

export default function CuratorPostsTab() {
  const supabase = createClient()
  const [rows, setRows] = useState<CuratorPost[]>([])
  const [names, setNames] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [selected, setSelected] = useState<CuratorPost | null>(null)

  const load = async () => {
    setLoading(true)
    setLoadError(false)
    const { data, error } = await supabase
      .from('magazines')
      .select('id, title, category, is_published, author_type, created_by, created_at, slug')
      .eq('author_type', 'curator')
      .order('created_at', { ascending: false })
    if (error) {
      console.error('[CuratorPostsTab] load error', error)
      setLoadError(true)
      setLoading(false)
      return
    }
    const list = (data as CuratorPost[]) || []
    setRows(list)
    setSelected(prev => (prev ? list.find(r => r.id === prev.id) ?? null : null))
    const authorIds = Array.from(new Set(list.map(r => r.created_by).filter((v): v is string => !!v)))
    if (authorIds.length > 0) {
      const { data: profs, error: profErr } = await supabase.from('profiles').select('*').in('auth_id', authorIds)
      if (profErr) console.error('[CuratorPostsTab] profiles error', profErr)
      const map: Record<string, string> = {}
      for (const p of (profs as Record<string, unknown>[]) || []) map[String(p.auth_id)] = nameOf(p)
      setNames(map)
    } else {
      setNames({})
    }
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [])

  const setPublished = async (id: string, publish: boolean) => {
    setBusyId(id)
    const patch = publish ? { is_published: true, published_at: new Date().toISOString() } : { is_published: false }
    const { error } = await supabase.from('magazines').update(patch).eq('id', id)
    setBusyId(null)
    if (error) {
      console.error('[CuratorPostsTab] update error', error)
      return
    }
    void load()
  }

  const authorName = (r: CuratorPost) => (r.created_by ? names[r.created_by] || '-' : '-')

  const actionButton = (r: CuratorPost) =>
    r.is_published ? (
      <button
        type="button"
        disabled={busyId === r.id}
        onClick={e => {
          e.stopPropagation()
          void setPublished(r.id, false)
        }}
        style={cancelBtn}
      >
        {busyId === r.id ? '처리 중…' : '발행취소'}
      </button>
    ) : (
      <button
        type="button"
        disabled={busyId === r.id}
        onClick={e => {
          e.stopPropagation()
          void setPublished(r.id, true)
        }}
        style={publishBtn}
      >
        {busyId === r.id ? '처리 중…' : '발행'}
      </button>
    )

  return (
    <div style={{ background: '#ffffff', color: '#212529', borderRadius: 12, padding: 16, colorScheme: 'light' }}>
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#6c757d' }}>불러오는 중…</div>
      ) : loadError ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#842029' }}>데이터를 불러올 수 없습니다</div>
      ) : rows.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#6c757d' }}>
          ✍️ 아직 큐레이터 기고 글이 없습니다
        </div>
      ) : (
        rows.map(r => (
          <div
            key={r.id}
            role="button"
            tabIndex={0}
            onClick={() => setSelected(r)}
            onKeyDown={e => {
              if (e.key === 'Enter') setSelected(r)
            }}
            style={{
              background: '#f8f9fa',
              border: '1px solid #e9ecef',
              borderRadius: 10,
              padding: 14,
              marginBottom: 10,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ flex: 1, minWidth: 180 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <StatusBadge published={!!r.is_published} />
                <span style={{ fontSize: 11, color: '#6c757d' }}>{r.category || '-'}</span>
              </div>
              <div style={{ fontSize: 14, color: '#212529' }}>{r.title || '(제목 없음)'}</div>
              <div style={{ fontSize: 11, color: '#6c757d', marginTop: 4 }}>
                {authorName(r)} · {fmtDate(r.created_at)}
              </div>
            </div>
            {actionButton(r)}
          </div>
        ))
      )}

      <SlideUpSheet open={!!selected} onClose={() => setSelected(null)} zIndex={9500} height="auto" maxHeight="85dvh">
        <div style={{ background: '#ffffff', minHeight: '100%', padding: 20, color: '#212529', colorScheme: 'light', boxSizing: 'border-box' }}>
          {selected && (
            <div style={{ maxWidth: 560, margin: '0 auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <StatusBadge published={!!selected.is_published} />
                <button
                  type="button"
                  aria-label="닫기"
                  onClick={() => setSelected(null)}
                  style={{ border: 'none', background: 'transparent', color: '#6c757d', fontSize: 22, lineHeight: 1, cursor: 'pointer', padding: 4 }}
                >
                  ×
                </button>
              </div>
              <div style={{ fontSize: 18, color: '#212529', marginBottom: 14, lineHeight: 1.4 }}>{selected.title || '(제목 없음)'}</div>
              {[
                { label: '카테고리', value: selected.category || '-' },
                { label: '작성자', value: authorName(selected) },
                { label: '작성일', value: fmtDate(selected.created_at) },
                ...(selected.slug ? [{ label: 'slug', value: selected.slug }] : []),
              ].map(f => (
                <div key={f.label} style={{ display: 'flex', gap: 12, padding: '8px 0', borderBottom: '1px solid #e9ecef', fontSize: 13 }}>
                  <span style={{ width: 64, flexShrink: 0, color: '#6c757d' }}>{f.label}</span>
                  <span style={{ color: '#212529', wordBreak: 'break-all' }}>{f.value}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>{actionButton(selected)}</div>
            </div>
          )}
        </div>
      </SlideUpSheet>
    </div>
  )
}
