'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import DashboardBottomNav from '@/components/DashboardBottomNav'
import DashboardHeader from '@/components/DashboardHeader'
import NoticeBell from '@/components/NoticeBell'

type Row = {
  id: string
  name: string
  avatar_url?: string | null
  star_level: number
  total_likes: number
  total_followers: number
  purchase_leads: number
  rise_count?: number
}

function starLevelMeta(level: number) {
  const lv = Math.max(1, Math.floor(level || 1))
  if (lv >= 5) return { label: 'AURAN 퀸 🏆', color: '#4fd8ff' }
  if (lv === 4) return { label: '인플루언서 👑', color: '#d2a679' }
  if (lv === 3) return { label: '뷰티스타 💫', color: '#bf5f90' }
  if (lv === 2) return { label: '글로우 ✨', color: '#c9a84c' }
  return { label: '새싹 🌱', color: '#4cad7e' }
}

function crown(rank: number) {
  if (rank === 1) return '👑'
  if (rank === 2) return '🥈'
  if (rank === 3) return '🥉'
  return ''
}

export default function RankingClient({
  likeTop,
  risingTop,
  leadTop,
}: {
  likeTop: Row[]
  risingTop: Row[]
  leadTop: Row[]
}) {
  const router = useRouter()
  const [tab, setTab] = useState<'likes' | 'rising' | 'lead'>('likes')

  const rows = useMemo(() => {
    if (tab === 'likes') return likeTop
    if (tab === 'rising') return risingTop
    return leadTop
  }, [tab, likeTop, risingTop, leadTop])

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', maxWidth: 480, margin: '0 auto', paddingBottom: 110 }}>
      <DashboardHeader title="랭킹" right={<NoticeBell />} />
      <div style={{ padding: '16px 18px 0' }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          {[
            { id: 'likes' as const, label: '이번 주 인기 스타' },
            { id: 'rising' as const, label: '오랜일촌 급상승' },
            { id: 'lead' as const, label: '구매 유도 TOP' },
          ].map(t => {
            const active = tab === t.id
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                style={{
                  flex: 1,
                  padding: '10px 8px',
                  borderRadius: 12,
                  border: `1px solid ${active ? 'rgba(201,168,76,0.55)' : 'rgba(255,255,255,0.10)'}`,
                  background: active ? 'rgba(201,168,76,0.12)' : 'rgba(255,255,255,0.04)',
                  color: active ? 'var(--gold)' : 'rgba(255,255,255,0.75)',
                  fontWeight: 900,
                  fontSize: 11,
                  cursor: 'pointer',
                }}
              >
                {t.label}
              </button>
            )
          })}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rows.map((r, idx) => {
            const rank = idx + 1
            const sm = starLevelMeta(r.star_level)
            const metric =
              tab === 'likes'
                ? `${Number(r.total_likes || 0).toLocaleString()} 공감`
                : tab === 'rising'
                  ? `${Number(r.rise_count || 0).toLocaleString()} 신규 오랜일촌`
                  : `${Number(r.purchase_leads || 0).toLocaleString()} 구매 유도`
            return (
              <div key={r.id} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 14, padding: 12, display: 'flex', gap: 12, alignItems: 'center' }}>
                <div style={{ width: 36, textAlign: 'center', color: '#fff', fontWeight: 900, fontSize: 13 }}>
                  {rank}
                  {rank <= 3 ? ` ${crown(rank)}` : ''}
                </div>

                <div style={{ width: 42, height: 42, borderRadius: 12, overflow: 'hidden', background: 'rgba(0,0,0,0.2)', flexShrink: 0 }}>
                  {r.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', color: 'rgba(255,255,255,0.55)' }}>🙂</div>
                  )}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ fontSize: 13, color: '#fff', fontWeight: 900, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</div>
                    <span style={{ border: `1px solid ${sm.color}55`, background: `${sm.color}18`, color: sm.color, fontWeight: 900, fontSize: 11, padding: '4px 8px', borderRadius: 999 }}>
                      {sm.label}
                    </span>
                  </div>
                  <div style={{ marginTop: 6, fontSize: 12, color: 'var(--gold)', fontWeight: 900 }}>{metric}</div>
                </div>
              </div>
            )
          })}
        </div>

        <button
          type="button"
          onClick={() => router.push('/myworld')}
          style={{ width: '100%', marginTop: 14, padding: '12px 12px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', color: '#fff', fontWeight: 900, cursor: 'pointer' }}
        >
          마이월드로 돌아가기
        </button>
      </div>
      <DashboardBottomNav role="customer" />
    </div>
  )
}

