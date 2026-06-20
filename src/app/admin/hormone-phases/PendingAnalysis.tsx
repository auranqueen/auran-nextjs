'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const CARD = '#12151a'
const BORDER = 'rgba(255,255,255,0.08)'
const PURPLE = '#7B5EA7'
const TEXT = '#e8eaed'
const MUTED = 'rgba(255,255,255,0.45)'

type SessionRow = {
  id: string
  status?: string | null
  source_type?: string | null
  phase?: string | null
  chat_log?: string | null
  ai_summary?: string | null
  analyzed_keywords?: string[] | string | null
  created_at?: string | null
}

type LearningRow = {
  id: string
  status?: string | null
  phase?: string | null
  source_type?: string | null
  content?: string | null
  ai_extracted_keywords?: string[] | string | null
  ai_summary?: string | null
  consultation_session_id?: string | null
  created_at?: string | null
}

function sourceLabel(st: string | null | undefined) {
  if (st === 'auran_chat') return '오렌상담톡'
  if (st === 'external') return '외부상담'
  return st || '—'
}

function phaseLabel(p: string | null | undefined) {
  if (!p) return '—'
  const map: Record<string, string> = {
    menstrual: '달빛기',
    follicular: '황금기',
    ovulation: '만개기',
    luteal: '물들기',
  }
  return map[p] || p
}

function parseKeywords(raw: string[] | string | null | undefined): string[] {
  if (Array.isArray(raw)) return raw
  if (!raw) return []
  try {
    const p = JSON.parse(String(raw))
    return Array.isArray(p) ? p.map(String) : []
  } catch {
    return String(raw)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  }
}

