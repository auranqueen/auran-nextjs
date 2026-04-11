'use client'

import type { SupabaseClient } from '@supabase/supabase-js'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

const CARD_BG = '#0f1a1a'
const CARD_BORDER = 'rgba(60,180,140,0.3)'
const TEXT_MAIN = '#a0e8d0'
const TEXT_MUTED = 'rgba(160,232,208,0.65)'

type Scenario = 'moon' | 'fall' | 'meno' | 'male' | 'senior' | 'stress'

const KEYS: Record<Scenario, { title: string; care: string; quote: string }> = {
  moon: { title: 'moon_title', care: 'moon_care', quote: 'moon_quote' },
  fall: { title: 'fall_title', care: 'fall_care', quote: 'fall_quote' },
  meno: { title: 'meno_title', care: 'meno_care', quote: 'meno_quote' },
  male: { title: 'male_title', care: 'male_care', quote: 'male_quote' },
  senior: { title: 'senior_title', care: 'senior_care', quote: 'senior_quote' },
  stress: { title: 'stress_title', care: 'stress_care', quote: 'stress_quote' },
}

const DEFAULTS: Record<Scenario, { title: string; care: string; quote: string }> = {
  moon: {
    title: '달빛기엔 족욕이 복통 완화에 도움돼요 🛁',
    care:
      '탈라 솔트를 족욕 물에 한 스쿱. 38~40도 물에 15~20분. 생리 2~3일차 저녁 루틴 추천.',
    quote:
      '달빛기엔 몸을 따뜻하게 하는 게 최우선이에요. 족욕 후 아로마 오일로 마무리하면 숙면까지 도와줘요 🌙',
  },
  fall: {
    title: '붓기 시작되는 시기예요. 반신욕으로 미리 잡아요 🛁',
    care:
      '탈라 솔트 반신욕 주 2~3회. 욕조에 2~3스쿱. 15분. 이타카 바디 오일로 마사지하면 효과 극대화.',
    quote:
      '물들기엔 몸이 신호를 보내요. 반신욕으로 미리 다독여주면 다음 달빛기가 훨씬 편해져요 🍂',
  },
  meno: {
    title: '갱년기엔 미온수 반신욕이 열감·체취 모두 도와줘요 🛁',
    care:
      '미온수(37~38도) 반신욕 주 3회. 뜨거운 물은 열감 악화 주의. 탈라 솔트 2스쿱 + 이타카 아로마 오일 5방울.',
    quote:
      '갱년기 체취는 내 몸의 자연스러운 변화예요. 아로마 루틴으로 가볍게 관리하면 충분해요 🌿',
  },
  male: {
    title: '남성도 40대 이후 체취가 달라져요. 아로마 루틴 시작해보세요 🌿',
    care:
      '주 2회 탈라 솔트 반신욕. 샤워 후 물기 있을 때 이타카 아로마 바디 오일 바르기.',
    quote:
      '체취 관리는 청결함 그 이상이에요. 아로마 루틴 하나로 전체적인 인상이 달라져요 👨',
  },
  senior: {
    title: '주 2~3회 반신욕이 노네날 체취 억제에 직접 도움돼요 🛁',
    care:
      '노네날은 50대 이후 피부 지방산 산화로 생기는 체취 원인이에요. 탈라 솔트 + 아로마 오일 조합이 가장 효과적이에요.',
    quote:
      '노네날 체취는 관리할 수 있어요. 반신욕 루틴 하나로 확실히 달라져요 🌿',
  },
  stress: {
    title: '오늘 하루 수고했어요. 거품 목욕 어때요? 🫧',
    care: '거품 입욕제 + 이타카 아로마 오일. 따뜻한 물에 몸을 맡기는 15분.',
    quote:
      '스트레스가 쌓인 날엔 목욕이 최고의 케어예요. 향기가 마음까지 풀어줘요 🫧',
  },
}

function buildDefaultValues(): Record<string, string> {
  const o: Record<string, string> = {}
  for (const sc of Object.keys(DEFAULTS) as Scenario[]) {
    const k = KEYS[sc]
    o[k.title] = DEFAULTS[sc].title
    o[k.care] = DEFAULTS[sc].care
    o[k.quote] = DEFAULTS[sc].quote
  }
  return o
}

const ALL_KEYS = Object.values(KEYS).flatMap(k => [k.title, k.care, k.quote])

function calcKoreanAge(birthday: string | null): number | null {
  if (!birthday || !String(birthday).trim()) return null
  const d = new Date(String(birthday).slice(0, 10))
  if (Number.isNaN(d.getTime())) return null
  const t = new Date()
  let age = t.getFullYear() - d.getFullYear()
  const m = t.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && t.getDate() < d.getDate())) age -= 1
  return age
}

