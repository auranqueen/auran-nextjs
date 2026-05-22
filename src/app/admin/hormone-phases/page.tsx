'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import PendingAnalysis from './PendingAnalysis'
import ExternalConsult from './ExternalConsult'
import HormoneComment from './HormoneComment'

type TabId = 'pending' | 'external' | 'comment'

const BG = '#090b0e'
const CARD = '#12151a'
const BORDER = 'rgba(255,255,255,0.08)'
const PURPLE = '#7B5EA7'
const TEXT = '#e8eaed'
const MUTED = 'rgba(255,255,255,0.45)'

export default function HormonePhasesPage() {
  const supabase = createClient()
  const [tab, setTab] = useState<TabId>('pending')
  const [pendingBadge, setPendingBadge] = useState(0)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const { count } = await supabase
        .from('hormone_phase_learnings')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending')
      if (!cancelled) setPendingBadge(count ?? 0)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const tabs: { id: TabId; label: string; badge?: number }[] = [
    { id: 'pending', label: '분석대기', badge: pendingBadge },
    { id: 'external', label: '외부상담' },
    { id: 'comment', label: '호르몬추천' },
  ]

  return (
    <div
      style={{
        minHeight: '100vh',
        background: BG,
        color: TEXT,
        padding: '24px 16px 48px',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 8px', color: TEXT }}>호르몬 페이즈 AI 학습</h1>
        <p style={{ fontSize: 12, color: MUTED, margin: '0 0 20px' }}>상담 로그·외부 자료를 학습해 페이즈별 추천 코멘트를 개선합니다.</p>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              style={{
                padding: '10px 16px',
                borderRadius: 10,
                border: `1px solid ${tab === t.id ? PURPLE : BORDER}`,
                background: tab === t.id ? 'rgba(123,94,167,0.25)' : CARD,
                color: tab === t.id ? '#e8dff5' : MUTED,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              {t.label}
              {t.badge != null && t.badge > 0 ? (
                <span
                  style={{
                    fontSize: 10,
                    background: '#e85d5d',
                    color: '#fff',
                    borderRadius: 999,
                    padding: '2px 8px',
                    fontWeight: 700,
                  }}
                >
                  {t.badge}
                </span>
              ) : null}
            </button>
          ))}
        </div>

        <div
          style={{
            background: CARD,
            borderRadius: 12,
            border: `1px solid ${BORDER}`,
            padding: 16,
          }}
        >
          {tab === 'pending' ? (
            <PendingAnalysis onPendingCountChange={setPendingBadge} />
          ) : null}
          {tab === 'external' ? <ExternalConsult /> : null}
          {tab === 'comment' ? <HormoneComment /> : null}
        </div>
      </div>
    </div>
  )
}
