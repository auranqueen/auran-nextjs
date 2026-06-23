'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
interface Props {
  point: number
  chargeBalance: number
  userId: string
}
const BADGE: Record<string, { label: string; color: string; bg: string; border: string }> = {
  attendance: { label: '적립', color: '#c9a96e', bg: 'rgba(201,169,110,0.15)', border: 'rgba(201,169,110,0.3)' },
  signup: { label: '적립', color: '#c9a96e', bg: 'rgba(201,169,110,0.15)', border: 'rgba(201,169,110,0.3)' },
  order: { label: '적립', color: '#c9a96e', bg: 'rgba(201,169,110,0.15)', border: 'rgba(201,169,110,0.3)' },
  charge: { label: '버터 🧈', color: '#e8c040', bg: 'rgba(255,220,100,0.15)', border: 'rgba(255,220,100,0.3)' },
  review: { label: '꿀 🍯', color: '#ffb400', bg: 'rgba(255,180,0,0.15)', border: 'rgba(255,180,0,0.3)' },
  review_bonus: { label: '꿀 🍯', color: '#ffb400', bg: 'rgba(255,180,0,0.15)', border: 'rgba(255,180,0,0.3)' },
  referral_reward: { label: '딸기잼 🍓', color: '#e05070', bg: 'rgba(220,80,100,0.15)', border: 'rgba(220,80,100,0.3)' },
  share_jam: { label: '딸기잼 🍓', color: '#e05070', bg: 'rgba(220,80,100,0.15)', border: 'rgba(220,80,100,0.3)' },
}
function txLabel(source: string) {
  const map: Record<string, string> = {
    attendance: '출석 체크',
    signup: '가입 선물',
    order: '구매 적립',
    charge: '오렌페이 충전',
    review: '리뷰 작성',
    review_bonus: '리뷰 보너스',
    referral_reward: '친구 초대',
    share_jam: '공유 보상',
    manual: '지급',
    use: '구매 차감',
    system: '시스템',
  }
  return map[source] || source
}
export default function WalletCard({ point, chargeBalance, userId }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [popup, setPopup] = useState<'toast' | 'pay-history' | 'pay-charge' | null>(null)
  const [toastTx, setToastTx] = useState<any[]>([])
  const [payHistory, setPayHistory] = useState<{ type: 'charge' | 'use'; label: string; amount: number; date: string }[]>([])
  const [selectedAmt, setSelectedAmt] = useState<number>(0)
  const [customAmt, setCustomAmt] = useState('')
  const [butterPreview, setButterPreview] = useState(0)
  const [loading, setLoading] = useState(false)
  const openPopup = async (type: 'toast' | 'pay-history' | 'pay-charge') => {
    setPopup(type)
    if (type === 'toast' && toastTx.length === 0) {
      const { data: meRow } = await supabase.from('users').select('id').eq('auth_id', userId).maybeSingle()
      if (!meRow?.id) return
      const { data } = await supabase
        .from('toast_transactions')
        .select('id, amount, source_type, transaction_type, created_at')
        .eq('user_id', meRow.id)
        .order('created_at', { ascending: false })
        .limit(30)
      setToastTx(data || [])
    }
    if (type === 'pay-history' && payHistory.length === 0) {
      const { data: meRow } = await supabase.from('users').select('id').eq('auth_id', userId).maybeSingle()
      if (!meRow?.id) return
      const { data: charges } = await supabase
        .from('payment_intents')
        .select('amount, created_at')
        .eq('user_id', meRow.id)
        .eq('kind', 'charge')
        .eq('status', 'paid')
        .order('created_at', { ascending: false })
        .limit(30)
      const { data: uses } = await supabase
        .from('orders')
        .select('charge_used, created_at, items')
        .eq('customer_id', meRow.id)
        .gt('charge_used', 0)
        .order('created_at', { ascending: false })
        .limit(30)
      const merged = [
        ...(charges || []).map((r: any) => ({ type: 'charge' as const, label: '카드 충전', amount: r.amount, date: r.created_at })),
        ...(uses || []).map((r: any) => {
          const items = (() => { try { return JSON.parse(r.items || '[]') } catch { return [] } })()
          const label = items[0]?.product_name ? (items.length > 1 ? `${items[0].product_name} 외 ${items.length - 1}개` : items[0].product_name) : '구매 사용'
          return { type: 'use' as const, label, amount: r.charge_used, date: r.created_at }
        }),
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      setPayHistory(merged)
    }
  }
  const handleSelectAmt = (amt: number) => {
    setSelectedAmt(amt)
    setCustomAmt('')
    setButterPreview(Math.floor(amt * 0.05))
  }
  const handleCustomAmt = (v: string) => {
    setCustomAmt(v)
    const n = Number(v) || 0
    setSelectedAmt(n)
    setButterPreview(n >= 1000 ? Math.floor(n * 0.05) : 0)
  }
  const PRESETS = [300000, 500000, 1000000, 2000000]
  const pillStyle = (color: string, bg: string, border: string) => ({
    fontSize: 9, padding: '2px 6px', borderRadius: 6, display: 'inline-block',
    color, background: bg, border: `0.5px solid ${border}`,
  })
  return (
    <>
      {/* 토스트 카드 */}
      <div style={{ margin: '14px 16px 0', background: 'rgba(201,169,110,0.10)', border: '1px solid rgba(201,169,110,0.3)', borderRadius: 18, padding: 16 }}>
        <div style={{ fontSize: 10, color: 'rgba(201,169,110,0.7)', marginBottom: 4 }}>토스트 T — AURAN이 드리는 포인트</div>
        <div style={{ fontSize: 22, color: '#c9a96e', marginBottom: 8 }}>{point.toLocaleString()}T</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          <span style={pillStyle('#e8c040','rgba(255,220,100,0.12)','rgba(255,220,100,0.3)')}>🧈 버터 충전 적립</span>
          <span style={pillStyle('#e05070','rgba(220,80,100,0.12)','rgba(220,80,100,0.3)')}>🍓 딸기잼 친구초대</span>
          <span style={pillStyle('#ffb400','rgba(255,180,0,0.12)','rgba(255,180,0,0.3)')}>🍯 꿀 리뷰보상</span>
        </div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', lineHeight: 1.6, marginBottom: 10 }}>
          5만원 이상 구매 시 사용 · LUMIÈRE 이상 전액 사용
        </div>
        <button onClick={() => openPopup('toast')} style={{ width: '100%', padding: 9, borderRadius: 10, background: 'rgba(201,169,110,0.18)', border: '0.5px solid rgba(201,169,110,0.3)', color: '#c9a96e', fontSize: 12, cursor: 'pointer' }}>
          적립 내역
        </button>
      </div>
      {/* 오렌페이 카드 */}
      <div style={{ margin: '10px 16px 0', background: 'rgba(123,94,167,0.10)', border: '1px solid rgba(123,94,167,0.3)', borderRadius: 18, padding: 16 }}>
        <div style={{ fontSize: 10, color: 'rgba(196,167,231,0.7)', marginBottom: 4 }}>AURAN PAY — 충전해서 쓰는 잔액</div>
        <div style={{ fontSize: 22, color: '#9b7ec8', marginBottom: 8 }}>₩{chargeBalance.toLocaleString()}</div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', lineHeight: 1.6, marginBottom: 10 }}>
          충전금 차감 후 부족분은 카드로 자동 결제
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => openPopup('pay-history')} style={{ flex: 1, padding: 9, borderRadius: 10, background: 'rgba(123,94,167,0.25)', border: '0.5px solid rgba(123,94,167,0.4)', color: '#c4a7e7', fontSize: 12, cursor: 'pointer' }}>
            사용 내역
          </button>
          <button onClick={() => openPopup('pay-charge')} style={{ flex: 1, padding: 9, borderRadius: 10, background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)', fontSize: 12, cursor: 'pointer' }}>
            충전하기
          </button>
        </div>
      </div>
      {/* 팝업 오버레이 */}
      {popup && (
        <div onClick={(e) => { if (e.target === e.currentTarget) setPopup(null) }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 999, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div style={{ width: '100%', maxWidth: 480, background: '#1a1714', borderRadius: '20px 20px 0 0', maxHeight: '75vh', overflowY: 'auto', paddingBottom: 32 }}>
            {/* 팝업 헤더 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px 12px', borderBottom: '0.5px solid rgba(255,255,255,0.08)', position: 'sticky', top: 0, background: '#1a1714', zIndex: 1 }}>
              <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.9)' }}>
                {popup === 'toast' ? '토스트 적립 내역' : popup === 'pay-history' ? '오렌페이 내역' : '오렌페이 충전'}
              </span>
              <button onClick={() => setPopup(null)} style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: 14 }}>✕</button>
            </div>
            {/* 토스트 내역 */}
            {popup === 'toast' && (
              <>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '12px 20px', borderBottom: '0.5px solid rgba(255,255,255,0.06)' }}>
                  <span style={pillStyle('#e8c040','rgba(255,220,100,0.12)','rgba(255,220,100,0.3)')}>🧈 버터 — 충전 시 5% 적립</span>
                  <span style={pillStyle('#e05070','rgba(220,80,100,0.12)','rgba(220,80,100,0.3)')}>🍓 딸기잼 — 친구 초대</span>
                  <span style={pillStyle('#ffb400','rgba(255,180,0,0.12)','rgba(255,180,0,0.3)')}>🍯 꿀 — 리뷰 작성</span>
                </div>
                {toastTx.length === 0 && <div style={{ padding: '20px', textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>적립 내역이 없어요</div>}
                {toastTx.map((tx) => {
                  const src = tx.source_type || tx.transaction_type || ''
                  const badge = BADGE[src] || BADGE['attendance']
                  const isEarn = Number(tx.amount) > 0
                  return (
                    <div key={tx.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 20px', borderBottom: '0.5px solid rgba(255,255,255,0.04)' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <span style={pillStyle(badge.color, badge.bg, badge.border)}>{badge.label}</span>
                        <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>{txLabel(src)}</span>
                        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>{tx.created_at?.slice(0, 10).replace(/-/g, '.')}</span>
                      </div>
                      <span style={{ fontSize: 13, color: isEarn ? '#c9a96e' : 'rgba(255,255,255,0.35)', fontFamily: 'monospace' }}>
                        {isEarn ? '+' : ''}{Number(tx.amount).toLocaleString()}T
                      </span>
                    </div>
                  )
                })}
              </>
            )}
            {/* 오렌페이 내역 */}
            {popup === 'pay-history' && (
              <>
                {payHistory.length === 0 && <div style={{ padding: '20px', textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>내역이 없어요</div>}
                {payHistory.map((h, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 20px', borderBottom: '0.5px solid rgba(255,255,255,0.04)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <span style={pillStyle(h.type === 'charge' ? '#9b7ec8' : 'rgba(255,255,255,0.35)', h.type === 'charge' ? 'rgba(123,94,167,0.2)' : 'rgba(255,255,255,0.06)', h.type === 'charge' ? 'rgba(123,94,167,0.3)' : 'rgba(255,255,255,0.1)')}>
                        {h.type === 'charge' ? '충전' : '사용'}
                      </span>
                      <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>{h.label}</span>
                      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>{h.date?.slice(0, 10).replace(/-/g, '.')}</span>
                    </div>
                    <span style={{ fontSize: 13, color: h.type === 'charge' ? '#9b7ec8' : 'rgba(255,255,255,0.35)', fontFamily: 'monospace' }}>
                      {h.type === 'charge' ? '+' : '-'}₩{h.amount.toLocaleString()}
                    </span>
                  </div>
                ))}
              </>
            )}
            {/* 오렌페이 충전 */}
            {popup === 'pay-charge' && (
              <div style={{ padding: '16px 20px' }}>
                <div style={{ fontSize: 11, color: '#e8c040', background: 'rgba(255,220,100,0.08)', border: '0.5px solid rgba(255,220,100,0.2)', borderRadius: 10, padding: '10px 12px', marginBottom: 14, lineHeight: 1.6 }}>
                  🧈 카드 결제 2% · 무통장 5% 버터로 적립돼요
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 10 }}>충전 금액 선택</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                  {PRESETS.map((amt) => (
                    <button key={amt} onClick={() => handleSelectAmt(amt)}
                      style={{ padding: 12, borderRadius: 10, background: selectedAmt === amt ? 'rgba(123,94,167,0.35)' : 'rgba(123,94,167,0.12)', border: `0.5px solid ${selectedAmt === amt ? 'rgba(123,94,167,0.7)' : 'rgba(123,94,167,0.25)'}`, color: '#c4a7e7', fontSize: 13, cursor: 'pointer', textAlign: 'center' }}>
                      ₩{amt.toLocaleString()}<br />
                      <span style={{ fontSize: 10, color: '#e8c040' }}>+{Math.floor(amt * 0.05).toLocaleString()}T 🧈</span>
                    </button>
                  ))}
                </div>
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: 6 }}>직접 입력</div>
                  <input type="number" value={customAmt} onChange={(e) => handleCustomAmt(e.target.value)}
                    placeholder="금액을 입력하세요"
                    style={{ width: '100%', padding: '11px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(255,255,255,0.12)', color: '#fff', fontSize: 14, outline: 'none' }} />
                  {butterPreview > 0 && customAmt && (
                    <div style={{ fontSize: 10, color: '#e8c040', marginTop: 6 }}>버터 적립 예정: {butterPreview.toLocaleString()}T 🧈</div>
                  )}
                </div>
                <button
                  disabled={selectedAmt < 1000}
                  onClick={() => { setPopup(null); router.push(`/wallet?charge=${selectedAmt}`) }}
                  style={{ width: '100%', padding: 13, borderRadius: 12, background: selectedAmt >= 1000 ? '#7b5ea7' : 'rgba(123,94,167,0.3)', border: 'none', color: selectedAmt >= 1000 ? '#fff' : 'rgba(255,255,255,0.3)', fontSize: 13, cursor: selectedAmt >= 1000 ? 'pointer' : 'default' }}>
                  {selectedAmt >= 1000 ? `₩${selectedAmt.toLocaleString()} 충전하기 (카드결제)` : '충전하기'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
