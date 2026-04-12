'use client'

import { useEffect, useState } from 'react'

export interface ProductTagSectionProps {
  product: any
  weather?: any
  hormonePhase?: string
  supabaseClient?: any
  isSuperAdmin?: boolean
}

const PHASE_OPTIONS = ['달빛기', '황금기', '만개기', '물들기', '갱년기', '남성'] as const

const phaseDesc: Record<string, string> = {
  달빛기: '생리 첫날~5일차 · 몸과 피부가 쉬어가는 시기예요',
  황금기: '생리 후 6~13일차 · 피부 컨디션 최고인 시기예요',
  만개기: '배란기 14~16일차 · 에너지·피부 모두 최고조예요',
  물들기: '배란 후 17~28일차 · 붓기·예민함이 올라오는 시기예요',
  갱년기: '호르몬 변화가 큰 시기 · 피부 장벽 케어가 중요해요',
  남성: '남성 호르몬 사이클 · 피지·체취 관리가 핵심이에요',
}

const HORMONE_CHIP: Record<string, { bg: string; color: string }> = {
  달빛기: { bg: '#1a0f28', color: '#c4a8ff' },
  황금기: { bg: '#28200a', color: '#f0c060' },
  만개기: { bg: '#1a0a14', color: '#e87b9b' },
  물들기: { bg: '#1a1008', color: '#d4904a' },
  갱년기: { bg: '#0f1a14', color: '#5adb8a' },
  남성: { bg: '#0a1428', color: '#64a0dc' },
}

const CHIP_FUNC = { bg: '#1a1808', color: '#d4a84b' }
const CHIP_SKIN = { bg: '#1e1e26', color: '#9b7de8' }
const CHIP_SITUATION = { bg: '#1a1a1a', color: '#777' }
const CHIP_INGREDIENT = { bg: '#1e1e2e', color: '#7b7cc0' }

function hormoneStyleForLabel(label: string) {
  return HORMONE_CHIP[label] ?? { bg: '#1a1a20', color: '#aaa' }
}

function tagMatchesPhase(hormoneTags: string[] | undefined, phase: string): boolean {
  if (!hormoneTags?.length || !phase) return false
  return hormoneTags.some((t) => {
    const s = String(t)
    return s === phase || s.includes(phase) || phase.includes(s)
  })
}

function uvIsCaution(weather: any): boolean {
  const level = String(weather?.uv?.level ?? '')
  return level === '높음' || level === '매우높음' || level === '위험'
}

function dustIsCaution(weather: any): boolean {
  const d = String(weather?.fineDust?.level ?? weather?.dust?.level ?? '')
  return d === '나쁨' || d === '매우나쁨' || d === '위험'
}

function productWeatherTagAligned(productTags: string[] | undefined, weather: any): boolean {
  const tags = (productTags ?? []).map((t) => String(t))
  const uvRisk = uvIsCaution(weather)
  const dustRisk = dustIsCaution(weather)

  const hasAny = (pred: (t: string) => boolean) => tags.some(pred)
  const has전천후 = hasAny((t) => t.includes('전천후'))

  if (has전천후) return true

  let okUv = !uvRisk
  if (uvRisk) {
    okUv = hasAny((t) => t.includes('자외선'))
  }

  let okDust = !dustRisk
  if (dustRisk) {
    okDust = hasAny((t) => t.includes('미세') || t.includes('먼지') || t.includes('황사'))
  }

  return okUv && okDust
}

function Chip({
  label,
  bg,
  color,
}: {
  label: string
  bg: string
  color: string
}) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '5px 10px',
        borderRadius: 999,
        fontSize: 11,
        background: bg,
        color,
        margin: '0 6px 6px 0',
      }}
    >
      {label}
    </span>
  )
}

