'use client'

import type { SupabaseClient } from '@supabase/supabase-js'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

const THEME_BORDER = 'rgba(123, 94, 167, 0.35)'
const THEME_BG = 'rgba(123, 94, 167, 0.12)'

const TAB_DEFS = [
  { id: 'moon' as const, emoji: '🌙', name: '달빛기', color: '#c4a8ff', subtitle: '(생리기) · 1~5일차' },
  { id: 'gold' as const, emoji: '✨', name: '황금기', color: '#f0c060', subtitle: '(여포기) · 6~13일차' },
  { id: 'bloom' as const, emoji: '🌸', name: '만개기', color: '#e87b9b', subtitle: '(배란기) · 14~16일차' },
  { id: 'fall' as const, emoji: '🍂', name: '물들기', color: '#d4904a', subtitle: '(황체기) · 17~28일차' },
  { id: 'meno' as const, emoji: '🌿', name: '갱년기', color: '#5adb8a', subtitle: '(폐경기)' },
  { id: 'male' as const, emoji: '👨', name: '남성', color: '#64a0dc', subtitle: '' },
]

/** calcHormoneBriefing.phase 등 → 탭 인덱스 */
function phaseToTabIndex(phase: string): number {
  const p = String(phase || '')
  if (p.includes('달빛')) return 0
  if (p.includes('황금')) return 1
  if (p.includes('만개')) return 2
  if (p.includes('물들')) return 3
  if (p.includes('폐경') || p.includes('갱년') || p.includes('불규칙')) return 4
  if (p.includes('남성')) return 5
  return 0
}

const DEFAULTS_BY_KEY: Record<string, string> = {
  moon_body:
    '에스트로겐·프로게스테론 모두 최저점. 자궁 수축으로 복통·허리통증이 올 수 있어요. 피부 장벽이 얇아지고 붉어지기 쉬워요.',
  moon_care:
    '향료·알코올·레티놀·AHA 고농도는 잠시 쉬어가기. 무자극 세라마이드 크림으로 장벽 보호해주세요.',
  moon_quote: '오늘은 쉬어도 괜찮아요. 피부도 몸도 리셋 중이에요 🌙',
  gold_body:
    '에스트로겐 빠르게 상승. 몸이 가벼워지고 에너지·집중력 올라와요. 콜라겐 합성 활발해지고 피부 수분·탄력 최고조.',
  gold_care: '미백 앰플·영양 크림 집중 투입 타이밍. 흡수력 최고라 고기능 제품 효과 극대화돼요.',
  gold_quote: '지금이 바로 피부에 투자할 타이밍이에요 ✨',
  bloom_body:
    'LH 호르몬 급증으로 배란 발생. 체온 살짝 상승. 에너지·자신감 최고조. 피지 분비 늘어나기 시작해요.',
  bloom_care: '피지·모공 관리 집중. 가벼운 텍스처 제품으로 교체 추천해요.',
  bloom_fertility:
    '💕 가임 가능성이 높은 시기예요. 임신을 계획 중이시라면 지금이 좋은 타이밍, 피임 중이시라면 이 시기 특히 신경 써주세요.',
  bloom_quote: '활짝 피었어요! 오늘 가장 빛나는 날이에요 🌸',
  fall_body:
    '프로게스테론 우세해지면서 붓기·피지과다·트러블이 슬슬 올라와요. 세로토닌 감소로 감정 기복·예민함·식욕 증가.',
  fall_care: '진정·보습 위주로 전환. 트러블 예방 위해 모공 케어 미리 시작. 자극적인 음식 줄이기.',
  fall_quote: '몸이 신호를 보내고 있어요. 미리 다독여줄 시간이에요 🍂',
  meno_body:
    '에스트로겐 급감으로 콜라겐 빠르게 소실. 열감·홍조·극건성·수면 방해·감정 기복. FSH 급증으로 열감·홍조 반복.',
  meno_care:
    '세라마이드·히알루론산 집중 보충. 펩타이드·콜라겐 앰플 선제 투입. 냉장 미스트로 열감 진정. 야간 집중 보습 루틴 필수.',
  meno_quote: '내 몸이 새로운 리듬을 찾는 중이에요. 진정과 보습으로 함께 다독여요 🌿',
  male_body: '테스토스테론 30대 후반부터 매년 1~2%씩 감소. 피지 성분 변화, 모공 축소, 피부 건조해짐.',
  male_care: '수분·장벽 케어 집중. 저자극 제품 위주. 면도 후 진정 케어 필수.',
  male_quote: '피부 케어는 나이와 상관없어요. 지금 시작해도 충분해요 👨',
}

