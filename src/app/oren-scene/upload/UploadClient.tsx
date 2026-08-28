'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { uploadVideoToStorage } from '@/lib/product/productFormUtils'

const BG = '#0D0B09'
const CARD = 'rgba(255,255,255,0.04)'
const BORDER = 'rgba(255,255,255,0.12)'
const PURPLE = '#7B5EA7'
const GOLD = '#C9A96E'
const TEXT = '#fff'
const TEXT_SUB = 'rgba(255,255,255,0.55)'

type Role = 'owner' | 'customer' | 'other'
type CustomerMode = 'verified' | 'free'
type OwnerLink = 'booking' | 'brand_product'

type Evidence =
  | { kind: 'booking'; id: string; label: string; sub: string; salon_id: string }
  | { kind: 'order_item'; id: string; label: string; sub: string; salon_id: string | null }

type BrandProductOpt = { id: string; name: string; brand_id: string; brand_name?: string | null }
type SalonOpt = { id: string; name: string }

function readVideoMeta(file: File): Promise<{ duration: number; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.onloadedmetadata = () => {
      const duration = Number(video.duration) || 0
      const width = Number(video.videoWidth) || 0
      const height = Number(video.videoHeight) || 0
      URL.revokeObjectURL(url)
      resolve({ duration, width, height })
    }
    video.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('video_meta_failed'))
    }
    video.src = url
  })
}

async function validateVideoFile(file: File): Promise<string | null> {
  const isMp4 =
    file.type === 'video/mp4' || file.name.toLowerCase().endsWith('.mp4')
  if (!isMp4) return 'mp4 파일만 업로드할 수 있어요'
  try {
    const meta = await readVideoMeta(file)
    if (meta.duration > 60.5) return '영상은 60초 이내여야 해요'
    if (meta.width > 0 && meta.height > 0) {
      const ratio = meta.width / meta.height
      const target = 9 / 16
      if (Math.abs(ratio - target) > 0.12) {
        return '세로(9:16) 비율 영상을 올려주세요'
      }
    }
  } catch {
    return '영상 정보를 읽을 수 없어요'
  }
  return null
}

