'use client'

import { useEffect, useRef, useState } from 'react'
import SlideUpSheet from '@/components/ui/SlideUpSheet'

type Product = {
  id: string
  name: string
  retail_price: number
  thumb_img: string | null
  brand: { name: string; brand_name_kr: string | null } | null
}

const ACCENT = '#e8845a'

const inp = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 10,
  background: '#faf8f6',
  border: '1px solid #f0ece8',
  color: '#222',
  fontSize: 13,
  boxSizing: 'border-box',
} as const

const ERROR_TEXT: Record<string, string> = {
  not_logged_in: '로그인이 필요합니다.',
  curator_only: '큐레이터 계정만 신청할 수 있습니다.',
  invalid_product: '선택한 제품을 찾을 수 없어요. 다시 선택해 주세요.',
  invalid_period: '종료일은 시작일 이후로 선택해 주세요.',
  already_requested: '이미 검토 중인 같은 제품 신청이 있어요.',
}

function SheetHead({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
      <div style={{ fontSize: 16, fontWeight: 500, color: '#222' }}>{title}</div>
      <button
        type="button"
        aria-label="닫기"
        onClick={onClose}
        style={{ border: 'none', background: 'transparent', color: '#888', fontSize: 22, lineHeight: 1, cursor: 'pointer', padding: 4 }}
      >
        ×
      </button>
    </div>
  )
}

