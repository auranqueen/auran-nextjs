'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { normalizePosition, positionToDashboardPath, POSITION_STORAGE_KEY } from '@/lib/position'
import { MonthThemeProvider, useTheme } from '@/components/MonthTheme'

const ROLES = [
  { id: 'customer', icon: '💧', label: '고객', desc: 'AI 피부 분석 · 제품 추천 · 살롱 예약', color: '#c9a84c', bg: 'rgba(201,168,76,0.1)', border: 'rgba(201,168,76,0.3)' },
  { id: 'partner',  icon: '💼', label: '파트너스', desc: '추천 링크 · 커미션 수익', color: '#4a8dc0', bg: 'rgba(74,141,192,0.1)', border: 'rgba(74,141,192,0.3)' },
  { id: 'salon',    icon: '🏥', label: '원장님', desc: '예약 관리 · 스토어 · 매출', color: '#bf5f90', bg: 'rgba(191,95,144,0.1)', border: 'rgba(191,95,144,0.3)' },
  { id: 'brand',    icon: '🏭', label: '브랜드사', desc: '입점 신청 · 납품 · 분석', color: '#4cad7e', bg: 'rgba(76,173,126,0.1)', border: 'rgba(76,173,126,0.3)' },
]

function HomePageInner() {
  const router = useRouter()
  const supabase = createClient()
  const { theme } = useTheme()

  useEffect(() => {
    ;(async () => {
      const stored = normalizePosition(localStorage.getItem(POSITION_STORAGE_KEY))
      if (!stored) return
      const { data } = await supabase.auth.getUser()
      if (!data.user) return
      router.replace(positionToDashboardPath(stored))
    })()
  }, [router, supabase])

  const cards = [
    { ...ROLES[0], t: theme.c1 },
    { ...ROLES[1], t: theme.c2 },
    { ...ROLES[2], t: theme.c3 },
    { ...ROLES[3], t: theme.c4 },
  ] as const

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
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

      {/* 콘텐츠: 모바일(세로) 유지 + PC(좌/중앙 그리드) */}
      <div
        style={{
          padding: '0 20px',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          className="w-full flex flex-col md:flex-row md:items-center md:justify-between md:gap-10"
          style={{ padding: '32px 0 24px' }}
        >
          {/* 히어로: PC에서 좌측 */}
          <div className="md:flex-1" style={{ textAlign: 'center' }}>
            <div
              className="md:text-left"
              style={{ fontFamily: "'Noto Serif KR', serif", fontSize: 24, color: theme.titleColor || 'var(--text)', lineHeight: 1.4, marginBottom: 10 }}
            >
              피부결이 바뀌면,<br />
              <span style={{ color: theme.titleEmColor || 'var(--gold)' }}>화장이 달라집니다</span>
            </div>
            <div className="md:text-left" style={{ fontSize: 13, color: theme.subColor || 'var(--text3)', lineHeight: 1.7 }}>
              AI 피부 분석 · 맞춤 제품 추천<br />
              전국 클리닉 예약까지 한 번에
            </div>
          </div>

          {/* 역할 선택: PC에서 중앙 2x2 그리드 */}
          <div className="md:flex-1 md:flex md:justify-center" style={{ marginTop: 20 }}>
            <div className="md:max-w-[520px] w-full">
              <div
                className="md:text-center"
                style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center', marginBottom: 14, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.08em' }}
              >
                역할을 선택해 시작하세요
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 place-items-stretch">
                {cards.map(r => (
                  <button
                    key={r.id}
                    onClick={() => {
                      localStorage.setItem(POSITION_STORAGE_KEY, r.id)
                      router.push(`/login?role=${r.id}`)
                    }}
                    className="w-full md:aspect-square"
                    style={{
                      background: r.t?.bg ?? r.bg,
                      border: `1px solid ${r.t?.border ?? r.border}`,
                      borderRadius: 16,
                      padding: '18px 16px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 10,
                      textAlign: 'center',
                      transition: 'opacity 0.15s',
                      minHeight: 86, // 모바일에서 너무 납작해지는 것 방지
                    }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
                    onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                  >
                    <div style={{ fontSize: 34, lineHeight: 1 }}>{r.icon}</div>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: r.t?.name ?? r.color, marginBottom: 6 }}>{r.label}</div>
                      <div style={{ fontSize: 11, color: r.t?.desc ?? 'var(--text3)', lineHeight: 1.55 }}>{r.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
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

export default function HomePage() {
  return (
    <MonthThemeProvider>
      <HomePageInner />
    </MonthThemeProvider>
  )
}
