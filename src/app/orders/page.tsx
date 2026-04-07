'use client'

import DashboardHeader from '@/components/DashboardHeader'
import CustomerHeaderRight from '@/components/CustomerHeaderRight'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

const launchConfetti = () => {
  const canvas = document.getElementById('confetti-canvas') as HTMLCanvasElement
  if (!canvas) return
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight
  const ctx = canvas.getContext('2d')!
  const colors = ['#7B5EA7', '#c9a96e', '#e8d5ff', '#f5c0d1', '#9FE1CB', '#FAC775', '#a78bfa', '#fcd34d']
  const parts = Array.from({ length: 160 }, () => ({
    x: window.innerWidth / 2 + (Math.random() - 0.5) * 80,
    y: window.innerHeight * 0.3,
    vx: (Math.random() - 0.5) * 12,
    vy: -(Math.random() * 14 + 6),
    color: colors[Math.floor(Math.random() * colors.length)],
    size: Math.random() * 8 + 3,
    rotation: Math.random() * 360,
    rotSpeed: (Math.random() - 0.5) * 12,
    shape: (Math.random() > 0.5 ? 'rect' : 'circle') as 'rect' | 'circle',
    gravity: 0.4,
    opacity: 1,
  }))
  const animate = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    let alive = false
    parts.forEach((p) => {
      p.x += p.vx
      p.y += p.vy
      p.vy += p.gravity
      p.vx *= 0.99
      p.rotation += p.rotSpeed
      p.opacity -= 0.007
      if (p.opacity > 0 && p.y < canvas.height + 20) {
        alive = true
        ctx.save()
        ctx.globalAlpha = Math.max(0, p.opacity)
        ctx.translate(p.x, p.y)
        ctx.rotate((p.rotation * Math.PI) / 180)
        ctx.fillStyle = p.color
        if (p.shape === 'circle') {
          ctx.beginPath()
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2)
          ctx.fill()
        } else {
          ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.6)
        }
        ctx.restore()
      }
    })
    if (alive) requestAnimationFrame(animate)
  }
  animate()
}

