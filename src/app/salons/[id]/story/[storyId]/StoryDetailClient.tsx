'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useBrandCart } from '@/context/BrandCartContext'

const BG = '#0D0B09'
const CARD = 'rgba(255,255,255,0.05)'
const BORDER = 'rgba(255,255,255,0.08)'
const GOLD = '#C9A96E'
const PURPLE = '#7B5EA7'
const PURPLE_LIGHT = 'rgba(123,94,167,0.15)'
const TEXT = '#fff'
const TEXT_SUB = 'rgba(255,255,255,0.55)'

export type StoryDetailProduct = {
  id: string
  brand_id: string
  name: string
  thumb_img: string | null
  consumer_price: number | null
  customer_toast_rate: number | null
}

export type StoryDetailData = {
  story: {
    id: string
    story_type: 'treatment' | 'homecare'
    title: string
    content: string
    banner_image_url_pc: string | null
    banner_image_url_mobile: string | null
    created_at: string
  }
  salon: { id: string; name: string }
  products: StoryDetailProduct[]
}

function fmtDate(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`
}

function softSanitizeHtml(html: string) {
  return String(html || '')
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+\s*=\s*(['"]).*?\1/gi, '')
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, '')
}

export default function StoryDetailClient({ data }: { data: StoryDetailData }) {
  const router = useRouter()
  const { addItem } = useBrandCart()
  const { story, salon, products } = data
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [toast, setToast] = useState('')
  const [isPc, setIsPc] = useState(false)

  useEffect(() => {
    const onResize = () => setIsPc(window.innerWidth >= 768)
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const banner = isPc
    ? story.banner_image_url_pc || story.banner_image_url_mobile
    : story.banner_image_url_mobile || story.banner_image_url_pc

  const selectedList = products.filter((p) => selected[p.id])

  const toggle = (id: string) => {
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const handleAddSelected = () => {
    if (!selectedList.length) {
      setToast('제품을 선택해 주세요')
      setTimeout(() => setToast(''), 2000)
      return
    }
    for (const p of selectedList) {
      addItem({
        brand_product_id: p.id,
        brand_id: p.brand_id,
        salon_id: salon.id,
        salon_name: salon.name,
        name: p.name,
        price: Number(p.consumer_price || 0),
        thumb_img: p.thumb_img,
        customer_toast_rate: Number(p.customer_toast_rate || 0),
      })
    }
    router.push(`/salons/${salon.id}/cart`)
  }

  return (
    <div style={{ minHeight: '100vh', background: BG, color: TEXT, maxWidth: 720, margin: '0 auto', paddingBottom: 40 }}>
      <div style={{ padding: '16px 16px 8px' }}>
        <div style={{ fontSize: 12, color: GOLD, marginBottom: 4 }}>{salon.name}</div>
        <div style={{ fontSize: 11, color: TEXT_SUB, marginBottom: 10 }}>{fmtDate(story.created_at)}</div>
        <h1 style={{ fontSize: 22, fontWeight: 600, lineHeight: 1.35, margin: '0 0 12px' }}>{story.title}</h1>
        <span
          style={{
            display: 'inline-block',
            fontSize: 11,
            padding: '3px 10px',
            borderRadius: 20,
            background: PURPLE_LIGHT,
            color: PURPLE,
            border: `1px solid ${BORDER}`,
          }}
        >
          {story.story_type === 'treatment' ? '관리프로그램' : '홈케어제품추천'}
        </span>
      </div>

      {banner ? (
        <div style={{ padding: '0 16px 16px' }}>
          <img src={banner} alt="" style={{ width: '100%', borderRadius: 12, display: 'block' }} />
        </div>
      ) : null}

      <div
        style={{ padding: '0 16px 24px', fontSize: 14, lineHeight: 1.8, color: 'rgba(255,255,255,0.88)' }}
        dangerouslySetInnerHTML={{ __html: softSanitizeHtml(story.content) }}
      />

      {story.story_type === 'treatment' && (
        <div style={{ padding: '0 16px' }}>
          <a
            href={`/salons/${salon.id}`}
            style={{
              display: 'block',
              textAlign: 'center',
              textDecoration: 'none',
              background: PURPLE,
              color: '#fff',
              borderRadius: 12,
              padding: 14,
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            지금 예약하기
          </a>
        </div>
      )}

      {story.story_type === 'homecare' && products.length > 0 && (
        <div style={{ padding: '0 16px' }}>
          <div style={{ fontSize: 13, color: GOLD, marginBottom: 10 }}>추천 제품</div>
          <div
            className="story-detail-product-grid"
            style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 14 }}
          >
            <style>{`@media (min-width:768px){ .story-detail-product-grid{ grid-template-columns: repeat(4, 1fr) !important; } }`}</style>
            {products.map((p) => {
              const on = !!selected[p.id]
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggle(p.id)}
                  style={{
                    border: on ? `1.5px solid ${PURPLE}` : `1px solid ${BORDER}`,
                    background: on ? PURPLE_LIGHT : CARD,
                    borderRadius: 12,
                    padding: 10,
                    cursor: 'pointer',
                    textAlign: 'left',
                    color: TEXT,
                  }}
                >
                  <div
                    style={{
                      width: '100%',
                      aspectRatio: '1',
                      borderRadius: 8,
                      background: PURPLE_LIGHT,
                      overflow: 'hidden',
                      marginBottom: 8,
                      position: 'relative',
                    }}
                  >
                    {p.thumb_img ? (
                      <img src={p.thumb_img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : null}
                    <div
                      style={{
                        position: 'absolute',
                        top: 6,
                        right: 6,
                        width: 18,
                        height: 18,
                        borderRadius: 4,
                        border: `1.5px solid ${on ? PURPLE : 'rgba(255,255,255,0.5)'}`,
                        background: on ? PURPLE : 'rgba(0,0,0,0.35)',
                        color: '#fff',
                        fontSize: 11,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {on ? '✓' : ''}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, lineHeight: 1.3, marginBottom: 4 }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: TEXT_SUB }}>
                    {Number(p.consumer_price || 0).toLocaleString()}원
                  </div>
                </button>
              )
            })}
          </div>
          <button
            type="button"
            onClick={handleAddSelected}
            style={{
              width: '100%',
              border: 'none',
              background: PURPLE,
              color: '#fff',
              borderRadius: 12,
              padding: 14,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            선택 상품 장바구니 담기{selectedList.length ? ` (${selectedList.length})` : ''}
          </button>
        </div>
      )}

      {toast ? (
        <div
          style={{
            position: 'fixed',
            left: '50%',
            bottom: 24,
            transform: 'translateX(-50%)',
            background: PURPLE,
            color: '#fff',
            fontSize: 12,
            padding: '8px 16px',
            borderRadius: 20,
            zIndex: 50,
          }}
        >
          {toast}
        </div>
      ) : null}
    </div>
  )
}
