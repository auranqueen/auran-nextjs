'use client'

import ProductThumbnail from '@/components/ui/ProductThumbnail'
import { createClient } from '@/lib/supabase/client'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import type { CSSProperties } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'

const BrandProductFormV2 = dynamic(() => import('@/components/brand/BrandProductFormV2'), { ssr: false })
const BrandPinGate = dynamic(() => import('./components/BrandPinGate'), { ssr: false })
const BrandWatermark = dynamic(() => import('./components/BrandWatermark'), { ssr: false })
const BrandWelcomePopup = dynamic(() => import('./components/BrandWelcomePopup'), { ssr: false })
const BrandHubContent = dynamic(() => import('./components/BrandHubContent'), { ssr: false })

const BG = '#0f0d14'
const ACC = '#7B5EA7'
const GOLD = '#C9A96E'

type Row = Record<string, unknown> & { id: string; name?: string | null; status?: string | null; thumb_img?: string | null }

export default function BrandDashboardPage() {
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const loginRole = searchParams.get('login_role') || 'director'
  const isCEO = loginRole === 'ceo'
  const [pinAuth, setPinAuth] = useState<{
    id: string
    name: string
    role: string
    permissions: string[]
  } | null>(null)
  const [authId, setAuthId] = useState<string | null>(null)
  const [userPk, setUserPk] = useState<string | null>(null)
  const [brandId, setBrandId] = useState<string | null>(null)
  const [brandName, setBrandName] = useState('')
  const [brandRow, setBrandRow] = useState<Record<string, unknown> | null>(null)
  const [myBrands, setMyBrands] = useState<Array<{ id: string; name: string; role: string }>>([])
  const [activeBrandId, setActiveBrandId] = useState<string | null>(null)
  const [showBrandDropdown, setShowBrandDropdown] = useState(false)
  const [showAddBrand, setShowAddBrand] = useState(false)
  const [addBrandName, setAddBrandName] = useState('')
  const [addBrandNameEn, setAddBrandNameEn] = useState('')
  const [addBrandCountry, setAddBrandCountry] = useState('')
  const [addBrandContact, setAddBrandContact] = useState('')
  const [addBrandLoading, setAddBrandLoading] = useState(false)
  const [addBrandDone, setAddBrandDone] = useState(false)
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<Row[]>([])
  const [tab, setTab] = useState<'pending' | 'active' | 'hidden'>('pending')
  const [formOpen, setFormOpen] = useState(false)
  const [editProduct, setEditProduct] = useState<{ id: string } | null>(null)
  const [brands, setBrands] = useState<{ id: string; name: string; origin_country?: string | null }[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)
  const [toast, setToast] = useState('')

  const isApproved = brandRow?.apply_status != null && String(brandRow.apply_status).toLowerCase().trim() === 'approved'
  const showWelcome = isApproved && brandRow !== null && brandRow.welcome_shown === false

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
    setUserPk(u.id)
    const { data: brandList } = await supabase
      .from('brands')
      .select('id,name,apply_status,welcome_shown,manager_name,origin_country,settlement_cycle,approved_at,logo_url,created_at')
      .eq('user_id', u.id)
      .order('created_at', { ascending: true })
    const b = brandList?.[0] || null
    const bid = (b as { id?: string } | null)?.id || null
    setBrandId(bid)
    setBrandRow((b as Record<string, unknown> | null) || null)
    setBrandName(String((b as { name?: string } | null)?.name || ''))
    const { data: memberRows } = await supabase
      .from('brand_members')
      .select('brand_id, role, brands(id, name)')
      .eq('user_id', u.id)

    const memberList =
      memberRows && memberRows.length > 0
        ? memberRows.map((m: any) => ({
            id: m.brands?.id ?? m.brand_id,
            name: m.brands?.name ?? '',
            role: m.role,
          }))
        : []

    if (memberList.length > 0) {
      setMyBrands(memberList)
      if (!activeBrandId) setActiveBrandId(memberList[0]?.id ?? null)
    }

    const brandIdSet = new Set<string>()
    for (const owned of brandList || []) {
      if (owned?.id) brandIdSet.add(String(owned.id))
    }
    for (const member of memberList) {
      if (member.id) brandIdSet.add(String(member.id))
    }
    const allBrandIds = Array.from(brandIdSet)

    if (allBrandIds.length > 0) {
      const { data: pr } = await supabase
        .from('brand_products')
        .select('*, brands(id,name)')
        .eq('brand_user_id', u.id)
        .in('brand_id', allBrandIds)
        .order('created_at', { ascending: false })
      setRows((pr || []) as Row[])
    } else {
      setRows([])
    }

    setLoading(false)
  }, [router])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    supabase
      .from('brands')
      .select('id,name,origin_country')
      .order('name')
      .then(({ data }) => setBrands((data || []) as { id: string; name: string; origin_country?: string | null }[]))
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 2800)
    return () => clearTimeout(t)
  }, [toast])


  const dismissWelcome = async () => {
    if (!brandId) return
    const { error } = await supabase.from('brands').update({ welcome_shown: true } as any).eq('id', brandId)
    if (error) {
      setToast(error.message || '저장 실패')
      return
    }
    setBrandRow(r => (r ? { ...r, welcome_shown: true } : r))
  }

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
    if (!userPk) return

    const { data: ownedRows } = await supabase
      .from('brands')
      .select('id')
      .eq('user_id', userPk)

    const brandIdSet = new Set<string>()
    for (const owned of ownedRows || []) {
      if (owned?.id) brandIdSet.add(String(owned.id))
    }
    for (const member of myBrands) {
      if (member.id) brandIdSet.add(String(member.id))
    }
    const allBrandIds = Array.from(brandIdSet)

    if (allBrandIds.length === 0) {
      setRows([])
      return
    }

    const { data: pr } = await supabase
      .from('brand_products')
      .select('*, brands(id,name)')
      .eq('brand_user_id', userPk)
      .in('brand_id', allBrandIds)
      .order('created_at', { ascending: false })

    setRows((pr || []) as Row[])
  }, [userPk, myBrands, supabase])

  const approveOne = async (id: string) => {
    setBusyId(id)
    await supabase.from('brand_products').update({ status: 'active' }).eq('id', id).eq('brand_user_id', userPk || '')
    setBusyId(null)
    await fetchRows()
  }

  const rejectOne = async (id: string) => {
    setBusyId(id)
    await supabase.from('brand_products').update({ status: 'discontinued' }).eq('id', id).eq('brand_user_id', userPk || '')
    setBusyId(null)
    await fetchRows()
  }

  const saveFlashSale = async (
    _id: string,
    _payload: { is_flash_sale: boolean; flash_sale_price: number | null; flash_sale_start: string | null; flash_sale_end: string | null }
  ) => {
    setToast('재고발주 제품은 타임세일을 지원하지 않아요')
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

  if (!pinAuth && brandId) {
    return (
      <BrandPinGate
        brandId={brandId}
        brandName={brandName}
        onAuth={setPinAuth}
      />
    )
  }

  const logoUrlStr = brandRow?.logo_url != null ? String(brandRow.logo_url) : ''
  const displayName = brandName || String(brandRow?.name || '')
  const originShow = String(brandRow?.origin_country || '—')
  const mgrShow = String(brandRow?.manager_name || '—')
  const settleShow = String(brandRow?.settlement_cycle || '—')
  const approvedStr = brandRow?.approved_at ? new Date(String(brandRow.approved_at)).toLocaleDateString('ko-KR') : '—'
  const initialLetter = displayName.trim().slice(0, 1).toUpperCase() || 'B'

  return (
    <div style={{ position: 'relative', background: BG, minHeight: '100vh', color: '#e9e4f1', padding: '20px 16px 48px', maxWidth: 780, margin: '0 auto' }}>
      <style
        dangerouslySetInnerHTML={{
          __html: `@keyframes branddash_sparkle{0%,100%{opacity:0.3}50%{opacity:1}}@keyframes branddash_float{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}`,
        }}
      />
      {showWelcome ? (
        <BrandWelcomePopup
          displayName={displayName}
          logoUrlStr={logoUrlStr}
          initialLetter={initialLetter}
          approvedStr={approvedStr}
          originShow={originShow}
          mgrShow={mgrShow}
          settleShow={settleShow}
          onDismiss={() => void dismissWelcome()}
        />
      ) : null}

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

      {pinAuth && (
        <BrandWatermark
          staffName={pinAuth.name}
          staffRole={pinAuth.role}
        />
      )}

      {(editProduct || formOpen) && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 1200,
              maxHeight: '90vh',
              overflowY: 'auto',
              borderRadius: 16,
            }}
          >
            <BrandProductFormV2
              brandId={activeBrandId || brandId!}
              brandName={brandName}
              myBrands={myBrands.map(({ id, name }) => ({ id, name }))}
              authUserId={authId!}
              productId={editProduct?.id}
              onClose={() => {
                setFormOpen(false)
                setEditProduct(null)
              }}
              onSaved={() => {
                setFormOpen(false)
                setEditProduct(null)
                void fetchRows()
              }}
            />
          </div>
        </div>
      )}

      {myBrands.length > 1 && (
        <div style={{ position: 'relative', marginBottom: 12 }}>
          <button
            onClick={() => setShowBrandDropdown(v => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', cursor: 'pointer', color: '#fff', fontSize: 13 }}
          >
            <span>{myBrands.find(b => b.id === activeBrandId)?.name ?? brandName}</span>
            <span style={{ fontSize: 10, opacity: 0.5 }}>▼</span>
          </button>
          {showBrandDropdown && (
            <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, minWidth: 180, zIndex: 50, overflow: 'hidden' }}>
              {myBrands.map(b => (
                <div
                  key={b.id}
                  onClick={() => {
                    setActiveBrandId(b.id)
                    setBrandName(b.name)
                    setShowBrandDropdown(false)
                  }}
                  style={{ padding: '10px 16px', cursor: 'pointer', fontSize: 13, color: b.id === activeBrandId ? '#7B5EA7' : 'rgba(255,255,255,0.7)', background: b.id === activeBrandId ? 'rgba(123,94,167,0.1)' : 'transparent' }}
                >
                  {b.name}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <button
          onClick={() => setShowAddBrand(true)}
          style={{ fontSize: 12, color: '#7B5EA7', background: 'rgba(123,94,167,0.1)', border: '1px solid rgba(123,94,167,0.3)', borderRadius: 20, padding: '6px 14px', cursor: 'pointer' }}
        >
          + 브랜드 추가
        </button>
      </div>
      {showAddBrand && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#1a1a2e', borderRadius: 16, padding: 24, width: '100%', maxWidth: 400 }}>
            {addBrandDone ? (
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>🎉</div>
                <div style={{ fontSize: 15, color: '#fff', marginBottom: 20 }}>브랜드가 추가됐어요!</div>
                <button
                  onClick={() => {
                    setShowAddBrand(false)
                    setAddBrandDone(false)
                    setAddBrandName('')
                    setAddBrandNameEn('')
                    setAddBrandCountry('')
                    setAddBrandContact('')
                  }}
                  style={{ padding: '10px 24px', borderRadius: 20, background: '#7B5EA7', border: 'none', color: '#fff', fontSize: 13, cursor: 'pointer' }}
                >
                  확인
                </button>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <span style={{ fontSize: 15, color: '#fff' }}>새 브랜드 추가</span>
                  <button onClick={() => setShowAddBrand(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 18 }}>
                    ✕
                  </button>
                </div>
                {[
                  { label: '브랜드명 (한글)', value: addBrandName, set: setAddBrandName, placeholder: '예: 시바산' },
                  { label: '브랜드명 (영문)', value: addBrandNameEn, set: setAddBrandNameEn, placeholder: '예: CIVASAN' },
                  { label: '원산지', value: addBrandCountry, set: setAddBrandCountry, placeholder: '예: 대한민국' },
                  { label: '담당자 연락처', value: addBrandContact, set: setAddBrandContact, placeholder: '010-0000-0000' },
                ].map(({ label, value, set, placeholder }) => (
                  <div key={label} style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>{label}</div>
                    <input
                      value={value}
                      onChange={e => set(e.target.value)}
                      placeholder={placeholder}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: 8,
                        border: '1px solid rgba(255,255,255,0.1)',
                        background: 'rgba(255,255,255,0.05)',
                        color: '#fff',
                        fontSize: 13,
                        boxSizing: 'border-box',
                        outline: 'none',
                      }}
                    />
                  </div>
                ))}
                <button
                  disabled={addBrandLoading || !addBrandName || !userPk}
                  onClick={async () => {
                    if (!addBrandName || !userPk) return
                    setAddBrandLoading(true)

                    const hubBrandId = brandId || activeBrandId
                    if (!hubBrandId) {
                      setAddBrandLoading(false)
                      alert('현재 브랜드 정보를 찾을 수 없어요')
                      return
                    }

                    const { data: newBrand, error } = await supabase
                      .from('brands')
                      .insert({
                        name: addBrandName,
                        name_en: addBrandNameEn || null,
                        origin_country: addBrandCountry || '대한민국',
                        user_id: userPk,
                        apply_status: 'approved',
                        status: 'active',
                        welcome_shown: true,
                        manager_phone: addBrandContact || null,
                      })
                      .select('id')
                      .single()

                    if (error || !newBrand?.id) {
                      setAddBrandLoading(false)
                      alert(error?.message || '브랜드 추가에 실패했어요')
                      return
                    }

                    await supabase.from('brand_members').insert({
                      user_id: userPk,
                      brand_id: newBrand.id,
                      role: 'owner',
                    })

                    try {
                      await fetch('/api/brand/second-brand/connect-owners', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'same-origin',
                        body: JSON.stringify({
                          hub_brand_id: hubBrandId,
                          second_brand_id: newBrand.id,
                          second_brand_name: addBrandName,
                        }),
                      })
                    } catch {
                      /* trade_brands 연결 실패해도 브랜드 생성은 유지 */
                    }

                    setAddBrandDone(true)
                    const newEntry = { id: newBrand.id, name: addBrandName, role: 'owner' }
                    setMyBrands(prev => [...prev, newEntry])
                    setActiveBrandId(newBrand.id)
                    setBrandId(newBrand.id)
                    setBrandName(addBrandName)
                    void fetchRows()
                    setAddBrandLoading(false)
                  }}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: 10,
                    background: addBrandLoading || !addBrandName || !userPk ? 'rgba(123,94,167,0.3)' : '#7B5EA7',
                    border: 'none',
                    color: '#fff',
                    fontSize: 14,
                    cursor: 'pointer',
                    marginTop: 8,
                  }}
                >
                  {addBrandLoading ? '추가 중...' : '브랜드 추가'}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* 통합 허브 콘텐츠 */}
      <BrandHubContent
        brandId={brandId}
        brandName={brandName}
        activeBrandId={activeBrandId}
        authId={authId}
        isCEO={isCEO}
        loginRole={loginRole}
        rows={rows}
        tab={tab}
        onTabChange={setTab}
        onEdit={(p) => setEditProduct(p as { id: string })}
        onNew={() => setFormOpen(true)}
      />
    </div>
  )
}
