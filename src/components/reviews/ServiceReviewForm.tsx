'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'

const BG = '#0D0B09'
const CARD = '#181520'
const PURPLE = '#7B5EA7'
const GOLD = '#C9A96E'
const TEXT = '#ffffff'
const TEXT_SUB = 'rgba(255,255,255,0.55)'
const BORDER = 'rgba(255,255,255,0.08)'
const SURFACE = 'rgba(255,255,255,0.08)'

const HORMONE_PHASES = [
  { key: '달빛기', sub: '생리기 1~7일' },
  { key: '황금기', sub: '배란기 8~14일' },
  { key: '만개기', sub: '황체기 15~21일' },
  { key: '물들기', sub: '생리전기 22~28일' },
] as const

const EFFECT_TAGS = ['촉촉해요', '진정돼요', '흡수빨라요', '끈적임없어요', '자극없어요', '탄력있어요', '윤기돌아요', '트러블완화']

const GOOD_TAG_CATEGORIES = [
  { label: '기술·실력', chips: ['손이 능숙해요', '섬세하게 케어해줘요', '전문 지식이 풍부해요', '맞춤 관리를 해줘요'] },
  { label: '환경·공간', chips: ['공간이 청결해요', '인테리어가 예뻐요', '향이 좋아요', '조용하고 편안해요', '주차가 편해요'] },
  { label: '서비스·친절', chips: ['원장님이 친절해요', '설명을 잘 해줘요', '예약이 편해요', '시간을 잘 지켜요'] },
  { label: '제품·재료', chips: ['정품을 사용해요', '고급 제품을 써요', '피부 자극이 없어요'] },
  { label: '효과', chips: ['효과가 바로 느껴져요', '피부가 촉촉해졌어요', '트러블이 진정됐어요', '다음날도 지속돼요', '재방문 의사 있어요'] },
] as const

const CHIP_BORDER = 'rgba(255,255,255,0.08)'
const CHIP_TEXT = '#888888'

function publicUrl(path: string) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  return `${base}/storage/v1/object/public/salon-reviews/${path}`
}