const ALL_KEYS = Object.keys(DEFAULTS_BY_KEY)

function keysForTab(tabId: (typeof TAB_DEFS)[number]['id']): string[] {
  if (tabId === 'bloom') return ['bloom_body', 'bloom_care', 'bloom_fertility', 'bloom_quote']
  const p = tabId
  return [`${p}_body`, `${p}_care`, `${p}_quote`]
}

const LABELS: Record<string, string> = {
  body: '몸의변화',
  care: '케어포인트',
  fertility: '가임기안내',
  quote: '오랜한마디',
}

const PHASE_EXTRA_COPY: Record<string, { body: string; care: string; quote: string }> = {
  moon: {
    body: '프로게스테론·에스트로겐이 모두 낮아요. 피부 장벽이 약하고 예민한 시기예요. 트러블이 나기 쉽고 홍조나 건조함이 생길 수 있어요.',
    care: '자극적인 성분은 잠깐 쉬어가요. 저자극 클렌징과 진정 앰플로 장벽을 지켜주세요. 마사지나 필링은 이 시기엔 피해요.',
    quote: '달빛기엔 피부한테 쉬어가는 시간을 줘요. 자극 줄이고 진정에만 집중해요 💜',
  },
  gold: {
    body: '에스트로겐이 상승하면서 피부 장벽이 강해지고 흡수력이 최고조에 달해요. 피부가 맑아지고 탄력이 올라오는 시기예요.',
    care: '지금 쓰는 앰플·세럼이 평소보다 2배 효과예요. 미백·탄력 집중 케어 타이밍이에요. 흡수가 잘 되니 레이어링도 좋아요.',
    quote: '황금기예요! 지금 앰플 꼭 챙기세요. 1년 중 가장 피부가 빛나는 시기예요 ✨',
  },
  bloom: {
    body: 'LH 호르몬 급증으로 배란 발생. 체온이 살짝 상승하고 에너지·자신감 최고조. 피지 분비가 늘어나기 시작해요.',
    care: '피지·모공 관리 집중. 가벼운 텍스처 제품으로 교체 추천해요. 무거운 크림보다 젤 타입이 좋아요.',
    quote: '활짝 피었어요! 오늘 가장 빛나는 날이에요. 피지 관리만 잘 해줘요 🌸',
  },
  fall: {
    body: '프로게스테론이 증가하면서 피부가 건조해지고 트러블이 생기기 쉬워요. 예민함이 올라오고 부기가 나타날 수 있어요.',
    care: '수분 보충을 집중적으로 해줘요. 보습 레이어링이 핵심이에요. 자극 성분은 줄이고 진정 케어를 병행해요.',
    quote: '물들기엔 수분 레이어링이 답이에요. 토너·에센스·크림 순서 꼭 지켜줘요 💧',
  },
  meno: {
    body: '에스트로겐 감소로 피부 장벽이 얇아지고 건조함이 심해져요. 탄력 저하, 색소침착, 민감도 증가가 함께 올 수 있어요.',
    care: '영양 크림과 탄력 앰플을 함께 써줘요. 장벽 강화 성분(세라마이드·펩타이드)이 도움돼요. 선케어는 필수예요.',
    quote: '갱년기 피부는 부지런한 케어가 차이를 만들어요. 매일 꾸준히가 가장 중요해요 💜',
  },
}

