'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const CARD = '#12151a'
const BORDER = 'rgba(255,255,255,0.08)'
const PURPLE = '#7B5EA7'
const TEXT = '#e8eaed'
const MUTED = 'rgba(255,255,255,0.45)'

const PHASE_TABS = ['달빛기', '황금기', '만개기', '물들기'] as const

const PHASE_DB: Record<(typeof PHASE_TABS)[number], string> = {
  달빛기: 'menstrual',
  황금기: 'follicular',
  만개기: 'ovulation',
  물들기: 'luteal',
}

function commentKey(phase: (typeof PHASE_TABS)[number]) {
  return `hormone_comment_${phase}`
}

type LearningRow = {
  id: string
  phase?: string | null
  source_type?: string | null
  content?: string | null
  ai_summary?: string | null
  created_at?: string | null
}

export default function HormoneComment() {
  const supabase = createClient()
  const [activePhase, setActivePhase] = useState<(typeof PHASE_TABS)[number]>('달빛기')
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [approvedCount, setApprovedCount] = useState(0)
  const [approvedList, setApprovedList] = useState<LearningRow[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  const loadPhaseData = useCallback(async (phase: (typeof PHASE_TABS)[number]) => {
    setLoading(true)
    const dbPhase = PHASE_DB[phase]
    const key = commentKey(phase)
    try {
      const [settingsRes, countRes, listRes] = await Promise.all([
        supabase.from('admin_settings').select('value').eq('category', 'hormone_comment').eq('key', key).maybeSingle(),
        supabase
          .from('hormone_phase_learnings')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'approved')
          .eq('phase', dbPhase),
        supabase
          .from('hormone_phase_learnings')
          .select('*')
          .eq('status', 'approved')
          .eq('phase', dbPhase)
          .order('created_at', { ascending: false })
          .limit(20),
      ])
      setComment(String(settingsRes.data?.value ?? ''))
      setApprovedCount(countRes.count ?? 0)
      setApprovedList((listRes.data as LearningRow[]) || [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadPhaseData(activePhase)
  }, [activePhase, loadPhaseData])

  const saveComment = async () => {
    if (saving) return
    setSaving(true)
    try {
      const key = commentKey(activePhase)
      const { error } = await supabase.from('admin_settings').upsert(
        {
          category: 'hormone_comment',
          key,
          value: comment,
          label: `${activePhase} 추천 코멘트`,
        },
        { onConflict: 'category,key' }
      )
      if (error) {
        showToast(error.message)
        return
      }
      showToast('저장됐어요')
    } finally {
      setSaving(false)
    }
  }

  const runAiGenerate = async () => {
    if (generating) return
    setGenerating(true)
    try {
      const snippets = approvedList.map((l) => l.content || l.ai_summary || '').filter(Boolean)
      const res = await fetch('/api/analyze-consultation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_type: 'comment_generate',
          phase: PHASE_DB[activePhase],
          phase_label: activePhase,
          learnings: snippets,
          chat_log: snippets.join('\n---\n'),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        showToast(data?.error || 'AI 생성 실패')
        return
      }
      const generated = String(data.ai_summary ?? data.comment ?? '').trim()
      if (generated) setComment(generated)
      showToast('AI 코멘트를 반영했어요')
    } catch {
      showToast('AI 생성 요청 오류')
    } finally {
      setGenerating(false)
    }
  }

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

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        {PHASE_TABS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setActivePhase(p)}
            style={{
              padding: '8px 16px',
              borderRadius: 10,
              border: `1px solid ${activePhase === p ? PURPLE : BORDER}`,
              background: activePhase === p ? 'rgba(123,94,167,0.25)' : CARD,
              color: activePhase === p ? '#e8dff5' : MUTED,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {p}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ color: MUTED, fontSize: 12, padding: 16 }}>불러오는 중...</div>
      ) : (
        <>
          <div style={{ fontSize: 12, color: MUTED, marginBottom: 8 }}>
            승인된 학습 데이터: <strong style={{ color: '#e8dff5' }}>{approvedCount}</strong>건
          </div>

          <div style={{ fontSize: 13, fontWeight: 600, color: TEXT, marginBottom: 8 }}>현재 추천 코멘트</div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={5}
            placeholder={`${activePhase} 고객에게 보여줄 추천 코멘트`}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              marginBottom: 10,
              borderRadius: 8,
              border: `1px solid ${BORDER}`,
              background: 'rgba(255,255,255,0.04)',
              color: TEXT,
              fontSize: 13,
              padding: 12,
              resize: 'vertical',
            }}
          />

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
            <button
              type="button"
              disabled={saving}
              onClick={() => void saveComment()}
              style={{
                padding: '10px 20px',
                borderRadius: 8,
                border: 'none',
                background: '#FEE500',
                color: '#3A1D1D',
                fontSize: 12,
                fontWeight: 600,
                cursor: saving ? 'default' : 'pointer',
                opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? '저장 중…' : '저장'}
            </button>
            <button
              type="button"
              disabled={generating || approvedCount === 0}
              onClick={() => void runAiGenerate()}
              style={{
                padding: '10px 20px',
                borderRadius: 8,
                border: `1px solid ${PURPLE}`,
                background: 'rgba(123,94,167,0.15)',
                color: '#e8dff5',
                fontSize: 12,
                fontWeight: 600,
                cursor: generating || approvedCount === 0 ? 'default' : 'pointer',
                opacity: generating || approvedCount === 0 ? 0.5 : 1,
              }}
            >
              {generating ? '생성 중…' : '🤖 AI 자동생성'}
            </button>
          </div>

          <div style={{ fontSize: 13, fontWeight: 600, color: TEXT, marginBottom: 10 }}>승인된 학습 데이터 목록</div>
          {approvedList.length === 0 ? (
            <div style={{ fontSize: 12, color: MUTED }}>이 페이즈에 승인된 학습 데이터가 없어요.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {approvedList.map((l) => (
                <div
                  key={l.id}
                  style={{
                    borderRadius: 8,
                    border: `1px solid ${BORDER}`,
                    padding: 12,
                    fontSize: 12,
                    color: MUTED,
                    background: CARD,
                  }}
                >
                  <span style={{ color: '#e8dff5', marginRight: 8 }}>{l.source_type || '—'}</span>
                  {l.created_at ? new Date(l.created_at).toLocaleDateString('ko-KR') : ''}
                  <div style={{ marginTop: 6, color: TEXT, lineHeight: 1.45 }}>
                    {(l.content || l.ai_summary || '').slice(0, 160)}
                    {(l.content || l.ai_summary || '').length > 160 ? '…' : ''}
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
