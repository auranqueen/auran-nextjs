'use client'

import DashboardHeader from '@/components/DashboardHeader'
import DashboardBottomNav from '@/components/DashboardBottomNav'
import CustomerHeaderRight from '@/components/CustomerHeaderRight'
import DiaryPageView from '@/components/ui/DiaryPageView'
import CustomerDashboardShell from '@/components/views/CustomerDashboardShell'
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
    <CustomerDashboardShell>
      <DashboardHeader title="피부일지" right={<CustomerHeaderRight />} />
      <DiaryPageView
        date={date}
        setDate={setDate}
        note={note}
        setNote={setNote}
        entries={entries}
        onAdd={add}
        onRemove={remove}
      />
      <DashboardBottomNav role="customer" />
    </CustomerDashboardShell>
  )
}

