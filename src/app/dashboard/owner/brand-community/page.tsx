'use client'
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import DashboardBottomNav from '@/components/DashboardBottomNav'
import { getOwnerLinkedBrandIds } from '@/lib/brand/getOwnerLinkedBrandIds'
const BG = '#ffffff'
const PURPLE = '#7B5EA7'
const BORDER = '#ede9f7'
const TEXT = '#1A1A2E'
const SUB = '#888888'
interface Post {
  id: string
  title: string | null
  body: string
  is_pinned: boolean
  reply_count: number
  author_type: string
  created_at: string
  brand_id: string
  brands: { name: string } | null
  campaign_id?: string | null
  campaign_image_url?: string | null
}
export default function BrandCommunityPage() {
  const router = useRouter()
  const supabase = createClient()
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [selBrand, setSelBrand] = useState<string | null>(null)
  const [brandNames, setBrandNames] = useState<Array<{ id: string; name: string }>>([])
  const [expandId, setExpandId] = useState<string | null>(null)
  const load = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.replace('/login?role=owner'); return }
    const brandIds = await getOwnerLinkedBrandIds(supabase, user.id, { includePending: true })
    if (brandIds.length === 0) { setLoading(false); return }
    const { data: bRows } = await supabase
      .from('brands')
      .select('id, name')
      .in('id', brandIds)
    const ids = (bRows || []).map((b: { id: string }) => b.id)
    setBrandNames((bRows || []) as Array<{ id: string; name: string }>)
    if (ids.length === 0) { setLoading(false); return }
    let query = supabase
      .from('brand_posts')
      .select('id, title, body, is_pinned, reply_count, author_type, created_at, brand_id, campaign_id, brands(name)')
      .in('brand_id', ids)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(30)
    if (selBrand) query = query.eq('brand_id', selBrand)
    const { data } = await query
    const rows = (data || []) as unknown as Post[]
    const campaignIds = Array.from(new Set(rows.map((p) => p.campaign_id).filter(Boolean))) as string[]
    const imageByCampaign: Record<string, string> = {}
    if (campaignIds.length > 0) {
      const { data: campaigns } = await supabase
        .from('hq_forced_campaigns')
        .select('id, image_url')
        .in('id', campaignIds)
      for (const c of (campaigns || []) as { id: string; image_url?: string | null }[]) {
        if (c.image_url) imageByCampaign[c.id] = String(c.image_url)
      }
    }
    setPosts(rows.map((p) => ({
      ...p,
      campaign_image_url: p.campaign_id ? (imageByCampaign[p.campaign_id] || null) : null,
    })))
    setLoading(false)
  }, [selBrand])
  useEffect(() => { void load() }, [load])
  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime()
    const m = Math.floor(diff / 60000)
    if (m < 1) return '방금 전'
    if (m < 60) return `${m}분 전`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}시간 전`
    return `${Math.floor(h / 24)}일 전`
  }
  if (loading) return (
    <div style={{ background: BG, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: SUB }}>
      불러오는 중...
    </div>
  )
  return (
    <div style={{ background: BG, minHeight: '100vh', paddingBottom: 80 }}>
      <div style={{ padding: '16px 16px 0', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <button type="button" onClick={() => router.back()}
          style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: TEXT, padding: 0 }}>←</button>
        <div style={{ fontSize: 16, fontWeight: 500, color: TEXT }}>브랜드 커뮤니티</div>
      </div>
      {brandNames.length > 1 && (
        <div style={{ padding: '0 16px', marginBottom: 12 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
            <button type="button" onClick={() => setSelBrand(null)}
              style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, border: `0.5px solid ${!selBrand ? PURPLE : BORDER}`, background: !selBrand ? `${PURPLE}15` : '#fff', color: !selBrand ? PURPLE : SUB, cursor: 'pointer' }}>
              전체
            </button>
            {brandNames.map(b => (
              <button key={b.id} type="button" onClick={() => setSelBrand(b.id)}
                style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, border: `0.5px solid ${selBrand === b.id ? PURPLE : BORDER}`, background: selBrand === b.id ? `${PURPLE}15` : '#fff', color: selBrand === b.id ? PURPLE : SUB, cursor: 'pointer' }}>
                {b.name}
              </button>
            ))}
          </div>
        </div>
      )}
      <div style={{ padding: '0 16px' }}>
        {posts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: SUB, fontSize: 14 }}>
            브랜드 공지가 없어요
          </div>
        ) : posts.map(post => (
          <div key={post.id}
            onClick={() => setExpandId(expandId === post.id ? null : post.id)}
            style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 10, padding: '14px', marginBottom: 10, cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6, gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' as const }}>
                  {post.is_pinned && (
                    <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 10, background: `${PURPLE}15`, color: PURPLE }}>📌 공지</span>
                  )}
                  {post.campaign_id && (
                    <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 10, background: 'rgba(229,57,53,0.1)', color: '#E53935' }}>🔥 이벤트</span>
                  )}
                  <span style={{ fontSize: 11, color: PURPLE }}>{post.brands?.name || ''}</span>
                </div>
                {post.campaign_image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={post.campaign_image_url} alt="" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8, marginBottom: 8 }} />
                ) : null}
                {post.title && (
                  <div style={{ fontSize: 14, fontWeight: 500, color: TEXT, marginBottom: 4 }}>{post.title}</div>
                )}
                <div style={{ fontSize: 13, color: expandId === post.id ? TEXT : SUB, lineHeight: 1.6, display: expandId === post.id ? 'block' : '-webkit-box', WebkitLineClamp: expandId === post.id ? undefined : 2, WebkitBoxOrient: 'vertical' as const, overflow: expandId === post.id ? 'visible' : 'hidden' }}>
                  {post.body}
                </div>
                {post.campaign_id ? (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); router.push('/dashboard/owner/brand-orders') }}
                    style={{ marginTop: 10, fontSize: 12, padding: '6px 12px', borderRadius: 8, border: 'none', background: PURPLE, color: '#fff', cursor: 'pointer' }}
                  >
                    자세히 보고 주문하기 →
                  </button>
                ) : null}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: SUB }}>
              <span>{timeAgo(post.created_at)}</span>
              <span>{expandId === post.id ? '접기 ▲' : '더보기 ▼'}</span>
            </div>
          </div>
        ))}
      </div>
      <DashboardBottomNav role="owner" />
    </div>
  )
}