export default function PendingAnalysis({
  onPendingCountChange,
}: {
  onPendingCountChange?: (n: number) => void
}) {
  const supabase = createClient()
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [learnings, setLearnings] = useState<LearningRow[]>([])
  const [approvedLearnings, setApprovedLearnings] = useState<LearningRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [toast, setToast] = useState('')

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  const refreshPendingCount = useCallback(async () => {
    const { count } = await supabase
      .from('hormone_phase_learnings')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending')
    onPendingCountChange?.(count ?? 0)
  }, [onPendingCountChange])

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [sessRes, learnRes, approvedRes] = await Promise.all([
        supabase
          .from('consultation_sessions')
          .select('*')
          .eq('status', 'pending')
          .order('created_at', { ascending: false }),
        supabase
          .from('hormone_phase_learnings')
          .select('*')
          .eq('status', 'pending')
          .order('created_at', { ascending: false }),
        supabase
          .from('hormone_phase_learnings')
          .select('*')
          .eq('status', 'approved')
          .order('created_at', { ascending: false })
          .limit(50),
      ])
      setSessions((sessRes.data as SessionRow[]) || [])
      setLearnings((learnRes.data as LearningRow[]) || [])
      setApprovedLearnings((approvedRes.data as LearningRow[]) || [])
      await refreshPendingCount()
    } finally {
      setLoading(false)
    }
  }, [refreshPendingCount])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  const runAnalyze = async (session: SessionRow) => {
    if (busyId) return
    setBusyId(session.id)
    try {
      const res = await fetch('/api/analyze-consultation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: session.id,
          chat_log: session.chat_log,
          phase: session.phase,
          source_type: session.source_type,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        showToast(data?.error || 'AI 분석 실패')
        return
      }
      const aiSummary = String(data.ai_summary ?? '')
      const keywords = parseKeywords(data.analyzed_keywords)

      await supabase
        .from('consultation_sessions')
        .update({
          ai_summary: aiSummary,
          analyzed_keywords: keywords,
        } as Record<string, unknown>)
        .eq('id', session.id)

      await supabase.from('hormone_phase_learnings').insert({
        consultation_session_id: session.id,
        phase: session.phase,
        source_type: session.source_type,
        content: session.chat_log,
        ai_summary: aiSummary,
        ai_extracted_keywords: keywords,
        status: 'pending',
      } as Record<string, unknown>)

      showToast('AI 분석 완료')
      await loadAll()
    } catch {
      showToast('AI 분석 요청 오류')
    } finally {
      setBusyId(null)
    }
  }

  const setLearningStatus = async (id: string, status: 'approved' | 'rejected') => {
    if (busyId) return
    setBusyId(id)
    try {
      const { error } = await supabase.from('hormone_phase_learnings').update({ status }).eq('id', id)
      if (error) {
        showToast(error.message)
        return
      }
      showToast(status === 'approved' ? '수락됐어요' : '거절됐어요')
      await loadAll()
    } finally {
      setBusyId(null)
    }
  }

  const analyzedSessions = sessions.filter((s) => s.ai_summary)
  const pendingAnalyzeSessions = sessions.filter((s) => !s.ai_summary)

  return (
    <div style={{ position: 'relative' }}>
      {toast ? (
        <div
          style={{
            position: 'fixed',
            top: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            background: PURPLE,
            color: '#fff',
            padding: '10px 18px',
            borderRadius: 20,
            fontSize: 13,
            zIndex: 9999,
          }}
        >
          {toast}
        </div>
      ) : null}

      {loading ? (
        <div style={{ textAlign: 'center', color: MUTED, padding: 32, fontSize: 13 }}>불러오는 중...</div>
      ) : (
        <>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: TEXT }}>분석 대기 세션</div>
          {pendingAnalyzeSessions.length === 0 ? (
            <div style={{ color: MUTED, fontSize: 12, marginBottom: 24 }}>분석 대기 중인 세션이 없어요.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
              {pendingAnalyzeSessions.map((s) => (
                <div
                  key={s.id}
                  style={{
                    borderRadius: 10,
                    border: `1px solid ${BORDER}`,
                    background: CARD,
                    padding: 14,
                  }}
                >
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                    <span
                      style={{
                        fontSize: 10,
                        padding: '3px 8px',
                        borderRadius: 6,
                        background: 'rgba(123,94,167,0.2)',
                        color: '#e8dff5',
                      }}
                    >
                      {sourceLabel(s.source_type)}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        padding: '3px 8px',
                        borderRadius: 6,
                        background: 'rgba(201,169,110,0.15)',
                        color: '#f5e6c8',
                      }}
                    >
                      {phaseLabel(s.phase)}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: MUTED, marginBottom: 6 }}>
                    {s.created_at ? new Date(s.created_at).toLocaleString('ko-KR') : ''}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: TEXT,
                      lineHeight: 1.5,
                      marginBottom: 10,
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {(s.chat_log || '').slice(0, 100)}
                    {(s.chat_log || '').length > 100 ? '…' : ''}
                  </div>
                  <button
                    type="button"
                    disabled={busyId === s.id}
                    onClick={() => void runAnalyze(s)}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 8,
                      border: 'none',
                      background: PURPLE,
                      color: '#fff',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: busyId === s.id ? 'default' : 'pointer',
                      opacity: busyId === s.id ? 0.6 : 1,
                    }}
                  >
                    {busyId === s.id ? '분석 중…' : 'Claude AI 분석'}
                  </button>
                </div>
              ))}
            </div>
          )}

          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: TEXT }}>분석 완료 · 승인 대기</div>
          {learnings.length === 0 && analyzedSessions.length === 0 ? (
            <div style={{ color: MUTED, fontSize: 12, marginBottom: 24 }}>승인 대기 학습 데이터가 없어요.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
              {learnings.map((l) => {
                const kw = parseKeywords(l.ai_extracted_keywords)
                return (
                  <div
                    key={l.id}
                    style={{
                      borderRadius: 10,
                      border: `1px solid ${BORDER}`,
                      background: CARD,
                      padding: 14,
                    }}
                  >
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                      <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 6, background: 'rgba(123,94,167,0.2)', color: '#e8dff5' }}>
                        {sourceLabel(l.source_type)}
                      </span>
                      <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 6, background: 'rgba(201,169,110,0.15)', color: '#f5e6c8' }}>
                        {phaseLabel(l.phase)}
                      </span>
                    </div>
                    {l.ai_summary ? (
                      <div style={{ fontSize: 12, color: TEXT, lineHeight: 1.55, marginBottom: 8 }}>{l.ai_summary}</div>
                    ) : null}
                    {kw.length > 0 ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                        {kw.map((k) => (
                          <span
                            key={k}
                            style={{
                              fontSize: 10,
                              padding: '4px 10px',
                              borderRadius: 999,
                              border: '1px solid rgba(123,94,167,0.35)',
                              color: '#e8dff5',
                            }}
                          >
                            {k}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        disabled={!!busyId}
                        onClick={() => void setLearningStatus(l.id, 'approved')}
                        style={{
                          padding: '7px 14px',
                          borderRadius: 8,
                          border: 'none',
                          background: '#4ade80',
                          color: '#0d1f12',
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        수락
                      </button>
                      <button
                        type="button"
                        disabled={!!busyId}
                        onClick={() => void setLearningStatus(l.id, 'rejected')}
                        style={{
                          padding: '7px 14px',
                          borderRadius: 8,
                          border: '1px solid rgba(255,255,255,0.2)',
                          background: 'transparent',
                          color: MUTED,
                          fontSize: 12,
                          cursor: 'pointer',
                        }}
                      >
                        거절
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: TEXT }}>승인된 학습 데이터</div>
          {approvedLearnings.length === 0 ? (
            <div style={{ color: MUTED, fontSize: 12 }}>아직 승인된 데이터가 없어요.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {approvedLearnings.map((l) => (
                <div
                  key={l.id}
                  style={{
                    borderRadius: 8,
                    border: `1px solid ${BORDER}`,
                    padding: 12,
                    fontSize: 12,
                    color: MUTED,
                  }}
                >
                  <span style={{ color: '#e8dff5', marginRight: 8 }}>{phaseLabel(l.phase)}</span>
                  <span style={{ marginRight: 8 }}>{sourceLabel(l.source_type)}</span>
                  {l.created_at ? new Date(l.created_at).toLocaleDateString('ko-KR') : ''}
                  <div style={{ marginTop: 6, color: TEXT, lineHeight: 1.45 }}>
                    {(l.content || '').slice(0, 120)}
                    {(l.content || '').length > 120 ? '…' : ''}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
