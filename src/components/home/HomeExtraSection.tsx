'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { computeComposite, computeSkinAge } from '@/lib/skinAge'

type SkinRow = {
  skin_age: number | null
  skin_score: number | null
  moisture_score: number | null
  oil_score: number | null
  elasticity_score: number | null
  pigmentation_score: number | null
  pore_score: number | null
  sensitivity_score: number | null
  age_at_analysis: number | null
}

type PopKey = 'moisture' | 'oil' | 'elasticity' | 'whitening' | null

function skinAgeOf(r: SkinRow): number | null {
  if (r.skin_age != null) return r.skin_age
  const comp = r.skin_score != null ? r.skin_score : computeComposite({
    moisture: r.moisture_score ?? undefined,
    oil: r.oil_score ?? undefined,
    sensitivity: r.sensitivity_score ?? undefined,
    elasticity: r.elasticity_score ?? undefined,
    pigmentation: r.pigmentation_score ?? undefined,
    pore: r.pore_score ?? undefined,
  } as Parameters<typeof computeComposite>[0])
  return computeSkinAge(comp, r.age_at_analysis)
}

const POP_CONTENT: Record<Exclude<PopKey, null>, { title: string; body: string }> = {
  moisture: {
    title: '💧 수분 케어',
    body: '지금 히알루론산·세라마이드 집중. 토너 패딩 3회 레이어링 추천.',
  },
  oil: {
    title: '🌿 유분 케어',
    body: '과도한 세정 금지. 물세안 + 가벼운 피지 조절 토너로 유지.',
  },
  elasticity: {
    title: '✨ 탄력 케어',
    body: '레티놀·펩타이드 지금이 효과 최고. 콜라겐 음식 함께 챙겨요.',
  },
  whitening: {
    title: '🌟 미백 타이밍',
    body: '황금기엔 비타민C 집중. 달빛기엔 미백 시술·레티놀 잠시 멈춤.',
  },
}

const SHORTCUTS = [
  { label: '호르몬달력', emoji: '🌙', href: '/my/hormone', bg: '#EEEDFE', disabled: false },
  { label: '내관리', emoji: '💆', href: '/my/manage', bg: '#E1F5EE', disabled: false },
  { label: '상담톡', emoji: '💬', href: '/dashboard/customer/chat', bg: '#EEEDFE', disabled: false },
  { label: '스킨스타', emoji: '✨', href: '/myworld', bg: '#FBEAF0', disabled: false },
  { label: '리뷰·커뮤니티', emoji: '📝', href: '/dashboard/customer/community', bg: '#FAEEDA', disabled: false },
  { label: '라이브', emoji: '📹', href: '#', bg: '#f0f0f0', disabled: true },
] as const

function getHref(href: string, isLoggedIn: boolean): string {
  if (!isLoggedIn) {
    return `/login?role=customer&redirect=${encodeURIComponent(href)}`
  }
  return href
}

const btn3d = (bg: string, shadow: string): React.CSSProperties => ({
  border: 'none',
  borderRadius: 14,
  padding: '14px 10px',
  background: bg,
  boxShadow: `0 4px 0 ${shadow}`,
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontSize: 12,
  color: '#2A2433',
  textAlign: 'center' as const,
  lineHeight: 1.4,
})

function ShortcutGrid({ isLoggedIn }: { isLoggedIn: boolean }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 12 }}>
      {SHORTCUTS.map((item) => {
        const inner = (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 6,
            padding: '10px 4px',
            borderRadius: 16,
            background: item.bg,
            opacity: item.disabled ? 0.35 : 1,
            pointerEvents: item.disabled ? 'none' as const : 'auto' as const,
          }}>
            <div style={{
              width: 50,
              height: 50,
              borderRadius: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 22,
              background: 'rgba(255,255,255,0.45)',
            }}>
              {item.emoji}
            </div>
            <span style={{ fontSize: 10, color: '#2A2433', fontWeight: 500 }}>{item.label}</span>
          </div>
        )
        if (item.disabled) return <div key={item.label}>{inner}</div>
        return (
          <Link key={item.label} href={getHref(item.href, isLoggedIn)} style={{ textDecoration: 'none' }}>
            {inner}
          </Link>
        )
      })}
    </div>
  )
}

