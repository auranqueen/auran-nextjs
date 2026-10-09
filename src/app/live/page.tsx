'use client'

import { useState } from 'react'

// TODO: Supabase 연결 후 실제 데이터로 교체
type Broadcast = {
  id: number
  owner: string
  store: string
  title: string
  viewers: number
  avatar: string
  status: 'live' | 'upcoming' | 'ended'
  scheduled_time?: string
  duration?: string
  views?: string
}

const liveBroadcasts: Broadcast[] = []      // TODO: Supabase oren_live_broadcasts where status='live'
const upcomingBroadcasts: Broadcast[] = []  // TODO: Supabase oren_live_broadcasts where status='upcoming'
const vodBroadcasts: Broadcast[] = []       // TODO: Supabase oren_live_broadcasts where status='ended'

export default function LivePage() {
  const [tab, setTab] = useState<'live' | 'upcoming' | 'vod'>('live')

  return (
    <div style={{ minHeight: '100vh', background: '#fff', paddingBottom: 80 }}>
      {/* 헤더 */}
      <div style={{ position: 'sticky', top: 0, background: '#fff', zIndex: 10, borderBottom: '1px solid #f0f0f0', padding: '16px 20px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111', margin: 0 }}>📺 라이브</h1>
          <div style={{ display: 'flex', gap: 16, fontSize: 20 }}>
            <button style={{ background: 'none', border: 'none', cursor: 'pointer' }}>🔔</button>
            <button style={{ background: 'none', border: 'none', cursor: 'pointer' }}>🔍</button>
          </div>
        </div>
        {/* 탭 */}
        <div style={{ display: 'flex' }}>
          {(['live', 'upcoming', 'vod'] as const).map((t) => {
            const labels = { live: '진행 중', upcoming: '예정된', vod: '지난 방송' }
            const active = tab === t
            return (
              <button key={t} onClick={() => setTab(t)} style={{
                flex: 1, padding: '10px 0', background: 'none', border: 'none',
                borderBottom: active ? '2px solid #7B5EA7' : '2px solid transparent',
                color: active ? '#7B5EA7' : '#888', fontWeight: active ? 700 : 400,
                fontSize: 14, cursor: 'pointer'
              }}>
                {labels[t]}
              </button>
            )
          })}
        </div>
      </div>

      <div style={{ padding: '20px 0' }}>
        {tab === 'live' && (
          <Section title="🔴 진행 중인 라이브" href="/live/all">
            {liveBroadcasts.length === 0
              ? <EmptyState icon="📺" message="현재 진행 중인 라이브가 없어요" sub="원장님들의 라이브가 시작되면 여기에 나타나요" />
              : <div style={{ display: 'flex', gap: 12, overflowX: 'auto', padding: '0 20px', scrollbarWidth: 'none' }}>
                  {/* TODO: LiveCard 컴포넌트 */}
                </div>
            }
          </Section>
        )}

        {tab === 'upcoming' && (
          <Section title="📅 예정된 라이브" href="/live/upcoming">
            {upcomingBroadcasts.length === 0
              ? <EmptyState icon="📅" message="예정된 라이브가 없어요" sub="곧 원장님들의 라이브 일정이 등록될 예정이에요" />
              : <div style={{ display: 'flex', gap: 12, overflowX: 'auto', padding: '0 20px', scrollbarWidth: 'none' }}>
                  {/* TODO: UpcomingCard 컴포넌트 */}
                </div>
            }
          </Section>
        )}

        {tab === 'vod' && (
          <Section title="🎬 지난 라이브 베스트" href="/live/vod">
            {vodBroadcasts.length === 0
              ? <EmptyState icon="🎬" message="아직 지난 방송이 없어요" sub="첫 라이브가 끝나면 여기서 다시 볼 수 있어요" />
              : <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: '0 20px' }}>
                  {/* TODO: VodCard 컴포넌트 */}
                </div>
            }
          </Section>
        )}
      </div>
    </div>
  )
}

function Section({ title, href, children }: { title: string; href: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 20px', marginBottom: 12 }}>
        <span style={{ fontSize: 16, fontWeight: 700, color: '#111' }}>{title}</span>
        <a href={href} style={{ fontSize: 13, color: '#7B5EA7', textDecoration: 'none' }}>전체보기 →</a>
      </div>
      {children}
    </div>
  )
}

function EmptyState({ icon, message, sub }: { icon: string; message: string; sub: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 20px' }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>{icon}</div>
      <div style={{ fontSize: 15, fontWeight: 600, color: '#333', marginBottom: 6 }}>{message}</div>
      <div style={{ fontSize: 13, color: '#aaa' }}>{sub}</div>
    </div>
  )
}
