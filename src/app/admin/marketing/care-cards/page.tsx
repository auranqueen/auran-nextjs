'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type BodyCareCardRow = {
  id: string
  phase_tags: string[] | null
  category_tags: string[] | null
  title: string
  care: string
  quote: string
  product_ids: string[] | null
  sort_order: number
  is_active: boolean
  created_at?: string
  updated_at?: string
}

type ProductPick = { id: string; name: string }

const TRACKS = ['general', 'female', 'male', 'menopause'] as const
const PHASES = ['all', '달빛기', '황금기', '만개기', '물들기'] as const
const SKINS = ['all', '건성', '지성', '복합', '민감'] as const
const CONCERNS = ['all', '트러블', '홍조', '건조', '색소'] as const
const ZONES = ['face', 'body', 'scalp', 'inner'] as const

const TRACK_LABEL: Record<string, string> = {
  general: 'general',
  female: 'female',
  male: 'male',
  menopause: 'menopause',
}

const ZONE_LABEL: Record<string, string> = {
  face: 'face',
  body: 'body',
  scalp: 'scalp',
  inner: 'inner',
}

function parseCategoryMeta(tags: string[] | null | undefined) {
  const list = Array.isArray(tags) ? tags : []
  let track: (typeof TRACKS)[number] = 'general'
  let skin: (typeof SKINS)[number] = 'all'
  let concern: (typeof CONCERNS)[number] = 'all'
  let zone: (typeof ZONES)[number] = 'body'
  const rest: string[] = []
  for (const x of list) {
    if (x.startsWith('_track:')) {
      const v = x.slice(7) as (typeof TRACKS)[number]
      if ((TRACKS as readonly string[]).includes(v)) track = v
    } else if (x.startsWith('_skin:')) {
      const raw = x.slice(6)
      if ((SKINS as readonly string[]).includes(raw)) skin = raw as (typeof SKINS)[number]
    } else if (x.startsWith('_concern:')) {
      const raw = x.slice(9)
      if ((CONCERNS as readonly string[]).includes(raw)) concern = raw as (typeof CONCERNS)[number]
    } else if (x.startsWith('_zone:')) {
      const raw = x.slice(6)
      if ((ZONES as readonly string[]).includes(raw)) zone = raw as (typeof ZONES)[number]
    } else rest.push(x)
  }
  return { track, skin, concern, zone, rest }
}

function buildCategoryTags(
  rest: string[],
  track: string,
  skin: string,
  concern: string,
  zone: string
): string[] {
  const meta = [`_track:${track}`, `_skin:${skin}`, `_concern:${concern}`, `_zone:${zone}`]
  const cleaned = rest.filter(
    t =>
      !t.startsWith('_track:') &&
      !t.startsWith('_skin:') &&
      !t.startsWith('_concern:') &&
      !t.startsWith('_zone:')
  )
  return [...meta, ...cleaned]
}

function phaseSingleFromRow(row: BodyCareCardRow): (typeof PHASES)[number] {
  const tags = Array.isArray(row.phase_tags) ? row.phase_tags : []
  if (tags.includes('all')) return 'all'
  for (const p of PHASES) {
    if (p !== 'all' && tags.includes(p)) return p
  }
  return 'all'
}

function rowToDraft(row: BodyCareCardRow): Draft {
  const meta = parseCategoryMeta(row.category_tags)
  return {
    id: row.id,
    title: row.title ?? '',
    track: meta.track,
    phase: phaseSingleFromRow(row),
    skin_type: meta.skin,
    skin_concern: meta.concern,
    category: meta.zone,
    care: row.care ?? '',
    quote: row.quote ?? '',
    is_active: row.is_active,
    product_ids: Array.isArray(row.product_ids) ? row.product_ids.filter(Boolean) : [],
    extra_category_tags: meta.rest,
  }
}

function emptyDraft(): Draft {
  return {
    id: null,
    title: '',
    track: 'general',
    phase: 'all',
    skin_type: 'all',
    skin_concern: 'all',
    category: 'body',
    care: '',
    quote: '',
    is_active: true,
    product_ids: [],
    extra_category_tags: [],
  }
}

type Draft = {
  id: string | null
  title: string
  track: (typeof TRACKS)[number]
  phase: (typeof PHASES)[number]
  skin_type: (typeof SKINS)[number]
  skin_concern: (typeof CONCERNS)[number]
  category: (typeof ZONES)[number]
  care: string
  quote: string
  is_active: boolean
  product_ids: string[]
  extra_category_tags: string[]
}

const inp: React.CSSProperties = {
  width: '100%',
  padding: '9px 11px',
  borderRadius: 8,
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)',
  color: '#fff',
  fontSize: 13,
  boxSizing: 'border-box',
  colorScheme: 'dark',
}

