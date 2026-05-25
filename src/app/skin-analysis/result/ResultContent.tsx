'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

const PRIMARY = '#7B5EA7'
const GOLD = '#C9A96E'
const BG = '#0d0b09'
const CARD_BG = 'rgba(255,255,255,0.03)'
const CARD_BORDER = '1px solid rgba(255,255,255,0.07)'
const TEXT_MUTED = 'rgba(255,255,255,0.45)'
const TEXT_DIM = 'rgba(255,255,255,0.25)'

const HORMONE_LABELS: Record<string, string> = {
  pregnant: '임신 중',
  menstrual: '생리 중',
  pre_menstrual: '생리 전',
  post_menstrual: '생리 후',
  ovulation: '만개기',
  irregular: '호르몬 불규칙',
  menopause_transition: '갱년기',
  post_menopause: '폐경 후',
  hrt: 'HRT 중',
}

const PHASES = [
  { key: 'menstrual', label: '생리' },
  { key: 'pre_menstrual', label: '생리전' },
  { key: 'ovulation', label: '만개' },
  { key: 'post_menstrual', label: '생리후' },
  { key: 'pregnant', label: '임신' },
  { key: 'menopause_transition', label: '갱년기' },
]

const DEFAULT_LIMIT: Record<string, number> = {
  PETAL: 1,
  BLOOM: 1,
  VELVET: 1,
  'LUMIÈRE': 2,
  REINE: 1,
  NOIR: 2,
  'CÉLESTE': 99,
}

type Props = {
  analysis: Record<string, unknown>
  prevAnalysis: Record<string, unknown> | null
  history: Record<string, unknown>[]
  grade: string
  settings: Record<string, string>
  products: Record<string, unknown>[]
}

