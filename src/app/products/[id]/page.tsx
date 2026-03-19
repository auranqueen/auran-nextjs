'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import DashboardHeader from '@/components/DashboardHeader'
import DashboardBottomNav from '@/components/DashboardBottomNav'
import NoticeBell from '@/components/NoticeBell'
import PaymentAuthGuard from '@/components/PaymentAuthGuard'
import { createClient } from '@/lib/supabase/client'

export default function ProductDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = typeof params?.id === 'string' ? params.id : null
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [product, setProduct] = useState<any | null>(null)
  const [thumbError, setThumbError] = useState(false)
  const [quantity, setQuantity] = useState(1)
  const [buying, setBuying] = useState(false)

  useEffect(() => {
    if (!id) return
    const run = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('products')
        .select('id,name,description,thumb_img,detail_imgs,detail_html,video_url,ingredient,retail_price,created_at,brand_id,brands(id,name)')
        .eq('id', id)
        .eq('status', 'active')
        .maybeSingle()
      setLoading(false)
      if (error || !data) {
        setProduct(null)
        return
      }
      setProduct(data)
    }
    run()
  }, [id, supabase])

  if (!id) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', maxWidth: 480, margin: '0 auto', padding: 18 }}>
        <DashboardHeader title="제품" />
        <div style={{ color: 'var(--text3)', fontSize: 14 }}>잘못된 경로입니다.</div>
        <Link href="/products" style={{ display: 'inline-block', marginTop: 12, color: 'var(--gold)', fontSize: 13 }}>← 제품 목록</Link>
        <DashboardBottomNav role="customer" />
      </div>
    )
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', maxWidth: 480, margin: '0 auto', paddingBottom: 110 }}>
        <DashboardHeader title="제품" right={<NoticeBell />} />
        <div style={{ padding: 18, color: 'var(--text3)', fontSize: 14 }}>불러오는 중...</div>
        <DashboardBottomNav role="customer" />
      </div>
    )
  }

  if (!product) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', maxWidth: 480, margin: '0 auto', padding: 18 }}>
        <DashboardHeader title="제품" />
        <div style={{ color: 'var(--text3)', fontSize: 14 }}>제품을 찾을 수 없습니다.</div>
        <Link href="/products" style={{ display: 'inline-block', marginTop: 12, color: 'var(--gold)', fontSize: 13 }}>← 제품 목록</Link>
        <DashboardBottomNav role="customer" />
      </div>
    )
  }

  const thumbUrl = product.thumb_img && !thumbError ? product.thumb_img : null
  const detailImgs = Array.isArray(product.detail_imgs) ? product.detail_imgs : []
  const price = Number(product.retail_price) || 0
  const isPriceUnset = price === 0

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', maxWidth: 480, margin: '0 auto', paddingBottom: 110 }}>
      <DashboardHeader title={product.name || '제품'} right={<NoticeBell />} />
      <div style={{ padding: '0 18px 24px' }}>
        {/* 대표 이미지 */}
        <div style={{ marginBottom: 16, borderRadius: 16, overflow: 'hidden', background: 'rgba(0,0,0,0.2)', aspectRatio: '1', maxHeight: 360 }}>
          {thumbUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumbUrl}
              alt={product.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              onError={() => setThumbError(true)}
            />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 64, opacity: 0.3 }}>🧴</span>
            </div>
          )}
        </div>

        <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>{product.brands?.name || ''}</div>
        <h1 style={{ fontSize: 18, fontWeight: 900, color: '#fff', marginBottom: 8, lineHeight: 1.35 }}>{product.name}</h1>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 18, fontWeight: 800, color: isPriceUnset ? 'var(--text3)' : 'var(--gold)', marginBottom: 16 }}>
          {isPriceUnset ? '가격 설정 필요' : `₩${price.toLocaleString()}`}
        </div>

        {/* 수량 + 구매하기 */}
        <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--text3)' }}>수량</span>
            <input
              type="number"
              min={1}
              max={99}
              value={quantity}
              onChange={e => setQuantity(Math.max(1, Math.min(99, parseInt(e.target.value, 10) || 1)))}
              style={{
                width: 56,
                padding: '8px 10px',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 10,
                color: '#fff',
                fontSize: 14,
                fontWeight: 700,
                textAlign: 'center',
              }}
            />
          </div>
          <PaymentAuthGuard
            title="결제 PIN 확인"
            requirePin
            onSuccess={async () => {
              if (isPriceUnset) return
              const { data: { user: u } } = await supabase.auth.getUser()
              if (!u) {
                alert('로그인이 필요합니다.')
                router.replace('/login?role=customer')
                return
              }
              const total = price * quantity
              if (total < 1000) {
                alert('결제 금액은 1,000원 이상이어야 합니다.')
                return
              }
              if (!confirm(`${product.name} ${quantity}개 · ₩${total.toLocaleString()} 결제하시겠습니까?`)) return
              setBuying(true)
              try {
                const orderRes = await fetch('/api/orders/create', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  credentials: 'same-origin',
                  body: JSON.stringify({ items: [{ product_id: product.id, quantity }] }),
                })
                const orderJson = await orderRes.json().catch(() => ({}))
                if (!orderRes.ok || !orderJson?.ok) {
                  throw new Error(orderJson?.error || orderJson?.reason || '주문 생성 실패')
                }
                const payRes = await fetch('/api/payments/payapp/create', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  credentials: 'same-origin',
                  body: JSON.stringify({
                    kind: 'order',
                    amount: orderJson.final_amount,
                    target_id: orderJson.order_id,
                  }),
                })
                const payJson = await payRes.json().catch(() => ({}))
                if (!payRes.ok || !payJson?.ok || !payJson?.pay_url) {
                  throw new Error(payJson?.error || payJson?.reason || '결제 요청 실패')
                }
                window.location.href = payJson.pay_url
              } catch (e: any) {
                alert(e?.message || '오류가 발생했습니다.')
              } finally {
                setBuying(false)
              }
            }}
          >
            <button
              type="button"
              disabled={buying || isPriceUnset}
              style={{
                padding: '12px 24px',
                background: isPriceUnset ? 'rgba(255,255,255,0.06)' : 'linear-gradient(135deg, rgba(201,168,76,0.25), rgba(201,168,76,0.12))',
                border: isPriceUnset ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(201,168,76,0.5)',
                borderRadius: 12,
                color: isPriceUnset ? 'var(--text3)' : 'var(--gold)',
                fontSize: 14,
                fontWeight: 800,
                cursor: isPriceUnset ? 'not-allowed' : buying ? 'wait' : 'pointer',
                opacity: buying ? 0.8 : isPriceUnset ? 0.7 : 1,
              }}
            >
              {buying ? '결제창 이동 중...' : isPriceUnset ? '가격 설정 필요' : `구매하기 ₩${(price * quantity).toLocaleString()}`}
            </button>
          </PaymentAuthGuard>
        </div>

        {product.description ? (
          <div style={{ marginBottom: 20, fontSize: 13, color: 'rgba(255,255,255,0.85)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
            {product.description}
          </div>
        ) : null}

        {product.ingredient ? (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.1em', color: 'var(--text3)', marginBottom: 6 }}>주요 성분</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.78)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{product.ingredient}</div>
          </div>
        ) : null}

        {product.video_url ? (
          <div style={{ marginBottom: 20, borderRadius: 12, overflow: 'hidden', background: '#000' }}>
            <video src={product.video_url} controls style={{ width: '100%', display: 'block' }} />
          </div>
        ) : null}

        {detailImgs.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
            {detailImgs.map((url: string, i: number) => (
              <div key={i} style={{ borderRadius: 12, overflow: 'hidden', background: 'rgba(0,0,0,0.2)' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={`${product.name} ${i + 1}`} style={{ width: '100%', verticalAlign: 'top', display: 'block' }} />
              </div>
            ))}
          </div>
        ) : null}

        {product.detail_html ? (
          <div
            className="product-detail-html"
            style={{ fontSize: 13, color: 'rgba(255,255,255,0.88)', lineHeight: 1.7 }}
            dangerouslySetInnerHTML={{ __html: product.detail_html }}
          />
        ) : null}

        <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <Link
            href="/products"
            style={{
              display: 'inline-block',
              padding: '12px 20px',
              borderRadius: 12,
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: '#fff',
              fontSize: 13,
              fontWeight: 800,
              textDecoration: 'none',
            }}
          >
            ← 제품 목록
          </Link>
        </div>
      </div>
      <DashboardBottomNav role="customer" />
    </div>
  )
}
