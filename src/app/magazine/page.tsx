'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const BG = '#0D0B09'

const TABS = ['전체', '피부케어', '성분', '루틴', '브랜드', '원장님픽'] as const

function formatDate(iso: string | null | undefined) {
  if (!iso) return '-'
  try {
    return new Date(iso).toLocaleDateString('ko-KR')
  } catch {
    return '-'
  }
}

export default function MagazinePage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<any[]>([])
  const [tab, setTab] = useState<(typeof TABS)[number]>('전체')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const nowIso = new Date().toISOString()
      const { data, error } = await supabase
        .from('magazines' as any)
        .select('*')
        .eq('is_published', true)
        .lte('published_at', nowIso)
        .order('published_at', { ascending: false })
      if (error) setRows([])
      else setRows((data as any[]) || [])
    } catch {
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    if (tab === '전체') return rows
    return rows.filter((r) => String(r.category || '') === tab)
  }, [rows, tab])

  const featured = filtered[0]
  const rest = filtered.slice(1)

  return (
    <div style={{ minHeight: '100vh', background: BG, color: '#fff', maxWidth: 480, margin: '0 auto', paddingBottom: 110 }}>
      <div style={{ padding: '20px 16px 12px', textAlign: 'center' }}>
        <div
          style={{
            fontFamily: 'Georgia, "Times New Roman", serif',
            color: '#c4a7e7',
            letterSpacing: 6,
            fontSize: 18,
            fontWeight: 600,
          }}
        >
          AURAN MAGAZINE
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', padding: '0 12px 14px', WebkitOverflowScrolling: 'touch' }}>
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            style={{
              flexShrink: 0,
              border: tab === t ? '1px solid rgba(196,167,231,0.5)' : '1px solid rgba(255,255,255,0.1)',
              background: tab === t ? 'rgba(196,167,231,0.12)' : 'transparent',
              color: tab === t ? '#c4a7e7' : 'rgba(255,255,255,0.5)',
              borderRadius: 999,
              padding: '7px 14px',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {t}
          </button>
        ))}
      </div>

      <div style={{ padding: '0 16px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.45)', fontSize: 13 }}>불러오는 중…</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 16px', fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 1.7 }}>
            아직 매거진 콘텐츠가 없어요
            <br />
            곧 업데이트될 예정이에요 💜
          </div>
        ) : (
          <>
            {featured ? (
              <button
                type="button"
                onClick={() => router.push(`/magazine/${featured.id}`)}
                style={{
                  width: '100%',
                  border: 'none',
                  padding: 0,
                  marginBottom: 18,
                  borderRadius: 14,
                  overflow: 'hidden',
                  cursor: 'pointer',
                  display: 'block',
                  background: '#1a1520',
                }}
              >
                <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', background: '#222' }}>
                  {featured.thumbnail_url ? (
                    <img src={featured.thumbnail_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  ) : null}
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'linear-gradient(to top, rgba(13,11,9,0.95) 0%, rgba(13,11,9,0.2) 55%, transparent 100%)',
                    }}
                  />
                  <div style={{ position: 'absolute', left: 12, right: 12, bottom: 12, textAlign: 'left' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        fontSize: 10,
                        padding: '3px 8px',
                        borderRadius: 8,
                        background: 'rgba(196,167,231,0.25)',
                        color: '#e8d6ff',
                        marginBottom: 8,
                      }}
                    >
                      {featured.category || '매거진'}
                    </span>
                    <div style={{ fontSize: 17, fontWeight: 800, lineHeight: 1.35, color: '#fff' }}>{featured.title}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 8 }}>
                      조회 {Number(featured.view_count || 0).toLocaleString()} · {formatDate(featured.published_at)}
                    </div>
                  </div>
                </div>
              </button>
            ) : null}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {rest.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => router.push(`/magazine/${m.id}`)}
                  style={{
                    border: 'none',
                    padding: 0,
                    borderRadius: 12,
                    overflow: 'hidden',
                    cursor: 'pointer',
                    background: 'rgba(255,255,255,0.04)',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ width: '100%', aspectRatio: '4/3', background: '#222' }}>
                    {m.thumbnail_url ? (
                      <img src={m.thumbnail_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    ) : null}
                  </div>
                  <div style={{ padding: '10px 10px 12px' }}>
                    <span
                      style={{
                        fontSize: 9,
                        padding: '2px 6px',
                        borderRadius: 6,
                        background: 'rgba(196,167,231,0.2)',
                        color: '#c4a7e7',
                      }}
                    >
                      {m.category || '-'}
                    </span>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        marginTop: 6,
                        color: '#fff',
                        lineHeight: 1.35,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {m.title}
                    </div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 6 }}>
                      {formatDate(m.published_at)} · {Number(m.view_count || 0).toLocaleString()}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
