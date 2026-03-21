'use client'

import ProductThumbnail from '@/components/ProductThumbnail'
import { createClient } from '@/lib/supabase/client'
import { useCallback, useEffect, useMemo, useState } from 'react'

// DB status: pending | active | discontinued (UI "rejected" = discontinued)
function toDbStatus(tab: 'pending' | 'active' | 'rejected') {
  return tab === 'rejected' ? 'discontinued' : tab
}

function isMissingPrice(p: { retail_price?: number | null }) {
  const v = p.retail_price
  if (v == null) return true
  return Number(v) === 0
}

// ───────────────────────────────────────────────
// 제품 상세 모달 (썸네일 URL 즉시 미리보기 + 저장)
// ───────────────────────────────────────────────
function ProductDetailModal({
  product,
  tab,
  busyId,
  onClose,
  onApprove,
  onReject,
  onSaveThumb,
  onSaveFlash,
}: {
  product: any
  tab: 'pending' | 'active' | 'rejected'
  busyId: string | null
  onClose: () => void
  onApprove: (id: string) => void
  onReject: (id: string) => void
  onSaveThumb: (id: string, url: string) => Promise<void>
  onSaveFlash: (id: string, payload: { is_flash_sale: boolean; flash_sale_price: number | null; flash_sale_start: string | null; flash_sale_end: string | null }) => Promise<void>
}) {
  const [thumbDraft, setThumbDraft] = useState(product.thumb_img || '')
  const [thumbSaving, setThumbSaving] = useState(false)
  const [isFlashSale, setIsFlashSale] = useState(!!product.is_flash_sale)
  const [flashSalePrice, setFlashSalePrice] = useState(String(product.flash_sale_price || ''))
  const [flashSaleStart, setFlashSaleStart] = useState(product.flash_sale_start ? new Date(product.flash_sale_start).toISOString().slice(0, 16) : '')
  const [flashSaleEnd, setFlashSaleEnd] = useState(product.flash_sale_end ? new Date(product.flash_sale_end).toISOString().slice(0, 16) : '')

  useEffect(() => {
    setThumbDraft(product.thumb_img || '')
  }, [product.id, product.thumb_img])

  const fields = [
    { label: '브랜드', value: product.brandName },
    {
      label: '가격',
      value: isMissingPrice(product) ? '⚠️ 가격 없음' : `₩${Number(product.retail_price || 0).toLocaleString()}`,
    },
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
        <div style={{
          width: '100%', height: 220, borderRadius: 16, overflow: 'hidden',
          background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
          marginBottom: 12, position: 'relative',
        }}>
          <ProductThumbnail src={thumbDraft} alt={product.name || ''} fill objectFit="contain" style={{ borderRadius: 16 }} />
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 6 }}>썸네일 URL (입력 시 미리보기 즉시 반영)</div>
          <input
            value={thumbDraft}
            onChange={e => setThumbDraft(e.target.value)}
            placeholder="https://..."
            style={{
              width: '100%', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 10, padding: '10px 14px', color: '#fff', fontSize: 12,
              boxSizing: 'border-box', marginBottom: 8,
            }}
          />
          <button
            type="button"
            onClick={async () => {
              setThumbSaving(true)
              try {
                await onSaveThumb(product.id, thumbDraft.trim())
              } finally {
                setThumbSaving(false)
              }
            }}
            disabled={thumbSaving}
            style={{
              width: '100%', background: 'rgba(201,168,76,0.2)', border: '1px solid rgba(201,168,76,0.45)',
              borderRadius: 10, padding: '10px 0', color: '#c9a84c', fontSize: 12, fontWeight: 800, cursor: 'pointer',
            }}
          >
            {thumbSaving ? '저장 중...' : '썸네일 URL 저장'}
          </button>
        </div>

        <div style={{ fontSize: 18, fontWeight: 900, color: '#fff', marginBottom: 16 }}>
          {product.name}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
          {fields.map(f => (
            <div key={f.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>{f.label}</span>
              <span style={{ fontSize: 13, color: '#fff', fontWeight: 700 }}>{f.value}</span>
            </div>
          ))}
        </div>

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
  selected,
  onToggleSelect,
  onApprove,
  onReject,
  onClick,
  onToggleVisibility,
  toggleBusyId,
}: {
  p: any
  tab: 'pending' | 'active' | 'rejected'
  busyId: string | null
  selected: boolean
  onToggleSelect: (id: string) => void
  onApprove: (id: string) => void
  onReject: (id: string) => void
  onClick: () => void
  onToggleVisibility: (id: string, next: 'active' | 'discontinued') => void
  toggleBusyId: string | null
}) {
  const noPrice = isMissingPrice(p)

  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)',
        borderRadius: 14, padding: 12, display: 'flex', gap: 10,
        alignItems: 'center',
        transition: 'background 0.15s',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ flexShrink: 0, paddingTop: 2 }}
      >
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggleSelect(p.id)}
          aria-label="선택"
        />
      </div>

      <div
        onClick={onClick}
        style={{
          display: 'flex', gap: 12, flex: 1, minWidth: 0, cursor: 'pointer',
          alignItems: 'center',
        }}
      >
        <div style={{
          width: 64, height: 64, borderRadius: 12, overflow: 'hidden',
          border: '1px solid rgba(255,255,255,0.10)',
          background: 'rgba(0,0,0,0.2)', flexShrink: 0, position: 'relative',
        }}>
          <ProductThumbnail src={p.thumb_img} alt={p.name || ''} size={64} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 13, fontWeight: 900, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {p.name}
            </div>
            {noPrice ? (
              <span style={{
                fontSize: 10, fontWeight: 800, color: '#ffb74d',
                border: '1px solid rgba(255,183,77,0.45)', borderRadius: 6, padding: '2px 6px',
              }}>
                ⚠️ 가격 없음
              </span>
            ) : null}
          </div>
          <div style={{ marginTop: 6, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>{p.brandName}</span>
            <span style={{ width: 4, height: 4, borderRadius: 999, background: 'rgba(255,255,255,0.18)', flexShrink: 0 }} />
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 900, color: noPrice ? 'rgba(255,255,255,0.35)' : 'var(--gold, #c9a84c)' }}>
              {noPrice ? '—' : `₩${p.price.toLocaleString()}`}
            </span>
            <span style={{ width: 4, height: 4, borderRadius: 999, background: 'rgba(255,255,255,0.18)', flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>
              {p.created_at ? new Date(p.created_at).toLocaleDateString('ko-KR') : ''}
            </span>
          </div>
        </div>
      </div>

      <div
        onClick={e => e.stopPropagation()}
        style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end', flexShrink: 0 }}
      >
        {tab === 'active' && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#fff', cursor: 'pointer' }}>
            <span style={{ color: 'rgba(255,255,255,0.5)' }}>노출</span>
            <input
              type="checkbox"
              checked={p.status === 'active'}
              disabled={toggleBusyId === p.id}
              onChange={() => {
                if (p.status === 'active') onToggleVisibility(p.id, 'discontinued')
                else onToggleVisibility(p.id, 'active')
              }}
            />
            <span style={{ color: p.status === 'active' ? '#81c784' : 'rgba(255,255,255,0.4)' }}>
              {p.status === 'active' ? 'ACTIVE' : 'HIDDEN'}
            </span>
          </label>
        )}
        {tab === 'rejected' && (
          <span style={{ fontSize: 11, color: '#ffb74d', fontWeight: 700 }}>HIDDEN</span>
        )}

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
        ) : null}
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
  const [toggleBusyId, setToggleBusyId] = useState<string | null>(null)
  const [bulkBusy, setBulkBusy] = useState(false)
  const [hideAllBusy, setHideAllBusy] = useState(false)
  const [bulkHideBusy, setBulkHideBusy] = useState(false)
  const [q, setQ] = useState('')
  const [brandQ, setBrandQ] = useState('all')
  const [listFilter, setListFilter] = useState<'all' | 'no_price' | 'with_price'>('all')
  const [brandOptionsFromDb, setBrandOptionsFromDb] = useState<string[] | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [toast, setToast] = useState('')

  const [selectedProduct, setSelectedProduct] = useState<any | null>(null)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 3200)
    return () => clearTimeout(t)
  }, [toast])

  const fetchRows = useCallback(async () => {
    setLoading(true)
    const statusDb = toDbStatus(tab)
    const { data } = await supabase
      .from('products')
      .select('*, brands(name)')
      .eq('status', statusDb)
      .order('created_at', { ascending: false })
    setRows(data || [])

    const [p, a, r] = await Promise.all([
      supabase.from('products').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('products').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('products').select('id', { count: 'exact', head: true }).eq('status', 'discontinued'),
    ])
    setCounts({ pending: p.count || 0, active: a.count || 0, rejected: r.count || 0 })
    setLoading(false)
  }, [supabase, tab])

  useEffect(() => { fetchRows() }, [fetchRows])

  useEffect(() => {
    supabase.from('brands').select('name').order('name').then(({ data }) => {
      const names = (data || []).map((b: { name: string }) => b.name).filter(Boolean)
      setBrandOptionsFromDb(names.length ? names : null)
    })
  }, [supabase])

  const mappedRows = useMemo(() =>
    rows.map(r => ({
      ...r,
      brandName: r.brands?.name || '-',
      price: Number(r.retail_price || 0),
    })),
    [rows]
  )

  const brandOptions = useMemo(() => {
    if (brandOptionsFromDb?.length) return ['all', ...brandOptionsFromDb]
    const set = new Set(mappedRows.map(r => r.brandName))
    return ['all', ...Array.from(set)]
  }, [brandOptionsFromDb, mappedRows])

  const filteredRows = useMemo(() =>
    mappedRows.filter(r => {
      const matchQ = !q || r.name?.toLowerCase().includes(q.toLowerCase()) || r.brandName?.toLowerCase().includes(q.toLowerCase())
      const matchB = brandQ === 'all' || r.brandName === brandQ
      const matchP = listFilter === 'all'
        ? true
        : listFilter === 'no_price'
          ? isMissingPrice(r)
          : !isMissingPrice(r)
      return matchQ && matchB && matchP
    }),
    [brandQ, listFilter, mappedRows, q]
  )

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  const selectAllFiltered = () => {
    setSelectedIds(new Set(filteredRows.map(r => r.id)))
  }

  const clearSelection = () => setSelectedIds(new Set())

  const approveOne = async (id: string) => {
    setBusyId(id)
    await supabase.from('products').update({ status: 'active' }).eq('id', id)
    await fetchRows()
    setBusyId(null)
    setToast('✅ 승인되었습니다')
  }

  const rejectOne = async (id: string) => {
    setBusyId(id)
    await supabase.from('products').update({ status: 'discontinued' }).eq('id', id)
    await fetchRows()
    setBusyId(null)
    setToast('숨김(거절) 처리되었습니다')
  }

  const bulkApprove = async () => {
    setBulkBusy(true)
    await supabase.from('products').update({ status: 'active' }).eq('status', 'pending')
    await fetchRows()
    setBulkBusy(false)
    setToast(`✅ 전체 승인 완료 (${counts.pending}건)`)
  }

  const saveImageUrl = async (id: string, url: string) => {
    await supabase.from('products').update({ thumb_img: url }).eq('id', id)
    setRows(prev => prev.map(r => r.id === id ? { ...r, thumb_img: url } : r))
    if (selectedProduct?.id === id) {
      setSelectedProduct((prev: any) => prev ? { ...prev, thumb_img: url } : prev)
    }
    setToast('✅ 썸네일이 저장되었습니다')
  }

  const saveFlashSale = async (id: string, payload: { is_flash_sale: boolean; flash_sale_price: number | null; flash_sale_start: string | null; flash_sale_end: string | null }) => {
    await supabase.from('products').update(payload as any).eq('id', id)
    setRows(prev => prev.map(r => (r.id === id ? { ...r, ...payload } : r)))
    setSelectedProduct((prev: any) => (prev?.id === id ? { ...prev, ...payload } : prev))
    setToast('타임세일이 저장되었습니다')
  }

  const toggleVisibility = async (id: string, next: 'active' | 'discontinued') => {
    setToggleBusyId(id)
    await supabase.from('products').update({ status: next }).eq('id', id)
    await fetchRows()
    setToggleBusyId(null)
    setToast(next === 'active' ? '✅ 노출(ACTIVE)로 변경되었습니다' : '✅ 숨김(HIDDEN) 처리되었습니다')
  }

  const hideAllNoPrice = async () => {
    if (!window.confirm('가격이 없는(retail_price 0 또는 미설정) 모든 제품을 숨김(discontinued) 처리할까요?')) return
    setHideAllBusy(true)
    const { error } = await supabase
      .from('products')
      .update({ status: 'discontinued' })
      .or('retail_price.eq.0,retail_price.is.null')
    if (error) {
      setToast(error.message || '일괄 숨김 실패')
      setHideAllBusy(false)
      return
    }
    await fetchRows()
    setHideAllBusy(false)
    setToast('✅ 가격 없는 제품을 모두 숨김 처리했습니다')
  }

  const bulkHideSelected = async () => {
    if (selectedIds.size === 0) return
    setBulkHideBusy(true)
    const ids = Array.from(selectedIds)
    const { error } = await supabase.from('products').update({ status: 'discontinued' }).in('id', ids)
    if (error) {
      setToast(error.message || '선택 숨김 실패')
      setBulkHideBusy(false)
      return
    }
    setSelectedIds(new Set())
    await fetchRows()
    setBulkHideBusy(false)
    setToast(`✅ 선택 ${ids.length}건을 숨김 처리했습니다`)
  }

  const TABS: { key: 'pending' | 'active' | 'rejected'; label: string }[] = [
    { key: 'pending', label: 'PENDING' },
    { key: 'active', label: 'ACTIVE' },
    { key: 'rejected', label: 'HIDDEN' },
  ]

  return (
    <div style={{ padding: '24px 20px', maxWidth: 720, margin: '0 auto' }}>
      {toast ? (
        <div style={{
          position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 300,
          maxWidth: 420, width: 'calc(100% - 32px)', padding: '12px 16px', borderRadius: 12,
          background: 'rgba(26,26,26,0.96)', border: '1px solid rgba(201,168,76,0.35)', color: '#fff',
          fontSize: 13, fontWeight: 700, textAlign: 'center', boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}>
          {toast}
        </div>
      ) : null}

      {selectedProduct && (
        <ProductDetailModal
          product={selectedProduct}
          tab={tab}
          busyId={busyId}
          onClose={() => setSelectedProduct(null)}
          onApprove={approveOne}
          onReject={rejectOne}
          onSaveThumb={saveImageUrl}
          onSaveFlash={saveFlashSale}
        />
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#fff' }}>제품 관리</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>
            예외만 처리 · 썸네일·노출 토글 · 가격 없음 일괄 숨김
          </div>
        </div>
      </div>

      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16, alignItems: 'center',
        padding: 12, borderRadius: 14, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)',
      }}>
        <button
          type="button"
          onClick={hideAllNoPrice}
          disabled={hideAllBusy}
          style={{
            background: 'rgba(255,183,77,0.12)', border: '1px solid rgba(255,183,77,0.35)',
            borderRadius: 10, padding: '8px 12px', color: '#ffb74d', fontSize: 12, fontWeight: 800, cursor: 'pointer',
          }}
        >
          {hideAllBusy ? '처리 중...' : '가격 없는 제품 전체 숨김'}
        </button>
        {tab === 'pending' && counts.pending > 0 && (
          <button
            onClick={bulkApprove}
            disabled={bulkBusy}
            style={{
              background: 'var(--gold, #c9a84c)', border: 'none', borderRadius: 10,
              padding: '8px 14px', color: '#000', fontSize: 12, fontWeight: 900,
              cursor: 'pointer', opacity: bulkBusy ? 0.6 : 1,
            }}
          >
            {bulkBusy ? '처리 중...' : `전체 승인 (${counts.pending})`}
          </button>
        )}
        {selectedIds.size > 0 && (
          <button
            type="button"
            onClick={bulkHideSelected}
            disabled={bulkHideBusy}
            style={{
              background: 'rgba(229,57,53,0.15)', border: '1px solid rgba(229,57,53,0.4)',
              borderRadius: 10, padding: '8px 12px', color: '#e57373', fontSize: 12, fontWeight: 800, cursor: 'pointer',
            }}
          >
            {bulkHideBusy ? '처리 중...' : `선택 숨김 (${selectedIds.size})`}
          </button>
        )}
        <button
          type="button"
          onClick={selectAllFiltered}
          style={{
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 10, padding: '8px 12px', color: 'rgba(255,255,255,0.75)', fontSize: 12, cursor: 'pointer',
          }}
        >
          목록 전체 선택
        </button>
        {selectedIds.size > 0 && (
          <button
            type="button"
            onClick={clearSelection}
            style={{
              background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.45)', fontSize: 12, cursor: 'pointer',
            }}
          >
            선택 해제
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); clearSelection() }}
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

      <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="검색: 제품명 / 브랜드"
          style={{
            flex: 1, minWidth: 160, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
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
        <select
          value={listFilter}
          onChange={e => setListFilter(e.target.value as 'all' | 'no_price' | 'with_price')}
          style={{
            background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 10, padding: '10px 14px', color: '#fff', fontSize: 13, minWidth: 140,
          }}
        >
          <option value="all" style={{ background: '#1a1a1a' }}>가격: 전체</option>
          <option value="no_price" style={{ background: '#1a1a1a' }}>가격 없음만</option>
          <option value="with_price" style={{ background: '#1a1a1a' }}>가격 있음만</option>
        </select>
        {(q || brandQ !== 'all' || listFilter !== 'all') && (
          <button
            onClick={() => { setQ(''); setBrandQ('all'); setListFilter('all') }}
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
              selected={selectedIds.has(p.id)}
              onToggleSelect={toggleSelect}
              onApprove={approveOne}
              onReject={rejectOne}
              onClick={() => setSelectedProduct(p)}
              onToggleVisibility={toggleVisibility}
              toggleBusyId={toggleBusyId}
            />
          ))}
        </div>
      )}
    </div>
  )
}
