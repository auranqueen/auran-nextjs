'use client'

export type MyAccountProfile = {
  name: string
  avatar_url?: string | null
  skin_type?: string | null
  customer_grade?: string | null
  points: number
  charge_balance: number
}

type Props = {
  me: MyAccountProfile
  skinBadgeLabel: string
  gradeLabel: string
  navigate: (path: string) => void
  onLogout: () => void
}

const menuRow = {
  width: '100%' as const,
  textAlign: 'left' as const,
  background: 'linear-gradient(90deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 16,
  padding: '15px 16px',
  cursor: 'pointer' as const,
  display: 'flex' as const,
  justifyContent: 'space-between' as const,
  alignItems: 'center' as const,
}

export default function MyAccountHubView({ me, skinBadgeLabel, gradeLabel, navigate, onLogout }: Props) {
  return (
    <>
      <div
        style={{
          borderRadius: 20,
          padding: 18,
          marginBottom: 16,
          background: 'linear-gradient(155deg, rgba(201,168,76,0.14) 0%, rgba(255,255,255,0.04) 45%, rgba(10,10,12,0.6) 100%)',
          border: '1px solid rgba(201,168,76,0.28)',
          boxShadow: '0 12px 36px rgba(0,0,0,0.25)',
        }}
      >
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: '50%',
              overflow: 'hidden',
              background: 'rgba(0,0,0,0.25)',
              flexShrink: 0,
              border: '2px solid rgba(201,168,76,0.35)',
            }}
          >
            {me.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={me.avatar_url} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'rgba(255,255,255,0.55)',
                  fontSize: 28,
                }}
              >
                🙂
              </div>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 17,
                color: '#fff',
                fontWeight: 900,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {me.name}
            </div>
            <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <span
                style={{
                  border: '1px solid rgba(201,168,76,0.4)',
                  background: 'rgba(201,168,76,0.14)',
                  color: 'var(--gold)',
                  fontWeight: 900,
                  fontSize: 12,
                  padding: '6px 12px',
                  borderRadius: 999,
                }}
              >
                {skinBadgeLabel}
              </span>
              <span
                style={{
                  border: '1px solid rgba(120,140,200,0.4)',
                  background: 'rgba(120,140,200,0.12)',
                  color: 'rgba(200,210,255,0.95)',
                  fontWeight: 900,
                  fontSize: 12,
                  padding: '6px 12px',
                  borderRadius: 999,
                }}
              >
                등급 {gradeLabel}
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 16 }}>
          <div
            style={{
              background: 'rgba(201,168,76,0.12)',
              border: '1px solid rgba(201,168,76,0.28)',
              borderRadius: 16,
              padding: 14,
            }}
          >
            <div style={{ fontSize: 10, color: 'rgba(201,168,76,0.7)', marginBottom: 6, fontWeight: 700 }}>포인트</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 19, fontWeight: 900, color: 'var(--gold)' }}>
              {(me.points || 0).toLocaleString()}P
            </div>
          </div>
          <div
            style={{
              background: 'rgba(76,173,126,0.12)',
              border: '1px solid rgba(76,173,126,0.28)',
              borderRadius: 16,
              padding: 14,
            }}
          >
            <div style={{ fontSize: 10, color: 'rgba(76,173,126,0.75)', marginBottom: 6, fontWeight: 700 }}>충전 잔액</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 19, fontWeight: 900, color: '#4cad7e' }}>
              ₩{(me.charge_balance || 0).toLocaleString()}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => navigate('/wallet')}
          style={{
            width: '100%',
            marginTop: 14,
            padding: 13,
            borderRadius: 14,
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.12)',
            color: '#fff',
            fontWeight: 900,
            cursor: 'pointer',
            fontSize: 13,
          }}
        >
          지갑으로 이동 →
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[
          { path: '/gifts', title: '🎁 선물함', sub: '생일/이벤트 선물 확인' },
          { path: '/my/coupons', title: '🎫 쿠폰함', sub: '앱 전용 할인 쿠폰' },
          { path: '/notices', title: '🔔 공지사항', sub: '업데이트/이벤트 공지' },
          { path: '/orders', title: '📦 구매내역', sub: '주문 상태 확인' },
          { path: '/wallet', title: '💳 내 지갑', sub: '포인트/충전 잔액' },
          { path: '/account', title: '👤 계정 정보', sub: '프로필/설정' },
        ].map(item => (
          <button key={item.path} type="button" onClick={() => navigate(item.path)} style={menuRow}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 900, color: '#fff' }}>{item.title}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 4 }}>{item.sub}</div>
            </div>
            <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 18 }}>›</div>
          </button>
        ))}

        <button
          type="button"
          onClick={onLogout}
          style={{
            width: '100%',
            padding: 16,
            background: 'rgba(217,79,79,0.12)',
            border: '1px solid rgba(217,79,79,0.32)',
            borderRadius: 16,
            color: '#e08080',
            fontSize: 14,
            fontWeight: 900,
            cursor: 'pointer',
          }}
        >
          🚪 로그아웃
        </button>
      </div>
    </>
  )
}
