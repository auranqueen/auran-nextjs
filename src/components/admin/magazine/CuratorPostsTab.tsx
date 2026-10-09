'use client'

import { useEffect, useState } from 'react'
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
  author_name?: string | null
  hidden_reason: string | null
  hidden_at: string | null
}

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

const hideBtn = {
  border: '1px solid #dc3545',
  background: '#ffffff',
  color: '#dc3545',
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
  const [rows, setRows] = useState<CuratorPost[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [selected, setSelected] = useState<CuratorPost | null>(null)
  const [hideFormId, setHideFormId] = useState<string | null>(null)
  const [hideReason, setHideReason] = useState('')
  const [hideError, setHideError] = useState('')

  // [ANCHOR: fetch-posts]
  const load = async () => {
    setLoading(true)
    setLoadError(false)
    const res = await fetch('/api/admin/magazine', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'loadCurator' }),
    }).catch(() => null)
    const json = (await res?.json().catch(() => null)) as unknown as { items?: CuratorPost[]; error?: string } | null
    if (!res?.ok || !json?.items) {
      console.error('[CuratorPostsTab] load error', json?.error ?? res?.status ?? 'network')
      setLoadError(true)
      setLoading(false)
      return
    }
    const list = json.items
    setRows(list)
    setSelected(prev => (prev ? list.find(r => r.id === prev.id) ?? null : null))
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [])

  const setPublished = async (id: string, publish: boolean) => {
    setBusyId(id)
    const body = publish
      ? { action: 'togglePublish', id, is_published: true, published_at: new Date().toISOString() }
      : { action: 'togglePublish', id, is_published: false }
    const res = await fetch('/api/admin/magazine', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => null)
    const json = (await res?.json().catch(() => null)) as unknown as { ok?: boolean; error?: string } | null
    setBusyId(null)
    if (!res?.ok || !json?.ok) {
      console.error('[CuratorPostsTab] update error', json?.error ?? res?.status ?? 'network')
      return
    }
    void load()
  }

  const openHideForm = (id: string) => {
    setHideFormId(id)
    setHideReason('')
    setHideError('')
  }

  // [ANCHOR: hide-post-submit]
  const hidePost = async (id: string) => {
    const reason = hideReason.trim()
    if (!reason) {
      setHideError('숨김 사유를 입력해 주세요.')
      return
    }
    setBusyId(id)
    setHideError('')
    const res = await fetch('/api/admin/magazine', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'hidePost', id, reason }),
    }).catch(() => null)
    const json = (await res?.json().catch(() => null)) as unknown as { ok?: boolean; error?: string } | null
    setBusyId(null)
    if (!res?.ok || !json?.ok) {
      console.error('[CuratorPostsTab] hide error', json?.error ?? res?.status ?? 'network')
      setHideError('숨김 처리하지 못했어요. 잠시 후 다시 시도해 주세요.')
      return
    }
    setHideFormId(null)
    setHideReason('')
    void load()
  }

  const authorName = (r: CuratorPost) => r.author_name || '-'

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
                {r.hidden_reason && !r.is_published ? (
                  <span style={{ background: '#f8d7da', color: '#842029', borderRadius: 12, padding: '2px 10px', fontSize: 11 }}>🚫 숨김</span>
                ) : (
                  <StatusBadge published={!!r.is_published} />
                )}
                <span style={{ fontSize: 11, color: '#6c757d' }}>{r.category || '-'}</span>
              </div>
              {r.hidden_reason && !r.is_published && (
                <div style={{ fontSize: 12, color: '#6c757d', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  사유: {r.hidden_reason}
                </div>
              )}
              <div style={{ fontSize: 14, color: '#212529' }}>{r.title || '(제목 없음)'}</div>
              <div style={{ fontSize: 11, color: '#6c757d', marginTop: 4 }}>
                {authorName(r)} · {fmtDate(r.created_at)}
              </div>
            </div>
            {actionButton(r)}
            {r.is_published && hideFormId !== r.id && (
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation()
                  openHideForm(r.id)
                }}
                style={hideBtn}
              >
                노출 숨김
              </button>
            )}
            {hideFormId === r.id && (
              <div
                onClick={e => e.stopPropagation()}
                onKeyDown={e => e.stopPropagation()}
                style={{ flexBasis: '100%', background: '#ffffff', border: '1px solid #f1aeb5', borderRadius: 8, padding: 10, cursor: 'default' }}
              >
                <textarea
                  value={hideReason}
                  onChange={e => setHideReason(e.target.value)}
                  placeholder="숨김 사유를 입력하세요 (큐레이터에게 전달됩니다)"
                  rows={3}
                  maxLength={1000}
                  style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #dee2e6', borderRadius: 6, padding: 8, fontSize: 13, color: '#212529', background: '#ffffff', resize: 'vertical' }}
                />
                {hideError && <div style={{ fontSize: 12, color: '#842029', marginTop: 6 }}>{hideError}</div>}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                  <button
                    type="button"
                    onClick={() => setHideFormId(null)}
                    style={{ border: '1px solid #dee2e6', background: '#ffffff', color: '#495057', borderRadius: 7, padding: '5px 14px', fontSize: 12, cursor: 'pointer' }}
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    disabled={busyId === r.id}
                    onClick={() => void hidePost(r.id)}
                    style={{ border: 'none', background: '#dc3545', color: '#fff', borderRadius: 7, padding: '5px 14px', fontSize: 12, cursor: 'pointer' }}
                  >
                    {busyId === r.id ? '처리 중…' : '확인'}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))
      )}

      <SlideUpSheet open={!!selected} onClose={() => setSelected(null)} zIndex={9500} height="auto" maxHeight="85dvh">
        <div style={{ background: '#ffffff', minHeight: '100%', padding: 20, color: '#212529', colorScheme: 'light', boxSizing: 'border-box' }}>
          {selected && (
            <div style={{ maxWidth: 560, margin: '0 auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                {selected.hidden_reason && !selected.is_published ? (
                  <span style={{ background: '#f8d7da', color: '#842029', borderRadius: 12, padding: '2px 10px', fontSize: 11 }}>🚫 숨김</span>
                ) : (
                  <StatusBadge published={!!selected.is_published} />
                )}
                <button
                  type="button"
                  aria-label="닫기"
                  onClick={() => setSelected(null)}
                  style={{ border: 'none', background: 'transparent', color: '#6c757d', fontSize: 22, lineHeight: 1, cursor: 'pointer', padding: 4 }}
                >
                  ×
                </button>
              </div>
              {selected.hidden_reason && !selected.is_published && (
                <div style={{ fontSize: 12, color: '#6c757d', marginTop: -8, marginBottom: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  사유: {selected.hidden_reason}
                </div>
              )}
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
