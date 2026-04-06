'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUserProfile } from '@/hooks/useUserProfile'
import { useRouter } from 'next/navigation'

type ReviewFormProps = {
  productId: string
  onSuccess: () => void
  initialReview?: {
    id: string
    rating: number
    content: string
    helpful_concerns?: string[] | null
    images?: string[] | null
  } | null
}

const GOLD = '#C9A96E'
const PURPLE = '#7B5EA7'
const BG = '#0D0B09'

const CONCERNS = [
  '수분감 좋아요', '트러블 진정', '발림성 좋아요',
  '향이 좋아요', '지속력 좋아요', '피부톤 개선',
  '탄력 향상', '자극 없어요', '재구매 의사',
]
const USAGE_PERIODS = ['1주일', '1달', '3달 이상']
const EFFECT_TAGS = ['촉촉해요', '진정돼요', '흡수빨라요', '끈적임없어요', '자극없어요', '탄력있어요']

function toKoreanSkinType(raw: string | null | undefined) {
  const v = String(raw || '').trim()
  if (v === 'dry') return '건성'
  if (v === 'oily') return '지성'
  if (v === 'combination') return '복합성'
  if (v === 'sensitive') return '민감성'
  if (v === 'normal') return '정상'
  return v
}

export function ReviewForm({ productId, onSuccess, initialReview }: ReviewFormProps) {
  const supabase = createClient()
  const router = useRouter()
  const { profile } = useUserProfile()
  const [rating, setRating] = useState(0)
  const [content, setContent] = useState('')
  const [helpfulConcerns, setHelpfulConcerns] = useState<string[]>([])
  const [files, setFiles] = useState<File[]>([])
  const [previewUrls, setPreviewUrls] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [toastMsg, setToastMsg] = useState('')
  const [textToast, setTextToast] = useState(100)
  const [photoToast, setPhotoToast] = useState(300)
  const [videoToast, setVideoToast] = useState(500)
  const [selectedPeriod, setSelectedPeriod] = useState<string | null>(null)
  const [selectedEffects, setSelectedEffects] = useState<string[]>([])
  const [isShared, setIsShared] = useState(false)
  const [shareLikeReward, setShareLikeReward] = useState(0)
  const [shareFollowReward, setShareFollowReward] = useState(0)
  const [hideSkinTypeGuide, setHideSkinTypeGuide] = useState(false)

  useEffect(() => {
    const loadShareRewards = async () => {
      const { data } = await supabase.from('admin_settings').select('key,value').eq('category', 'review').in('key', ['review_share_like_reward', 'review_share_follower_reward'])
      const m: Record<string, string> = {}
      ;(data || []).forEach((r: { key: string; value: string | null }) => {
        m[r.key] = String(r.value ?? '')
      })
      setShareLikeReward(Math.max(0, Math.floor(Number(m.review_share_like_reward ?? 0))))
      setShareFollowReward(Math.max(0, Math.floor(Number(m.review_share_follower_reward ?? 0))))
    }
    void loadShareRewards()
  }, [])

  useEffect(() => {
    const loadToastSettings = async () => {
      const { data } = await supabase
        .from('benefit_settings')
        .select('setting_key, setting_value')
        .in('setting_key', ['review_text_toast', 'review_photo_toast', 'review_video_toast'])
      const map = new Map<string, number>()
      ;(data || []).forEach((row: any) => {
        map.set(String(row.setting_key), Number(row.setting_value) || 0)
      })
      setTextToast(map.get('review_text_toast') ?? 100)
      setPhotoToast(map.get('review_photo_toast') ?? 300)
      setVideoToast(map.get('review_video_toast') ?? 500)
    }
    void loadToastSettings()
  }, [])

  useEffect(() => {
    if (initialReview) {
      setRating(initialReview.rating)
      setContent(initialReview.content)
      setHelpfulConcerns(Array.isArray(initialReview.helpful_concerns) ? initialReview.helpful_concerns : [])
      setPreviewUrls(Array.isArray(initialReview.images) ? initialReview.images : [])
      setFiles([])
    } else {
      setRating(0)
      setContent('')
      setHelpfulConcerns([])
      setPreviewUrls([])
      setFiles([])
      setSelectedPeriod(null)
      setSelectedEffects([])
      setIsShared(false)
    }
  }, [initialReview])

  const canSubmit = useMemo(() => rating > 0 && content.trim().length >= 10 && !submitting, [rating, content, submitting])

  const toggleConcern = (value: string) => {
    setHelpfulConcerns(prev => (prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]))
  }
  const toggleEffect = (value: string) => {
    setSelectedEffects(prev => (prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]))
  }
  const onPickImages = (selected: FileList | null) => {
    const next = Array.from(selected || []).slice(0, 3)
    setFiles(next)
    setPreviewUrls(next.map(file => URL.createObjectURL(file)))
  }

  const submit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const userId = session?.user?.id
      if (!userId) {
        setToastMsg('로그인이 필요해요')
        setTimeout(() => setToastMsg(''), 1800)
        setSubmitting(false)
        return
      }
      const uploadedUrls: string[] = []
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const ext = file.name.split('.').pop() || 'jpg'
        const path = `reviews/${productId}/${userId}-${Date.now()}-${i}.${ext}`
        const { error } = await supabase.storage.from('product-images').upload(path, file, { upsert: true })
        if (!error) {
          const base = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
          uploadedUrls.push(`${base}/storage/v1/object/public/product-images/${path}`)
        }
      }
      const mergedImages = initialReview
        ? uploadedUrls.length > 0 ? [...(initialReview.images || []), ...uploadedUrls] : initialReview.images || []
        : uploadedUrls
      const reviewType = mergedImages.length > 0 ? 'photo' : 'general'

      if (initialReview?.id) {
        const { error: updateError } = await supabase.from('reviews').update({
          content: content.trim(), rating, images: mergedImages,
          helpful_concerns: helpfulConcerns, is_edited: true, edited_at: new Date().toISOString(),
        }).eq('id', initialReview.id)
        if (updateError) throw updateError
        setToastMsg('리뷰가 수정됐어요! 🎉')
      } else {
        const { data: uRow } = await supabase.from('users').select('id').eq('auth_id', userId).maybeSingle()
        if (!uRow?.id) {
          setToastMsg('회원 정보를 확인할 수 없어요')
          setTimeout(() => setToastMsg(''), 1800)
          setSubmitting(false)
          return
        }
        const { data: prod } = await supabase.from('products').select('name, brand_id').eq('id', productId).maybeSingle()
        const pname = String((prod as any)?.name || '제품').trim() || '제품'
        let bname = ''
        if ((prod as any)?.brand_id) {
          const { data: br } = await supabase.from('brands').select('name').eq('id', (prod as any).brand_id).maybeSingle()
          bname = String((br as any)?.name || '').trim()
        }

        const { data: inserted, error: insertError } = await supabase
          .from('reviews')
          .insert({
            target_id: productId,
            author_id: userId,
            review_type: reviewType,
            rating,
            content: content.trim(),
            images: mergedImages,
            helpful_concerns: helpfulConcerns,
            skin_type: profile?.skin_type || null,
            usage_period: selectedPeriod || null,
            effect_tags: selectedEffects.length > 0 ? selectedEffects : null,
            status: '게시',
            is_best: false,
            helpful_count: 0,
            is_shared_community: isShared,
          } as any)
          .select('id')
          .single()
        if (insertError) throw insertError

        if (isShared && inserted?.id) {
          const tags = [pname, bname, '구매인증리뷰'].filter((t) => t.length > 0)
          const { data: postRow, error: postErr } = await supabase
            .from('posts')
            .insert({
              user_id: uRow.id,
              category: 'review',
              title: `${pname} 리뷰`,
              content: content.trim(),
              image_urls: mergedImages.length ? mergedImages : null,
              hashtags: tags,
              product_tags: [productId],
              likes: 0,
              views: 0,
              skin_type: profile?.skin_type || null,
              is_public: true,
              created_at: new Date().toISOString(),
            } as any)
            .select('id')
            .single()
          if (!postErr && postRow?.id) {
            await supabase.from('reviews').update({ community_post_id: postRow.id } as any).eq('id', inserted.id)
          }
        }

        setToastMsg(
          isShared ? '리뷰가 커뮤니티에 공유됐어요! 🎉\n일촌들이 볼 수 있어요 💜' : '리뷰가 등록됐어요 💜'
        )
      }
      setRating(0); setContent(''); setHelpfulConcerns([]); setFiles([]); setPreviewUrls([])
      setSelectedPeriod(null); setSelectedEffects([]); setIsShared(false)
      onSuccess()
      setTimeout(() => setToastMsg(''), 1800)
    } catch {
      setToastMsg(initialReview?.id ? '리뷰 수정에 실패했어요' : '리뷰 등록에 실패했어요')
      setTimeout(() => setToastMsg(''), 1800)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ background: BG, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 16, marginTop: 12 }}>
      <div style={{ fontSize: 14, color: '#fff', marginBottom: 10 }}>{initialReview?.id ? '리뷰 수정' : '리뷰 작성'}</div>
      <div style={{ background: 'rgba(123,94,167,0.1)', border: '1px solid rgba(123,94,167,0.3)', borderRadius: 12, padding: '10px 12px', marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: '#fff', marginBottom: 4 }}>텍스트만    +{textToast}T</div>
        <div style={{ fontSize: 11, color: '#fff', marginBottom: 4 }}>사진 첨부   +{photoToast}T  <span style={{ color: PURPLE }}>추천</span></div>
        <div style={{ fontSize: 11, color: '#fff' }}>영상 첨부   +{videoToast}T  <span style={{ color: PURPLE }}>최고</span></div>
      </div>

      {/* 별점 */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
        {[1,2,3,4,5].map(n => (
          <button key={n} type="button" onClick={() => setRating(n)}
            style={{ border: 'none', background: 'transparent', color: n <= rating ? GOLD : 'rgba(255,255,255,0.3)', fontSize: 24, cursor: 'pointer', padding: 0 }}>★</button>
        ))}
      </div>

      {/* 도움 태그 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
        {CONCERNS.map(item => {
          const selected = helpfulConcerns.includes(item)
          return (
            <button key={item} type="button" onClick={() => toggleConcern(item)}
              style={{ padding: '8px 10px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.08)', background: selected ? PURPLE : 'rgba(255,255,255,0.05)', color: '#fff', fontSize: 12, cursor: 'pointer' }}>
              {item}
            </button>
          )
        })}
      </div>

      {/* 텍스트 */}
      {profile?.skin_type ? (
        <div
          style={{
            marginBottom: 10,
            background: 'rgba(123,94,167,0.06)',
            border: '1px solid rgba(123,94,167,0.2)',
            borderRadius: 12,
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <div style={{ fontSize: 14, lineHeight: 1 }}>✨</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, color: '#c4a7e7' }}>{toKoreanSkinType(profile.skin_type)} 피부로 작성돼요</div>
            <div style={{ fontSize: 10, color: 'rgba(196,167,231,0.5)', marginTop: 2 }}>내 피부타입이 자동 적용돼요</div>
            {Array.isArray(profile.skin_concerns) && profile.skin_concerns.length > 0 ? (
              <div style={{ fontSize: 10, color: 'rgba(196,167,231,0.4)', marginTop: 2 }}>고민: {profile.skin_concerns.join(' · ')}</div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => router.push('/my/profile')}
            style={{ fontSize: 10, color: 'rgba(196,167,231,0.4)', border: '1px solid rgba(123,94,167,0.2)', borderRadius: 20, padding: '3px 8px', background: 'transparent', cursor: 'pointer' }}
          >
            변경
          </button>
        </div>
      ) : !hideSkinTypeGuide ? (
        <div
          style={{
            marginBottom: 10,
            background: 'rgba(123,94,167,0.08)',
            border: '1px solid rgba(123,94,167,0.2)',
            borderRadius: 12,
            padding: '10px 12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          <div style={{ fontSize: 11, color: '#c4a7e7', lineHeight: 1.4 }}>피부타입 설정하면 더 정확한 추천 받아요 💜</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              type="button"
              onClick={() => router.push('/my/profile')}
              style={{ border: '1px solid rgba(123,94,167,0.4)', background: 'transparent', color: '#c4a7e7', borderRadius: 8, padding: '5px 8px', fontSize: 10, cursor: 'pointer', fontWeight: 500 }}
            >
              설정하기
            </button>
            <button
              type="button"
              onClick={() => {
                localStorage.setItem('hide_skintype_banner', 'true')
                setHideSkinTypeGuide(true)
              }}
              style={{ border: 'none', background: 'transparent', color: 'rgba(255,255,255,0.5)', fontSize: 14, cursor: 'pointer', lineHeight: 1 }}
            >
              ×
            </button>
          </div>
        </div>
      ) : null}
      <textarea placeholder="솔직한 리뷰를 남겨주세요 (최소 10자)" value={content} onChange={e => setContent(e.target.value)} rows={5}
        style={{ width: '100%', padding: 12, borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: 13, resize: 'vertical', marginBottom: 10, boxSizing: 'border-box' }} />

      {/* 이미지 */}
      <input type="file" accept="image/*" multiple onChange={e => onPickImages(e.target.files)} style={{ marginBottom: 10, color: '#fff' }} />
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 12 }}>
        {previewUrls.map((url, i) => (
          <img key={i} src={url} alt="" style={{ width: 68, height: 68, objectFit: 'cover', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)' }} />
        ))}
      </div>

      {/* 추가 선택 +50T */}
      <div style={{ background: 'rgba(201,169,110,0.06)', border: '1px solid rgba(201,169,110,0.2)', borderRadius: 12, padding: '12px 14px', marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: GOLD, marginBottom: 10 }}>아래 선택 시 +50T 추가 적립</div>

        <div style={{ fontSize: 11, color: '#888', marginBottom: 6 }}>사용기간</div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
          {USAGE_PERIODS.map(p => (
            <button key={p} type="button" onClick={() => setSelectedPeriod(prev => prev === p ? null : p)}
              style={{ padding: '6px 12px', borderRadius: 20, border: `1px solid ${selectedPeriod === p ? GOLD : 'rgba(255,255,255,0.12)'}`, background: selectedPeriod === p ? 'rgba(201,169,110,0.15)' : 'rgba(255,255,255,0.05)', color: selectedPeriod === p ? GOLD : '#aaa', fontSize: 12, cursor: 'pointer' }}>
              {p}
            </button>
          ))}
        </div>

        <div style={{ fontSize: 11, color: '#888', marginBottom: 6 }}>효과 (복수선택)</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
          {EFFECT_TAGS.map(et => {
            const sel = selectedEffects.includes(et)
            return (
              <button key={et} type="button" onClick={() => toggleEffect(et)}
                style={{ padding: '6px 12px', borderRadius: 20, border: `1px solid ${sel ? GOLD : 'rgba(255,255,255,0.12)'}`, background: sel ? 'rgba(201,169,110,0.15)' : 'rgba(255,255,255,0.05)', color: sel ? GOLD : '#aaa', fontSize: 12, cursor: 'pointer' }}>
                {et}
              </button>
            )
          })}
        </div>
      </div>

      {!initialReview?.id ? (
        <>
          <button
            type="button"
            onClick={() => setIsShared((v) => !v)}
            style={{
              width: '100%',
              textAlign: 'left',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              marginBottom: 10,
              padding: 14,
              borderRadius: 14,
              border: isShared ? '1px solid rgba(123,94,167,0.4)' : '1px solid rgba(255,255,255,0.08)',
              background: isShared ? 'rgba(123,94,167,0.08)' : 'rgba(255,255,255,0.03)',
              cursor: 'pointer',
              boxSizing: 'border-box' as const,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, color: isShared ? '#c4a7e7' : '#fff' }}>
                {isShared ? '💜 일촌들한테 자랑할게요' : '🔒 나만 볼게요'}
              </div>
              <div style={{ fontSize: 11, color: isShared ? 'rgba(196,167,231,0.6)' : 'rgba(255,255,255,0.4)', marginTop: 4 }}>
                {isShared ? '리뷰가 커뮤니티에 올라가요!' : '공개하면 좋아요도 받고 일촌도 생겨요 💜'}
              </div>
            </div>
            <div
              style={{
                width: 44,
                height: 26,
                borderRadius: 999,
                background: isShared ? PURPLE : 'rgba(255,255,255,0.15)',
                position: 'relative',
                flexShrink: 0,
                transition: 'background 0.2s',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: 3,
                  left: isShared ? 22 : 3,
                  width: 20,
                  height: 20,
                  borderRadius: 999,
                  background: '#fff',
                  transition: 'left 0.2s',
                }}
              />
            </div>
          </button>
          <div
            style={{
              maxHeight: isShared ? 200 : 0,
              opacity: isShared ? 1 : 0,
              overflow: 'hidden',
              transition: 'max-height 0.35s ease, opacity 0.25s ease',
              marginBottom: isShared ? 12 : 0,
            }}
          >
            <div
              style={{
                background: 'rgba(123,94,167,0.06)',
                border: '1px solid rgba(123,94,167,0.15)',
                borderRadius: 12,
                padding: '12px 14px',
              }}
            >
              <div style={{ fontSize: 11, color: 'rgba(196,167,231,0.8)', marginBottom: 6 }}>
                ❤️ 좋아요 받으면 +{shareLikeReward}T 적립
              </div>
              <div style={{ fontSize: 11, color: 'rgba(196,167,231,0.8)', marginBottom: 6 }}>💬 댓글로 피부 고민 나눠요</div>
              <div style={{ fontSize: 11, color: 'rgba(196,167,231,0.8)', marginBottom: 6 }}>
                👯 팔로워 생기면 +{shareFollowReward}T 적립
              </div>
              <div style={{ fontSize: 11, color: 'rgba(196,167,231,0.8)', marginBottom: 6 }}>🏆 인기 리뷰되면 이달의 리뷰어!</div>
            </div>
          </div>
        </>
      ) : null}

      <button type="button" onClick={submit} disabled={!canSubmit}
        style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: 'none', background: PURPLE, color: '#fff', fontSize: 15, cursor: canSubmit ? 'pointer' : 'not-allowed', opacity: canSubmit ? 1 : 0.6 }}>
        리뷰 등록하기
      </button>
      {toastMsg ? (
        <div style={{ marginTop: 10, color: '#fff', fontSize: 12, whiteSpace: 'pre-line' as const }}>{toastMsg}</div>
      ) : null}
    </div>
  )
}