function HormonePhaseEditable({
  value,
  readOnly,
  onChange,
  isDirty,
  showEditChrome,
  previewMode,
  minHeight,
}: {
  value: string
  readOnly: boolean
  onChange: (v: string) => void
  isDirty: boolean
  showEditChrome: boolean
  previewMode: boolean
  minHeight: number
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
        fontSize: 13,
        fontWeight: 300,
        color: '#f3ecff',
        lineHeight: 1.55,
        whiteSpace: 'pre-wrap',
        wordBreak: 'keep-all',
        padding: '10px 12px',
        borderRadius: 10,
        border:
          showEditChrome && !previewMode
            ? isDirty
              ? '1px solid rgba(168, 130, 220, 0.65)'
              : `1px solid ${THEME_BORDER}`
            : `1px solid rgba(123,94,167,0.2)`,
        background:
          showEditChrome && !previewMode && isDirty ? 'rgba(168, 130, 220, 0.08)' : 'rgba(123,94,167,0.06)',
        outline: 'none',
        minHeight,
      }}
    />
  )
}

type HormoneSheetProps = {
  isOpen: boolean
  onClose: () => void
  currentPhase: string
  cycleDay: number
  showEditChrome: boolean
  supabaseClient: SupabaseClient
  products?: any[]
}

