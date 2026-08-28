'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import SceneCtaPaymentModal from '@/components/oren-scene/SceneCtaPaymentModal'
import ScenePaymentCompleteModal from '@/components/oren-scene/ScenePaymentCompleteModal'
import SceneCommentSheet from '@/components/oren-scene/SceneCommentSheet'
import ShareBottomSheet from '@/components/ShareBottomSheet'
import { createClient } from '@/lib/supabase/client'

type LinkType = 'booking' | 'brand_product' | 'product' | 'none'
type ContentType = 'verified' | 'free' | 'owner'

type Post = {
  id: string
  content_type: ContentType | null
  uploader_type: string
  uploader_user_id: string | null
  video_url: string
  thumbnail_url: string | null
  highlight_tag: string | null
  title: string | null
  link_type: LinkType
  booking_id: string | null
  order_item_id: string | null
  brand_product_id: string | null
  product_id: string | null
  salon_id: string | null
  view_count: number
  like_count: number
  booking_conversion_count: number
  revenue_generated: number
}

const GOLD = '#C9A96E'
const PURPLE = '#7B5EA7'
const TEXT = '#fff'
const TEXT_SUB = 'rgba(255,255,255,0.65)'

export default function OrenSceneViewerPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const id = String(params?.id || '')

  const [loading, setLoading] = useState(true)
  const [post, setPost] = useState<Post | null>(null)
  const [uploader, setUploader] = useState<{ id: string; name: string; avatar_url: string | null } | null>(null)
  const [salon, setSalon] = useState<{ id: string; name: string; avatar_url: string | null } | null>(null)
  const [cta, setCta] = useState<{ itemName: string; price: number; targetId: string | null } | null>(null)
  const [isOwner, setIsOwner] = useState(false)
  const [likes, setLikes] = useState(0)
  const [liked, setLiked] = useState(false)
  const [views, setViews] = useState(0)
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [payOpen, setPayOpen] = useState(false)
  const [loginOpen, setLoginOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editTag, setEditTag] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [paidModal, setPaidModal] = useState<{ linkType: 'booking' | 'brand_product'; serviceName?: string; salonId?: string } | null>(null)
  const [error, setError] = useState('')


  useEffect(() => {
    const scenePaid = searchParams.get('scene_paid')
    if (scenePaid !== 'booking' && scenePaid !== 'brand_product') return
    setPaidModal({
      linkType: scenePaid,
      serviceName: searchParams.get('service_name') || undefined,
      salonId: searchParams.get('salon_id') || undefined,
    })
    router.replace(`/oren-scene/${id}`, { scroll: false })
  }, [searchParams, id, router])

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/oren-scene-posts/${id}`)
      const json = await res.json()
      if (!json?.ok || !json.post) {
        setError('게시물을 찾을 수 없어요')
        setPost(null)
        return
      }
      setPost(json.post)
      setUploader(json.uploader)
      setSalon(json.salon)
      setCta(json.cta)
      setIsOwner(!!json.isOwner)
      setLiked(!!json.liked)
      setLikes(Number(json.post.like_count || 0))
      setViews(Number(json.post.view_count || 0))
    } catch {
      setError('불러오기 실패')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!id || !post) return
    const key = `oren_scene_viewed_${id}`
    try {
      if (sessionStorage.getItem(key)) return
      sessionStorage.setItem(key, '1')
    } catch {
      /* ignore */
    }
    void fetch(`/api/oren-scene-posts/${id}/engage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'view' }),
    })
      .then((r) => r.json())
      .then((j) => {
        if (j?.ok && typeof j.view_count === 'number') setViews(j.view_count)
      })
      .catch(() => {})
  }, [id, post])

  const onLike = async () => {
    if (!id) return
    try {
      const res = await fetch(`/api/oren-scene-posts/${id}/engage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'like' }),
      })
      const json = await res.json().catch(() => ({}))
      if (json?.error === 'not_logged_in') {
        setLoginOpen(true)
        return
      }
      if (json?.ok && typeof json.like_count === 'number') {
        setLikes(json.like_count)
        if (typeof json.liked === 'boolean') setLiked(json.liked)
        return
      }
      alert(json?.error || '좋아요에 실패했어요')
    } catch {
      alert('좋아요에 실패했어요')
    }
  }

  const openEdit = () => {
    if (!post) return
    setEditTitle(String(post.title || ''))
    setEditTag(String(post.highlight_tag || ''))
    setEditOpen(true)
  }

  const saveEdit = async () => {
    if (!id || editSaving) return
    const title = editTitle.trim()
    if (!title) {
      alert('제목을 입력해주세요')
      return
    }
    setEditSaving(true)
    try {
      const res = await fetch(`/api/oren-scene-posts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          highlight_tag: editTag.trim() || null,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!json?.ok) {
        alert(json?.error || '수정 실패')
        return
      }
      setPost((prev) =>
        prev
          ? {
              ...prev,
              title: json.post?.title ?? title,
              highlight_tag: json.post?.highlight_tag ?? (editTag.trim() || null),
            }
          : prev,
      )
      setEditOpen(false)
    } finally {
      setEditSaving(false)
    }
  }

  const onDelete = async () => {
    if (!confirm('이 릴스를 삭제할까요?')) return
    const res = await fetch(`/api/oren-scene-posts/${id}`, { method: 'DELETE' })
    const json = await res.json().catch(() => ({}))
    if (json?.ok) router.replace('/')
    else alert(json?.error || '삭제 실패')
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#000', color: TEXT_SUB, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        불러오는 중…
      </div>
    )
  }

  if (!post || error) {
    return (
      <div style={{ minHeight: '100vh', background: '#000', color: TEXT, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 }}>
        <div style={{ textAlign: 'center' }}>{error || '불러오지 못했어요'}</div>
        <button type="button" onClick={() => void load()} style={{ border: '1px solid rgba(123,94,167,0.6)', background: 'rgba(123,94,167,0.25)', color: TEXT, borderRadius: 10, padding: '8px 14px', cursor: 'pointer' }}>다시 시도</button>
        <button type="button" onClick={() => router.back()} style={{ border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: TEXT, borderRadius: 10, padding: '8px 14px', cursor: 'pointer' }}>뒤로</button>
      </div>
    )
  }

  const contentType = (post.content_type || 'verified') as ContentType
  const showCta = !isOwner && (post.link_type === 'booking' || post.link_type === 'brand_product' || post.link_type === 'product')
  const ctaLabel =
    post.link_type === 'booking' ? '나도 이관리 받을래' : '나도 이제품 써볼래'
  const modalLinkType =
    post.link_type === 'booking' ? 'booking' : post.link_type === 'product' ? 'product' : 'brand_product'

  const shareOrigin =
    (typeof window !== 'undefined' && window.location?.origin?.includes('auran.kr')
      ? 'https://auran.kr'
      : typeof window !== 'undefined' && window.location?.origin
        ? window.location.origin
        : 'https://auran.kr')
  const shareTitle = (post.title && post.title.trim()) || '오렌씬'
  const shareDescription =
    contentType === 'verified'
      ? '인증후기'
      : contentType === 'owner'
        ? '살롱소개'
        : '함께 보는 오렌씬 이야기'
  const sharePayload = {
    link: `${shareOrigin}/oren-scene/${post.id}`,
    title: shareTitle,
    description: shareDescription,
    imageUrl: post.thumbnail_url || null,
    buttonTitle: '오렌씬 보러가기',
  }


  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', color: TEXT, maxWidth: 480, margin: '0 auto' }}>
      <video
        src={post.video_url}
        poster={undefined}
        playsInline
        autoPlay
        muted
        loop
        controls={false}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
      />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.45) 0%, transparent 22%, transparent 62%, rgba(0,0,0,0.72) 100%)', pointerEvents: 'none' }} />

      {/* top uploader */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '14px 14px 0', display: 'flex', alignItems: 'center', gap: 10, zIndex: 2 }}>
        <button type="button" onClick={() => router.back()} style={{ background: 'rgba(0,0,0,0.35)', border: 'none', color: TEXT, borderRadius: 999, width: 32, height: 32, fontSize: 16 }}>←</button>
        <div
          role={contentType === 'owner' && salon ? 'link' : undefined}
          onClick={() => {
            if (contentType === 'owner' && salon) router.push(`/salons/${salon.id}`)
          }}
          style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: contentType === 'owner' && salon ? 'pointer' : 'default' }}
        >
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: 'rgba(123,94,167,0.4)',
            backgroundImage: (contentType === 'owner' ? salon?.avatar_url : uploader?.avatar_url)
              ? `url(${contentType === 'owner' ? salon?.avatar_url : uploader?.avatar_url})`
              : undefined,
            backgroundSize: 'cover',
            border: '1px solid rgba(255,255,255,0.25)',
          }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 800 }}>
              {contentType === 'owner' ? (salon?.name || uploader?.name || '살롱') : (uploader?.name || '회원')}
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
              {contentType === 'verified' ? (
                <span style={{ fontSize: 10, color: GOLD, border: `1px solid ${GOLD}`, borderRadius: 999, padding: '1px 7px' }}>인증</span>
              ) : null}
              {contentType === 'owner' ? (
                <span style={{ fontSize: 10, color: PURPLE, border: `1px solid ${PURPLE}`, borderRadius: 999, padding: '1px 7px' }}>원장</span>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* right actions */}
      <div style={{ position: 'absolute', right: 12, bottom: isOwner || showCta ? 120 : 80, zIndex: 2, display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' }}>
        <button type="button" onClick={() => void onLike()} style={{ background: 'transparent', border: 'none', color: TEXT, textAlign: 'center' }}>
          <div style={{ fontSize: 26, color: liked ? '#FF6B8A' : TEXT }}>{liked ? '♥' : '♡'}</div>
          <div style={{ fontSize: 11, marginTop: 2 }}>{likes}</div>
        </button>
        <button type="button" onClick={() => setCommentsOpen(true)} style={{ background: 'transparent', border: 'none', color: TEXT, textAlign: 'center' }}>
          <div style={{ fontSize: 24 }}>💬</div>
          <div style={{ fontSize: 11, marginTop: 2 }}>댓글</div>
        </button>
        <button
          type="button"
          onClick={() => setShareOpen(true)}
          style={{ background: 'transparent', border: 'none', color: TEXT, textAlign: 'center' }}
        >
          <div style={{ fontSize: 24 }}>↗</div>
          <div style={{ fontSize: 11, marginTop: 2 }}>공유</div>
        </button>
      </div>

      {/* bottom CTA / owner stats */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 2, padding: '12px 14px 22px' }}>
        {isOwner ? (
          <div style={{ background: 'rgba(20,16,24,0.88)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 14, padding: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ textAlign: 'center', flex: 1 }}>
                <div style={{ fontSize: 11, color: TEXT_SUB }}>조회</div>
                <div style={{ fontSize: 15, fontWeight: 800 }}>{views.toLocaleString()}</div>
              </div>
              <div style={{ textAlign: 'center', flex: 1 }}>
                <div style={{ fontSize: 11, color: TEXT_SUB }}>예약전환</div>
                <div style={{ fontSize: 15, fontWeight: 800 }}>{Number(post.booking_conversion_count || 0).toLocaleString()}</div>
              </div>
              <div style={{ textAlign: 'center', flex: 1 }}>
                <div style={{ fontSize: 11, color: TEXT_SUB }}>발생매출</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: GOLD }}>₩{Number(post.revenue_generated || 0).toLocaleString()}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={openEdit}
                style={{ flex: 1, borderRadius: 10, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: TEXT, padding: '10px 0', fontSize: 13, fontWeight: 700 }}
              >
                수정
              </button>
              <button
                type="button"
                onClick={() => void onDelete()}
                style={{ flex: 1, borderRadius: 10, border: 'none', background: 'rgba(229,115,115,0.25)', color: '#FFCDD2', padding: '10px 0', fontSize: 13, fontWeight: 700 }}
              >
                삭제
              </button>
            </div>
            {editOpen ? (
              <div style={{ marginTop: 12, borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 12 }}>
                <div style={{ fontSize: 12, color: TEXT_SUB, marginBottom: 8 }}>제목 · 태그 수정 (영상 변경은 삭제 후 재업로드)</div>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="제목"
                  maxLength={80}
                  style={{ width: '100%', boxSizing: 'border-box', marginBottom: 8, background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, padding: '10px 12px', color: TEXT, fontSize: 13 }}
                />
                <input
                  type="text"
                  value={editTag}
                  onChange={(e) => setEditTag(e.target.value)}
                  placeholder="하이라이트 태그 (선택)"
                  maxLength={40}
                  style={{ width: '100%', boxSizing: 'border-box', marginBottom: 10, background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, padding: '10px 12px', color: TEXT, fontSize: 13 }}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setEditOpen(false)}
                    disabled={editSaving}
                    style={{ flex: 1, borderRadius: 10, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: TEXT, padding: '10px 0', fontSize: 13 }}
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    onClick={() => void saveEdit()}
                    disabled={editSaving}
                    style={{ flex: 1, borderRadius: 10, border: 'none', background: PURPLE, color: TEXT, padding: '10px 0', fontSize: 13, fontWeight: 700, opacity: editSaving ? 0.7 : 1 }}
                  >
                    {editSaving ? '저장 중…' : '저장'}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ) : showCta ? (
          <button
            type="button"
            onClick={() => {
              void (async () => {
                const supabase = createClient()
                const { data: { user } } = await supabase.auth.getUser()
                if (!user) {
                  setLoginOpen(true)
                  return
                }
                setPayOpen(true)
              })()
            }}
            style={{
              width: '100%',
              border: 'none',
              borderRadius: 14,
              background: `linear-gradient(90deg, ${PURPLE}, #9B7BC7)`,
              color: TEXT,
              padding: '14px 0',
              fontSize: 15,
              fontWeight: 800,
              boxShadow: '0 8px 24px rgba(123,94,167,0.35)',
            }}
          >
            {ctaLabel}
          </button>
        ) : null}
      </div>

      <SceneCommentSheet scenePostId={post.id} open={commentsOpen} onClose={() => setCommentsOpen(false)} />


      {loginOpen ? (
        <div
          onClick={() => setLoginOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 120,
            background: 'rgba(0,0,0,0.72)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 320,
              background: '#1a1228',
              border: '1px solid rgba(123,94,167,0.45)',
              borderRadius: 16,
              padding: 20,
            }}
          >
            <div style={{ fontSize: 17, fontWeight: 800, color: TEXT, marginBottom: 8 }}>로그인이 필요해요</div>
            <div style={{ fontSize: 12, color: TEXT_SUB, marginBottom: 16, lineHeight: 1.5 }}>
              로그인 후 이 릴스에서 바로결제를 이어갈 수 있어요.
            </div>
            <button
              type="button"
              onClick={() => {
                const redirect = `/oren-scene/${post.id}`
                router.push(`/login?role=customer&redirect=${encodeURIComponent(redirect)}`)
              }}
              style={{
                width: '100%',
                border: 'none',
                borderRadius: 12,
                background: PURPLE,
                color: TEXT,
                padding: '12px 0',
                fontSize: 14,
                fontWeight: 800,
                cursor: 'pointer',
                marginBottom: 8,
              }}
            >
              로그인 하러 가기
            </button>
            <button
              type="button"
              onClick={() => setLoginOpen(false)}
              style={{
                width: '100%',
                border: '1px solid rgba(255,255,255,0.12)',
                background: 'transparent',
                color: TEXT,
                borderRadius: 12,
                padding: '10px 0',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              닫기
            </button>
          </div>
        </div>
      ) : null}


      {paidModal ? (
        <ScenePaymentCompleteModal
          linkType={paidModal.linkType}
          serviceName={paidModal.serviceName}
          salonId={paidModal.salonId}
          onClose={() => setPaidModal(null)}
          onPickDate={() => {
            const sid = paidModal.salonId || post?.salon_id
            setPaidModal(null)
            if (sid) router.push(`/salons/${sid}?booking_paid=true`)
          }}
        />
      ) : null}

      {payOpen && cta ? (
        <SceneCtaPaymentModal
          scenePostId={post.id}
          linkType={modalLinkType}
          salonName={salon?.name || '살롱'}
          itemName={cta.itemName}
          price={cta.price}
          uploaderNickname={uploader?.name}
          targetId={cta.targetId}
          productHref={post.product_id ? `/products/${post.product_id}` : null}
          salonId={post.salon_id}
          brandProductId={post.brand_product_id}
          onClose={() => setPayOpen(false)}
        />
      ) : null}

      <div
        id="oren-scene-share-card"
        aria-hidden
        style={{
          position: 'fixed',
          left: -9999,
          top: 0,
          width: 320,
          padding: 16,
          background: '#0D0B09',
          color: '#fff',
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 800, color: GOLD, marginBottom: 6 }}>{sharePayload.title}</div>
        <div style={{ fontSize: 12, color: TEXT_SUB, lineHeight: 1.5 }}>{sharePayload.description}</div>
      </div>

      <ShareBottomSheet
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        cardDomId="oren-scene-share-card"
        payload={sharePayload}
      />
    </div>
  )
}
