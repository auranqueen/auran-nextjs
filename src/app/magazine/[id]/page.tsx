'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const BG = '#0D0B09'

function looksLikeHtml(s: string) {
  const t = String(s || '').trim()
  return t.startsWith('<') && /<[a-z][\s\S]*>/i.test(t)
}

function mdToSafeHtml(md: string): string {
  const lines = String(md || '').split('\n')
  return lines
    .map((line) => {
      let l = line
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
      l = l.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      if (l.startsWith('## ')) return `<h2 style="font-size:18px;margin:16px 0 8px;color:#fff">${l.slice(3)}</h2>`
      if (l.startsWith('# ')) return `<h1 style="font-size:22px;margin:16px 0 8px;color:#fff">${l.slice(2)}</h1>`
      if (!l.trim()) return '<br/>'
      return `<p style="margin:0 0 10px;line-height:1.65;color:rgba(255,255,255,0.82)">${l}</p>`
    })
    .join('')
}

function readTimeMin(content: string) {
  const plain = String(content || '').replace(/<[^>]+>/g, ' ')
  const words = plain.trim().split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.ceil(words / 200))
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return '-'
  try {
    return new Date(iso).toLocaleDateString('ko-KR')
  } catch {
    return '-'
  }
}

export default function MagazineDetailPage() {
  const params = useParams()
  const id = String(params?.id || '')
  const router = useRouter()
  const supabase = createClient()
  const [row, setRow] = useState<any | null>(null)
  const [related, setRelated] = useState<any[]>([])
  const [tagProducts, setTagProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const nowIso = new Date().toISOString()
      const { data, error } = await supabase
        .from('magazines' as any)
        .select('*')
        .eq('id', id)
        .eq('is_published', true)
        .lte('published_at', nowIso)
        .maybeSingle()
      if (error || !data) {
        setRow(null)
        setLoading(false)
        return
      }

      let nextRow = data as any
      const sessKey = `magazine_view_${id}`
      const already = typeof sessionStorage !== 'undefined' && sessionStorage.getItem(sessKey)
      if (!already) {
        const vc = Number((data as any).view_count || 0) + 1
        const { error: upErr } = await supabase.from('magazines' as any).update({ view_count: vc } as any).eq('id', id)
        if (!upErr) {
          try {
            sessionStorage.setItem(sessKey, '1')
          } catch {
            /* ignore */
          }
          nextRow = { ...(data as any), view_count: vc }
        }
      }
      setRow(nextRow)

      const cat = String((data as any).category || '')
      const { data: rel } = await supabase
        .from('magazines' as any)
        .select('id,title,thumbnail_url,published_at,view_count,category')
        .eq('is_published', true)
        .lte('published_at', nowIso)
        .eq('category', cat)
        .neq('id', id)
        .order('published_at', { ascending: false })
        .limit(3)
      setRelated(((rel as any[]) || []).filter(Boolean))

      const tags = (data as any).product_tags
      const ids = Array.isArray(tags) ? tags.map((x: any) => String(x)).filter(Boolean).slice(0, 5) : []
      if (ids.length) {
        const { data: prods } = await supabase.from('products').select('id,name,retail_price,sale_price,thumb_img').in('id', ids)
        setTagProducts((prods as any[]) || [])
      } else {
        setTagProducts([])
      }
    } catch {
      setRow(null)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!row?.title) return
    document.title = `${row.title} · AURAN MAGAZINE`
    const desc = String(row.subtitle || row.title || '').slice(0, 160)
    let el = document.querySelector('meta[name="description"]')
    if (!el) {
      el = document.createElement('meta')
      el.setAttribute('name', 'description')
      document.head.appendChild(el)
    }
    el.setAttribute('content', desc)
    const setOg = (prop: string, content: string) => {
      let o = document.querySelector(`meta[property="${prop}"]`)
      if (!o) {
        o = document.createElement('meta')
        o.setAttribute('property', prop)
        document.head.appendChild(o)
      }
      o.setAttribute('content', content)
    }
    if (typeof window !== 'undefined') {
      setOg('og:title', row.title)
      setOg('og:description', desc)
      if (row.thumbnail_url) setOg('og:image', row.thumbnail_url)
      setOg('og:type', 'article')
    }
  }, [row])

  const bodyHtml = useMemo(() => {
    const c = String(row?.content || '')
    if (!c) return ''
    if (looksLikeHtml(c)) return c
    return mdToSafeHtml(c)
  }, [row])

  const share = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : ''
    try {
      if (navigator.share) {
        await navigator.share({ title: row?.title, text: row?.subtitle || '', url })
        return
      }
    } catch {
      /* ignore */
    }
    try {
      await navigator.clipboard.writeText(url)
      alert('링크가 복사됐어요 💜')
    } catch {
      /* ignore */
    }
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(typeof window !== 'undefined' ? window.location.href : '')
      alert('링크가 복사됐어요 💜')
    } catch {
      /* ignore */
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: BG, color: '#fff', maxWidth: 480, margin: '0 auto', padding: 24 }}>
        불러오는 중…
      </div>
    )
  }

  if (!row) {
    return (
      <div style={{ minHeight: '100vh', background: BG, color: '#fff', maxWidth: 480, margin: '0 auto', padding: 24, paddingBottom: 0 }}>
        <p style={{ fontSize: 14 }}>글을 찾을 수 없어요</p>
        <button type="button" onClick={() => router.push('/magazine')} style={{ marginTop: 16, border: '1px solid rgba(196,167,231,0.4)', background: 'transparent', color: '#c4a7e7', padding: '10px 16px', borderRadius: 10, cursor: 'pointer' }}>
          목록으로
        </button>
      </div>
    )
  }

  const rt = readTimeMin(String(row.content || ''))

  return (
    <div style={{ minHeight: '100vh', background: BG, color: '#fff', maxWidth: 480, margin: '0 auto', paddingBottom: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <button type="button" onClick={() => router.back()} style={{ border: 'none', background: 'transparent', color: '#fff', fontSize: 18, cursor: 'pointer', padding: 4 }}>
          ←
        </button>
        <button type="button" onClick={() => void share()} style={{ border: 'none', background: 'transparent', color: '#c4a7e7', fontSize: 13, cursor: 'pointer' }}>
          공유
        </button>
      </div>

      <div style={{ width: '100%', aspectRatio: '16/9', background: '#222' }}>
        {row.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={row.thumbnail_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        ) : null}
      </div>

      <div style={{ padding: '18px 16px 0' }}>
        <span
          style={{
            display: 'inline-block',
            fontSize: 10,
            padding: '4px 10px',
            borderRadius: 8,
            background: 'rgba(196,167,231,0.2)',
            color: '#c4a7e7',
          }}
        >
          {row.category || '매거진'}
        </span>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: '14px 0 8px', lineHeight: 1.35 }}>{row.title}</h1>
        {row.subtitle ? <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', margin: 0, lineHeight: 1.5 }}>{row.subtitle}</p> : null}
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 12 }}>
          {formatDate(row.published_at)} · 조회 {Number(row.view_count || 0).toLocaleString()} · 약 {rt}분 읽기
        </div>
      </div>

      <div style={{ padding: '20px 16px' }}>
        <div style={{ fontSize: 14, lineHeight: 1.7, color: 'rgba(255,255,255,0.88)' }} dangerouslySetInnerHTML={{ __html: bodyHtml }} />
      </div>

      <div style={{ display: 'flex', gap: 8, padding: '0 16px 20px' }}>
        <button
          type="button"
          onClick={() => void share()}
          style={{ flex: 1, border: '1px solid rgba(196,167,231,0.35)', background: 'rgba(196,167,231,0.1)', color: '#c4a7e7', borderRadius: 10, padding: '11px 0', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
        >
          카카오 공유
        </button>
        <button
          type="button"
          onClick={() => void copyLink()}
          style={{ flex: 1, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: '#fff', borderRadius: 10, padding: '11px 0', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
        >
          링크 복사
        </button>
      </div>

      {tagProducts.length > 0 ? (
        <div style={{ padding: '0 0 20px' }}>
          <div style={{ padding: '0 16px 10px', fontSize: 13, fontWeight: 700, color: '#c4a7e7' }}>💜 이 글의 추천 제품</div>
          <div style={{ display: 'flex', gap: 10, overflowX: 'auto', padding: '0 16px', WebkitOverflowScrolling: 'touch' }}>
            {tagProducts.map((p) => (
              <div
                key={p.id}
                style={{ flexShrink: 0, width: 140, borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', overflow: 'hidden' }}
              >
                <div style={{ width: '100%', aspectRatio: '1', background: '#222' }}>
                  {p.thumb_img ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.thumb_img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : null}
                </div>
                <div style={{ padding: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: '#C9A96E', marginTop: 4 }}>
                    ₩
                    {Number(Number(p.sale_price ?? 0) > 0 ? p.sale_price : p.retail_price ?? 0).toLocaleString()}
                  </div>
                  <button
                    type="button"
                    onClick={() => router.push(`/products/${p.id}`)}
                    style={{ marginTop: 8, width: '100%', border: 'none', borderRadius: 8, background: '#7B5EA7', color: '#fff', fontSize: 10, fontWeight: 700, padding: '7px 0', cursor: 'pointer' }}
                  >
                    구매하기
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {related.length > 0 ? (
        <div style={{ padding: '0 0 28px' }}>
          <div style={{ padding: '0 16px 10px', fontSize: 13, fontWeight: 700 }}>관련 글</div>
          <div style={{ display: 'flex', gap: 10, overflowX: 'auto', padding: '0 16px' }}>
            {related.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => router.push(`/magazine/${r.id}`)}
                style={{ flexShrink: 0, width: 160, border: 'none', padding: 0, borderRadius: 12, overflow: 'hidden', cursor: 'pointer', background: 'rgba(255,255,255,0.05)', textAlign: 'left' }}
              >
                <div style={{ width: '100%', aspectRatio: '16/10', background: '#222' }}>
                  {r.thumbnail_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.thumbnail_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : null}
                </div>
                <div style={{ padding: 8, fontSize: 11, fontWeight: 600, lineHeight: 1.35, color: '#fff', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{r.title}</div>
              </button>
            ))}
          </div>
        </div>
      ) : null}

    </div>
  )
}