const lbl = (t: string) => (
  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 5 }}>{t}</div>
)

export default function AdminCareCardsPage() {
  const supabase = createClient()
  const [rows, setRows] = useState<BodyCareCardRow[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedKey, setExpandedKey] = useState<string | 'new' | null>(null)
  const [draft, setDraft] = useState<Draft>(emptyDraft())
  const [saving, setSaving] = useState(false)
  const [pq, setPq] = useState('')
  const [picks, setPicks] = useState<ProductPick[]>([])
  const [productMeta, setProductMeta] = useState<Record<string, string>>({})

  const loadRows = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from('body_care_cards').select('*').order('sort_order', { ascending: true })
    if (!error && data) setRows(data as BodyCareCardRow[])
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    void loadRows()
  }, [loadRows])

  const loadMeta = useCallback(
    async (ids: string[]) => {
      const uniq = Array.from(new Set(ids.filter(Boolean)))
      if (uniq.length === 0) {
        setProductMeta({})
        return
      }
      const { data } = await supabase.from('products').select('id, name, clean_name').in('id', uniq)
      const m: Record<string, string> = {}
      for (const r of data || []) {
        const p = r as ProductPick & { clean_name?: string | null }
        m[p.id] = p.clean_name || p.name
      }
      setProductMeta(m)
    },
    [supabase]
  )

  useEffect(() => {
    if (!expandedKey) return
    void loadMeta(draft.product_ids)
  }, [expandedKey, draft.product_ids, loadMeta])

  useEffect(() => {
    const q = pq.trim()
    if (q.length < 1) {
      setPicks([])
      return
    }
    const t = setTimeout(() => {
      void supabase
        .from('products')
        .select('id, name, clean_name')
        .ilike('name', `%${q.slice(0, 80)}%`)
        .eq('is_active', true)
        .limit(15)
        .then(({ data }) => setPicks((data as ProductPick[]) || []))
    }, 220)
    return () => clearTimeout(t)
  }, [pq, supabase])

  const openRow = (row: BodyCareCardRow) => {
    if (expandedKey === row.id) {
      setExpandedKey(null)
      return
    }
    setExpandedKey(row.id)
    setDraft(rowToDraft(row))
    setPq('')
    setPicks([])
  }

  const openNew = () => {
    if (expandedKey === 'new') {
      setExpandedKey(null)
      return
    }
    setExpandedKey('new')
    setDraft(emptyDraft())
    setPq('')
    setPicks([])
  }

  const phaseTagsPayload = (phase: (typeof PHASES)[number]): string[] => {
    if (phase === 'all') return ['all']
    return [phase]
  }

  const save = async () => {
    setSaving(true)
    try {
      const category_tags = buildCategoryTags(
        draft.extra_category_tags,
        draft.track,
        draft.skin_type,
        draft.skin_concern,
        draft.category
      )
      const payload = {
        title: draft.title.trim(),
        phase_tags: phaseTagsPayload(draft.phase),
        category: draft.category,
        category_tags,
        care: draft.care,
        quote: draft.quote,
        product_ids: draft.product_ids,
        is_active: draft.is_active,
        updated_at: new Date().toISOString(),
      }
      if (expandedKey === 'new' || !draft.id) {
        const maxSort = rows.reduce((m, r) => Math.max(m, r.sort_order ?? 0), 0)
        const { error } = await supabase.from('body_care_cards').insert({
          ...payload,
          sort_order: maxSort + 1,
        } as any)
        if (error) {
          alert(error.message)
          return
        }
      } else {
        const { error } = await supabase.from('body_care_cards').update(payload as any).eq('id', draft.id)
        if (error) {
          alert(error.message)
          return
        }
      }
      await loadRows()
      setExpandedKey(null)
      setDraft(emptyDraft())
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!draft.id) return
    if (!window.confirm('이 카드를 삭제할까요?')) return
    const { error } = await supabase.from('body_care_cards').delete().eq('id', draft.id)
    if (error) {
      alert(error.message)
      return
    }
    await loadRows()
    setExpandedKey(null)
    setDraft(emptyDraft())
  }

  const addProduct = (p: ProductPick) => {
    if (draft.product_ids.includes(p.id)) return
    setDraft(prev => ({ ...prev, product_ids: [...prev.product_ids, p.id] }))
    setProductMeta(prev => ({ ...prev, [p.id]: (p as ProductPick & { clean_name?: string | null }).clean_name || p.name }))
    setPq('')
    setPicks([])
  }

  const removeProduct = (id: string) => {
    setDraft(prev => ({ ...prev, product_ids: prev.product_ids.filter(x => x !== id) }))
  }

  const cellStyle: React.CSSProperties = {
    padding: '10px 12px',
    fontSize: 12,
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    color: 'rgba(255,255,255,0.88)',
    verticalAlign: 'middle',
  }

  return (
    <div style={{ maxWidth: 1200 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>케어카드 관리</div>
          <div style={{ fontSize: 11, color: 'var(--text3)' }}>body_care_cards · track/피부 메타는 category_tags 접두사로 저장</div>
        </div>
        <button
          type="button"
          onClick={openNew}
          style={{
            padding: '10px 16px',
            borderRadius: 9,
            border: '1px solid rgba(201,168,76,0.35)',
            background: 'rgba(201,168,76,0.12)',
            color: '#e8d4a0',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          + 새 카드 추가
        </button>
      </div>

      {loading ? (
        <div style={{ color: 'var(--text3)', fontSize: 13 }}>불러오는 중…</div>
      ) : (
        <div
          style={{
            borderRadius: 12,
            border: '1px solid var(--border)',
            background: 'var(--bg2)',
            overflow: 'hidden',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                {['제목', 'track', 'phase_tags', 'skin_type', 'skin_concern', 'category', '제품수', 'is_active'].map(
                  h => (
                    <th
                      key={h}
                      style={{
                        ...cellStyle,
                        textAlign: 'left',
                        fontSize: 10,
                        color: 'var(--text3)',
                        fontFamily: "'JetBrains Mono', monospace",
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                      }}
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {expandedKey === 'new' ? (
                <tr>
                  <td colSpan={8} style={{ padding: 0, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    <div style={{ padding: 18, background: 'rgba(0,0,0,0.2)' }}>
                      <DraftForm
                        draft={draft}
                        setDraft={setDraft}
                        pq={pq}
                        setPq={setPq}
                        picks={picks}
                        productMeta={productMeta}
                        onAddProduct={addProduct}
                        onRemoveProduct={removeProduct}
                        onSave={save}
                        onDelete={remove}
                        saving={saving}
                        isNew
                      />
                    </div>
                  </td>
                </tr>
              ) : null}
              {rows.map(row => {
                const meta = parseCategoryMeta(row.category_tags)
                const phaseStr = (Array.isArray(row.phase_tags) ? row.phase_tags : []).join(', ') || '—'
                const isOpen = expandedKey === row.id
                return (
                  <React.Fragment key={row.id}>
                    <tr
                      onClick={() => openRow(row)}
                      style={{
                        cursor: 'pointer',
                        background: isOpen ? 'rgba(201,168,76,0.06)' : 'transparent',
                      }}
                    >
                      <td style={cellStyle}>{row.title || '—'}</td>
                      <td style={{ ...cellStyle, fontFamily: 'monospace', fontSize: 11 }}>{TRACK_LABEL[meta.track]}</td>
                      <td style={{ ...cellStyle, fontSize: 11, color: 'rgba(255,255,255,0.65)' }}>{phaseStr}</td>
                      <td style={cellStyle}>{meta.skin}</td>
                      <td style={cellStyle}>{meta.concern}</td>
                      <td style={{ ...cellStyle, fontFamily: 'monospace', fontSize: 11 }}>{ZONE_LABEL[meta.zone]}</td>
                      <td style={cellStyle}>{(row.product_ids || []).length}</td>
                      <td style={cellStyle}>{row.is_active ? '✓' : '—'}</td>
                    </tr>
                    {isOpen ? (
                      <tr>
                        <td colSpan={8} style={{ padding: 0, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                          <div style={{ padding: 18, background: 'rgba(0,0,0,0.25)' }}>
                            <DraftForm
                              draft={draft}
                              setDraft={setDraft}
                              pq={pq}
                              setPq={setPq}
                              picks={picks}
                              productMeta={productMeta}
                              onAddProduct={addProduct}
                              onRemoveProduct={removeProduct}
                              onSave={save}
                              onDelete={remove}
                              saving={saving}
                              isNew={false}
                            />
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
          {rows.length === 0 && expandedKey !== 'new' ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>등록된 카드가 없습니다.</div>
          ) : null}
        </div>
      )}
    </div>
  )
}

function DraftForm({
  draft,
  setDraft,
  pq,
  setPq,
  picks,
  productMeta,
  onAddProduct,
  onRemoveProduct,
  onSave,
  onDelete,
  saving,
  isNew,
}: {
  draft: Draft
  setDraft: React.Dispatch<React.SetStateAction<Draft>>
  pq: string
  setPq: (s: string) => void
  picks: ProductPick[]
  productMeta: Record<string, string>
  onAddProduct: (p: ProductPick) => void
  onRemoveProduct: (id: string) => void
  onSave: () => void
  onDelete: () => void
  saving: boolean
  isNew: boolean
}) {
  const sel = (value: string, onChange: (v: string) => void, options: { v: string; l: string }[]) => (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{ ...inp, cursor: 'pointer' }}
    >
      {options.map(o => (
        <option key={o.v} value={o.v}>
          {o.l}
        </option>
      ))}
    </select>
  )

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div>
          {lbl('제목')}
          <input
            value={draft.title}
            onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
            style={inp}
            placeholder="카드 제목"
          />
        </div>
        <div>
          {lbl('track')}
          {sel(
            draft.track,
            v => setDraft(d => ({ ...d, track: v as Draft['track'] })),
            TRACKS.map(t => ({ v: t, l: t }))
          )}
        </div>
        <div>
          {lbl('phase')}
          {sel(
            draft.phase,
            v => setDraft(d => ({ ...d, phase: v as Draft['phase'] })),
            PHASES.map(p => ({ v: p, l: p }))
          )}
        </div>
        <div>
          {lbl('skin_type')}
          {sel(
            draft.skin_type,
            v => setDraft(d => ({ ...d, skin_type: v as Draft['skin_type'] })),
            SKINS.map(s => ({ v: s, l: s }))
          )}
        </div>
        <div>
          {lbl('skin_concern')}
          {sel(
            draft.skin_concern,
            v => setDraft(d => ({ ...d, skin_concern: v as Draft['skin_concern'] })),
            CONCERNS.map(c => ({ v: c, l: c }))
          )}
        </div>
        <div>
          {lbl('category')}
          {sel(
            draft.category,
            v => setDraft(d => ({ ...d, category: v as Draft['category'] })),
            ZONES.map(z => ({ v: z, l: z }))
          )}
        </div>
      </div>
      <div>
        {lbl('care (케어 방법)')}
        <textarea
          value={draft.care}
          onChange={e => setDraft(d => ({ ...d, care: e.target.value }))}
          rows={4}
          style={{ ...inp, resize: 'vertical', minHeight: 88 }}
        />
      </div>
      <div>
        {lbl('quote (오렌 한마디)')}
        <textarea
          value={draft.quote}
          onChange={e => setDraft(d => ({ ...d, quote: e.target.value }))}
          rows={3}
          style={{ ...inp, resize: 'vertical', minHeight: 72 }}
        />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {lbl('is_active')}
        <button
          type="button"
          onClick={() => setDraft(d => ({ ...d, is_active: !d.is_active }))}
          style={{
            padding: '8px 14px',
            borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.12)',
            background: draft.is_active ? 'rgba(76,175,80,0.15)' : 'rgba(255,255,255,0.05)',
            color: draft.is_active ? '#a5e9a9' : 'var(--text3)',
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          {draft.is_active ? '활성' : '비활성'}
        </button>
      </div>
      <div>
        {lbl('product_ids · 제품명 검색')}
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <input value={pq} onChange={e => setPq(e.target.value)} style={{ ...inp, flex: 1 }} placeholder="제품명…" />
        </div>
        {picks.length > 0 ? (
          <div
            style={{
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8,
              maxHeight: 160,
              overflowY: 'auto',
              marginBottom: 10,
            }}
          >
            {picks.map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => onAddProduct(p)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '8px 11px',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                  color: '#fff',
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                {(p as ProductPick & { clean_name?: string | null }).clean_name || p.name}
              </button>
            ))}
          </div>
        ) : null}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {draft.product_ids.map(id => (
            <span
              key={id}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 10px',
                borderRadius: 20,
                background: 'rgba(123,94,167,0.2)',
                border: '1px solid rgba(123,94,167,0.35)',
                fontSize: 11,
              }}
            >
              {productMeta[id] || id.slice(0, 8)}
              <button
                type="button"
                onClick={() => onRemoveProduct(id)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'rgba(255,255,255,0.5)',
                  cursor: 'pointer',
                  padding: 0,
                  fontSize: 14,
                  lineHeight: 1,
                }}
                aria-label="remove"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          style={{
            padding: '10px 20px',
            borderRadius: 8,
            border: '1px solid rgba(201,168,76,0.4)',
            background: 'rgba(201,168,76,0.18)',
            color: '#f0e6c8',
            fontWeight: 600,
            fontSize: 12,
            cursor: saving ? 'wait' : 'pointer',
          }}
        >
          {saving ? '저장 중…' : '저장'}
        </button>
        {!isNew && draft.id ? (
          <button
            type="button"
            onClick={onDelete}
            style={{
              padding: '10px 20px',
              borderRadius: 8,
              border: '1px solid rgba(229,57,53,0.35)',
              background: 'rgba(229,57,53,0.1)',
              color: '#ffab91',
              fontWeight: 600,
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            삭제
          </button>
        ) : null}
      </div>
    </div>
  )
}
