'use client'
import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import {
  MONTH_THEMES, BIRTHDAY_THEME, PARTICLE_CHARS,
  getCurrentTheme, getBirthdayDaysLeft, isBirthdayWeek,
  type MonthTheme
} from '@/lib/themes/monthTheme'

type ThemeContextValue = {
  theme: Partial<MonthTheme>
  activeMonth: number
  setActiveMonth: (idx: number) => void
  applyTheme: (t: Partial<MonthTheme>) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within MonthThemeProvider')
  return ctx
}

interface MonthThemeProviderProps {
  children: React.ReactNode
}

export function MonthThemeProvider({ children }: MonthThemeProviderProps) {
  const [theme, setTheme] = useState<Partial<MonthTheme>>(() => {
    const base = getCurrentTheme()
    if (typeof window === 'undefined') return base
    const saved = localStorage.getItem('auran_birthday') || ''
    const isValid = /^\d{2}-\d{2}$/.test(saved)
    if (!isValid) return base
    if (isBirthdayWeek()) {
      return { ...base, ...BIRTHDAY_THEME }
    }
    return base
  })
  const [activeMonth, setActiveMonth] = useState(new Date().getMonth())
  const [bdayDays, setBdayDays] = useState<number | null>(null)
  const [bdayInput, setBdayInput] = useState('')
  const [showSelector, setShowSelector] = useState(false)
  const [transitionsEnabled, setTransitionsEnabled] = useState(false)
  const particleRef = useRef<HTMLDivElement>(null)
  const sparkleRef = useRef<HTMLDivElement>(null)
  const lightsRef = useRef<HTMLDivElement>(null)
  const planeRef = useRef<HTMLDivElement>(null)

  const applyTheme = useCallback((m: Partial<MonthTheme>) => {
    setTheme(m)
  }, [])

  useEffect(() => {
    // 첫 페인트에서 깜빡임 방지: 마운트 후 트랜지션 활성화
    setTransitionsEnabled(true)

    // 생일 체크
    const d = getBirthdayDaysLeft()
    setBdayDays(d)
    const saved = localStorage.getItem('auran_birthday') || ''
    setBdayInput(saved)
    // 초기 state initializer에서 이미 적용했으므로 여기서는 중복 apply 하지 않음
  }, [applyTheme])

  // 파티클 생성
  useEffect(() => {
    const container = particleRef.current
    if (!container || !theme.particles) return
    container.innerHTML = ''

    const chars = PARTICLE_CHARS[theme.particles] || PARTICLE_CHARS['m1']
    const speeds = theme.particleSpeeds || [20, 24, 22, 26]
    const positions = [4, 13, 22, 33, 44, 54, 65, 76, 86, 93]
    const sizes = [18, 13, 8]
    const speedMults = [1.4, 1.2, 1.0]

    if (theme.particles === 'plane') {
      // 비행기
      const plane = document.createElement('div')
      plane.style.cssText = `
        position:absolute; bottom:32%; left:28%; z-index:2;
        font-size:15px; opacity:0; pointer-events:none;
        animation:july-plane 30s linear infinite;
        animation-delay:1s;
      `
      plane.textContent = '🛩'
      container.appendChild(plane)
      return
    }

    speeds.forEach((spd, j) => {
      const p = document.createElement('div')
      const sz = sizes[j % 3]
      const finalSpd = Math.round(spd * speedMults[j % 3] * 1.5)
      p.style.cssText = `
        position:absolute; top:-20px; opacity:0;
        font-size:${sz}px;
        left:${positions[j % positions.length]}%;
        animation:particle-fall ${finalSpd}s linear infinite;
        animation-delay:${(j * 1.8 + Math.random() * 2).toFixed(1)}s;
        pointer-events:none; z-index:2;
      `
      p.textContent = chars[j % chars.length]
      container.appendChild(p)
    })
  }, [theme.particles, theme.particleSpeeds])

  // 반짝임 생성
  useEffect(() => {
    const container = sparkleRef.current
    if (!container || !theme.sparkles) return
    container.innerHTML = ''
    theme.sparkles.forEach(sp => {
      const el = document.createElement('div')
      el.style.cssText = `
        position:absolute;
        left:${sp.left}; top:${sp.top};
        width:${sp.size}px; height:${sp.size}px;
        border-radius:50%;
        background:${sp.color};
        box-shadow:0 0 ${sp.size * 3}px ${sp.size}px ${sp.color};
        animation:sparkle-anim ${sp.duration}s ease-in-out infinite;
        animation-delay:${(Math.random() * 2.5).toFixed(1)}s;
        pointer-events:none; z-index:5;
      `
      container.appendChild(el)
    })
  }, [theme.sparkles])

  // 전구 생성
  useEffect(() => {
    const container = lightsRef.current
    if (!container || !theme.lights) return
    container.innerHTML = '<div style="position:absolute;top:8px;left:0;right:0;height:2px;background:rgba(80,60,40,0.5)"></div>'
    const colors = theme.lights
    const n = 14
    for (let i = 0; i < n; i++) {
      const b = document.createElement('div')
      const c = colors[i % colors.length]
      const l = (i / (n - 1) * 92 + 2)
      b.style.cssText = `
        position:absolute; top:4px; left:${l}%;
        width:8px; height:12px;
        border-radius:50% 50% 40% 40%;
        background:${c};
        box-shadow:0 0 6px 2px ${c}88;
        animation:bulb-glow ${1.2 + Math.random() * 1.5}s ease-in-out infinite alternate;
        animation-delay:${(Math.random() * 2).toFixed(1)}s;
      `
      container.appendChild(b)
    }
  }, [theme.lights])

  const handleMonthSelect = (idx: number) => {
    setActiveMonth(idx)
    const m = MONTH_THEMES[idx]
    applyTheme(m)
    setShowSelector(false)
  }

  const handleSaveBirthday = () => {
    if (/^\d{2}-\d{2}$/.test(bdayInput)) {
      localStorage.setItem('auran_birthday', bdayInput)
      const d = getBirthdayDaysLeft()
      setBdayDays(d)
      if (d !== null && d <= 7) {
        applyTheme({ ...MONTH_THEMES[activeMonth], ...BIRTHDAY_THEME })
      }
    }
  }

  return (
    <ThemeContext.Provider value={{ theme, activeMonth, setActiveMonth, applyTheme }}>
      <div
        className="relative min-h-screen overflow-hidden"
        style={{ background: theme.bg, transition: transitionsEnabled ? 'all 1.2s ease' : 'none' }}
      >
      {/* 전구 스트링 */}
      <div
        ref={lightsRef}
        className="absolute top-0 left-0 right-0 z-20"
        style={{ height: '22px', pointerEvents: 'none' }}
      />

      {/* 오로라 */}
      {theme.hasAurora && (
        <div className="absolute inset-0 z-[2] overflow-hidden pointer-events-none" style={{ height: '50%' }}>
          <div style={{
            position: 'absolute', width: '160%', height: '100%',
            background: 'linear-gradient(180deg,transparent 0%,rgba(0,255,150,0.07) 35%,rgba(0,200,255,0.09) 65%,transparent 100%)',
            animation: 'aurora-wave 14s ease-in-out infinite',
            borderRadius: '0 0 60% 40%'
          }} />
        </div>
      )}

      {/* 달 */}
      {theme.moon?.show && (
        <div className="absolute z-[8] pointer-events-none" style={{ top: '44px', right: '22px' }}>
          <div style={{
            width: theme.moon.width, height: theme.moon.height,
            background: theme.moon.color,
            borderRadius: '50%',
            boxShadow: `0 0 12px 4px ${theme.moon.glow}`,
            animation: 'moon-glow 7s ease-in-out infinite'
          }} />
        </div>
      )}

      {/* 태양 */}
      {theme.hasSun && (
        <div className="absolute z-[8] pointer-events-none" style={{ top: '46px', right: '26px', width: '40px', height: '40px', animation: 'sun-pulse 5s ease-in-out infinite' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle,#fffde7,#ffcc02)', borderRadius: '50%', boxShadow: '0 0 0 5px rgba(255,220,0,0.15),0 0 0 10px rgba(255,200,0,0.08)' }} />
        </div>
      )}

      {/* 파도 */}
      {theme.hasWave && (
        <div className="absolute z-[3] pointer-events-none overflow-hidden" style={{ bottom: '37%', left: '-10px', right: '-10px', height: '18px' }}>
          <div style={{ position: 'absolute', width: '200%', height: '100%', background: 'rgba(255,255,255,0.4)', borderRadius: '40% 60% 40% 60% / 50%', animation: 'wave-move 4s linear infinite' }} />
          <div style={{ position: 'absolute', width: '200%', height: '100%', top: '5px', background: 'rgba(255,255,255,0.22)', borderRadius: '60% 40% 60% 40% / 50%', animation: 'wave-move 6s linear infinite reverse' }} />
        </div>
      )}

      {/* 눈 지면 */}
      {theme.hasSnowGround && (
        <div className="absolute z-[3] pointer-events-none" style={{ bottom: '33%', left: 0, right: 0, height: '20px', background: 'rgba(220,240,255,0.55)', borderRadius: '50% 50% 0 0 / 8px 8px 0 0' }} />
      )}

      {/* 크리스마스 트리 */}
      {theme.hasXmasTree && (
        <div className="absolute z-[4] pointer-events-none" style={{ bottom: '33%', left: '8px', fontSize: '32px' }}>🎄</div>
      )}

      {/* 12월 눈사람 배경 */}
      {theme.hasXmasTree && (
        <div className="absolute pointer-events-none" style={{ bottom: '28%', right: '-8px', fontSize: '72px', zIndex: 2, opacity: 0.18, filter: 'blur(1px)', animation: 'snowman-sway 8s ease-in-out infinite' }}>⛄</div>
      )}

      {/* 반짝임 */}
      <div ref={sparkleRef} className="absolute inset-0 pointer-events-none" style={{ zIndex: 5 }} />

      {/* 파티클 */}
      <div ref={particleRef} className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 2 }} />

      {/* 7월 구름 */}
      {activeMonth === 6 && (
        <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 7 }}>
          {[
            { top: '8%', dur: 22, w: 70, h: 26, delay: 0, op: 1 },
            { top: '14%', dur: 32, w: 50, h: 18, delay: -12, op: 0.6 },
            { top: '18%', dur: 40, w: 40, h: 14, delay: -20, op: 0.4 },
          ].map((cl, i) => (
            <div key={i} className="absolute" style={{ top: cl.top, left: '-80px', opacity: cl.op }}>
              <div style={{
                width: cl.w, height: cl.h,
                background: 'rgba(255,255,255,0.75)',
                borderRadius: '30px',
                position: 'relative',
                animation: `july-cloud-drift ${cl.dur}s linear infinite`,
                animationDelay: `${cl.delay}s`
              }}>
                <div style={{ position: 'absolute', width: cl.w * 0.5, height: cl.w * 0.5, background: 'rgba(255,255,255,0.85)', borderRadius: '50%', top: `-${cl.w * 0.24}px`, left: `${cl.w * 0.15}px` }} />
                <div style={{ position: 'absolute', width: cl.w * 0.35, height: cl.w * 0.35, background: 'rgba(255,255,255,0.8)', borderRadius: '50%', top: `-${cl.w * 0.16}px`, left: `${cl.w * 0.4}px` }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 실제 콘텐츠 */}
      <div className="relative z-10">
        {children}
      </div>

      {/* 생일 배너 */}
      {bdayDays !== null && bdayDays <= 7 && (
        <div className="absolute top-6 left-4 right-4 z-30 text-center py-2 px-4 rounded-2xl text-xs font-bold"
          style={{ background: 'linear-gradient(90deg,#ff6b9d,#ffd700,#ff6b9d)', backgroundSize: '200% auto', animation: 'banner-shine 3s linear infinite', color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,0.3)' }}>
          {bdayDays === 0
            ? '🎂 생일 선물이 도착했어요! 마이월드 → 선물함을 확인하세요 ✨'
            : `🎁 D-${bdayDays} 생일 선물이 곧 도착해요! 마이월드 → 선물함을 확인하세요 🎀`}
        </div>
      )}

      {/* 월 선택기 + 생일 설정 */}
      <div
        className="absolute bottom-0 left-0 right-0 z-30 px-3 pb-3 pt-2 flex flex-col items-center gap-2"
        style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.28))' }}
      >
        {/* 월 버튼 (숫자만) */}
        <div className="flex gap-1.5 flex-wrap justify-center">
          {MONTH_THEMES.map((_, i) => (
            <button
              key={i}
              onClick={() => handleMonthSelect(i)}
              aria-label={`${i + 1}월 테마`}
              style={{
                width: 28,
                height: 28,
                borderRadius: 10,
                background: i === activeMonth ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.22)',
                border: `1px solid ${i === activeMonth ? (theme.logo || 'rgba(255,255,255,0.5)') : 'rgba(255,255,255,0.14)'}`,
                color: i === activeMonth ? (theme.logo || '#fff') : 'rgba(255,255,255,0.6)',
                fontSize: 11,
                fontWeight: 800,
                lineHeight: '28px',
                textAlign: 'center',
              }}
            >
              {i + 1}
            </button>
          ))}
        </div>

        {/* 생일 입력 + 저장만 */}
        <div className="flex gap-2 items-center">
          <input
            type="text"
            placeholder="생일 (MM-DD)"
            maxLength={5}
            value={bdayInput}
            onChange={e => setBdayInput(e.target.value)}
            className="text-center text-xs px-3 py-1.5 rounded-xl outline-none"
            style={{
              background: 'rgba(0,0,0,0.35)',
              border: '1px solid rgba(255,255,255,0.18)',
              color: 'rgba(255,255,255,0.82)',
              width: '130px',
            }}
          />
          <button
            onClick={handleSaveBirthday}
            className="text-xs px-3 py-1.5 rounded-xl font-bold"
            style={{
              background: 'rgba(255,255,255,0.14)',
              border: '1px solid rgba(255,255,255,0.24)',
              color: 'rgba(255,255,255,0.82)',
            }}
          >
            저장
          </button>
        </div>
      </div>

      {/* CSS 키프레임 */}
      <style>{`
        @keyframes particle-fall {
          0%   { top:-20px; opacity:0; transform:translateX(0) rotate(0deg); }
          8%   { opacity:1; }
          85%  { opacity:0.85; }
          100% { top:110%; opacity:0; transform:translateX(28px) rotate(320deg); }
        }
        @keyframes sparkle-anim {
          0%,100% { opacity:0; transform:scale(0.2); }
          40%     { opacity:1; transform:scale(1.5); }
          70%     { opacity:0.3; transform:scale(0.5); }
        }
        @keyframes bulb-glow {
          0%   { opacity:0.5; filter:brightness(0.7); }
          100% { opacity:1;   filter:brightness(1.3); }
        }
        @keyframes aurora-wave {
          0%,100% { transform:translateX(0) scaleY(1); opacity:0.7; }
          50%     { transform:translateX(18px) scaleY(1.15); opacity:1; }
        }
        @keyframes moon-glow {
          0%,100% { filter:drop-shadow(0 0 8px rgba(255,200,60,0.5)); }
          50%     { filter:drop-shadow(0 0 22px rgba(255,210,80,0.9)); }
        }
        @keyframes sun-pulse {
          0%,100% { filter:brightness(1) drop-shadow(0 0 8px rgba(255,200,0,0.5)); }
          50%     { filter:brightness(1.2) drop-shadow(0 0 20px rgba(255,220,0,0.8)); }
        }
        @keyframes wave-move {
          from { transform:translateX(0); }
          to   { transform:translateX(-50%); }
        }
        @keyframes snowman-sway {
          0%,100% { transform:rotate(-2deg) scale(1); }
          50%     { transform:rotate(2deg) scale(1.03); }
        }
        @keyframes july-cloud-drift {
          from { transform:translateX(0); }
          to   { transform:translateX(380px); }
        }
        @keyframes july-plane {
          0%   { transform:translate(0px,0px) rotate(-22deg); opacity:0; }
          7%   { opacity:0.55; }
          88%  { opacity:0.42; }
          100% { transform:translate(220px,-160px) rotate(-22deg); opacity:0; }
        }
        @keyframes banner-shine {
          0%   { background-position:0%; }
          100% { background-position:200%; }
        }
      `}</style>
      </div>
    </ThemeContext.Provider>
  )
}

