// ===== [오렌 또또 / 르노벨 골든또또 공통 컴포넌트] =====
// 결제 완료 페이지에서 사용
// brand_type: 'general' | 'renobel' | 'both'
// orderId: 주문 ID (order_gifts 저장용)
// userId: 유저 ID (order_gifts 저장용)
// giftItems: 어드민에서 등록한 또또 상품 목록 (gift_items 테이블)

'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface GiftItem {
  id: string
  product_id: string
  brand_type: string
  tier: string
  product?: {
    name: string
    thumb_img?: string
  }
}

interface TotoLotteryProps {
  orderId: string
  userId: string
  brandType: 'general' | 'renobel' | 'both'
  generalTier?: string   // 예: '200000'
  rnobelTier?: string    // 예: '700000'
  giftItems: GiftItem[]
}

export default function TotoLottery({
  orderId,
  userId,
  brandType,
  generalTier,
  rnobelTier,
  giftItems,
}: TotoLotteryProps) {
  const supabase = createClient()
  const [step, setStep] = useState<'card' | 'result' | 'done'>('card')
  const [flipped, setFlipped] = useState<boolean[]>([false,false,false,false,false])
  const [winIdx, setWinIdx] = useState<number>(() => Math.floor(Math.random() * 5))
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)
  const [sampleRequest, setSampleRequest] = useState('')
  const [saving, setSaving] = useState(false)
  const [currentType, setCurrentType] = useState<'general' | 'renobel'>(
    brandType === 'renobel' ? 'renobel' : 'general'
  )

  // 현재 타입에 맞는 gift_items 5개 추출
  const pool = giftItems
    .filter(g => g.brand_type === currentType && g.product)
    .slice(0, 5)

  // 5개 미만이면 렌더 안 함
  if (pool.length < 5) return null

  const initials = ['A','U','R','A','N']

  const handleFlip = (idx: number) => {
    if (selectedIdx !== null) return
    setSelectedIdx(idx)
    // 선택한 카드 먼저 뒤집기
    setFlipped(prev => {
      const next = [...prev]
      next[idx] = true
      return next
    })
    // 500ms 후 나머지 카드 모두 뒤집기
    setTimeout(() => {
      setFlipped([true,true,true,true,true])
      setTimeout(() => setStep('result'), 800)
    }, 500)
  }

  const handleConfirm = async () => {
    if (saving) return
    setSaving(true)
    try {
      const wonItem = pool[winIdx]
      // order_gifts 테이블에 저장
      // 한 주문에 같은 brand_type 중복 저장 방지
      await supabase.from('order_gifts').upsert({
        order_id: orderId,
        user_id: userId,
        gift_item_id: wonItem.id,
        brand_type: currentType,
        tier: currentType === 'renobel' ? rnobelTier : generalTier,
        sample_request: sampleRequest.trim() || null,
        scratched_at: new Date().toISOString(),
      }, { onConflict: 'order_id,brand_type' })
      setStep('done')
    } finally {
      setSaving(false)
    }
  }

  const wonItem = pool[winIdx]
  const isRenobel = currentType === 'renobel'
  const accentColor = isRenobel ? '#C9A96E' : '#7B5EA7'
  const accentBg = isRenobel ? '#fdf8ee' : '#f5f0ff'
  const accentBorder = isRenobel ? '#C9A96E' : '#AFA9EC'

  return (
    <div style={{ margin: '0 0 24px', padding: '20px 16px', borderRadius: 16, border: `0.5px solid ${accentBorder}`, background: accentBg }}>

      {/* 헤더 */}
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 10, letterSpacing: 3, color: accentColor, marginBottom: 6 }}>
          {isRenobel ? 'RENOBEL GOLDEN TOTO' : 'AURAN TOTO'}
        </div>
        <div style={{ fontSize: 17, color: 'var(--color-text-primary)', letterSpacing: -0.3, marginBottom: 4 }}>
          {isRenobel ? '르노벨 골든또또 ✦' : '오렌 또또 💜'}
        </div>
        <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
          {step === 'card' ? '카드 하나를 골라보세요' : step === 'result' ? '선물이 확정됐어요' : '알림장을 확인해보세요'}
        </div>
      </div>

      {/* brandType === 'both' 일 때 탭 */}
      {brandType === 'both' && step === 'card' && (
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 14 }}>
          {(['general','renobel'] as const).map(t => (
            <button
              key={t}
              onClick={() => {
                setCurrentType(t)
                setFlipped([false,false,false,false,false])
                setSelectedIdx(null)
                setWinIdx(Math.floor(Math.random()*5))
              }}
              style={{
                fontSize: 11, padding: '4px 14px', borderRadius: 20,
                border: `0.5px solid ${currentType===t ? accentColor : 'var(--color-border-tertiary)'}`,
                background: currentType===t ? accentColor : 'transparent',
                color: currentType===t ? '#fff' : 'var(--color-text-secondary)',
                cursor: 'pointer',
              }}
            >
              {t === 'general' ? '오렌 또또' : '르노벨 골든또또'}
            </button>
          ))}
        </div>
      )}

      {/* 카드 5장 */}
      {step === 'card' && (
        <>
          <div style={{ display: 'flex', gap: 6, marginBottom: 10, perspective: 1200 }}>
            {pool.map((item, i) => (
              <div
                key={i}
                onClick={() => handleFlip(i)}
                style={{
                  flex: 1, height: 160, cursor: selectedIdx !== null ? 'default' : 'pointer',
                  perspective: 800,
                }}
              >
                <div style={{
                  width: '100%', height: '100%', position: 'relative',
                  transformStyle: 'preserve-3d',
                  transition: 'transform 0.65s cubic-bezier(0.4,0,0.2,1)',
                  transform: flipped[i] ? 'rotateY(180deg)' : 'none',
                }}>
                  {/* 앞면 — 딥 퍼플 호텔카드 */}
                  <div style={{
                    position: 'absolute', width: '100%', height: '100%',
                    backfaceVisibility: 'hidden', borderRadius: 12,
                    background: '#2D1B5E', overflow: 'hidden',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {/* 골드 테두리 효과 — 인라인 border로 대체 */}
                    <div style={{ position: 'absolute', inset: 0, borderRadius: 12, border: '1px solid rgba(201,169,110,0.4)' }} />
                    <div style={{ fontSize: 10, color: 'rgba(201,169,110,0.35)', letterSpacing: 1, marginBottom: 8, position: 'absolute', top: 8, left: 8 }}>AURAN</div>
                    <div style={{ fontSize: 10, color: 'rgba(201,169,110,0.35)', letterSpacing: 1, marginBottom: 8, position: 'absolute', bottom: 8, right: 8 }}>AURAN</div>
                    <div style={{ fontSize: 30, color: '#C9A96E', fontFamily: 'Georgia,serif', fontWeight: 300, letterSpacing: 2, marginBottom: 6 }}>
                      {initials[i]}
                    </div>
                    <div style={{ width: 20, height: 0.5, background: 'rgba(201,169,110,0.5)', marginBottom: 6 }} />
                    <div style={{ fontSize: 9, color: 'rgba(201,169,110,0.4)', letterSpacing: 2 }}>TAP</div>
                  </div>
                  {/* 뒷면 */}
                  <div style={{
                    position: 'absolute', width: '100%', height: '100%',
                    backfaceVisibility: 'hidden', borderRadius: 12,
                    transform: 'rotateY(180deg)',
                    background: i === winIdx ? accentBg : 'var(--color-background-primary)',
                    border: `1.5px solid ${i === winIdx ? accentColor : 'var(--color-border-secondary)'}`,
                    opacity: selectedIdx !== null && i !== winIdx ? 0.35 : 1,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 10,
                  }}>
                    <div style={{ fontSize: 18, marginBottom: 5 }}>
                      {i === winIdx ? (isRenobel ? '✦' : '💜') : '◇'}
                    </div>
                    <div style={{ fontSize: 9, color: i === winIdx ? accentColor : 'var(--color-text-secondary)', textAlign: 'center', lineHeight: 1.5, wordBreak: 'keep-all' }}>
                      {i === winIdx ? item.product?.name : '아쉽게도...'}
                    </div>
                    {i === winIdx && (
                      <div style={{ fontSize: 9, marginTop: 5, padding: '2px 7px', borderRadius: 10, background: isRenobel ? '#faecd4' : '#ede9ff', color: accentColor }}>
                        {isRenobel ? '골든 당첨' : '당첨'}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', textAlign: 'center', minHeight: 16 }}>
            {selectedIdx === null ? '마음에 드는 카드를 골라보세요' : selectedIdx === winIdx ? '당첨됐어요! 🎉' : '이번엔 아쉽게도... 다음엔 꼭!'}
          </div>
        </>
      )}

      {/* 당첨 결과 + 샘플 입력 */}
      {step === 'result' && (
        <div>
          <div style={{
            borderRadius: 12, padding: '12px 14px', marginBottom: 10,
            background: 'var(--color-background-primary)',
            border: `0.5px solid ${accentBorder}`,
          }}>
            <div style={{ fontSize: 10, letterSpacing: 2, color: accentColor, marginBottom: 5 }}>
              {isRenobel ? 'GOLDEN GIFT' : 'GIFT'}
            </div>
            <div style={{ fontSize: 14, color: 'var(--color-text-primary)', marginBottom: 3, letterSpacing: -0.2 }}>
              {wonItem.product?.name}
            </div>
            <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
              이 제품이 택배에 함께 담겨요 💜
            </div>
          </div>
          <div style={{ background: 'var(--color-background-primary)', borderRadius: 12, padding: '12px 14px', marginBottom: 10, border: '0.5px solid var(--color-border-tertiary)' }}>
            <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 7 }}>
              원하는 샘플이 있으면 적어주세요 (선택)
            </div>
            <textarea
              value={sampleRequest}
              onChange={e => setSampleRequest(e.target.value)}
              placeholder="예) 수분 크림 샘플이 필요해요"
              rows={2}
              style={{
                width: '100%', border: '0.5px solid var(--color-border-secondary)',
                borderRadius: 8, padding: '8px 10px', fontSize: 12,
                fontFamily: 'inherit', resize: 'none',
                background: 'var(--color-background-secondary)',
                color: 'var(--color-text-primary)',
              }}
            />
            <div style={{ fontSize: 10, color: 'var(--color-text-secondary)', marginTop: 6, lineHeight: 1.6 }}>
              입력 안 하셔도 괜찮아요. 맑원장이 피부에 맞는 샘플을 직접 골라드려요 💜
            </div>
          </div>
          <button
            onClick={handleConfirm}
            disabled={saving}
            style={{
              width: '100%', padding: 13, borderRadius: 12, border: 'none',
              background: accentColor, color: '#fff', fontSize: 14,
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.6 : 1, letterSpacing: -0.2,
            }}
          >
            {saving ? '저장 중...' : '확인 완료'}
          </button>
        </div>
      )}

      {/* 완료 */}
      {step === 'done' && (
        <div style={{ textAlign: 'center', padding: '8px 0' }}>
          <div style={{ fontSize: 10, letterSpacing: 3, color: accentColor, marginBottom: 8 }}>AURAN</div>
          <div style={{ fontSize: 15, color: 'var(--color-text-primary)', marginBottom: 4 }}>
            알림장을 확인해보세요 💜
          </div>
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
            맑원장이 팁카드를 보내드렸어요
          </div>
        </div>
      )}
    </div>
  )
}