export default function OrdersPage() {
  const supabase = createClient()
  const router = useRouter()
  const [paymentDone, setPaymentDone] = useState(false)
  const [loading, setLoading] = useState(true)
  const [orders, setOrders] = useState<any[]>([])
  const [giftToast, setGiftToast] = useState('')

  useEffect(() => {
    if (typeof window === 'undefined') return
    const q = new URLSearchParams(window.location.search)
    setPaymentDone(q.get('payment') === 'done')
  }, [])

  useEffect(() => {
    if (!paymentDone) return
    const t = window.setTimeout(() => launchConfetti(), 300)
    return () => clearTimeout(t)
  }, [paymentDone])

  useEffect(() => {
    const run = async () => {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login?role=customer')
        return
      }
      const { data: profile } = await supabase.from('users').select('id').eq('auth_id', user.id).single()
      if (!profile?.id) {
        setOrders([])
        setLoading(false)
        return
      }
      const { data } = await supabase
        .from('orders')
        .select('id,order_no,status,final_amount,ordered_at,gift_receiver_id,tracking_no,courier,order_items(product_name,quantity)')
        .eq('customer_id', profile.id)
        .eq('payment_applied', true)
        .order('ordered_at', { ascending: false })
        .limit(20)
      setOrders(data || [])
      setLoading(false)
    }
    run()
  }, [router])

  useEffect(() => {
    if (!paymentDone || !orders.length) return
    const top = orders[0]
    if (!top?.gift_receiver_id) return
    let cancelled = false
    ;(async () => {
      const { data } = await supabase.from('users').select('name').eq('id', top.gift_receiver_id).maybeSingle()
      if (!cancelled && data?.name) setGiftToast(`${data.name}님께 선물했어요 🎁`)
    })()
    return () => {
      cancelled = true
    }
  }, [paymentDone, orders])

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', maxWidth: 480, margin: '0 auto', paddingBottom: 110 }}>
      <DashboardHeader title="구매내역" right={<CustomerHeaderRight />} />
      <div style={{ padding: '18px 18px 0' }}>
        {giftToast ? (
          <div style={{ marginBottom: 12, padding: 12, background: 'rgba(140,180,255,0.12)', border: '1px solid rgba(140,180,255,0.35)', borderRadius: 12, fontSize: 13, color: '#bcd6ff', fontWeight: 700 }}>
            {giftToast}
          </div>
        ) : null}
        {paymentDone && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(13,11,9,0.95)', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <canvas id="confetti-canvas" style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 10000 }} />
            <div style={{ fontSize: 52, marginBottom: 12, animation: 'popIn 0.5s ease' }}>🛍️</div>
            <div style={{ fontSize: 18, fontWeight: 500, color: '#e8d5ff', marginBottom: 6 }}>결제가 완료됐어요!</div>
            <div style={{ fontSize: 12, color: '#666', marginBottom: 20, lineHeight: 1.7, textAlign: 'center' }}>곧 배송 준비가 시작될 거예요 💜</div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, width: '100%', maxWidth: 320, marginBottom: 16 }}>
              <div style={{ background: 'rgba(192,132,252,0.08)', border: '0.5px solid rgba(192,132,252,0.25)', borderRadius: 12, padding: 12, textAlign: 'center' }}>
                <div style={{ fontSize: 20, marginBottom: 4 }}>🍞</div>
                <div style={{ fontSize: 10, color: '#888', marginBottom: 3 }}>구매 토스트</div>
                <div style={{ fontSize: 14, fontWeight: 500, color: '#c084fc' }}>확정 후 지급</div>
                <div style={{ fontSize: 10, color: '#555', marginTop: 2 }}>구매 확정 시 바로</div>
              </div>
              <div style={{ background: 'rgba(201,168,76,0.07)', border: '0.5px solid rgba(201,168,76,0.25)', borderRadius: 12, padding: 12, textAlign: 'center' }}>
                <div style={{ fontSize: 20, marginBottom: 4 }}>✍️</div>
                <div style={{ fontSize: 10, color: '#888', marginBottom: 3 }}>리뷰 토스트</div>
                <div style={{ fontSize: 14, fontWeight: 500, color: '#c9a96e' }}>+500T~</div>
                <div style={{ fontSize: 10, color: '#555', marginTop: 2 }}>사진 1,000T</div>
              </div>
              <div style={{ background: 'rgba(74,222,128,0.06)', border: '0.5px solid rgba(74,222,128,0.18)', borderRadius: 12, padding: 12, textAlign: 'center' }}>
                <div style={{ fontSize: 20, marginBottom: 4 }}>📦</div>
                <div style={{ fontSize: 10, color: '#888', marginBottom: 3 }}>예상 배송</div>
                <div style={{ fontSize: 14, fontWeight: 500, color: '#4ade80' }}>2-3일</div>
                <div style={{ fontSize: 10, color: '#555', marginTop: 2 }}>출발 시 알림</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 12, textAlign: 'center' }}>
                <div style={{ fontSize: 20, marginBottom: 4 }}>💜</div>
                <div style={{ fontSize: 10, color: '#888', marginBottom: 3 }}>최대 적립</div>
                <div style={{ fontSize: 14, fontWeight: 500, color: '#c9a96e' }}>1,500T~</div>
                <div style={{ fontSize: 10, color: '#555', marginTop: 2 }}>구매+사진리뷰</div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                const canvas = document.getElementById('confetti-canvas') as HTMLCanvasElement
                if (canvas) canvas.style.display = 'none'
                window.history.replaceState({}, '', '/orders')
                location.reload()
              }}
              style={{ width: '100%', maxWidth: 320, padding: 14, background: 'linear-gradient(135deg,#c9a96e,#a07840)', border: 'none', borderRadius: 14, fontSize: 14, fontWeight: 500, color: '#0d0b09', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              주문 내역 확인하기
            </button>
          </div>
        )}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.10)',
                  borderRadius: 14,
                  padding: '14px 14px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div
                    style={{
                      height: 12,
                      width: '35%',
                      borderRadius: 6,
                      background: 'rgba(255,255,255,0.08)',
                      animation: 'pulse 1.5s ease-in-out infinite',
                    }}
                  />
                  <div
                    style={{
                      height: 12,
                      width: '20%',
                      borderRadius: 6,
                      background: 'rgba(255,255,255,0.06)',
                      animation: 'pulse 1.5s ease-in-out infinite',
                    }}
                  />
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 10,
                      background: 'rgba(255,255,255,0.07)',
                      flexShrink: 0,
                      animation: 'pulse 1.5s ease-in-out infinite',
                    }}
                  />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
                    <div
                      style={{
                        height: 13,
                        width: '70%',
                        borderRadius: 6,
                        background: 'rgba(255,255,255,0.08)',
                        animation: 'pulse 1.5s ease-in-out infinite',
                      }}
                    />
                    <div
                      style={{
                        height: 11,
                        width: '40%',
                        borderRadius: 6,
                        background: 'rgba(201,168,76,0.12)',
                        animation: 'pulse 1.5s ease-in-out infinite',
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>구매 내역이 없습니다.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {orders.map(o => (
              <div key={o.id} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 14, padding: '14px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--text3)' }}>{o.order_no}</div>
                  <div style={{ fontSize: 11, color: 'var(--gold)' }}>{o.status}</div>
                </div>
                <div style={{ marginTop: 6, fontSize: 13, color: '#fff', fontWeight: 700 }}>
                  {o.order_items?.[0]?.product_name || '주문 상품'}
                  {o.order_items?.length > 1 ? ` 외 ${o.order_items.length - 1}종` : ''}
                </div>
                <div style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>{o.ordered_at ? new Date(o.ordered_at).toLocaleDateString('ko-KR') : ''}</div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 800, color: '#fff' }}>₩{(o.final_amount || 0).toLocaleString()}</div>
                </div>
                {o.status === '배송중' ? (
                  <div style={{ marginTop: 10 }}>
                    {(() => {
                      const trk = String(o.tracking_no || '').trim()
                      const cr = String(o.courier || '').trim()
                      let href = ''
                      if (trk) {
                        if (cr.includes('CJ') || cr.includes('대한통운')) href = `https://www.cjlogistics.com/ko/tool/parcel/tracking?gnbInvcNo=${encodeURIComponent(trk)}`
                        else if (cr.includes('한진')) href = `https://www.hanjin.com/kor/CMS/DeliveryMgr/WaybillSch.do?mCode=MN038&schLang=KR&wblnumText2=${encodeURIComponent(trk)}`
                        else if (cr.includes('롯데')) href = `https://www.lotteglogis.com/open/tracking?invno=${encodeURIComponent(trk)}`
                        else if (cr.includes('우체국')) href = `https://service.epost.go.kr/trace.RetrieveDomRigiTraceList.comm?sid1=${encodeURIComponent(trk)}`
                        else if (cr.includes('로젠')) href = `https://www.ilogen.com/m/personal/trace/${encodeURIComponent(trk)}`
                        else href = `https://www.cjlogistics.com/ko/tool/parcel/tracking?gnbInvcNo=${encodeURIComponent(trk)}`
                      }
                      return (
                        <button
                          type="button"
                          disabled={!trk}
                          onClick={() => {
                            if (!trk) return
                            window.open(href, '_blank', 'noopener,noreferrer')
                          }}
                          style={{
                            width: '100%',
                            padding: '8px 10px',
                            fontSize: 12,
                            borderRadius: 10,
                            border: '1px solid #7B5EA7',
                            color: '#7B5EA7',
                            background: 'transparent',
                            cursor: trk ? 'pointer' : 'not-allowed',
                            opacity: trk ? 1 : 0.5,
                            fontFamily: 'inherit',
                            fontWeight: 600,
                          }}
                        >
                          🚚 배송조회
                        </button>
                      )
                    })()}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

