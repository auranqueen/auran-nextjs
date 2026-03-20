'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import DashboardHeader from '@/components/DashboardHeader'
import DashboardBottomNav from '@/components/DashboardBottomNav'
import NoticeBell from '@/components/NoticeBell'
import { createClient } from '@/lib/supabase/client'

export default function ProductDetailClient({ product }: { product: any }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const shareJournalId = searchParams.get('share_journal_id')
  const supabase = createClient()
  const [thumbError, setThumbError] = useState(false)
  const [quantity, setQuantity] = useState(1)
  const [buying, setBuying] = useState(false)
  const [openGuestSheet, setOpenGuestSheet] = useState(false)
  const [isAuthed, setIsAuthed] = useState(false)

  useEffect(() => {
    const run = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setIsAuthed(!!user)
    }
    run()
  }, [supabase])

  const thumbUrl = product.thumb_img && !thumbError ? product.thumb_img : null
  const detailImgs = Array.isArray(product.detail_imgs) ? product.detail_imgs : []
  const rawPrice = product.retail_price
  const price = Number(rawPrice) || 0
  const isPriceUnset = rawPrice === null || rawPrice === undefined || price === 0

  const onBuy = async () => {
    if (!isAuthed) {
      setOpenGuestSheet(true)
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
        body: JSON.stringify({ items: [{ product_id: product.id, quantity }], share_journal_id: shareJournalId }),
      })
      const orderJson = await orderRes.json().catch(() => ({}))
      if (!orderRes.ok || !orderJson?.ok) throw new Error(orderJson?.error || orderJson?.reason || '주문 생성 실패')
      const payRes = await fetch('/api/payments/payapp/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ kind: 'order', amount: orderJson.final_amount, target_id: orderJson.order_id }),
      })
      const payJson = await payRes.json().catch(() => ({}))
      if (!payRes.ok || !payJson?.ok || !payJson?.pay_url) throw new Error(payJson?.error || payJson?.reason || '결제 요청 실패')
      window.location.href = payJson.pay_url
    } catch (e: any) {
      alert(e?.message || '오류가 발생했습니다.')
    } finally {
      setBuying(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', maxWidth: 480, margin: '0 auto', paddingBottom: 110 }}>
      <DashboardHeader title={product.name || '제품'} right={<NoticeBell />} />
      <div style={{ padding: '0 18px 24px' }}>
        <div style={{ marginBottom: 16, borderRadius: 16, overflow: 'hidden', background: 'rgba(0,0,0,0.2)', aspectRatio: '1', maxHeight: 360 }}>
          {thumbUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumbUrl} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} onError={() => setThumbError(true)} />
          ) : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: 64, opacity: 0.3 }}>🧴</span></div>}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>{product.brands?.name || ''}</div>
        <h1 style={{ fontSize: 18, fontWeight: 900, color: '#fff', marginBottom: 8, lineHeight: 1.35 }}>{product.name}</h1>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 18, fontWeight: 800, color: isPriceUnset ? 'var(--text3)' : 'var(--gold)', marginBottom: 16 }}>
          {isPriceUnset ? '준비 중' : `₩${price.toLocaleString()}`}
        </div>
        {!isPriceUnset && (
          <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--text3)' }}>수량</span>
              <input type="number" min={1} max={99} value={quantity} onChange={e => setQuantity(Math.max(1, Math.min(99, parseInt(e.target.value, 10) || 1)))} style={{ width: 56, padding: '8px 10px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, color: '#fff', fontSize: 14, fontWeight: 700, textAlign: 'center' }} />
            </div>
            <button type="button" onClick={onBuy} disabled={buying} style={{ padding: '12px 24px', background: 'linear-gradient(135deg, rgba(201,168,76,0.25), rgba(201,168,76,0.12))', border: '1px solid rgba(201,168,76,0.5)', borderRadius: 12, color: 'var(--gold)', fontSize: 14, fontWeight: 800, cursor: buying ? 'wait' : 'pointer', opacity: buying ? 0.8 : 1 }}>
              {buying ? '결제창 이동 중...' : `구매하기 ₩${(price * quantity).toLocaleString()}`}
            </button>
          </div>
        )}
        {product.description ? <div style={{ marginBottom: 20, fontSize: 13, color: 'rgba(255,255,255,0.85)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{product.description}</div> : null}
        {detailImgs.length > 0 ? <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>{detailImgs.map((url: string, i: number) => <div key={i} style={{ borderRadius: 12, overflow: 'hidden', background: 'rgba(0,0,0,0.2)' }}><img src={url} alt={`${product.name} ${i + 1}`} style={{ width: '100%', verticalAlign: 'top', display: 'block' }} /></div>)}</div> : null}
        <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <Link href="/products" style={{ display: 'inline-block', padding: '12px 20px', borderRadius: 12, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', fontSize: 13, fontWeight: 800, textDecoration: 'none' }}>← 제품 목록</Link>
        </div>
      </div>
      {openGuestSheet && (
        <div onClick={() => setOpenGuestSheet(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 120 }}>
          <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', bottom: 0, width: '100%', maxWidth: 480, background: '#11161b', borderTopLeftRadius: 18, borderTopRightRadius: 18, borderTop: '1px solid var(--border)', padding: 16 }}>
            <div style={{ fontSize: 16, color: '#fff', fontWeight: 800, marginBottom: 6 }}>로그인 후 구매 가능해요</div>
            <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 12 }}>첫 가입 8,888P 지급</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button onClick={() => router.push('/login?role=customer')} style={{ height: 40, borderRadius: 10, border: '1px solid rgba(201,168,76,0.45)', background: 'rgba(201,168,76,0.12)', color: 'var(--gold)', fontWeight: 800 }}>로그인</button>
              <button onClick={() => router.push('/signup')} style={{ height: 40, borderRadius: 10, border: 'none', background: '#c9a84c', color: '#111', fontWeight: 900 }}>회원가입</button>
            </div>
          </div>
        </div>
      )}
      <DashboardBottomNav role="customer" />
    </div>
  )
}
