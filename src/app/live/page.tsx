'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import DashboardBottomNav from '@/components/DashboardBottomNav'

const BORDER = '#ede9f7'
const TEXT = '#1A1A2E'
const SUB = '#888888'

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  upcoming: { label: '예정', color: '#185FA5', bg: '#E6F1FB' },
  live: { label: '🔴 LIVE', color: '#A32D2D', bg: '#FCEBEB' },
  ended: { label: '종료', color: '#5F5E5A', bg: '#F1EFE8' },
}

interface BroadcastRow {
  id: number
  owner_id: string | null
  title: string
  description: string | null
  scheduled_at: string | null
  status: string
  started_at: string | null
  owner_name: string | null
}

function formatElapsed(startedAt: string) {
  const diff = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)
  const h = Math.floor(diff / 3600)
  const m = Math.floor((diff % 3600) / 60)
  if (h > 0) return `${h}시간 ${m}분째 방송 중`
  return `${m}분째 방송 중`
}

function BroadcastCard({ broadcast: b, onClick }: { broadcast: BroadcastRow; onClick: () => void }) {
  const st = STATUS_MAP[b.status] || STATUS_MAP['upcoming']
  const salonName = b.owner_name || '원장님'
  return (
    <div onClick={onClick} style={{ border: `1px solid ${b.status === 'live' ? '#f5c0c0' : BORDER}`, borderRadius: 14, padding: 14, marginBottom: 10, cursor: 'pointer', background: b.status === 'live' ? '#fff8f8' : '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 10, padding: '2px 9px', borderRadius: 6, background: st.bg, color: st.color, fontWeight: 700 }}>{st.label}</span>
        <span style={{ fontSize: 11, color: '#7B5EA7', fontWeight: 600 }}>{salonName}</span>
        {b.scheduled_at && b.status === 'upcoming' && (
          <span style={{ fontSize: 11, color: '#888', marginLeft: 'auto' }}>
            {new Date(b.scheduled_at).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
        {b.status === 'live' && b.started_at && (
          <span style={{ fontSize: 11, color: '#A32D2D', marginLeft: 'auto' }}>{formatElapsed(b.started_at)}</span>
        )}
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: TEXT, marginBottom: b.description ? 4 : 0 }}>{b.title}</div>
      {b.description && <div style={{ fontSize: 12, color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.description}</div>}
      {b.status === 'live' && (
        <div style={{ marginTop: 8, padding: '7px', borderRadius: 8, background: '#A32D2D', color: '#fff', fontSize: 12, fontWeight: 700, textAlign: 'center' }}>입장하기 →</div>
      )}
    </div>
  )
}

export default function LiveListPage() {
  const router = useRouter()
  const supabase = createClient()
  const [broadcasts, setBroadcasts] = useState<BroadcastRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('oren_live_broadcasts_public')
      .select('id, owner_id, title, description, scheduled_at, status, started_at')
      .in('status', ['upcoming', 'live'])
      .order('scheduled_at', { ascending: true })
      .limit(30)
    const rows: BroadcastRow[] = (data || []).map((r) => ({ ...r, owner_name: null }))
    const ownerIds = Array.from(new Set(rows.map((r) => r.owner_id).filter((v): v is string => !!v)))
    if (ownerIds.length > 0) {
      const { data: owners } = await supabase.from('profiles').select('id, owner_store_name, full_name').in('id', ownerIds)
      const names = new Map<string, string>()
      for (const o of owners || []) names.set(o.id, o.owner_store_name || o.full_name || '')
      for (const r of rows) r.owner_name = r.owner_id ? names.get(r.owner_id) || null : null
    }
    const sorted = rows.sort((a, b) => {
      if (a.status === 'live' && b.status !== 'live') return -1
      if (a.status !== 'live' && b.status === 'live') return 1
      return 0
    })
    setBroadcasts(sorted)
    setLoading(false)
  }, [supabase])

  useEffect(() => { void load() }, [load])

  const liveBroadcasts = broadcasts.filter((b) => b.status === 'live')
  const upcomingBroadcasts = broadcasts.filter((b) => b.status === 'upcoming')

  return (
    <div style={{ background: '#fff', minHeight: '100vh', paddingBottom: 80 }}>
      <div style={{ padding: '20px 16px 12px', borderBottom: `1px solid ${BORDER}` }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: TEXT }}>오렌 라이브</div>
        <div style={{ fontSize: 12, color: SUB, marginTop: 2 }}>원장님의 라이브 방송을 실시간으로 만나보세요</div>
      </div>
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: SUB, fontSize: 13 }}>불러오는 중...</div>
      ) : (
        <div style={{ padding: '16px' }}>
          {liveBroadcasts.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#A32D2D', marginBottom: 10 }}>🔴 지금 방송 중</div>
              {liveBroadcasts.map((b) => <BroadcastCard key={b.id} broadcast={b} onClick={() => router.push(`/live/${b.id}`)} />)}
            </div>
          )}
          {upcomingBroadcasts.length > 0 && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: TEXT, marginBottom: 10 }}>📅 예정된 방송</div>
              {upcomingBroadcasts.map((b) => <BroadcastCard key={b.id} broadcast={b} onClick={() => router.push(`/live/${b.id}`)} />)}
            </div>
          )}
          {broadcasts.length === 0 && (
            <div style={{ textAlign: 'center', padding: 60 }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>📹</div>
              <div style={{ fontSize: 14, color: SUB }}>현재 예정된 방송이 없어요</div>
              <div style={{ fontSize: 12, color: '#bbb', marginTop: 4 }}>원장님들의 라이브를 곧 만나보세요</div>
            </div>
          )}
        </div>
      )}
      <DashboardBottomNav role="customer" />
    </div>
  )
}
