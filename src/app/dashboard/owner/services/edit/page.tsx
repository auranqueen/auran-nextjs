'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { compressImage } from '@/lib/imageUpload'

const BG = '#ffffff'
const BG_CARD = '#f9f8fc'
const PURPLE = '#7B5EA7'
const PURPLE_LIGHT = '#EDE9F7'
const PURPLE_DARK = '#534AB7'
const GOLD = '#C9A96E'
const BORDER = '#ede9f7'
const TEXT = '#111111'
const TEXT_SUB = '#888888'

const SESSION_OPTS = [
  { sessions: 5, discount: 5 },
  { sessions: 10, discount: 10 },
]

const EFFECT_TAGS = [
  '수분', '탄력', '미백', '진정', '모공',
  '재생', '각질', '안티에이징', '콜라겐', '민감성',
]

const PHASE_OPTIONS = [
  { id: 'all', emoji: '🌿', name: '언제든 OK', desc: '시기 무관' },
  { id: 'gold', emoji: '✨', name: '황금기', desc: '생리 후~배란기' },
  { id: 'moon', emoji: '🌙', name: '달빛기', desc: '생리 중' },
  { id: 'bloom', emoji: '🌸', name: '만개기', desc: '배란 직후' },
  { id: 'fall', emoji: '🍂', name: '물들기', desc: '생리 전' },
]

const DURATION_OPTIONS = [30, 45, 60, 75, 90, 120]

const DIV_STYLES = ['solid', 'dashed', 'dotted', 'point', 'star'] as const

const PROMO_TYPES = ['할인 이벤트', '신규 오픈 특가', '재방문 감사', '시즌 특가']

type DetailBlock = {
  id: string
  type: 'title' | 'subtitle' | 'body' | 'image' | 'video' | 'divider'
  value: string
  divStyle?: string
  uploaded?: boolean
}

type HomecareProduct = { id: string; brand: string; name: string }

const cardStyle: CSSProperties = {
  background: BG,
  border: '0.5px solid #ede9f7',
  borderRadius: 12,
  padding: 15,
  marginBottom: 12,
}

function chipStyle(active: boolean): CSSProperties {
  return {
    padding: '8px 14px',
    borderRadius: 20,
    fontSize: 13,
    border: active ? '1px solid #7B5EA7' : '1px solid #7B5EA7',
    background: active ? '#7B5EA7' : '#EDE9F7',
    color: active ? '#fff' : '#534AB7',
    cursor: 'pointer',
  }
}

function parseServices(raw: unknown): Record<string, unknown>[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw as Record<string, unknown>[]
  return []
}

function renderDivider(style: string) {
  if (style === 'dashed') return <hr style={{ border: 'none', borderTop: '1px dashed #ccc', margin: '8px 0' }} />
  if (style === 'dotted') return <hr style={{ border: 'none', borderTop: '2px dotted #ccc', margin: '8px 0' }} />
  if (style === 'point') return <div style={{ textAlign: 'center', color: TEXT_SUB, letterSpacing: 8, margin: '8px 0' }}>● ● ●</div>
  if (style === 'star') return <div style={{ textAlign: 'center', color: GOLD, margin: '8px 0' }}>✦ ✦ ✦</div>
  return <hr style={{ border: 'none', borderTop: '1px solid #ccc', margin: '8px 0' }} />
}

