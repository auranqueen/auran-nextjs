'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import DashboardBottomNav from '@/components/DashboardBottomNav'
import { getOwnerLinkedBrandIds } from '@/lib/brand/getOwnerLinkedBrandIds'
const BG = '#ffffff'
const PURPLE = '#7B5EA7'
const BORDER = '#ede9f7'
const TEXT = '#1A1A2E'
const SUB = '#888888'
const LIGHT = '#f8f7fc'
const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  requested: { label: '신청완료', color: '#A07830', bg: '#FBF5E8' },
  approved: { label: '승인됨', color: '#185FA5', bg: '#E6F1FB' },
  received: { label: '수령완료', color: '#3B6D11', bg: '#EAF3DE' },
  rejected: { label: '반려됨', color: '#A32D2D', bg: '#FCEBEB' },
}
interface ReturnRow {
  id: string
  product_name: string
  quantity: number
  reason: string
  status: string
  rtn_code: string
  created_at: string
  brands: { name: string }
}
export default function BrandReturnsPage() {
  const router = useRouter()
  const supabase = createClient()
  const [returns, setReturns] = useState<ReturnRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ brand_id: '', product_name: '', quantity: 1, reason: '' })
  const [brands, setBrands] = useState<{ id: string; name: string }[]>([])
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  useEffect(() => {
    const fetch = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login?role=owner'); return }
      const { data: profile } = await supabase
        .from('profiles').select('id').eq('auth_id', user.id).maybeSingle()
      const brandIds = await getOwnerLinkedBrandIds(supabase, user.id)
      if (brandIds.length > 0) {
        const { data: brandRows } = await supabase.from('brands').select('id, name').in('id', brandIds)
        setBrands(brandRows || [])
        if (profile?.id) {
          const { data } = await supabase
            .from('brand_returns')
            .select('id, product_name, quantity, reason, status, rtn_code, created_at, brands(name)')
            .in('brand_id', brandIds)
            .eq('requester_id', profile.id)
            .order('created_at', { ascending: false })
          setReturns((data || []) as any[])
        }
      }
      setLoading(false)
    }
    void fetch()
  }, [])
  const submit = async () => {
    if (!form.brand_id || !form.product_name || !form.reason) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.replace('/login?role=owner'); return }
    const { data: profile } = await supabase.from('profiles').select('id').eq('auth_id', user.id).maybeSingle()
    const { error } = await supabase.from('brand_returns').insert({
      brand_id: form.brand_id,
      product_name: form.product_name,
      quantity: form.quantity,
      reason: form.reason,
      status: 'requested',
      requester_id: profile?.id,
    })
    if (!error) {
      setToast('반품 신청이 완료됐어요')
      setShowForm(false)
      setForm({ brand_id: '', product_name: '', quantity: 1, reason: '' })
      setTimeout(() => setToast(''), 2500)
      router.refresh()
    }
    setSaving(false)
  }
  return (
    <div style={{ background: BG, minHeight: '100vh', paddingBottom: 80 }}>
      <div style={{ padding: '16px 16px 0', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <button type="button" onClick={() => router.back()}
          style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: TEXT, padding: 0 }}>←</button>
        <div style={{ fontSize: 16, fontWeight: 500, color: TEXT }}>반품 신청</div>
      </div>
      {toast && (
        <div style={{ position: 'fixed' as const, top: 60, left: '50%', transform: 'translateX(-50%)', background: PURPLE, color: '#fff', padding: '8px 20px', borderRadius: 20, fontSize: 12, zIndex: 999 }}>{toast}</div>
      )}
      <div style={{ padding: '0 16px' }}>
        <button type="button" onClick={() => setShowForm(!showForm)}
          style={{ width: '100%', padding: '12px', borderRadius: 10, border: `1px solid ${PURPLE}`, background: showForm ? PURPLE : 'transparent', color: showForm ? '#fff' : PURPLE, fontSize: 13, cursor: 'pointer', marginBottom: 14 }}>
          {showForm ? '× 취소' : '+ 반품 신청하기'}
        </button>
        {showForm && (
          <div style={{ background: LIGHT, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 14, marginBottom: 14 }}>
            <select value={form.brand_id} onChange={e => setForm(f => ({ ...f, brand_id: e.target.value }))}
              style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${BORDER}`, background: '#fff', color: TEXT, fontSize: 12, marginBottom: 8 }}>
              <option value="">브랜드 선택</option>
              {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <input value={form.product_name} onChange={e => setForm(f => ({ ...f, product_name: e.target.value }))}
              placeholder="제품명" style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${BORDER}`, background: '#fff', color: TEXT, fontSize: 12, marginBottom: 8 }} />
            <input type="number" value={form.quantity} min={1} onChange={e => setForm(f => ({ ...f, quantity: Number(e.target.value) }))}
              placeholder="수량" style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${BORDER}`, background: '#fff', color: TEXT, fontSize: 12, marginBottom: 8 }} />
            <textarea value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
              placeholder="반품 사유" rows={3}
              style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${BORDER}`, background: '#fff', color: TEXT, fontSize: 12, marginBottom: 8, resize: 'none' as const }} />
            <button type="button" onClick={submit} disabled={saving}
              style={{ width: '100%', padding: '10px', borderRadius: 8, border: 'none', background: PURPLE, color: '#fff', fontSize: 13, cursor: 'pointer' }}>
              {saving ? '신청 중...' : '신청 완료'}
            </button>
          </div>
        )}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: SUB, fontSize: 13 }}>불러오는 중...</div>
        ) : returns.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: SUB, fontSize: 13 }}>반품 내역이 없어요</div>
        ) : returns.map((r) => {
          const st = STATUS_MAP[r.status] || STATUS_MAP['requested']
          return (
            <div key={r.id} style={{ background: LIGHT, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 14, marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 6, background: st.bg, color: st.color }}>{st.label}</span>
                <span style={{ fontSize: 11, color: SUB }}>{r.brands?.name}</span>
                {r.rtn_code && <span style={{ fontSize: 10, color: PURPLE, marginLeft: 'auto' }}>RTN: {r.rtn_code}</span>}
              </div>
              <div style={{ fontSize: 13, color: TEXT, marginBottom: 4 }}>{r.product_name} · {r.quantity}개</div>
              <div style={{ fontSize: 11, color: SUB }}>{r.reason}</div>
              <div style={{ fontSize: 10, color: SUB, marginTop: 4 }}>{new Date(r.created_at).toLocaleDateString('ko-KR')}</div>
            </div>
          )
        })}
      </div>
      <DashboardBottomNav role="owner" />
    </div>
  )
}