export default function OrenSceneUploadInner() {
  const router = useRouter()
  const search = useSearchParams()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [role, setRole] = useState<Role>('other')
  const [userId, setUserId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // owner
  const [salonId, setSalonId] = useState<string | null>(null)
  const [salonName, setSalonName] = useState('')
  const [ownerLink, setOwnerLink] = useState<OwnerLink>('booking')
  const [brandProducts, setBrandProducts] = useState<BrandProductOpt[]>([])
  const [brandProductId, setBrandProductId] = useState<string>('')

  // customer
  const modeParam = search.get('mode')
  const [customerMode, setCustomerMode] = useState<CustomerMode>(
    modeParam === 'free' ? 'free' : 'verified',
  )
  const [evidence, setEvidence] = useState<Evidence[]>([])
  const [evidenceKey, setEvidenceKey] = useState('')
  const [freeSalons, setFreeSalons] = useState<SalonOpt[]>([])
  const [freeSalonId, setFreeSalonId] = useState('')
  const [freeProductQuery, setFreeProductQuery] = useState('')
  const [freeProducts, setFreeProducts] = useState<BrandProductOpt[]>([])
  const [freeProductId, setFreeProductId] = useState('')
  const [freeProductsLoading, setFreeProductsLoading] = useState(false)

  // shared
  const [title, setTitle] = useState('')
  const [highlightTag, setHighlightTag] = useState('')
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [videoPreview, setVideoPreview] = useState<string | null>(null)

  const selectedEvidence = useMemo(
    () => evidence.find((e) => `${e.kind}:${e.id}` === evidenceKey) || null,
    [evidence, evidenceKey],
  )

  const bootstrap = useCallback(async () => {
    setLoading(true)
    setError('')
    const { data: auth } = await supabase.auth.getUser()
    if (!auth.user) {
      router.replace(
        `/login?role=customer&redirect=${encodeURIComponent('/oren-scene/upload')}`,
      )
      return
    }
    const { data: me } = await supabase
      .from('users')
      .select('id, role')
      .eq('auth_id', auth.user.id)
      .maybeSingle()
    if (!me?.id) {
      setError('회원 정보를 찾을 수 없어요')
      setLoading(false)
      return
    }
    setUserId(me.id)
    const r = me.role === 'owner' ? 'owner' : me.role === 'customer' ? 'customer' : 'other'
    setRole(r)

    if (r === 'owner') {
      const qSalon = search.get('salon_id')
      let salonQuery = supabase.from('salons').select('id, name').eq('owner_id', me.id)
      const { data: salons } = await salonQuery
      const list = salons || []
      const picked = (qSalon && list.find((s) => s.id === qSalon)) || list[0] || null
      if (!picked) {
        setError('소유한 살롱이 없어요')
        setLoading(false)
        return
      }
      setSalonId(picked.id)
      setSalonName(String(picked.name || '내 살롱'))
      const { data: prods } = await supabase
        .from('brand_products')
        .select('id, name, brand_id, status')
        .eq('status', 'active')
        .limit(80)
      setBrandProducts(
        ((prods || []) as BrandProductOpt[]).map((p) => ({
          id: p.id,
          name: p.name,
          brand_id: p.brand_id,
        })),
      )
      // Prefer salon-linked products when API exists
      try {
        const res = await fetch(`/api/salons/${picked.id}/brand-products`)
        const json = await res.json().catch(() => ({}))
        const rows = Array.isArray(json?.products) ? json.products : []
        if (Array.isArray(rows) && rows.length) {
          setBrandProducts(
            rows.map((p: any) => ({
              id: String(p.id || p.brand_product_id),
              name: String(p.name || '제품'),
              brand_id: String(p.brand_id || ''),
            })),
          )
        }
      } catch {
        /* keep fallback */
      }
    } else if (r === 'customer') {
      // verified evidence
      const [{ data: bookings }, { data: orders }] = await Promise.all([
        supabase
          .from('bookings')
          .select('id, salon_id, service_name, status, salons(name)')
          .eq('customer_id', me.id)
          .eq('status', '완료')
          .order('created_at', { ascending: false })
          .limit(40),
        supabase
          .from('brand_product_orders')
          .select(
            'id, salon_id, status, order_no, brand_product_order_items(id, product_name, brand_product_id)',
          )
          .eq('customer_id', me.id)
          .in('status', ['배송완료', '구매확정'])
          .order('ordered_at', { ascending: false })
          .limit(40),
      ])
      const ev: Evidence[] = []
      for (const b of bookings || []) {
        const salonName =
          (b as any).salons?.name || (Array.isArray((b as any).salons) ? (b as any).salons[0]?.name : '') || '살롱'
        ev.push({
          kind: 'booking',
          id: b.id,
          label: String((b as any).service_name || '시술'),
          sub: `예약완료 · ${salonName}`,
          salon_id: String(b.salon_id),
        })
      }
      for (const o of orders || []) {
        const items = ((o as any).brand_product_order_items || []) as any[]
        for (const it of items) {
          ev.push({
            kind: 'order_item',
            id: String(it.id),
            label: String(it.product_name || '제품'),
            sub: `구매 · ${o.status} · ${o.order_no || ''}`,
            salon_id: o.salon_id ? String(o.salon_id) : null,
          })
        }
      }
      setEvidence(ev)

      const { data: salons } = await supabase
        .from('salons')
        .select('id, name')
        .eq('status', 'active')
        .order('name', { ascending: true })
        .limit(80)
      setFreeSalons(
        (salons || []).map((row) => ({
          id: String(row.id),
          name: String(row.name || '살롱'),
        })),
      )
    } else {
      setError('고객 또는 원장 계정으로 로그인해 주세요')
    }
    setLoading(false)
  }, [router, search, supabase])

  useEffect(() => {
    void bootstrap()
  }, [bootstrap])

  useEffect(() => {
    return () => {
      if (videoPreview) URL.revokeObjectURL(videoPreview)
    }
  }, [videoPreview])

  // Free reel: salon-store brand product search
  useEffect(() => {
    if (role !== 'customer' || customerMode !== 'free' || !freeSalonId) {
      setFreeProducts([])
      return
    }
    let cancelled = false
    const timer = setTimeout(async () => {
      setFreeProductsLoading(true)
      try {
        const params = new URLSearchParams()
        params.set('limit', '30')
        const q = freeProductQuery.trim()
        if (q.length >= 2) params.set('q', q)
        const res = await fetch(
          `/api/salons/${encodeURIComponent(freeSalonId)}/brand-products?${params.toString()}`,
        )
        const json = await res.json().catch(() => ({}))
        if (cancelled) return
        if (json?.locked) {
          setFreeProducts([])
          return
        }
        const rows = Array.isArray(json?.products) ? json.products : []
        setFreeProducts(
          rows.map((row: { id?: string; name?: string; brand_id?: string; brand_name?: string | null }) => ({
            id: String(row.id),
            name: String(row.name || '제품'),
            brand_id: String(row.brand_id || ''),
            brand_name: row.brand_name ? String(row.brand_name) : null,
          })),
        )
      } catch {
        if (!cancelled) setFreeProducts([])
      } finally {
        if (!cancelled) setFreeProductsLoading(false)
      }
    }, 280)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [role, customerMode, freeSalonId, freeProductQuery])

  const onPickVideo = async (file: File | null) => {
    setError('')
    if (videoPreview) URL.revokeObjectURL(videoPreview)
    setVideoPreview(null)
    setVideoFile(null)
    if (!file) return
    const err = await validateVideoFile(file)
    if (err) {
      setError(err)
      return
    }
    setVideoFile(file)
    setVideoPreview(URL.createObjectURL(file))
  }

  const submit = async () => {
    if (submitting) return
    const t = title.trim()
    if (!t) {
      setError('제목을 입력해주세요')
      return
    }
    if (t.length > 80) {
      setError('제목은 80자까지예요')
      return
    }
    if (!videoFile) {
      setError('영상을 선택해주세요')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const path = `oren-scene/${userId || 'anon'}/${Date.now()}.mp4`
      const videoUrl = await uploadVideoToStorage(videoFile, path)

      let body: Record<string, unknown> = {
        title: t,
        video_url: videoUrl,
        highlight_tag: highlightTag.trim() || null,
      }

      if (role === 'owner') {
        if (!salonId) throw new Error('salon_missing')
        body = {
          ...body,
          content_type: 'owner',
          salon_id: salonId,
          link_type: ownerLink,
          brand_product_id: ownerLink === 'brand_product' ? brandProductId || null : null,
          product_id: null,
        }
        if (ownerLink === 'brand_product' && !brandProductId) {
          setError('연결할 제품을 선택해주세요')
          setSubmitting(false)
          return
        }
      } else if (role === 'customer' && customerMode === 'verified') {
        if (!selectedEvidence) {
          setError('인증할 예약 또는 구매를 선택해주세요')
          setSubmitting(false)
          return
        }
        body = {
          ...body,
          content_type: 'verified',
          booking_id: selectedEvidence.kind === 'booking' ? selectedEvidence.id : null,
          order_item_id: selectedEvidence.kind === 'order_item' ? selectedEvidence.id : null,
        }
      } else if (role === 'customer' && customerMode === 'free') {
        if (freeProductId && !freeSalonId) {
          setError('제품을 태깅하려면 살롱을 선택해주세요')
          setSubmitting(false)
          return
        }
        body = {
          ...body,
          content_type: 'free',
          link_type: freeProductId ? 'brand_product' : 'none',
          product_id: null,
          brand_product_id: freeProductId || null,
          salon_id: freeSalonId || null,
        }
      } else {
        setError('업로드할 수 없는 계정이에요')
        setSubmitting(false)
        return
      }

      const res = await fetch('/api/oren-scene-posts/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json().catch(() => ({}))
      if (!json?.ok) {
        setError(json?.error || '업로드에 실패했어요')
        setSubmitting(false)
        return
      }
      const postId = json.post?.id
      if (postId) router.replace(`/oren-scene/${postId}`)
      else router.replace('/')
    } catch (e: any) {
      setError(e?.message || '업로드 중 오류가 발생했어요')
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: BG, color: TEXT_SUB, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        불러오는 중…
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: BG, color: TEXT, maxWidth: 480, margin: '0 auto', padding: '16px 16px 40px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <button type="button" onClick={() => router.back()} style={{ border: 'none', background: 'transparent', color: TEXT, fontSize: 20, cursor: 'pointer' }}>
          ←
        </button>
        <div style={{ fontSize: 16, fontWeight: 800 }}>오렌씬 업로드</div>
      </div>

      {role === 'customer' ? (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button
            type="button"
            onClick={() => setCustomerMode('verified')}
            style={{
              flex: 1,
              border: 'none',
              borderRadius: 10,
              padding: '10px 0',
              background: customerMode === 'verified' ? PURPLE : CARD,
              color: TEXT,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            + 인증릴스
          </button>
          <button
            type="button"
            onClick={() => setCustomerMode('free')}
            style={{
              flex: 1,
              border: 'none',
              borderRadius: 10,
              padding: '10px 0',
              background: customerMode === 'free' ? PURPLE : CARD,
              color: TEXT,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            공유+ 자유릴스
          </button>
        </div>
      ) : null}

      {role === 'owner' ? (
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 12, marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: TEXT_SUB, marginBottom: 4 }}>내 살롱</div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{salonName}</div>
        </div>
      ) : null}

      {role === 'customer' && customerMode === 'verified' ? (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: TEXT_SUB, marginBottom: 8 }}>인증할 예약·구매 선택</div>
          {evidence.length === 0 ? (
            <div style={{ fontSize: 13, color: TEXT_SUB, padding: 16, border: `1px dashed ${BORDER}`, borderRadius: 12 }}>
              완료된 예약 또는 배송완료/구매확정 주문이 없어요
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 220, overflowY: 'auto' }}>
              {evidence.map((e) => {
                const key = `${e.kind}:${e.id}`
                const on = evidenceKey === key
                return (
                  <label
                    key={key}
                    style={{
                      display: 'flex',
                      gap: 10,
                      alignItems: 'flex-start',
                      border: on ? `1px solid ${GOLD}` : `1px solid ${BORDER}`,
                      borderRadius: 10,
                      padding: 10,
                      cursor: 'pointer',
                      background: CARD,
                    }}
                  >
                    <input type="radio" name="evidence" checked={on} onChange={() => setEvidenceKey(key)} />
                    <span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>{e.label}</span>
                      <br />
                      <span style={{ fontSize: 11, color: TEXT_SUB }}>{e.sub}</span>
                    </span>
                  </label>
                )
              })}
            </div>
          )}
        </div>
      ) : null}

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: TEXT_SUB, marginBottom: 6 }}>제목 (필수)</div>
        <input
          value={title}
          maxLength={80}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="릴스 제목"
          style={{ width: '100%', boxSizing: 'border-box', background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '11px 12px', color: TEXT, fontSize: 14 }}
        />
        <div style={{ fontSize: 10, color: TEXT_SUB, marginTop: 4, textAlign: 'right' }}>{title.length}/80</div>
      </div>

      {role === 'owner' || (role === 'customer' && customerMode === 'free') ? (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: TEXT_SUB, marginBottom: 6 }}>
            {role === 'owner' ? '하이라이트 태그 / 시술 소개 (선택)' : '태그 (선택)'}
          </div>
          <input
            value={highlightTag}
            maxLength={40}
            onChange={(e) => setHighlightTag(e.target.value)}
            placeholder={role === 'owner' ? '예: 수분관리, 여드름케어' : '태그'}
            style={{ width: '100%', boxSizing: 'border-box', background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '11px 12px', color: TEXT, fontSize: 14 }}
          />
        </div>
      ) : null}

      {role === 'owner' ? (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: TEXT_SUB, marginBottom: 8 }}>연결 타입</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <button
              type="button"
              onClick={() => {
                setOwnerLink('booking')
                setBrandProductId('')
              }}
              style={{
                flex: 1,
                border: 'none',
                borderRadius: 10,
                padding: '10px 6px',
                background: ownerLink === 'booking' ? PURPLE : CARD,
                color: TEXT,
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              관리/시술 소개
            </button>
            <button
              type="button"
              onClick={() => setOwnerLink('brand_product')}
              style={{
                flex: 1,
                border: 'none',
                borderRadius: 10,
                padding: '10px 6px',
                background: ownerLink === 'brand_product' ? PURPLE : CARD,
                color: TEXT,
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              브랜드 제품
            </button>
          </div>
          {ownerLink === 'booking' ? (
            <div style={{ fontSize: 11, color: TEXT_SUB, lineHeight: 1.45 }}>
              이 살롱에서 예약 가능한 관리/시술 소개로 올라가요. (일반 예약 CTA · 특정 예약건 연결 없음)
            </div>
          ) : (
            <select
              value={brandProductId}
              onChange={(e) => setBrandProductId(e.target.value)}
              style={{ width: '100%', background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 10, color: TEXT }}
            >
              <option value="">제품 선택</option>
              {brandProducts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
        </div>
      ) : null}

      {role === 'customer' && customerMode === 'free' ? (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: TEXT_SUB, marginBottom: 6 }}>제품 태깅 (살롱스토어 브랜드제품 · 선택)</div>
          <select
            value={freeSalonId}
            onChange={(e) => {
              setFreeSalonId(e.target.value)
              setFreeProductId('')
              setFreeProductQuery('')
              setFreeProducts([])
            }}
            style={{ width: '100%', background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 10, color: TEXT, marginBottom: 8 }}
          >
            <option value="">살롱 선택 (태깅 시 필요)</option>
            {freeSalons.map((salon) => (
              <option key={salon.id} value={salon.id}>
                {salon.name}
              </option>
            ))}
          </select>
          {freeSalonId ? (
            <>
              <input
                value={freeProductQuery}
                onChange={(e) => {
                  setFreeProductQuery(e.target.value)
                  setFreeProductId('')
                }}
                placeholder="제품명 검색 (2자 이상, 비우면 인기순)"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  background: CARD,
                  border: `1px solid ${BORDER}`,
                  borderRadius: 10,
                  padding: '11px 12px',
                  color: TEXT,
                  fontSize: 14,
                  marginBottom: 8,
                }}
              />
              <select
                value={freeProductId}
                onChange={(e) => setFreeProductId(e.target.value)}
                style={{ width: '100%', background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 10, color: TEXT }}
              >
                <option value="">{freeProductsLoading ? '불러오는 중…' : '태깅 안 함'}</option>
                {freeProducts.map((prod) => (
                  <option key={prod.id} value={prod.id}>
                    {prod.brand_name ? `${prod.brand_name} · ${prod.name}` : prod.name}
                  </option>
                ))}
              </select>
              <div style={{ fontSize: 11, color: TEXT_SUB, marginTop: 6, lineHeight: 1.45 }}>
                선택하면 살롱스토어 브랜드제품으로 연결돼요. (구매 인증 없이 태깅만)
              </div>
            </>
          ) : (
            <div style={{ fontSize: 11, color: TEXT_SUB, lineHeight: 1.45 }}>
              태깅 없이 올리면 연결 없음으로 저장돼요.
            </div>
          )}
        </div>
      ) : null}

      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 12, color: TEXT_SUB, marginBottom: 6 }}>영상 (9:16 · mp4 · 60초 이내)</div>
        <input
          type="file"
          accept="video/mp4,.mp4"
          onChange={(e) => void onPickVideo(e.target.files?.[0] || null)}
          style={{ width: '100%', color: TEXT_SUB, fontSize: 12 }}
        />
        {videoPreview ? (
          <video
            src={videoPreview}
            controls
            playsInline
            style={{ width: '100%', maxHeight: 360, marginTop: 10, borderRadius: 12, background: '#000', objectFit: 'contain' }}
          />
        ) : null}
      </div>

      {error ? (
        <div style={{ color: '#E57373', fontSize: 12, marginBottom: 10, textAlign: 'center' }}>{error}</div>
      ) : null}

      <button
        type="button"
        disabled={submitting}
        onClick={() => void submit()}
        style={{
          width: '100%',
          border: 'none',
          borderRadius: 12,
          background: submitting ? 'rgba(123,94,167,0.45)' : PURPLE,
          color: TEXT,
          padding: '14px 0',
          fontSize: 15,
          fontWeight: 800,
          cursor: submitting ? 'default' : 'pointer',
        }}
      >
        {submitting ? '업로드 중…' : '업로드'}
      </button>
    </div>
  )
}