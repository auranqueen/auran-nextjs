'use client'

import { createClient } from '@/lib/supabase/client'
import { useEffect, useMemo, useState } from 'react'

// DB status: pending | active | discontinued (UI "rejected" = discontinued)
function toDbStatus(tab: 'pending' | 'active' | 'rejected') {
  return tab === 'rejected' ? 'discontinued' : tab
}

// ───────────────────────────────────────────────
// 이미지 URL 매핑 팝업
// ───────────────────────────────────────────────
function ImageMapModal({
  product,
  onClose,
  onSave,
}: {
  product: any
  onClose: () => void
  onSave: (id: string, url: string) => Promise<void>
}) {
  const [url, setUrl] = useState(product.thumb_img || '')
  const [saving, setSaving] = useState(false)
  const [preview, setPreview] = useState(product.thumb_img || '')
  const [previewError, setPreviewError] = useState(false)

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 200,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 20, padding: 28, width: '100%', maxWidth: 480,
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 900, color: '#fff', marginBottom: 16 }}>
          🖼 이미지 URL 수정
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>
          {product.name}
        </div>

        {/* 미리보기 */}
        <div style={{
          width: '100%', height: 160, borderRadius: 12, overflow: 'hidden',
          background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
          marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {preview && !previewError ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt=""
              onError={() => setPreviewError(true)}
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          ) : (
            <span style={{ fontSize: 40, opacity: 0.3 }}>🧴</span>
          )}
        </div>

        <input
          value={url}
          onChange={e => { setUrl(e.target.value); setPreviewError(false) }}
          placeholder="https://... 이미지 URL 입력"
          style={{
            width: '100%', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 10, padding: '10px 14px', color: '#fff', fontSize: 13,
            boxSizing: 'border-box', marginBottom: 8,
          }}
        />
        <button
          onClick={() => { setPreview(url); setPreviewError(false) }}
          style={{
            width: '100%', background: 'rgba(255,255,255,0.08)', border: 'none',
            borderRadius: 10, padding: '8px 0', color: 'rgba(255,255,255,0.7)',
            fontSize: 12, cursor: 'pointer', marginBottom: 16,
          }}
        >
          미리보기 확인
        </button>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1, background: 'rgba(255,255,255,0.07)', border: 'none',
              borderRadius: 10, padding: '12px 0', color: 'rgba(255,255,255,0.6)',
              fontSize: 13, cursor: 'pointer',
            }}
          >
            취소
          </button>
          <button
            onClick={async () => {
              setSaving(true)
              await onSave(product.id, url)
              setSaving(false)
              onClose()
            }}
            disabled={saving}
            style={{
              flex: 1, background: 'var(--gold, #c9a84c)', border: 'none',
              borderRadius: 10, padding: '12px 0', color: '#000',
              fontSize: 13, fontWeight: 900, cursor: 'pointer',
            }}
          >
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ───────────────────────────────────────────────
// 제품 상세 팝업
// ───────────────────────────────────────────────
function ProductDetailModal({
  product,
  tab,
  busyId,
  onClose,
  onApprove,
  onReject,
  onImageMap,
  onSaveFlash,
}: {
  product: any
  tab: 'pending' | 'active' | 'rejected'
  busyId: string | null
  onClose: () => void
  onApprove: (id: string) => void
  onReject: (id: string) => void
  onImageMap: (product: any) => void
  onSaveFlash: (id: string, payload: { is_flash_sale: boolean; flash_sale_price: number | null; flash_sale_start: string | null; flash_sale_end: string | null }) => Promise<void>
}) {
  const [imgError, setImgError] = useState(false)
  const thumbUrl = product.thumb_img && !imgError ? product.thumb_img : null
  const [isFlashSale, setIsFlashSale] = useState(!!product.is_flash_sale)
  const [flashSalePrice, setFlashSalePrice] = useState(String(product.flash_sale_price || ''))
  const [flashSaleStart, setFlashSaleStart] = useState(product.flash_sale_start ? new Date(product.flash_sale_start).toISOString().slice(0, 16) : '')
  const [flashSaleEnd, setFlashSaleEnd] = useState(product.flash_sale_end ? new Date(product.flash_sale_end).toISOString().slice(0, 16) : '')

  const fields = [
    { label: '브랜드', value: product.brandName },
    { label: '가격', value: `₩${product.price?.toLocaleString()}` },
    { label: '등록일', value: product.created_at ? new Date(product.created_at).toLocaleDateString('ko-KR') : '-' },
    { label: '상태', value: product.status },
    { label: 'ID', value: product.id },
  ]

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.80)', zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#181818', border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 24, padding: 28, width: '100%', maxWidth: 520,
          maxHeight: '90vh', overflowY: 'auto',
        }}
      >
        {/* 이미지 */}
        <div style={{
          width: '100%', height: 220, borderRadius: 16, overflow: 'hidden',
          background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
          marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative',
        }}>
          {thumbUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumbUrl}
              alt=""
              onError={() => setImgError(true)}
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          ) : (
            <span style={{ fontSize: 60, opacity: 0.2 }}>🧴</span>
          )}
          {/* 이미지 수정 버튼 */}
          <button
            onClick={() => onImageMap(product)}
            style={{
              position: 'absolute', bottom: 10, right: 10,
              background: imgError ? '#e53935' : 'rgba(0,0,0,0.6)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 8, padding: '5px 10px', color: '#fff',
              fontSize: 11, cursor: 'pointer',
            }}
          >
            {imgError ? '⚠️ 이미지 깨짐 — URL 수정' : '🖼 이미지 수정'}
          </button>
        </div>

        {/* 제품명 */}
        <div style={{ fontSize: 18, fontWeight: 900, color: '#fff', marginBottom: 16 }}>
          {product.name}
        </div>

        {/* 필드 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
          {fields.map(f => (
            <div key={f.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>{f.label}</span>
              <span style={{ fontSize: 13, color: '#fff', fontWeight: 700 }}>{f.value}</span>
            </div>
          ))}
        </div>

        {/* 설명 */}
        {product.description && (
          <div style={{
            background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 14,
            fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, marginBottom: 24,
          }}>
            {product.description}
          </div>
        )}

        <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 14, marginBottom: 20 }}>
          <div style={{ fontSize: 12, color: '#fff', fontWeight: 900, marginBottom: 10 }}>타임세일 설정</div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, fontSize: 12, color: '#fff' }}>
            <input type="checkbox" checked={isFlashSale} onChange={(e) => setIsFlashSale(e.target.checked)} />
            타임세일 적용
          </label>
          {isFlashSale && (
            <div style={{ display: 'grid', gap: 8 }}>
              <input value={flashSalePrice} onChange={(e) => setFlashSalePrice(e.target.value.replace(/[^0-9]/g, ''))} placeholder="세일가(원)" style={{ width: '100%', background: '#121212', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '8px 10px', color: '#fff', fontSize: 12 }} />
              <input type="datetime-local" value={flashSaleStart} onChange={(e) => setFlashSaleStart(e.target.value)} style={{ width: '100%', background: '#121212', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '8px 10px', color: '#fff', fontSize: 12 }} />
              <input type="datetime-local" value={flashSaleEnd} onChange={(e) => setFlashSaleEnd(e.target.value)} style={{ width: '100%', background: '#121212', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '8px 10px', color: '#fff', fontSize: 12 }} />
            </div>
          )}
          <button
            type="button"
            onClick={async () => {
              await onSaveFlash(product.id, {
                is_flash_sale: isFlashSale,
                flash_sale_price: isFlashSale ? Number(flashSalePrice || 0) : null,
                flash_sale_start: isFlashSale && flashSaleStart ? new Date(flashSaleStart).toISOString() : null,
                flash_sale_end: isFlashSale && flashSaleEnd ? new Date(flashSaleEnd).toISOString() : null,
              })
            }}
            style={{ marginTop: 10, background: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.35)', borderRadius: 10, padding: '8px 12px', color: '#c9a84c', fontSize: 12, fontWeight: 800 }}
          >
            타임세일 저장
          </button>
        </div>

        {/* 액션 버튼 */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1, background: 'rgba(255,255,255,0.07)', border: 'none',
              borderRadius: 12, padding: '13px 0', color: 'rgba(255,255,255,0.6)',
              fontSize: 13, cursor: 'pointer',
            }}
          >
            닫기
          </button>
          {tab === 'pending' && (
            <>
              <button
                onClick={() => { onReject(product.id); onClose() }}
                disabled={busyId === product.id}
                style={{
                  flex: 1, background: 'rgba(229,57,53,0.15)', border: '1px solid rgba(229,57,53,0.4)',
                  borderRadius: 12, padding: '13px 0', color: '#e57373',
                  fontSize: 13, fontWeight: 700, cursor: 'pointer',
                }}
              >
                거절
              </button>
              <button
                onClick={() => { onApprove(product.id); onClose() }}
                disabled={busyId === product.id}
                style={{
                  flex: 1, background: 'var(--gold, #c9a84c)', border: 'none',
                  borderRadius: 12, padding: '13px 0', color: '#000',
                  fontSize: 13, fontWeight: 900, cursor: 'pointer',
                }}
              >
                승인
              </button>
            </>
          )}
          {tab === 'rejected' && (
            <button
              onClick={() => { onApprove(product.id); onClose() }}
              disabled={busyId === product.id}
              style={{
                flex: 2, background: 'var(--gold, #c9a84c)', border: 'none',
                borderRadius: 12, padding: '13px 0', color: '#000',
                fontSize: 13, fontWeight: 900, cursor: 'pointer',
              }}
            >
              다시 승인
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ───────────────────────────────────────────────
// 제품 행
// ───────────────────────────────────────────────
function AdminProductRow({
  p,
  tab,
  busyId,
  onApprove,
  onReject,
  onClick,
}: {
  p: any
  tab: 'pending' | 'active' | 'rejected'
  busyId: string | null
  onApprove: (id: string) => void
  onReject: (id: string) => void
  onClick: () => void
}) {
  const [imgError, setImgError] = useState(false)
  const thumbUrl = p.thumb_img && !imgError ? p.thumb_img : null

  return (
    <div
      onClick={onClick}
      style={{
        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)',
        borderRadius: 14, padding: 12, display: 'flex', gap: 12,
        cursor: 'pointer', transition: 'background 0.15s',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
    >
      {/* 썸네일 */}
      <div style={{
        width: 64, height: 64, borderRadius: 12, overflow: 'hidden',
        border: imgError ? '1px solid rgba(229,57,53,0.5)' : '1px solid rgba(255,255,255,0.10)',
        background: 'rgba(0,0,0,0.2)', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative',
      }}>
        {thumbUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbUrl}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            onError={() => setImgError(true)}
          />
        ) : (
          <span style={{ fontSize: 20, opacity: 0.4 }}>🧴</span>
        )}
        {imgError && (
          <div style={{
            position: 'absolute', inset: 0, background: 'rgba(229,57,53,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, color: '#e57373',
          }}>⚠️</div>
        )}
      </div>

      {/* 정보 */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 900, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {p.name}
        </div>
        <div style={{ marginTop: 6, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>{p.brandName}</span>
          <span style={{ width: 4, height: 4, borderRadius: 999, background: 'rgba(255,255,255,0.18)', flexShrink: 0 }} />
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 900, color: 'var(--gold, #c9a84c)' }}>
            ₩{p.price.toLocaleString()}
          </span>
          <span style={{ width: 4, height: 4, borderRadius: 999, background: 'rgba(255,255,255,0.18)', flexShrink: 0 }} />
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>
            {p.created_at ? new Date(p.created_at).toLocaleDateString('ko-KR') : ''}
          </span>
        </div>
      </div>

      {/* 버튼 */}
      <div
        onClick={e => e.stopPropagation()}
        style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}
      >
        {tab === 'pending' ? (
          <>
            <button
              onClick={() => onApprove(p.id)}
              disabled={busyId === p.id}
              style={{
                background: 'var(--gold, #c9a84c)', border: 'none', borderRadius: 8,
                padding: '5px 14px', color: '#000', fontSize: 12, fontWeight: 900,
                cursor: 'pointer', opacity: busyId === p.id ? 0.5 : 1,
              }}
            >
              승인
            </button>
            <button
              onClick={() => onReject(p.id)}
              disabled={busyId === p.id}
              style={{
                background: 'rgba(229,57,53,0.15)', border: '1px solid rgba(229,57,53,0.4)',
                borderRadius: 8, padding: '5px 14px', color: '#e57373',
                fontSize: 12, fontWeight: 700, cursor: 'pointer',
                opacity: busyId === p.id ? 0.5 : 1,
              }}
            >
              거절
            </button>
          </>
        ) : tab === 'rejected' ? (
          <button
            onClick={() => onApprove(p.id)}
            disabled={busyId === p.id}
            style={{
              background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 8, padding: '5px 14px', color: '#fff',
              fontSize: 12, cursor: 'pointer',
            }}
          >
            다시 승인
          </button>
        ) : (
          <span style={{ fontSize: 11, color: '#4caf50', fontWeight: 700 }}>ACTIVE</span>
        )}
      </div>
    </div>
  )
}

// ───────────────────────────────────────────────
// 메인
// ───────────────────────────────────────────────
export default function AdminMarketingProductsClient() {
  const supabase = createClient()
  const [tab, setTab] = useState<'pending' | 'active' | 'rejected'>('pending')
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<any[]>([])
  const [counts, setCounts] = useState({ pending: 0, active: 0, rejected: 0 })
  const [busyId, setBusyId] = useState<string | null>(null)
  const [bulkBusy, setBulkBusy] = useState(false)
  const [q, setQ] = useState('')
  const [brandQ, setBrandQ] = useState('all')

  // 팝업 상태
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null)
  const [imageMapTarget, setImageMapTarget] = useState<any | null>(null)

  const fetchRows = async () => {
    setLoading(true)
    const statusDb = toDbStatus(tab)
    const { data } = await supabase
      .from('products')
      .select('*, brands(name)')
      .eq('status', statusDb)
      .order('created_at', { ascending: false })
    setRows(data || [])

    // 카운트 (DB: pending, active, discontinued)
    const [p, a, r] = await Promise.all([
      supabase.from('products').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('products').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('products').select('id', { count: 'exact', head: true }).eq('status', 'discontinued'),
    ])
    setCounts({ pending: p.count || 0, active: a.count || 0, rejected: r.count || 0 })
    setLoading(false)
  }

  useEffect(() => { fetchRows() }, [tab])

  const mappedRows = useMemo(() =>
    rows.map(r => ({
      ...r,
      brandName: r.brands?.name || '-',
      price: Number(r.retail_price || 0),
    })),
    [rows]
  )

  const brandOptions = useMemo(() => {
    const set = new Set(mappedRows.map(r => r.brandName))
    return ['all', ...Array.from(set)]
  }, [mappedRows])

  const filteredRows = useMemo(() =>
    mappedRows.filter(r => {
      const matchQ = !q || r.name?.toLowerCase().includes(q.toLowerCase()) || r.brandName?.toLowerCase().includes(q.toLowerCase())
      const matchB = brandQ === 'all' || r.brandName === brandQ
      return matchQ && matchB
    }),
    [brandQ, mappedRows, q]
  )

  const approveOne = async (id: string) => {
    setBusyId(id)
    await supabase.from('products').update({ status: 'active' }).eq('id', id)
    await fetchRows()
    setBusyId(null)
  }

  const rejectOne = async (id: string) => {
    setBusyId(id)
    await supabase.from('products').update({ status: 'discontinued' }).eq('id', id)
    await fetchRows()
    setBusyId(null)
  }

  const bulkApprove = async () => {
    setBulkBusy(true)
    await supabase.from('products').update({ status: 'active' }).eq('status', 'pending')
    await fetchRows()
    setBulkBusy(false)
  }

  // 이미지 URL 저장
  const saveImageUrl = async (id: string, url: string) => {
    await supabase.from('products').update({ thumb_img: url }).eq('id', id)
    setRows(prev => prev.map(r => r.id === id ? { ...r, thumb_img: url } : r))
    if (selectedProduct?.id === id) {
      setSelectedProduct((prev: any) => prev ? { ...prev, thumb_img: url } : prev)
    }
  }

  const saveFlashSale = async (id: string, payload: { is_flash_sale: boolean; flash_sale_price: number | null; flash_sale_start: string | null; flash_sale_end: string | null }) => {
    await supabase.from('products').update(payload as any).eq('id', id)
    setRows(prev => prev.map(r => (r.id === id ? { ...r, ...payload } : r)))
    setSelectedProduct((prev: any) => (prev?.id === id ? { ...prev, ...payload } : prev))
  }

  const TABS: { key: 'pending' | 'active' | 'rejected'; label: string }[] = [
    { key: 'pending', label: 'PENDING' },
    { key: 'active', label: 'ACTIVE' },
    { key: 'rejected', label: 'REJECTED' },
  ]

  return (
    <div style={{ padding: '24px 20px', maxWidth: 720, margin: '0 auto' }}>
      {/* 제품 상세 팝업 */}
      {selectedProduct && (
        <ProductDetailModal
          product={selectedProduct}
          tab={tab}
          busyId={busyId}
          onClose={() => setSelectedProduct(null)}
          onApprove={approveOne}
          onReject={rejectOne}
          onImageMap={p => { setSelectedProduct(null); setImageMapTarget(p) }}
          onSaveFlash={saveFlashSale}
        />
      )}

      {/* 이미지 매핑 팝업 */}
      {imageMapTarget && (
        <ImageMapModal
          product={imageMapTarget}
          onClose={() => setImageMapTarget(null)}
          onSave={saveImageUrl}
        />
      )}

      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#fff' }}>제품 관리</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>
            대기/승인/거절 탭 · 검색 · 브랜드 필터 · 일괄 승인
          </div>
        </div>
        {tab === 'pending' && counts.pending > 0 && (
          <button
            onClick={bulkApprove}
            disabled={bulkBusy}
            style={{
              background: 'var(--gold, #c9a84c)', border: 'none', borderRadius: 12,
              padding: '10px 18px', color: '#000', fontSize: 13, fontWeight: 900,
              cursor: 'pointer', opacity: bulkBusy ? 0.6 : 1,
            }}
          >
            {bulkBusy ? '처리 중...' : `전체 승인 (${counts.pending})`}
          </button>
        )}
      </div>

      {/* 탭 */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              background: tab === t.key ? 'transparent' : 'rgba(255,255,255,0.05)',
              border: tab === t.key ? '1.5px solid var(--gold, #c9a84c)' : '1px solid rgba(255,255,255,0.12)',
              borderRadius: 999, padding: '8px 18px',
              color: tab === t.key ? 'var(--gold, #c9a84c)' : 'rgba(255,255,255,0.55)',
              fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}
          >
            {t.label} ({counts[t.key]})
          </button>
        ))}
      </div>

      {/* 검색 + 브랜드 필터 */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="검색: 제품명 / 브랜드"
          style={{
            flex: 1, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 10, padding: '10px 14px', color: '#fff', fontSize: 13,
          }}
        />
        <select
          value={brandQ}
          onChange={e => setBrandQ(e.target.value)}
          style={{
            background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 10, padding: '10px 14px', color: '#fff', fontSize: 13, minWidth: 120,
          }}
        >
          {brandOptions.map(b => (
            <option key={b} value={b} style={{ background: '#1a1a1a' }}>
              {b === 'all' ? '전체 브랜드' : b}
            </option>
          ))}
        </select>
        {(q || brandQ !== 'all') && (
          <button
            onClick={() => { setQ(''); setBrandQ('all') }}
            style={{
              background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 10, padding: '10px 14px', color: 'rgba(255,255,255,0.55)',
              fontSize: 12, cursor: 'pointer',
            }}
          >
            초기화
          </button>
        )}
      </div>

      {/* 리스트 */}
      {loading ? (
        <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', padding: 40 }}>불러오는 중...</div>
      ) : filteredRows.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', padding: 40 }}>표시할 제품이 없습니다.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filteredRows.map(p => (
            <AdminProductRow
              key={p.id}
              p={p}
              tab={tab}
              busyId={busyId}
              onApprove={approveOne}
              onReject={rejectOne}
              onClick={() => setSelectedProduct(p)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