export default function HomeExtraSection() {
  const [loading, setLoading] = useState(true)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [latest, setLatest] = useState<SkinRow | null>(null)
  const [prevAge, setPrevAge] = useState<number | null>(null)
  const [isExtraOpen, setIsExtraOpen] = useState(false)
  const [popKey, setPopKey] = useState<PopKey>(null)

  useEffect(() => {
    const sb = createClient()
    let cancelled = false

    const fetchSkin = async (userId: string) => {
      const { data } = await sb
        .from('skin_analyses')
        .select('skin_age, skin_score, moisture_score, oil_score, sensitivity_score, elasticity_score, pigmentation_score, pore_score, age_at_analysis')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(2)
      if (cancelled) return
      const rows = (data as SkinRow[]) || []
      if (!rows.length) {
        setLatest(null)
        setPrevAge(null)
        return
      }
      setLatest(rows[0])
      if (rows.length > 1) {
        const a0 = skinAgeOf(rows[0])
        const a1 = skinAgeOf(rows[1])
        if (a0 != null && a1 != null) setPrevAge(a1 - a0)
        else setPrevAge(null)
      } else {
        setPrevAge(null)
      }
    }

    const load = async () => {
      try {
        const { data: { user } } = await sb.auth.getUser()
        if (cancelled) return
        setIsLoggedIn(!!user)
        if (user) {
          await fetchSkin(user.id)
        } else {
          setLatest(null)
          setPrevAge(null)
        }
      } catch {
        if (!cancelled) {
          setLatest(null)
          setPrevAge(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()

    const { data: { subscription } } = sb.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return
      const user = session?.user
      setIsLoggedIn(!!user)
      if (!user) {
        setLatest(null)
        setPrevAge(null)
        setLoading(false)
        return
      }
      setLoading(true)
      void fetchSkin(user.id)
        .catch(() => {
          if (!cancelled) {
            setLatest(null)
            setPrevAge(null)
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  const skinAge = latest ? skinAgeOf(latest) : null
  const moisture = latest?.moisture_score ?? null
  const elasticity = latest?.elasticity_score ?? null
  const oilLabel = latest?.oil_score == null
    ? '—'
    : latest.oil_score >= 55 ? '과다' : latest.oil_score <= 35 ? '부족' : '적정'

  return (
    <>
      <style>{`.home-extra-3d:active { transform: translateY(2px); box-shadow: 0 2px 0 var(--btn-shadow) !important; }`}</style>
      <div style={{ margin: '14px 16px 0' }}>
        {loading ? (
          <div style={{ height: 72, borderRadius: 14, background: 'rgba(255,255,255,0.06)', animation: 'pulse 1.2s ease-in-out infinite' }} />
        ) : latest ? (
          <div
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '0.5px solid rgba(255,255,255,0.1)',
              borderRadius: 14,
              overflow: 'hidden',
            }}
          >
            <button
              type="button"
              onClick={() => setIsExtraOpen((v) => !v)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                padding: '14px 16px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'inherit',
                color: 'rgba(255,255,255,0.92)',
                textAlign: 'left',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 14, fontWeight: 500 }}>📈 내 피부 변화</span>
                {skinAge != null && (
                  <span style={{ fontFamily: 'Georgia, serif', fontSize: 22, color: '#C9A96E' }}>
                    {skinAge}<span style={{ fontSize: 12, opacity: 0.7 }}>세</span>
                  </span>
                )}
                {prevAge != null && prevAge !== 0 && (
                  <span style={{
                    fontSize: 10,
                    padding: '3px 8px',
                    borderRadius: 999,
                    background: prevAge > 0 ? 'rgba(91,138,107,0.2)' : 'rgba(201,169,110,0.15)',
                    color: prevAge > 0 ? '#8fd4a8' : '#C9A96E',
                  }}>
                    {prevAge > 0 ? `▼ ${prevAge}세` : `▲ ${Math.abs(prevAge)}세`}
                  </span>
                )}
              </div>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', flexShrink: 0 }}>
                자세히 {isExtraOpen ? '▲' : '▼'}
              </span>
            </button>
            <div style={{
              maxHeight: isExtraOpen ? 320 : 0,
              overflow: 'hidden',
              transition: 'max-height 0.3s ease',
            }}>
              <div style={{ padding: '0 12px 14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <button type="button" className="home-extra-3d" style={{ ...btn3d('#EEEDFE', '#AFA9EC'), ['--btn-shadow' as string]: '#AFA9EC' }} onClick={() => setPopKey('moisture')}>
                  💧 수분 {moisture != null ? `${moisture}%` : '—'}
                </button>
                <button type="button" className="home-extra-3d" style={{ ...btn3d('#FAEEDA', '#EF9F27'), ['--btn-shadow' as string]: '#EF9F27' }} onClick={() => setPopKey('oil')}>
                  🌿 유분 {oilLabel}
                </button>
                <button type="button" className="home-extra-3d" style={{ ...btn3d('#E1F5EE', '#5DCAA5'), ['--btn-shadow' as string]: '#5DCAA5' }} onClick={() => setPopKey('elasticity')}>
                  ✨ 탄력 {elasticity != null ? `${elasticity}%` : '—'}
                </button>
                <button type="button" className="home-extra-3d" style={{ ...btn3d('#FBEAF0', '#ED93B1'), ['--btn-shadow' as string]: '#ED93B1' }} onClick={() => setPopKey('whitening')}>
                  🌟 미백 타이밍
                </button>
              </div>
            </div>
          </div>
        ) : (
          <Link
            href="/skin-analysis"
            style={{
              display: 'block',
              textDecoration: 'none',
              background: 'rgba(255,255,255,0.06)',
              border: '0.5px solid rgba(255,255,255,0.1)',
              borderRadius: 14,
              padding: '14px 16px',
              textAlign: 'center',
              fontSize: 14,
              fontWeight: 500,
              color: 'rgba(255,255,255,0.92)',
            }}
          >
            📷 첫 피부 분석하러 가기
          </Link>
        )}

        <ShortcutGrid isLoggedIn={isLoggedIn} />
      </div>

      {popKey ? (
        <>
          <div
            role="presentation"
            onClick={() => setPopKey(null)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9998 }}
          />
          <div style={{
            position: 'fixed',
            bottom: 0,
            left: '50%',
            transform: 'translateX(-50%)',
            width: '100%',
            maxWidth: 390,
            background: '#fff',
            borderRadius: '20px 20px 0 0',
            zIndex: 9999,
            padding: '12px 20px 24px',
          }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: '#ddd', margin: '0 auto 14px' }} />
            <div style={{ fontSize: 15, fontWeight: 600, color: '#2A2433', marginBottom: 10 }}>
              {POP_CONTENT[popKey].title}
            </div>
            <div style={{ fontSize: 13, color: '#4A4256', lineHeight: 1.65, marginBottom: 16 }}>
              {POP_CONTENT[popKey].body}
            </div>
            <button
              type="button"
              onClick={() => setPopKey(null)}
              style={{
                width: '100%',
                padding: 12,
                border: 'none',
                borderRadius: 10,
                background: '#7B5EA7',
                color: '#fff',
                fontSize: 13,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              닫기
            </button>
          </div>
        </>
      ) : null}
    </>
  )
}