function isSeniorFromAgeGroup(ag: string | null): boolean {
  if (!ag || !String(ag).trim()) return false
  const s = String(ag).toLowerCase().trim()
  if (s === '50s' || s === '60s' || s === '70s' || s === '80s') return true
  if (/^5[0-9]s?$/.test(s) || /^6[0-9]s?$/.test(s) || /^7[0-9]s?$/.test(s)) return true
  if (s.includes('50') || s.includes('60') || s.includes('70')) return true
  return false
}

function isStressHigh(stress: string | null): boolean {
  if (!stress) return false
  const t = String(stress).trim()
  return t === 'high' || t === '높음' || t === '매우높음'
}

function resolveSenior(birthday: string | null, ageGroup: string | null): boolean {
  const age = calcKoreanAge(birthday)
  if (age != null && age >= 50) return true
  return isSeniorFromAgeGroup(ageGroup)
}

type BodyCareCardProps = {
  hormoneTrack: string
  cycleDay: number
  userBirthday: string | null
  userAgeGroup: string | null
  stressLevel: string | null
  showEditChrome: boolean
  supabaseClient: SupabaseClient
}

function pickScenario(
  hormoneTrack: string,
  cycleDay: number,
  isSenior: boolean,
  stress: string | null
): Scenario | null {
  const tr = String(hormoneTrack || '')
  const cd = Number(cycleDay) || 0

  if (isStressHigh(stress)) return 'stress'
  if (isSenior) return 'senior'
  if (tr === 'menopause_peri' || tr === 'menopause_post') return 'meno'
  if (tr === 'male' || tr === 'male_menopause') return 'male'
  if (cd >= 1 && cd <= 5) return 'moon'
  if (cd >= 17 && cd <= 28) return 'fall'
  return null
}

function shouldShowCard(
  hormoneTrack: string,
  cycleDay: number,
  isSenior: boolean,
  stress: string | null
): boolean {
  const tr = String(hormoneTrack || '')
  const cd = Number(cycleDay) || 0
  const moon = cd >= 1 && cd <= 5
  const fall = cd >= 17 && cd <= 28
  const meno = tr === 'menopause_peri' || tr === 'menopause_post'
  const male = tr === 'male' || tr === 'male_menopause'
  const stressH = isStressHigh(stress)
  return moon || fall || meno || male || isSenior || stressH
}

function EditableLine({
  value,
  readOnly,
  onChange,
  minH,
}: {
  value: string
  readOnly: boolean
  onChange: (v: string) => void
  minH: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    if (readOnly) {
      el.textContent = value
      return
    }
    if (document.activeElement === el) return
    el.textContent = value
  }, [value, readOnly])
  return (
    <div
      ref={ref}
      contentEditable={!readOnly}
      suppressContentEditableWarning
      onInput={e => {
        if (readOnly) return
        onChange((e.currentTarget.textContent ?? '').replace(/\u00a0/g, ' '))
      }}
      style={{
        fontSize: 12,
        fontWeight: 300,
        color: TEXT_MAIN,
        lineHeight: 1.55,
        whiteSpace: 'pre-wrap',
        wordBreak: 'keep-all',
        padding: '8px 10px',
        borderRadius: 8,
        border: readOnly ? `1px solid ${CARD_BORDER}` : '1px solid rgba(60,180,140,0.45)',
        background: readOnly ? 'rgba(60,180,140,0.06)' : 'rgba(60,180,140,0.1)',
        outline: 'none',
        minHeight: minH,
      }}
    />
  )
}

const CAUSES = [
  '아포크린샘: 땀과 피지가 섞이면서 세균이 번식해 체취 발생',
  '호르몬 변화: 에스트로겐·테스토스테론 변화로 땀 성분이 달라짐',
  '노네날: 50대 이후 피부 지방산 산화로 생기는 특유의 체취 (일반 비누로 제거 어려움)',
]

function productEmojis(sc: Scenario): string {
  if (sc === 'moon' || sc === 'fall') return '🧂탈라솔트 🫧거품입욕제 🌿이타카아로마오일'
  if (sc === 'meno' || sc === 'senior') return '🧂탈라솔트 🌿르노벨 ✨이타카아로마오일 🫧거품입욕제'
  if (sc === 'male') return '🧂탈라솔트 ✨이타카아로마오일 🌿르노벨'
  return '🫧거품입욕제 ✨이타카아로마오일'
}

