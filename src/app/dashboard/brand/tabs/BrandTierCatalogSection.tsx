'use client'
import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
const PURPLE = '#7B5EA7'
const CATALOG_TYPES = ['제품', '기기', '부자재', '기타'] as const
type CatalogItem = {
  id: string
  brand_id: string
  item_name: string
  item_type: string
  shop_price: number
  image_url: string | null
  description: string | null
  is_active: boolean | null
}
type FormState = {
  brand_id: string
  item_name: string
  item_type: string
  shop_price: string
  image_url: string
  description: string
}
const EMPTY_FORM = (defaultBrandId: string): FormState => ({
  brand_id: defaultBrandId,
  item_name: '',
  item_type: '제품',
  shop_price: '',
  image_url: '',
  description: '',
})
type Props = {
  companyId: string | null
  myBrands: { id: string; name: string }[]
}
export default function BrandTierCatalogSection({ companyId, myBrands }: Props) {
  const supabase = createClient()
  const [items, setItems] = useState<CatalogItem[]>([])
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM(myBrands[0]?.id || ''))
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const showToast = (t: string) => {
    setToast(t)
    setTimeout(() => setToast(''), 2500)
  }
  const brandNameById = (id: string) => myBrands.find((b) => b.id === id)?.name || '브랜드'
  const load = useCallback(async () => {
    if (!companyId) return
    setLoading(true)
    try {
      const { data } = await supabase
        .from('brand_tier_catalog_items')
        .select('id, brand_id, item_name, item_type, shop_price, image_url, description, is_active')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
      setItems((data || []) as CatalogItem[])
    } finally {
      setLoading(false)
    }
  }, [companyId, supabase])
  useEffect(() => {
    void load()
  }, [load])
  const openAdd = () => {
    setEditingId(null)
    setForm(EMPTY_FORM(myBrands[0]?.id || ''))
    setFormOpen(true)
  }
  const openEdit = (item: CatalogItem) => {
    setEditingId(item.id)
    setForm({
      brand_id: item.brand_id,
      item_name: item.item_name,
      item_type: item.item_type,
      shop_price: String(Math.trunc(item.shop_price)),
      image_url: item.image_url || '',
      description: item.description || '',
    })
    setFormOpen(true)
  }
  const closeForm = () => {
    setFormOpen(false)
    setEditingId(null)
  }
  const handleUpload = async (file: File) => {
    setUploading(true)
    try {
      const ext = file.name.split('.').pop() || 'png'
      const path = `tier-catalog/${Date.now()}.${ext}`
      const { data, error } = await supabase.storage.from('brand-assets').upload(path, file, { upsert: true })
      if (error || !data) {
        showToast('이미지 업로드 실패')
        return
      }
      const { data: urlData } = supabase.storage.from('brand-assets').getPublicUrl(path)
      setForm((f) => ({ ...f, image_url: urlData.publicUrl }))
    } finally {
      setUploading(false)
    }
  }
  const submit = async () => {
    if (!companyId) return
    const itemName = form.item_name.trim()
    const shopPrice = Math.trunc(Number(form.shop_price.replace(/,/g, '')))
    if (!form.brand_id) {
      showToast('브랜드를 선택해 주세요')
      return
    }
    if (!itemName) {
      showToast('제품명을 입력해 주세요')
      return
    }
    if (!Number.isFinite(shopPrice) || shopPrice < 0) {
      showToast('샵가를 확인해 주세요')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/brand/tier-catalog-items/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          company_id: companyId,
          brand_id: form.brand_id,
          id: editingId || undefined,
          item_name: itemName,
          item_type: form.item_type,
          shop_price: shopPrice,
          image_url: form.image_url,
          description: form.description,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!json?.ok) {
        showToast('저장 실패')
        return
      }
      showToast(editingId ? '수정했어요' : '추가했어요')
      closeForm()
      await load()
    } finally {
      setSaving(false)
    }
  }
  const remove = async (item: CatalogItem) => {
    if (!companyId) return
    if (!window.confirm(`"${item.item_name}" 품목을 삭제할까요?`)) return
    const res = await fetch('/api/brand/tier-catalog-items/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ company_id: companyId, id: item.id }),
    })
    const json = await res.json().catch(() => ({}))
    if (!json?.ok) {
      showToast('삭제 실패')
      return
    }
    showToast('삭제했어요')
    await load()
  }
  const inputStyle = {
    width: '100%',
    padding: '8px 10px',
    borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(0,0,0,0.25)',
    color: '#fff',
    fontSize: 13,
  } as const
  return (
    <div style={{ marginTop: 20 }}>
      {toast && (
        <div style={{ position: 'fixed', top: 14, left: '50%', transform: 'translateX(-50%)', background: PURPLE, color: '#fff', fontSize: 12, padding: '7px 18px', borderRadius: 20, zIndex: 999 }}>
          {toast}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>등급 카탈로그 (제품·기기)</div>
        <button
          type="button"
          onClick={openAdd}
          style={{ fontSize: 12, padding: '6px 12px', borderRadius: 8, border: `1px solid ${PURPLE}`, background: 'transparent', color: '#c4a8f0', cursor: 'pointer' }}
        >
          + 품목 추가
        </button>
      </div>
      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 14 }}>
        원장이 등급구매 시 자율선택할 수 있는 제품·기기 목록이에요
      </div>
      {formOpen && (
        <div style={{ padding: 14, borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            {form.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.image_url} alt="" style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover' }} />
            ) : (
              <div style={{ width: 48, height: 48, borderRadius: 8, background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>📦</div>
            )}
            <label style={{ fontSize: 12, color: PURPLE, cursor: 'pointer', border: `1px solid ${PURPLE}`, borderRadius: 8, padding: '6px 12px' }}>
              {uploading ? '업로드 중...' : '이미지 선택'}
              <input type="file" accept="image/*" disabled={uploading} onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleUpload(f) }} style={{ display: 'none' }} />
            </label>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
            <label style={{ flex: '1 1 140px' }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: 4 }}>브랜드</div>
              <select value={form.brand_id} onChange={(e) => setForm((f) => ({ ...f, brand_id: e.target.value }))} style={inputStyle}>
                {myBrands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </label>
            <label style={{ flex: '1 1 100px' }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: 4 }}>종류</div>
              <select value={form.item_type} onChange={(e) => setForm((f) => ({ ...f, item_type: e.target.value }))} style={inputStyle}>
                {CATALOG_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
          </div>
          <label style={{ display: 'block', marginBottom: 8 }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: 4 }}>제품명</div>
            <input type="text" value={form.item_name} onChange={(e) => setForm((f) => ({ ...f, item_name: e.target.value }))} style={inputStyle} />
          </label>
          <label style={{ display: 'block', marginBottom: 8 }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: 4 }}>샵가(원)</div>
            <input
              type="text"
              inputMode="numeric"
              value={form.shop_price}
              onChange={(e) => setForm((f) => ({ ...f, shop_price: e.target.value.replace(/[^\d]/g, '') }))}
              style={{ ...inputStyle, fontFamily: "'JetBrains Mono', monospace" }}
            />
          </label>
          <label style={{ display: 'block', marginBottom: 12 }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: 4 }}>설명(선택)</div>
            <input type="text" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} style={inputStyle} />
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={closeForm} disabled={saving} style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: 'transparent', color: 'rgba(255,255,255,0.5)', fontSize: 12, cursor: 'pointer' }}>취소</button>
            <button type="button" onClick={() => void submit()} disabled={saving} style={{ flex: 2, padding: 10, borderRadius: 8, border: 'none', background: PURPLE, color: '#fff', fontSize: 12, fontWeight: 600, cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.7 : 1 }}>
              {saving ? '저장 중…' : editingId ? '수정 저장' : '추가하기'}
            </button>
          </div>
        </div>
      )}
      {loading ? (
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>불러오는 중…</div>
      ) : items.length === 0 ? (
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>등록된 카탈로그 품목이 없어요</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {items.map((item) => (
            <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.03)' }}>
              {item.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.image_url} alt="" style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
              ) : (
                <div style={{ width: 36, height: 36, borderRadius: 6, background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>📦</div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: '#fff' }}>{item.item_name}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>
                  {brandNameById(item.brand_id)} · {item.item_type}
                </div>
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>{Math.trunc(item.shop_price).toLocaleString()}원</div>
              <button type="button" onClick={() => openEdit(item)} style={{ padding: '4px 8px', borderRadius: 6, border: 'none', background: 'transparent', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 12 }}>수정</button>
              <button type="button" onClick={() => void remove(item)} style={{ padding: '4px 8px', borderRadius: 6, border: 'none', background: 'transparent', color: '#e88', cursor: 'pointer', fontSize: 12 }}>삭제</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
