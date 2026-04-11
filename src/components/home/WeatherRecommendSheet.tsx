'use client'

import type { SupabaseClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'

const BG = '#17171e'
const CARD_BG = '#1e1e26'
const ROUTINE_BG = '#1e1e26'
const REASON_BOX = '#16141e'
const REASON_BORDER = '#5a4a9a'
const BTN_Q = '#2a2040'
const BTN_Q_FG = '#9b7de8'
const TAG_WEATHER_BG = 'rgba(240,160,96,0.12)'
const TAG_WEATHER_FG = '#f0a060'
const TAG_SKIN_BG = 'rgba(155,125,232,0.12)'
const TAG_SKIN_FG = '#9b7de8'

const HORMONE_PHASE_COLORS: Record<string, string> = {
  달빛기: '#c4a8ff',
  황금기: '#f0c060',
  만개기: '#e87b9b',
  물들기: '#d4904a',
  갱년기: '#5adb8a',
  남성: '#64a0dc',
}

const WEATHER_FORM_OPTIONS = ['자외선높음', '자외선매우높음', '미세먼지나쁨', '황사', '일교차큼', '건조', '전체'] as const
const HORMONE_FORM_OPTIONS = ['달빛기', '황금기', '만개기', '물들기', '갱년기', '남성', '전체'] as const
const SKIN_FORM_OPTIONS = ['건성', '지성', '복합', '민감', '중성', '전체'] as const

type WeatherShape = {
  temp: number
  humidity: number
  condition: string
  uv: { value: number; level: string }
  dust: { value: number; level: string }
  fineDust: { value: number; level: string }
}

type MappingRow = {
  id: string
  concern_tag?: string | null
  weather_tags?: string[] | null
  hormone_tags?: string[] | null
  skin_tags?: string[] | null
  reason_text?: string | null
  products: {
    id: string
    name: string
    retail_price?: number | null
    sale_price?: number | null
    thumb_img?: string | null
    storage_thumb_url?: string | null
    tag?: string | null
    skin_types?: string[] | null
    is_exclusive?: boolean | null
  } | null
}

function phaseLabelFromTrackAndDay(hormoneTrack: string, cycleDay: number): string | null {
  const tr = String(hormoneTrack || '')
  if (tr === 'menopause_peri' || tr === 'menopause_post') return '갱년기'
  if (tr === 'male' || tr === 'male_menopause') return '남성'
  if (tr !== 'general') return null
  const cd = Number(cycleDay) || 0
  if (cd >= 1 && cd <= 5) return '달빛기'
  if (cd >= 6 && cd <= 13) return '황금기'
  if (cd >= 14 && cd <= 16) return '만개기'
  if (cd >= 17 && cd <= 28) return '물들기'
  return null
}

function uvIsHigh(level: string | undefined): boolean {
  const l = String(level || '')
  return l === '높음' || l === '매우높음' || l === '위험'
}

function dustIsBad(level: string | undefined): boolean {
  const l = String(level || '')
  return l === '나쁨' || l === '매우나쁨'
}

function displayPrice(p: { retail_price?: number | null; sale_price?: number | null }): number {
  const sale = p.sale_price != null ? Number(p.sale_price) : null
  const retail = Number(p.retail_price ?? 0)
  if (sale != null && !Number.isNaN(sale) && sale > 0) return sale
  return retail
}

function scoreProduct(
  p: NonNullable<MappingRow['products']>,
  opts: { uvHigh: boolean; dustBad: boolean; skinType: string }
): number {
  let score = 0
  const tag = String(p.tag || '').toLowerCase()
  if (opts.uvHigh && (tag.includes('자외선') || tag.includes('선케어'))) score += 3
  if (opts.dustBad && (tag.includes('진정') || tag.includes('클렌징'))) score += 3
  const st = opts.skinType.trim().toLowerCase()
  if (st) {
    const arr = Array.isArray(p.skin_types) ? p.skin_types : []
    const hit = arr.some(x => String(x).toLowerCase() === st || String(x).toLowerCase().includes(st) || st.includes(String(x).toLowerCase()))
    if (hit) score += 3
  }
  return score
}

function pickRotatedThree(sorted: MappingRow[]): MappingRow[] {
  const pool = sorted.filter(r => r.products)
  const n = pool.length
  if (n === 0) return []
  if (n < 3) return pool
  const numSets = Math.max(1, Math.floor(n / 3))
  const today = new Date().getDate()
  const setIdx = today % numSets
  const start = setIdx * 3
  return pool.slice(start, start + 3)
}

function toggleInList(list: string[], v: string): string[] {
  if (list.includes(v)) return list.filter(x => x !== v)
  return [...list, v]
}

export type WeatherRecommendSheetProps = {
  isOpen: boolean
  onClose: () => void
  weather: WeatherShape | null
  skinType: string
  hormoneTrack: string
  cycleDay: number
  supabaseClient: SupabaseClient
  showEditChrome?: boolean
}

export default function WeatherRecommendSheet({
  isOpen,
  onClose,
  weather,
  skinType,
  hormoneTrack,
  cycleDay,
  supabaseClient,
  showEditChrome = false,
}: WeatherRecommendSheetProps) {
  const router = useRouter()
  const [rows, setRows] = useState<MappingRow[]>([])
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<'three' | 'routine'>('three')
  const [openReasonId, setOpenReasonId] = useState<string | null>(null)

  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formWeather, setFormWeather] = useState<string[]>([])
  const [formHormone, setFormHormone] = useState<string[]>([])
  const [formSkin, setFormSkin] = useState<string[]>([])
  const [reasonText, setReasonText] = useState('')
  const [pickProduct, setPickProduct] = useState<MappingRow['products'] | null>(null)
  const [searchQ, setSearchQ] = useState('')
  const [searchResults, setSearchResults] = useState<MappingRow['products'][]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const phaseLabel = useMemo(() => phaseLabelFromTrackAndDay(hormoneTrack, cycleDay), [hormoneTrack, cycleDay])

  const uvHigh = weather ? uvIsHigh(weather.uv?.level) : false
  const dustBad =
    weather &&
    (dustIsBad(weather.dust?.level) || dustIsBad(weather.fineDust?.level))

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabaseClient
        .from('weather_product_mapping')
        .select('*, products(*)')
        .eq('is_active', true)
        .order('priority', { ascending: true })
        .limit(20)
      if (error) {
        setRows([])
        return
      }
      const list = (data || []) as MappingRow[]
      const scored = [...list].sort((a, b) => {
        const pa = a.products
        const pb = b.products
        if (!pa && !pb) return 0
        if (!pa) return 1
        if (!pb) return -1
        const sa = scoreProduct(pa, {
          uvHigh,
          dustBad: !!dustBad,
          skinType: skinType || '',
        })
        const sb = scoreProduct(pb, {
          uvHigh,
          dustBad: !!dustBad,
          skinType: skinType || '',
        })
        return sb - sa
      })
      setRows(scored)
    } finally {
      setLoading(false)
    }
  }, [supabaseClient, uvHigh, dustBad, skinType])

  useEffect(() => {
    if (!isOpen) return
    void load()
  }, [isOpen, load])

  useEffect(() => {
    const q = searchQ.trim()
    if (q.length < 2) {
      setSearchResults([])
      return
    }
    let cancelled = false
    const t = setTimeout(() => {
      void (async () => {
        setSearchLoading(true)
        const { data } = await supabaseClient
          .from('products')
          .select('id, name, retail_price, sale_price, storage_thumb_url, thumb_img, tag')
          .ilike('name', `%${q.slice(0, 80)}%`)
          .eq('is_active', true)
          .limit(15)
        if (!cancelled) {
          setSearchResults((data as MappingRow['products'][]) || [])
          setSearchLoading(false)
        }
      })()
    }, 280)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [searchQ, supabaseClient])

  const displayThree = useMemo(() => pickRotatedThree(rows), [rows])

  const weatherTags = useMemo(() => {
    const tags: string[] = []
    if (!weather) return tags
    if (uvIsHigh(weather.uv?.level)) {
      tags.push(`자외선 ${weather.uv.level}`)
    }
    if (dustIsBad(weather.dust?.level)) {
      tags.push(`미세먼지 ${weather.dust.level}`)
    }
    if (dustIsBad(weather.fineDust?.level)) {
      tags.push(`초미세 ${weather.fineDust.level}`)
    }
    return tags
  }, [weather])

  const hormoneColor = phaseLabel ? HORMONE_PHASE_COLORS[phaseLabel] ?? '#9b7de8' : '#888'

  const buildReasonLines = (product: NonNullable<MappingRow['products']>) => {
    const lines: string[] = []
    if (uvHigh) lines.push('자외선 강한 날 피부 장벽 보호에 추천해요')
    if (dustBad) lines.push('미세먼지 많은 날 진정 케어에 도움돼요')
    if (phaseLabel === '달빛기') lines.push('달빛기엔 자극 없는 순한 성분이 중요해요')
    if (phaseLabel === '황금기') lines.push('황금기엔 고기능 성분 흡수력이 최고예요')
    const st = skinType.trim()
    if (st === '건성') lines.push('건성 피부 수분 보충에 맞게 골랐어요')
    if (st === '지성') lines.push('지성 피부 피지 밸런스에 맞게 골랐어요')
    if (lines.length === 0) {
      lines.push(`${product.name}은(는) 오늘 조건에 맞춰 추천했어요`)
    }
    return lines
  }

  const openAddForm = () => {
    setEditingId(null)
    setFormWeather([])
    setFormHormone([])
    setFormSkin([])
    setReasonText('')
    setPickProduct(null)
    setSearchQ('')
    setSearchResults([])
    setFormOpen(true)
  }

  const openEditRow = (row: MappingRow) => {
    setEditingId(row.id)
    setFormWeather(Array.isArray(row.weather_tags) ? [...row.weather_tags] : [])
    setFormHormone(Array.isArray(row.hormone_tags) ? [...row.hormone_tags] : [])
    setFormSkin(Array.isArray(row.skin_tags) ? [...row.skin_tags] : [])
    setReasonText(row.reason_text ?? '')
    setPickProduct(row.products)
    setSearchQ('')
    setSearchResults([])
    setFormOpen(true)
  }

  const saveMapping = async () => {
    if (!pickProduct?.id) return
    const wt = formWeather.length ? formWeather : ['전체']
    const ht = formHormone.length ? formHormone : ['전체']
    const sk = formSkin.length ? formSkin : ['전체']
    setSaving(true)
    try {
      if (editingId) {
        const { error } = await supabaseClient
          .from('weather_product_mapping')
          .update({
            weather_tags: wt,
            hormone_tags: ht,
            skin_tags: sk,
            season_tags: [],
            product_id: pickProduct.id,
            reason_text: reasonText.trim(),
          })
          .eq('id', editingId)
        if (error) throw error
      } else {
        const { error } = await supabaseClient.from('weather_product_mapping').insert({
          weather_tags: wt,
          hormone_tags: ht,
          skin_tags: sk,
          season_tags: [],
          product_id: pickProduct.id,
          reason_text: reasonText.trim(),
          priority: 0,
          is_active: true,
        })
        if (error) throw error
      }
      setFormOpen(false)
      setEditingId(null)
      await load()
    } finally {
      setSaving(false)
    }
  }

  const deleteRow = async (id: string) => {
    if (!confirm('이 매핑을 삭제할까요?')) return
    const { error } = await supabaseClient.from('weather_product_mapping').delete().eq('id', id)
    if (error) return
    await load()
  }

  if (!isOpen) return null

  const chipBtn = (label: string, active: boolean, onClick: () => void) => (
    <button
      key={label}
      type="button"
      onClick={onClick}
      style={{
        fontSize: 10,
        padding: '5px 8px',
        borderRadius: 8,
        border: active ? '1px solid rgba(155,125,232,0.55)' : '1px solid rgba(255,255,255,0.12)',
        background: active ? 'rgba(155,125,232,0.18)' : 'rgba(0,0,0,0.25)',
        color: active ? '#e8e0ff' : 'rgba(255,255,255,0.55)',
        cursor: 'pointer',
        fontFamily: 'inherit',
      }}
    >
      {label}
    </button>
  )

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        background: 'rgba(0,0,0,0.85)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        backdropFilter: 'blur(6px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 480,
          background: BG,
          borderRadius: '28px 28px 0 0',
          maxHeight: '88vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0' }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.15)' }} />
        </div>

        <div style={{ padding: '0 18px 12px', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 16, color: '#fff', marginBottom: 4 }}>
                {weather?.condition ?? '☀️'} 오늘 날씨 맞춤 케어
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>
                {weather
                  ? `${weather.temp}° · 습도 ${weather.humidity}% · 자외선 ${weather.uv?.level ?? '-'} · 미세 ${weather.dust?.level ?? '-'}`
                  : '날씨 정보를 불러오는 중이에요'}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.45)', fontSize: 22, cursor: 'pointer', lineHeight: 1 }}
            >
              ×
            </button>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            {weatherTags.map(t => (
              <span
                key={t}
                style={{
                  fontSize: 10,
                  padding: '4px 8px',
                  borderRadius: 8,
                  background: TAG_WEATHER_BG,
                  color: TAG_WEATHER_FG,
                  fontWeight: 500,
                }}
              >
                {t}
              </span>
            ))}
            {skinType.trim() ? (
              <span
                style={{
                  fontSize: 10,
                  padding: '4px 8px',
                  borderRadius: 8,
                  background: TAG_SKIN_BG,
                  color: TAG_SKIN_FG,
                  fontWeight: 500,
                }}
              >
                {skinType.trim()}
              </span>
            ) : null}
            {phaseLabel ? (
              <span
                style={{
                  fontSize: 10,
                  padding: '4px 8px',
                  borderRadius: 8,
                  background: `${hormoneColor}22`,
                  color: hormoneColor,
                  fontWeight: 500,
                }}
              >
                {phaseLabel}
              </span>
            ) : null}
          </div>

          {showEditChrome ? (
            <button
              type="button"
              onClick={openAddForm}
              style={{
                marginBottom: 10,
                fontSize: 11,
                padding: '6px 12px',
                borderRadius: 8,
                border: '1px dashed rgba(155,125,232,0.5)',
                background: 'rgba(30,24,48,0.35)',
                color: '#c4b8f0',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              + 매핑 추가
            </button>
          ) : null}

          {showEditChrome && formOpen ? (
            <div
              style={{
                position: 'fixed',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                zIndex: 9999,
                width: '90%',
                maxWidth: 480,
                maxHeight: '80vh',
                overflowY: 'auto',
                background: '#17171e',
                borderRadius: 16,
                border: '1px solid rgba(123,94,167,0.4)',
                padding: 16,
              }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', marginBottom: 6 }}>날씨 조건 (복수)</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                {WEATHER_FORM_OPTIONS.map(o =>
                  chipBtn(o, formWeather.includes(o), () => setFormWeather(toggleInList(formWeather, o)))
                )}
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', marginBottom: 6 }}>호르몬 단계 (복수)</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                {HORMONE_FORM_OPTIONS.map(o =>
                  chipBtn(o, formHormone.includes(o), () => setFormHormone(toggleInList(formHormone, o)))
                )}
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', marginBottom: 6 }}>피부 타입 (복수)</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                {SKIN_FORM_OPTIONS.map(o => chipBtn(o, formSkin.includes(o), () => setFormSkin(toggleInList(formSkin, o))))}
              </div>
              <input
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
                placeholder="제품명 검색 (2자 이상)"
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: 8,
                  border: '1px solid rgba(255,255,255,0.12)',
                  background: '#14141a',
                  color: '#fff',
                  fontSize: 12,
                  marginBottom: 6,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              {searchLoading ? <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: 6 }}>검색 중…</div> : null}
              <div style={{ maxHeight: 120, overflowY: 'auto', marginBottom: 8 }}>
                {searchResults.map(sp => (
                  <button
                    key={sp!.id}
                    type="button"
                    onClick={() => setPickProduct(sp)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      width: '100%',
                      padding: 6,
                      marginBottom: 4,
                      borderRadius: 8,
                      border: pickProduct?.id === sp!.id ? '1px solid rgba(155,125,232,0.55)' : '1px solid transparent',
                      background: pickProduct?.id === sp!.id ? 'rgba(155,125,232,0.12)' : 'transparent',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      textAlign: 'left',
                    }}
                  >
                    <div style={{ width: 36, height: 36, borderRadius: 6, overflow: 'hidden', background: 'rgba(255,255,255,0.06)', flexShrink: 0 }}>
                      {sp!.storage_thumb_url || sp!.thumb_img ? (
                        <img src={sp!.storage_thumb_url || sp!.thumb_img || ''} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : null}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sp!.name}</div>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>₩{displayPrice(sp!).toLocaleString()}</div>
                    </div>
                  </button>
                ))}
              </div>
              <textarea
                value={reasonText}
                onChange={e => setReasonText(e.target.value)}
                placeholder="추천 이유 (? 버튼에 표시)"
                rows={3}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: 8,
                  border: '1px solid rgba(255,255,255,0.12)',
                  background: '#14141a',
                  color: '#fff',
                  fontSize: 12,
                  marginBottom: 8,
                  resize: 'vertical',
                  fontFamily: 'inherit',
                  boxSizing: 'border-box',
                }}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  disabled={saving || !pickProduct}
                  onClick={() => void saveMapping()}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: 'none',
                    background: pickProduct ? 'rgba(123,108,192,0.45)' : 'rgba(255,255,255,0.1)',
                    color: '#fff',
                    fontSize: 12,
                    cursor: pickProduct && !saving ? 'pointer' : 'not-allowed',
                    fontFamily: 'inherit',
                  }}
                >
                  {saving ? '저장 중…' : editingId ? '수정 저장' : '저장'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFormOpen(false)
                    setEditingId(null)
                  }}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: '1px solid rgba(255,255,255,0.15)',
                    background: 'transparent',
                    color: 'rgba(255,255,255,0.55)',
                    fontSize: 12,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  취소
                </button>
              </div>
            </div>
          ) : null}

          <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
            <button
              type="button"
              onClick={() => setTab('three')}
              style={{
                flex: 1,
                padding: '8px 10px',
                borderRadius: 10,
                border: tab === 'three' ? '1px solid rgba(155,125,232,0.5)' : '1px solid rgba(255,255,255,0.08)',
                background: tab === 'three' ? 'rgba(155,125,232,0.12)' : 'transparent',
                color: tab === 'three' ? '#e8e0ff' : 'rgba(255,255,255,0.45)',
                fontSize: 12,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              오랜의 3선
            </button>
            <button
              type="button"
              onClick={() => setTab('routine')}
              style={{
                flex: 1,
                padding: '8px 10px',
                borderRadius: 10,
                border: tab === 'routine' ? '1px solid rgba(155,125,232,0.5)' : '1px solid rgba(255,255,255,0.08)',
                background: tab === 'routine' ? 'rgba(155,125,232,0.12)' : 'transparent',
                color: tab === 'routine' ? '#e8e0ff' : 'rgba(255,255,255,0.45)',
                fontSize: 12,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              단계별 루틴
            </button>
          </div>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, padding: '0 18px 28px' }}>
          {tab === 'three' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {loading ? (
                <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.35)', fontSize: 13, padding: '32px 0' }}>불러오는 중…</div>
              ) : displayThree.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.35)', fontSize: 13, padding: '32px 0' }}>
                  오늘 맞춤 제품을 준비 중이에요
                </div>
              ) : (
                displayThree.map(row => {
                  const p = row.products!
                  const thumb = p.storage_thumb_url || p.thumb_img || ''
                  const rid = String(row.id)
                  const open = openReasonId === rid
                  const sub =
                    row.weather_tags?.length || row.hormone_tags?.length
                      ? [...(row.weather_tags || []).slice(0, 2), ...(row.hormone_tags || []).slice(0, 1)].join(' · ')
                      : row.concern_tag || ''
                  return (
                    <div
                      key={rid}
                      style={{
                        position: 'relative',
                        background: CARD_BG,
                        borderRadius: 14,
                        padding: 12,
                        display: 'flex',
                        gap: 12,
                        alignItems: 'flex-start',
                        border: showEditChrome ? '1px dashed rgba(155,125,232,0.4)' : undefined,
                      }}
                    >
                      {showEditChrome ? (
                        <div style={{ position: 'absolute', top: 6, right: 6, display: 'flex', gap: 4, zIndex: 3 }} onClick={e => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => openEditRow(row)}
                            style={{
                              fontSize: 9,
                              padding: '2px 6px',
                              borderRadius: 4,
                              border: '1px solid rgba(123,108,192,0.5)',
                              background: 'rgba(30,24,48,0.9)',
                              color: '#c4b8f0',
                              cursor: 'pointer',
                              fontFamily: 'inherit',
                            }}
                          >
                            수정
                          </button>
                          <button
                            type="button"
                            onClick={() => void deleteRow(row.id)}
                            style={{
                              fontSize: 9,
                              padding: '2px 6px',
                              borderRadius: 4,
                              border: '1px solid rgba(220,80,80,0.45)',
                              background: 'rgba(40,20,20,0.85)',
                              color: '#f0a0a0',
                              cursor: 'pointer',
                              fontFamily: 'inherit',
                            }}
                          >
                            삭제
                          </button>
                        </div>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => router.push(`/products/${p.id}`)}
                        style={{
                          display: 'flex',
                          gap: 12,
                          alignItems: 'center',
                          flex: 1,
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          cursor: 'pointer',
                          textAlign: 'left',
                          fontFamily: 'inherit',
                        }}
                      >
                        <div
                          style={{
                            width: 60,
                            height: 60,
                            borderRadius: 12,
                            overflow: 'hidden',
                            background: 'rgba(255,255,255,0.04)',
                            flexShrink: 0,
                          }}
                        >
                          {thumb ? (
                            <img src={thumb} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>🧴</div>
                          )}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          {sub ? (
                            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.38)', marginBottom: 4 }}>{sub}</div>
                          ) : null}
                          <div
                            style={{
                              fontSize: 13,
                              color: '#fff',
                              lineHeight: 1.4,
                              marginBottom: 6,
                              overflow: 'hidden',
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                            }}
                          >
                            {p.name}
                          </div>
                          <div style={{ fontSize: 13, color: '#c9a96e' }}>₩{displayPrice(p).toLocaleString()}</div>
                        </div>
                      </button>
                      <button
                        type="button"
                        title="추천 이유"
                        onClick={e => {
                          e.stopPropagation()
                          setOpenReasonId(open ? null : rid)
                        }}
                        style={{
                          position: 'absolute',
                          right: 10,
                          bottom: 10,
                          width: 26,
                          height: 26,
                          borderRadius: 8,
                          border: `1px solid ${BTN_Q_FG}`,
                          background: BTN_Q,
                          color: BTN_Q_FG,
                          fontSize: 13,
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                          lineHeight: 1,
                        }}
                      >
                        ?
                      </button>
                      {open ? (
                        <div
                          style={{
                            position: 'absolute',
                            left: 12,
                            right: 12,
                            bottom: 44,
                            background: REASON_BOX,
                            borderLeft: `3px solid ${REASON_BORDER}`,
                            borderRadius: 8,
                            padding: '10px 12px',
                            fontSize: 11,
                            color: 'rgba(255,255,255,0.82)',
                            lineHeight: 1.55,
                            boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
                          }}
                        >
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                            {weatherTags.slice(0, 2).map(t => (
                              <span key={t} style={{ fontSize: 9, padding: '2px 6px', borderRadius: 6, background: TAG_WEATHER_BG, color: TAG_WEATHER_FG }}>
                                {t}
                              </span>
                            ))}
                            {skinType.trim() ? (
                              <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 6, background: TAG_SKIN_BG, color: TAG_SKIN_FG }}>{skinType.trim()}</span>
                            ) : null}
                            {phaseLabel ? (
                              <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 6, background: `${hormoneColor}33`, color: hormoneColor }}>
                                {phaseLabel}
                              </span>
                            ) : null}
                          </div>
                          {row.reason_text?.trim()
                            ? row.reason_text.split('\n').map((line, i) => <div key={i}>· {line}</div>)
                            : buildReasonLines(p).map((line, i) => (
                                <div key={i}>· {line}</div>
                              ))}
                        </div>
                      ) : null}
                    </div>
                  )
                })
              )}
            </div>
          ) : (
            <RoutinePanel
              uvHigh={uvHigh}
              dustBad={!!dustBad}
              phaseLabel={phaseLabel}
              routineBg={ROUTINE_BG}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function RoutinePanel({
  uvHigh,
  dustBad,
  phaseLabel,
  routineBg,
}: {
  uvHigh: boolean
  dustBad: boolean
  phaseLabel: string | null
  routineBg: string
}) {
  const steps: { label: string; badge?: string }[] = [
    { label: '클렌징', badge: dustBad ? '오늘 필수' : undefined },
    { label: '토너' },
    { label: '딥클렌징(주1~2회)' },
    {
      label: '앰플·세럼',
      badge: phaseLabel === '달빛기' ? '주의' : undefined,
    },
    { label: '크림' },
    { label: '선크림', badge: uvHigh ? '☀ 오늘 필수' : undefined },
  ]

  return (
    <div
      style={{
        background: routineBg,
        borderRadius: 14,
        padding: '14px 14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      {steps.map((s, i) => (
        <div
          key={s.label}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            padding: '10px 12px',
            borderRadius: 10,
            background: 'rgba(0,0,0,0.2)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <div style={{ fontSize: 13, color: '#fff', fontWeight: 400 }}>
            {i + 1}. {s.label}
          </div>
          {s.badge ? (
            <span
              style={{
                fontSize: 10,
                padding: '3px 8px',
                borderRadius: 8,
                background: 'rgba(240,160,96,0.15)',
                color: '#f0a060',
                whiteSpace: 'nowrap',
              }}
            >
              {s.badge}
            </span>
          ) : (
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>—</span>
          )}
        </div>
      ))}
    </div>
  )
}
