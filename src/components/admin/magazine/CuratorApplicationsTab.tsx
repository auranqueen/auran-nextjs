'use client'

import { useEffect, useState } from 'react'
import SlideUpSheet from '@/components/ui/SlideUpSheet'

type Application = {
  id: string
  user_id: string
  display_name: string
  email: string
  instagram: string | null
  channel_url: string | null
  categories: string[] | null
  intro: string
  portfolio_url: string | null
  bank_holder: string
  bank_name: string
  bank_account: string
  status: 'pending' | 'approved' | 'rejected'
  admin_note: string | null
  created_at: string
  updated_at: string | null
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

const th = { textAlign: 'left', padding: '8px 10px', fontSize: 11, color: '#6c757d', borderBottom: '1px solid #dee2e6', whiteSpace: 'nowrap' } as const
const td = { padding: '10px', fontSize: 13, color: '#212529', borderBottom: '1px solid #e9ecef', verticalAlign: 'middle' } as const

function StatusBadge({ status }: { status: Application['status'] }) {
  if (status === 'approved') return <span style={{ background: '#d1e7dd', color: '#0a3622', borderRadius: 12, padding: '2px 10px', fontSize: 11, whiteSpace: 'nowrap' }}>✅ 승인</span>
  if (status === 'rejected') return <span style={{ background: '#f8d7da', color: '#842029', borderRadius: 12, padding: '2px 10px', fontSize: 11, whiteSpace: 'nowrap' }}>🚫 거절</span>
  return <span style={{ background: '#fff3cd', color: '#856404', borderRadius: 12, padding: '2px 10px', fontSize: 11, whiteSpace: 'nowrap' }}>⏳ 대기</span>
}

const link = (href: string | null, label?: string) =>
  href && /^https?:\/\//i.test(href) ? (
    <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: '#0d6efd', wordBreak: 'break-all' }}>
      {label || href}
    </a>
  ) : (
    label || href || '-'
  )

