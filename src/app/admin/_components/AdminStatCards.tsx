'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function AdminStatCards() {
  const [open, setOpen] = useState<string | null>(null)
  const [data, setData] = useState<any>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const kstYmd = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(now)
    const dayStart = new Date(`${kstYmd}T00:00:00+09:00`).toISOString()

    Promise.all([
      supabase.from('hormone_cycle').select('track').not('track', 'is', null),
      supabase.from('reviews').select('id,images,video_url,is_rebuy').gte('created_at', monthStart),
      supabase.from('toast_transactions').select('amount,transaction_type').gte('created_at', dayStart),
      supabase.from('external_customers').select('id,total_amount,auran_joined,auran_user_id'),
      supabase.from('orders').select('user_id').eq('status', '구매확정').gte('created_at', monthStart),
      supabase.from('user_behavior_logs').select('id,metadata,created_at').gte('created_at', dayStart).order('created_at', { ascending: false }).limit(50),
    ]).then(([hormone, reviews, toast, external, orders, visits]) => {
      setData({ hormone: hormone.data, reviews: reviews.data, toast: toast.data, external: external.data, orders: orders.data, visits: visits.data })
      setLoading(false)
    })
  }, [])

  if (loading) return <div style={{ padding: '12px 0', fontSize: 12, color: 'var(--text3)' }}>통계 불러오는 중...</div>

  const { hormone = [], reviews = [], toast = [], external = [], orders = [], visits = [] } = data

  // 호르몬기 집계
  const trackCount: Record<string, number> = {}
  hormone.forEach((r: any) => { trackCount[r.track] = (trackCount[r.track] || 0) + 1 })
  const hormoneTotal = Object.values(trackCount).reduce((a: number, b: number) => a + b, 0)
  const phases = [
    { key: 'general', label: '생리있음', color: '#c4a8ff' },
    { key: 'menopause_peri', label: '갱년기', color: '#C9A96E' },
    { key: 'pregnant', label: '임신중', color: '#e87b9b' },
    { key: 'postpartum', label: '산후', color: '#7BC49A' },
    { key: 'male', label: '남성', color: '#85B7EB' },
    { key: 'male_menopause', label: '남성갱년기', color: '#d4904a' },
  ]

  // 리뷰 집계
  const totalReviews = reviews.length
  const photoReviews = reviews.filter((r: any) => r.images?.length > 0).length
  const videoReviews = reviews.filter((r: any) => r.video_url).length
  const rebuyReviews = reviews.filter((r: any) => r.is_rebuy === true).length
  const rebuyPct = totalReviews > 0 ? Math.round(rebuyReviews / totalReviews * 100) : 0

  // 토스트 집계
  const todayEarned = toast.filter((t: any) => t.amount > 0).reduce((a: number, b: any) => a + b.amount, 0)
  const todayUsed = toast.filter((t: any) => t.amount < 0).reduce((a: number, b: any) => a + Math.abs(b.amount), 0)

  // 외부고객
  const totalExternal = external.length
  const joinedExternal = external.filter((r: any) => r.auran_joined && r.auran_user_id).length
  const joinedPct = totalExternal > 0 ? Math.round(joinedExternal / totalExternal * 100) : 0

  // 재구매율
  const userIds = orders.map((r: any) => r.user_id)
  const uniqueUsers = new Set(userIds).size
  const rebuyUsers = userIds.filter((id: string, i: number) => userIds.indexOf(id) !== i).length
  const rebuyRate = uniqueUsers > 0 ? Math.round(rebuyUsers / uniqueUsers * 100) : 0

  const cardStyle: React.CSSProperties = {
    background: 'var(--card)',
    border: '0.5px solid var(--border)',
    borderRadius: 10,
    padding: '12px 14px',
    cursor: 'pointer',
    transition: 'border-color .15s',
  }
  const drillStyle: React.CSSProperties = {
    background: 'var(--bg2)',
    border: '0.5px solid var(--border)',
    borderRadius: 10,
    padding: '14px 16px',
    marginBottom: 10,
  }
  const rowStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 12,
    padding: '5px 0',
    borderBottom: '0.5px solid var(--border)',
    color: 'var(--text2)',
  }

  const cards = [
    { id: 'hormone', icon: '🧬', label: '호르몬기 분포', value: `${hormoneTotal}명`, sub: `생리있음 ${trackCount['general'] || 0}명` },
    { id: 'review', icon: '⭐', label: '리뷰 현황 (이달)', value: `${totalReviews}건`, sub: `재구매 의향 ${rebuyPct}%` },
    { id: 'toast', icon: '🍞', label: '토스트 경제 (오늘)', value: `+${todayEarned.toLocaleString()}T`, sub: `사용 -${todayUsed.toLocaleString()}T` },
    { id: 'external', icon: '👥', label: '외부고객 유입', value: `${totalExternal}명`, sub: `가입 전환 ${joinedPct}%` },
    { id: 'rebuy', icon: '🔄', label: '재구매율 (이달)', value: `${rebuyRate}%`, sub: `구매확정 기준` },
    { id: 'visit', icon: '💡', label: '오늘 방문자', value: `${visits.length}건`, sub: `행동 로그 기준` },
  ]

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 10, paddingBottom: 8, borderBottom: '0.5px solid var(--border)' }}>
        📊 신규 통계
      </div>

      {open && (
        <div style={drillStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>
              {cards.find(c => c.id === open)?.icon} {cards.find(c => c.id === open)?.label}
            </span>
            <button onClick={() => setOpen(null)} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 16, padding: 0 }}>✕</button>
          </div>

          {open === 'hormone' && (
            <div>
              {phases.map(p => {
                const cnt = trackCount[p.key] || 0
                const pct = hormoneTotal > 0 ? Math.round(cnt / hormoneTotal * 100) : 0
                return (
                  <div key={p.key} style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                      <span style={{ color: 'var(--text2)' }}>{p.label}</span>
                      <span style={{ color: p.color }}>{cnt}명 ({pct}%)</span>
                    </div>
                    <div style={{ background: 'var(--bg)', borderRadius: 3, height: 6, overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: p.color, borderRadius: 3 }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {open === 'review' && (
            <div>
              <div style={rowStyle}><span>전체 리뷰</span><span style={{ fontWeight: 500 }}>{totalReviews}건</span></div>
              <div style={rowStyle}><span>사진 리뷰</span><span>{photoReviews}건</span></div>
              <div style={rowStyle}><span>영상 리뷰</span><span>{videoReviews}건</span></div>
              <div style={rowStyle}><span>재구매 의향</span><span style={{ color: '#7BC49A' }}>{rebuyReviews}건 ({rebuyPct}%)</span></div>
            </div>
          )}

          {open === 'toast' && (
            <div>
              <div style={rowStyle}><span>오늘 지급</span><span style={{ color: '#7BC49A' }}>+{todayEarned.toLocaleString()}T</span></div>
              <div style={rowStyle}><span>오늘 사용</span><span style={{ color: '#e57373' }}>-{todayUsed.toLocaleString()}T</span></div>
              <div style={rowStyle}><span>순 증가</span><span style={{ fontWeight: 500 }}>{(todayEarned - todayUsed).toLocaleString()}T</span></div>
            </div>
          )}

          {open === 'external' && (
            <div>
              <div style={rowStyle}><span>전체 외부고객</span><span style={{ fontWeight: 500 }}>{totalExternal}명</span></div>
              <div style={rowStyle}><span>오렌 가입</span><span style={{ color: '#7BC49A' }}>{joinedExternal}명</span></div>
              <div style={rowStyle}><span>가입 전환율</span><span style={{ fontWeight: 500 }}>{joinedPct}%</span></div>
            </div>
          )}

          {open === 'rebuy' && (
            <div>
              <div style={rowStyle}><span>전체 구매자</span><span style={{ fontWeight: 500 }}>{uniqueUsers}명</span></div>
              <div style={rowStyle}><span>재구매</span><span style={{ color: '#7B5EA7' }}>{rebuyUsers}명</span></div>
              <div style={rowStyle}><span>재구매율</span><span style={{ fontWeight: 500 }}>{rebuyRate}%</span></div>
            </div>
          )}

          {open === 'visit' && (
            <div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>오늘 행동 로그 (최근 50건)</div>
              <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '0.5px solid var(--border)' }}>
                    <th style={{ textAlign: 'left', padding: '4px 0', color: 'var(--text3)', fontWeight: 400 }}>시간</th>
                    <th style={{ textAlign: 'left', padding: '4px 0', color: 'var(--text3)', fontWeight: 400 }}>페이지</th>
                    <th style={{ textAlign: 'left', padding: '4px 0', color: 'var(--text3)', fontWeight: 400 }}>액션</th>
                  </tr>
                </thead>
                <tbody>
                  {visits.map((v: any, i: number) => (
                    <tr key={i} style={{ borderBottom: '0.5px solid var(--border)' }}>
                      <td style={{ padding: '4px 0', color: 'var(--text3)' }}>
                        {new Date(v.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td style={{ padding: '4px 0', color: 'var(--text2)' }}>{v.metadata?.page || '-'}</td>
                      <td style={{ padding: '4px 0', color: 'var(--text2)' }}>{v.action_type || '-'}</td>
                    </tr>
                  ))}
                  {visits.length === 0 && (
                    <tr><td colSpan={3} style={{ padding: '8px 0', color: 'var(--text3)' }}>오늘 방문 기록이 없습니다</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
        {cards.map(card => (
          <div
            key={card.id}
            style={{ ...cardStyle, borderColor: open === card.id ? '#7B5EA7' : 'var(--border)' }}
            onClick={() => setOpen(open === card.id ? null : card.id)}
          >
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>{card.icon} {card.label}</div>
            <div style={{ fontSize: 20, fontWeight: 500, color: 'var(--text)', marginBottom: 2 }}>{card.value}</div>
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>{card.sub}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
