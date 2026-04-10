'use client'

import ProductThumbnail from '@/components/ui/ProductThumbnail'
import { createClient } from '@/lib/supabase/client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import ProductDetailModal from './ProductDetailModal'

// DB status: pending | active | discontinued (UI "rejected" = discontinued)
function toDbStatus(tab: 'pending' | 'active' | 'rejected') {
  return tab === 'rejected' ? 'discontinued' : tab
}

function productNeedsTagMapping(p: {
  status?: string
  concern_tags?: unknown
  skin_tags?: unknown
  skin_concerns?: unknown
  skin_types?: unknown
}) {
  if (p.status !== 'active' && p.status !== 'pending') return false
  const concern =
    Array.isArray(p.concern_tags) && p.concern_tags.length > 0
      ? p.concern_tags
      : Array.isArray(p.skin_concerns) && p.skin_concerns.length > 0
        ? p.skin_concerns
        : null
  const skin =
    Array.isArray(p.skin_tags) && p.skin_tags.length > 0
      ? p.skin_tags
      : Array.isArray(p.skin_types) && p.skin_types.length > 0
        ? p.skin_types
        : null
  const miss = (v: unknown) => v == null || (Array.isArray(v) && v.length === 0)
  return miss(concern) || miss(skin)
}

function isMissingPrice(p: { retail_price?: number | null }) {
  const v = p.retail_price
  if (v == null) return true
  return Number(v) === 0
}

const BRAND_ORIGIN_OPTIONS = ['프랑스', '이탈리아', '독일', '스페인', '영국', '스위스', '이스라엘', '기타유럽', '한국', '일본', '기타'] as const

const BRAND_DEFAULTS_ACC = '#7b5ea7'

type BrandRowAdmin = {
  id: string
  name: string
  origin_country?: string | null
  default_earn_points?: number | null
  default_earn_points_type?: string | null
  default_share_points?: number | null
  default_share_points_type?: string | null
  default_review_text?: number | null
  default_review_text_type?: string | null
  default_review_photo?: number | null
  default_review_photo_type?: string | null
  default_review_video?: number | null
  default_review_video_type?: string | null
  default_partner_commission?: number | null
  default_partner_commission_type?: string | null
  default_owner_commission?: number | null
  default_owner_commission_type?: string | null
}

type DefaultsFormState = {
  origin_country: string
  default_earn_points: string
  default_earn_points_type: 'percent' | 'toast'
  default_share_points: string
  default_share_points_type: 'percent' | 'toast'
  default_review_text: string
  default_review_text_type: 'percent' | 'toast'
  default_review_photo: string
  default_review_photo_type: 'percent' | 'toast'
  default_review_video: string
  default_review_video_type: 'percent' | 'toast'
  default_partner_commission: string
  default_partner_commission_type: 'percent' | 'won'
  default_owner_commission: string
  default_owner_commission_type: 'percent' | 'won'
}