function AccordionShell({
  title,
  open,
  onToggle,
  children,
  variant,
}: {
  title: string
  open: boolean
  onToggle: () => void
  children: React.ReactNode
  variant?: 'default' | 'match'
}) {
  const shell =
    variant === 'match'
      ? {
          background: '#1a1428' as const,
          border: '1px solid rgba(123,94,167,0.3)',
        }
      : {
          background: '#1a1a20' as const,
          border: '0.5px solid rgba(255,255,255,0.07)',
        }
  return (
    <div
      style={{
        margin: '0 18px 8px',
        borderRadius: 12,
        background: shell.background,
        border: shell.border,
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: '100%',
          textAlign: 'left',
          padding: '12px 14px',
          border: 'none',
          background: 'transparent',
          color: '#e8e4dc',
          fontSize: 13,
          fontFamily: 'inherit',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span>{title}</span>
        <span style={{ color: '#888', fontSize: 12 }}>{open ? '▲' : '▼'}</span>
      </button>
      {open ? <div style={{ padding: '0 14px 14px' }}>{children}</div> : null}
    </div>
  )
}

export default function ProductTagSection({
  product,
  weather,
  hormonePhase,
  supabaseClient,
  isSuperAdmin,
}: ProductTagSectionProps) {
  const [matchOpen, setMatchOpen] = useState(false)
  const [selectedPhase, setSelectedPhase] = useState(hormonePhase || '')
  const [accOpen, setAccOpen] = useState<Record<string, boolean>>({})
  const [weatherMessages, setWeatherMessages] = useState<Record<string, string>>({})

  useEffect(() => {
    if (hormonePhase) setSelectedPhase(hormonePhase)
  }, [hormonePhase])

  useEffect(() => {
    if (!supabaseClient) return
    void supabaseClient
      .from('admin_settings')
      .select('key, value')
      .eq('category', 'weather_message')
      .then(({ data }: { data: any }) => {
        if (!data) return
        const map: Record<string, string> = {}
        data.forEach((row: any) => {
          map[row.key] = row.value
        })
        setWeatherMessages(map)
      })
  }, [supabaseClient])

  const hormoneTags = product?.hormone_tags as string[] | undefined
  const funcTags = product?.func_tags as string[] | undefined
  const stepTags = product?.step_tags as string[] | undefined
  const situationTags = product?.situation_tags as string[] | undefined
  const ingredientTags = product?.ingredient_tags as string[] | undefined
  const weatherTags = product?.weather_tags as string[] | undefined
  const skinTypes = product?.skin_types as string[] | undefined

  const hasAnyBlock =
    (hormoneTags?.length ?? 0) > 0 ||
    (funcTags?.length ?? 0) > 0 ||
    (stepTags?.length ?? 0) > 0 ||
    (situationTags?.length ?? 0) > 0 ||
    (ingredientTags?.length ?? 0) > 0

  if (!hasAnyBlock) return null

  const getWeatherMsg = () => {
    if (!weather) return null
    const uv = weather.uv?.level || ''
    const dust = weather.dust?.level || ''
    const fineDust = weather.fineDust?.level || ''

    const isDustBad =
      dust === '나쁨' || dust === '매우나쁨' ||
      fineDust === '나쁨' || fineDust === '매우나쁨'
    const isDustVeryBad =
      dust === '매우나쁨' || fineDust === '매우나쁨'

    if (isDustVeryBad)
      return weatherMessages.dust_very_bad ||
        '황사·미세먼지 매우 나빠요. 외출 자제 + 귀가 후 즉시 세안해요 🌫'
    if (isDustBad)
      return weatherMessages.dust_bad ||
        '미세먼지 많은 날은 귀가 후 이중세안이 필수예요 🌫'
    if (uv === '매우높음' || uv === '위험')
      return weatherMessages.uv_very_high ||
        '자외선 매우 강해요. 선크림 2시간마다 덧바르기 필수예요 ☀️'
    if (uv === '높음')
      return weatherMessages.uv_high ||
        '자외선 강한 날이에요. 외출 전 선크림 꼭 챙기세요 ☀️'
    return weatherMessages.uv_normal ||
      '실내에서도 선크림은 필수예요. 가벼운 선크림 하나면 충분해요 ☀️'
  }

  const weatherMsgLine = getWeatherMsg()

  const hormoneMatch = tagMatchesPhase(hormoneTags, selectedPhase)
  const showMatchBlock = (hormoneTags?.length ?? 0) > 0
  const showWeatherBlock = weather != null
  const showIngredientBlock = (ingredientTags?.length ?? 0) > 0

  const toggleAcc = (key: string) => {
    setAccOpen((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const uvCaution = weather ? uvIsCaution(weather) : false
  const dustCaution = weather ? dustIsCaution(weather) : false
  const weatherAligned = weather ? productWeatherTagAligned(weatherTags, weather) : false

  return (
    <div style={{ padding: '0 0 16px' }}>
      {showMatchBlock ? (
        <AccordionShell
          variant="match"
          title="나한테 맞는지 확인해봐요"
          open={matchOpen}
          onToggle={() => setMatchOpen((v) => !v)}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 0, marginBottom: 10 }}>
            {PHASE_OPTIONS.map((phase) => {
              const st = hormoneStyleForLabel(phase)
              const on = selectedPhase === phase
              return (
                <button
                  key={phase}
                  type="button"
                  onClick={() => setSelectedPhase(phase)}
                  style={{
                    padding: '6px 11px',
                    borderRadius: 999,
                    border: on ? `1px solid ${st.color}` : '1px solid rgba(255,255,255,0.12)',
                    background: st.bg,
                    color: st.color,
                    fontSize: 11,
                    fontFamily: 'inherit',
                    cursor: 'pointer',
                    margin: '0 6px 6px 0',
                  }}
                >
                  {phase}
                </button>
              )
            })}
          </div>
          {selectedPhase ? (
            <div
              style={{
                padding: '12px 12px',
                borderRadius: 14,
                background: hormoneMatch ? '#0f1a14' : '#1a0f0a',
                border: hormoneMatch ? '1px solid rgba(90,219,138,0.35)' : '1px solid rgba(232,123,74,0.35)',
              }}
            >
              {hormoneMatch ? (
                <div style={{ color: '#5adb8a', fontSize: 13, lineHeight: 1.5 }}>
                  <span style={{ marginRight: 6 }}>✓</span>
                  {`${selectedPhase}인 지금 딱 맞는 제품이에요`}
                </div>
              ) : (
                <div style={{ color: '#e87b4a', fontSize: 13, lineHeight: 1.5 }}>
                  <span style={{ marginRight: 6 }}>!</span>
                  {`${selectedPhase}엔 사용에 주의가 필요해요`}
                </div>
              )}
              {phaseDesc[selectedPhase] ? (
                <div
                  style={{
                    marginTop: 6,
                    fontSize: 10,
                    color: 'rgba(255,255,255,0.35)',
                    lineHeight: 1.5,
                    padding: '0 2px',
                  }}
                >
                  {phaseDesc[selectedPhase]}
                </div>
              ) : null}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: '#888' }}>호르몬 단계를 선택하면 매칭 결과를 볼 수 있어요.</div>
          )}
        </AccordionShell>
      ) : null}

      <AccordionShell
        title="이런 분께 추천해요"
        open={!!accOpen.recommend}
        onToggle={() => toggleAcc('recommend')}
      >
        {(hormoneTags?.length ?? 0) > 0 ? (
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10, color: '#888', marginBottom: 6 }}>호르몬 · 단계</div>
            <div>
              {hormoneTags!.map((t) => {
                const st = hormoneStyleForLabel(String(t))
                return <Chip key={t} label={String(t)} bg={st.bg} color={st.color} />
              })}
            </div>
          </div>
        ) : null}
        {(skinTypes?.length ?? 0) > 0 ? (
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10, color: '#888', marginBottom: 6 }}>피부 타입</div>
            <div>
              {skinTypes!.map((t) => (
                <Chip key={t} label={String(t)} bg={CHIP_SKIN.bg} color={CHIP_SKIN.color} />
              ))}
            </div>
          </div>
        ) : null}
        {(funcTags?.length ?? 0) > 0 ? (
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10, color: '#888', marginBottom: 6 }}>기능</div>
            <div>
              {funcTags!.map((t) => (
                <Chip key={t} label={String(t)} bg={CHIP_FUNC.bg} color={CHIP_FUNC.color} />
              ))}
            </div>
          </div>
        ) : null}
        {(situationTags?.length ?? 0) > 0 ? (
          <div>
            <div style={{ fontSize: 10, color: '#888', marginBottom: 6 }}>상황</div>
            <div>
              {situationTags!.map((t) => (
                <Chip key={t} label={String(t)} bg={CHIP_SITUATION.bg} color={CHIP_SITUATION.color} />
              ))}
            </div>
          </div>
        ) : null}
      </AccordionShell>

      {showIngredientBlock ? (
        <AccordionShell title="주요 성분" open={!!accOpen.ingredients} onToggle={() => toggleAcc('ingredients')}>
          <div>
            {ingredientTags!.map((t) => (
              <Chip key={t} label={String(t)} bg={CHIP_INGREDIENT.bg} color={CHIP_INGREDIENT.color} />
            ))}
          </div>
        </AccordionShell>
      ) : null}
    </div>
  )
}
