// ===== [스토어 구매 후기] =====
// QR 스캔 → 이 페이지로 직행
// 비회원 → 가입 유도 / 회원 → 바로 후기 작성
// 후기 완료 시: toast_transactions 10,000T 적립
//              notifications insert (알림장)
//              원장 환영 메시지 알림장 발송
'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
// ===== [ReviewForm 재활용] =====
import { ReviewForm } from '@/components/reviews/ReviewForm'

export default function StoreReviewPage() {
  const supabase = createClient()
  const router = useRouter()
  const [step, setStep] = useState<'loading' | 'login' | 'form' | 'done'>('loading')
  const [userId, setUserId] = useState<string | null>(null)
  const [productSearch, setProductSearch] = useState('')
  const [products, setProducts] = useState<any[]>([])
  const [selectedProduct, setSelectedProduct] = useState<any>(null)
  const [showProductList, setShowProductList] = useState(false)
  const [rating, setRating] = useState(5)
  const [content, setContent] = useState('')
  const [orderNo, setOrderNo] = useState('')
  const [saving, setSaving] = useState(false)
  const [toastMsg, setToastMsg] = useState('')

  const showToast = (msg: string) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(''), 2500)
  }

  // 로그인 체크
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUserId(session.user.id)
        setStep('form')
      } else {
        setStep('login')
      }
    })
  }, [])

  // 제품 검색
  useEffect(() => {
    if (!productSearch || productSearch.length < 1) {
      setProducts([])
      return
    }
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from('products')
        .select('id, name, thumb_img, brands(name)')
        .ilike('name', `%${productSearch}%`)
        .eq('is_active', true)
        .limit(20)
      setProducts(data || [])
    }, 300)
    return () => clearTimeout(timer)
  }, [productSearch])

  const handleSubmit = async () => {
    if (!userId || !selectedProduct) return
    setSaving(true)
    try {
      // store_reviews insert
      const { error: rvErr } = await supabase.from('store_reviews').insert({
        user_id: userId,
        product_id: selectedProduct.id,
        product_name: selectedProduct.name,
        store_order_no: orderNo.trim() || null,
        // 주문번호 입력 시 인증 배지
        is_verified: !!orderNo.trim(),
        rating: rating >= 1 ? rating : 5,
        content: content.trim() || '스토어 구매 후기',
        toast_given: true,
        toast_amount: 10000,
      })
      if (rvErr) throw rvErr

      // toast_transactions 10,000T 적립
      const { data: ttUserRow } = await supabase.from('users').select('id').eq('auth_id', userId).maybeSingle()
      if (ttUserRow?.id) {
        await supabase.from('toast_transactions').insert({
          user_id: ttUserRow.id,
          amount: 10000,
          transaction_type: 'review',
          source_type: 'store_review_bonus',
        } as any)
      }

      // users.toast_balance 업데이트
      const { data: uRow } = await supabase
        .from('users')
        .select('toast_balance')
        .eq('id', userId)
        .single()
      if (uRow) {
        await supabase
          .from('users')
          .update({ toast_balance: (uRow.toast_balance || 0) + 10000 })
          .eq('id', userId)
      }

      // notifications insert — 토스트 적립 알림
      await supabase.from('notifications').insert({
        user_id: userId,
        type: 'toast',
        title: '후기 작성 완료 💜',
        message: `스토어 구매 후기 감사해요! 토스트 10,000T 적립됐어요 💜`,
        is_read: false,
      })

      // notifications insert — 원장 환영 메시지
      await supabase.from('notifications').insert({
        user_id: userId,
        type: 'message',
        title: '맑원장이에요 💜',
        message: `드디어 오셨네요 💜 맑원장이 기다렸어요. ${selectedProduct.name} 잘 쓰고 계신가요? 호르몬 사이클에 맞게 써보시면 더 효과 좋아요!`,
        is_read: false,
      })

    } catch (e) {
      showToast('저장 중 오류가 발생했어요. 다시 시도해주세요.')
    } finally {
      setSaving(false)
    }
  }

  const PURPLE = '#7B5EA7'
  const GOLD = '#C9A96E'

  if (step === 'loading') return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', fontSize: 13, color: '#999' }}>
      잠깐만요...
    </div>
  )

  if (step === 'login') return (
    <div style={{ maxWidth: 400, margin: '0 auto', padding: '40px 20px', textAlign: 'center' }}>
      {/* 로고 */}
      <div style={{ fontSize: 11, letterSpacing: 3, color: GOLD, marginBottom: 8 }}>AURAN</div>
      <div style={{ fontSize: 20, color: '#111', marginBottom: 8, letterSpacing: -0.3 }}>
        스토어 구매 후기 쓰기
      </div>
      <div style={{ fontSize: 13, color: '#666', lineHeight: 1.7, marginBottom: 32 }}>
        후기 작성하시면<br />
        토스트 10,000T 즉시 적립돼요 💜<br />
        <span style={{ fontSize: 11, color: '#999' }}>가입하시면 호르몬 맞춤 케어도 받을 수 있어요</span>
      </div>
      <button
        onClick={() => router.push('/login?redirect=/store-review')}
        style={{
          width: '100%', padding: 14, borderRadius: 12,
          border: 'none', background: PURPLE, color: '#fff',
          fontSize: 15, cursor: 'pointer', marginBottom: 10,
          letterSpacing: -0.2,
        }}
      >
        로그인하고 후기 쓰기
      </button>
      <button
        onClick={() => router.push('/signup?redirect=/store-review')}
        style={{
          width: '100%', padding: 12, borderRadius: 12,
          border: `0.5px solid ${PURPLE}`, background: '#f5f0ff',
          color: PURPLE, fontSize: 14, cursor: 'pointer',
          letterSpacing: -0.2,
        }}
      >
        1분만에 가입하기 💜
      </button>
    </div>
  )

  if (step === 'done') return (
    <div style={{ maxWidth: 400, margin: '0 auto', padding: '60px 20px', textAlign: 'center' }}>
      <div style={{ fontSize: 36, marginBottom: 16 }}>💜</div>
      <div style={{ fontSize: 20, color: '#111', marginBottom: 8, letterSpacing: -0.3 }}>
        후기 감사해요!
      </div>
      <div style={{ fontSize: 13, color: '#666', lineHeight: 1.7, marginBottom: 8 }}>
        토스트 10,000T 적립됐어요 💜
      </div>
      <div style={{ fontSize: 12, color: '#999', marginBottom: 32 }}>
        알림장에서 맑원장 메시지 확인해보세요
      </div>
      <button
        onClick={() => router.push('/')}
        style={{
          width: '100%', padding: 13, borderRadius: 12,
          border: 'none', background: PURPLE, color: '#fff',
          fontSize: 14, cursor: 'pointer', letterSpacing: -0.2,
        }}
      >
        오랜 홈으로 가기
      </button>
    </div>
  )

  return (
    <div style={{ maxWidth: 400, margin: '0 auto', padding: '24px 20px' }}>
      {toastMsg && (
        <div style={{
          position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)',
          background: PURPLE, color: '#fff', padding: '10px 20px',
          borderRadius: 20, fontSize: 13, zIndex: 9999,
        }}>
          {toastMsg}
        </div>
      )}

      {/* ===== [스토어 후기] ReviewForm 재활용 ===== */}
      <div style={{ fontSize: 10, letterSpacing: 3, color: GOLD, marginBottom: 6 }}>AURAN</div>
      <div style={{ fontSize: 18, color: 'var(--color-text-primary)', marginBottom: 4, letterSpacing: -0.3 }}>
        스토어 구매 후기 쓰기
      </div>
      <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 20, lineHeight: 1.6 }}>
        맑원장 확인 후 토스트 10,000T 적립돼요 💜
      </div>

      {/* 제품 검색 */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 6 }}>구매하신 제품</div>
        <div style={{ position: 'relative' }}>
          <input
            value={selectedProduct ? selectedProduct.name : productSearch}
            onChange={e => {
              setProductSearch(e.target.value)
              setSelectedProduct(null)
              setShowProductList(true)
            }}
            onFocus={() => setShowProductList(true)}
            placeholder="제품명 검색..."
            style={{
              width: '100%', padding: '10px 12px', borderRadius: 10,
              border: '0.5px solid #ddd', fontSize: 13,
              background: '#fff', color: '#111',
            }}
          />
          {selectedProduct && (
            <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: '#7B5EA7' }}>✓</div>
          )}
          {showProductList && products.length > 0 && !selectedProduct && (
            <div style={{
              position: 'absolute', top: '110%', left: 0, right: 0,
              background: '#fff', border: '0.5px solid #ddd',
              borderRadius: 10, zIndex: 100, maxHeight: 200,
              overflowY: 'auto', boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
            }}>
              {products.map((p: any) => (
                <div
                  key={p.id}
                  onClick={() => {
                    setSelectedProduct(p)
                    setProductSearch(p.name)
                    setShowProductList(false)
                  }}
                  style={{
                    padding: '10px 12px', fontSize: 13, color: '#111',
                    cursor: 'pointer', borderBottom: '0.5px solid #f5f5f5',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f5f0ff')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
                >
                  {p.name}
                  {p.brands?.name && <span style={{ fontSize: 11, color: '#999', marginLeft: 6 }}>{p.brands.name}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
        {showProductList && products.length > 0 && (
          <div onClick={() => setShowProductList(false)} style={{ position: 'fixed', inset: 0, zIndex: 99 }} />
        )}
      </div>

      {selectedProduct && (
        <ReviewForm
          productId={selectedProduct.id}
          isStoreReview={true}
          onSuccess={async () => {
            await handleSubmit()
            setStep('done')
          }}
        />
      )}
    </div>
  )
}