function num(v: unknown, fallback = 0) {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

function diffLabel(cur: number, prev: number | null) {
  if (prev == null) return null
  const d = cur - prev
  if (d === 0) return '변화 없음'
  return `${d > 0 ? '+' : ''}${d}`
}

export default function ResultContent({ analysis, prevAnalysis, history, grade, settings, products }: Props) {
  const router = useRouter()
  const [timelineOpen, setTimelineOpen] = useState(false)

  const moisture = num(analysis.moisture_score, 55)
  const oil = num(analysis.oil_score, 40)
  const sensitivity = num(analysis.sensitivity_score, 70)
  const elasticity = num(analysis.elasticity_score, 65)
  const pigmentation = num(analysis.pigmentation_score, 25)
  const pore = num(analysis.pore_score, 40)
  const skinScore = num(analysis.skin_score, 65)
  const skinAge = num(analysis.skin_age, num(analysis.age_at_analysis, 40))
  const realAge = num(analysis.age_at_analysis, 40)
  const hormone = String(analysis.hormone_status || '')

  const analysisLimit = useMemo(() => {
    try {
      if (settings.analysis_limit) return JSON.parse(settings.analysis_limit) as Record<string, number>
    } catch {}
    return DEFAULT_LIMIT
  }, [settings.analysis_limit])

  const maxPhaseUnlocked = analysisLimit[grade] ?? DEFAULT_LIMIT[grade] ?? 1
  const phaseComment =
    settings[`phase_comment_${hormone}`] ||
    settings.phase_comment_default ||
    '오늘 피부는 수분과 장벽 밸런스를 맞추는 게 우선이에요. 자극 없는 순한 루틴으로 케어해 보세요.'

  const nextAnalysisDays = useMemo(() => {
    if (grade === 'CÉLESTE') return 0
    const weekGrades = ['REINE', 'NOIR']
    const base = weekGrades.includes(grade) ? 7 : 30
    if (hormone === 'pregnant' || hormone === 'menstrual') return Math.max(5, Math.round(base * 0.5))
    if (hormone === 'menopause_transition' || hormone === 'post_menopause') return Math.round(base * 1.2)
    return base
  }, [grade, hormone])

  const ringPct = Math.max(0, Math.min(100, Math.round((1 - Math.abs(skinAge - realAge) / 20) * 100)))

  const mainBars = [
    { name: '수분', val: moisture, color: '#6ab0e0', prev: prevAnalysis ? num(prevAnalysis.moisture_score) : null },
    { name: '유분', val: oil, color: '#e0a060', prev: prevAnalysis ? num(prevAnalysis.oil_score) : null },
    { name: '민감', val: sensitivity, color: '#e07060', prev: prevAnalysis ? num(prevAnalysis.sensitivity_score) : null },
    { name: '탄력', val: elasticity, color: GOLD, prev: prevAnalysis ? num(prevAnalysis.elasticity_score) : null },
  ]

  const handleShare = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : ''
    const text = `AURAN 피부분석 · 피부나이 ${skinAge}세 · 종합 ${skinScore}점`
    try {
      if (navigator.share) {
        await navigator.share({ title: 'AURAN 피부분석', text, url })
        return
      }
    } catch {}
    try {
      await navigator.clipboard.writeText(url || text)
      alert('링크가 복사됐어요')
    } catch {
      alert(text)
    }
  }

  return (
    <div style={{ background: BG, minHeight: '100vh', maxWidth: 390, margin: '0 auto', fontFamily: "'Noto Sans KR', sans-serif", fontWeight: 400, color: '#fff', paddingBottom: 24 }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: CARD_BORDER }}>
        <button type="button" onClick={() => router.push('/')} style={{ width: 34, height: 34, borderRadius: '50%', background: CARD_BG, border: CARD_BORDER, color: '#fff', fontSize: 18, cursor: 'pointer', fontWeight: 400 }}>‹</button>
        <span style={{ fontSize: 13, fontWeight: 400, color: 'rgba(255,255,255,0.75)' }}>분석 결과</span>
        <button type="button" onClick={() => void handleShare()} style={{ fontSize: 11, color: GOLD, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 400 }}>공유</button>
      </header>

      {hormone && (
        <div style={{ margin: '12px 16px 0', padding: '8px 12px', borderRadius: 20, background: `rgba(123,94,167,0.15)`, border: `1px solid ${PRIMARY}55`, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12 }}>🌸</span>
          <span style={{ fontSize: 11, color: 'rgba(220,200,255,0.95)', fontWeight: 400 }}>{HORMONE_LABELS[hormone] || hormone} 페이즈</span>
        </div>
      )}

      <div style={{ margin: '16px 16px 0', textAlign: 'center' }}>
        <div style={{ fontSize: 9, color: TEXT_DIM, letterSpacing: 1.2, marginBottom: 6 }}>SKIN AGE</div>
        <div style={{ position: 'relative', width: 140, height: 140, margin: '0 auto' }}>
          <svg width="140" height="140" viewBox="0 0 140 140">
            <circle cx="70" cy="70" r="58" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
            <circle
              cx="70"
              cy="70"
              r="58"
              fill="none"
              stroke={PRIMARY}
              strokeWidth="8"
              strokeDasharray={`${(ringPct / 100) * 364} 364`}
              strokeLinecap="round"
              transform="rotate(-90 70 70)"
            />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ fontSize: 32, fontWeight: 500, color: GOLD }}>{skinAge}</div>
            <div style={{ fontSize: 10, color: TEXT_MUTED }}>피부나이 · 실제 {realAge}세</div>
          </div>
        </div>
        <div style={{ marginTop: 8, fontSize: 12, color: TEXT_MUTED }}>종합 점수 <span style={{ color: GOLD, fontWeight: 500 }}>{skinScore}</span></div>
      </div>

      <div style={{ margin: '14px 16px 0', background: CARD_BG, border: CARD_BORDER, borderRadius: 16, padding: 14 }}>
        <div style={{ fontSize: 9, color: TEXT_DIM, letterSpacing: 1.2, marginBottom: 10 }}>4대 지표</div>
        {mainBars.map((b) => {
          const d = b.prev != null ? diffLabel(b.val, b.prev) : null
          return (
            <div key={b.name} style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 10, color: TEXT_DIM }}>{b.name}</span>
                <span style={{ fontSize: 10, color: b.color, fontWeight: 400 }}>
                  {b.val}%
                  {d ? <span style={{ color: TEXT_MUTED, marginLeft: 6 }}>저번 {d}</span> : null}
                </span>
              </div>
              <div style={{ height: 4, background: 'rgba(255,255,255,0.07)', borderRadius: 2 }}>
                <div style={{ height: '100%', width: `${b.val}%`, background: b.color, borderRadius: 2 }} />
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ margin: '10px 16px 0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div style={{ background: CARD_BG, border: CARD_BORDER, borderRadius: 14, padding: 12 }}>
          <div style={{ fontSize: 9, color: TEXT_DIM, marginBottom: 4 }}>색소</div>
          <div style={{ fontSize: 20, fontWeight: 500, color: '#e0c060' }}>{pigmentation}%</div>
        </div>
        <div style={{ background: CARD_BG, border: CARD_BORDER, borderRadius: 14, padding: 12 }}>
          <div style={{ fontSize: 9, color: TEXT_DIM, marginBottom: 4 }}>모공</div>
          <div style={{ fontSize: 20, fontWeight: 500, color: '#a080e0' }}>{pore}%</div>
        </div>
      </div>

      <div style={{ margin: '12px 16px 0', background: CARD_BG, border: CARD_BORDER, borderRadius: 14, padding: 12 }}>
        <div style={{ fontSize: 9, color: TEXT_DIM, marginBottom: 10 }}>호르몬 페이즈</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {PHASES.map((p, i) => {
            const locked = i >= maxPhaseUnlocked
            const active = p.key === hormone
            return (
              <div
                key={p.key}
                style={{
                  padding: '6px 10px',
                  borderRadius: 20,
                  fontSize: 10,
                  fontWeight: 400,
                  opacity: locked ? 0.35 : 1,
                  background: active ? `rgba(123,94,167,0.25)` : 'rgba(255,255,255,0.04)',
                  border: active ? `1px solid ${PRIMARY}` : CARD_BORDER,
                  color: active ? 'rgba(220,200,255,0.95)' : TEXT_MUTED,
                }}
              >
                {locked ? '🔒 ' : ''}{p.label}
              </div>
            )
          })}
        </div>
        <div style={{ fontSize: 9, color: TEXT_DIM, marginTop: 8 }}>등급 {grade} · 페이즈 {maxPhaseUnlocked}개 열람</div>
      </div>

      <div style={{ margin: '10px 16px 0', padding: 14, background: `rgba(123,94,167,0.08)`, border: `1px solid ${PRIMARY}44`, borderRadius: 14 }}>
        <div style={{ fontSize: 10, color: PRIMARY, marginBottom: 6, fontWeight: 400 }}>맑원장 코멘트</div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', lineHeight: 1.65, fontWeight: 400 }}>{phaseComment}</div>
      </div>

      <div style={{ margin: '12px 16px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 400, color: 'rgba(255,255,255,0.8)' }}>AI 맞춤 추천</span>
          <span onClick={() => router.push('/products')} style={{ fontSize: 11, color: GOLD, cursor: 'pointer' }}>전체 ›</span>
        </div>
        {products.length === 0 ? (
          <div style={{ padding: 16, textAlign: 'center', fontSize: 11, color: TEXT_DIM }}>추천 제품을 준비 중이에요</div>
        ) : (
          products.map((p, i) => {
            const brand = (p.brands as { name?: string } | null)?.name || ''
            const thumb = String(p.storage_thumb_url || p.thumb_img || '')
            return (
              <div key={String(p.id)} style={{ background: CARD_BG, border: CARD_BORDER, borderRadius: 14, padding: 12, marginBottom: 8, display: 'flex', gap: 12, alignItems: 'center' }}>
                <div style={{ width: 52, height: 52, borderRadius: 10, overflow: 'hidden', background: '#1a1510', flexShrink: 0 }}>
                  {thumb ? <img src={thumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 22, lineHeight: '52px', textAlign: 'center', display: 'block' }}>🧴</span>}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 9, color: 'rgba(201,169,110,0.7)' }}>{brand}</div>
                  <div style={{ fontSize: 13, fontWeight: 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{String(p.name || '')}</div>
                  <div style={{ fontSize: 12, color: GOLD }}>{num(p.retail_price).toLocaleString()}원</div>
                </div>
                {i === 0 ? <span style={{ fontSize: 9, color: GOLD }}>TOP</span> : null}
              </div>
            )
          })
        )}
      </div>

      <div style={{ margin: '10px 16px 0', padding: 12, background: CARD_BG, border: CARD_BORDER, borderRadius: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: TEXT_MUTED }}>다음 분석 추천</span>
        <span style={{ fontSize: 12, color: GOLD, fontWeight: 400 }}>
          {nextAnalysisDays === 0 ? '언제든 가능' : `${nextAnalysisDays}일 후`}
        </span>
      </div>

      <div style={{ margin: '10px 16px 0', display: 'flex', gap: 8 }}>
        <button type="button" onClick={() => setTimelineOpen(true)} style={{ flex: 1, padding: 12, background: CARD_BG, border: CARD_BORDER, borderRadius: 12, color: TEXT_MUTED, fontSize: 12, cursor: 'pointer', fontWeight: 400 }}>📈 타임라인</button>
        <button type="button" onClick={() => router.push('/skin-analysis')} style={{ flex: 1.2, padding: 12, background: `rgba(123,94,167,0.15)`, border: `1px solid ${PRIMARY}55`, borderRadius: 12, color: 'rgba(220,200,255,0.95)', fontSize: 12, cursor: 'pointer', fontWeight: 400 }}>🔄 다시 분석</button>
      </div>

      {timelineOpen && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={() => setTimelineOpen(false)}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 390, background: '#141210', borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: '18px 16px 24px', borderTop: `1px solid ${PRIMARY}44` }}>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 12 }}>이전 분석</div>
            {history.length === 0 ? (
              <div style={{ fontSize: 11, color: TEXT_DIM }}>이전 기록이 없어요</div>
            ) : (
              history.map((h) => (
                <div key={String(h.id)} style={{ padding: '10px 0', borderBottom: CARD_BORDER, fontSize: 11, color: TEXT_MUTED }}>
                  <div style={{ color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}>
                    {h.created_at ? new Date(String(h.created_at)).toLocaleDateString('ko-KR') : '-'}
                  </div>
                  <div>수분 {num(h.moisture_score)}% · 종합 {num(h.skin_score)} · 피부나이 {num(h.skin_age)}세</div>
                </div>
              ))
            )}
            <button type="button" onClick={() => setTimelineOpen(false)} style={{ marginTop: 12, width: '100%', padding: 12, borderRadius: 12, border: `1px solid ${GOLD}`, background: 'transparent', color: GOLD, fontSize: 12, cursor: 'pointer', fontWeight: 400 }}>닫기</button>
          </div>
        </div>
      )}
    </div>
  )
}