export default function OwnerServiceEditPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const editId = searchParams.get('id')
  const supabaseRef = useRef(createClient())

  const [salonId, setSalonId] = useState<string | null>(null)
  const [serviceId] = useState(() => editId || crypto.randomUUID())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [divPickerFor, setDivPickerFor] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [thumbnails, setThumbnails] = useState<string[]>([])
  const [beforeUrl, setBeforeUrl] = useState('')
  const [afterUrl, setAfterUrl] = useState('')
  const [detailBlocks, setDetailBlocks] = useState<DetailBlock[]>([])
  const [price, setPrice] = useState('')
  const [costPrice, setCostPrice] = useState('')
  const [costOn, setCostOn] = useState(false)
  const [duration, setDuration] = useState(60)
  const [pkgOn, setPkgOn] = useState(false)
  const [discount5, setDiscount5] = useState('5')
  const [discount10, setDiscount10] = useState('10')
  const [selectedPhases, setSelectedPhases] = useState<string[]>(['all'])
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [videoUrl, setVideoUrl] = useState('')
  const [videoMode, setVideoMode] = useState<'upload' | 'url'>('upload')
  const [caution, setCaution] = useState('')
  const [partnerOn, setPartnerOn] = useState(false)
  const [partnerFee1, setPartnerFee1] = useState('10')
  const [partnerFee2, setPartnerFee2] = useState('5')
  const [promoOn, setPromoOn] = useState(false)
  const [promoType, setPromoType] = useState(PROMO_TYPES[0])
  const [promoDiscount, setPromoDiscount] = useState('10')
  const [promoStartDate, setPromoStartDate] = useState('')
  const [promoEndDate, setPromoEndDate] = useState('')
  const [reviewToastText, setReviewToastText] = useState('100')
  const [reviewToastImage, setReviewToastImage] = useState('300')
  const [reviewToastVideo, setReviewToastVideo] = useState('500')
  const [homecareProducts, setHomecareProducts] = useState<HomecareProduct[]>([])
  const [productSearch, setProductSearch] = useState('')
  const [productHits, setProductHits] = useState<HomecareProduct[]>([])
  const [bookingEnabled, setBookingEnabled] = useState(true)
  const [isPublic, setIsPublic] = useState(true)

  const showToast = (text: string, ms = 2000) => {
    setMsg(text)
    setTimeout(() => setMsg(''), ms)
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const supabase = supabaseRef.current
      const { data: auth } = await supabase.auth.getUser()
      const uid = auth.user?.id
      if (!uid) {
        router.push('/login')
        return
      }
      const { data: salon } = await supabase
        .from('salons')
        .select('id, services')
        .eq('owner_id', uid)
        .maybeSingle()
      if (cancelled) return
      if (!salon?.id) {
        setLoading(false)
        return
      }
      setSalonId(salon.id)

      if (editId) {
        const found = parseServices(salon.services).find((s) => s.id === editId)
        if (found) {
          setName(String(found.name || ''))
          setDescription(String(found.description || ''))
          setThumbnails(Array.isArray(found.thumbnails) ? (found.thumbnails as string[]) : found.thumbnail_url ? [String(found.thumbnail_url)] : [])
          setBeforeUrl(String(found.before_url || ''))
          setAfterUrl(String(found.after_url || ''))
          setDetailBlocks(Array.isArray(found.detail_blocks) ? (found.detail_blocks as DetailBlock[]) : [])
          setPrice(found.price != null ? String(found.price) : '')
          setCostPrice(found.cost_price != null ? String(found.cost_price) : '')
          setCostOn(Number(found.cost_price) > 0 && Number(found.cost_price) !== Number(found.price))
          setDuration(Number(found.duration_min) || 60)
          setPkgOn(Number(found.discount_5) > 0 || Number(found.discount_10) > 0)
          setDiscount5(String(found.discount_5 || 5))
          setDiscount10(String(found.discount_10 || 10))
          setSelectedPhases(Array.isArray(found.phase_tags) && (found.phase_tags as string[]).length ? (found.phase_tags as string[]) : ['all'])
          setSelectedTags(Array.isArray(found.effect_tags) ? (found.effect_tags as string[]) : [])
          setVideoUrl(String(found.video_url || ''))
          setCaution(String(found.caution || ''))
          setPartnerOn(!!found.partner_fee_enabled)
          setPartnerFee1(String(found.partner_fee_rate_first || 10))
          setPartnerFee2(String(found.partner_fee_rate_revisit || 5))
          setPromoOn(!!found.promo_enabled)
          setPromoType(String(found.promo_type || PROMO_TYPES[0]))
          setPromoDiscount(String(found.promo_discount || 10))
          setPromoStartDate(String(found.promo_start || ''))
          setPromoEndDate(String(found.promo_end || ''))
          setReviewToastText(String(found.review_toast_text ?? 100))
          setReviewToastImage(String(found.review_toast_image ?? 300))
          setReviewToastVideo(String(found.review_toast_video ?? 500))
          setHomecareProducts(Array.isArray(found.homecare_products) ? (found.homecare_products as HomecareProduct[]) : [])
          setBookingEnabled(found.booking_enabled !== false)
          setIsPublic(found.is_public !== false)
        }
      }

      await supabase.storage.listBuckets()
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [editId, router])

  useEffect(() => {
    if (!productSearch.trim()) {
      setProductHits([])
      return
    }
    const t = setTimeout(async () => {
      const { data } = await supabaseRef.current
        .from('products')
        .select('id,name,brand')
        .ilike('name', `%${productSearch.trim()}%`)
        .limit(5)
      setProductHits((data as HomecareProduct[]) || [])
    }, 300)
    return () => clearTimeout(t)
  }, [productSearch])

  const uploadImage = async (file: File): Promise<string> => {
    if (!salonId) throw new Error('no salon')
    const compressed = await compressImage(file, 'owner_store')
    const path = `${salonId}/${serviceId}/${Date.now()}_${compressed.name}`
    const { error } = await supabaseRef.current.storage.from('salon-services').upload(path, compressed, { upsert: true })
    if (error) throw error
    const { data } = supabaseRef.current.storage.from('salon-services').getPublicUrl(path)
    return data.publicUrl
  }

  const togglePhase = (id: string) => {
    if (id === 'all') {
      setSelectedPhases(['all'])
      return
    }
    setSelectedPhases((prev) => {
      const base = prev.filter((p) => p !== 'all')
      return base.includes(id) ? (base.length === 1 ? ['all'] : base.filter((p) => p !== id)) : [...base, id]
    })
  }

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]))
  }

  const addBlock = (type: DetailBlock['type']) => {
    const block: DetailBlock = { id: crypto.randomUUID(), type, value: '', divStyle: type === 'divider' ? 'solid' : undefined }
    setDetailBlocks((b) => [...b, block])
    if (type === 'divider') setDivPickerFor(block.id)
  }

  const moveBlock = (idx: number, dir: -1 | 1) => {
    setDetailBlocks((blocks) => {
      const next = [...blocks]
      const t = idx + dir
      if (t < 0 || t >= next.length) return blocks
      ;[next[idx], next[t]] = [next[t], next[idx]]
      return next
    })
  }

  const saveService = async (forcePublic?: boolean) => {
    if (!name.trim()) {
      showToast('관리 프로그램명을 입력해주세요')
      return
    }
    if (!price.trim()) {
      showToast('가격을 입력해주세요')
      return
    }
    if (!salonId) return
    setSaving(true)
    const publicVal = forcePublic !== undefined ? forcePublic : isPublic
    const serviceData: Record<string, unknown> = {
      id: editId || serviceId,
      name,
      description,
      detail_blocks: detailBlocks,
      price: Number(price),
      cost_price: costOn ? Number(costPrice) : Number(price),
      duration_min: duration,
      phase_tags: selectedPhases,
      effect_tags: selectedTags,
      thumbnail_url: thumbnails[0] || '',
      thumbnails,
      before_url: beforeUrl,
      after_url: afterUrl,
      video_url: videoUrl,
      caution,
      partner_fee_enabled: partnerOn,
      partner_fee_rate_first: partnerOn ? Number(partnerFee1) : 0,
      partner_fee_rate_revisit: partnerOn ? Number(partnerFee2) : 0,
      promo_enabled: promoOn,
      promo_type: promoOn ? promoType : '',
      promo_discount: promoOn ? Number(promoDiscount) : 0,
      promo_start: promoOn ? promoStartDate : '',
      promo_end: promoOn ? promoEndDate : '',
      review_toast_text: Number(reviewToastText),
      review_toast_image: Number(reviewToastImage),
      review_toast_video: Number(reviewToastVideo),
      homecare_products: homecareProducts,
      discount_5: pkgOn ? Number(discount5) : 0,
      discount_10: pkgOn ? Number(discount10) : 0,
      booking_enabled: bookingEnabled,
      is_public: publicVal,
      review_count: 0,
      avg_rating: 0,
      updated_at: new Date().toISOString(),
    }
    if (!editId) serviceData.created_at = new Date().toISOString()

    const { data: salon } = await supabaseRef.current.from('salons').select('services').eq('id', salonId).single()
    const existing = parseServices(salon?.services)
    const prev = editId ? existing.find((s) => s.id === editId) : null
    if (prev) {
      serviceData.review_count = prev.review_count ?? 0
      serviceData.avg_rating = prev.avg_rating ?? 0
      if (prev.created_at) serviceData.created_at = prev.created_at
    }
    let next: Record<string, unknown>[]
    if (editId) {
      next = existing.map((s) => (s.id === editId ? { ...s, ...serviceData } : s))
    } else {
      next = [...existing, serviceData]
    }
    const { error } = await supabaseRef.current.from('salons').update({ services: next }).eq('id', salonId)
    setSaving(false)
    if (error) {
      showToast('저장 실패')
      return
    }
    showToast('저장 완료 💜')
    setTimeout(() => router.push('/dashboard/owner/services'), 800)
  }

  const numPrice = Number(price) || 0
  const numCost = costOn ? Number(costPrice) || 0 : numPrice
  const marginPct = numPrice > 0 ? Math.round(((numPrice - numCost) / numPrice) * 100) : 0

  const cardTitle = (n: number, title: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
      <span style={{ width: 24, height: 24, borderRadius: '50%', background: PURPLE_LIGHT, color: PURPLE, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600 }}>{n}</span>
      <span style={{ fontSize: 15, fontWeight: 500, color: PURPLE_DARK }}>{title}</span>
    </div>
  )

  if (loading) {
    return <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center', color: TEXT_SUB }}>불러오는 중…</div>
  }

  return (
    <div style={{ minHeight: '100vh', background: BG, color: TEXT, paddingBottom: 100 }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', borderBottom: `0.5px solid ${BORDER}` }}>
        <button type="button" onClick={() => router.push('/dashboard/owner/services')} style={{ border: 'none', background: 'transparent', fontSize: 14, color: PURPLE_DARK, cursor: 'pointer' }}>←</button>
        <div style={{ flex: 1, textAlign: 'center', fontSize: 16, fontWeight: 500 }}>{editId ? '프로그램 수정' : '프로그램 등록'}</div>
        <div style={{ width: 24 }} />
      </div>

      <div style={{ padding: 16 }}>
        {/* 카드 1 */}
        <div style={cardStyle}>
          {cardTitle(1, '기본 정보')}
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예) 진정 수딩 에센스 팩"
            style={{ width: '100%', padding: 12, borderRadius: 8, border: `1px solid ${BORDER}`, marginBottom: 10, fontSize: 14, boxSizing: 'border-box' }}
          />
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="예) 민감한 피부를 위한 수딩 시술입니다. 진정 토너와..."
            style={{ width: '100%', padding: 12, borderRadius: 8, border: `1px solid ${BORDER}`, fontSize: 14, boxSizing: 'border-box' }}
          />
        </div>

        {/* 카드 2 */}
        <div style={cardStyle}>
          {cardTitle(2, '사진 · B/A · 상세')}
          <div style={{ fontSize: 13, color: TEXT_SUB, marginBottom: 8 }}>썸네일 (최대 5장)</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            {thumbnails.map((url, i) => (
              <div key={i} style={{ position: 'relative', width: 80, height: 80 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8 }} />
                <button type="button" onClick={() => setThumbnails((t) => t.filter((_, j) => j !== i))} style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%', border: 'none', background: PURPLE, color: '#fff', fontSize: 11, cursor: 'pointer' }}>×</button>
              </div>
            ))}
            {thumbnails.length < 5 ? (
              <label style={{ width: 80, height: 80, borderRadius: 8, border: `1px dashed ${PURPLE}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 24, color: PURPLE }}>
                +
                <input type="file" accept="image/*" hidden onChange={async (e) => {
                  const f = e.target.files?.[0]
                  if (!f) return
                  try {
                    const url = await uploadImage(f)
                    setThumbnails((t) => [...t, url].slice(0, 5))
                  } catch { showToast('업로드 실패') }
                  e.target.value = ''
                }} />
              </label>
            ) : null}
          </div>
          <div style={{ fontSize: 13, color: TEXT_SUB, marginBottom: 8 }}>Before / After</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            {(['before', 'after'] as const).map((kind) => {
              const url = kind === 'before' ? beforeUrl : afterUrl
              const setUrl = kind === 'before' ? setBeforeUrl : setAfterUrl
              return (
                <label key={kind} style={{ aspectRatio: '1', borderRadius: 8, border: `1px solid ${BORDER}`, background: BG_CARD, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden' }}>
                  {url ? <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 12, color: TEXT_SUB }}>{kind === 'before' ? 'Before' : 'After'}</span>}
                  <input type="file" accept="image/*" hidden onChange={async (e) => {
                    const f = e.target.files?.[0]
                    if (!f) return
                    try { setUrl(await uploadImage(f)) } catch { showToast('업로드 실패') }
                    e.target.value = ''
                  }} />
                </label>
              )
            })}
          </div>
          <div style={{ fontSize: 12, color: TEXT_SUB, lineHeight: 1.6, marginBottom: 12 }}>
            원장님 사진은 시술 상세에 고정 노출
            <br />
            고객이 리뷰에서 올리는 B/A도 함께 표시 💜
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
            {(['title', 'subtitle', 'body', 'image', 'video', 'divider'] as const).map((t) => (
              <button key={t} type="button" onClick={() => addBlock(t)} style={chipStyle(false)}>
                {t === 'title' ? '제목' : t === 'subtitle' ? '소제목' : t === 'body' ? '본문' : t === 'image' ? '이미지' : t === 'video' ? '영상' : '구분선'}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 11, color: TEXT_SUB, marginBottom: 10 }}>구분선: 예) 실선 · 점선 · 도트 · 포인트(●) · 장식(✦)</div>
          {detailBlocks.map((block, idx) => (
            <div key={block.id} style={{ background: BG_CARD, borderRadius: 8, padding: 10, marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: PURPLE }}>{block.type}</span>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button type="button" onClick={() => moveBlock(idx, -1)} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}>↑</button>
                  <button type="button" onClick={() => moveBlock(idx, 1)} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}>↓</button>
                  <button type="button" onClick={() => setDetailBlocks((b) => b.filter((x) => x.id !== block.id))} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}>×</button>
                </div>
              </div>
              {block.type === 'divider' ? (
                <div>
                  {renderDivider(block.divStyle || 'solid')}
                  {divPickerFor === block.id ? (
                    <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                      {DIV_STYLES.map((s) => (
                        <button key={s} type="button" onClick={() => {
                          setDetailBlocks((b) => b.map((x) => x.id === block.id ? { ...x, divStyle: s } : x))
                          setDivPickerFor(null)
                        }} style={chipStyle(block.divStyle === s)}>{s}</button>
                      ))}
                    </div>
                  ) : (
                    <button type="button" onClick={() => setDivPickerFor(block.id)} style={{ fontSize: 12, color: PURPLE, border: 'none', background: 'transparent', cursor: 'pointer' }}>스타일 변경</button>
                  )}
                </div>
              ) : block.type === 'image' ? (
                <div>
                  {block.value ? <img src={block.value} alt="" style={{ maxWidth: '100%', borderRadius: 8 }} /> : null}
                  <label style={{ display: 'inline-block', marginTop: 6, fontSize: 12, color: PURPLE, cursor: 'pointer' }}>
                    이미지 업로드
                    <input type="file" accept="image/*" hidden onChange={async (e) => {
                      const f = e.target.files?.[0]
                      if (!f) return
                      try {
                        const url = await uploadImage(f)
                        setDetailBlocks((b) => b.map((x) => x.id === block.id ? { ...x, value: url, uploaded: true } : x))
                      } catch { showToast('업로드 실패') }
                      e.target.value = ''
                    }} />
                  </label>
                </div>
              ) : (
                <textarea
                  value={block.value}
                  onChange={(e) => setDetailBlocks((b) => b.map((x) => x.id === block.id ? { ...x, value: e.target.value } : x))}
                  rows={block.type === 'body' ? 4 : 2}
                  placeholder={block.type === 'title' ? '예) 프로그램 소개' : block.type === 'subtitle' ? '예) 이런 분께 추천해요' : block.type === 'body' ? '예) 시술 과정과 효과를 자세히 적어주세요' : block.type === 'video' ? '예) https://youtube.com/watch?v=...' : ''}
                  style={{ width: '100%', padding: 8, borderRadius: 6, border: `1px solid ${BORDER}`, fontSize: 13, boxSizing: 'border-box' }}
                />
              )}
            </div>
          ))}
        </div>

        {/* 카드 3 */}
        <div style={cardStyle}>
          {cardTitle(3, '가격 · 소요시간')}
          <input value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d]/g, ''))} placeholder="예) 100,000" style={{ width: '100%', padding: 12, borderRadius: 8, border: `1px solid ${BORDER}`, marginBottom: 10, boxSizing: 'border-box' }} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: 13 }}>
            <input type="checkbox" checked={costOn} onChange={(e) => setCostOn(e.target.checked)} />
            원가 입력
          </label>
          {costOn ? (
            <>
              <input value={costPrice} onChange={(e) => setCostPrice(e.target.value.replace(/[^\d]/g, ''))} placeholder="예) 40,000" style={{ width: '100%', padding: 12, borderRadius: 8, border: `1px solid ${BORDER}`, marginBottom: 6, boxSizing: 'border-box' }} />
              <div style={{ fontSize: 12, color: TEXT_SUB, marginBottom: 10 }}>마진 {marginPct}% (₩{(numPrice - numCost).toLocaleString()})</div>
            </>
          ) : null}
          <div style={{ fontSize: 13, color: TEXT_SUB, marginBottom: 8 }}>소요시간 <span style={{ fontSize: 11 }}>(예) 50분)</span></div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            {DURATION_OPTIONS.map((d) => (
              <button key={d} type="button" onClick={() => setDuration(d)} style={chipStyle(duration === d)}>{d}분</button>
            ))}
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: 13 }}>
            <input type="checkbox" checked={pkgOn} onChange={(e) => setPkgOn(e.target.checked)} />
            다회권 할인
          </label>
          {pkgOn ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {SESSION_OPTS.map((o) => {
                const disc = o.sessions === 5 ? discount5 : discount10
                const setDisc = o.sessions === 5 ? setDiscount5 : setDiscount10
                const total = numPrice * o.sessions * (1 - Number(disc) / 100)
                return (
                  <div key={o.sessions} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                    <span>{o.sessions}회</span>
                    <input value={disc} onChange={(e) => setDisc(e.target.value.replace(/[^\d]/g, ''))} style={{ width: 48, padding: 6, borderRadius: 6, border: `1px solid ${BORDER}` }} />
                    <span>% → ₩{Math.round(total).toLocaleString()}</span>
                  </div>
                )
              })}
            </div>
          ) : null}
        </div>

        {/* 카드 4 */}
        <div style={cardStyle}>
          {cardTitle(4, '호르몬 위상')}
          <div style={{ fontSize: 12, color: TEXT_SUB, marginBottom: 8 }}>예) 황금기·만개기에 추천하는 프로그램이면 해당 위상을 선택하세요</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {PHASE_OPTIONS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => togglePhase(p.id)}
                style={{
                  ...chipStyle(selectedPhases.includes(p.id)),
                  gridColumn: p.id === 'all' ? '1 / -1' : undefined,
                  textAlign: 'left',
                  padding: 12,
                }}
              >
                <div>{p.emoji} {p.name}</div>
                <div style={{ fontSize: 11, opacity: 0.8, marginTop: 2 }}>{p.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* 카드 5 */}
        <div style={cardStyle}>
          {cardTitle(5, '효과 태그')}
          <div style={{ fontSize: 12, color: TEXT_SUB, marginBottom: 8 }}>예) 진정, 수딩, 촉촉, 밝음 — 아래에서 선택하세요</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {EFFECT_TAGS.map((tag) => (
              <button key={tag} type="button" onClick={() => toggleTag(tag)} style={chipStyle(selectedTags.includes(tag))}>{tag}</button>
            ))}
          </div>
        </div>

        {/* 카드 6 */}
        <div style={cardStyle}>
          {cardTitle(6, '소개 영상')}
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <button type="button" onClick={() => setVideoMode('upload')} style={chipStyle(videoMode === 'upload')}>파일 업로드</button>
            <button type="button" onClick={() => setVideoMode('url')} style={chipStyle(videoMode === 'url')}>URL</button>
          </div>
          {videoMode === 'upload' ? (
            <label style={{ display: 'block', padding: 12, border: `1px dashed ${PURPLE}`, borderRadius: 8, textAlign: 'center', cursor: 'pointer', fontSize: 13, color: PURPLE }}>
              영상 파일 선택
              <input type="file" accept="video/*" hidden onChange={async (e) => {
                const f = e.target.files?.[0]
                if (!f || !salonId) return
                try {
                  const path = `${salonId}/${serviceId}/${Date.now()}_${f.name}`
                  const { error } = await supabaseRef.current.storage.from('salon-services').upload(path, f, { upsert: true })
                  if (error) throw error
                  const { data } = supabaseRef.current.storage.from('salon-services').getPublicUrl(path)
                  setVideoUrl(data.publicUrl)
                } catch { showToast('업로드 실패') }
                e.target.value = ''
              }} />
            </label>
          ) : (
            <input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="예) https://youtube.com/watch?v=..." style={{ width: '100%', padding: 12, borderRadius: 8, border: `1px solid ${BORDER}`, boxSizing: 'border-box' }} />
          )}
          {videoUrl ? <div style={{ fontSize: 11, color: TEXT_SUB, marginTop: 6, wordBreak: 'break-all' }}>{videoUrl}</div> : null}
        </div>

        {/* 카드 7 */}
        <div style={cardStyle}>
          {cardTitle(7, '주의사항')}
          <textarea value={caution} onChange={(e) => setCaution(e.target.value)} rows={4} placeholder={'예) • 민감한 피부는 패치 테스트 권장\n• 시술 후 24시간 보습 필수'} style={{ width: '100%', padding: 12, borderRadius: 8, border: `1px solid ${BORDER}`, fontSize: 14, boxSizing: 'border-box' }} />
        </div>

        {/* 카드 8 */}
        <div style={cardStyle}>
          {cardTitle(8, '파트너스 수수료')}
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, fontSize: 13 }}>
            <input type="checkbox" checked={partnerOn} onChange={(e) => setPartnerOn(e.target.checked)} />
            파트너스 수수료 적용
          </label>
          {partnerOn ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
              <div>첫방문 <input value={partnerFee1} onChange={(e) => setPartnerFee1(e.target.value.replace(/[^\d.]/g, ''))} style={{ width: 56, marginLeft: 8, padding: 6, borderRadius: 6, border: `1px solid ${BORDER}` }} />% → ₩{Math.round(numPrice * Number(partnerFee1) / 100).toLocaleString()}</div>
              <div>재방문 <input value={partnerFee2} onChange={(e) => setPartnerFee2(e.target.value.replace(/[^\d.]/g, ''))} style={{ width: 56, marginLeft: 8, padding: 6, borderRadius: 6, border: `1px solid ${BORDER}` }} />% → ₩{Math.round(numPrice * Number(partnerFee2) / 100).toLocaleString()}</div>
            </div>
          ) : null}
        </div>

        {/* 카드 9 */}
        <div style={cardStyle}>
          {cardTitle(9, '이벤트')}
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, fontSize: 13 }}>
            <input type="checkbox" checked={promoOn} onChange={(e) => setPromoOn(e.target.checked)} />
            이벤트 진행
          </label>
          {promoOn ? (
            <>
              <div style={{ fontSize: 12, color: TEXT_SUB, marginBottom: 8 }}>예) 시즌 특가 · 10% 할인 · 2026-03-01 ~ 2026-03-31</div>
              <select value={promoType} onChange={(e) => setPromoType(e.target.value)} style={{ width: '100%', padding: 10, borderRadius: 8, border: `1px solid ${BORDER}`, marginBottom: 8 }}>
                {PROMO_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <div style={{ fontSize: 13, marginBottom: 8 }}>
                할인율 <input value={promoDiscount} onChange={(e) => setPromoDiscount(e.target.value.replace(/[^\d]/g, ''))} placeholder="예) 10" style={{ width: 48, marginLeft: 8, padding: 6, borderRadius: 6, border: `1px solid ${BORDER}` }} />%
                → ₩{Math.round(numPrice * (1 - Number(promoDiscount) / 100)).toLocaleString()}
              </div>
              <input type="date" value={promoStartDate} onChange={(e) => setPromoStartDate(e.target.value)} style={{ width: '100%', padding: 10, borderRadius: 8, border: `1px solid ${BORDER}`, marginBottom: 8, boxSizing: 'border-box' }} />
              <input type="date" value={promoEndDate} onChange={(e) => setPromoEndDate(e.target.value)} style={{ width: '100%', padding: 10, borderRadius: 8, border: `1px solid ${BORDER}`, boxSizing: 'border-box' }} />
            </>
          ) : null}
        </div>

        {/* 카드 10 */}
        <div style={cardStyle}>
          {cardTitle(10, '리뷰 토스트')}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <div><div style={{ fontSize: 11, color: TEXT_SUB, marginBottom: 4 }}>텍스트</div><input value={reviewToastText} onChange={(e) => setReviewToastText(e.target.value.replace(/[^\d]/g, ''))} style={{ width: '100%', padding: 8, borderRadius: 6, border: `1px solid ${BORDER}`, boxSizing: 'border-box' }} /></div>
            <div><div style={{ fontSize: 11, color: TEXT_SUB, marginBottom: 4 }}>이미지</div><input value={reviewToastImage} onChange={(e) => setReviewToastImage(e.target.value.replace(/[^\d]/g, ''))} style={{ width: '100%', padding: 8, borderRadius: 6, border: `1px solid ${BORDER}`, boxSizing: 'border-box' }} /></div>
            <div><div style={{ fontSize: 11, color: TEXT_SUB, marginBottom: 4 }}>영상</div><input value={reviewToastVideo} onChange={(e) => setReviewToastVideo(e.target.value.replace(/[^\d]/g, ''))} style={{ width: '100%', padding: 8, borderRadius: 6, border: `1px solid ${BORDER}`, boxSizing: 'border-box' }} /></div>
          </div>
          <div style={{ fontSize: 12, color: TEXT_SUB, marginTop: 8 }}>기본값이에요. 수정하세요 💜</div>
        </div>

        {/* 카드 11 */}
        <div style={cardStyle}>
          {cardTitle(11, '홈케어 추천 제품')}
          <input value={productSearch} onChange={(e) => setProductSearch(e.target.value)} placeholder="예) 세라마이드 앰플" style={{ width: '100%', padding: 12, borderRadius: 8, border: `1px solid ${BORDER}`, marginBottom: 8, boxSizing: 'border-box' }} />
          {productHits.map((p) => (
            <button key={p.id} type="button" onClick={() => {
              if (homecareProducts.some((h) => h.id === p.id)) return
              setHomecareProducts((h) => [...h, p])
              setProductSearch('')
              setProductHits([])
            }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 0', border: 'none', borderBottom: `1px solid ${BORDER}`, background: 'transparent', cursor: 'pointer', fontSize: 13 }}>
              {p.brand} · {p.name}
            </button>
          ))}
          {homecareProducts.map((p) => (
            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', fontSize: 13 }}>
              <span>{p.brand} · {p.name}</span>
              <button type="button" onClick={() => setHomecareProducts((h) => h.filter((x) => x.id !== p.id))} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: TEXT_SUB }}>×</button>
            </div>
          ))}
        </div>

        {/* 카드 12 */}
        <div style={cardStyle}>
          {cardTitle(12, '예약 · 공개 설정')}
          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, fontSize: 14 }}>
            <span>예약 받기</span>
            <input type="checkbox" checked={bookingEnabled} onChange={(e) => setBookingEnabled(e.target.checked)} />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 14 }}>
            <span>저장 즉시 공개</span>
            <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
          </label>
        </div>
      </div>

      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: BG, borderTop: `0.5px solid ${BORDER}`, padding: '12px 16px', display: 'flex', gap: 10, zIndex: 50 }}>
        <button type="button" disabled={saving} onClick={() => void saveService(false)} style={{ flex: 1, padding: 14, borderRadius: 10, border: `1px solid ${PURPLE}`, background: PURPLE_LIGHT, color: PURPLE_DARK, fontSize: 14, cursor: 'pointer' }}>
          임시저장
        </button>
        <button type="button" disabled={saving} onClick={() => void saveService()} style={{ flex: 1, padding: 14, borderRadius: 10, border: 'none', background: PURPLE, color: '#fff', fontSize: 14, cursor: 'pointer' }}>
          저장 완료 💜
        </button>
      </div>

      {msg ? (
        <div style={{ position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: 80, background: PURPLE, color: '#fff', borderRadius: 12, padding: '10px 16px', fontSize: 13, zIndex: 60 }}>
          {msg}
        </div>
      ) : null}
    </div>
  )
}
