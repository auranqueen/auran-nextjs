'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const PHASE_OPTIONS = ['전체', '달빛기', '황금기', '만개기', '물들기'] as const
const PHASE_LABELS: Record<string, string> = {
  전체: '전체',
  '달빛기': '🌙 달빛기',
  '황금기': '✨ 황금기',
  '만개기': '🌸 만개기',
  '물들기': '🍂 물들기',
}

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<any[]>([])
  const [filter, setFilter] = useState<'all'|'photo'|'best'>('all')
  const [phaseFilter, setPhaseFilter] = useState<string>('전체')
  const [myPhase, setMyPhase] = useState<string>('')
  const [page, setPage] = useState<number>(1)
  const [hasMore, setHasMore] = useState<boolean>(true)
  const [loading, setLoading] = useState<boolean>(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    void (async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user?.id) return
      const { data: hc } = await supabase
        .from('hormone_cycle')
        .select('track, last_period_date, cycle_length')
        .eq('auth_id', session.user.id)
        .maybeSingle()
      if (!hc?.last_period_date) return
      const track = String((hc as { track?: string }).track || 'general')
      if (track !== 'general') return
      const lastPeriodDate = String((hc as { last_period_date?: string }).last_period_date)
      const cycleLength = Math.max(21, Math.min(60, Number((hc as { cycle_length?: number }).cycle_length || 28)))
      const start = new Date(lastPeriodDate)
      if (Number.isNaN(start.getTime())) return
      const now = new Date()
      const diff = Math.floor(
        (new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
          - new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime()) / 86400000
      )
      const cycleDay = ((diff % cycleLength) + cycleLength) % cycleLength + 1
      let phase = ''
      if (cycleDay >= 1 && cycleDay <= 5) phase = '달빛기'
      else if (cycleDay >= 6 && cycleDay <= 13) phase = '황금기'
      else if (cycleDay >= 14 && cycleDay <= 16) phase = '만개기'
      else phase = '물들기'
      if (phase) {
        setMyPhase(phase)
        setPhaseFilter(phase)
      }
    })()
  }, [])

  useEffect(() => {
    setPage(1)
    setHasMore(true)
  }, [filter, phaseFilter])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void (async () => {
      let query = supabase
        .from('reviews')
        .select('*, author:users!reviews_author_id_fkey(id, name, avatar_url), product:products!reviews_target_id_fkey(id, name, thumb_img, retail_price)')
        .eq('status', '게시')
        .order('created_at', { ascending: false })

      if (filter === 'photo') query = query.not('images', 'is', null)
      if (filter === 'best') query = query.eq('is_best', true)
      if (phaseFilter !== '전체') query = query.eq('hormone_phase', phaseFilter)
      query = query.range(0, page * 10 - 1)

      const { data } = await query
      if (cancelled) return
      setReviews(data || [])
      setHasMore((data || []).length >= page * 10)
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [filter, phaseFilter, page])

  const dataReviews = reviews.filter((r) => r.skin_score_before && r.skin_score_after)
  const normalReviews = reviews.filter((r) => !r.skin_score_before || !r.skin_score_after)

  const phaseBadgeStyle = (phase: string) => {
    if (phase === '만개기') return { background: 'rgba(212,83,126,0.15)', color: '#ED93B1' }
    if (phase === '황금기') return { background: 'rgba(201,169,110,0.15)', color: '#C9A96E' }
    if (phase === '달빛기') return { background: 'rgba(123,94,167,0.15)', color: '#AFA9EC' }
    if (phase === '물들기') return { background: 'rgba(215,107,48,0.15)', color: '#F0997B' }
    return { background: 'rgba(123,94,167,0.15)', color: '#AFA9EC' }
  }

  const renderCard = (review: any) => {
    const authorName = review.author?.name || '오랜 회원'
    const initial = String(authorName).trim().charAt(0) || '오'
    const phaseStyle = phaseBadgeStyle(String(review.hormone_phase || ''))
    const scoreBefore = Number(review.skin_score_before)
    const scoreAfter = Number(review.skin_score_after)
    const hasScoreBar = Number.isFinite(scoreBefore) && Number.isFinite(scoreAfter)
    const scorePct = hasScoreBar ? Math.min(100, Math.max(0, scoreAfter)) : 0

    return (
      <div
        key={review.id}
        style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 16,
          padding: 14,
        }}
      >
        {(review.product || review.target_id) ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            paddingBottom: 12,
            marginBottom: 12,
            borderBottom: '0.5px solid rgba(255,255,255,0.06)',
          }}>
            {review.product?.thumb_img ? (
              <img src={review.product.thumb_img} alt="" style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
            ) : (
              <div style={{ width: 44, height: 44, borderRadius: 8, background: '#2a2040', flexShrink: 0 }} />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {review.product?.name || '제품'}
              </div>
              {review.product?.retail_price != null ? (
                <div style={{ fontSize: 11, color: '#C9A96E', marginTop: 2 }}>
                  {Number(review.product.retail_price).toLocaleString()}원
                </div>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => router.push(`/products/${review.target_id}?buy=true`)}
              style={{
                background: '#7B5EA7',
                border: 'none',
                borderRadius: 8,
                fontSize: 11,
                color: '#fff',
                padding: '7px 10px',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              바로 구매
            </button>
          </div>
        ) : null}

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          {review.author?.avatar_url ? (
            <img src={review.author.avatar_url} alt="" style={{ width: 26, height: 26, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
          ) : (
            <div style={{
              width: 26,
              height: 26,
              borderRadius: '50%',
              background: '#3d2d60',
              color: '#C9A96E',
              fontSize: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              {initial}
            </div>
          )}
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>{authorName}</div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.22)' }}>
            {review.created_at ? new Date(review.created_at).toLocaleDateString('ko-KR') : ''}
          </div>
          {review.hormone_phase ? (
            <span style={{
              marginLeft: 'auto',
              fontSize: 10,
              padding: '2px 8px',
              borderRadius: 10,
              ...phaseStyle,
            }}>
              {review.hormone_phase}
            </span>
          ) : null}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <div style={{ color: '#C9A96E', fontSize: 12 }}>
            {'★'.repeat(Number(review.rating) || 0)}{'☆'.repeat(5 - (Number(review.rating) || 0))}
          </div>
          {review.used_period ? (
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>{review.used_period}</div>
          ) : null}
        </div>

        {hasScoreBar ? (
          <div style={{ marginBottom: 10 }}>
            <div style={{
              height: 6,
              borderRadius: 999,
              background: 'rgba(255,255,255,0.08)',
              overflow: 'hidden',
              marginBottom: 4,
            }}>
              <div style={{ width: `${scorePct}%`, height: '100%', background: '#7B5EA7', borderRadius: 999 }} />
            </div>
            <div style={{ fontSize: 10, color: '#AFA9EC' }}>
              {scoreBefore} → {scoreAfter} ↑
            </div>
          </div>
        ) : null}

        {review.images?.length > 0 ? (
          <div style={{ display: 'flex', gap: 8, marginBottom: 10, overflowX: 'auto' }}>
            {review.images.map((img: string, i: number) => (
              <img key={i} src={img} alt="" style={{ width: 64, height: 64, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
            ))}
          </div>
        ) : null}

        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', lineHeight: 1.65, marginBottom: 10 }}>
          {review.content}
        </div>

        {review.helpful_concerns?.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
            {review.helpful_concerns.map((c: string) => (
              <span key={c} style={{
                background: 'rgba(123,94,167,0.18)',
                color: '#AFA9EC',
                fontSize: 10,
                padding: '3px 8px',
                borderRadius: 10,
              }}>
                {c}
              </span>
            ))}
          </div>
        ) : null}

        <div style={{ display: 'flex', alignItems: 'center', marginTop: 4 }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)' }}>
            👍 {review.helpful_count || 0}
          </div>
          <button
            type="button"
            onClick={() => {}}
            style={{
              marginLeft: 'auto',
              border: '0.5px solid rgba(201,169,110,0.3)',
              borderRadius: 8,
              fontSize: 10,
              color: '#C9A96E',
              background: 'transparent',
              padding: '4px 10px',
              cursor: 'pointer',
            }}
          >
            루틴
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ background: '#0D0B09', minHeight: '100vh', color: '#fff', paddingBottom: 80 }}>
      {/* 헤더 */}
      <div style={{ padding: '20px 20px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 20, cursor: 'pointer' }}>←</button>
        <span style={{ fontSize: 16, fontWeight: 700 }}>전체 리뷰</span>
      </div>

      {myPhase ? (
        <div style={{
          background: 'rgba(123,94,167,0.1)',
          border: '0.5px solid rgba(123,94,167,0.25)',
          margin: '12px 20px 0',
          borderRadius: 10,
          padding: '9px 13px',
          fontSize: 11,
          color: '#AFA9EC',
        }}>
          지금 님은 {myPhase} — 같은 페이즈 리뷰를 먼저 보여드려요
        </div>
      ) : null}

      {/* 페이즈 필터 */}
      <div style={{ display: 'flex', gap: 6, padding: '12px 20px 8px', overflowX: 'auto' }}>
        {PHASE_OPTIONS.map((key) => {
          const selected = phaseFilter === key
          return (
            <button
              key={key}
              type="button"
              onClick={() => setPhaseFilter(key)}
              style={{
                padding: '7px 12px',
                borderRadius: 20,
                fontSize: 11,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                background: selected ? 'rgba(123,94,167,0.15)' : 'transparent',
                border: selected ? '1px solid #7B5EA7' : '0.5px solid rgba(255,255,255,0.12)',
                color: selected ? '#C9A96E' : 'rgba(255,255,255,0.35)',
              }}
            >
              {PHASE_LABELS[key] || key}
            </button>
          )
        })}
      </div>

      {/* 필터 탭 */}
      <div style={{ display: 'flex', gap: 8, padding: '8px 20px 16px' }}>
        {[['all','전체'], ['photo','포토·영상'], ['best','베스트']].map(([key, label]) => (
          <button key={key} onClick={() => setFilter(key as any)} style={{
            padding: '8px 16px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
            background: filter === key ? '#C9A96E' : 'rgba(255,255,255,0.05)',
            color: filter === key ? '#000' : 'rgba(255,255,255,0.6)',
            border: filter === key ? 'none' : '1px solid rgba(255,255,255,0.1)',
            fontWeight: filter === key ? 700 : 400
          }}>{label}</button>
        ))}
      </div>

      {/* 리뷰 리스트 */}
      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {dataReviews.length > 0 ? (
          <>
            <div style={{ fontSize: 11, color: '#AFA9EC', letterSpacing: '0.05em' }}>데이터 리뷰</div>
            {dataReviews.map((review) => renderCard(review))}
          </>
        ) : null}

        {normalReviews.length > 0 ? (
          <>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.05em', marginTop: dataReviews.length > 0 ? 4 : 0 }}>
              일반 리뷰
            </div>
            {normalReviews.map((review) => renderCard(review))}
          </>
        ) : null}

        {!loading && reviews.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>
            리뷰가 없어요
          </div>
        ) : null}
      </div>

      {hasMore && !loading ? (
        <button
          type="button"
          onClick={() => setPage((p) => p + 1)}
          style={{
            margin: '16px 20px 0',
            padding: 12,
            width: 'calc(100% - 40px)',
            background: 'rgba(255,255,255,0.03)',
            border: '0.5px solid rgba(255,255,255,0.08)',
            borderRadius: 12,
            fontSize: 12,
            color: 'rgba(255,255,255,0.4)',
            textAlign: 'center',
            cursor: 'pointer',
          }}
        >
          10개 더 보기
        </button>
      ) : null}
    </div>
  )
}
