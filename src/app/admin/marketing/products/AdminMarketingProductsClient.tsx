'use client'

import ProductThumbnail from '@/components/ui/ProductThumbnail'
import { createClient } from '@/lib/supabase/client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import ProductDetailModal from './ProductDetailModal'

// DB status: pending | active | discontinued (UI "rejected" = discontinued)
function toDbStatus(tab: 'pending' | 'active' | 'rejected') {
  return tab === 'rejected' ? 'discontinued' : tab
}

function isMissingPrice(p: { retail_price?: number | null }) {
  const v = p.retail_price
  if (v == null) return true
  return Number(v) === 0
}

const BRAND_ORIGIN_OPTIONS = ['프랑스', '이탈리아', '독일', '스페인', '영국', '기타유럽', '한국', '일본', '기타'] as const

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
  onRestoreTrash,
  onDeleteTrash,
  onSoftDelete,
  onClick,
  onToggleVisibility,
  toggleBusyId,
}: {
  p: any
  tab: 'pending' | 'active' | 'rejected' | 'trash'
  busyId: string | null
  selected: boolean
  onToggleSelect: (id: string) => void
  onApprove: (id: string) => void
  onReject: (id: string) => void
  onRestoreTrash: (id: string) => void
  onDeleteTrash: (id: string) => void
  onSoftDelete: (id: string) => void
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
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>브랜드사: {p.brandUserEmail || '미연결'}</span>
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
        {tab === 'trash' && (
          <span style={{ fontSize: 11, color: '#ef5350', fontWeight: 800 }}>TRASH</span>
        )}

        {tab === 'pending' ? (
          <>
            <button
              onClick={onClick}
              style={{
                background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 8, padding: '5px 14px', color: '#fff',
                fontSize: 12, cursor: 'pointer',
              }}
            >
              수정
            </button>
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
            <button
              onClick={() => onSoftDelete(p.id)}
              disabled={busyId === p.id}
              style={{
                background: 'rgba(239,83,80,0.15)', border: '1px solid rgba(239,83,80,0.45)',
                borderRadius: 8, padding: '5px 14px', color: '#ef5350',
                fontSize: 12, fontWeight: 800, cursor: 'pointer', opacity: busyId === p.id ? 0.5 : 1,
              }}
            >
              삭제
            </button>
          </>
        ) : tab === 'rejected' ? (
          <>
            <button
              onClick={onClick}
              style={{
                background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 8, padding: '5px 14px', color: '#fff',
                fontSize: 12, cursor: 'pointer',
              }}
            >
              수정
            </button>
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
            <button
              onClick={() => onSoftDelete(p.id)}
              disabled={busyId === p.id}
              style={{
                background: 'rgba(239,83,80,0.15)', border: '1px solid rgba(239,83,80,0.45)',
                borderRadius: 8, padding: '5px 14px', color: '#ef5350',
                fontSize: 12, fontWeight: 800, cursor: 'pointer', opacity: busyId === p.id ? 0.5 : 1,
              }}
            >
              삭제
            </button>
          </>
        ) : tab === 'trash' ? (
          <>
            <button
              onClick={() => onRestoreTrash(p.id)}
              disabled={busyId === p.id}
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 8,
                padding: '5px 14px',
                color: 'var(--gold, #c9a84c)',
                fontSize: 12,
                cursor: 'pointer',
                opacity: busyId === p.id ? 0.5 : 1,
                marginRight: 6,
              }}
            >
              복구
            </button>
            <button
              onClick={() => onDeleteTrash(p.id)}
              disabled={busyId === p.id}
              style={{
                background: 'rgba(229,57,53,0.15)',
                border: '1px solid rgba(229,57,53,0.4)',
                borderRadius: 8,
                padding: '5px 14px',
                color: '#e57373',
                fontSize: 12,
                cursor: 'pointer',
                opacity: busyId === p.id ? 0.5 : 1,
              }}
            >
              영구삭제
            </button>
          </>
        ) : (
          <>
            <button
              onClick={onClick}
              style={{
                background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 8, padding: '5px 14px', color: '#fff',
                fontSize: 12, cursor: 'pointer',
              }}
            >
              수정
            </button>
            <button
              onClick={() => onSoftDelete(p.id)}
              disabled={busyId === p.id}
              style={{
                background: 'rgba(239,83,80,0.15)', border: '1px solid rgba(239,83,80,0.45)',
                borderRadius: 8, padding: '5px 14px', color: '#ef5350',
                fontSize: 12, fontWeight: 800, cursor: 'pointer', opacity: busyId === p.id ? 0.5 : 1,
              }}
            >
              삭제
            </button>
            <button
              onClick={() => onToggleVisibility(p.id, 'discontinued')}
              disabled={busyId === p.id || p.status !== 'active'}
              style={{
                background: 'rgba(229,57,53,0.15)', border: '1px solid rgba(229,57,53,0.4)',
                borderRadius: 8, padding: '5px 14px', color: '#e57373',
                fontSize: 12, cursor: 'pointer', opacity: busyId === p.id || p.status !== 'active' ? 0.5 : 1,
              }}
            >
              숨김
            </button>
          </>
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
  const [tab, setTab] = useState<'pending' | 'active' | 'rejected' | 'trash'>('pending')
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<any[]>([])
  const [counts, setCounts] = useState({ pending: 0, active: 0, rejected: 0, trash: 0 })
  const [busyId, setBusyId] = useState<string | null>(null)
  const [toggleBusyId, setToggleBusyId] = useState<string | null>(null)
  const [bulkBusy, setBulkBusy] = useState(false)
  const [bulkHideBusy, setBulkHideBusy] = useState(false)
  const [bulkTrashBusy, setBulkTrashBusy] = useState(false)
  const [trashEmptyBusy, setTrashEmptyBusy] = useState(false)
  const [q, setQ] = useState('')
  const [brandQ, setBrandQ] = useState('all')
  const [appliedQ, setAppliedQ] = useState('')
  const [appliedBrandQ, setAppliedBrandQ] = useState('all')
  const [listFilter, setListFilter] = useState<'all' | 'no_price' | 'with_price'>('all')
  const [onlyMissingUnitPrice, setOnlyMissingUnitPrice] = useState(false)
  const [brandOptionsFromDb, setBrandOptionsFromDb] = useState<string[] | null>(null)
  const [brandsWithId, setBrandsWithId] = useState<{ id: string; name: string; origin_country?: string | null }[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [toast, setToast] = useState('')
  const [brandUsers, setBrandUsers] = useState<{ id: string; email: string }[]>([])
  const [brandAssignOpen, setBrandAssignOpen] = useState(false)
  const [brandAssignUserId, setBrandAssignUserId] = useState('')
  const [brandAssignBusy, setBrandAssignBusy] = useState(false)

  const [selectedProduct, setSelectedProduct] = useState<any | null>(null)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 3200)
    return () => clearTimeout(t)
  }, [toast])

  const fetchRows = useCallback(async () => {
    setLoading(true)
    try {
      if (tab === 'trash') {
        const { data, error } = await supabase
          .from('products')
          .select('*, brands(id, name)')
          .not('deleted_at', 'is', null)
          .order('created_at', { ascending: false })
          .limit(10000)

        if (error) {
          console.error('[admin products trash]', error)
          setRows([])
        } else {
          setRows(data || [])
        }

        const [p, a, r, t] = await Promise.all([
          supabase.from('products').select('id', { count: 'exact', head: true }).eq('status', 'pending').is('deleted_at', null),
          supabase.from('products').select('id', { count: 'exact', head: true }).eq('status', 'active').is('deleted_at', null),
          supabase.from('products')
            .select('id', { count: 'exact', head: true })
            .or('status.eq.discontinued,status.eq.hidden')
            .is('deleted_at', null),
          supabase.from('products').select('id', { count: 'exact', head: true }).not('deleted_at', 'is', null),
        ])
        setCounts({ pending: p.count || 0, active: a.count || 0, rejected: r.count || 0, trash: t.count || 0 })
        setLoading(false)
        return
      }

      const statusDb = toDbStatus(tab)
      const { data, error } = await supabase
        .from('products')
        .select('*, brands(id, name)')
        .is('deleted_at', null)
        .in('status', ['active', 'pending', 'discontinued', 'hidden'])
        .order('created_at', { ascending: false })
        .limit(10000)

      console.log('products:', data?.length, 'error:', error, 'tab:', tab, 'filter:', statusDb)

      if (error) {
        console.error('[admin products]', error)
        setRows([])
      } else {
        const list = data || []
        const filtered = list.filter((p: { status?: string }) => {
          if (statusDb === 'discontinued') {
            return p.status === 'discontinued' || p.status === 'hidden'
          }
          return p.status === statusDb
        })
        setRows(filtered)
      }

      const [p, a, r, t] = await Promise.all([
        supabase.from('products').select('id', { count: 'exact', head: true }).eq('status', 'pending').is('deleted_at', null),
        supabase.from('products').select('id', { count: 'exact', head: true }).eq('status', 'active').is('deleted_at', null),
        supabase.from('products')
          .select('id', { count: 'exact', head: true })
          .or('status.eq.discontinued,status.eq.hidden')
          .is('deleted_at', null),
        supabase.from('products').select('id', { count: 'exact', head: true }).not('deleted_at', 'is', null),
      ])
      setCounts({ pending: p.count || 0, active: a.count || 0, rejected: r.count || 0, trash: t.count || 0 })
      setLoading(false)
    } catch (e) {
      console.error('[admin products fetchRows]', e)
      setRows([])
      setLoading(false)
    }
  }, [supabase, tab])

  useEffect(() => { fetchRows() }, [fetchRows])

  useEffect(() => {
    supabase
      .from('brands')
      .select('id,name,origin_country')
      .order('name')
      .then(({ data }) => {
        const rows = (data || []) as { id: string; name: string; origin_country?: string | null }[]
        setBrandsWithId(rows)
        const names = rows.map(b => b.name).filter(Boolean)
        setBrandOptionsFromDb(names.length ? names : null)
      })
  }, [supabase])

  useEffect(() => {
    supabase
      .from('users')
      .select('auth_id,email,role')
      .eq('role', 'brand')
      .order('email')
      .then(({ data }) => {
        const list = (data || [])
          .map((r: any) => ({ id: String(r.auth_id || ''), email: String(r.email || '') }))
          .filter((r: { id: string; email: string }) => !!r.id)
        setBrandUsers(list)
      })
  }, [supabase])

  const mappedRows = useMemo(() =>
    rows.map(r => ({
      ...r,
      brandName: r.brands?.name || '-',
      price: Number(r.retail_price || 0),
      brandUserEmail:
        r.brand_user_id == null || String(r.brand_user_id || '') === ''
          ? '미연결'
          : (brandUsers.find(u => u.id === String(r.brand_user_id || ''))?.email || '미연결'),
    })),
    [rows, brandUsers]
  )

  const brandOptions = useMemo(() => {
    if (brandOptionsFromDb?.length) return ['all', ...brandOptionsFromDb]
    const set = new Set(mappedRows.map(r => r.brandName))
    return ['all', ...Array.from(set)]
  }, [brandOptionsFromDb, mappedRows])

  const filteredRows = useMemo(() =>
    mappedRows.filter(r => {
      const matchQ = !appliedQ || r.name?.toLowerCase().includes(appliedQ.toLowerCase()) || r.brandName?.toLowerCase().includes(appliedQ.toLowerCase())
      const matchB = appliedBrandQ === 'all' || r.brandName === appliedBrandQ
      const matchP = listFilter === 'all'
        ? true
        : listFilter === 'no_price'
          ? isMissingPrice(r)
          : !isMissingPrice(r)
      const missUnit =
        r.unit_type == null ||
        String(r.unit_type).trim() === '' ||
        r.unit_price == null ||
        !Number.isFinite(Number(r.unit_price)) ||
        Number(r.unit_price) <= 0
      const matchU = !onlyMissingUnitPrice || missUnit
      return matchQ && matchB && matchP && matchU
    }),
    [appliedBrandQ, appliedQ, listFilter, mappedRows, onlyMissingUnitPrice]
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
    const { error } = await supabase.from('products').update({ status: 'active' }).eq('id', id)
    setBusyId(null)
    if (error) {
      setToast('저장 실패: ' + error.message)
      return
    }
    setToast('✅ 승인되었습니다')
    setRows(prev => prev.map(r => (r.id === id ? { ...r, status: 'active' } : r)))
    setSelectedProduct((prev: any) => (prev?.id === id ? null : prev))
    await fetchRows()
  }

  const rejectOne = async (id: string) => {
    setBusyId(id)
    const { error } = await supabase.from('products').update({ status: 'discontinued' }).eq('id', id)
    setBusyId(null)
    if (error) {
      setToast('저장 실패: ' + error.message)
      return
    }
    setToast('숨김(거절) 처리되었습니다')
    setRows(prev => prev.filter(r => r.id !== id))
    setSelectedProduct((prev: any) => (prev?.id === id ? null : prev))
    await fetchRows()
  }

  const bulkApprove = async () => {
    if (!window.confirm('PENDING 제품 전체를 승인할까요?')) return
    setBulkBusy(true)
    const { error } = await supabase
      .from('products')
      .update({ status: 'active' })
      .eq('status', 'pending')
      .is('deleted_at', null)
    setBulkBusy(false)
    if (error) {
      setToast('저장 실패: ' + error.message)
      return
    }
    setToast(`✅ 전체 승인 완료 (${counts.pending}건)`)
    await fetchRows()
  }

  const saveFlashSale = async (id: string, payload: { is_flash_sale: boolean; flash_sale_price: number | null; flash_sale_start: string | null; flash_sale_end: string | null }) => {
    const { error } = await supabase.from('products').update(payload as any).eq('id', id)
    if (error) {
      setToast('저장 실패: ' + error.message)
      return
    }
    setRows(prev => prev.map(r => (r.id === id ? { ...r, ...payload } : r)))
    setSelectedProduct((prev: any) => (prev?.id === id ? { ...prev, ...payload } : prev))
    setToast('타임세일이 저장되었습니다')
  }

  const handleProductUpdated = (p: any) => {
    const brandName =
      p.brands?.name ?? brandsWithId.find(b => b.id === p.brand_id)?.name ?? p.brandName
    const merged = { ...p, brandName: brandName || p.brandName }
    setSelectedProduct(merged)
    setRows(prev => prev.map(r => (r.id === merged.id ? { ...r, ...merged } : r)))
  }

  const toggleVisibility = async (id: string, next: 'active' | 'discontinued') => {
    setToggleBusyId(id)
    await supabase.from('products').update({ status: next }).eq('id', id)
    await fetchRows()
    setToggleBusyId(null)
    setToast(next === 'active' ? '✅ 노출(ACTIVE)로 변경되었습니다' : '✅ 숨김(HIDDEN) 처리되었습니다')
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

  const moveSelectedToTrash = async () => {
    if (selectedIds.size === 0) return
    const ids = Array.from(selectedIds)
    const msg = `선택한 ${ids.length}개 제품을 삭제할까요?`
    if (!window.confirm(msg)) return
    setBulkTrashBusy(true)
    const nowIso = new Date().toISOString()
    const { error } = await supabase
      .from('products')
      .update({ status: 'deleted', deleted_at: nowIso })
      .in('id', ids)
    if (error) {
      setToast(error.message || '휴지통 이동 실패')
      setBulkTrashBusy(false)
      return
    }
    setSelectedIds(new Set())
    await fetchRows()
    setBulkTrashBusy(false)
    setToast(`✅ 선택 ${ids.length}건을 휴지통으로 이동했습니다`)
  }

  const deleteOneSoft = async (id: string) => {
    const ok = window.confirm('선택한 1개 제품을 삭제할까요?')
    if (!ok) return
    setBusyId(id)
    const nowIso = new Date().toISOString()
    const { error } = await supabase.from('products').update({ status: 'deleted', deleted_at: nowIso }).eq('id', id)
    setBusyId(null)
    if (error) {
      setToast('삭제 실패: ' + error.message)
      return
    }
    await fetchRows()
    setToast('✅ 삭제되었습니다')
  }

  const deleteAllPending = async () => {
    if (!window.confirm(`선택한 ${counts.pending}개 제품을 삭제할까요?`)) return
    setBulkTrashBusy(true)
    const nowIso = new Date().toISOString()
    const { error } = await supabase
      .from('products')
      .update({ status: 'deleted', deleted_at: nowIso })
      .eq('status', 'pending')
      .is('deleted_at', null)
    setBulkTrashBusy(false)
    if (error) {
      setToast('삭제 실패: ' + error.message)
      return
    }
    await fetchRows()
    setToast(`✅ PENDING ${counts.pending}건 삭제 완료`)
  }

  const restoreOneFromTrash = async (id: string) => {
    setBusyId(id)
    const { error } = await supabase.from('products').update({ status: 'active', deleted_at: null }).eq('id', id)
    setBusyId(null)
    if (error) {
      setToast('복구 실패: ' + error.message)
      return
    }
    setToast('✅ 복구되었습니다')
    setSelectedIds(new Set())
    await fetchRows()
  }

  const deleteOneFromTrash = async (id: string) => {
    const ok = window.confirm('이 작업은 되돌릴 수 없습니다. 영구삭제할까요?')
    if (!ok) return
    setBusyId(id)
    const { error } = await supabase.from('products').delete().eq('id', id)
    setBusyId(null)
    if (error) {
      setToast('영구삭제 실패: ' + error.message)
      return
    }
    setToast('✅ 영구삭제되었습니다')
    setSelectedIds(new Set())
    await fetchRows()
  }

  const emptyTrash = async () => {
    const ok = window.confirm('휴지통의 모든 제품을 영구삭제합니다.\n이 작업은 되돌릴 수 없습니다.')
    if (!ok) return
    setTrashEmptyBusy(true)
    const { data } = await supabase.from('products').select('id').not('deleted_at', 'is', null)
    const ids = (data || []).map((d: any) => d.id).filter(Boolean)
    if (ids.length === 0) {
      setTrashEmptyBusy(false)
      setToast('휴지통이 비어있습니다')
      return
    }
    const { error } = await supabase.from('products').delete().in('id', ids)
    setTrashEmptyBusy(false)
    if (error) {
      setToast('영구삭제 실패: ' + error.message)
      return
    }
    setToast('✅ 휴지통 비우기 완료')
    setSelectedIds(new Set())
    await fetchRows()
  }

  const visibleSelectedCount = useMemo(() => filteredRows.filter(r => selectedIds.has(r.id)).length, [filteredRows, selectedIds])
  const allSelected = filteredRows.length > 0 && visibleSelectedCount === filteredRows.length

  const TABS: { key: 'pending' | 'active' | 'rejected' | 'trash'; label: string }[] = [
    { key: 'pending', label: 'PENDING' },
    { key: 'active', label: 'ACTIVE' },
    { key: 'rejected', label: 'HIDDEN' },
    { key: 'trash', label: '🗑️ 휴지통' },
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

      {selectedProduct && tab !== 'trash' && (
        <ProductDetailModal
          product={selectedProduct}
          tab={tab}
          busyId={busyId}
          brands={brandsWithId}
          onClose={() => setSelectedProduct(null)}
          onApprove={approveOne}
          onReject={rejectOne}
          onToast={setToast}
          onProductUpdated={handleProductUpdated}
          onSaveFlash={saveFlashSale}
        />
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#fff' }}>제품 관리</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>
            예외만 처리 · 썸네일·노출 토글
          </div>
        </div>
        {tab === 'pending' && counts.pending > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => void bulkApprove()}
            disabled={bulkBusy}
            style={{
              background: 'linear-gradient(135deg, #c9a84c 0%, #a8863a 100%)',
              border: 'none',
              borderRadius: 12,
              padding: '12px 18px',
              color: '#000',
              fontSize: 13,
              fontWeight: 900,
              cursor: 'pointer',
              boxShadow: '0 4px 20px rgba(201,168,76,0.35)',
              opacity: bulkBusy ? 0.65 : 1,
            }}
          >
            {bulkBusy ? '처리 중...' : `⚡ PENDING 전체 승인 (${counts.pending})`}
          </button>
          <button
            type="button"
            onClick={() => void deleteAllPending()}
            disabled={bulkTrashBusy}
            style={{
              background: 'rgba(239,83,80,0.15)',
              border: '1px solid rgba(239,83,80,0.45)',
              borderRadius: 12,
              padding: '12px 18px',
              color: '#ef5350',
              fontSize: 13,
              fontWeight: 900,
              cursor: 'pointer',
              opacity: bulkTrashBusy ? 0.65 : 1,
            }}
          >
            {bulkTrashBusy ? '처리 중...' : `⚠️ PENDING 전체 삭제 (${counts.pending}개)`}
          </button>
          </div>
        )}
      </div>

      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16, alignItems: 'center',
        padding: 12, borderRadius: 14, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)',
      }}>
        <button
          type="button"
          onClick={() => {
            if (allSelected) clearSelection()
            else selectAllFiltered()
          }}
          style={{
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 10, padding: '8px 12px', color: 'rgba(255,255,255,0.75)', fontSize: 12, cursor: 'pointer',
          }}
        >
          [전체선택]
        </button>
        {visibleSelectedCount > 0 && (
          <>
            <button
              type="button"
              onClick={() => {
                setBrandAssignOpen(true)
                setBrandAssignUserId(brandUsers[0]?.id || '')
              }}
              style={{
                background: 'rgba(123,94,167,0.2)', border: '1px solid rgba(123,94,167,0.5)',
                borderRadius: 10, padding: '8px 12px', color: '#d9c9f2', fontSize: 12, cursor: 'pointer',
              }}
            >
              브랜드사 연결
            </button>
            <button
              type="button"
              onClick={bulkHideSelected}
              disabled={bulkHideBusy}
              style={{
                background: 'rgba(229,57,53,0.15)', border: '1px solid rgba(229,57,53,0.4)',
                borderRadius: 10, padding: '8px 12px', color: '#e57373', fontSize: 12, fontWeight: 800, cursor: 'pointer',
              }}
            >
              {bulkHideBusy ? '처리 중...' : '숨김처리'}
            </button>
            <button
              type="button"
              onClick={moveSelectedToTrash}
              disabled={bulkTrashBusy}
              style={{
                background: 'rgba(239,83,80,0.15)', border: '1px solid rgba(239,83,80,0.45)',
                borderRadius: 10, padding: '8px 12px', color: '#ef5350', fontSize: 12, fontWeight: 900, cursor: 'pointer',
              }}
            >
              {bulkTrashBusy ? '처리 중...' : '🗑 선택 삭제'}
            </button>
          </>
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

      <div
        style={{
          marginBottom: 16,
          padding: 14,
          borderRadius: 14,
          border: '1px solid rgba(255,255,255,0.1)',
          background: 'rgba(255,255,255,0.03)',
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 900, color: '#fff', marginBottom: 10 }}>브랜드 원산지 (등록·수정)</div>
        <div style={{ maxHeight: 220, overflowY: 'auto', display: 'grid', gap: 8 }}>
          {brandsWithId.map(b => (
            <div
              key={b.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr minmax(140px,auto)',
                gap: 10,
                alignItems: 'center',
              }}
            >
              <span
                style={{
                  fontSize: 12,
                  color: 'rgba(255,255,255,0.85)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {b.name}
              </span>
              <select
                value={b.origin_country || ''}
                onChange={async e => {
                  const v = e.target.value
                  const { error } = await supabase
                    .from('brands')
                    .update({ origin_country: v || null } as any)
                    .eq('id', b.id)
                  if (error) {
                    setToast(error.message)
                    return
                  }
                  setBrandsWithId(prev => prev.map(x => (x.id === b.id ? { ...x, origin_country: v || null } : x)))
                  setToast('브랜드 원산지 저장됨')
                }}
                style={{
                  background: '#121212',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 10,
                  padding: '8px 10px',
                  color: '#fff',
                  fontSize: 12,
                }}
              >
                <option value="" style={{ background: '#1a1a1a' }}>
                  — 미지정 —
                </option>
                {BRAND_ORIGIN_OPTIONS.map(o => (
                  <option key={o} value={o} style={{ background: '#1a1a1a' }}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>

      {tab === 'trash' ? (
        <div style={{ marginBottom: 12 }}>
          <button
            type="button"
            onClick={emptyTrash}
            disabled={trashEmptyBusy}
            style={{
              background: 'rgba(239,83,80,0.12)',
              border: '1px solid rgba(239,83,80,0.35)',
              borderRadius: 10,
              padding: '8px 12px',
              color: '#ffb74d',
              fontSize: 12,
              fontWeight: 900,
              cursor: 'pointer',
            }}
          >
            {trashEmptyBusy ? '처리 중...' : '휴지통 비우기'}
          </button>
        </div>
      ) : null}

      <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              setAppliedQ(q)
              setAppliedBrandQ(brandQ)
            }
          }}
          placeholder="검색: 제품명 / 브랜드"
          style={{
            flex: 1, minWidth: 160, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 10, padding: '10px 14px', color: '#fff', fontSize: 13,
          }}
        />
        <select
          value={brandQ}
          onChange={e => setBrandQ(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              setAppliedQ(q)
              setAppliedBrandQ(brandQ)
            }
          }}
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
        <button
          type="button"
          onClick={() => { setAppliedQ(q); setAppliedBrandQ(brandQ) }}
          style={{
            background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 10, padding: '10px 14px', color: '#fff', fontSize: 12, cursor: 'pointer',
          }}
        >
          🔍 검색
        </button>
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
        <label
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 12,
            color: 'rgba(255,255,255,0.75)',
            cursor: 'pointer',
            userSelect: 'none',
            padding: '8px 10px',
            borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.12)',
            background: onlyMissingUnitPrice ? 'rgba(201,168,76,0.12)' : 'rgba(255,255,255,0.05)',
          }}
        >
          <input
            type="checkbox"
            checked={onlyMissingUnitPrice}
            onChange={e => setOnlyMissingUnitPrice(e.target.checked)}
          />
          단위가격 미입력만
        </label>
        {(q || brandQ !== 'all' || appliedQ || appliedBrandQ !== 'all' || listFilter !== 'all' || onlyMissingUnitPrice) && (
          <button
            onClick={() => { setQ(''); setBrandQ('all'); setAppliedQ(''); setAppliedBrandQ('all'); setListFilter('all'); setOnlyMissingUnitPrice(false) }}
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
              onRestoreTrash={restoreOneFromTrash}
              onDeleteTrash={deleteOneFromTrash}
              onSoftDelete={deleteOneSoft}
              onClick={() => setSelectedProduct(p)}
              onToggleVisibility={toggleVisibility}
              toggleBusyId={toggleBusyId}
            />
          ))}
        </div>
      )}
      {brandAssignOpen ? (
        <div
          onClick={() => !brandAssignBusy && setBrandAssignOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 350, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 420, background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: 14 }}
          >
            <div style={{ fontSize: 14, color: '#fff', marginBottom: 10 }}>브랜드사 연결</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 10 }}>
              선택 제품 {visibleSelectedCount}건
            </div>
            <select
              value={brandAssignUserId}
              onChange={e => setBrandAssignUserId(e.target.value)}
              style={{ width: '100%', background: '#121212', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '10px 12px', color: '#fff', fontSize: 12 }}
            >
              {brandUsers.map(u => (
                <option key={u.id} value={u.id} style={{ background: '#1a1a1a' }}>{u.email}</option>
              ))}
            </select>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button
                type="button"
                disabled={brandAssignBusy}
                onClick={() => setBrandAssignOpen(false)}
                style={{ flex: 1, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: 'rgba(255,255,255,0.75)', borderRadius: 8, padding: '9px 10px', fontSize: 12, cursor: 'pointer' }}
              >
                취소
              </button>
              <button
                type="button"
                disabled={brandAssignBusy || !brandAssignUserId || visibleSelectedCount === 0}
                onClick={async () => {
                  const ids = filteredRows.filter(r => selectedIds.has(r.id)).map(r => r.id)
                  if (ids.length === 0) return
                  setBrandAssignBusy(true)
                  const { error } = await supabase.from('products').update({ brand_user_id: brandAssignUserId } as any).in('id', ids)
                  setBrandAssignBusy(false)
                  if (error) {
                    setToast('브랜드사 연결 실패: ' + error.message)
                    return
                  }
                  setToast(`브랜드사 연결 완료 (${ids.length}건)`)
                  setBrandAssignOpen(false)
                  await fetchRows()
                }}
                style={{ flex: 1, border: '1px solid rgba(123,94,167,0.6)', background: 'rgba(123,94,167,0.3)', color: '#e7ddf7', borderRadius: 8, padding: '9px 10px', fontSize: 12, cursor: 'pointer' }}
              >
                {brandAssignBusy ? '적용 중...' : '적용'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
