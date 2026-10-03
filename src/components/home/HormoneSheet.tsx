'use client'

import type { SupabaseClient } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'

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
  const [dateModalEntered, setDateModalEntered] = useState(false)
  const [dateModalClosing, setDateModalClosing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [entered, setEntered] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const handleClose = () => {
    if (isClosing) return
    setIsClosing(true)
    setTimeout(() => { setIsClosing(false); onClose() }, 300)
  }

  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true))
    return () => cancelAnimationFrame(id)
  }, [])

  useEffect(() => {
    if (!dateModalOpen) return
    setDateModalEntered(false)
    const id = requestAnimationFrame(() => setDateModalEntered(true))
    return () => cancelAnimationFrame(id)
  }, [dateModalOpen])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) handleClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, isClosing, onClose])

  function fmtDate(ds: string) {
    const d = new Date(ds)
    return `${d.getMonth() + 1}월 ${d.getDate()}일`
  }

  function openDateModal(type: 'start' | 'end') {
    setDateModalType(type)
    const now = new Date()
    setDateModalVal(now.toISOString().split('T')[0])
    setTimeModalVal(now.toTimeString().slice(0, 5))
    setDateModalClosing(false)
    setDateModalEntered(false)
    setDateModalOpen(true)
  }

  function onDateChange(d: string, t: string) {
    setDateModalVal(d)
    setTimeModalVal(t)
    if (dateModalType === 'start') setPendingStart({ d, t })
    else setPendingEnd({ d, t })
  }

  function closeDateModal() {
    if (dateModalClosing) return
    setDateModalClosing(true)
    setTimeout(() => {
      setDateModalOpen(false)
      setDateModalClosing(false)
      setDateModalEntered(false)
    }, 300)
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
    background: 'rgba(var(--fg-rgb),0.04)',
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
        zIndex: 999,
        background: 'var(--bg)',
        display: 'flex',
        flexDirection: 'column',
        transform: entered && !isClosing ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 300ms ease',
      }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexShrink: 0,
        padding: 'calc(12px + env(safe-area-inset-top, 0px)) 16px 12px',
      }}>
        <button
          type="button"
          onClick={handleClose}
          aria-label="뒤로가기"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: 22,
            color: 'rgba(var(--fg-rgb),0.75)',
            padding: '4px 8px',
            lineHeight: 1,
          }}
        >←</button>
        <span style={{ fontSize: 16, fontWeight: 600, color: '#f3ecff', letterSpacing: '-0.02em' }}>
          사이클 설정
        </span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px calc(24px + env(safe-area-inset-bottom, 0px))', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={fieldStyle} onClick={() => openDateModal('start')}>
              <div style={{ fontSize: 11, color: 'rgba(var(--fg-rgb),0.45)', marginBottom: 4 }}>마법 시작일</div>
              <div style={{ fontSize: 13, color: '#c4a7e7' }}>
                {pendingStart ? fmtDate(pendingStart.d) : hormoneCycle?.last_period_date ? fmtDate(hormoneCycle.last_period_date) : '탭해서 선택'}
              </div>
            </div>
            <div style={fieldStyle} onClick={() => openDateModal('end')}>
              <div style={{ fontSize: 11, color: 'rgba(var(--fg-rgb),0.45)', marginBottom: 4 }}>마법 종료일</div>
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
              color: 'var(--text)',
              fontFamily: 'inherit',
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? '저장 중…' : '저장'}
          </button>
        </div>

        {dateModalOpen ? (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 1000,
              background: 'var(--bg)',
              display: 'flex',
              flexDirection: 'column',
              transform: dateModalEntered && !dateModalClosing ? 'translateY(0)' : 'translateY(100%)',
              transition: 'transform 300ms ease',
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flexShrink: 0,
              padding: 'calc(12px + env(safe-area-inset-top, 0px)) 16px 12px',
            }}>
              <button
                type="button"
                onClick={closeDateModal}
                aria-label="뒤로가기"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 22,
                  color: 'rgba(var(--fg-rgb),0.75)',
                  padding: '4px 8px',
                  lineHeight: 1,
                }}
              >←</button>
              <span style={{ fontSize: 16, fontWeight: 600, color: '#f3ecff' }}>
                {dateModalType === 'start' ? '마법 시작일' : '마법 종료일'}
              </span>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px calc(24px + env(safe-area-inset-bottom, 0px))' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 11 }}>
                <span style={{ fontSize: 11, color: 'rgba(var(--fg-rgb),0.45)', minWidth: 44 }}>날짜</span>
                <input type="date" value={dateModalVal}
                  onChange={e => onDateChange(e.target.value, timeModalVal)}
                  style={{ flex: 1, background: 'rgba(var(--fg-rgb),0.06)', border: '0.5px solid rgba(123,94,167,0.35)', borderRadius: 9, padding: '9px 11px', color: 'var(--text)', fontSize: 12 }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 11 }}>
                <span style={{ fontSize: 11, color: 'rgba(var(--fg-rgb),0.45)', minWidth: 44 }}>시간</span>
                <input type="time" value={timeModalVal}
                  onChange={e => onDateChange(dateModalVal, e.target.value)}
                  style={{ flex: 1, background: 'rgba(var(--fg-rgb),0.06)', border: '0.5px solid rgba(123,94,167,0.35)', borderRadius: 9, padding: '9px 11px', color: 'var(--text)', fontSize: 12 }} />
              </div>
              <button type="button" style={{ width: '100%', padding: '12px 0', borderRadius: 11, background: '#7B5EA7', border: 'none', color: 'var(--text)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', marginTop: 6 }} onClick={closeDateModal}>
                확인
              </button>
            </div>
          </div>
        ) : null}
    </div>
  )
}
