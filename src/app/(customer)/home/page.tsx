'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { normalizePosition, positionToDashboardPath, POSITION_LABELS } from '@/lib/position'
import { MonthThemeProvider, useTheme } from '@/components/MonthTheme'
import { useEffect, useState } from 'react'

const ROLES = [
  { id: 'customer', icon: '💧', name: '고객',     desc: '피부분석 · 제품추천 · 살롱예약 · 마이월드' },
  { id: 'partner',  icon: '💎', name: '파트너스',  desc: '추천링크 · 커미션수익 · 라이브커머스' },
  { id: 'salon',    icon: '✨', name: '원장님',   desc: '예약관리 · 스토어 · 매출관리' },
  { id: 'brand',    icon: '🧴', name: '브랜드사',  desc: '납품관리 · 브랜드분석' },
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
    if (typeof window !== 'undefined') {
      localStorage.setItem('selectedPosition', normalized)
    }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push(`/login?position=${normalized}`)
      return
    }
    router.push(positionToDashboardPath(normalized))
  }

  return (
    <div className="relative min-h-screen w-full flex flex-col"
      style={{ transition: 'background 1.2s ease' }}>

      {/* 어드민 버튼 */}
      {isAdmin && (
        <button
          onClick={() => router.push('/admin')}
          className="absolute top-4 right-4 z-30 flex items-center gap-2"
          style={{
            background: '#000',
            border: '1.5px solid #c9a84c',
            borderRadius: '12px',
            padding: '10px 18px',
            color: '#c9a84c',
            fontSize: '13px',
            fontWeight: '700',
            letterSpacing: '1px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
          }}>
          👑 어드민콘솔
        </button>
      )}

      {/* ── 모바일 레이아웃 ── */}
      <div className="flex flex-col md:hidden flex-1 px-5 pt-12 pb-32">
        {/* 로고 */}
        <div className="mb-6">
          <div style={{ fontFamily: "'Cinzel Decorative', serif", fontSize: '22px', fontWeight: 700, letterSpacing: '4px', color: theme?.logo || '#fff', textShadow: '0 0 15px currentColor', transition: 'color 1.2s' }}>
            AURAN
          </div>
          <div style={{ fontSize: '8px', letterSpacing: '3.5px', marginTop: '3px', color: theme?.logoSub || '#888', transition: 'color 1.2s' }}>
            AI BEAUTY FOUNDATION
          </div>
        </div>

        {/* 타이틀 */}
        <div className="mb-6">
          <h1 style={{ fontFamily: 'var(--font-nanum)', fontSize: '28px', fontWeight: 800, lineHeight: 1.4, color: theme?.titleColor || '#fff', transition: 'color 1.2s' }}>
            피부결이 바뀌면,<br />
            <em style={{ fontStyle: 'normal', color: theme?.titleEmColor || '#c9a84c' }}>화장이 달라집니다</em>
          </h1>
          <p style={{ fontSize: '13px', lineHeight: 1.8, marginTop: '10px', color: theme?.subColor || '#aaa', transition: 'color 1.2s' }}>
            AI 피부 분석 · 맞춤 제품 추천<br />
            전국 클리닉 예약까지 한 번에
          </p>
        </div>

        {/* 2x2 카드 그리드 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          {ROLES.map((role) => {
            const c = theme?.[`c${ROLES.indexOf(role) + 1}` as 'c1'] 
            return (
              <button
                key={role.id}
                onClick={() => handleRoleSelect(role.id)}
                style={{
                  background: c?.bg || 'rgba(255,255,255,0.08)',
                  border: `1.5px solid ${c?.border || 'rgba(255,255,255,0.2)'}`,
                  borderRadius: '16px',
                  padding: '16px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  transition: 'all 1.2s ease',
                  backdropFilter: 'blur(10px)',
                  WebkitBackdropFilter: 'blur(10px)',
                  minHeight: '120px',
                  justifyContent: 'center',
                }}>
                <span style={{ fontSize: '26px' }}>{role.icon}</span>
                <span style={{ fontSize: '15px', fontWeight: 700, color: c?.name || '#fff', transition: 'color 1.2s' }}>{role.name}</span>
                <span style={{ fontSize: '10px', color: c?.desc || '#aaa', transition: 'color 1.2s', textAlign: 'center', lineHeight: 1.5 }}>{role.desc}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── PC 레이아웃 ── */}
      <div className="hidden md:flex flex-1 items-center justify-center px-10 py-16">
        <div className="w-full max-w-5xl flex gap-16 items-center">

          {/* 왼쪽: 로고 + 타이틀 */}
          <div className="flex-1">
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

          {/* 오른쪽: 2x2 카드 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', width: '420px', flexShrink: 0 }}>
            {ROLES.map((role) => {
              const idx = ROLES.indexOf(role) + 1
              const c = theme?.[`c${idx}` as 'c1']
              return (
                <button
                  key={role.id}
                  onClick={() => handleRoleSelect(role.id)}
                  style={{
                    background: c?.bg || 'rgba(255,255,255,0.08)',
                    border: `1.5px solid ${c?.border || 'rgba(255,255,255,0.2)'}`,
                    borderRadius: '18px',
                    padding: '20px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    transition: 'all 1.2s ease',
                    backdropFilter: 'blur(10px)',
                    WebkitBackdropFilter: 'blur(10px)',
                    minHeight: '140px',
                    justifyContent: 'center',
                  }}>
                  <span style={{ fontSize: '30px' }}>{role.icon}</span>
                  <span style={{ fontSize: '16px', fontWeight: 700, color: c?.name || '#fff', transition: 'color 1.2s' }}>{role.name}</span>
                  <span style={{ fontSize: '11px', color: c?.desc || '#aaa', transition: 'color 1.2s', textAlign: 'center', lineHeight: 1.6 }}>{role.desc}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* 하단 footer */}
      <div className="text-center pb-20 md:pb-6" style={{ fontSize: '9px', letterSpacing: '1px', color: theme?.footColor || '#555', transition: 'color 1.2s' }}>
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