function brandToDefaultsForm(b: BrandRowAdmin): DefaultsFormState {
  return {
    origin_country: b.origin_country || '',
    default_earn_points: b.default_earn_points != null ? String(b.default_earn_points) : '',
    default_earn_points_type: b.default_earn_points_type === 'toast' ? 'toast' : 'percent',
    default_share_points: b.default_share_points != null ? String(b.default_share_points) : '',
    default_share_points_type: b.default_share_points_type === 'toast' ? 'toast' : 'percent',
    default_review_text: b.default_review_text != null ? String(b.default_review_text) : '100',
    default_review_text_type: b.default_review_text_type === 'toast' ? 'toast' : 'percent',
    default_review_photo: b.default_review_photo != null ? String(b.default_review_photo) : '300',
    default_review_photo_type: b.default_review_photo_type === 'toast' ? 'toast' : 'percent',
    default_review_video: b.default_review_video != null ? String(b.default_review_video) : '500',
    default_review_video_type: b.default_review_video_type === 'toast' ? 'toast' : 'percent',
    default_partner_commission: b.default_partner_commission != null ? String(b.default_partner_commission) : '',
    default_partner_commission_type: b.default_partner_commission_type === 'won' ? 'won' : 'percent',
    default_owner_commission: b.default_owner_commission != null ? String(b.default_owner_commission) : '',
    default_owner_commission_type: b.default_owner_commission_type === 'won' ? 'won' : 'percent',
  }
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
  onRestoreTrash,
  onDeleteTrash,
  onSoftDelete,
  onClick,
  onToggleVisibility,
  toggleBusyId,
  brandScope,
  onBrandCardAssign,
}: {
  p: any
  tab: 'pending' | 'active' | 'rejected' | 'trash' | 'unmapped'
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
  brandScope?: boolean
  onBrandCardAssign?: () => void
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
      {!brandScope ? (
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
      ) : null}

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
        {(tab === 'active' || tab === 'unmapped') && (
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
            {!brandScope ? (
              <button
                onClick={() => onBrandCardAssign?.()}
                type="button"
                style={{
                  background: 'rgba(123,94,167,0.2)', border: '1px solid rgba(123,94,167,0.5)',
                  borderRadius: 8, padding: '5px 14px', color: '#d9c9f2',
                  fontSize: 12, cursor: 'pointer',
                }}
              >
                브랜드사 연결
              </button>
            ) : null}
            {!brandScope ? (
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
            ) : null}
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
            {!brandScope ? (
              <button
                onClick={() => onBrandCardAssign?.()}
                type="button"
                style={{
                  background: 'rgba(123,94,167,0.2)', border: '1px solid rgba(123,94,167,0.5)',
                  borderRadius: 8, padding: '5px 14px', color: '#d9c9f2',
                  fontSize: 12, cursor: 'pointer',
                }}
              >
                브랜드사 연결
              </button>
            ) : null}
            {!brandScope ? (
              <>
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
            ) : null}
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
            {!brandScope ? (
              <button
                onClick={() => onBrandCardAssign?.()}
                type="button"
                style={{
                  background: 'rgba(123,94,167,0.2)', border: '1px solid rgba(123,94,167,0.5)',
                  borderRadius: 8, padding: '5px 14px', color: '#d9c9f2',
                  fontSize: 12, cursor: 'pointer',
                }}
              >
                브랜드사 연결
              </button>
            ) : null}
            {!brandScope ? (
              <>
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
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}

// ───────────────────────────────────────────────
// 메인
// ───────────────────────────────────────────────
export default function AdminMarketingProductsClient(p?: { brandOwnerAuthId?: string | null; brandOwnerEmail?: string | null }) {
  const brandOwnerAuthId = p?.brandOwnerAuthId ?? null
  const brandOwnerEmail = p?.brandOwnerEmail ?? null
  const brandScope = !!brandOwnerAuthId
  const supabase = createClient()
  const [tab, setTab] = useState<'pending' | 'active' | 'rejected' | 'trash' | 'unmapped'>(() => 'active')
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<any[]>([])
  const [counts, setCounts] = useState({ pending: 0, active: 0, rejected: 0, trash: 0, total: 0, unmapped: 0, noBrand: 0 })
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
  const [brandsWithId, setBrandsWithId] = useState<BrandRowAdmin[]>([])
  const [defaultsSelectId, setDefaultsSelectId] = useState('')
  const [defForm, setDefForm] = useState<DefaultsFormState | null>(null)
  const [brandDefaultsSaveBusy, setBrandDefaultsSaveBusy] = useState(false)
  const [brandDefaultsApplyBusy, setBrandDefaultsApplyBusy] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [toast, setToast] = useState('')
  const [brandUsers, setBrandUsers] = useState<{ id: string; email: string }[]>([])
  const [brandAssignOpen, setBrandAssignOpen] = useState(false)
  const [brandAssignUserId, setBrandAssignUserId] = useState('')
  const [brandAssignBusy, setBrandAssignBusy] = useState(false)
  const [brandCardAssignRow, setBrandCardAssignRow] = useState<any | null>(null)
  const [brandCardAssignUserId, setBrandCardAssignUserId] = useState('')
  const [brandCardAssignBusy, setBrandCardAssignBusy] = useState(false)
  const [defaultsAccordionOpen, setDefaultsAccordionOpen] = useState(false)
  const [filterNoBrandOnly, setFilterNoBrandOnly] = useState(false)
  const [aiBulkBusy, setAiBulkBusy] = useState(false)
  const [aiBulkProgress, setAiBulkProgress] = useState<{ cur: number; total: number } | null>(null)

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
        let trashQ = supabase
          .from('products')
          .select('*, brands(id, name)')
          .not('deleted_at', 'is', null)
        if (brandOwnerAuthId) trashQ = trashQ.eq('brand_user_id', brandOwnerAuthId)
        const { data, error } = await trashQ
          .order('created_at', { ascending: false })
          .limit(10000)

        if (error) {
          console.error('[admin products trash]', error)
          setRows([])
        } else {
          setRows(data || [])
        }

        let cp = supabase.from('products').select('id', { count: 'exact', head: true }).eq('status', 'pending').is('deleted_at', null)
        let ca = supabase.from('products').select('id', { count: 'exact', head: true }).eq('status', 'active').is('deleted_at', null)
        let cr = supabase.from('products')
          .select('id', { count: 'exact', head: true })
          .or('status.eq.discontinued,status.eq.hidden')
          .is('deleted_at', null)
        let ct = supabase.from('products').select('id', { count: 'exact', head: true }).not('deleted_at', 'is', null)
        if (brandOwnerAuthId) {
          cp = cp.eq('brand_user_id', brandOwnerAuthId)
          ca = ca.eq('brand_user_id', brandOwnerAuthId)
          cr = cr.eq('brand_user_id', brandOwnerAuthId)
          ct = ct.eq('brand_user_id', brandOwnerAuthId)
        }
        let statQ = supabase
          .from('products')
          .select('skin_concerns, skin_types, concern_tags, skin_tags, status, brand_id')
          .is('deleted_at', null)
          .limit(10000)
        if (brandOwnerAuthId) statQ = statQ.eq('brand_user_id', brandOwnerAuthId)
        const { data: statList } = await statQ
        const sl = statList || []
        const total = sl.length
        const noBrand = sl.filter((p: { brand_id?: unknown }) => p.brand_id == null || String(p.brand_id).trim() === '').length
        const unmapped = sl.filter((p: { status?: string; concern_tags?: unknown; skin_tags?: unknown; skin_concerns?: unknown; skin_types?: unknown }) =>
          productNeedsTagMapping(p)
        ).length
        const [p, a, r, t] = await Promise.all([cp, ca, cr, ct])
        setCounts({ pending: p.count || 0, active: a.count || 0, rejected: r.count || 0, trash: t.count || 0, total, unmapped, noBrand })
        setLoading(false)
        return
      }

      const statusDb = tab === 'unmapped' ? null : toDbStatus(tab)
      let listQ = supabase
        .from('products')
        .select('*, brands(id, name)')
        .is('deleted_at', null)
        .in('status', ['active', 'pending', 'discontinued', 'hidden'])
      if (brandOwnerAuthId) listQ = listQ.eq('brand_user_id', brandOwnerAuthId)
      const { data, error } = await listQ
        .order('created_at', { ascending: false })
        .limit(10000)

      console.log('products:', data?.length, 'error:', error, 'tab:', tab, 'filter:', statusDb)

      if (error) {
        console.error('[admin products]', error)
        setRows([])
      } else {
        const list = data || []
        let filtered: typeof list
        if (tab === 'unmapped') {
          filtered = list.filter((p: { status?: string; concern_tags?: unknown; skin_tags?: unknown; skin_concerns?: unknown; skin_types?: unknown }) =>
            productNeedsTagMapping(p)
          )
        } else {
          filtered = list.filter((p: { status?: string }) => {
            if (statusDb === 'discontinued') {
              return p.status === 'discontinued' || p.status === 'hidden'
            }
            return p.status === statusDb
          })
        }
        setRows(filtered)
      }

      let cp = supabase.from('products').select('id', { count: 'exact', head: true }).eq('status', 'pending').is('deleted_at', null)
      let ca = supabase.from('products').select('id', { count: 'exact', head: true }).eq('status', 'active').is('deleted_at', null)
      let cr = supabase.from('products')
        .select('id', { count: 'exact', head: true })
        .or('status.eq.discontinued,status.eq.hidden')
        .is('deleted_at', null)
      let ct = supabase.from('products').select('id', { count: 'exact', head: true }).not('deleted_at', 'is', null)
      if (brandOwnerAuthId) {
        cp = cp.eq('brand_user_id', brandOwnerAuthId)
        ca = ca.eq('brand_user_id', brandOwnerAuthId)
        cr = cr.eq('brand_user_id', brandOwnerAuthId)
        ct = ct.eq('brand_user_id', brandOwnerAuthId)
      }
      const [p, a, r, t] = await Promise.all([cp, ca, cr, ct])
      const list = data || []
      const total = list.length
      const noBrand = list.filter((p: { brand_id?: unknown }) => p.brand_id == null || String(p.brand_id).trim() === '').length
      const unmapped = list.filter((p: { status?: string; concern_tags?: unknown; skin_tags?: unknown; skin_concerns?: unknown; skin_types?: unknown }) =>
        productNeedsTagMapping(p)
      ).length
      setCounts({ pending: p.count || 0, active: a.count || 0, rejected: r.count || 0, trash: t.count || 0, total, unmapped, noBrand })
      setLoading(false)
    } catch (e) {
      console.error('[admin products fetchRows]', e)
      setRows([])
      setLoading(false)
    }
  }, [tab, brandOwnerAuthId])

  useEffect(() => { fetchRows() }, [fetchRows])

  useEffect(() => {
    supabase
      .from('brands')
      .select(
        'id,name,origin_country,default_earn_points,default_earn_points_type,default_share_points,default_share_points_type,default_review_text,default_review_text_type,default_review_photo,default_review_photo_type,default_review_video,default_review_video_type,default_partner_commission,default_partner_commission_type,default_owner_commission,default_owner_commission_type'
      )
      .order('name')
      .then(({ data }) => {
        const rows = (data || []) as BrandRowAdmin[]
        setBrandsWithId(rows)
        const names = rows.map(b => b.name).filter(Boolean)
        setBrandOptionsFromDb(names.length ? names : null)
      })
  }, [])

  const commissionPercentSumWarn = useMemo(() => {
    if (!defForm) return false
    if (defForm.default_partner_commission_type !== 'percent' || defForm.default_owner_commission_type !== 'percent') return false
    const p = Number(defForm.default_partner_commission)
    const o = Number(defForm.default_owner_commission)
    if (!Number.isFinite(p) || !Number.isFinite(o)) return false
    return p + o > 50
  }, [defForm])

  const buildBrandDefaultsPayload = (): Record<string, unknown> => {
    if (!defForm) return {}
    const ni = (s: string) => {
      const t = s.trim()
      if (t === '') return null
      const n = Number(t)
      return Number.isFinite(n) ? Math.round(n) : null
    }
    const nf = (s: string) => {
      const t = s.trim()
      if (t === '') return null
      const n = Number(t)
      return Number.isFinite(n) ? n : null
    }
    return {
      origin_country: defForm.origin_country.trim() ? defForm.origin_country.trim() : null,
      default_earn_points: ni(defForm.default_earn_points),
      default_earn_points_type: defForm.default_earn_points_type,
      default_share_points: ni(defForm.default_share_points),
      default_share_points_type: defForm.default_share_points_type,
      default_review_text: ni(defForm.default_review_text),
      default_review_text_type: defForm.default_review_text_type,
      default_review_photo: ni(defForm.default_review_photo),
      default_review_photo_type: defForm.default_review_photo_type,
      default_review_video: ni(defForm.default_review_video),
      default_review_video_type: defForm.default_review_video_type,
      default_partner_commission: nf(defForm.default_partner_commission),
      default_partner_commission_type: defForm.default_partner_commission_type,
      default_owner_commission: nf(defForm.default_owner_commission),
      default_owner_commission_type: defForm.default_owner_commission_type,
    }
  }

  const saveBrandDefaultsOnly = async () => {
    if (!defaultsSelectId || !defForm) return
    setBrandDefaultsSaveBusy(true)
    const payload = buildBrandDefaultsPayload()
    const { error } = await supabase.from('brands').update(payload as any).eq('id', defaultsSelectId)
    setBrandDefaultsSaveBusy(false)
    if (error) {
      setToast('저장 실패: ' + error.message)
      return
    }
    setBrandsWithId(prev =>
      prev.map(b => (b.id === defaultsSelectId ? { ...b, ...payload } as BrandRowAdmin : b))
    )
    setToast('브랜드 기본값이 저장되었습니다')
  }

  const applyBrandDefaultsToAllProducts = async () => {
    if (!defaultsSelectId || !defForm) return
    if (!window.confirm('이 브랜드의 제품 전체에 적용됩니다. 계속할까요?')) return
    setBrandDefaultsApplyBusy(true)
    const payload = buildBrandDefaultsPayload()
    const { error: uErr } = await supabase.from('brands').update(payload as any).eq('id', defaultsSelectId)
    if (uErr) {
      setBrandDefaultsApplyBusy(false)
      setToast('브랜드 저장 실패: ' + uErr.message)
      return
    }
    const earnVal = Math.round(Number(defForm.default_earn_points) || 0)
    const prodUpd: Record<string, unknown> = {
      share_points: Math.max(0, Math.round(Number(defForm.default_share_points) || 0)),
      review_points_text: Math.max(0, Math.round(Number(defForm.default_review_text) || 0)),
      review_points_photo: Math.max(0, Math.round(Number(defForm.default_review_photo) || 0)),
      review_points_video: Math.max(0, Math.round(Number(defForm.default_review_video) || 0)),
    }
    if (defForm.default_earn_points_type === 'percent') {
      prodUpd.earn_points = Math.max(0, Math.min(100, earnVal))
      prodUpd.earn_points_percent = null
    } else {
      prodUpd.earn_points = 0
      prodUpd.earn_points_percent = Math.max(0, earnVal)
    }
    const { error: pErr } = await supabase
      .from('products')
      .update(prodUpd as any)
      .eq('brand_id', defaultsSelectId)
      .is('deleted_at', null)
    setBrandDefaultsApplyBusy(false)
    if (pErr) {
      setToast('제품 일괄 적용 실패: ' + pErr.message)
      return
    }
    setBrandsWithId(prev =>
      prev.map(b => (b.id === defaultsSelectId ? { ...b, ...payload } as BrandRowAdmin : b))
    )
    setToast('브랜드에 저장했고, 해당 브랜드 제품에 반영했습니다')
    await fetchRows()
  }

  const onDefaultsBrandChange = (id: string) => {
    setDefaultsSelectId(id)
    if (!id) {
      setDefForm(null)
      return
    }
    const b = brandsWithId.find(x => x.id === id)
    setDefForm(b ? brandToDefaultsForm(b) : null)
  }

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
  }, [])

  const mappedRows = useMemo(() =>
    rows.map(r => ({
      ...r,
      brandName: r.brands?.name || '-',
      price: Number(r.retail_price || 0),
      brandUserEmail:
        brandOwnerAuthId && String(r.brand_user_id || '') === String(brandOwnerAuthId)
          ? (brandOwnerEmail || brandUsers.find(u => u.id === String(r.brand_user_id || ''))?.email || '미연결')
          : r.brand_user_id == null || String(r.brand_user_id || '') === ''
            ? '미연결'
            : (brandUsers.find(u => u.id === String(r.brand_user_id || ''))?.email || '미연결'),
    })),
    [rows, brandUsers, brandOwnerAuthId, brandOwnerEmail]
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
      const matchNb = !filterNoBrandOnly || r.brand_id == null || String(r.brand_id).trim() === ''
      return matchQ && matchB && matchP && matchU && matchNb
    }),
    [appliedBrandQ, appliedQ, listFilter, mappedRows, onlyMissingUnitPrice, filterNoBrandOnly]
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
    let q = supabase.from('products').update({ status: 'active' }).eq('id', id)
    if (brandOwnerAuthId) q = q.eq('brand_user_id', brandOwnerAuthId)
    const { error } = await q
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
    let q = supabase.from('products').update({ status: 'discontinued' }).eq('id', id)
    if (brandOwnerAuthId) q = q.eq('brand_user_id', brandOwnerAuthId)
    const { error } = await q
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
    let q = supabase
      .from('products')
      .update({ status: 'active' })
      .eq('status', 'pending')
      .is('deleted_at', null)
    if (brandOwnerAuthId) q = q.eq('brand_user_id', brandOwnerAuthId)
    const { error } = await q
    setBulkBusy(false)
    if (error) {
      setToast('저장 실패: ' + error.message)
      return
    }
    setToast(`✅ 전체 승인 완료 (${counts.pending}건)`)
    await fetchRows()
  }

  const saveFlashSale = async (id: string, payload: { is_flash_sale: boolean; flash_sale_price: number | null; flash_sale_start: string | null; flash_sale_end: string | null }) => {
    let q = supabase.from('products').update(payload as any).eq('id', id)
    if (brandOwnerAuthId) q = q.eq('brand_user_id', brandOwnerAuthId)
    const { error } = await q
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
    let q = supabase.from('products').update({ status: next }).eq('id', id)
    if (brandOwnerAuthId) q = q.eq('brand_user_id', brandOwnerAuthId)
    await q
    await fetchRows()
    setToggleBusyId(null)
    setToast(next === 'active' ? '✅ 노출(ACTIVE)로 변경되었습니다' : '✅ 숨김(HIDDEN) 처리되었습니다')
  }

  const bulkHideSelected = async () => {
    if (selectedIds.size === 0) return
    setBulkHideBusy(true)
    const ids = Array.from(selectedIds)
    let qh = supabase.from('products').update({ status: 'discontinued' }).in('id', ids)
    if (brandOwnerAuthId) qh = qh.eq('brand_user_id', brandOwnerAuthId)
    const { error } = await qh
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
    let qm = supabase
      .from('products')
      .update({ status: 'deleted', deleted_at: nowIso })
      .in('id', ids)
    if (brandOwnerAuthId) qm = qm.eq('brand_user_id', brandOwnerAuthId)
    const { error } = await qm
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
    let qd = supabase.from('products').update({ status: 'deleted', deleted_at: nowIso }).eq('id', id)
    if (brandOwnerAuthId) qd = qd.eq('brand_user_id', brandOwnerAuthId)
    const { error } = await qd
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
    let qap = supabase
      .from('products')
      .update({ status: 'deleted', deleted_at: nowIso })
      .eq('status', 'pending')
      .is('deleted_at', null)
    if (brandOwnerAuthId) qap = qap.eq('brand_user_id', brandOwnerAuthId)
    const { error } = await qap
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
    let qr = supabase.from('products').update({ status: 'active', deleted_at: null }).eq('id', id)
    if (brandOwnerAuthId) qr = qr.eq('brand_user_id', brandOwnerAuthId)
    const { error } = await qr
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
    let qdel = supabase.from('products').delete().eq('id', id)
    if (brandOwnerAuthId) qdel = qdel.eq('brand_user_id', brandOwnerAuthId)
    const { error } = await qdel
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
    let qe = supabase.from('products').select('id').not('deleted_at', 'is', null)
    if (brandOwnerAuthId) qe = qe.eq('brand_user_id', brandOwnerAuthId)
    const { data } = await qe
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

  const runAiBulkForProducts = async (picked: any[]) => {
    if (picked.length === 0) return
    setAiBulkBusy(true)
    setAiBulkProgress({ cur: 0, total: picked.length })
    let done = 0
    for (let i = 0; i < picked.length; i++) {
      const pr = picked[i]
      setAiBulkProgress({ cur: i + 1, total: picked.length })
      const text = String(pr.key_ingredients ?? '').trim()
      if (!text) continue
      const res = await fetch('/api/analyze-ingredients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: `전성분: ${text}\n아래 JSON만 반환해. 설명 없이.\n{"concern_tags":[],"skin_tags":[],"hormone_timing":[]}`,
        }),
      })
      const data = (await res.json()) as {
        concern_tags?: unknown
        skin_tags?: unknown
        hormone_timing?: unknown
        error?: string
      }
      if (!res.ok) continue
      const SKIN_TYPES = ['건성', '지성', '복합성', '민감성', '중성', '모든피부']
      const SKIN_CONCERNS = ['수분부족', '트러블', '미백/톤업', '안티에이징', '모공', '각질', '민감', '탄력저하']
      const MAP_CONCERN: Record<string, string> = {
        트러블: '트러블',
        건조: '수분부족',
        탄력: '탄력저하',
        미백: '미백/톤업',
        홍조: '민감',
        진정: '민감',
        호르몬케어: '안티에이징',
      }
      const rawC = Array.isArray(data.concern_tags) ? data.concern_tags : []
      const nextC = [
        ...Array.from(new Set(
          rawC
            .map((x: unknown) => {
              const s = String(x).trim()
              if (SKIN_CONCERNS.includes(s)) return s
              return MAP_CONCERN[s] || ''
            })
            .filter(Boolean)
        )),
      ]
      const rawS = Array.isArray(data.skin_tags) ? data.skin_tags : []
      const nextS = [
        ...Array.from(new Set(
          rawS.flatMap((x: unknown) => {
            const raw = String(x)
              .trim()
              .replace(/^#+/, '')
            return SKIN_TYPES.filter(st => raw === st || raw.includes(st) || st.includes(raw))
          })
        )),
      ]
      const h = data.hormone_timing
      const htStr = Array.isArray(h)
        ? JSON.stringify(h.map((x: unknown) => String(x)))
        : h != null && String(h).trim()
          ? String(h)
          : ''
      const upd: Record<string, unknown> = {
        skin_concerns: nextC.length ? nextC : null,
        skin_types: nextS.length ? nextS : null,
        concern_tags: nextC.length ? nextC : null,
        skin_tags: nextS.length ? nextS : null,
      }
      if (htStr) upd.hormone_timing = htStr
      let qu = supabase.from('products').update(upd as any).eq('id', pr.id)
      if (brandOwnerAuthId) qu = qu.eq('brand_user_id', brandOwnerAuthId)
      const { error } = await qu
      if (!error) done += 1
    }
    setAiBulkBusy(false)
    setAiBulkProgress(null)
    setToast(`${done}개 매핑 완료`)
    setSelectedIds(new Set())
    await fetchRows()
  }

  const visibleSelectedCount = useMemo(() => filteredRows.filter(r => selectedIds.has(r.id)).length, [filteredRows, selectedIds])
  const allSelected = filteredRows.length > 0 && visibleSelectedCount === filteredRows.length

  const TABS: { key: 'pending' | 'active' | 'rejected' | 'trash' | 'unmapped'; label: string }[] = [
    { key: 'active', label: 'ACTIVE' },
    { key: 'pending', label: 'PENDING' },
    { key: 'unmapped', label: '미매핑' },
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
          tab={tab === 'unmapped' ? 'active' : tab}
          busyId={busyId}
          brands={brandsWithId}
          onClose={() => setSelectedProduct(null)}
          onApprove={approveOne}
          onReject={rejectOne}
          onToast={setToast}
          onProductUpdated={handleProductUpdated}
          onSaveFlash={saveFlashSale}
          hideApprovalFooter={!!brandOwnerAuthId}
        />
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#fff' }}>제품 관리</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>
            {brandOwnerAuthId ? '연결된 제품만 · 썸네일·노출 토글' : '예외만 처리 · 썸네일·노출 토글'}
          </div>
        </div>
        {!brandOwnerAuthId && tab === 'pending' && counts.pending > 0 && (
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

      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.72)', marginBottom: 12, display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        <button
          type="button"
          onClick={() => { setTab('active'); setFilterNoBrandOnly(false); clearSelection() }}
          style={{ background: 'transparent', border: 'none', padding: 0, color: 'inherit', cursor: 'pointer', fontWeight: 800 }}
        >
          전체 {counts.total}
        </button>
        <span style={{ color: 'rgba(255,255,255,0.22)' }}>|</span>
        <button
          type="button"
          onClick={() => { setTab('active'); setFilterNoBrandOnly(false); clearSelection() }}
          style={{ background: 'transparent', border: 'none', padding: 0, color: 'inherit', cursor: 'pointer', fontWeight: 800 }}
        >
          활성 {counts.active}
        </button>
        <span style={{ color: 'rgba(255,255,255,0.22)' }}>|</span>
        <button
          type="button"
          onClick={() => { setTab('unmapped'); setFilterNoBrandOnly(false); clearSelection() }}
          style={{ background: 'transparent', border: 'none', padding: 0, color: 'inherit', cursor: 'pointer', fontWeight: 800 }}
        >
          미매핑 {counts.unmapped}
        </button>
        <span style={{ color: 'rgba(255,255,255,0.22)' }}>|</span>
        <button
          type="button"
          onClick={() => { setTab('active'); setFilterNoBrandOnly(true); clearSelection() }}
          style={{ background: 'transparent', border: 'none', padding: 0, color: 'inherit', cursor: 'pointer', fontWeight: 800 }}
        >
          미연결 {counts.noBrand}
        </button>
      </div>

      {!brandOwnerAuthId ? (
        <>
          <button
            type="button"
            onClick={() => setDefaultsAccordionOpen(o => !o)}
            style={{
              width: '100%',
              marginBottom: defaultsAccordionOpen ? 10 : 16,
              padding: '10px 14px',
              borderRadius: 12,
              border: '1px solid rgba(123,94,167,0.45)',
              background: 'rgba(123,94,167,0.12)',
              color: '#e7ddf7',
              fontSize: 13,
              fontWeight: 800,
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            브랜드 기본값 설정 {defaultsAccordionOpen ? '▲' : '▼'}
          </button>
          {defaultsAccordionOpen ? (
      <div
        style={{
          marginBottom: 16,
          padding: 14,
          borderRadius: 14,
          border: '1px solid rgba(255,255,255,0.1)',
          background: 'rgba(255,255,255,0.03)',
        }}
      >
        <select
          value={defaultsSelectId}
          onChange={e => onDefaultsBrandChange(e.target.value)}
          style={{
            width: '100%',
            maxWidth: 440,
            background: '#121212',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 10,
            padding: '8px 10px',
            color: '#fff',
            fontSize: 12,
            marginBottom: 12,
          }}
        >
          <option value="" style={{ background: '#1a1a1a' }}>
            — 브랜드 선택 —
          </option>
          {brandsWithId.map(b => (
            <option key={b.id} value={b.id} style={{ background: '#1a1a1a' }}>
              {b.name}
            </option>
          ))}
        </select>

        {defForm ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', marginBottom: 4 }}>브랜드 원산지</div>
              <select
                value={defForm.origin_country}
                onChange={e => setDefForm(f => (f ? { ...f, origin_country: e.target.value } : f))}
                style={{
                  width: '100%',
                  maxWidth: 440,
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

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <span style={{ fontSize: 13, color: '#fff' }}>토스트(T) 설정</span>
              <span
                title="토스트(T)는 AURAN 활동으로만 쌓이는 전용 포인트예요. 1T = 100원"
                style={{
                  fontSize: 11,
                  color: 'rgba(255,255,255,0.45)',
                  cursor: 'help',
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                ?
              </span>
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', marginBottom: 4 }}>구매 적립</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                <input
                  type="number"
                  value={defForm.default_earn_points}
                  onChange={e => setDefForm(f => (f ? { ...f, default_earn_points: e.target.value } : f))}
                  style={{
                    width: 100,
                    background: '#121212',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 8,
                    color: '#fff',
                    fontSize: 12,
                    padding: '6px 8px',
                  }}
                />
                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    type="button"
                    onClick={() => setDefForm(f => (f ? { ...f, default_earn_points_type: 'percent' } : f))}
                    style={{
                      fontSize: 10,
                      padding: '4px 10px',
                      borderRadius: 6,
                      border: defForm.default_earn_points_type === 'percent' ? `1px solid ${BRAND_DEFAULTS_ACC}` : '1px solid rgba(255,255,255,0.12)',
                      background: defForm.default_earn_points_type === 'percent' ? 'rgba(123,94,167,0.2)' : 'transparent',
                      color: defForm.default_earn_points_type === 'percent' ? BRAND_DEFAULTS_ACC : 'rgba(255,255,255,0.45)',
                      cursor: 'pointer',
                    }}
                  >
                    %
                  </button>
                  <button
                    type="button"
                    onClick={() => setDefForm(f => (f ? { ...f, default_earn_points_type: 'toast' } : f))}
                    style={{
                      fontSize: 10,
                      padding: '4px 10px',
                      borderRadius: 6,
                      border: defForm.default_earn_points_type === 'toast' ? `1px solid ${BRAND_DEFAULTS_ACC}` : '1px solid rgba(255,255,255,0.12)',
                      background: defForm.default_earn_points_type === 'toast' ? 'rgba(123,94,167,0.2)' : 'transparent',
                      color: defForm.default_earn_points_type === 'toast' ? BRAND_DEFAULTS_ACC : 'rgba(255,255,255,0.45)',
                      cursor: 'pointer',
                    }}
                  >
                    T
                  </button>
                </div>
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', marginBottom: 4 }}>공유 적립</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                <input
                  type="number"
                  value={defForm.default_share_points}
                  onChange={e => setDefForm(f => (f ? { ...f, default_share_points: e.target.value } : f))}
                  style={{
                    width: 100,
                    background: '#121212',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 8,
                    color: '#fff',
                    fontSize: 12,
                    padding: '6px 8px',
                  }}
                />
                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    type="button"
                    onClick={() => setDefForm(f => (f ? { ...f, default_share_points_type: 'percent' } : f))}
                    style={{
                      fontSize: 10,
                      padding: '4px 10px',
                      borderRadius: 6,
                      border: defForm.default_share_points_type === 'percent' ? `1px solid ${BRAND_DEFAULTS_ACC}` : '1px solid rgba(255,255,255,0.12)',
                      background: defForm.default_share_points_type === 'percent' ? 'rgba(123,94,167,0.2)' : 'transparent',
                      color: defForm.default_share_points_type === 'percent' ? BRAND_DEFAULTS_ACC : 'rgba(255,255,255,0.45)',
                      cursor: 'pointer',
                    }}
                  >
                    %
                  </button>
                  <button
                    type="button"
                    onClick={() => setDefForm(f => (f ? { ...f, default_share_points_type: 'toast' } : f))}
                    style={{
                      fontSize: 10,
                      padding: '4px 10px',
                      borderRadius: 6,
                      border: defForm.default_share_points_type === 'toast' ? `1px solid ${BRAND_DEFAULTS_ACC}` : '1px solid rgba(255,255,255,0.12)',
                      background: defForm.default_share_points_type === 'toast' ? 'rgba(123,94,167,0.2)' : 'transparent',
                      color: defForm.default_share_points_type === 'toast' ? BRAND_DEFAULTS_ACC : 'rgba(255,255,255,0.45)',
                      cursor: 'pointer',
                    }}
                  >
                    T
                  </button>
                </div>
              </div>
            </div>

            <div style={{ fontSize: 13, color: '#fff', marginBottom: 8 }}>리뷰 포인트</div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', marginBottom: 4 }}>텍스트 리뷰</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                <input
                  type="number"
                  value={defForm.default_review_text}
                  onChange={e => setDefForm(f => (f ? { ...f, default_review_text: e.target.value } : f))}
                  style={{
                    width: 100,
                    background: '#121212',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 8,
                    color: '#fff',
                    fontSize: 12,
                    padding: '6px 8px',
                  }}
                />
                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    type="button"
                    onClick={() => setDefForm(f => (f ? { ...f, default_review_text_type: 'percent' } : f))}
                    style={{
                      fontSize: 10,
                      padding: '4px 10px',
                      borderRadius: 6,
                      border: defForm.default_review_text_type === 'percent' ? `1px solid ${BRAND_DEFAULTS_ACC}` : '1px solid rgba(255,255,255,0.12)',
                      background: defForm.default_review_text_type === 'percent' ? 'rgba(123,94,167,0.2)' : 'transparent',
                      color: defForm.default_review_text_type === 'percent' ? BRAND_DEFAULTS_ACC : 'rgba(255,255,255,0.45)',
                      cursor: 'pointer',
                    }}
                  >
                    %
                  </button>
                  <button
                    type="button"
                    onClick={() => setDefForm(f => (f ? { ...f, default_review_text_type: 'toast' } : f))}
                    style={{
                      fontSize: 10,
                      padding: '4px 10px',
                      borderRadius: 6,
                      border: defForm.default_review_text_type === 'toast' ? `1px solid ${BRAND_DEFAULTS_ACC}` : '1px solid rgba(255,255,255,0.12)',
                      background: defForm.default_review_text_type === 'toast' ? 'rgba(123,94,167,0.2)' : 'transparent',
                      color: defForm.default_review_text_type === 'toast' ? BRAND_DEFAULTS_ACC : 'rgba(255,255,255,0.45)',
                      cursor: 'pointer',
                    }}
                  >
                    T
                  </button>
                </div>
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', marginBottom: 4 }}>포토 리뷰</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                <input
                  type="number"
                  value={defForm.default_review_photo}
                  onChange={e => setDefForm(f => (f ? { ...f, default_review_photo: e.target.value } : f))}
                  style={{
                    width: 100,
                    background: '#121212',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 8,
                    color: '#fff',
                    fontSize: 12,
                    padding: '6px 8px',
                  }}
                />
                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    type="button"
                    onClick={() => setDefForm(f => (f ? { ...f, default_review_photo_type: 'percent' } : f))}
                    style={{
                      fontSize: 10,
                      padding: '4px 10px',
                      borderRadius: 6,
                      border: defForm.default_review_photo_type === 'percent' ? `1px solid ${BRAND_DEFAULTS_ACC}` : '1px solid rgba(255,255,255,0.12)',
                      background: defForm.default_review_photo_type === 'percent' ? 'rgba(123,94,167,0.2)' : 'transparent',
                      color: defForm.default_review_photo_type === 'percent' ? BRAND_DEFAULTS_ACC : 'rgba(255,255,255,0.45)',
                      cursor: 'pointer',
                    }}
                  >
                    %
                  </button>
                  <button
                    type="button"
                    onClick={() => setDefForm(f => (f ? { ...f, default_review_photo_type: 'toast' } : f))}
                    style={{
                      fontSize: 10,
                      padding: '4px 10px',
                      borderRadius: 6,
                      border: defForm.default_review_photo_type === 'toast' ? `1px solid ${BRAND_DEFAULTS_ACC}` : '1px solid rgba(255,255,255,0.12)',
                      background: defForm.default_review_photo_type === 'toast' ? 'rgba(123,94,167,0.2)' : 'transparent',
                      color: defForm.default_review_photo_type === 'toast' ? BRAND_DEFAULTS_ACC : 'rgba(255,255,255,0.45)',
                      cursor: 'pointer',
                    }}
                  >
                    T
                  </button>
                </div>
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', marginBottom: 4 }}>영상 리뷰</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                <input
                  type="number"
                  value={defForm.default_review_video}
                  onChange={e => setDefForm(f => (f ? { ...f, default_review_video: e.target.value } : f))}
                  style={{
                    width: 100,
                    background: '#121212',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 8,
                    color: '#fff',
                    fontSize: 12,
                    padding: '6px 8px',
                  }}
                />
                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    type="button"
                    onClick={() => setDefForm(f => (f ? { ...f, default_review_video_type: 'percent' } : f))}
                    style={{
                      fontSize: 10,
                      padding: '4px 10px',
                      borderRadius: 6,
                      border: defForm.default_review_video_type === 'percent' ? `1px solid ${BRAND_DEFAULTS_ACC}` : '1px solid rgba(255,255,255,0.12)',
                      background: defForm.default_review_video_type === 'percent' ? 'rgba(123,94,167,0.2)' : 'transparent',
                      color: defForm.default_review_video_type === 'percent' ? BRAND_DEFAULTS_ACC : 'rgba(255,255,255,0.45)',
                      cursor: 'pointer',
                    }}
                  >
                    %
                  </button>
                  <button
                    type="button"
                    onClick={() => setDefForm(f => (f ? { ...f, default_review_video_type: 'toast' } : f))}
                    style={{
                      fontSize: 10,
                      padding: '4px 10px',
                      borderRadius: 6,
                      border: defForm.default_review_video_type === 'toast' ? `1px solid ${BRAND_DEFAULTS_ACC}` : '1px solid rgba(255,255,255,0.12)',
                      background: defForm.default_review_video_type === 'toast' ? 'rgba(123,94,167,0.2)' : 'transparent',
                      color: defForm.default_review_video_type === 'toast' ? BRAND_DEFAULTS_ACC : 'rgba(255,255,255,0.45)',
                      cursor: 'pointer',
                    }}
                  >
                    T
                  </button>
                </div>
              </div>
            </div>

            <div style={{ fontSize: 13, color: '#fff', marginBottom: 8, marginTop: 4 }}>수수료 설정</div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', marginBottom: 4 }}>파트너스 수수료</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                <input
                  type="number"
                  value={defForm.default_partner_commission}
                  onChange={e => setDefForm(f => (f ? { ...f, default_partner_commission: e.target.value } : f))}
                  style={{
                    width: 100,
                    background: '#121212',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 8,
                    color: '#fff',
                    fontSize: 12,
                    padding: '6px 8px',
                  }}
                />
                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    type="button"
                    onClick={() => setDefForm(f => (f ? { ...f, default_partner_commission_type: 'percent' } : f))}
                    style={{
                      fontSize: 10,
                      padding: '4px 10px',
                      borderRadius: 6,
                      border: defForm.default_partner_commission_type === 'percent' ? `1px solid ${BRAND_DEFAULTS_ACC}` : '1px solid rgba(255,255,255,0.12)',
                      background: defForm.default_partner_commission_type === 'percent' ? 'rgba(123,94,167,0.2)' : 'transparent',
                      color: defForm.default_partner_commission_type === 'percent' ? BRAND_DEFAULTS_ACC : 'rgba(255,255,255,0.45)',
                      cursor: 'pointer',
                    }}
                  >
                    %
                  </button>
                  <button
                    type="button"
                    onClick={() => setDefForm(f => (f ? { ...f, default_partner_commission_type: 'won' } : f))}
                    style={{
                      fontSize: 10,
                      padding: '4px 10px',
                      borderRadius: 6,
                      border: defForm.default_partner_commission_type === 'won' ? `1px solid ${BRAND_DEFAULTS_ACC}` : '1px solid rgba(255,255,255,0.12)',
                      background: defForm.default_partner_commission_type === 'won' ? 'rgba(123,94,167,0.2)' : 'transparent',
                      color: defForm.default_partner_commission_type === 'won' ? BRAND_DEFAULTS_ACC : 'rgba(255,255,255,0.45)',
                      cursor: 'pointer',
                    }}
                  >
                    원
                  </button>
                </div>
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', marginBottom: 4 }}>원장님 수수료</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                <input
                  type="number"
                  value={defForm.default_owner_commission}
                  onChange={e => setDefForm(f => (f ? { ...f, default_owner_commission: e.target.value } : f))}
                  style={{
                    width: 100,
                    background: '#121212',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 8,
                    color: '#fff',
                    fontSize: 12,
                    padding: '6px 8px',
                  }}
                />
                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    type="button"
                    onClick={() => setDefForm(f => (f ? { ...f, default_owner_commission_type: 'percent' } : f))}
                    style={{
                      fontSize: 10,
                      padding: '4px 10px',
                      borderRadius: 6,
                      border: defForm.default_owner_commission_type === 'percent' ? `1px solid ${BRAND_DEFAULTS_ACC}` : '1px solid rgba(255,255,255,0.12)',
                      background: defForm.default_owner_commission_type === 'percent' ? 'rgba(123,94,167,0.2)' : 'transparent',
                      color: defForm.default_owner_commission_type === 'percent' ? BRAND_DEFAULTS_ACC : 'rgba(255,255,255,0.45)',
                      cursor: 'pointer',
                    }}
                  >
                    %
                  </button>
                  <button
                    type="button"
                    onClick={() => setDefForm(f => (f ? { ...f, default_owner_commission_type: 'won' } : f))}
                    style={{
                      fontSize: 10,
                      padding: '4px 10px',
                      borderRadius: 6,
                      border: defForm.default_owner_commission_type === 'won' ? `1px solid ${BRAND_DEFAULTS_ACC}` : '1px solid rgba(255,255,255,0.12)',
                      background: defForm.default_owner_commission_type === 'won' ? 'rgba(123,94,167,0.2)' : 'transparent',
                      color: defForm.default_owner_commission_type === 'won' ? BRAND_DEFAULTS_ACC : 'rgba(255,255,255,0.45)',
                      cursor: 'pointer',
                    }}
                  >
                    원
                  </button>
                </div>
              </div>
            </div>

            {commissionPercentSumWarn ? (
              <div style={{ fontSize: 11, color: '#ef5350', marginBottom: 12, lineHeight: 1.45 }}>
                파트너스·원장님 수수료(%) 합이 50%를 넘습니다. 정책을 다시 확인해 주세요.
              </div>
            ) : null}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
              <button
                type="button"
                disabled={brandDefaultsSaveBusy || brandDefaultsApplyBusy}
                onClick={() => void saveBrandDefaultsOnly()}
                style={{
                  width: '100%',
                  maxWidth: 440,
                  padding: '10px 14px',
                  borderRadius: 10,
                  border: `1px solid ${BRAND_DEFAULTS_ACC}`,
                  background: 'rgba(123,94,167,0.22)',
                  color: '#e7ddf7',
                  fontSize: 12,
                  cursor: brandDefaultsSaveBusy || brandDefaultsApplyBusy ? 'wait' : 'pointer',
                }}
              >
                {brandDefaultsSaveBusy ? '저장 중…' : '저장만 하기'}
              </button>
              <button
                type="button"
                disabled={brandDefaultsSaveBusy || brandDefaultsApplyBusy}
                onClick={() => void applyBrandDefaultsToAllProducts()}
                style={{
                  width: '100%',
                  maxWidth: 440,
                  padding: '10px 14px',
                  borderRadius: 10,
                  border: '1px solid rgba(76,173,126,0.45)',
                  background: 'rgba(76,173,126,0.12)',
                  color: '#9fd4b8',
                  fontSize: 12,
                  cursor: brandDefaultsSaveBusy || brandDefaultsApplyBusy ? 'wait' : 'pointer',
                }}
              >
                {brandDefaultsApplyBusy ? '적용 중…' : '전체 제품에 적용'}
              </button>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>
            {brandsWithId.length === 0
              ? '등록된 브랜드가 없습니다.'
              : '브랜드를 선택하면 기본값을 편집할 수 있습니다.'}
          </div>
        )}
      </div>
          ) : null}
        </>
      ) : null}

      {!brandOwnerAuthId ? (
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16, alignItems: 'center',
          padding: 12, borderRadius: 14, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)',
        }}>
          {tab === 'unmapped' && filteredRows.length > 0 ? (
            <button
              type="button"
              disabled={aiBulkBusy}
              onClick={(e) => {
                e.preventDefault()
                void runAiBulkForProducts(filteredRows)
              }}
              style={{
                background: 'linear-gradient(135deg, #c9a84c 0%, #a8863a 100%)',
                border: 'none',
                borderRadius: 10,
                padding: '8px 14px',
                color: '#000',
                fontSize: 12,
                fontWeight: 900,
                cursor: aiBulkBusy ? 'wait' : 'pointer',
                boxShadow: '0 2px 12px rgba(201,168,76,0.25)',
              }}
            >
              {aiBulkBusy ? '분석 중…' : 'AI 일괄분석 시작'}
            </button>
          ) : null}
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
          {aiBulkBusy && aiBulkProgress ? (
            <span style={{ fontSize: 12, color: '#c9a84c', fontWeight: 800 }}>
              분석 중... {aiBulkProgress.cur}/{aiBulkProgress.total}
            </span>
          ) : null}
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
              {tab !== 'unmapped' ? (
                <button
                  type="button"
                  disabled={aiBulkBusy}
                  onClick={(e) => {
                    e.preventDefault()
                    void runAiBulkForProducts(filteredRows.filter(r => selectedIds.has(r.id)))
                  }}
                  style={{
                    background: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.45)',
                    borderRadius: 10, padding: '8px 12px', color: '#e8d4a8', fontSize: 12, fontWeight: 900, cursor: aiBulkBusy ? 'wait' : 'pointer',
                  }}
                >
                  AI 자동분석 일괄실행
                </button>
              ) : null}
            </>
          )}
        </div>
      ) : null}

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        {TABS.filter(t => !brandOwnerAuthId || t.key !== 'trash').map(t => (
          <button
            type="button"
            key={t.key}
            onClick={() => { setTab(t.key); clearSelection(); setFilterNoBrandOnly(false) }}
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
        {(q || brandQ !== 'all' || appliedQ || appliedBrandQ !== 'all' || listFilter !== 'all' || onlyMissingUnitPrice || filterNoBrandOnly) && (
          <button
            type="button"
            onClick={() => { setQ(''); setBrandQ('all'); setAppliedQ(''); setAppliedBrandQ('all'); setListFilter('all'); setOnlyMissingUnitPrice(false); setFilterNoBrandOnly(false) }}
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
              brandScope={!!brandOwnerAuthId}
              onBrandCardAssign={
                brandOwnerAuthId
                  ? undefined
                  : () => {
                      setBrandCardAssignRow(p)
                      setBrandCardAssignUserId(String(p.brand_user_id || ''))
                    }
              }
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
      {brandCardAssignRow ? (
        <div
          onClick={() => !brandCardAssignBusy && setBrandCardAssignRow(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 360, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 420, background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: 14 }}
          >
            <div style={{ fontSize: 14, color: '#fff', marginBottom: 10 }}>브랜드사 연결</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', marginBottom: 8 }}>
              현재: {brandCardAssignRow.brandUserEmail && brandCardAssignRow.brandUserEmail !== '미연결' ? brandCardAssignRow.brandUserEmail : '미연결'}
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 10 }}>{brandCardAssignRow.name}</div>
            <select
              value={brandCardAssignUserId}
              onChange={e => setBrandCardAssignUserId(e.target.value)}
              style={{ width: '100%', background: '#121212', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '10px 12px', color: '#fff', fontSize: 12 }}
            >
              <option value="" style={{ background: '#1a1a1a' }}>— 연결 없음 —</option>
              {brandUsers.map(u => (
                <option key={u.id} value={u.id} style={{ background: '#1a1a1a' }}>{u.email}</option>
              ))}
            </select>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button
                type="button"
                disabled={brandCardAssignBusy}
                onClick={() => setBrandCardAssignRow(null)}
                style={{ flex: 1, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: 'rgba(255,255,255,0.75)', borderRadius: 8, padding: '9px 10px', fontSize: 12, cursor: 'pointer' }}
              >
                취소
              </button>
              <button
                type="button"
                disabled={brandCardAssignBusy}
                onClick={async () => {
                  const id = brandCardAssignRow.id
                  if (!id) return
                  setBrandCardAssignBusy(true)
                  const v = brandCardAssignUserId.trim() === '' ? null : brandCardAssignUserId
                  const { error } = await supabase.from('products').update({ brand_user_id: v } as any).eq('id', id)
                  setBrandCardAssignBusy(false)
                  if (error) {
                    setToast('브랜드사 연결 실패: ' + error.message)
                    return
                  }
                  setToast('브랜드사 연결을 저장했습니다')
                  setBrandCardAssignRow(null)
                  await fetchRows()
                }}
                style={{ flex: 1, border: '1px solid rgba(123,94,167,0.6)', background: 'rgba(123,94,167,0.3)', color: '#e7ddf7', borderRadius: 8, padding: '9px 10px', fontSize: 12, cursor: 'pointer' }}
              >
                {brandCardAssignBusy ? '적용 중...' : '적용'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