function Thumb({ src, size }: { src: string | null; size: number }) {
  if (!src) {
    return (
      <div style={{ width: size, height: size, borderRadius: 10, background: '#faf8f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size / 2, flex: '0 0 auto', margin: '0 auto' }}>🛍️</div>
    )
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" style={{ width: size, height: size, borderRadius: 10, objectFit: 'cover', background: '#faf8f6', display: 'block', flex: '0 0 auto', margin: '0 auto' }} />
}

export default function GroupBuySheet({
  open,
  onClose,
  onSubmitted,
  isMobile,
}: {
  open: boolean
  onClose: () => void
  onSubmitted: () => void
  isMobile: boolean
}) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [products, setProducts] = useState<Product[] | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [title, setTitle] = useState('')
  const [startAt, setStartAt] = useState('')
  const [endAt, setEndAt] = useState('')
  const [desc, setDesc] = useState('')
  const [pickError, setPickError] = useState(false)
  const [query, setQuery] = useState('')
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => {
    const pending = timers.current
    return () => pending.forEach(clearTimeout)
  }, [])

  const later = (fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms))
  }

  // [ANCHOR: fetch-groupbuy-products]
  useEffect(() => {
    if (!pickerOpen || products !== null) return
    let alive = true
    setLoadFailed(false)
    fetch('/api/curator/groupbuy', { cache: 'no-store' })
      .then(res => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((json: { items?: Product[] }) => {
        if (alive) setProducts(json.items ?? [])
      })
      .catch(err => {
        console.error('[GroupBuySheet] products load error', err)
        if (alive) setLoadFailed(true)
      })
    return () => {
      alive = false
    }
  }, [pickerOpen, products])

  const resetForm = () => {
    setSelectedProduct(null)
    setTitle('')
    setStartAt('')
    setEndAt('')
    setDesc('')
    setError('')
  }

  // [ANCHOR: groupbuy-submit]
  const submitRequest = async () => {
    if (selectedProduct === null) {
      setPickError(true)
      later(() => setPickError(false), 500)
      return
    }
    if (startAt && endAt && endAt < startAt) {
      setError(ERROR_TEXT.invalid_period)
      return
    }
    setSending(true)
    setError('')
    const message = [title.trim() && `[${title.trim()}]`, desc.trim()].filter(Boolean).join('\n')
    const res = await fetch('/api/curator/groupbuy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_id: selectedProduct.id, message, desired_start_at: startAt, desired_end_at: endAt }),
    }).catch(() => null)
    const json = (await res?.json().catch(() => null)) as unknown as { ok?: boolean; error?: string } | null
    setSending(false)
    if (!res?.ok || !json?.ok) {
      console.error('[GroupBuySheet] submit error', json?.error ?? res?.status ?? 'network')
      setError(ERROR_TEXT[json?.error || ''] || '신청하지 못했어요. 잠시 후 다시 시도해 주세요.')
      return
    }
    resetForm()
    onSubmitted()
    onClose()
  }

  const onSelect = (p: Product) => {
    setHighlightId(p.id)
    later(() => {
      setHighlightId(null)
      setSelectedProduct(p)
      setError('')
      setPickerOpen(false)
    }, 200)
  }

  const q = query.trim().toLowerCase()
  const filtered = (products ?? []).filter(p => !q || p.name.toLowerCase().includes(q))

  const productBtnBorder = pickError ? '2px solid red' : selectedProduct ? `2px solid ${ACCENT}` : `2px dashed ${ACCENT}`

  return (
    <>
      {/* 공구신청 시트 */}
      <SlideUpSheet open={open} onClose={onClose} zIndex={9000} height="auto" maxHeight="90dvh">
        <div style={{ background: '#fff', color: '#222', colorScheme: 'light', padding: '18px 18px 28px', maxWidth: 560, margin: '0 auto' }}>
          <SheetHead title="공구 신청" onClose={onClose} />
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            style={{ border: productBtnBorder, borderRadius: 12, padding: '12px 16px', background: '#fff', color: ACCENT, width: '100%', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}
          >
            {selectedProduct ? (
              <>
                <span style={{ color: '#222', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {selectedProduct.name} {selectedProduct.retail_price.toLocaleString()}원
                </span>
                <span style={{ fontSize: 12, flex: '0 0 auto', marginLeft: 8 }}>변경 ▼</span>
              </>
            ) : (
              <span style={{ width: '100%', textAlign: 'center' }}>🛍️ 제품 불러오기</span>
            )}
          </button>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>제목</div>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="공구 제목" maxLength={100} style={{ ...inp, marginBottom: 14 }} />
          <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>희망 기간</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <input type="date" value={startAt} onChange={e => setStartAt(e.target.value)} style={inp} />
            <span style={{ fontSize: 12, color: '#888' }}>~</span>
            <input type="date" value={endAt} min={startAt || undefined} onChange={e => setEndAt(e.target.value)} style={inp} />
          </div>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>설명</div>
          <textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="이 제품 추천 이유를 적어주세요" rows={3} maxLength={1800} style={{ ...inp, resize: 'vertical', minHeight: 72, marginBottom: 14 }} />
          {error && <div style={{ fontSize: 12, color: '#d93025', marginBottom: 12 }}>{error}</div>}
          <button
            type="button"
            disabled={sending}
            onClick={() => void submitRequest()}
            style={{ width: '100%', border: 'none', borderRadius: 12, padding: '14px 16px', background: ACCENT, color: '#fff', fontSize: 14, cursor: sending ? 'default' : 'pointer', opacity: sending ? 0.7 : 1 }}
          >
            {sending ? '보내는 중…' : '신청하기'}
          </button>
        </div>
      </SlideUpSheet>

      {/* 제품선택 시트 */}
      <SlideUpSheet open={pickerOpen} onClose={() => setPickerOpen(false)} zIndex={9100} height="80dvh">
        <div style={{ background: '#fff', color: '#222', colorScheme: 'light', padding: '18px 18px 28px', minHeight: '100%', boxSizing: 'border-box' }}>
          <div style={{ maxWidth: 640, margin: '0 auto' }}>
            <SheetHead title="제품 선택" onClose={() => setPickerOpen(false)} />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="제품명 검색" style={{ ...inp, marginBottom: 14 }} />
            {products === null ? (
              <div style={{ fontSize: 12, color: '#999', textAlign: 'center', padding: '24px 0' }}>
                {loadFailed ? '제품을 불러올 수 없습니다' : '불러오는 중…'}
              </div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)', gap: 10 }}>
                  {filtered.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => onSelect(p)}
                      style={{ border: highlightId === p.id ? `2px solid ${ACCENT}` : '2px solid #f0ece8', borderRadius: 12, background: '#fff', padding: '14px 10px', cursor: 'pointer', textAlign: 'center', transition: 'border-color 0.15s' }}
                    >
                      <div style={{ marginBottom: 6 }}>
                        <Thumb src={p.thumb_img} size={56} />
                      </div>
                      <div style={{ fontSize: 12, color: '#999', lineHeight: '16px', minHeight: 16, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.brand?.brand_name_kr || p.brand?.name || ''}</div>
                      <div style={{ fontSize: 13, color: '#222', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                      <div style={{ fontSize: 12, color: ACCENT, marginTop: 2 }}>{p.retail_price.toLocaleString()}원</div>
                    </button>
                  ))}
                </div>
                {filtered.length === 0 && (
                  <div style={{ fontSize: 12, color: '#999', textAlign: 'center', padding: '24px 0' }}>
                    {products.length === 0 ? '신청 가능한 제품이 없어요' : '검색 결과가 없어요'}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </SlideUpSheet>
    </>
  )
}
