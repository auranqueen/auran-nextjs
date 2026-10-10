'use client'

// TODO: Supabase에서 실시간 방송 여부 체크 후 조건부 렌더링
// 현재는 null 반환 (방송 없음 상태) — Mux 연결 후 활성화
export default function LiveBanner() {
  const activeBroadcast = null // TODO: useEffect로 Supabase 쿼리

  if (!activeBroadcast) return null

  return (
    <a href="/live" style={{ display: 'block', textDecoration: 'none' }}>
      <div style={{
        margin: '0 16px 16px',
        background: 'linear-gradient(135deg, #7B5EA7 0%, #9B6FBF 50%, #C9A96E 100%)',
        borderRadius: 16,
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 4px 16px rgba(123,94,167,0.3)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ fontSize: 20 }}>📺</div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
              <span style={{ background: '#FF3B30', color: '#fff', fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4 }}>🔴 LIVE</span>
            </div>
            <div style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>지금 라이브 방송 중</div>
          </div>
        </div>
        <div style={{ color: '#fff', fontSize: 18 }}>▶</div>
      </div>
    </a>
  )
}
