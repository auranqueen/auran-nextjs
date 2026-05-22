'use client'

import { useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const CARD = '#12151a'
const BORDER = 'rgba(255,255,255,0.08)'
const PURPLE = '#7B5EA7'
const TEXT = '#e8eaed'
const MUTED = 'rgba(255,255,255,0.45)'

const PHASE_OPTIONS = ['달빛기', '황금기', '만개기', '물들기', '모름'] as const

const PHASE_DB: Record<string, string | null> = {
  달빛기: 'menstrual',
  황금기: 'follicular',
  만개기: 'ovulation',
  물들기: 'luteal',
  모름: null,
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

export default function ExternalConsult() {
  const supabase = createClient()
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [selectedPhase, setSelectedPhase] = useState<(typeof PHASE_OPTIONS)[number]>('달빛기')
  const [inputText, setInputText] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [aiSummary, setAiSummary] = useState('')
  const [analyzedKeywords, setAnalyzedKeywords] = useState<string[]>([])
  const [ocrModalOpen, setOcrModalOpen] = useState(false)
  const [ocrPreview, setOcrPreview] = useState('')
  const [toast, setToast] = useState('')

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  const resetForm = () => {
    setInputText('')
    setAiSummary('')
    setAnalyzedKeywords([])
    setOcrPreview('')
    setOcrModalOpen(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  const runAnalyze = async () => {
    if (!inputText.trim() || analyzing) return
    setAnalyzing(true)
    try {
      const res = await fetch('/api/analyze-consultation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_type: 'external',
          phase: PHASE_DB[selectedPhase],
          phase_label: selectedPhase,
          text: inputText.trim(),
          chat_log: inputText.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        showToast(data?.error || 'AI 분석 실패')
        return
      }
      setAiSummary(String(data.ai_summary ?? ''))
      setAnalyzedKeywords(parseKeywords(data.analyzed_keywords))
      showToast('AI 분석 완료')
    } catch {
      showToast('AI 분석 요청 오류')
    } finally {
      setAnalyzing(false)
    }
  }

  const acceptLearning = async () => {
    if (saving || analyzedKeywords.length === 0 && !aiSummary) return
    setSaving(true)
    try {
      const { error } = await supabase.from('hormone_phase_learnings').insert({
        phase: PHASE_DB[selectedPhase],
        source_type: 'external',
        content: inputText.trim(),
        ai_extracted_keywords: analyzedKeywords,
        ai_summary: aiSummary,
        status: 'approved',
      } as Record<string, unknown>)
      if (error) {
        showToast(error.message)
        return
      }
      showToast('학습 데이터에 수락·저장됐어요')
      resetForm()
    } finally {
      setSaving(false)
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

      <div style={{ fontSize: 13, color: MUTED, marginBottom: 12 }}>페이즈 선택</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        {PHASE_OPTIONS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setSelectedPhase(p)}
            style={{
              padding: '8px 14px',
              borderRadius: 999,
              border: `1px solid ${selectedPhase === p ? PURPLE : BORDER}`,
              background: selectedPhase === p ? 'rgba(123,94,167,0.2)' : 'transparent',
              color: selectedPhase === p ? '#e8dff5' : MUTED,
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            {p}
          </button>
        ))}
      </div>

      <div
        style={{
          borderRadius: 10,
          border: `1px dashed ${BORDER}`,
          padding: 20,
          textAlign: 'center',
          marginBottom: 12,
          background: CARD,
        }}
      >
        <div style={{ fontSize: 12, color: MUTED, marginBottom: 10 }}>이미지 업로드 (OCR 시뮬레이션)</div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          style={{ fontSize: 12, color: TEXT }}
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (!f) return
            const simulated = `[OCR 시뮬] ${f.name} — 상담 메모 텍스트가 추출되었다고 가정합니다.`
            setOcrPreview(simulated)
            setOcrModalOpen(true)
          }}
        />
      </div>

      <textarea
        value={inputText}
        onChange={(e) => setInputText(e.target.value)}
        placeholder="외부 상담 내용을 직접 입력하세요"
        rows={6}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          marginBottom: 12,
          borderRadius: 8,
          border: `1px solid ${BORDER}`,
          background: 'rgba(255,255,255,0.04)',
          color: TEXT,
          fontSize: 13,
          padding: '12px',
          resize: 'vertical',
        }}
      />

      <button
        type="button"
        disabled={analyzing || !inputText.trim()}
        onClick={() => void runAnalyze()}
        style={{
          width: '100%',
          padding: '12px 0',
          borderRadius: 10,
          border: 'none',
          background: PURPLE,
          color: '#fff',
          fontSize: 13,
          fontWeight: 600,
          marginBottom: 16,
          cursor: analyzing || !inputText.trim() ? 'default' : 'pointer',
          opacity: analyzing || !inputText.trim() ? 0.5 : 1,
        }}
      >
        {analyzing ? 'AI 분석 중…' : 'AI 분석 시작'}
      </button>

      {aiSummary || analyzedKeywords.length > 0 ? (
        <div
          style={{
            borderRadius: 10,
            border: `1px solid ${BORDER}`,
            padding: 14,
            marginBottom: 16,
            background: CARD,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, color: TEXT, marginBottom: 8 }}>분석 결과</div>
          {aiSummary ? (
            <div style={{ fontSize: 12, color: TEXT, lineHeight: 1.55, marginBottom: 10 }}>{aiSummary}</div>
          ) : null}
          {analyzedKeywords.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
              {analyzedKeywords.map((k) => (
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
              disabled={saving}
              onClick={() => void acceptLearning()}
              style={{
                flex: 1,
                padding: '10px 0',
                borderRadius: 8,
                border: 'none',
                background: '#FEE500',
                color: '#3A1D1D',
                fontSize: 12,
                fontWeight: 600,
                cursor: saving ? 'default' : 'pointer',
              }}
            >
              수락
            </button>
            <button
              type="button"
              onClick={resetForm}
              style={{
                flex: 1,
                padding: '10px 0',
                borderRadius: 8,
                border: `1px solid ${BORDER}`,
                background: 'transparent',
                color: MUTED,
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              보류
            </button>
          </div>
        </div>
      ) : null}

      {ocrModalOpen ? (
        <>
          <div
            onClick={() => setOcrModalOpen(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 55 }}
          />
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 56,
              width: 'min(420px, 92vw)',
              background: '#16162a',
              borderRadius: 12,
              padding: 16,
              border: `1px solid ${BORDER}`,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
              <button
                type="button"
                onClick={() => setOcrModalOpen(false)}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,0.1)',
                  border: 'none',
                  color: 'rgba(255,255,255,0.6)',
                  fontSize: 14,
                  cursor: 'pointer',
                }}
              >
                ✕
              </button>
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: TEXT, marginBottom: 8 }}>OCR 시뮬레이션</div>
            <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.5, marginBottom: 12 }}>{ocrPreview}</div>
            <button
              type="button"
              onClick={() => {
                setInputText((prev) => (prev ? `${prev}\n\n${ocrPreview}` : ocrPreview))
                setOcrModalOpen(false)
              }}
              style={{
                width: '100%',
                padding: '10px 0',
                borderRadius: 8,
                border: 'none',
                background: PURPLE,
                color: '#fff',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              텍스트에 반영
            </button>
          </div>
        </>
      ) : null}
    </div>
  )
}
