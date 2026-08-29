'use client'

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import DashboardBottomNav from '@/components/DashboardBottomNav'

const BG = '#ffffff'
const PURPLE = '#7B5EA7'
const BORDER = '#ede9f7'
const TEXT = '#1A1A2E'
const SUB = '#888888'
const LIGHT = '#f8f7fc'

type SubTab = 'treatment' | 'material' | 'education'

interface ArchiveItem {
  id: string
  company_id: string
  category: string
  source: string
  title: string
  body_html?: string | null
  asset_url?: string | null
}

interface SessionRow {
  id: string
  title: string
  session_date: string
  start_time: string
  end_time: string
  format: string
  location?: string | null
  link?: string | null
  capacity?: number | null
  applied?: boolean
  asset_url?: string | null
}

const CARD: CSSProperties = {
  background: LIGHT,
  border: `1px solid ${BORDER}`,
  borderRadius: 12,
  padding: 14,
  marginBottom: 10,
}

const TABS: { key: SubTab; label: string }[] = [
  { key: 'treatment', label: '트리트먼트' },
  { key: 'material', label: '제품교육' },
  { key: 'education', label: '에듀케이션' },
]

export default function OwnerProgramsPage() {
  const router = useRouter()
  const [sub, setSub] = useState<SubTab>('treatment')
  const [items, setItems] = useState<ArchiveItem[]>([])
  const [areteCompanyIds, setAreteCompanyIds] = useState<string[]>([])
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [preview, setPreview] = useState<ArchiveItem | null>(null)
  const [applyingId, setApplyingId] = useState<string | null>(null)
  const [toast, setToast] = useState('')

  const showToast = (t: string) => {
    setToast(t)
    setTimeout(() => setToast(''), 2500)
  }

  const loadArchive = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/owner/archive/list')
      const json = await res.json()
      if (!json?.ok) {
        showToast(json?.error || '자료 불러오기 실패')
        setItems([])
        setAreteCompanyIds([])
        return
      }
      setItems(json.items || [])
      setAreteCompanyIds(json.areteCompanyIds || [])
    } catch {
      showToast('자료 불러오기 실패')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadSessions = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/owner/education/sessions')
      const json = await res.json()
      if (json?.ok) setSessions(json.sessions || [])
      else showToast(json?.error || '세션 불러오기 실패')
    } catch {
      showToast('세션 불러오기 실패')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (sub === 'education') {
      void loadSessions()
    } else {
      void loadArchive()
    }
  }, [sub, loadArchive, loadSessions])

  const filtered = useMemo(
    () =>
      items.filter((it) => {
        if (it.category !== sub) return false
        if (it.source === 'arete' && !areteCompanyIds.includes(it.company_id)) return false
        return true
      }),
    [items, sub, areteCompanyIds],
  )

  const onApply = async (sessionId: string) => {
    setApplyingId(sessionId)
    try {
      const res = await fetch('/api/owner/education/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId }),
      })
      const json = await res.json()
      if (!json?.ok) {
        showToast(json?.error || '신청 실패')
        return
      }
      showToast(json.already_applied ? '이미 신청했어요' : '신청 완료')
      await loadSessions()
    } catch {
      showToast('신청 실패')
    } finally {
      setApplyingId(null)
    }
  }

  return (
    <div style={{ background: BG, minHeight: '100vh', paddingBottom: 80 }}>
      {toast && (
        <div
          style={{
            position: 'fixed',
            top: 14,
            left: '50%',
            transform: 'translateX(-50%)',
            background: PURPLE,
            color: '#fff',
            fontSize: 12,
            padding: '7px 18px',
            borderRadius: 20,
            zIndex: 999,
          }}
        >
          {toast}
        </div>
      )}
      <div style={{ padding: '16px 16px 0', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <button
          type="button"
          onClick={() => router.push('/dashboard/owner?v=2')}
          style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: TEXT, padding: 0 }}
        >
          ←
        </button>
        <div style={{ fontSize: 16, fontWeight: 500, color: TEXT }}>자료실·에듀케이션</div>
      </div>

      <div style={{ padding: '0 16px', display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => {
              setSub(t.key)
              setPreview(null)
            }}
            style={{
              fontSize: 12,
              padding: '7px 14px',
              borderRadius: 20,
              border: sub === t.key ? `1px solid ${PURPLE}` : `1px solid ${BORDER}`,
              background: sub === t.key ? PURPLE : '#fff',
              color: sub === t.key ? '#fff' : TEXT,
              cursor: 'pointer',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ padding: '0 16px' }}>
        {loading ? (
          <div style={{ color: SUB, fontSize: 13, padding: 20, textAlign: 'center' }}>불러오는 중…</div>
        ) : sub === 'education' ? (
          sessions.length === 0 ? (
            <div style={{ color: SUB, fontSize: 13 }}>예정된 세션이 없어요.</div>
          ) : (
            sessions.map((s) => (
              <div key={s.id} style={CARD}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500, color: TEXT }}>{s.title}</div>
                    <div style={{ fontSize: 12, color: SUB, marginTop: 4 }}>
                      {s.session_date} {String(s.start_time).slice(0, 5)}–{String(s.end_time).slice(0, 5)} ·{' '}
                      {s.format === 'online' ? '온라인' : '오프라인'}
                    </div>
                    {s.format === 'offline' && s.location && (
                      <div style={{ fontSize: 12, color: SUB, marginTop: 2 }}>{s.location}</div>
                    )}
                  </div>
                  {s.applied ? (
                    <span style={{ fontSize: 11, color: PURPLE, whiteSpace: 'nowrap' }}>신청완료</span>
                  ) : (
                    <button
                      type="button"
                      disabled={applyingId === s.id}
                      onClick={() => void onApply(s.id)}
                      style={{
                        fontSize: 11,
                        padding: '6px 12px',
                        borderRadius: 16,
                        border: 'none',
                        background: PURPLE,
                        color: '#fff',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      신청
                    </button>
                  )}
                </div>
                {s.applied && s.link && (
                  <a
                    href={s.link}
                    target="_blank"
                    rel="noreferrer"
                    style={{ display: 'inline-block', marginTop: 8, fontSize: 12, color: PURPLE }}
                  >
                    참여 링크 열기
                  </a>
                )}
                {s.applied && s.asset_url && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                    <a
                      href={s.asset_url}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        fontSize: 12,
                        padding: '8px 14px',
                        borderRadius: 8,
                        border: `1px solid ${PURPLE}`,
                        color: PURPLE,
                        textDecoration: 'none',
                        background: '#fff',
                      }}
                    >
                      🖨️ 자료 출력하기
                    </a>
                    <a
                      href={s.asset_url}
                      download
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        fontSize: 12,
                        padding: '8px 14px',
                        borderRadius: 8,
                        border: 'none',
                        color: '#fff',
                        textDecoration: 'none',
                        background: PURPLE,
                      }}
                    >
                      ⬇️ 다운로드
                    </a>
                  </div>
                )}
              </div>
            ))
          )
        ) : preview ? (
          <div style={CARD}>
            <button
              type="button"
              onClick={() => setPreview(null)}
              style={{
                background: 'none',
                border: 'none',
                color: PURPLE,
                fontSize: 13,
                cursor: 'pointer',
                padding: 0,
                marginBottom: 12,
              }}
            >
              ← 목록으로
            </button>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start', marginBottom: 12 }}>
              <div style={{ fontSize: 16, fontWeight: 500, color: TEXT }}>{preview.title}</div>
              {preview.source === 'arete' && (
                <span style={{ fontSize: 10, color: '#C9A96E', whiteSpace: 'nowrap' }}>⭐아레테전용</span>
              )}
            </div>
            {preview.body_html ? (
              <div
                style={{ fontSize: 13, color: TEXT, lineHeight: 1.55 }}
                dangerouslySetInnerHTML={{ __html: preview.body_html }}
              />
            ) : (
              <div style={{ fontSize: 12, color: SUB }}>본문이 없어요.</div>
            )}
            {preview.asset_url && (
              <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                <a
                  href={preview.asset_url}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    fontSize: 12,
                    padding: '8px 14px',
                    borderRadius: 8,
                    border: `1px solid ${PURPLE}`,
                    color: PURPLE,
                    textDecoration: 'none',
                    background: '#fff',
                  }}
                >
                  🖨️ 출력하기
                </a>
                <a
                  href={preview.asset_url}
                  download
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    fontSize: 12,
                    padding: '8px 14px',
                    borderRadius: 8,
                    border: 'none',
                    color: '#fff',
                    textDecoration: 'none',
                    background: PURPLE,
                  }}
                >
                  ⬇️ 다운로드
                </a>
              </div>
            )}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ color: SUB, fontSize: 13 }}>등록된 자료가 없어요.</div>
        ) : (
          filtered.map((it) => (
            <button
              key={it.id}
              type="button"
              onClick={() => setPreview(it)}
              style={{
                ...CARD,
                width: '100%',
                textAlign: 'left',
                cursor: 'pointer',
                display: 'block',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: TEXT }}>{it.title}</div>
                {it.source === 'arete' && (
                  <span style={{ fontSize: 10, color: '#C9A96E', whiteSpace: 'nowrap' }}>⭐아레테전용</span>
                )}
              </div>
            </button>
          ))
        )}
      </div>
      <DashboardBottomNav role="owner" />
    </div>
  )
}