export default function BodyCareCard({
  hormoneTrack,
  cycleDay,
  userBirthday,
  userAgeGroup,
  stressLevel,
  showEditChrome,
  supabaseClient,
}: BodyCareCardProps) {
  const isSenior = useMemo(
    () => resolveSenior(userBirthday, userAgeGroup),
    [userBirthday, userAgeGroup]
  )

  const visible = useMemo(
    () => shouldShowCard(hormoneTrack, cycleDay, isSenior, stressLevel),
    [hormoneTrack, cycleDay, isSenior, stressLevel]
  )

  const scenario = useMemo(
    () => (visible ? pickScenario(hormoneTrack, cycleDay, isSenior, stressLevel) : null),
    [visible, hormoneTrack, cycleDay, isSenior, stressLevel]
  )

  const [values, setValues] = useState<Record<string, string>>(buildDefaultValues)
  const [baseline, setBaseline] = useState<Record<string, string>>(() => buildDefaultValues())
  const [loaded, setLoaded] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoaded(false)
    ;(async () => {
      const base = buildDefaultValues()
      const { data, error } = await supabaseClient
        .from('admin_settings')
        .select('key,value,label')
        .eq('category', 'body_care')
      if (cancelled) return
      if (error) {
        setBaseline({ ...base })
        setValues({ ...base })
        setLoaded(true)
        return
      }
      const next: Record<string, string> = { ...base }
      for (const row of data || []) {
        const k = String((row as { key?: string }).key || '')
        const raw = (row as { value?: string; label?: string }).value ?? (row as { label?: string }).label ?? ''
        const v = String(raw).trim()
        if (k && v) next[k] = v
      }
      setBaseline({ ...next })
      setValues(next)
      setLoaded(true)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const active = scenario
  const keyTrip = active ? KEYS[active] : null
  const titleText = active && keyTrip ? values[keyTrip.title] ?? '' : ''
  const careText = active && keyTrip ? values[keyTrip.care] ?? '' : ''
  const quoteText = active && keyTrip ? values[keyTrip.quote] ?? '' : ''

  const resetScenarioToDefaults = useCallback(() => {
    if (!active) return
    const k = KEYS[active]
    const d = DEFAULTS[active]
    setValues(prev => ({
      ...prev,
      [k.title]: d.title,
      [k.care]: d.care,
      [k.quote]: d.quote,
    }))
  }, [active])

  const saveAll = useCallback(async () => {
    setSaving(true)
    try {
      for (const key of ALL_KEYS) {
        const val = values[key] ?? ''
        const { error } = await supabaseClient.from('admin_settings').upsert(
          {
            category: 'body_care',
            key,
            value: val,
            label: val,
            is_active: true,
            sort_order: 0,
          },
          { onConflict: 'category,key' }
        )
        if (error) throw error
      }
      setBaseline({ ...values })
    } finally {
      setSaving(false)
    }
  }, [supabaseClient, values])

  if (!visible || !active || !keyTrip) return null

  const sheetCareTitle = '케어 방법'
  const sheetQuoteTitle = '오랜 한마디'

  const scenarioLabel =
    active === 'moon'
      ? '달빛기'
      : active === 'fall'
        ? '물들기'
        : active === 'meno'
          ? '갱년기'
          : active === 'male'
            ? '남성'
            : active === 'senior'
              ? '50대 이상'
              : '스트레스'

  return (
    <>
      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        style={{
          display: 'block',
          width: '100%',
          textAlign: 'left',
          marginTop: 10,
          padding: '14px 14px 12px',
          borderRadius: 14,
          background: CARD_BG,
          border: `1px solid ${CARD_BORDER}`,
          boxShadow: '0 6px 20px rgba(0,0,0,0.25)',
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 600, color: TEXT_MAIN, lineHeight: 1.45, marginBottom: 8 }}>
          {titleText}
        </div>
        <div style={{ fontSize: 11, color: TEXT_MUTED, lineHeight: 1.5, marginBottom: 8 }}>
          {careText}
        </div>
        <div style={{ fontSize: 10, color: TEXT_MUTED, lineHeight: 1.5 }}>{quoteText}</div>
        <div
          style={{
            display: 'flex',
            gap: 8,
            overflowX: 'auto',
            marginTop: 10,
            paddingBottom: 2,
            WebkitOverflowScrolling: 'touch',
            fontSize: 18,
          }}
        >
          {productEmojis(active)
            .split(/\s+/)
            .filter(Boolean)
            .map((chunk, i) => (
              <span key={i} style={{ flexShrink: 0 }}>
                {chunk}
              </span>
            ))}
        </div>
        <div style={{ fontSize: 9, color: 'rgba(160,232,208,0.45)', marginTop: 8 }}>탭하면 체취 원인·케어 상세</div>
      </button>

      {sheetOpen ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9998,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
          }}
          onClick={e => {
            if (e.target === e.currentTarget) setSheetOpen(false)
          }}
          role="presentation"
        >
          <div
            style={{
              background: CARD_BG,
              borderTopLeftRadius: 18,
              borderTopRightRadius: 18,
              border: `1px solid ${CARD_BORDER}`,
              maxHeight: '88vh',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div
              style={{
                padding: '12px 14px',
                borderBottom: `1px solid ${CARD_BORDER}`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 600, color: TEXT_MAIN }}>체취 케어 가이드</span>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                style={{
                  border: `1px solid ${CARD_BORDER}`,
                  background: 'rgba(60,180,140,0.12)',
                  color: TEXT_MAIN,
                  borderRadius: 8,
                  width: 36,
                  height: 36,
                  cursor: 'pointer',
                  fontSize: 18,
                  lineHeight: 1,
                }}
                aria-label="닫기"
              >
                ×
              </button>
            </div>
            <div style={{ overflowY: 'auto', padding: '12px 14px 20px', flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: TEXT_MAIN, marginBottom: 8 }}>
                공통 체취 원인
              </div>
              {CAUSES.map((c, i) => (
                <div key={i} style={{ fontSize: 11, color: TEXT_MUTED, marginBottom: 6, lineHeight: 1.55 }}>
                  · {c}
                </div>
              ))}
              <div style={{ fontSize: 12, fontWeight: 600, color: TEXT_MAIN, margin: '14px 0 8px' }}>
                {sheetCareTitle} ({scenarioLabel})
              </div>
              <div style={{ fontSize: 11, color: TEXT_MUTED, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                {careText}
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: TEXT_MAIN, margin: '14px 0 8px' }}>
                {sheetQuoteTitle}
              </div>
              <div style={{ fontSize: 11, color: TEXT_MUTED, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                {quoteText}
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: TEXT_MAIN, margin: '14px 0 8px' }}>추천 제품</div>
              <div
                style={{
                  display: 'flex',
                  gap: 10,
                  overflowX: 'auto',
                  paddingBottom: 4,
                  WebkitOverflowScrolling: 'touch',
                  fontSize: 22,
                }}
              >
                {productEmojis(active)
                  .split(/\s+/)
                  .filter(Boolean)
                  .map((chunk, i) => (
                    <span key={i} style={{ flexShrink: 0 }}>
                      {chunk}
                    </span>
                  ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {showEditChrome ? (
        <div
          style={{
            marginTop: 10,
            padding: 12,
            borderRadius: 12,
            border: `1px dashed rgba(60,200,160,0.5)`,
            background: 'rgba(60,180,140,0.06)',
          }}
        >
          <div style={{ fontSize: 10, color: 'rgba(160,232,208,0.85)', marginBottom: 8 }}>원장 편집 · body_care</div>
          {!loaded ? (
            <div style={{ fontSize: 11, color: TEXT_MUTED }}>불러오는 중…</div>
          ) : (
            <>
              <div style={{ fontSize: 10, color: TEXT_MUTED, marginBottom: 4 }}>타이틀</div>
              <EditableLine
                minH={40}
                value={titleText}
                readOnly={false}
                onChange={v => setValues(prev => ({ ...prev, [keyTrip.title]: v }))}
              />
              <div style={{ fontSize: 10, color: TEXT_MUTED, margin: '8px 0 4px' }}>케어</div>
              <EditableLine
                minH={72}
                value={careText}
                readOnly={false}
                onChange={v => setValues(prev => ({ ...prev, [keyTrip.care]: v }))}
              />
              <div style={{ fontSize: 10, color: TEXT_MUTED, margin: '8px 0 4px' }}>원장한마디</div>
              <EditableLine
                minH={56}
                value={quoteText}
                readOnly={false}
                onChange={v => setValues(prev => ({ ...prev, [keyTrip.quote]: v }))}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={resetScenarioToDefaults}
                  style={{
                    fontSize: 11,
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: `1px solid ${CARD_BORDER}`,
                    background: 'transparent',
                    color: TEXT_MAIN,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  기본값으로
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void saveAll()}
                  style={{
                    fontSize: 11,
                    padding: '8px 14px',
                    borderRadius: 8,
                    border: `1px solid rgba(60,220,170,0.5)`,
                    background: 'rgba(60,180,140,0.2)',
                    color: TEXT_MAIN,
                    cursor: saving ? 'wait' : 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  {saving ? '저장 중…' : '저장·발행'}
                </button>
              </div>
            </>
          )}
        </div>
      ) : null}
    </>
  )
}
