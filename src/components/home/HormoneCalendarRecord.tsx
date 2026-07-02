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

function RecordModal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 999,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'flex-end',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 480, margin: '0 auto',
          background: '#1A1714',
          borderRadius: '20px 20px 0 0',
          padding: '0 20px calc(24px + env(safe-area-inset-bottom, 0px))',
          maxHeight: '90vh', overflowY: 'auto',
        }}
      >
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 0 12px', position: 'sticky', top: 0,
          background: '#1A1714', zIndex: 1,
        }}>
          <span style={{ fontSize: 15, color: '#fff', fontWeight: 500 }}>{title}</span>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 24, color: 'rgba(255,255,255,0.6)',
              padding: '4px 8px', lineHeight: 1,
            }}
          >✕</button>
        </div>
        {children}
      </div>
    </div>
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
  const [recordSleep, setRecordSleep] = useState(3)
  const [recordUv, setRecordUv] = useState('보통')
  const [recordStress, setRecordStress] = useState('보통')
  const [recordSkinStatus, setRecordSkinStatus] = useState<string[]>([])
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
      const userId = (await sb.auth.getUser()).data.user?.id
      if (userId) {
        await sb.from('daily_skin_log').upsert({
          user_id: userId,
          date: iso,
          sleep_hours: recordSleep + 4,
          uv_exposure: recordUv,
          stress_level: recordStress,
          skin_status: recordSkinStatus,
          memo: recordMemo.trim() || null,
        }, { onConflict: 'user_id,date' })
      }
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
  }, [authId, hormoneCycle, selectedDate, recordPeriod, recordCondition, recordMemo, recordSleep, recordUv, recordStress, recordSkinStatus, onCloseTab])

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
    recordSleep,
    setRecordSleep,
    recordUv,
    setRecordUv,
    recordStress,
    setRecordStress,
    recordSkinStatus,
    setRecordSkinStatus,
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
  currentPhase,
  cycleDay,
  recordPeriod,
  setRecordPeriod,
  recordCondition,
  setRecordCondition,
  recordMemo,
  setRecordMemo,
  recordSleep,
  setRecordSleep,
  recordUv,
  setRecordUv,
  recordStress,
  setRecordStress,
  recordSkinStatus,
  setRecordSkinStatus,
  saving,
  onClose,
  onSave,
}: {
  currentPhase: string
  cycleDay: number
  open: boolean
  selectedDateIso: string
  recordPeriod: string
  setRecordPeriod: (v: string) => void
  recordCondition: string
  setRecordCondition: (v: string) => void
  recordMemo: string
  setRecordMemo: (v: string) => void
  recordSleep: number
  setRecordSleep: (v: number) => void
  recordUv: string
  setRecordUv: (v: string) => void
  recordStress: string
  setRecordStress: (v: string) => void
  recordSkinStatus: string[]
  setRecordSkinStatus: (v: string[]) => void
  saving: boolean
  onClose: () => void
  onSave: () => void
}) {
  if (!open) return null
  return (
    <RecordModal title={`기록 · ${selectedDateIso}`} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {currentPhase === '달빛기' && (
          <label style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>
            생리 상태
            <input
              value={recordPeriod}
              onChange={(e) => setRecordPeriod(e.target.value)}
              placeholder={`생리 ${cycleDay}일차예요. 오늘 양은 어때요?`}
              style={{ display: 'block', width: '100%', marginTop: 6, padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: 13 }}
            />
          </label>
        )}
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', lineHeight: 1.7 }}>
          {currentPhase === '달빛기' && `🌙 생리 ${cycleDay}일차예요. 피부가 가장 예민한 시기예요. 자극은 최소로!`}
          {currentPhase === '황금기' && `✨ 지금이 이번 달 피부 황금기예요! 오늘 컨디션 어때요?`}
          {currentPhase === '만개기' && `🌸 배란기 피부, 유분 올라오고 있나요? 모공 케어 타이밍이에요.`}
          {currentPhase === '물들기' && `⚠️ 생리 전 예민 구간이에요. 트러블 예보 중! 오늘 피부 체크해봐요.`}
        </div>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>오늘의 피부 일지</div>
          <label style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>
            수면 ({recordSleep + 4}시간)
            <input type="range" min={0} max={8} value={recordSleep}
              onChange={e => setRecordSleep(Number(e.target.value))}
              style={{ width: '100%', marginTop: 6 }} />
          </label>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>햇빛 노출</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {['거의 없음','조금','보통','많음','매우 많음'].map(v => (
              <button key={v} type="button"
                onClick={() => setRecordUv(v)}
                style={{ fontSize: 12, padding: '4px 10px', borderRadius: 20,
                  background: recordUv === v ? '#7B5EA7' : 'rgba(255,255,255,0.08)',
                  color: recordUv === v ? '#fff' : 'rgba(255,255,255,0.5)',
                  border: 'none', cursor: 'pointer' }}>
                {v}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>스트레스</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {['매우 낮음','낮음','보통','높음','매우 높음'].map(v => (
              <button key={v} type="button"
                onClick={() => setRecordStress(v)}
                style={{ fontSize: 12, padding: '4px 10px', borderRadius: 20,
                  background: recordStress === v ? '#7B5EA7' : 'rgba(255,255,255,0.08)',
                  color: recordStress === v ? '#fff' : 'rgba(255,255,255,0.5)',
                  border: 'none', cursor: 'pointer' }}>
                {v}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>피부 상태</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {['촉촉함','건조함','트러블','예민함','맑음','칙칙함'].map(v => (
              <button key={v} type="button"
                onClick={() => setRecordSkinStatus(
                  recordSkinStatus.includes(v)
                    ? recordSkinStatus.filter(s => s !== v)
                    : [...recordSkinStatus, v]
                )}
                style={{ fontSize: 12, padding: '4px 10px', borderRadius: 20,
                  background: recordSkinStatus.includes(v) ? '#7B5EA7' : 'rgba(255,255,255,0.08)',
                  color: recordSkinStatus.includes(v) ? '#fff' : 'rgba(255,255,255,0.5)',
                  border: 'none', cursor: 'pointer' }}>
                {v}
              </button>
            ))}
          </div>
        </div>
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
