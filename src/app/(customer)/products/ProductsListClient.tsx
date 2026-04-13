'use client'

import { createClient } from '@/lib/supabase/client'
import { calcHormoneBriefing } from '@/lib/hormoneUtils'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'

const BG = '#0f0f12'
const CARD = '#1e1e26'
const BRAND = '#7b6cc0'
const BADGE_BG = '#1a0f28'
const BADGE_FG = '#c4a8ff'

type Row = {
  id: string
  name: string
  retail_price?: number | null
  sale_price?: number | null
  storage_thumb_url?: string | null
  thumb_img?: string | null
  step_tags?: string[] | null
  func_tags?: string[] | null
  hormone_tags?: string[] | null
  brands?: { name?: string | null } | null
}

function priceOf(p: Row) {
  const s = p.sale_price != null ? Number(p.sale_price) : null
  const r = Number(p.retail_price ?? 0)
  if (s != null && !Number.isNaN(s) && s > 0) return s
  return r
}

function tagMatch(tags: string[] | null | undefined, q: string) {
  const n = q.replace(/[·・•\s]/g, '').toLowerCase()
  return (tags || []).some(t => String(t).replace(/[·・•\s]/g, '').toLowerCase().includes(n))
}

function dramaticLine(p: Row, phase: string, focus: string, hormoneMatch: boolean) {
  if (hormoneMatch) return `지금 ${phase} · ${focus.split('/')[0]}에 어울려요`
  const s = p.step_tags?.[0]
  const f = p.func_tags?.[0]
  if (s && f) return `${s} × ${f} — 오늘의 한 줄`
  if (s) return `${s} 케어로 마무리`
  return '피부가 고마워할 거예요'
}

export default function ProductsListClient() {
  const router = useRouter()
  const sp = useSearchParams()
  const supabase = createClient()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [hormoneBadge, setHormoneBadge] = useState('')
  const [phaseFocus, setPhaseFocus] = useState({ phase: '', focus: '' })

  const step = sp.get('step') ? decodeURIComponent(sp.get('step')!) : ''
  const func = sp.get('func') ? decodeURIComponent(sp.get('func')!) : ''
  const pick = sp.get('pick') === 'true'

  const title = useMemo(() => {
    if (pick) return '원장 픽'
    if (step) return '단계별'
    if (func) return '고민별'
    return '제품'
  }, [pick, step, func])

  const load = useCallback(async () => {
    setLoading(true)
    const month = new Date().getMonth() + 1
    let list: Row[] = []
    const { data: { user } } = await supabase.auth.getUser()
    let hcRow: any = null
    if (user) {
      const { data: hc } = await supabase.from('hormone_cycle').select('*').eq('auth_id', user.id).maybeSingle()
      hcRow = hc
      const b = hc ? calcHormoneBriefing(hc) : null
      setHormoneBadge(b?.phase ?? '')
      setPhaseFocus(b ? { phase: b.phase, focus: b.focus } : { phase: '', focus: '' })
    } else {
      setHormoneBadge('')
      setPhaseFocus({ phase: '', focus: '' })
    }
    const sel =
      'id, name, retail_price, sale_price, storage_thumb_url, thumb_img, step_tags, func_tags, hormone_tags, brands(name)'

    if (pick) {
      const { data: maps } = await supabase
        .from('season_product_mapping')
        .select(`priority, products(${sel})`)
        .eq('month', month)
        .eq('is_active', true)
        .order('priority', { ascending: true })
      list = (maps || []).map((m: any) => m.products).filter(Boolean) as Row[]
    } else {
      const { data } = await supabase.from('products').select(sel).eq('is_active', true).eq('status', 'active').limit(200)
      list = (data as Row[]) || []
      if (step && step !== '전체') list = list.filter(p => tagMatch(p.step_tags, step))
      if (func && func !== '전체') list = list.filter(p => tagMatch(p.func_tags, func))
    }

    const br = hcRow ? calcHormoneBriefing(hcRow) : { phase: '', focus: '' }
    const scored = list.map(p => ({
      p,
      hit:
        (p.hormone_tags || []).length > 0 &&
        (p.hormone_tags || []).some(t =>
          br.focus.split('/').some(k => k.trim() && String(t).includes(k.trim())) || !!(br.phase && String(t).includes(br.phase))
        ),
    }))
    scored.sort((a, b) => Number(b.hit) - Number(a.hit))
    setRows(scored.map(s => s.p))
    setLoading(false)
  }, [supabase, pick, step, func])

  useEffect(() => {
    void load()
  }, [load])

  const grouped = useMemo(() => {
    const m = new Map<string, Row[]>()
    for (const p of rows) {
      const name = p.brands?.name?.trim() || '기타'
      if (!m.has(name)) m.set(name, [])
      m.get(name)!.push(p)
    }
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0], 'ko'))
  }, [rows])

  return (
    <div style={{ minHeight: '100vh', background: BG, color: '#e8e8ec', paddingBottom: 32 }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <button type="button" onClick={() => router.back()} style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: 18 }}>←</button>
        <div style={{ flex: 1, fontSize: 16, fontWeight: 600 }}>{title}</div>
        {hormoneBadge ? <span style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, background: BADGE_BG, color: BADGE_FG }}>{hormoneBadge}</span> : null}
      </header>

      {loading ? (
        <div style={{ padding: 24, textAlign: 'center', color: '#666', fontSize: 13 }}>불러오는 중…</div>
      ) : grouped.length === 0 ? (
        <div style={{ padding: 24, textAlign: 'center', color: '#666', fontSize: 13 }}>제품이 없어요</div>
      ) : (
        grouped.map(([brandName, items]) => (
          <section key={brandName} style={{ marginTop: 18, paddingLeft: 14 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
              <span style={{ color: BRAND, fontSize: 14, fontWeight: 600 }}>{brandName}</span>
              <span style={{ fontSize: 12, color: '#666' }}>{items.length}개</span>
            </div>
            <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 6, WebkitOverflowScrolling: 'touch' }}>
              {items.map((p: Row) => {
                const hit =
                  !!phaseFocus.focus &&
                  (p.hormone_tags || []).some((t: string) =>
                    phaseFocus.focus.split('/').some(k => k.trim() && String(t).includes(k.trim()))
                  )
                return (
                  <Link
                    key={p.id}
                    href={`/products/${p.id}`}
                    style={{
                      width: 115,
                      flexShrink: 0,
                      background: CARD,
                      borderRadius: 12,
                      padding: 8,
                      textDecoration: 'none',
                      color: 'inherit',
                      border: '1px solid rgba(255,255,255,0.06)',
                    }}
                  >
                    <div style={{ width: '100%', aspectRatio: '1', borderRadius: 8, overflow: 'hidden', background: 'rgba(255,255,255,0.05)', marginBottom: 6 }}>
                      {p.storage_thumb_url || p.thumb_img ? (
                        <img src={p.storage_thumb_url || p.thumb_img || ''} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : null}
                    </div>
                    <div style={{ fontSize: 8, color: '#7b6cc0', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.step_tags?.[0] || '·'}
                    </div>
                    <div style={{ fontSize: 10, color: '#fff', lineHeight: 1.3, minHeight: 26, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: '#c9a96e', marginTop: 4 }}>₩{priceOf(p).toLocaleString()}</div>
                    <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.38)', marginTop: 4, lineHeight: 1.35 }}>
                      {dramaticLine(p, phaseFocus.phase, phaseFocus.focus, hit)}
                    </div>
                  </Link>
                )
              })}
            </div>
          </section>
        ))
      )}
    </div>
  )
}
