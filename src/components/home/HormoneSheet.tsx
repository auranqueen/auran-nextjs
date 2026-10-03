'use client'

import type { SupabaseClient } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'

const THEME_BORDER = 'rgba(123, 94, 167, 0.35)'
const THEME_BG = 'rgba(123, 94, 167, 0.12)'

type HormoneSheetProps = {
  isOpen: boolean
  onClose: () => void
  currentPhase: string
  cycleDay: number
  hormoneCycle?: any
  showEditChrome: boolean
  supabaseClient: SupabaseClient
  onRefreshCycle?: () => void
}

export default function HormoneSheet({
  isOpen,
  onClose,
  hormoneCycle,
  supabaseClient,
  onRefreshCycle,
}: HormoneSheetProps) {
  const [pendingStart, setPendingStart] = useState<{ d: string; t: string } | null>(null)
  const [pendingEnd, setPendingEnd] = useState<{ d: string; t: string } | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [dateModalOpen, setDateModalOpen] = useState(false)
  const [dateModalType, setDateModalType] = useState<'start' | 'end'>('start')
  const [dateModalVal, setDateModalVal] = useState('')
  const [timeModalVal, setTimeModalVal] = useState('')
  const [saving, setSaving] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const handleClose = () => {
    if (isClosing) return
    setIsClosing(true)
    setTimeout(() => { setIsClosing(false); onClose() }, 260)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  function fmtDate(ds: string) {
    const d = new Date(ds)
    return `${d.getMonth() + 1}월 ${d.getDate()}일`
  }

  function openDateModal(type: 'start' | 'end') {
    setDateModalType(type)
    const now = new Date()
    setDateModalVal(now.toISOString().split('T')[0])
    setTimeModalVal(now.toTimeString().slice(0, 5))
    setDateModalOpen(true)
  }

  function onDateChange(d: string, t: string) {
    setDateModalVal(d)
    setTimeModalVal(t)
    if (dateModalType === 'start') setPendingStart({ d, t })
    else setPendingEnd({ d, t })
  }

  function closeDateModal() {
    setDateModalOpen(false)
  }

  async function saveDates() {
    if (!pendingStart && !pendingEnd) {
      setErrorMsg('날짜를 먼저 선택해 주세요')
      return
    }
    setSaving(true)
    setErrorMsg('')
    try {
      if (pendingStart) {
        const res = await fetch('/api/hormone/period-start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date: pendingStart.d }),
        })
        const json = await res.json()
        if (!json.ok) throw new Error(json.error)
        setPendingStart(null)
      }
      if (pendingEnd) {
        const uid = (await supabaseClient.auth.getUser()).data.user?.id ?? ''
        const { error } = await supabaseClient
          .from('hormone_cycle')
          .update({ period_end_date: `${pendingEnd.d}T${pendingEnd.t}:00` })
          .eq('auth_id', uid)
        if (error) throw error
        setPendingEnd(null)
      }
      onRefreshCycle?.()
    } catch {
      setErrorMsg('저장에 실패했어요')
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  const fieldStyle = {
    flex: 1,
    background: 'rgba(255,255,255,0.04)',
    borderRadius: 10,
    padding: '10px 12px',
    border: '0.5px solid rgba(123,94,167,0.5)',
    cursor: 'pointer' as const,
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        background: 'rgba(0,0,0,0.55)',
      }}
      onClick={e => {
        if (e.target === e.currentTarget) handleClose()
      }}
      role="presentation"
    >
      <style>{`
        @keyframes hormoneSheetUp {
          from { transform: translateY(100%); opacity: 0.8; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes hormoneSheetRight {
          from { transform: translateX(0); opacity: 1; }
          to { transform: translateX(100%); opacity: 0; }
        }
      `}</style>
      <div
        style={{
          background: '#17171e',
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          border: `1px solid ${THEME_BORDER}`,
          boxShadow: '0 -12px 40px rgba(0,0,0,0.45)',
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: isClosing
            ? 'hormoneSheetRight 0.25s ease-in forwards'
            : 'hormoneSheetUp 0.28s cubic-bezier(0.32,0.72,0,1) forwards',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div
          style={{
            padding: '14px 16px 10px',
            borderBottom: `1px solid ${THEME_BORDER}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 600, color: '#f3ecff', letterSpacing: '-0.02em' }}>
            사이클 설정
          </div>
          <button
            type="button"
            onClick={handleClose}
            style={{
              flexShrink: 0,
              width: 36,
              height: 36,
              borderRadius: 10,
              border: `1px solid ${THEME_BORDER}`,
              background: THEME_BG,
              color: '#e8e0f5',
              fontSize: 18,
              lineHeight: 1,
              cursor: 'pointer',
            }}
            aria-label="닫기"
          >
            ×
          </button>
        </div>

        <div style={{ padding: '16px 16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={fieldStyle} onClick={() => openDateModal('start')}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 4 }}>마법 시작일</div>
              <div style={{ fontSize: 13, color: '#c4a7e7' }}>
                {pendingStart ? fmtDate(pendingStart.d) : hormoneCycle?.last_period_date ? fmtDate(hormoneCycle.last_period_date) : '탭해서 선택'}
              </div>
            </div>
            <div style={fieldStyle} onClick={() => openDateModal('end')}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 4 }}>마법 종료일</div>
              <div style={{ fontSize: 13, color: '#c4a7e7' }}>
                {pendingEnd ? fmtDate(pendingEnd.d) : hormoneCycle?.period_end_date ? fmtDate(hormoneCycle.period_end_date) : '탭해서 선택'}
              </div>
            </div>
          </div>
          {errorMsg ? (
            <div style={{ fontSize: 12, color: '#e8a0a0', textAlign: 'center' }}>{errorMsg}</div>
          ) : null}
          <button
            type="button"
            disabled={saving}
            onClick={() => { void saveDates() }}
            style={{
              padding: '12px 0',
              borderRadius: 11,
              border: 'none',
              fontSize: 13,
              cursor: saving ? 'wait' : 'pointer',
              background: '#7B5EA7',
              color: '#fff',
              fontFamily: 'inherit',
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? '저장 중…' : '저장'}
          </button>
        </div>

        {dateModalOpen ? (
          <div style={{ position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 24 }} onClick={closeDateModal}>
            <div style={{ background: '#1e1c2a', borderRadius: 18, padding: '22px 20px 20px', width: '100%', maxWidth: 340, border: '0.5px solid rgba(123,94,167,0.3)' }} onClick={e => e.stopPropagation()}>
              <div style={{ fontSize: 14, color: '#fff', marginBottom: 16 }}>
                {dateModalType === 'start' ? '마법 시작일' : '마법 종료일'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 11 }}>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', minWidth: 44 }}>날짜</span>
                <input type="date" value={dateModalVal}
                  onChange={e => onDateChange(e.target.value, timeModalVal)}
                  style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(123,94,167,0.35)', borderRadius: 9, padding: '9px 11px', color: '#fff', fontSize: 12 }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 11 }}>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', minWidth: 44 }}>시간</span>
                <input type="time" value={timeModalVal}
                  onChange={e => onDateChange(dateModalVal, e.target.value)}
                  style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(123,94,167,0.35)', borderRadius: 9, padding: '9px 11px', color: '#fff', fontSize: 12 }} />
              </div>
              <button type="button" style={{ width: '100%', padding: '12px 0', borderRadius: 11, background: '#7B5EA7', border: 'none', color: '#fff', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', marginTop: 6 }} onClick={closeDateModal}>
                확인
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
