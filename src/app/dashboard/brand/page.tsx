'use client'

import ProductThumbnail from '@/components/ui/ProductThumbnail'
import { createClient } from '@/lib/supabase/client'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'

const BrandProductForm = dynamic(() => import('@/components/brand/BrandProductForm'), { ssr: false })
const ProductDetailModal = dynamic(() => import('@/app/admin/marketing/products/ProductDetailModal'), { ssr: false })

const BG = '#0f0d14'
const ACC = '#7B5EA7'

type Row = Record<string, unknown> & { id: string; name?: string | null; status?: string | null; thumb_img?: string | null }

export default function BrandDashboardPage() {
  const supabase = createClient()
  const router = useRouter()
  const [authId, setAuthId] = useState<string | null>(null)
  const [brandId, setBrandId] = useState<string | null>(null)
  const [brandName, setBrandName] = useState('')
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<Row[]>([])
  const [tab, setTab] = useState<'pending' | 'active' | 'hidden'>('pending')
  const [formOpen, setFormOpen] = useState(false)
  const [editProduct, setEditProduct] = useState<Row | null>(null)
  const [brands, setBrands] = useState<{ id: string; name: string; origin_country?: string | null }[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)
  const [toast, setToast] = useState('')

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.replace('/login?role=brand')
      return
    }
    setAuthId(user.id)
    const { data: u } = await supabase.from('users').select('id,role').eq('auth_id', user.id).maybeSingle()
    if (!u?.id || (u as { role?: string }).role !== 'brand') {
      router.replace('/login?role=brand')
      return
    }
    const { data: b } = await supabase.from('brands').select('id,name').eq('user_id', u.id).maybeSingle()
    const bid = (b as { id?: string } | null)?.id || null
    setBrandId(bid)
    setBrandName(String((b as { name?: string } | null)?.name || ''))
    const { data: pr } = await supabase
      .from('products')
      .select('*, brands(id,name)')
      .eq('brand_user_id', user.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
    setRows((pr || []) as Row[])
    setLoading(false)
  }, [router, supabase])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    supabase
      .from('brands')
      .select('id,name,origin_country')
      .order('name')
      .then(({ data }) => setBrands((data || []) as { id: string; name: string; origin_country?: string | null }[]))
  }, [supabase])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 2800)
    return () => clearTimeout(t)
  }, [toast])

  const filtered = useMemo(() => {
    return rows.filter(p => {
      const st = String(p.status || '')
      if (tab === 'pending') return st === 'pending'
      if (tab === 'active') return st === 'active'
      return st === 'discontinued' || st === 'hidden'
    })
  }, [rows, tab])

  const counts = useMemo(() => {
    let pending = 0
    let active = 0
    let hidden = 0
    for (const p of rows) {
      const st = String(p.status || '')
      if (st === 'pending') pending++
      else if (st === 'active') active++
      else if (st === 'discontinued' || st === 'hidden') hidden++
    }
    return { pending, active, hidden }
  }, [rows])

  const listTabForModal = (p: Row): 'pending' | 'active' | 'rejected' => {
    const st = String(p.status || '')
    if (st === 'pending') return 'pending'
    if (st === 'active') return 'active'
    return 'rejected'
  }

  const fetchRows = useCallback(async () => {
    if (!authId) return
    const { data: pr } = await supabase
      .from('products')
      .select('*, brands(id,name)')
      .eq('brand_user_id', authId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
    setRows((pr || []) as Row[])
  }, [authId, supabase])

  const approveOne = async (id: string) => {
    setBusyId(id)
    await supabase.from('products').update({ status: 'active' }).eq('id', id).eq('brand_user_id', authId || '')
    setBusyId(null)
    await fetchRows()
  }

  const rejectOne = async (id: string) => {
    setBusyId(id)
    await supabase.from('products').update({ status: 'discontinued' }).eq('id', id).eq('brand_user_id', authId || '')
    setBusyId(null)
    await fetchRows()
  }

  const saveFlashSale = async (
    id: string,
    payload: { is_flash_sale: boolean; flash_sale_price: number | null; flash_sale_start: string | null; flash_sale_end: string | null }
  ) => {
    let q = supabase.from('products').update(payload as any).eq('id', id)
    if (authId) q = q.eq('brand_user_id', authId)
    const { error } = await q
    if (error) {
      setToast(error.message || '저장 실패')
      return
    }
    await fetchRows()
    setToast('타임세일 저장됨')
  }

  const handleProductUpdated = (p: any) => {
    setEditProduct(p)
    setRows(prev => prev.map(r => (r.id === p.id ? { ...r, ...p } : r)))
  }

  const badge = (p: Row) => {
    const st = String(p.status || '')
    if (st === 'pending') return { t: 'PENDING', c: 'rgba(255,193,7,0.25)', b: 'rgba(255,193,7,0.45)' }
    if (st === 'active') return { t: 'ACTIVE', c: 'rgba(76,175,80,0.2)', b: 'rgba(76,175,80,0.45)' }
    return { t: 'HIDDEN', c: 'rgba(158,158,158,0.18)', b: 'rgba(158,158,158,0.4)' }
  }

  if (loading || !authId) {
    return (
      <div style={{ minHeight: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: BG, color: 'rgba(255,255,255,0.45)', fontSize: 13 }}>
        불러오는 중…
      </div>
    )
  }

  if (!brandId) {
    return (
      <div style={{ background: BG, minHeight: '100vh', padding: 24, maxWidth: 560, margin: '0 auto', color: 'rgba(255,255,255,0.65)', fontSize: 13 }}>
        <div style={{ fontSize: 18, color: ACC, marginBottom: 10 }}>브랜드사 대시보드</div>
        등록된 브랜드 정보가 없습니다. 관리자에게 연동을 요청해 주세요.
      </div>
    )
  }

  return (
    <div style={{ background: BG, minHeight: '100vh', color: '#e9e4f1', padding: '20px 16px 48px', maxWidth: 780, margin: '0 auto' }}>
      {toast ? (
        <div
          style={{
            position: 'fixed',
            top: 14,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 500,
            padding: '10px 16px',
            borderRadius: 10,
            background: 'rgba(26,22,34,0.96)',
            border: `1px solid rgba(123,94,167,0.4)`,
            fontSize: 12,
            color: '#e8dff9',
          }}
        >
          {toast}
        </div>
      ) : null}

      {editProduct ? (
        <ProductDetailModal
          product={editProduct}
          tab={listTabForModal(editProduct)}
          busyId={busyId}
          brands={brands}
          onClose={() => setEditProduct(null)}
          onApprove={approveOne}
          onReject={rejectOne}
          onToast={setToast}
          onProductUpdated={handleProductUpdated}
          onSaveFlash={saveFlashSale}
          hideApprovalFooter
        />
      ) : null}

      <BrandProductForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        authUserId={authId}
        brandId={brandId}
        brandName={brandName}
        onSubmitted={() => void fetchRows()}
      />

      <div style={{ fontSize: 20, color: ACC, marginBottom: 6 }}>브랜드사 대시보드</div>
      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginBottom: 18 }}>연결된 제품만 표시됩니다.</div>

      <button
        type="button"
        onClick={() => setFormOpen(true)}
        style={{
          width: '100%',
          marginBottom: 18,
          padding: '12px 14px',
          borderRadius: 12,
          border: `1px solid ${ACC}`,
          background: 'rgba(123,94,167,0.18)',
          color: '#ebe3f7',
          fontSize: 13,
          cursor: 'pointer',
        }}
      >
        + 새 제품 등록
      </button>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {(
          [
            { key: 'pending' as const, label: 'PENDING' },
            { key: 'active' as const, label: 'ACTIVE' },
            { key: 'hidden' as const, label: 'HIDDEN' },
          ] as const
        ).map(t => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            style={{
              padding: '8px 14px',
              borderRadius: 999,
              border: tab === t.key ? `1px solid ${ACC}` : '1px solid rgba(255,255,255,0.12)',
              background: tab === t.key ? 'rgba(123,94,167,0.15)' : 'transparent',
              color: tab === t.key ? '#e4daf5' : 'rgba(255,255,255,0.45)',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            {t.label} ({counts[t.key]})
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', padding: 24, textAlign: 'center', border: '1px solid rgba(123,94,167,0.25)', borderRadius: 12 }}>
          이 탭에 표시할 제품이 없습니다.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(p => {
            const b = badge(p)
            return (
              <div
                key={p.id}
                style={{
                  display: 'flex',
                  gap: 12,
                  alignItems: 'center',
                  padding: 12,
                  borderRadius: 12,
                  border: '1px solid rgba(255,255,255,0.08)',
                  background: 'rgba(255,255,255,0.03)',
                }}
              >
                <div style={{ width: 56, height: 56, borderRadius: 10, overflow: 'hidden', flexShrink: 0, border: '1px solid rgba(255,255,255,0.08)' }}>
                  <ProductThumbnail src={typeof p.thumb_img === 'string' ? p.thumb_img : null} alt={String(p.name || '')} size={56} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, color: '#f2eef9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name || '이름 없음'}</div>
                  <div style={{ marginTop: 6 }}>
                    <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 999, background: b.c, border: `1px solid ${b.b}`, color: '#f5f0ff' }}>{b.t}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditProduct(p)}
                  style={{
                    flexShrink: 0,
                    padding: '8px 12px',
                    borderRadius: 10,
                    border: `1px solid ${ACC}`,
                    background: 'rgba(123,94,167,0.12)',
                    color: '#dcccf2',
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  수정
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
