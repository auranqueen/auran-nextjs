'use client'

import DashboardHeader from '@/components/DashboardHeader'
import DashboardBottomNav from '@/components/DashboardBottomNav'
import CustomerHeaderRight from '@/components/CustomerHeaderRight'
import { useEffect, useMemo, useState } from 'react'

type DiaryEntry = {
  id: string
  date: string // YYYY-MM-DD
  note: string
  createdAt: number
}

const STORAGE_KEY = 'auran_diary_entries_v1'

function loadEntries(): DiaryEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(Boolean)
  } catch {
    return []
  }
}

function saveEntries(entries: DiaryEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
}

export default function DiaryPage() {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const [entries, setEntries] = useState<DiaryEntry[]>([])
  const [date, setDate] = useState(today)
  const [note, setNote] = useState('')

  useEffect(() => {
    setEntries(loadEntries())
  }, [])

  const add = () => {
    const trimmed = note.trim()
    if (!trimmed) return
    const e: DiaryEntry = {
      id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
      date,
      note: trimmed,
      createdAt: Date.now(),
    }
    const next = [e, ...entries]
    setEntries(next)
    saveEntries(next)
    setNote('')
  }

  const remove = (id: string) => {
    const next = entries.filter(e => e.id !== id)
    setEntries(next)
    saveEntries(next)
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', maxWidth: 480, margin: '0 auto', paddingBottom: 110 }}>
      <DashboardHeader title="피부일지" right={<CustomerHeaderRight />} />
      <div style={{ padding: '18px 18px 0' }}>
        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 14, padding: '14px 14px', marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 900, color: '#fff', marginBottom: 10 }}>오늘의 기록</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <input
              value={date}
              onChange={e => setDate(e.target.value)}
              type="date"
              style={{
                flex: 1,
                background: 'rgba(0,0,0,0.25)',
                border: '1px solid rgba(255,255,255,0.14)',
                borderRadius: 12,
                padding: '10px 12px',
                color: '#fff',
                fontSize: 12,
              }}
            />
          </div>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="피부 상태/사용한 제품/루틴을 간단히 기록하세요"
            rows={4}
            style={{
              width: '100%',
              resize: 'none',
              background: 'rgba(0,0,0,0.25)',
              border: '1px solid rgba(255,255,255,0.14)',
              borderRadius: 12,
              padding: '10px 12px',
              color: '#fff',
              fontSize: 12,
              lineHeight: 1.6,
              outline: 'none',
            }}
          />
          <button
            type="button"
            onClick={add}
            style={{
              marginTop: 10,
              width: '100%',
              padding: '12px 14px',
              borderRadius: 12,
              background: 'rgba(201,168,76,0.14)',
              border: '1px solid rgba(201,168,76,0.30)',
              color: 'var(--gold)',
              fontSize: 13,
              fontWeight: 900,
              cursor: 'pointer',
            }}
          >
            기록 추가
          </button>
          <div style={{ marginTop: 10, fontSize: 10, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>
            이 버전은 로컬 저장(브라우저)에만 저장됩니다. 추후 계정 기반 동기화로 업그레이드됩니다.
          </div>
        </div>

        <div style={{ fontSize: 13, fontWeight: 900, color: '#fff', marginBottom: 10 }}>내 기록</div>
        {entries.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>아직 기록이 없습니다.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {entries.map(e => (
              <div key={e.id} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 14, padding: '12px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'rgba(255,255,255,0.65)' }}>{e.date}</div>
                  <button
                    type="button"
                    onClick={() => remove(e.id)}
                    style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', fontSize: 12, cursor: 'pointer' }}
                  >
                    삭제
                  </button>
                </div>
                <div style={{ marginTop: 8, fontSize: 12, color: 'rgba(255,255,255,0.85)', whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
                  {e.note}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <DashboardBottomNav role="customer" />
    </div>
  )
}

