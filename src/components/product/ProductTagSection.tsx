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

const getHormoneMatchMsg = (
  customerPhase: string,
  productTags: string[]
): { match: boolean; title: string; sub: string } => {
  const hasAll = productTags.includes('전연령')
  if (hasAll) return {
    match: true,
    title: '모든 호르몬 단계에 사용 가능한 제품이에요 💜',
    sub: '언제 써도 좋아요!',
  }
  const isMatch = productTags.includes(customerPhase)
  if (isMatch) {
    const matchMsgs: Record<string, { title: string; sub: string }> = {
      달빛기: { title: '지금이 바로 이 제품 쓸 타이밍이에요 🌙', sub: '달빛기엔 자극 없는 순한 성분이 피부를 가장 잘 달래줘요' },
      황금기: { title: '지금이 바로 이 제품 쓸 타이밍이에요 ✨', sub: '황금기엔 흡수력이 최고라 효과가 극대화돼요!' },
      만개기: { title: '지금이 딱이에요 🌸', sub: '만개기엔 피부가 가장 빛나는 시기 이 제품으로 광채 극대화해요!' },
      물들기: { title: '지금 쓰기 딱 좋아요 🍂', sub: '물들기 붓기·예민함 잡는데 이 제품이 도움돼요' },
      갱년기: { title: '갱년기 피부를 위해 고른 제품이에요 🌿', sub: '꾸준히 쓸수록 효과가 좋아요' },
      남성: { title: '남성 전용 제품이에요 👨 딱이에요!', sub: '남성 피부에 맞게 특별히 설계된 제품이에요' },
    }
    return { match: true, ...(matchMsgs[customerPhase] || { title: '지금 쓰기 좋은 제품이에요 💜', sub: '내 피부 단계에 잘 맞아요' }) }
  }

  if (customerPhase === '갱년기') return {
    match: true,
    title: '갱년기 피부에도 잘 맞는 제품이에요 🌿',
    sub: '피부 장벽 케어와 함께 쓰면 더 좋아요!',
  }

  if (customerPhase === '남성') return {
    match: true,
    title: '남성도 사용 가능한 제품이에요 👨',
    sub: '피부 고민에 맞게 써보세요!',
  }

  const mismatchMsgs: Record<string, Record<string, { title: string; sub: string }>> = {
    달빛기: {
      황금기: { title: '황금기(생리 후 6~13일차)에 쓰면 효과가 극대화돼요 ✨', sub: '지금 담아두고 황금기에 써보세요!' },
      만개기: { title: '만개기(14~16일차) 배란기에 써보세요 🌸', sub: '에너지·피부 최고조일 때 효과가 2배예요!' },
      물들기: { title: '물들기(17~28일차)에 더 잘 맞는 제품이에요 🍂', sub: '붓기·예민함 올라올 때 지금 담아두세요!' },
    },
    황금기: {
      달빛기: { title: '달빛기(생리 중 1~5일차)에 더 잘 맞는 제품이에요 🌙', sub: '그때 쓰면 피부가 고마워해요' },
      만개기: { title: '만개기(14~16일차)에 함께 써보세요 🌸', sub: '배란기 피부 광채 극대화에 좋아요!' },
      물들기: { title: '물들기(17~28일차)에 써보세요 🍂', sub: '황체기 붓기·예민함 케어에 딱이에요!' },
    },
    만개기: {
      달빛기: { title: '달빛기(생리 중 1~5일차)에 더 잘 맞아요 🌙', sub: '지금 담아두고 그때 써보세요!' },
      황금기: { title: '황금기(6~13일차)에도 잘 맞는 제품이에요 ✨', sub: '지금 써도 좋고 황금기에 쓰면 더 좋아요!' },
      물들기: { title: '물들기(17~28일차)에 써보세요 🍂', sub: '배란 후 붓기·예민함 케어에 도움돼요' },
    },
    물들기: {
      달빛기: { title: '달빛기(생리 중)에 더 잘 맞는 제품이에요 🌙', sub: '다음 생리 시작 때 써보세요!' },
      황금기: { title: '다음 황금기(6~13일차)에 써보세요 ✨', sub: '피부 흡수력 최고인 시기에 효과가 극대화돼요!' },
      만개기: { title: '다음 만개기(14~16일차)에 써보세요 🌸', sub: '배란기 피부 최고조일 때 빛이 나요!' },
    },
  }

  const customerMsgs = mismatchMsgs[customerPhase]
  if (customerMsgs) {
    const firstProductTag = productTags.find(t =>
      ['달빛기', '황금기', '만개기', '물들기'].includes(t)
    )
    const msg = firstProductTag
      ? customerMsgs[firstProductTag]
      : null
    if (msg) return { match: false, ...msg }
  }

  return {
    match: true,
    title: '사용 가능한 제품이에요 💜',
    sub: '담아두고 최적 시기에 써보세요!',
  }
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
          {selectedPhase ? (() => {
            const matchResult = getHormoneMatchMsg(selectedPhase, hormoneTags ?? [])
            return (
            <div
              style={{
                padding: '12px 12px',
                borderRadius: 14,
                background: matchResult.match ? '#0f1a14' : '#1a0f0a',
                border: matchResult.match ? '1px solid rgba(90,219,138,0.35)' : '1px solid rgba(232,123,74,0.35)',
              }}
            >
              {matchResult.match ? (
                <div style={{ color: '#5adb8a', fontSize: 13, lineHeight: 1.5 }}>
                  <span style={{ marginRight: 6 }}>✓</span>
                  {matchResult.title}
                </div>
              ) : (
                <div style={{ color: '#e87b4a', fontSize: 13, lineHeight: 1.5 }}>
                  <span style={{ marginRight: 6 }}>!</span>
                  {matchResult.title}
                </div>
              )}
              {matchResult.sub ? (
                <div
                  style={{
                    marginTop: 4,
                    fontSize: 11,
                    color: 'rgba(255,255,255,0.5)',
                    lineHeight: 1.5,
                  }}
                >
                  {matchResult.sub}
                </div>
              ) : null}
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
            )
          })() : (
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
