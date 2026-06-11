'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { calcHormoneBriefing } from '@/lib/hormoneUtils'

const P = '#7B5EA7'

function toIsoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function todayDate(): Date {
  const n = new Date()
  return new Date(n.getFullYear(), n.getMonth(), n.getDate())
}

function parseCheckinCondition(raw: string | null | undefined): { period: string; condition: string } {
  const s = String(raw || '').trim()
  if (!s) return { period: '', condition: '' }
  const parts = s.split(' / ').map((x) => x.trim()).filter(Boolean)
  if (parts.length <= 1) return { period: parts[0] || '', condition: '' }
  return { period: parts[0] || '', condition: parts.slice(1).join(' / ') }
}

function RecordModal({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <>
      <div
        role="presentation"
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 9998 }}
      />
      <div style={{
        position: 'fixed',
        left: '50%',
        bottom: 0,
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: 390,
        maxHeight: '85vh',
        overflowY: 'auto',
        background: '#1e1830',
        borderRadius: '20px 20px 0 0',
        zIndex: 9999,
        padding: '16px 18px 28px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ fontSize: 15, fontWeight: 500, color: '#f3ecff' }}>{title}</div>
          <button
            type="button"
            onClick={onClose}
            style={{
              border: 'none',
              background: 'rgba(255,255,255,0.08)',
              color: '#fff',
              width: 32,
              height: 32,
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: 16,
              fontFamily: 'inherit',
            }}
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </>
  )
}

type UseHormoneCalendarRecordArgs = {
  authId: string | null
  hormoneCycle: any
  hasCalendar: boolean
  onCloseTab?: () => void
}

