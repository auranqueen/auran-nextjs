'use client'
// ===== [스토어 구매 후기 어드민] =====
// store_reviews 목록 + 인증 처리 + 회원 전환 표시
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function StoreReviewsAdminPage() {
  const supabase = createClient()
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2000)
  }

  const load = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('store_reviews')
      .select('*, profiles(full_name, hormone_phase, skin_type)')
      .order('created_at', { ascending: false })
    setItems(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleVerify = async (id: string, current: boolean) => {
    await supabase.from('store_reviews').update({ is_verified: !current }).eq('id', id)
    setItems(prev => prev.map(i => i.id === id ? { ...i, is_verified: !current } : i))
    showToast(!current ? '인증 처리됐어요 💜' : '인증 취소됐어요')
  }

  const unverified = items.filter(i => !i.is_verified && i.store_order_no).length

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 16px' }}>
      {toast && (
        <div style={{
          position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)',
          background: '#7B5EA7', color: '#fff', padding: '10px 20px',
          borderRadius: 20, fontSize: 13, zIndex: 9999,
        }}>
          {toast}
        </div>
      )}

      <div style={{ fontSize: 18, color: 'var(--color-text-primary)', marginBottom: 4 }}>
        스토어 구매 후기
        {unverified > 0 && (
          <span style={{
            marginLeft: 8, fontSize: 11,
            background: '#ff4444', color: '#fff',
            borderRadius: 20, padding: '2px 8px',
          }}>
            인증 대기 {unverified}건
          </span>
        )}
      </div>
      <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 20 }}>
        QR 카드로 유입된 스토어 구매 후기
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', color: 'var(--color-text-secondary)', padding: '40px 0', fontSize: 13 }}>
          불러오는 중...
        </div>
      ) : items.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--color-text-secondary)', padding: '40px 0', fontSize: 13 }}>
          아직 스토어 후기가 없어요 💜
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.map(item => (
            <div
              key={item.id}
              style={{
                background: 'var(--color-background-primary)',
                borderRadius: 12, padding: '14px 16px',
                border: '0.5px solid var(--color-border-tertiary)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ fontSize: 13, color: 'var(--color-text-primary)', flex: 1 }}>
                  {item.product_name || '제품 없음'}
                </div>
                <div style={{ display: 'flex', gap: 2 }}>
                  {'★'.repeat(item.rating)}
                </div>
                {item.is_verified && (
                  <span style={{
                    fontSize: 10, padding: '2px 8px', borderRadius: 20,
                    background: '#f0faf6', color: '#0F6E56',
                    border: '0.5px solid #5DCAA5',
                  }}>
                    실구매 인증 💜
                  </span>
                )}
                <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
                  {new Date(item.created_at).toLocaleDateString('ko-KR')}
                </div>
              </div>

              {/* 고객 피부 프로필 */}
              {item.profiles && (
                <div style={{
                  fontSize: 11, color: 'var(--color-text-secondary)',
                  marginBottom: 8, lineHeight: 1.7,
                  padding: '6px 10px', borderRadius: 8,
                  background: 'var(--color-background-secondary)',
                }}>
                  {item.profiles.full_name} ·
                  호르몬: {item.profiles.hormone_phase || '-'} ·
                  피부: {item.profiles.skin_type || '-'}
                </div>
              )}

              <div style={{ fontSize: 13, color: 'var(--color-text-primary)', lineHeight: 1.6, marginBottom: 8 }}>
                {item.content}
              </div>

              {item.store_order_no && (
                <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 8 }}>
                  주문번호: {item.store_order_no}
                </div>
              )}

              <div style={{ display: 'flex', gap: 6 }}>
                {item.store_order_no && (
                  <button
                    onClick={() => handleVerify(item.id, item.is_verified)}
                    style={{
                      fontSize: 11, padding: '5px 12px', borderRadius: 20,
                      cursor: 'pointer', border: 'none',
                      background: item.is_verified ? '#f0faf6' : '#7B5EA7',
                      color: item.is_verified ? '#0F6E56' : '#fff',
                    }}
                  >
                    {item.is_verified ? '인증됨 ✓' : '인증 처리'}
                  </button>
                )}
                <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', alignSelf: 'center' }}>
                  토스트 {item.toast_amount?.toLocaleString()}T 적립됨
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
