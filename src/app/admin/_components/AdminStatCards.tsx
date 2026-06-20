import { createClient } from '@/lib/supabase/server'

export default async function AdminStatCards() {
  const supabase = createClient()
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const kstYmd = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(now)
  const dayStart = new Date(`${kstYmd}T00:00:00+09:00`).toISOString()

  const [
    { data: hormoneData },
    { data: reviewData },
    { data: toastData },
    { data: externalData },
    { data: rebuyData },
    { count: careTipCount },
  ] = await Promise.all([
    // 호르몬기별 분포
    supabase.from('hormone_cycle').select('track').not('track', 'is', null),
    // 리뷰 현황
    supabase.from('reviews').select('id, images, video_url, is_rebuy, helpful_count').gte('created_at', monthStart),
    // 토스트 경제
    supabase.from('toast_transactions').select('amount, transaction_type').gte('created_at', dayStart),
    // 외부고객
    supabase.from('external_customers').select('id, total_amount, auran_user_id, auran_joined'),
    // 재구매
    supabase.from('orders').select('user_id, created_at').eq('status', '구매확정').gte('created_at', monthStart),
    // 케어팁 조회 (user_behavior_logs page_view 오늘)
    supabase.from('user_behavior_logs').select('*', { count: 'exact', head: true }).gte('created_at', dayStart),
  ])

  // 호르몬기 집계
  const trackCount: Record<string, number> = {}
  ;(hormoneData || []).forEach((r: any) => {
    trackCount[r.track] = (trackCount[r.track] || 0) + 1
  })
  const total = Object.values(trackCount).reduce((a, b) => a + b, 0)

  // 리뷰 집계
  const totalReviews = (reviewData || []).length
  const photoReviews = (reviewData || []).filter((r: any) => r.images?.length > 0).length
  const videoReviews = (reviewData || []).filter((r: any) => r.video_url).length
  const rebuyReviews = (reviewData || []).filter((r: any) => r.is_rebuy === true).length
  const rebuyPct = totalReviews > 0 ? Math.round(rebuyReviews / totalReviews * 100) : 0

  // 토스트 집계
  const todayEarned = (toastData || []).filter((t: any) => t.amount > 0).reduce((a: number, b: any) => a + b.amount, 0)
  const todayUsed = (toastData || []).filter((t: any) => t.amount < 0).reduce((a: number, b: any) => a + Math.abs(b.amount), 0)

  // 외부고객
  const totalExternal = (externalData || []).length
  const joinedExternal = (externalData || []).filter((r: any) => r.auran_joined).length
  const joinedPct = totalExternal > 0 ? Math.round(joinedExternal / totalExternal * 100) : 0

  // 재구매율
  const userIds = (rebuyData || []).map((r: any) => r.user_id)
  const uniqueUsers = new Set(userIds).size
  const rebuyUsers = userIds.filter((id: string, i: number) => userIds.indexOf(id) !== i).length
  const rebuyRate = uniqueUsers > 0 ? Math.round(rebuyUsers / uniqueUsers * 100) : 0

  const phases = ['달빛기', '황금기', '만개기', '물들기']
  const phaseColors: Record<string, string> = {
    '달빛기': '#c4a8ff',
    '황금기': '#C9A96E',
    '만개기': '#e87b9b',
    '물들기': '#d4904a',
  }
  const trackLabels: Record<string, string> = {
    general: '생리있음',
    menopause_peri: '갱년기',
    pregnant: '임신중',
    postpartum: '산후',
    male: '남성',
    male_menopause: '남성갱년기',
  }

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 12, paddingBottom: 8, borderBottom: '0.5px solid var(--border)' }}>
        📊 신규 통계 <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text3)' }}>— 클릭해서 상세 보기</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10, marginBottom: 16 }}>

        {/* 호르몬기 분포 */}
        <details style={{ background: 'var(--card)', border: '0.5px solid var(--border)', borderRadius: 10, padding: '12px 14px' }}>
          <summary style={{ cursor: 'pointer', fontSize: 12, color: 'var(--text2)', marginBottom: 4, listStyle: 'none' }}>
            🧬 호르몬기 분포
          </summary>
          <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--text)', margin: '4px 0' }}>{total}명</div>
          <div style={{ fontSize: 11, color: 'var(--text3)' }}>달빛기 {Math.round((trackCount['general'] || 0) / total * 100) || 0}% 최다</div>
          <div style={{ marginTop: 10 }}>
            {phases.map(phase => {
              const cnt = (hormoneData || []).filter((r: any) => {
                if (phase === '달빛기') return r.track === 'general'
                return false
              }).length
              const pct = total > 0 ? Math.round((trackCount[phase === '달빛기' ? 'general' : phase] || 0) / total * 100) : 0
              return (
                <div key={phase} style={{ marginBottom: 5 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2 }}>
                    <span style={{ color: 'var(--text2)' }}>{phase}</span>
                    <span style={{ color: phaseColors[phase] }}>{trackCount[phase] || 0}명</span>
                  </div>
                  <div style={{ background: 'var(--bg2)', borderRadius: 3, height: 5, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: phaseColors[phase], borderRadius: 3 }} />
                  </div>
                </div>
              )
            })}
            <div style={{ marginTop: 8, fontSize: 10, color: 'var(--text3)' }}>
              {Object.entries(trackLabels).filter(([k]) => !['general'].includes(k)).map(([k, v]) => (
                <span key={k} style={{ marginRight: 6 }}>{v} {trackCount[k] || 0}</span>
              ))}
            </div>
          </div>
        </details>

        {/* 리뷰 현황 */}
        <details style={{ background: 'var(--card)', border: '0.5px solid var(--border)', borderRadius: 10, padding: '12px 14px' }}>
          <summary style={{ cursor: 'pointer', fontSize: 12, color: 'var(--text2)', marginBottom: 4, listStyle: 'none' }}>
            ⭐ 리뷰 현황 (이달)
          </summary>
          <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--text)', margin: '4px 0' }}>{totalReviews}건</div>
          <div style={{ fontSize: 11, color: 'var(--text3)' }}>재구매 의향 {rebuyPct}%</div>
          <div style={{ marginTop: 10, fontSize: 11, display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text2)' }}><span>사진 리뷰</span><span>{photoReviews}건</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text2)' }}><span>영상 리뷰</span><span>{videoReviews}건</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text2)' }}><span>재구매 의향</span><span>{rebuyReviews}건 ({rebuyPct}%)</span></div>
          </div>
        </details>

        {/* 토스트 경제 */}
        <details style={{ background: 'var(--card)', border: '0.5px solid var(--border)', borderRadius: 10, padding: '12px 14px' }}>
          <summary style={{ cursor: 'pointer', fontSize: 12, color: 'var(--text2)', marginBottom: 4, listStyle: 'none' }}>
            🍞 토스트 경제 (오늘)
          </summary>
          <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--text)', margin: '4px 0' }}>+{todayEarned.toLocaleString()}T</div>
          <div style={{ fontSize: 11, color: 'var(--text3)' }}>사용 -{todayUsed.toLocaleString()}T</div>
          <div style={{ marginTop: 10, fontSize: 11, display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text2)' }}><span>오늘 지급</span><span style={{ color: '#5B8A6B' }}>+{todayEarned.toLocaleString()}T</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text2)' }}><span>오늘 사용</span><span style={{ color: '#e57373' }}>-{todayUsed.toLocaleString()}T</span></div>
          </div>
        </details>

        {/* 외부고객 유입 */}
        <details style={{ background: 'var(--card)', border: '0.5px solid var(--border)', borderRadius: 10, padding: '12px 14px' }}>
          <summary style={{ cursor: 'pointer', fontSize: 12, color: 'var(--text2)', marginBottom: 4, listStyle: 'none' }}>
            👥 외부고객 유입
          </summary>
          <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--text)', margin: '4px 0' }}>{totalExternal}명</div>
          <div style={{ fontSize: 11, color: 'var(--text3)' }}>가입 전환 {joinedPct}%</div>
          <div style={{ marginTop: 10, fontSize: 11, display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text2)' }}><span>전체 외부고객</span><span>{totalExternal}명</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text2)' }}><span>오렌 가입</span><span style={{ color: '#5B8A6B' }}>{joinedExternal}명 ({joinedPct}%)</span></div>
          </div>
        </details>

        {/* 재구매율 */}
        <details style={{ background: 'var(--card)', border: '0.5px solid var(--border)', borderRadius: 10, padding: '12px 14px' }}>
          <summary style={{ cursor: 'pointer', fontSize: 12, color: 'var(--text2)', marginBottom: 4, listStyle: 'none' }}>
            🔄 재구매율 (이달)
          </summary>
          <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--text)', margin: '4px 0' }}>{rebuyRate}%</div>
          <div style={{ fontSize: 11, color: 'var(--text3)' }}>구매확정 기준</div>
          <div style={{ marginTop: 10, fontSize: 11, display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text2)' }}><span>전체 구매자</span><span>{uniqueUsers}명</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text2)' }}><span>재구매</span><span style={{ color: '#7B5EA7' }}>{rebuyUsers}명</span></div>
          </div>
        </details>

        {/* 케어팁 조회 */}
        <details style={{ background: 'var(--card)', border: '0.5px solid var(--border)', borderRadius: 10, padding: '12px 14px' }}>
          <summary style={{ cursor: 'pointer', fontSize: 12, color: 'var(--text2)', marginBottom: 4, listStyle: 'none' }}>
            💡 오늘 방문자
          </summary>
          <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--text)', margin: '4px 0' }}>{careTipCount || 0}</div>
          <div style={{ fontSize: 11, color: 'var(--text3)' }}>오늘 행동 로그</div>
        </details>

      </div>
    </div>
  )
}