export default function HormoneSheet({
  isOpen,
  onClose,
  currentPhase,
  cycleDay,
  showEditChrome,
  supabaseClient,
  products = [],
}: HormoneSheetProps) {
  const [activeTab, setActiveTab] = useState(0)
  const [values, setValues] = useState<Record<string, string>>(() => ({ ...DEFAULTS_BY_KEY }))
  const [baseline, setBaseline] = useState<Record<string, string>>(() => ({ ...DEFAULTS_BY_KEY }))
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [previewMode, setPreviewMode] = useState(false)

  const tabId = TAB_DEFS[activeTab]?.id ?? 'moon'

  useEffect(() => {
    if (!isOpen) return
    setActiveTab(phaseToTabIndex(currentPhase))
  }, [isOpen, currentPhase])

  useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    setLoaded(false)
    ;(async () => {
      const { data, error } = await supabaseClient
        .from('admin_settings')
        .select('key,value,label')
        .eq('category', 'hormone_phase')
      if (cancelled || error) {
        if (!cancelled) {
          setBaseline({ ...DEFAULTS_BY_KEY })
          setValues({ ...DEFAULTS_BY_KEY })
          setLoaded(true)
        }
        return
      }
      const next: Record<string, string> = { ...DEFAULTS_BY_KEY }
      for (const row of data || []) {
        const k = String((row as { key?: string }).key || '')
        const raw = (row as { value?: string; label?: string }).value ?? (row as { label?: string }).label ?? ''
        const v = String(raw).trim()
        if (k && v) next[k] = v
      }
      if (!cancelled) {
        setBaseline({ ...next })
        setValues(next)
        setLoaded(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) setPreviewMode(false)
  }, [isOpen])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  const dirtyKeys = useMemo(() => {
    const d = new Set<string>()
    for (const k of ALL_KEYS) {
      if ((values[k] ?? '') !== (baseline[k] ?? '')) d.add(k)
    }
    return d
  }, [values, baseline])

  const resetTabToDefaults = useCallback(() => {
    setValues(prev => {
      const next = { ...prev }
      for (const k of keysForTab(tabId)) {
        next[k] = DEFAULTS_BY_KEY[k] ?? ''
      }
      return next
    })
  }, [tabId])

  const saveAll = useCallback(async () => {
    setSaving(true)
    try {
      for (const key of ALL_KEYS) {
        const val = values[key] ?? ''
        const { error } = await supabaseClient.from('admin_settings').upsert(
          {
            category: 'hormone_phase',
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

  if (!isOpen) return null

  const accent = TAB_DEFS[activeTab]?.color ?? '#c4a8ff'
  const phaseProducts = (products ?? []).filter((p: any) => {
    const ht = p?.hormone_timing
    if (Array.isArray(ht)) return ht.some((v: any) => String(v).includes(tabId))
    if (typeof ht === 'string') return ht.includes(tabId)
    return false
  }).slice(0, 6)

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        background: 'rgba(0,0,0,0.55)',
      }}
      onClick={e => {
        if (e.target === e.currentTarget) onClose()
      }}
      role="presentation"
    >
      <div
        style={{
          background: '#17171e',
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          border: `1px solid ${THEME_BORDER}`,
          boxShadow: '0 -12px 40px rgba(0,0,0,0.45)',
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div
          style={{
            padding: '14px 16px 10px',
            borderBottom: `1px solid ${THEME_BORDER}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#f3ecff', letterSpacing: '-0.02em' }}>
              호르몬 단계 안내
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>
              {TAB_DEFS[activeTab]?.emoji} {TAB_DEFS[activeTab]?.name}
              {cycleDay > 0 ? ` · ${cycleDay}일차` : ''}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              flexShrink: 0,
              width: 36,
              height: 36,
              borderRadius: 10,
              border: `1px solid ${THEME_BORDER}`,
              background: THEME_BG,
              color: '#e8e0f5',
              fontSize: 18,
              lineHeight: 1,
              cursor: 'pointer',
            }}
            aria-label="닫기"
          >
            ×
          </button>
        </div>

        <div
          style={{
            display: 'flex',
            gap: 8,
            padding: '10px 12px',
            overflowX: 'auto',
            borderBottom: `1px solid rgba(123,94,167,0.2)`,
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {TAB_DEFS.map((t, i) => {
            const on = i === activeTab
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(i)}
                style={{
                  flexShrink: 0,
                  padding: '8px 12px',
                  borderRadius: 999,
                  border: on ? `1px solid ${t.color}` : '1px solid rgba(255,255,255,0.12)',
                  background: on ? `${t.color}22` : 'rgba(255,255,255,0.04)',
                  color: on ? t.color : 'rgba(255,255,255,0.65)',
                  fontSize: 12,
                  fontWeight: on ? 600 : 400,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {t.emoji} {t.name}
              </button>
            )
          })}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px 16px' }}>
          {!loaded ? (
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, textAlign: 'center', padding: 24 }}>
              불러오는 중…
            </div>
          ) : (
            <>
              <div style={{ fontSize: 12, color: accent, marginBottom: 12, fontWeight: 500 }}>
                {TAB_DEFS[activeTab]?.name}{' '}
                <span style={{ color: 'rgba(255,255,255,0.45)', fontWeight: 400 }}>
                  {TAB_DEFS[activeTab]?.subtitle}
                </span>
              </div>

              {keysForTab(tabId).map(fieldKey => {
                const short = fieldKey.replace(/^(moon|gold|bloom|fall|meno|male)_/, '')
                const label = LABELS[short] || short
                const text = values[fieldKey] ?? ''
                const isDirty = dirtyKeys.has(fieldKey)
                const readOnly = !showEditChrome || previewMode

                return (
                  <div key={fieldKey} style={{ marginBottom: 16 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        marginBottom: 6,
                      }}
                    >
                      <span style={{ fontSize: 11, color: 'rgba(196,170,230,0.85)', fontWeight: 500 }}>{label}</span>
                      {showEditChrome && !previewMode ? (
                        <button
                          type="button"
                          onClick={() =>
                            setValues(prev => ({
                              ...prev,
                              [fieldKey]: DEFAULTS_BY_KEY[fieldKey] ?? '',
                            }))
                          }
                          style={{
                            fontSize: 10,
                            padding: '4px 8px',
                            borderRadius: 6,
                            border: `1px solid rgba(168,130,220,0.45)`,
                            background: 'rgba(123,94,167,0.15)',
                            color: '#e0d4ff',
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                          }}
                        >
                          기본값으로
                        </button>
                      ) : null}
                    </div>
                    <HormonePhaseEditable
                      value={text}
                      readOnly={readOnly}
                      onChange={v => setValues(prev => ({ ...prev, [fieldKey]: v }))}
                      isDirty={isDirty}
                      showEditChrome={showEditChrome}
                      previewMode={previewMode}
                      minHeight={short === 'body' ? 72 : 56}
                    />
                  </div>
                )
              })}
              {PHASE_EXTRA_COPY[tabId] ? (
                <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '11px 13px' }}>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: 4 }}>몸의 변화</div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', lineHeight: 1.65 }}>{PHASE_EXTRA_COPY[tabId].body}</div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '11px 13px' }}>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: 4 }}>케어 포인트</div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', lineHeight: 1.65 }}>{PHASE_EXTRA_COPY[tabId].care}</div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '11px 13px' }}>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: 4 }}>오랜 한마디</div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', lineHeight: 1.65 }}>{PHASE_EXTRA_COPY[tabId].quote}</div>
                  </div>
                </div>
              ) : null}
              {phaseProducts.length > 0 ? (
                <div
                  style={{
                    display: 'flex',
                    overflowX: 'auto',
                    gap: 8,
                    paddingBottom: 4,
                    scrollbarWidth: 'none',
                    marginTop: 12,
                  }}
                  className="scroll-hide"
                >
                  {phaseProducts.map((p: any, i: number) => {
                    const thumb = p.storage_thumb_url || p.thumb_img
                    const brandName = p.brands?.name || p.brand || ''
                    const price = p.retail_price ?? p.sale_price
                    return (
                      <div
                        key={p.id ?? i}
                        style={{
                          minWidth: 110,
                          flexShrink: 0,
                          background: 'rgba(255,255,255,0.04)',
                          border: '0.5px solid rgba(255,255,255,0.07)',
                          borderRadius: 12,
                          overflow: 'hidden',
                          cursor: 'pointer',
                        }}
                      >
                        <div
                          style={{
                            aspectRatio: '1',
                            background: 'rgba(255,255,255,0.03)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {thumb ? (
                            <img src={thumb} alt={p.name || ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : null}
                        </div>
                        <div style={{ padding: '8px 10px 10px' }}>
                          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>{brandName}</div>
                          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)', lineHeight: 1.35 }}>{p.name}</div>
                          <div style={{ fontSize: 12, color: '#C9A96E', marginTop: 4 }}>
                            {price != null ? `${Number(price).toLocaleString()}원` : ''}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : null}
            </>
          )}
        </div>

        {showEditChrome ? (
          <div
            style={{
              padding: '12px 16px 18px',
              borderTop: `1px solid ${THEME_BORDER}`,
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
              justifyContent: 'flex-end',
              alignItems: 'center',
              background: 'rgba(0,0,0,0.25)',
            }}
          >
            <button
              type="button"
              onClick={resetTabToDefaults}
              style={{
                marginRight: 'auto',
                fontSize: 12,
                padding: '10px 14px',
                borderRadius: 10,
                border: `1px solid rgba(168,130,220,0.4)`,
                background: 'transparent',
                color: '#d8ccf5',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              이 탭 기본값으로
            </button>
            <button
              type="button"
              onClick={() => setPreviewMode(p => !p)}
              style={{
                fontSize: 12,
                padding: '10px 14px',
                borderRadius: 10,
                border: `1px solid ${THEME_BORDER}`,
                background: previewMode ? THEME_BG : 'transparent',
                color: '#f0e8ff',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              미리보기
            </button>
            <button
              type="button"
              disabled={saving || !loaded}
              onClick={() => void saveAll()}
              style={{
                fontSize: 12,
                padding: '10px 16px',
                borderRadius: 10,
                border: `1px solid ${accent}`,
                background: `${accent}33`,
                color: '#fff',
                cursor: saving ? 'wait' : 'pointer',
                fontFamily: 'inherit',
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? '저장 중…' : '저장·발행'}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
