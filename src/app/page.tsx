'use client'
import { useRouter } from 'next/navigation'

const ROLES = [
  { id: 'customer', icon: '💧', label: '고객', desc: 'AI 피부 분석 · 제품 추천 · 살롱 예약', color: '#c9a84c', bg: 'rgba(201,168,76,0.1)', border: 'rgba(201,168,76,0.3)' },
  { id: 'partner',  icon: '💼', label: '파트너스', desc: '추천 링크 · 커미션 수익', color: '#4a8dc0', bg: 'rgba(74,141,192,0.1)', border: 'rgba(74,141,192,0.3)' },
  { id: 'owner',    icon: '🏥', label: '원장님', desc: '예약 관리 · 스토어 · 매출', color: '#bf5f90', bg: 'rgba(191,95,144,0.1)', border: 'rgba(191,95,144,0.3)' },
  { id: 'brand',    icon: '🏭', label: '브랜드사', desc: '입점 신청 · 납품 · 분석', color: '#4cad7e', bg: 'rgba(76,173,126,0.1)', border: 'rgba(76,173,126,0.3)' },
]

export default function HomePage() {
  const router = useRouter()

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      {/* 헤더 */}
      <div style={{ padding: '24px 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 20, fontWeight: 700, color: '#e8c870', letterSpacing: '0.15em' }}>AURAN</div>
          <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: "'JetBrains Mono', monospace", marginTop: 2 }}>AI BEAUTY PLATFORM</div>
        </div>
        <button
          onClick={() => router.push('/admin')}
          style={{ fontSize: 11, color: 'var(--text3)', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 12px' }}
        >
          ⚙️ 어드민
        </button>
      </div>

      {/* 히어로 */}
      <div style={{ padding: '32px 20px 24px', textAlign: 'center' }}>
        <div style={{ fontFamily: "'Noto Serif KR', serif", fontSize: 24, color: 'var(--text)', lineHeight: 1.4, marginBottom: 10 }}>
          피부결이 바뀌면,<br />
          <span style={{ color: 'var(--gold)' }}>화장이 달라집니다</span>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text3)', lineHeight: 1.7 }}>
          AI 피부 분석 · 맞춤 제품 추천<br />
          전국 클리닉 예약까지 한 번에
        </div>
      </div>

      {/* 역할 선택 */}
      <div style={{ padding: '0 20px', flex: 1 }}>
        <div style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center', marginBottom: 14, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.08em' }}>
          역할을 선택해 시작하세요
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {ROLES.map(r => (
            <button
              key={r.id}
              onClick={() => router.push(`/login?role=${r.id}`)}
              style={{
                background: r.bg, border: `1px solid ${r.border}`, borderRadius: 14,
                padding: '16px 18px', display: 'flex', gap: 14, alignItems: 'center',
                width: '100%', textAlign: 'left', transition: 'opacity 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
            >
              <div style={{ fontSize: 28, flexShrink: 0 }}>{r.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: r.color, marginBottom: 3 }}>{r.label}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.5 }}>{r.desc}</div>
              </div>
              <div style={{ fontSize: 18, color: r.color, opacity: 0.6 }}>›</div>
            </button>
          ))}
        </div>
      </div>

      {/* 하단 */}
      <div style={{ padding: '24px 20px', textAlign: 'center', borderTop: '1px solid var(--border)', marginTop: 24 }}>
        <div style={{ fontSize: 10, color: 'var(--text3)', lineHeight: 1.8 }}>
          © 2026 AURAN · 개인정보처리방침 · 이용약관
        </div>
      </div>
    </div>
  )
}