export default function ServiceReviewForm() {
  const router = useRouter()
  const search = useSearchParams()
  const supabase = createClient()

  const serviceName = decodeURIComponent(search.get('service') || '')
  const salonId = search.get('salon_id') || ''
  const reviewerIdParam = search.get('reviewer_id') || ''

  const photoRef = useRef<HTMLInputElement | null>(null)
  const videoRef = useRef<HTMLInputElement | null>(null)
  const beforeRef = useRef<HTMLInputElement | null>(null)
  const afterRef = useRef<HTMLInputElement | null>(null)

  const [reviewerId] = useState(reviewerIdParam)
  const [loading, setLoading] = useState(true)
  const [rating, setRating] = useState(0)
  const [content, setContent] = useState('')
  const [photos, setPhotos] = useState<File[]>([])
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [beforeFile, setBeforeFile] = useState<File | null>(null)
  const [afterFile, setAfterFile] = useState<File | null>(null)
  const [hormonePhase, setHormonePhase] = useState<string | null>(null)
  const [effectTags, setEffectTags] = useState<string[]>([])
  const [goodTags, setGoodTags] = useState<string[]>([])
  const [isShared, setIsShared] = useState(true)
  const [textToast, setTextToast] = useState(100)
  const [imageToast, setImageToast] = useState(300)
  const [videoToast, setVideoToast] = useState(500)
  const [submitting, setSubmitting] = useState(false)
  const [toastMsg, setToastMsg] = useState('')

  useEffect(() => {
    if (!toastMsg) return
    const t = setTimeout(() => setToastMsg(''), 2200)
    return () => clearTimeout(t)
  }, [toastMsg])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      const { data: auth } = await supabase.auth.getUser()
      if (!auth.user) {
        const q = search.toString()
        router.replace(`/login?role=customer&redirect=${encodeURIComponent('/reviews/write' + (q ? `?${q}` : ''))}`)
        return
      }
      if (salonId && serviceName) {
        const { data: salon } = await supabase.from('salons').select('services').eq('id', salonId).maybeSingle()
        const services = (salon as { services?: unknown } | null)?.services ?? []
        const svc = Array.isArray(services)
          ? services.find((s: { name?: string | null }) => s.name === serviceName)
          : null
        if (!cancelled && svc) {
          setTextToast(Number((svc as { review_toast_text?: number }).review_toast_text ?? 100))
          setImageToast(Number((svc as { review_toast_image?: number }).review_toast_image ?? 300))
          setVideoToast(Number((svc as { review_toast_video?: number }).review_toast_video ?? 500))
        }
      }
      if (!cancelled) setLoading(false)
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [router, salonId, serviceName, search])

  const hasPhoto = photos.length > 0 || !!beforeFile || !!afterFile
  const hasVideo = !!videoFile
  const expectedToast = useMemo(() => {
    let total = textToast
    if (hasPhoto) total += imageToast
    if (hasVideo) total += videoToast
    return total
  }, [textToast, imageToast, videoToast, hasPhoto, hasVideo])

  const uploadOne = async (file: File, prefix: string, userKey: string) => {
    const ext = file.name.split('.').pop() || 'bin'
    const path = `${salonId || 'general'}/${userKey}-${Date.now()}-${prefix}.${ext}`
    const { error } = await supabase.storage.from('salon-reviews').upload(path, file, { upsert: true })
    if (error) return null
    return publicUrl(path)
  }

  const toggleTag = (tag: string) => {
    setEffectTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]))
  }

  const toggleGoodTag = (tag: string) => {
    setGoodTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]))
  }

  const onSubmit = async () => {
    if (!rating || !content.trim()) {
      setToastMsg('별점과 후기 내용을 입력해주세요')
      return
    }
    if (!salonId) {
      setToastMsg('샵 정보가 없어요')
      return
    }
    setSubmitting(true)
    try {
      const { data: auth } = await supabase.auth.getUser()
      const authId = auth.user?.id
      if (!authId) {
        router.replace('/login?role=customer')
        return
      }
      const { data: urow } = await supabase.from('users').select('id').eq('auth_id', authId).maybeSingle()
      if (!urow?.id) {
        setToastMsg('회원 정보를 확인할 수 없어요')
        return
      }
      const userKey = String(urow.id).slice(0, 8)

      let beforeUrl: string | null = null
      let afterUrl: string | null = null
      let videoUrl: string | null = null
      const photoUrls: string[] = []

      if (beforeFile) beforeUrl = await uploadOne(beforeFile, 'before', userKey)
      for (let i = 0; i < photos.length; i++) {
        const url = await uploadOne(photos[i], `photo-${i}`, userKey)
        if (url) photoUrls.push(url)
      }
      if (afterFile) afterUrl = await uploadOne(afterFile, 'after', userKey)
      if (videoFile) videoUrl = await uploadOne(videoFile, 'video', userKey)

      const images: string[] = []
      if (beforeUrl) images.push(beforeUrl)
      images.push(...photoUrls)
      if (afterUrl) images.push(afterUrl)

      const reviewType = videoUrl ? 'video' : images.length > 0 ? 'photo' : 'general'
      let totalToast = textToast
      if (images.length > 0) totalToast += imageToast
      if (videoUrl) totalToast += videoToast

      const { data: inserted, error: insErr } = await supabase
        .from('reviews')
        .insert({
          author_id: urow.id,
          target_id: salonId,
          review_type: reviewType,
          service_name: serviceName || null,
          rating,
          content: content.trim(),
          images: images.length ? images : null,
          video_url: videoUrl,
          hormone_phase: hormonePhase,
          effect_tags: effectTags.length ? effectTags : null,
          helpful_concerns: goodTags.length ? goodTags : null,
          is_shared_community: isShared,
          status: '게시',
          helpful_count: 0,
        } as any)
        .select('id')
        .single()
      if (insErr) throw insErr

      if (isShared && inserted?.id) {
        await supabase.from('posts').insert({
          user_id: urow.id,
          category: 'review',
          title: `${serviceName || '관리'} 리뷰`,
          content: content.trim(),
          image_urls: images.length ? images : null,
          hashtags: [serviceName, '관리리뷰'].filter(Boolean),
          likes: 0,
          views: 0,
          is_public: true,
          created_at: new Date().toISOString(),
        } as any)
      }

      if (totalToast > 0) {
        await supabase.from('toast_transactions').insert({
          user_id: urow.id,
          amount: totalToast,
          transaction_type: 'review',
          source_type: 'review',
        } as any)
        const { data: prof } = await supabase.from('profiles').select('toast_balance').eq('auth_id', authId).maybeSingle()
        const cur = Number((prof as { toast_balance?: number } | null)?.toast_balance ?? 0)
        await supabase.from('profiles').update({ toast_balance: cur + totalToast } as any).eq('auth_id', authId)
      }

      setToastMsg(`리뷰 등록 완료! +${totalToast}T 적립됐어요 💜`)
      setTimeout(() => {
        router.push(salonId ? `/salons/${salonId}` : '/my/reviews')
      }, 1200)
    } catch {
      setToastMsg('리뷰 등록에 실패했어요')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: BG, color: TEXT_SUB, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>
        불러오는 중…
      </div>
    )
  }

  const cardStyle: React.CSSProperties = {
    background: CARD,
    border: `1px solid ${BORDER}`,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  }

  return (
    <div style={{ minHeight: '100vh', background: BG, color: TEXT, paddingBottom: 100 }}>
      <div style={{ padding: '14px 16px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 12 }}>
        <span onClick={() => router.back()} style={{ cursor: 'pointer', fontSize: 14, color: TEXT_SUB }}>←</span>
        <span style={{ fontSize: 15, fontWeight: 500 }}>관리 리뷰 작성</span>
      </div>

      <div style={{ padding: 16 }}>
        <div style={cardStyle}>
          <div style={{ fontSize: 13, color: TEXT_SUB, marginBottom: 4 }}>시술</div>
          <div style={{ fontSize: 16, color: GOLD }}>{serviceName || '관리 프로그램'}</div>
          {reviewerId ? (
            <div style={{ fontSize: 11, color: TEXT_SUB, marginTop: 6 }}>추천 리뷰어 연결됨</div>
          ) : null}
        </div>

        <div style={cardStyle}>
          <div style={{ fontSize: 13, marginBottom: 10 }}>별점</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <span
                key={n}
                onClick={() => setRating(n)}
                style={{ cursor: 'pointer', fontSize: 28, color: n <= rating ? GOLD : 'rgba(255,255,255,0.25)' }}
              >
                ★
              </span>
            ))}
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ fontSize: 13, marginBottom: 8 }}>후기 내용</div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="관리 받으신 후기를 남겨주세요 💜"
            rows={5}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              background: BG,
              border: `1px solid ${BORDER}`,
              borderRadius: 8,
              padding: 12,
              color: TEXT,
              fontSize: 14,
              resize: 'vertical',
              fontFamily: 'inherit',
            }}
          />
        </div>

        <div style={cardStyle}>
          <div style={{ fontSize: 13, marginBottom: 8 }}>사진 (최대 5장)</div>
          <input ref={photoRef} type="file" accept="image/*" multiple hidden onChange={(e) => {
            const list = Array.from(e.target.files || []).slice(0, 5)
            setPhotos(list)
          }} />
          <span
            onClick={() => photoRef.current?.click()}
            style={{ display: 'inline-block', cursor: 'pointer', fontSize: 12, color: PURPLE, border: `1px solid ${PURPLE}`, borderRadius: 20, padding: '6px 14px' }}
          >
            사진 선택 ({photos.length}/5)
          </span>
        </div>

        <div style={cardStyle}>
          <div style={{ fontSize: 13, marginBottom: 8 }}>영상 (최대 1개)</div>
          <input ref={videoRef} type="file" accept="video/*" hidden onChange={(e) => setVideoFile(e.target.files?.[0] || null)} />
          <span
            onClick={() => videoRef.current?.click()}
            style={{ display: 'inline-block', cursor: 'pointer', fontSize: 12, color: PURPLE, border: `1px solid ${PURPLE}`, borderRadius: 20, padding: '6px 14px' }}
          >
            {videoFile ? videoFile.name : '영상 선택'}
          </span>
        </div>

        <div style={cardStyle}>
          <div style={{ fontSize: 13, marginBottom: 8 }}>Before / After</div>
          <div style={{ display: 'flex', gap: 10 }}>
            <input ref={beforeRef} type="file" accept="image/*" hidden onChange={(e) => setBeforeFile(e.target.files?.[0] || null)} />
            <input ref={afterRef} type="file" accept="image/*" hidden onChange={(e) => setAfterFile(e.target.files?.[0] || null)} />
            <span onClick={() => beforeRef.current?.click()} style={{ flex: 1, cursor: 'pointer', textAlign: 'center', fontSize: 12, color: TEXT_SUB, border: `1px dashed ${BORDER}`, borderRadius: 8, padding: '10px 8px' }}>
              {beforeFile ? 'Before ✓' : 'Before'}
            </span>
            <span onClick={() => afterRef.current?.click()} style={{ flex: 1, cursor: 'pointer', textAlign: 'center', fontSize: 12, color: TEXT_SUB, border: `1px dashed ${BORDER}`, borderRadius: 8, padding: '10px 8px' }}>
              {afterFile ? 'After ✓' : 'After'}
            </span>
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ fontSize: 13, marginBottom: 10 }}>호르몬 위상</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {HORMONE_PHASES.map((p) => (
              <span
                key={p.key}
                onClick={() => setHormonePhase(p.key)}
                style={{
                  cursor: 'pointer',
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: `1px solid ${hormonePhase === p.key ? PURPLE : BORDER}`,
                  background: hormonePhase === p.key ? 'rgba(123,94,167,0.15)' : BG,
                  fontSize: 13,
                }}
              >
                {p.key} <span style={{ fontSize: 11, color: TEXT_SUB }}>({p.sub})</span>
              </span>
            ))}
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ fontSize: 13, marginBottom: 12 }}>이런 점이 좋았어요</div>
          {GOOD_TAG_CATEGORIES.map((cat) => (
            <div key={cat.label} style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: PURPLE, marginBottom: 8 }}>{cat.label}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {cat.chips.map((chip) => {
                  const selected = goodTags.includes(chip)
                  return (
                    <span
                      key={chip}
                      onClick={() => toggleGoodTag(chip)}
                      style={{
                        cursor: 'pointer',
                        fontSize: 12,
                        padding: '6px 12px',
                        borderRadius: 20,
                        border: `1px solid ${selected ? PURPLE : CHIP_BORDER}`,
                        background: selected ? 'rgba(123,94,167,0.12)' : CARD,
                        color: selected ? PURPLE : CHIP_TEXT,
                      }}
                    >
                      {chip}
                    </span>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        <div style={cardStyle}>
          <div style={{ fontSize: 13, marginBottom: 10 }}>효과 태그</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {EFFECT_TAGS.map((tag) => (
              <span
                key={tag}
                onClick={() => toggleTag(tag)}
                style={{
                  cursor: 'pointer',
                  fontSize: 12,
                  padding: '6px 12px',
                  borderRadius: 20,
                  border: `1px solid ${effectTags.includes(tag) ? GOLD : BORDER}`,
                  background: effectTags.includes(tag) ? 'rgba(201,169,110,0.12)' : BG,
                  color: effectTags.includes(tag) ? GOLD : TEXT_SUB,
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 13 }}>마이월드 스킨스타 공유</div>
            <div style={{ fontSize: 11, color: TEXT_SUB, marginTop: 4 }}>커뮤니티에 리뷰를 공유해요</div>
          </div>
          <span
            onClick={() => setIsShared((v) => !v)}
            style={{
              cursor: 'pointer',
              fontSize: 12,
              padding: '6px 14px',
              borderRadius: 20,
              border: `1px solid ${isShared ? PURPLE : BORDER}`,
              background: isShared ? 'rgba(123,94,167,0.2)' : BG,
              color: isShared ? PURPLE : TEXT_SUB,
            }}
          >
            {isShared ? 'ON' : 'OFF'}
          </span>
        </div>

        <div style={{ ...cardStyle, border: `1px solid rgba(201,169,110,0.35)`, background: 'rgba(201,169,110,0.08)' }}>
          <div style={{ fontSize: 13, color: GOLD, marginBottom: 6 }}>예상 토스트 적립</div>
          <div style={{ fontSize: 22, color: TEXT }}>+{expectedToast}T</div>
          <div style={{ fontSize: 11, color: TEXT_SUB, marginTop: 6, lineHeight: 1.5 }}>
            텍스트 {textToast}T
            {hasPhoto ? ` + 사진 ${imageToast}T` : ''}
            {hasVideo ? ` + 영상 ${videoToast}T` : ''}
          </div>
        </div>

        <span
          onClick={() => { if (!submitting) void onSubmit() }}
          style={{
            display: 'block',
            textAlign: 'center',
            cursor: submitting ? 'default' : 'pointer',
            padding: 14,
            borderRadius: 12,
            background: submitting ? SURFACE : PURPLE,
            color: submitting ? TEXT_SUB : '#fff',
            fontSize: 15,
            fontWeight: 500,
            opacity: rating && content.trim() ? 1 : 0.5,
          }}
        >
          {submitting ? '등록 중…' : '리뷰 등록하기 💜'}
        </span>
      </div>

      {toastMsg ? (
        <div style={{ position: 'fixed', left: '50%', bottom: 24, transform: 'translateX(-50%)', background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '10px 16px', fontSize: 13, zIndex: 100, maxWidth: '90%' }}>
          {toastMsg}
        </div>
      ) : null}
    </div>
  )
}
