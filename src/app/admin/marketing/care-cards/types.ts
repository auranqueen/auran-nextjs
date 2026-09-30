import React from 'react'

export type BodyCareCardRow = {
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

export type ProductPick = { id: string; name: string }

export const TRACKS = ['general', 'female', 'male', 'menopause'] as const
export const PHASES = ['all', '달빛기', '황금기', '만개기', '물들기'] as const
export const SKINS = ['all', '건성', '지성', '복합', '민감'] as const
export const CONCERNS = ['all', '트러블', '홍조', '건조', '색소'] as const
export const ZONES = ['face', 'body', 'scalp', 'inner'] as const

export const TRACK_LABEL: Record<string, string> = {
  general: 'general',
  female: 'female',
  male: 'male',
  menopause: 'menopause',
}

export const ZONE_LABEL: Record<string, string> = {
  face: 'face',
  body: 'body',
  scalp: 'scalp',
  inner: 'inner',
}

export function parseCategoryMeta(tags: string[] | null | undefined) {
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

export function buildCategoryTags(
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

export function phaseSingleFromRow(row: BodyCareCardRow): (typeof PHASES)[number] {
  const tags = Array.isArray(row.phase_tags) ? row.phase_tags : []
  if (tags.includes('all')) return 'all'
  for (const p of PHASES) {
    if (p !== 'all' && tags.includes(p)) return p
  }
  return 'all'
}

export function rowToDraft(row: BodyCareCardRow): Draft {
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

export function emptyDraft(): Draft {
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

export type Draft = {
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

export const inp: React.CSSProperties = {
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
