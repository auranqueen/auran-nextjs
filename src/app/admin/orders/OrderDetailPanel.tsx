'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type OrderRow = {
  id: string
  order_no: string
  status: string
  total_amount?: number | null
  final_amount?: number | null
  coupon_discount?: number | null
  point_used?: number | null
  payment_method?: string | null
  tracking_no?: string | null
  courier?: string | null
  ordered_at?: string | null
  customer_id?: string | null
  admin_order_notes?: string | null
  recipient_name?: string | null
  recipient_phone?: string | null
  address?: string | null
  charge_used?: number | null
  toast_used?: number | null
  items?: any[] | null
  shipping_fee?: number | null
  grade_discount?: number | null
  subtotal?: number | null
}

type Props = {
  order: OrderRow | null
  open: boolean
  onClose: () => void
}

export default function OrderDetailPanel({ order, open, onClose }: Props) {
  const supabase = createClient()
  const [courier, setCourier] = useState('CJ대한통운')
  const [trackingNo, setTrackingNo] = useState('')
  const [memo, setMemo] = useState('')
  const [savingShip, setSavingShip] = useState(false)
  const [savingMemo, setSavingMemo] = useState(false)

  // ===== [또또복권] order_gifts 상태 =====
  const [orderGift, setOrderGift] = useState<any>(null)
  const [giftLoading, setGiftLoading] = useState(false)
  const [sampleSelected, setSampleSelected] = useState('')
  const [giftComment, setGiftComment] = useState('')
  const [savingGift, setSavingGift] = useState(false)

  useEffect(() => {
    setCourier(order?.courier || 'CJ대한통운')
    setTrackingNo(String(order?.tracking_no || ''))
    setMemo(String(order?.admin_order_notes || ''))
    // ===== [또또복권] order_gifts 조회 =====
    if (order?.id) {
      setGiftLoading(true)
      supabase
        .from('order_gifts')
        .select('*, gift_item:gift_items(*, product:products(name, thumb_img))')
        .eq('order_id', order.id)
        .maybeSingle()
        .then(({ data }) => {
          setOrderGift(data)
          setSampleSelected(data?.sample_selected || '')
          setGiftComment(data?.owner_comment || '')
          setGiftLoading(false)
        })
    }
  }, [order?.id])

  const paymentBadgeColor = useMemo(() => {
    const pay = String(order?.payment_method || '')
    if (/카드|card/i.test(pay)) return '#8ab0ff'
    if (/무통장|무통|입금|bank|transfer/i.test(pay)) return '#c9a96e'
    if (/토스트|toast/i.test(pay)) return '#c4a7e7'
    return 'rgba(255,255,255,0.7)'
  }, [order?.payment_method])

  if (!open || !order) return null

  const saveShipping = async () => {
    if (!trackingNo.trim()) return
    setSavingShip(true)
    try {
      const shippedAt = new Date().toISOString()
      const { error } = await supabase
        .from('orders')
        .update({
          status: '배송중',
          tracking_no: trackingNo.trim(),
          courier,
          shipped_at: shippedAt,
        } as any)
        .eq('id', order.id)
      if (error) {
        alert(error.message)
        return
      }
      const { data: msgRow } = await supabase
        .from('consultation_messages')
        .select('id')
        .eq('order_id', order.id)
        .eq('message_kind', 'order_paid')
        .maybeSingle()

      if (msgRow?.id) {
        await supabase
          .from('consultation_messages')
          .update({
            tracking_no: trackingNo.trim(),
            courier,
          })
          .eq('id', msgRow.id)
      }
      await supabase.from('notifications').insert({
        user_id: order.customer_id,
        type: 'shipping',
        title: '🚚 발송 안내',
        body:
          `[AURAN] 주문이 발송됐습니다.\n` +
          `운송장번호: ${trackingNo.trim()}\n` +
          `주문번호: ${order.order_no}\n\n` +
          `배송조회: https://auran.kr/track/\n` +
          `문의: support@auran.kr`,
        icon: '🚚',
        is_read: false,
        created_at: new Date().toISOString(),
      } as any)
      alert('배송정보가 등록됐어')
    } finally {
      setSavingShip(false)
    }
  }

  const saveMemo = async () => {
    setSavingMemo(true)
    try {
      const { error } = await supabase.from('orders').update({ admin_order_notes: memo } as any).eq('id', order.id)
      if (error) {
        alert(error.message)
        return
      }
      alert('메모 저장 완료')
    } finally {
      setSavingMemo(false)
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 210,
        background: 'rgba(0,0,0,0.45)',
      }}
    >
      <aside
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          height: '100vh',
          width: 'min(460px, 92vw)',
          background: 'var(--bg2)',
          borderLeft: '1px solid var(--border)',
          overflowY: 'auto',
          padding: 16,
          boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>주문 상세</div>
          <button type="button" className="btn btn-gy" onClick={onClose}>닫기</button>
        </div>

        <section style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>주문 정보</div>
          <div className="mono" style={{ fontSize: 12, color: 'var(--gold)' }}>{order.order_no}</div>
          <div className="mono" style={{ fontSize: 11, color: 'var(--text2)', marginTop: 4 }}>
            {order.ordered_at ? new Date(order.ordered_at).toLocaleString('ko-KR') : '-'}
          </div>
          <span className="b b-gy" style={{ marginTop: 6, display: 'inline-block' }}>{order.status}</span>
        </section>

        <section style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>고객 정보</div>
          <div style={{ fontSize: 12, color: 'var(--text)' }}>받는분: {order.recipient_name || '-'}</div>
          <div style={{ fontSize: 12, color: 'var(--text)' }}>연락처: {order.recipient_phone || '-'}</div>
          <div style={{ fontSize: 12, color: 'var(--text)', marginTop: 4, wordBreak: 'break-all' }}>
            주소: {order.address || '-'}
          </div>
          <button
            type="button"
            className="btn btn-bl"
            style={{ marginTop: 8 }}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(String(order.address || ''))
              } catch {}
            }}
          >
            주소 복사
          </button>
        </section>

        <section style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>주문 상품</div>
          {(Array.isArray(order.items) ? order.items : (() => { try { return JSON.parse(String(order.items || '[]')) } catch { return [] } })()).map((item: any, i: number) => (
            <div key={i} className="mono" style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 2 }}>
              {item.product_name || item.name || '상품'} × {item.quantity || 1} — ₩{Number(item.price ?? 0).toLocaleString()}
            </div>
          ))}
        </section>

        <section style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>결제 상세</div>
          <div className="mono" style={{ fontSize: 12, color: 'var(--text2)' }}>상품 소계: ₩{Number(order.subtotal ?? order.total_amount ?? 0).toLocaleString()}</div>
          <div className="mono" style={{ fontSize: 12, color: 'var(--text2)' }}>배송비: {Number(order.shipping_fee ?? 0) === 0 ? '무료' : `₩${Number(order.shipping_fee ?? 0).toLocaleString()}`}</div>
          <div className="mono" style={{ fontSize: 12, color: 'var(--text2)' }}>등급할인: -₩{Number(order.grade_discount ?? 0).toLocaleString()}</div>
          <div className="mono" style={{ fontSize: 12, color: 'var(--text2)' }}>쿠폰할인: -₩{Number(order.coupon_discount ?? 0).toLocaleString()}</div>
          <div className="mono" style={{ fontSize: 12, color: 'var(--text2)' }}>충전금 사용: -₩{Number(order.charge_used ?? 0).toLocaleString()}</div>
          {Number(order.toast_used ?? 0) > 0 && <div className="mono" style={{ fontSize: 12, color: 'var(--text2)' }}>토스트 사용: -{Number(order.toast_used ?? 0).toLocaleString()}T</div>}
          <div className="mono" style={{ fontSize: 13, color: 'var(--gold)', fontWeight: 700, marginTop: 4 }}>최종결제: ₩{Number(order.final_amount ?? 0).toLocaleString()}</div>
          <div style={{ marginTop: 8 }}>
            <span style={{ fontSize: 11, color: paymentBadgeColor, border: `1px solid ${paymentBadgeColor}`, borderRadius: 999, padding: '3px 8px' }}>
              {order.payment_method || '-'}
            </span>
          </div>
        </section>

        <section style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>배송 정보</div>
          <div className="mono" style={{ fontSize: 11, color: 'var(--text2)' }}>현재 택배사: {order.courier || '-'}</div>
          <div className="mono" style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 8 }}>현재 송장번호: {order.tracking_no || '-'}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <select value={courier} onChange={(e) => setCourier(e.target.value)} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--text)', padding: '8px 10px' }}>
              {['CJ대한통운', '우체국택배', '한진택배', '롯데택배', '로젠택배'].map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <input
              value={trackingNo}
              onChange={(e) => setTrackingNo(e.target.value)}
              placeholder="송장번호"
              style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--text)', padding: '8px 10px' }}
            />
          </div>
          <button type="button" className="btn btn-gr" style={{ marginTop: 8 }} onClick={() => void saveShipping()} disabled={savingShip}>
            {savingShip ? '등록 중...' : '등록'}
          </button>
        </section>

        <section>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>관리자 메모</div>
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            rows={5}
            style={{
              width: '100%',
              background: 'var(--bg3)',
              border: '1px solid var(--border)',
              borderRadius: 7,
              color: 'var(--text)',
              fontSize: 12,
              padding: '10px 11px',
              lineHeight: 1.6,
              resize: 'vertical',
              boxSizing: 'border-box',
            }}
          />
          <button type="button" className="btn btn-gr" style={{ marginTop: 8 }} onClick={() => void saveMemo()} disabled={savingMemo}>
            {savingMemo ? '저장 중...' : '저장'}
          </button>
        </section>

        {/* ===== [또또복권] 주문 상세 패널 — order_gifts 섹션 ===== */}
        {/* 당첨 제품 + 고객 희망 샘플 + 원장 샘플 선정 + 팁카드 출력 */}
        {giftLoading ? null : orderGift ? (
          <div style={{
            margin: '12px 0',
            padding: '14px 16px',
            borderRadius: 12,
            border: `0.5px solid ${orderGift.brand_type === 'renobel' ? '#C9A96E' : '#AFA9EC'}`,
            background: orderGift.brand_type === 'renobel' ? '#fdf8ee' : '#f9f7ff',
          }}>
            {/* 헤더 */}
            <div style={{ fontSize: 10, letterSpacing: 2, color: orderGift.brand_type === 'renobel' ? '#C9A96E' : '#7B5EA7', marginBottom: 8 }}>
              {orderGift.brand_type === 'renobel' ? '르노벨 골든또또 ✦' : '오랜 또또 💜'}
            </div>

            {/* 당첨 제품 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              {orderGift.gift_item?.product?.thumb_img && (
                <img
                  src={orderGift.gift_item.product.thumb_img}
                  alt=''
                  style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover' }}
                />
              )}
              <div>
                <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 2 }}>당첨 제품</div>
                <div style={{ fontSize: 13, color: 'var(--color-text-primary)' }}>
                  {orderGift.gift_item?.product?.name || '제품 정보 없음'}
                </div>
              </div>
            </div>

            {/* 고객 피부 프로필 */}
            {orderGift.user_id && (
              <CustomerSkinProfile userId={orderGift.user_id} supabase={supabase} />
            )}

            {/* 고객 희망 샘플 */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 4 }}>
                고객 희망 샘플
              </div>
              <div style={{
                fontSize: 12, color: 'var(--color-text-primary)',
                padding: '8px 10px', borderRadius: 8,
                background: 'var(--color-background-primary)',
                border: '0.5px solid var(--color-border-tertiary)',
                minHeight: 32,
              }}>
                {orderGift.sample_request || '입력 없음 (맑원장이 직접 선정)'}
              </div>
            </div>

            {/* 원장 샘플 선정 입력 */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 4 }}>
                원장 선정 샘플
              </div>
              <input
                value={sampleSelected}
                onChange={e => setSampleSelected(e.target.value)}
                placeholder='선정한 샘플 입력'
                style={{
                  width: '100%', padding: '8px 10px', borderRadius: 8,
                  fontSize: 12, border: '0.5px solid var(--color-border-secondary)',
                  background: 'var(--color-background-primary)',
                  color: 'var(--color-text-primary)',
                  fontFamily: 'inherit',
                }}
              />
            </div>

            {/* 원장 코멘트 입력 */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 4 }}>
                원장 코멘트
              </div>
              <textarea
                value={giftComment}
                onChange={e => setGiftComment(e.target.value)}
                placeholder='고객에게 전달할 코멘트 입력'
                rows={2}
                style={{
                  width: '100%', padding: '8px 10px', borderRadius: 8,
                  fontSize: 12, border: '0.5px solid var(--color-border-secondary)',
                  background: 'var(--color-background-primary)',
                  color: 'var(--color-text-primary)',
                  fontFamily: 'inherit', resize: 'none',
                }}
              />
            </div>

            {/* 저장 + 팁카드 출력 버튼 */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={async () => {
                  if (savingGift) return
                  setSavingGift(true)
                  await supabase
                    .from('order_gifts')
                    .update({
                      // [원장 선정 샘플 + 코멘트 저장]
                      sample_selected: sampleSelected,
                      owner_comment: giftComment,
                    })
                    .eq('id', orderGift.id)
                  setSavingGift(false)
                }}
                disabled={savingGift}
                style={{
                  flex: 1, padding: '9px 0', borderRadius: 10,
                  border: 'none', background: '#7B5EA7', color: '#fff',
                  fontSize: 12, cursor: savingGift ? 'not-allowed' : 'pointer',
                  opacity: savingGift ? 0.6 : 1,
                }}
              >
                {savingGift ? '저장 중...' : '저장'}
              </button>
              <button
                onClick={() => {
                  // [팁카드 출력] 새 탭에서 인쇄 미리보기
                  const won = orderGift.gift_item?.product?.name || ''
                  const html = `
            <html><head><title>팁카드</title>
            <style>
              body { font-family: 'Apple SD Gothic Neo', sans-serif; margin: 0; padding: 20px; }
              .card { width: 86mm; min-height: 54mm; padding: 16px; border: 1px solid #C9A96E; border-radius: 8px; }
              .eye { font-size: 9px; letter-spacing: 2px; color: #C9A96E; margin-bottom: 8px; }
              .product { font-size: 14px; color: #111; margin-bottom: 10px; }
              .comment { font-size: 11px; color: #534AB7; line-height: 1.7; border-top: 1px solid #eee; padding-top: 8px; }
              .footer { font-size: 9px; color: #999; margin-top: 8px; text-align: right; }
            </style></head>
            <body>
              <div class="card">
                <div class="eye">✦ AURAN 처방 카드</div>
                <div class="product">${won}</div>
                <div class="comment">${giftComment || '맑원장 코멘트 없음'}</div>
                <div class="footer">auran.kr</div>
              </div>
              <script>window.onload = () => window.print()</script>
            </body></html>
          `
                  const w = window.open('', '_blank')
                  if (w) { w.document.write(html); w.document.close() }
                }}
                style={{
                  flex: 1, padding: '9px 0', borderRadius: 10,
                  border: '0.5px solid #C9A96E', background: '#fdf8ee',
                  color: '#854F0B', fontSize: 12, cursor: 'pointer',
                }}
              >
                팁카드 출력 🖨️
              </button>
            </div>

            {/* 발송 완료 체크 */}
            <button
              onClick={async () => {
                await supabase
                  .from('order_gifts')
                  .update({ tip_card_sent: !orderGift.tip_card_sent })
                  .eq('id', orderGift.id)
                setOrderGift((g: any) => ({ ...g, tip_card_sent: !g.tip_card_sent }))
              }}
              style={{
                width: '100%', marginTop: 8, padding: '8px 0', borderRadius: 10,
                border: '0.5px solid var(--color-border-secondary)',
                background: orderGift.tip_card_sent ? '#7B5EA7' : 'transparent',
                color: orderGift.tip_card_sent ? '#fff' : 'var(--color-text-secondary)',
                fontSize: 12, cursor: 'pointer',
              }}
            >
              {orderGift.tip_card_sent ? '팁카드 발송 완료 ✓' : '팁카드 발송 완료 처리'}
            </button>
          </div>
        ) : null}
      </aside>
    </div>
  )
}

// ===== [또또복권] 고객 피부 프로필 미니 컴포넌트 =====
// order_gifts 섹션에서 userId로 고객 피부 데이터 표시
function CustomerSkinProfile({ userId, supabase }: { userId: string, supabase: any }) {
  const [profile, setProfile] = useState<any>(null)

  useEffect(() => {
    supabase
      .from('profiles')
      .select('skin_type, skin_concerns, hormone_phase, full_name')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data }: any) => setProfile(data))
  }, [userId])

  if (!profile) return null

  return (
    <div style={{
      marginBottom: 10, padding: '8px 10px', borderRadius: 8,
      background: 'var(--color-background-primary)',
      border: '0.5px solid var(--color-border-tertiary)',
      fontSize: 11, color: 'var(--color-text-secondary)',
      lineHeight: 1.8,
    }}>
      <div>고객: {profile.full_name || '-'}</div>
      <div>호르몬: {profile.hormone_phase || '-'}</div>
      <div>피부타입: {profile.skin_type || '-'}</div>
      <div>고민: {Array.isArray(profile.skin_concerns) ? profile.skin_concerns.join(', ') : (profile.skin_concerns || '-')}</div>
    </div>
  )
}

