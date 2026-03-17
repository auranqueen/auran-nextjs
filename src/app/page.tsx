'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { normalizePosition, positionToDashboardPath } from '@/lib/position'
import { MonthThemeProvider, useTheme } from '@/components/MonthTheme'
import { useEffect, useState } from 'react'

const ROLES = [
  { id: 'customer', icon: '💧', name: '고객',    desc: '피부분석 · 제품추천 · 살롱예약 · 마이월드' },
  { id: 'partner',  icon: '💎', name: '파트너스', desc: '추천링크 · 커미션수익 · 라이브커머스' },
  { id: 'salon',    icon: '✨', name: '원장님',  desc: '예약관리 · 스토어 · 매출관리' },
  { id: 'brand',    icon: '🧴', name: '브랜드사', desc: '납품관리 · 브랜드분석' },
]

function HomePageInner() {
  const router = useRouter()
  const supabase = createClient()
  const { theme } = useTheme()
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()
        if (data?.role === 'admin') setIsAdmin(true)
      }
    }
    checkAdmin()
  }, [])

  const handleRoleSelect = async (roleId: string) => {
    const normalized = normalizePosition(roleId)
    const position = normalized || 'customer'
    if (typeof window !== 'undefined') {
      localStorage.setItem('selectedPosition', position)
    }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login?position=' + position)
      return
    }
    router.push(positionToDashboardPath(position))
  }

  const cardStyles = [theme?.c1, theme?.c2, theme?.c3, theme?.c4]

  const cardStyle = (idx: number) => ({
    background: cardStyles[idx]?.bg || 'rgba(255,255,255,0.08)',
    border: '1.5px solid ' + (cardStyles[idx]?.border || 'rgba(255,255,255,0.2)'),
    borderRadius: '16px',
    display: 'flex' as const,
    flexDirection: 'column' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: '6px',
    cursor: 'pointer',
    transition: 'all 1.2s ease',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
  })

  return (
    <div style={{ position: 'relative', minHeight: '100vh', width: '100%', display: 'flex', flexDirection: 'column' }}>

      {/* 어드민 버튼 */}
      {isAdmin && (
        <button
          onClick={() => router.push('/admin')}
          style={{
            position: 'absolute', top: '16px', right: '16px', zIndex: 30,
            display: 'flex', alignItems: 'center', gap: '8px',
            background: '#000',
            border: '1.5px solid #c9a84c',
            borderRadius: '12px',
            padding: '10px 20px',
            color: '#c9a84c',
            fontSize: '13px',
            fontWeight: 700,
            letterSpacing: '1px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
            cursor: 'pointer',
          }}>
          👑 어드민콘솔
        </button>
      )}

      {/* 모바일 레이아웃 */}
      <div className="md:hidden" style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '48px 20px 120px' }}>
        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontFamily: "'Cinzel Decorative', serif", fontSize: '22px', fontWeight: 700, letterSpacing: '4px', color: theme?.logo || '#fff', transition: 'color 1.2s' }}>
            AURAN
          </div>
          <div style={{ fontSize: '8px', letterSpacing: '3.5px', marginTop: '3px', marginBottom: '20px', color: theme?.logoSub || '#888', transition: 'color 1.2s' }}>
            AI BEAUTY FOUNDATION
          </div>
          <h1 style={{ fontFamily: 'var(--font-nanum)', fontSize: '28px', fontWeight: 800, lineHeight: 1.45, color: theme?.titleColor || '#fff', transition: 'color 1.2s' }}>
            피부결이 바뀌면,<br />
            <em style={{ fontStyle: 'normal', color: theme?.titleEmColor || '#c9a84c' }}>화장이 달라집니다</em>
          </h1>
          <p style={{ fontSize: '13px', lineHeight: 1.85, marginTop: '10px', color: theme?.subColor || '#aaa', transition: 'color 1.2s' }}>
            AI 피부 분석 · 맞춤 제품 추천<br />
            전국 클리닉 예약까지 한 번에
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          {ROLES.map((role, i) => (
            <button key={role.id} onClick={() => handleRoleSelect(role.id)}
              style={{ ...cardStyle(i), padding: '16px 12px', minHeight: '120px' }}>
              <span style={{ fontSize: '26px' }}>{role.icon}</span>
              <span style={{ fontSize: '14px', fontWeight: 700, color: cardStyles[i]?.name || '#fff', transition: 'color 1.2s' }}>{role.name}</span>
              <span style={{ fontSize: '10px', color: cardStyles[i]?.desc || '#aaa', transition: 'color 1.2s', textAlign: 'center', lineHeight: 1.5 }}>{role.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* PC 레이아웃 */}
      <div className="hidden md:flex" style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: '60px 40px' }}>
        <div style={{ width: '100%', maxWidth: '960px', display: 'flex', gap: '64px', alignItems: 'center' }}>

          {/* 왼쪽 텍스트 */}
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "'Cinzel Decorative', serif", fontSize: '28px', fontWeight: 700, letterSpacing: '5px', color: theme?.logo || '#fff', textShadow: '0 0 20px currentColor', marginBottom: '6px', transition: 'color 1.2s' }}>
              AURAN
            </div>
            <div style={{ fontSize: '9px', letterSpacing: '4px', color: theme?.logoSub || '#888', marginBottom: '32px', transition: 'color 1.2s' }}>
              AI BEAUTY FOUNDATION
            </div>
            <h1 style={{ fontFamily: 'var(--font-nanum)', fontSize: '38px', fontWeight: 800, lineHeight: 1.45, color: theme?.titleColor || '#fff', transition: 'color 1.2s' }}>
              피부결이 바뀌면,<br />
              <em style={{ fontStyle: 'normal', color: theme?.titleEmColor || '#c9a84c' }}>화장이 달라집니다</em>
            </h1>
            <p style={{ fontSize: '15px', lineHeight: 2, marginTop: '16px', color: theme?.subColor || '#aaa', transition: 'color 1.2s' }}>
              AI 피부 분석 · 맞춤 제품 추천<br />
              전국 클리닉 예약까지 한 번에
            </p>
          </div>

          {/* 오른쪽 2x2 카드 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', width: '420px', flexShrink: 0 }}>
            {ROLES.map((role, i) => (
              <button key={role.id} onClick={() => handleRoleSelect(role.id)}
                style={{ ...cardStyle(i), padding: '20px 16px', minHeight: '140px' }}>
                <span style={{ fontSize: '30px' }}>{role.icon}</span>
                <span style={{ fontSize: '16px', fontWeight: 700, color: cardStyles[i]?.name || '#fff', transition: 'color 1.2s' }}>{role.name}</span>
                <span style={{ fontSize: '11px', color: cardStyles[i]?.desc || '#aaa', transition: 'color 1.2s', textAlign: 'center', lineHeight: 1.6 }}>{role.desc}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 푸터 */}
      <div style={{ textAlign: 'center', paddingBottom: '80px', fontSize: '9px', letterSpacing: '1px', color: theme?.footColor || '#555', transition: 'color 1.2s' }}>
        © 2026 AURAN · 개인정보처리방침 · 이용약관
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
