'use client'

import { createClient } from '@/lib/supabase/client'
import { useCallback, useEffect, useState } from 'react'

const ACC = '#7B5EA7'

type CompanyRow = {
  id: string
  name: string
  logo_url: string | null
  payapp_active: boolean
  payapp_user_id: string | null
  payapp_key: string | null
  payapp_linkval: string | null
  created_at: string
  brand_count: number
}

type DetailForm = {
  name: string
  logoUrl: string
  payappActive: boolean
  payappUserId: string
  payappKey: string
  payappLinkval: string
}

const EMPTY_FORM: DetailForm = {
  name: '',
  logoUrl: '',
  payappActive: false,
  payappUserId: '',
  payappKey: '',
  payappLinkval: '',
}

export default function AdminCompaniesPage() {
  const supabase = createClient()
  const [rows, setRows] = useState<CompanyRow[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  const [detailId, setDetailId] = useState<string | null>(null)
  const [form, setForm] = useState<DetailForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  const showToast = (t: string) => {
    setToast(t)
    setTimeout(() => setToast(''), 2500)
  }

  const load = useCallback(async () => {
    setLoading(true)
    const { data: companies } = await supabase
      .from('brand_companies')
      .select('id, name, logo_url, payapp_active, payapp_user_id, payapp_key, payapp_linkval, created_at')
      .order('created_at', { ascending: false })

    const { data: brands } = await supabase.from('brands').select('company_id')
    const countMap: Record<string, number> = {}
    for (const b of brands || []) {
      const cid = (b as { company_id: string | null }).company_id
      if (!cid) continue
      countMap[cid] = (countMap[cid] || 0) + 1
    }

    const merged = (companies || []).map((c) => ({
      ...(c as Omit<CompanyRow, 'brand_count'>),
      brand_count: countMap[(c as { id: string }).id] || 0,
    }))
    setRows(merged as CompanyRow[])
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    void load()
  }, [load])

  const openDetail = (row: CompanyRow) => {
    setDetailId(row.id)
    setForm({
      name: row.name,
      logoUrl: row.logo_url || '',
      payappActive: row.payapp_active,
      payappUserId: row.payapp_user_id || '',
      payappKey: row.payapp_key || '',
      payappLinkval: row.payapp_linkval || '',
    })
  }

  const closeDetail = () => {
    setDetailId(null)
    setForm(EMPTY_FORM)
  }

  const handleLogoUpload = async (file: File) => {
    setUploading(true)
    try {
      const ext = file.name.split('.').pop() || 'png'
      const path = `company-logos/${Date.now()}.${ext}`
      const { data, error } = await supabase.storage.from('brand-assets').upload(path, file, { upsert: true })
      if (error || !data) {
        showToast('로고 업로드 실패')
        return
      }
      const { data: urlData } = supabase.storage.from('brand-assets').getPublicUrl(path)
      setForm((f) => ({ ...f, logoUrl: urlData.publicUrl }))
    } finally {
      setUploading(false)
    }
  }

  const save = async () => {
    if (!detailId) return
    setSaving(true)
    try {
      const { error } = await supabase
        .from('brand_companies')
        .update({
          name: form.name.trim(),
          logo_url: form.logoUrl.trim() || null,
          payapp_active: form.payappActive,
          payapp_user_id: form.payappUserId.trim() || null,
          payapp_key: form.payappKey.trim() || null,
          payapp_linkval: form.payappLinkval.trim() || null,
        })
        .eq('id', detailId)

      if (error) {
        showToast('저장 실패: ' + error.message)
        return
      }
      showToast('저장됐어요')
      closeDetail()
      await load()
    } finally {
      setSaving(false)
    }
  }

  const detailRow = rows.find((r) => r.id === detailId) || null

  return (
    <div style={{ padding: 20 }}>
      {toast && (
        <div
          style={{
            position: 'fixed',
            top: 14,
            left: '50%',
            transform: 'translateX(-50%)',
            background: ACC,
            color: '#fff',
            fontSize: 12,
            padding: '7px 18px',
            borderRadius: 20,
            zIndex: 999,
          }}
        >
          {toast}
        </div>
      )}

      <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>제휴 브랜드사 관리</div>
      <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 16 }}>
        회사(컴퍼니) 단위로 PayApp 결제연동, 로고 관리
      </div>

      {loading ? (
        <div style={{ color: 'var(--text2)', fontSize: 13 }}>불러오는 중...</div>
      ) : rows.length === 0 ? (
        <div style={{ color: 'var(--text2)', fontSize: 13 }}>등록된 제휴 브랜드사가 없어요</div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {rows.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => openDetail(row)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: 14,
                borderRadius: 14,
                border: '1px solid var(--border)',
                background: 'var(--bg2)',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              {row.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={row.logo_url} alt={row.name} style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover' }} />
              ) : (
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 8,
                    background: 'var(--bg3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 18,
                  }}
                >
                  🏢
                </div>
              )}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>{row.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2 }}>
                  소속 브랜드 {row.brand_count}개
                </div>
              </div>
              <div
                style={{
                  fontSize: 11,
                  padding: '4px 10px',
                  borderRadius: 20,
                  border: row.payapp_active ? `1px solid ${ACC}` : '1px solid rgba(217,79,79,0.45)',
                  background: row.payapp_active ? 'rgba(123,94,167,0.12)' : 'rgba(217,79,79,0.12)',
                  color: row.payapp_active ? ACC : '#f0a0a0',
                }}
              >
                {row.payapp_active ? 'PayApp 연동됨' : '미연동(데모)'}
              </div>
            </button>
          ))}
        </div>
      )}

      {detailRow && (
        <div
          role="presentation"
          onClick={(e) => { if (e.target === e.currentTarget) closeDetail() }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            style={{
              width: '100%',
              maxWidth: 420,
              background: 'var(--bg2)',
              borderRadius: 14,
              padding: 22,
              border: '1px solid var(--border)',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{form.name || '회사 정보'}</div>
              <button type="button" onClick={closeDetail} style={{ background: 'none', border: 'none', fontSize: 20, color: 'var(--text2)', cursor: 'pointer' }}>✕</button>
            </div>

            <label style={{ display: 'block', marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 6 }}>회사명</div>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box' }}
              />
            </label>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 6 }}>로고</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {form.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={form.logoUrl} alt="" style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: 48, height: 48, borderRadius: 8, background: 'var(--bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🏢</div>
                )}
                <label style={{ fontSize: 12, color: ACC, cursor: 'pointer', border: `1px solid ${ACC}`, borderRadius: 8, padding: '6px 12px' }}>
                  {uploading ? '업로드 중...' : '이미지 선택'}
                  <input
                    type="file"
                    accept="image/*"
                    disabled={uploading}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleLogoUpload(f) }}
                    style={{ display: 'none' }}
                  />
                </label>
              </div>
            </div>

            <div style={{ height: 1, background: 'var(--border)', margin: '16px 0' }} />

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>PayApp 결제연동</div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text2)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={form.payappActive}
                  onChange={(e) => setForm((f) => ({ ...f, payappActive: e.target.checked }))}
                />
                활성화
              </label>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 12 }}>
              본사가 전달한 PayApp 3키를 입력. 비활성화 상태면 결제는 데모모드(즉시완료)로 처리돼요.
            </div>

            <label style={{ display: 'block', marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 6 }}>userid</div>
              <input
                value={form.payappUserId}
                onChange={(e) => setForm((f) => ({ ...f, payappUserId: e.target.value }))}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box' }}
              />
            </label>
            <label style={{ display: 'block', marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 6 }}>linkkey</div>
              <input
                value={form.payappKey}
                onChange={(e) => setForm((f) => ({ ...f, payappKey: e.target.value }))}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box' }}
              />
            </label>
            <label style={{ display: 'block', marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 6 }}>linkval</div>
              <input
                value={form.payappLinkval}
                onChange={(e) => setForm((f) => ({ ...f, payappLinkval: e.target.value }))}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box' }}
              />
            </label>

            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={closeDetail} disabled={saving} style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--text2)', cursor: 'pointer' }}>취소</button>
              <button type="button" onClick={() => void save()} disabled={saving} style={{ flex: 2, padding: 10, borderRadius: 8, border: 'none', background: ACC, color: '#fff', fontWeight: 600, cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.7 : 1 }}>
                {saving ? '저장 중…' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