export default function CuratorApplicationsTab() {
  const [rows, setRows] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [selected, setSelected] = useState<Application | null>(null)
  const [busy, setBusy] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [note, setNote] = useState('')
  const [actionError, setActionError] = useState('')

  // [ANCHOR: fetch-applications]
  const load = async () => {
    setLoading(true)
    setLoadError(false)
    const res = await fetch('/api/admin/curator-applications').catch(() => null)
    const json = (await res?.json().catch(() => null)) as unknown as { items?: Application[]; error?: string } | null
    if (!res?.ok || !json?.items) {
      console.error('[CuratorApplicationsTab] load error', json?.error ?? res?.status ?? 'network')
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

  const openDetail = (r: Application) => {
    setSelected(r)
    setRejectOpen(false)
    setNote('')
    setActionError('')
  }

  // [ANCHOR: review-application]
  const review = async (action: 'approve' | 'reject') => {
    if (!selected || busy) return
    setBusy(true)
    setActionError('')
    const res = await fetch('/api/admin/curator-applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(action === 'approve' ? { id: selected.id, action } : { id: selected.id, action, note: note.trim() }),
    }).catch(() => null)
    const json = (await res?.json().catch(() => null)) as unknown as { ok?: boolean; error?: string } | null
    setBusy(false)
    if (!res?.ok || !json?.ok) {
      console.error('[CuratorApplicationsTab] review error', json?.error ?? res?.status ?? 'network')
      setActionError(json?.error === 'not_pending' ? '이미 처리된 신청입니다.' : '처리하지 못했어요. 잠시 후 다시 시도해 주세요.')
      return
    }
    setRejectOpen(false)
    setNote('')
    void load()
  }

  return (
    <div style={{ background: '#ffffff', color: '#212529', borderRadius: 12, padding: 16, colorScheme: 'light' }}>
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#6c757d' }}>불러오는 중…</div>
      ) : loadError ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#842029' }}>데이터를 불러올 수 없습니다</div>
      ) : rows.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#6c757d' }}>🙋 아직 큐레이터 신청이 없습니다</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
            <thead>
              <tr>
                <th style={th}>신청일</th>
                <th style={th}>활동명</th>
                <th style={th}>이메일</th>
                <th style={th}>분야</th>
                <th style={th}>상태</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr
                  key={r.id}
                  tabIndex={0}
                  onClick={() => openDetail(r)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') openDetail(r)
                  }}
                  style={{ cursor: 'pointer', background: selected?.id === r.id ? '#f8f9fa' : '#ffffff' }}
                >
                  <td style={{ ...td, fontSize: 12, color: '#6c757d', whiteSpace: 'nowrap' }}>{fmtDate(r.created_at)}</td>
                  <td style={td}>{r.display_name}</td>
                  <td style={{ ...td, wordBreak: 'break-all' }}>{r.email}</td>
                  <td style={{ ...td, fontSize: 12 }}>{(r.categories || []).join(', ') || '-'}</td>
                  <td style={td}>
                    <StatusBadge status={r.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <SlideUpSheet open={!!selected} onClose={() => setSelected(null)} zIndex={9500} height="auto" maxHeight="85dvh">
        <div style={{ background: '#ffffff', minHeight: '100%', padding: 20, color: '#212529', colorScheme: 'light', boxSizing: 'border-box' }}>
          {selected && (
            <div style={{ maxWidth: 560, margin: '0 auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <StatusBadge status={selected.status} />
                <button
                  type="button"
                  aria-label="닫기"
                  onClick={() => setSelected(null)}
                  style={{ border: 'none', background: 'transparent', color: '#6c757d', fontSize: 22, lineHeight: 1, cursor: 'pointer', padding: 4 }}
                >
                  ×
                </button>
              </div>
              <div style={{ fontSize: 18, color: '#212529', marginBottom: 14, lineHeight: 1.4 }}>{selected.display_name}</div>
              {[
                { label: '신청일', value: fmtDate(selected.created_at) },
                { label: '이메일', value: selected.email },
                { label: '분야', value: (selected.categories || []).join(', ') || '-' },
                {
                  label: '인스타',
                  value: selected.instagram ? link(`https://instagram.com/${selected.instagram}`, `@${selected.instagram}`) : '-',
                },
                { label: '채널 URL', value: link(selected.channel_url) },
                { label: '포트폴리오', value: link(selected.portfolio_url) },
                { label: '계좌정보', value: `${selected.bank_name} ${selected.bank_account} (예금주 ${selected.bank_holder})` },
                ...(selected.admin_note ? [{ label: '메모', value: selected.admin_note }] : []),
              ].map(f => (
                <div key={f.label} style={{ display: 'flex', gap: 12, padding: '8px 0', borderBottom: '1px solid #e9ecef', fontSize: 13 }}>
                  <span style={{ width: 72, flexShrink: 0, color: '#6c757d' }}>{f.label}</span>
                  <span style={{ color: '#212529', wordBreak: 'break-all' }}>{f.value}</span>
                </div>
              ))}
              <div style={{ fontSize: 12, color: '#6c757d', marginTop: 14, marginBottom: 6 }}>자기소개</div>
              <div style={{ fontSize: 13, color: '#212529', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: '#f8f9fa', border: '1px solid #e9ecef', borderRadius: 8, padding: 12 }}>
                {selected.intro}
              </div>

              {selected.status === 'pending' && (
                <div style={{ marginTop: 18 }}>
                  {rejectOpen ? (
                    <div style={{ background: '#ffffff', border: '1px solid #f1aeb5', borderRadius: 8, padding: 10 }}>
                      <textarea
                        value={note}
                        onChange={e => setNote(e.target.value)}
                        placeholder="거절 사유를 입력하세요 (신청자에게 전달됩니다)"
                        rows={3}
                        maxLength={1000}
                        style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #dee2e6', borderRadius: 6, padding: 8, fontSize: 13, color: '#212529', background: '#ffffff', resize: 'vertical' }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                        <button
                          type="button"
                          onClick={() => setRejectOpen(false)}
                          style={{ border: '1px solid #dee2e6', background: '#ffffff', color: '#495057', borderRadius: 7, padding: '5px 14px', fontSize: 12, cursor: 'pointer' }}
                        >
                          취소
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void review('reject')}
                          style={{ border: 'none', background: '#dc3545', color: '#fff', borderRadius: 7, padding: '5px 14px', fontSize: 12, cursor: 'pointer' }}
                        >
                          {busy ? '처리 중…' : '거절 확인'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                      <button type="button" disabled={busy} onClick={() => setRejectOpen(true)} style={cancelBtn}>
                        거절
                      </button>
                      <button type="button" disabled={busy} onClick={() => void review('approve')} style={publishBtn}>
                        {busy ? '처리 중…' : '승인'}
                      </button>
                    </div>
                  )}
                  {actionError && <div style={{ fontSize: 12, color: '#842029', marginTop: 8, textAlign: 'right' }}>{actionError}</div>}
                </div>
              )}
            </div>
          )}
        </div>
      </SlideUpSheet>
    </div>
  )
}
