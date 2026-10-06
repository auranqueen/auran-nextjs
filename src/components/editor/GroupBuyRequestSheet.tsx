'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type ProductPick = { id: string; name: string; retail_price: number | null; sale_price: number | null }

const label = (t: string) => (
  <div style={{ backgroundColor: '#ffffff', fontSize: 11, color: '#666666', marginBottom: 4 }}>{t}</div>
)

const inp = {
  width: '100%' as const,
  padding: '10px 12px',
  borderRadius: 8,
  background: '#f8f8f8',
  border: '1px solid #e5e5e5',
  color: '#111111',
  fontSize: 13,
  fontWeight: 400,
  boxSizing: 'border-box' as const,
}

const priceOf = (p: ProductPick) => Number(p.sale_price ?? p.retail_price ?? 0)

export default function GroupBuyRequestSheet({
  isOpen,
  onClose,
  onRequested,
}: {
  isOpen: boolean
  onClose: () => void
  onRequested: () => void
}) {
  const supabase = createClient()
  const [pq, setPq] = useState('')
  const [picks, setPicks] = useState<ProductPick[]>([])
  const [pickOpen, setPickOpen] = useState(false)
  const [sel, setSel] = useState<ProductPick | null>(null)
  const [startAt, setStartAt] = useState('')
  const [endAt, setEndAt] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    const q = pq.trim()
    if (q.length < 1) {
      setPicks([])
      return
    }
    const t = setTimeout(() => {
      void supabase
        .from('products')
        .select('id, name, retail_price, sale_price')
        .ilike('name', `%${q}%`)
        .eq('is_active', true)
        .limit(12)
        .then(({ data }) => {
          setPicks((data as ProductPick[]) || [])
        })
    }, 220)
    return () => clearTimeout(t)
  }, [pq])

  const pickProduct = (p: ProductPick) => {
    setSel(p)
    setPickOpen(false)
    setPq(p.name)
  }

  const reset = () => {
    setPq('')
    setPicks([])
    setPickOpen(false)
    setSel(null)
    setStartAt('')
    setEndAt('')
    setMessage('')
  }

  const submit = async () => {
    if (!sel?.id) {
      alert('제품을 선택해 주세요.')
      return
    }
    if (startAt && endAt && endAt < startAt) {
      alert('종료일은 시작일 이후로 선택해 주세요.')
      return
    }
    const requesterId = (await supabase.auth.getUser()).data.user?.id
    if (!requesterId) {
      alert('로그인이 필요합니다.')
      return
    }
    setSending(true)
    const { error } = await supabase.from('group_buy_requests').insert({
      requester_id: requesterId,
      product_id: sel.id,
      message: message.trim() || null,
      desired_start_at: startAt || null,
      desired_end_at: endAt || null,
      status: 'pending',
    } as any)
    setSending(false)
    if (error) {
      alert(error.message)
      return
    }
    reset()
    alert('공구 요청을 보냈습니다.')
    onRequested()
    onClose()
  }

  if (!isOpen) return null

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 220, background: 'rgba(0,0,0,0.5)' }}
      />
      <div
        role="dialog"
        aria-modal="true"
        style={{
          position: 'fixed',
          left: 0,
          bottom: 0,
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          zIndex: 221,
          backgroundColor: '#ffffff',
          borderTop: '1px solid #e5e5e5',
          borderRadius: '16px 16px 0 0',
          color: '#111111',
          colorScheme: 'light',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ backgroundColor: '#ffffff', maxWidth: 560, margin: '0 auto', padding: '18px 18px 28px' }}>
          <div style={{ backgroundColor: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ backgroundColor: '#ffffff', fontSize: 16, color: '#c9a84c' }}>공구 오픈 요청</div>
            <button
              type="button"
              aria-label="닫기"
              onClick={onClose}
              style={{ border: 'none', background: 'transparent', color: '#666666', fontSize: 22, lineHeight: 1, cursor: 'pointer', padding: 4 }}
            >
              ×
            </button>
          </div>

          <div style={{ backgroundColor: '#ffffff', position: 'relative', marginBottom: 14 }}>
            {label('제품 검색')}
            <input
              value={pq}
              onChange={e => {
                setPq(e.target.value)
                setPickOpen(true)
              }}
              onFocus={() => setPickOpen(true)}
              placeholder="제품명 입력"
              style={inp}
            />
            {pickOpen && picks.length > 0 && (
              <div
                style={{
                  position: 'absolute',
                  zIndex: 20,
                  left: 0,
                  right: 0,
                  top: '100%',
                  marginTop: 4,
                  maxHeight: 220,
                  overflow: 'auto',
                  background: '#ffffff',
                  border: '1px solid #e5e5e5',
                  borderRadius: 8,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                }}
              >
                {picks.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => pickProduct(p)}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      padding: '10px 12px',
                      background: 'transparent',
                      border: 'none',
                      borderBottom: '1px solid #e5e5e5',
                      color: '#111111',
                      fontSize: 12,
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{ fontSize: 13 }}>{p.name}</span>
                    <span style={{ fontSize: 11, color: '#666666', marginLeft: 8 }}>{priceOf(p).toLocaleString()}원</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {sel && (
            <div style={{ backgroundColor: '#f8f8f8', border: '1px solid #e5e5e5', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: '#111111', marginBottom: 14 }}>
              {sel.name} · 판매가 {priceOf(sel).toLocaleString()}원
            </div>
          )}

          <div style={{ backgroundColor: '#ffffff', marginBottom: 14 }}>
            {label('희망 공구 기간')}
            <div style={{ backgroundColor: '#ffffff', display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="date" value={startAt} onChange={e => setStartAt(e.target.value)} style={inp} />
              <span style={{ fontSize: 12, color: '#666666' }}>~</span>
              <input type="date" value={endAt} min={startAt || undefined} onChange={e => setEndAt(e.target.value)} style={inp} />
            </div>
          </div>

          <div style={{ backgroundColor: '#ffffff', marginBottom: 18 }}>
            {label('한줄 어필')}
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="이 제품 추천 이유를 적어주세요"
              rows={3}
              style={{ ...inp, resize: 'vertical' as const, minHeight: 72 }}
            />
          </div>

          <div style={{ backgroundColor: '#ffffff', display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                padding: '12px 20px',
                borderRadius: 10,
                border: '1px solid #e5e5e5',
                background: 'transparent',
                color: '#111111',
                fontSize: 13,
                fontWeight: 400,
                cursor: 'pointer',
              }}
            >
              닫기
            </button>
            <button
              type="button"
              disabled={sending}
              onClick={() => void submit()}
              style={{
                flex: 2,
                padding: '12px 20px',
                borderRadius: 10,
                border: 'none',
                background: '#C9A96E',
                color: '#111',
                fontSize: 13,
                fontWeight: 400,
                cursor: 'pointer',
              }}
            >
              {sending ? '요청 중…' : '요청하기'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