export function useHormoneCalendarRecord({
  authId,
  hormoneCycle,
  hasCalendar,
  onCloseTab,
}: UseHormoneCalendarRecordArgs) {
  const [selectedDate, setSelectedDate] = useState(todayDate)
  const [recordOpen, setRecordOpen] = useState(false)
  const [recordPeriod, setRecordPeriod] = useState('')
  const [recordCondition, setRecordCondition] = useState('')
  const [recordMemo, setRecordMemo] = useState('')
  const [recordedDates, setRecordedDates] = useState<Set<string>>(() => new Set())
  const [recordVersion, setRecordVersion] = useState(0)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  const selectedDateIso = toIsoDate(selectedDate)

  const loadMonthRecords = useCallback(async (uid: string) => {
    const sb = createClient()
    const now = new Date()
    const y = now.getFullYear()
    const m = now.getMonth()
    const start = `${y}-${String(m + 1).padStart(2, '0')}-01`
    const lastDay = new Date(y, m + 1, 0).getDate()
    const end = `${y}-${String(m + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
    const { data } = await sb
      .from('skin_cycle_analysis')
      .select('record_date')
      .eq('auth_id', uid)
      .gte('record_date', start)
      .lte('record_date', end)
    const dates = new Set((data || []).map((row: { record_date: string }) => String(row.record_date)))
    setRecordedDates(dates)
  }, [])

  useEffect(() => {
    if (!authId || !hasCalendar) {
      setRecordedDates(new Set())
      return
    }
    let cancelled = false
    const run = async () => {
      try {
        await loadMonthRecords(authId)
      } catch {
        if (!cancelled) setRecordedDates(new Set())
      }
    }
    void run()
    return () => { cancelled = true }
  }, [authId, hasCalendar, recordVersion, loadMonthRecords])

  const loadRecordForDate = useCallback(async (uid: string, iso: string) => {
    const sb = createClient()
    const [aRes, dRes] = await Promise.all([
      sb
        .from('skin_cycle_analysis')
        .select('checkin_condition')
        .eq('auth_id', uid)
        .eq('record_date', iso)
        .maybeSingle(),
      sb
        .from('skin_cycle_daily')
        .select('note')
        .eq('auth_id', uid)
        .eq('record_date', iso)
        .maybeSingle(),
    ])
    const parsed = parseCheckinCondition((aRes.data as any)?.checkin_condition)
    setRecordPeriod(parsed.period)
    setRecordCondition(parsed.condition)
    setRecordMemo(String((dRes.data as any)?.note || ''))
  }, [])

  const openForDate = useCallback(async (date: Date) => {
    setSelectedDate(date)
    setRecordOpen(true)
    if (!authId) {
      setRecordPeriod('')
      setRecordCondition('')
      setRecordMemo('')
      return
    }
    try {
      await loadRecordForDate(authId, toIsoDate(date))
    } catch {
      setRecordPeriod('')
      setRecordCondition('')
      setRecordMemo('')
    }
  }, [authId, loadRecordForDate])

  const closeRecord = useCallback(() => {
    setRecordOpen(false)
    onCloseTab?.()
  }, [onCloseTab])

  const saveRecord = useCallback(async () => {
    if (!authId || !hormoneCycle) return
    setSaving(true)
    const sb = createClient()
    const iso = toIsoDate(selectedDate)
    try {
      const calc = calcHormoneBriefing(hormoneCycle, selectedDate)
      const checkin_condition = [recordPeriod, recordCondition].filter(Boolean).join(' / ')
      const { error: aErr } = await sb.from('skin_cycle_analysis').upsert(
        {
          auth_id: authId,
          record_date: iso,
          cycle_day: calc.cycleDay,
          hormone_stage: calc.phase,
          checkin_condition,
          updated_at: new Date().toISOString(),
        } as any,
        { onConflict: 'auth_id,record_date' },
      )
      if (aErr) throw aErr
      const { error: dErr } = await sb.from('skin_cycle_daily').upsert(
        {
          auth_id: authId,
          record_date: iso,
          note: recordMemo.trim() || null,
          updated_at: new Date().toISOString(),
        } as any,
        { onConflict: 'auth_id,record_date' },
      )
      if (dErr) throw dErr
      setRecordedDates((prev) => new Set([...Array.from(prev), iso]))
      setRecordVersion((v) => v + 1)
      setRecordOpen(false)
      onCloseTab?.()
      setToast('기록됐어요 💜')
      setTimeout(() => setToast(''), 2200)
    } catch {
      setToast('저장에 실패했어요')
      setTimeout(() => setToast(''), 2200)
    } finally {
      setSaving(false)
    }
  }, [authId, hormoneCycle, selectedDate, recordPeriod, recordCondition, recordMemo, onCloseTab])

  const openTodayRecord = useCallback(() => {
    void openForDate(todayDate())
  }, [openForDate])

  return {
    selectedDate,
    selectedDateIso,
    recordedDates,
    recordOpen,
    recordPeriod,
    setRecordPeriod,
    recordCondition,
    setRecordCondition,
    recordMemo,
    setRecordMemo,
    saving,
    toast,
    openForDate,
    openTodayRecord,
    closeRecord,
    saveRecord,
  }
}

export function HormoneCalendarRecordModal({
  open,
  selectedDateIso,
  recordPeriod,
  setRecordPeriod,
  recordCondition,
  setRecordCondition,
  recordMemo,
  setRecordMemo,
  saving,
  onClose,
  onSave,
}: {
  open: boolean
  selectedDateIso: string
  recordPeriod: string
  setRecordPeriod: (v: string) => void
  recordCondition: string
  setRecordCondition: (v: string) => void
  recordMemo: string
  setRecordMemo: (v: string) => void
  saving: boolean
  onClose: () => void
  onSave: () => void
}) {
  if (!open) return null
  return (
    <RecordModal title={`기록 · ${selectedDateIso}`} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <label style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>
          생리 상태
          <input
            value={recordPeriod}
            onChange={(e) => setRecordPeriod(e.target.value)}
            placeholder="예: 생리 2일차, 가벼운 양"
            style={{
              display: 'block',
              width: '100%',
              marginTop: 6,
              padding: '10px 12px',
              borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(255,255,255,0.06)',
              color: '#fff',
              fontSize: 13,
              fontFamily: 'inherit',
            }}
          />
        </label>
        <label style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>
          컨디션
          <input
            value={recordCondition}
            onChange={(e) => setRecordCondition(e.target.value)}
            placeholder="예: 피로, 붓기, 컨디션 좋음"
            style={{
              display: 'block',
              width: '100%',
              marginTop: 6,
              padding: '10px 12px',
              borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(255,255,255,0.06)',
              color: '#fff',
              fontSize: 13,
              fontFamily: 'inherit',
            }}
          />
        </label>
        <label style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>
          피부 메모
          <textarea
            value={recordMemo}
            onChange={(e) => setRecordMemo(e.target.value)}
            placeholder="오늘 피부 상태를 적어주세요"
            rows={4}
            style={{
              display: 'block',
              width: '100%',
              marginTop: 6,
              padding: '10px 12px',
              borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(255,255,255,0.06)',
              color: '#fff',
              fontSize: 13,
              fontFamily: 'inherit',
              resize: 'vertical',
            }}
          />
        </label>
        <button
          type="button"
          disabled={saving}
          onClick={onSave}
          style={{
            marginTop: 4,
            padding: 12,
            borderRadius: 10,
            border: 'none',
            background: P,
            color: '#fff',
            fontSize: 13,
            cursor: saving ? 'wait' : 'pointer',
            fontFamily: 'inherit',
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? '저장 중…' : '저장'}
        </button>
      </div>
    </RecordModal>
  )
}

export function HormoneCalendarRecordToast({ message }: { message: string }) {
  if (!message) return null
  return (
    <div style={{
      position: 'fixed',
      left: '50%',
      bottom: 24,
      transform: 'translateX(-50%)',
      zIndex: 10000,
      padding: '10px 18px',
      borderRadius: 999,
      background: 'rgba(30,24,48,0.95)',
      border: '1px solid rgba(123,94,167,0.45)',
      color: '#f3ecff',
      fontSize: 13,
      pointerEvents: 'none',
    }}>
      {message}
    </div>
  )
}
