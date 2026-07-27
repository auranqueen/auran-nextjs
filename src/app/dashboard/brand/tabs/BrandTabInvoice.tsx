'use client'
import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import TabBrandSelector from '../components/TabBrandSelector'
interface InvoiceSettings {
  logo_name: string
  brand_sub: string
  address: string
  manager: string
  tel: string
  email: string
  greeting: string
  stamp_text: string
  corp_name: string
  biz_no: string
  ceo_name: string
}
interface Props {
  myBrands: { id: string; name: string }[]
  staffRole: string | null
}
const DEFAULT_SETTINGS: InvoiceSettings = {
  logo_name: '',
  brand_sub: '',
  address: '',
  manager: '',
  tel: '',
  email: '',
  greeting: '항상 저희 제품을 이용해 주셔서 감사합니다.\n제품 수령 후 수량을 확인해 주시고,\n문의사항은 언제든지 연락 주세요.',
  stamp_text: '확인',
  corp_name: '',
  biz_no: '',
  ceo_name: '',
}
const PURPLE = '#7B5EA7'
export default function BrandTabInvoice({ myBrands, staffRole }: Props) {
  const canManageLogo = staffRole === 'ceo' || staffRole === 'director' || staffRole === 'manager'
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null)
  const brandId = selectedBrandId
  const brandName = myBrands.find((b) => b.id === brandId)?.name || ''
  const supabase = createClient()
  const [settings, setSettings] = useState<InvoiceSettings>({ ...DEFAULT_SETTINGS, logo_name: brandName })
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [brandLogoUrl, setBrandLogoUrl] = useState('')
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [companyLogoUrl, setCompanyLogoUrl] = useState('')
  const [uploadingBrandLogo, setUploadingBrandLogo] = useState(false)
  const [uploadingCompanyLogo, setUploadingCompanyLogo] = useState(false)
  const showToast = (t: string) => { setToast(t); setTimeout(() => setToast(''), 2500) }
  const loadSettings = useCallback(async () => {
    if (!brandId) return
    const { data } = await supabase
      .from('brands')
      .select('invoice_settings, name, logo_url, company_id')
      .eq('id', brandId)
      .maybeSingle()
    if (data) {
      const s = (data.invoice_settings as Partial<InvoiceSettings>) || {}
      setSettings({
        logo_name: s.logo_name || data.name || brandName,
        brand_sub: s.brand_sub || '',
        address: s.address || '',
        manager: s.manager || '',
        tel: s.tel || '',
        email: s.email || '',
        greeting: s.greeting || DEFAULT_SETTINGS.greeting,
        stamp_text: s.stamp_text || data.name || brandName,
        corp_name: s.corp_name || '',
        biz_no: s.biz_no || '',
        ceo_name: s.ceo_name || '',
      })
      setBrandLogoUrl(data.logo_url || '')
      const cid = data.company_id ? String(data.company_id) : null
      setCompanyId(cid)
      if (cid) {
        const { data: companyRow } = await supabase
          .from('brand_companies')
          .select('logo_url')
          .eq('id', cid)
          .maybeSingle()
        setCompanyLogoUrl(companyRow?.logo_url || '')
      } else {
        setCompanyLogoUrl('')
      }
    }
  }, [brandId, brandName])
  useEffect(() => {
    void loadSettings()
  }, [loadSettings])
  const saveSettings = async () => {
    if (!brandId) return
    setSaving(true)
    const { error } = await supabase
      .from('brands')
      .update({ invoice_settings: settings })
      .eq('id', brandId)
    if (!error) showToast('설정 저장 완료!')
    else showToast('저장 실패: ' + error.message)
    setSaving(false)
  }
  const uploadBrandLogo = async (file: File) => {
    if (!brandId) return
    setUploadingBrandLogo(true)
    try {
      const ext = file.name.split('.').pop() || 'png'
      const path = `brand-logos/${Date.now()}.${ext}`
      const { data, error } = await supabase.storage.from('brand-assets').upload(path, file, { upsert: true })
      if (error || !data) { showToast('로고 업로드 실패'); return }
      const { data: urlData } = supabase.storage.from('brand-assets').getPublicUrl(path)
      const { error: updateErr } = await supabase.from('brands').update({ logo_url: urlData.publicUrl }).eq('id', brandId)
      if (updateErr) { showToast('로고 저장 실패'); return }
      setBrandLogoUrl(urlData.publicUrl)
      showToast('브랜드 로고 저장됐어요')
    } finally {
      setUploadingBrandLogo(false)
    }
  }
  const uploadCompanyLogo = async (file: File) => {
    if (!companyId) { showToast('소속 회사 정보가 없어요'); return }
    setUploadingCompanyLogo(true)
    try {
      const ext = file.name.split('.').pop() || 'png'
      const path = `company-logos/${Date.now()}.${ext}`
      const { data, error } = await supabase.storage.from('brand-assets').upload(path, file, { upsert: true })
      if (error || !data) { showToast('로고 업로드 실패'); return }
      const { data: urlData } = supabase.storage.from('brand-assets').getPublicUrl(path)
      const { error: updateErr } = await supabase.from('brand_companies').update({ logo_url: urlData.publicUrl }).eq('id', companyId)
      if (updateErr) { showToast('회사 로고 저장 실패'); return }
      setCompanyLogoUrl(urlData.publicUrl)
      showToast('회사 로고 저장됐어요')
    } finally {
      setUploadingCompanyLogo(false)
    }
  }
  const SUB_COLOR = 'rgba(255,255,255,0.3)'
  const TEXT_COLOR = 'rgba(255,255,255,0.65)'
  const CARD_STYLE = { background: '#1a1520', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 14, marginBottom: 10 }
  const INPUT_STYLE = { width: '100%', background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 7, padding: '8px 10px', fontSize: 12, color: TEXT_COLOR, outline: 'none' }
  return (
    <div>
      <TabBrandSelector myBrands={myBrands} storageKey="invoice-brand" onSelect={setSelectedBrandId} />
      {!selectedBrandId ? (
        <div style={{ textAlign: 'center', padding: 24, color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>브랜드 선택 중…</div>
      ) : (
      <>
      {toast && (
        <div style={{ position: 'fixed', top: 14, left: '50%', transform: 'translateX(-50%)', background: PURPLE, color: '#fff', fontSize: 12, padding: '7px 18px', borderRadius: 20, zIndex: 999, whiteSpace: 'nowrap' }}>{toast}</div>
      )}
      {canManageLogo && (
        <div style={CARD_STYLE}>
          <div style={{ fontSize: 12, color: SUB_COLOR, marginBottom: 14 }}>로고 관리 (관리자 전용)</div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: SUB_COLOR, marginBottom: 6 }}>서브브랜드 로고 ({brandName})</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {brandLogoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={brandLogoUrl} alt="" style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover' }} />
              ) : (
                <div style={{ width: 44, height: 44, borderRadius: 8, background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🏭</div>
              )}
              <label style={{ fontSize: 12, color: PURPLE, cursor: 'pointer', border: `1px solid ${PURPLE}`, borderRadius: 8, padding: '6px 12px' }}>
                {uploadingBrandLogo ? '업로드 중...' : '이미지 선택'}
                <input type="file" accept="image/*" disabled={uploadingBrandLogo}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadBrandLogo(f) }}
                  style={{ display: 'none' }} />
              </label>
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: SUB_COLOR, marginBottom: 6 }}>회사 전체 로그인화면 로고</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {companyLogoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={companyLogoUrl} alt="" style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover' }} />
              ) : (
                <div style={{ width: 44, height: 44, borderRadius: 8, background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🏢</div>
              )}
              <label style={{ fontSize: 12, color: companyId ? PURPLE : SUB_COLOR, cursor: companyId ? 'pointer' : 'not-allowed', border: `1px solid ${companyId ? PURPLE : SUB_COLOR}`, borderRadius: 8, padding: '6px 12px' }}>
                {uploadingCompanyLogo ? '업로드 중...' : '이미지 선택'}
                <input type="file" accept="image/*" disabled={uploadingCompanyLogo || !companyId}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadCompanyLogo(f) }}
                  style={{ display: 'none' }} />
              </label>
            </div>
            {!companyId && <div style={{ fontSize: 10, color: SUB_COLOR, marginTop: 6 }}>이 브랜드는 소속 회사 정보가 없어요</div>}
          </div>
        </div>
      )}
      <div style={CARD_STYLE}>
        <div style={{ fontSize: 12, color: SUB_COLOR, marginBottom: 14 }}>발행/명세서에 표시될 브랜드 정보 (팝빌 연동 예정)</div>
        {([
          { label: '로고 표시명', key: 'logo_name', placeholder: '예: CIVASAN' },
          { label: '브랜드 소개', key: 'brand_sub', placeholder: '예: 시바산 코리아 · 에스테틱 전문 브랜드' },
          { label: '상호(법인명)', key: 'corp_name', placeholder: '예: 주식회사 시바산코리아' },
          { label: '사업자등록번호', key: 'biz_no', placeholder: '000-00-00000' },
          { label: '대표자명', key: 'ceo_name', placeholder: '홍길동' },
          { label: '주소', key: 'address', placeholder: '서울시 강남구 ...' },
          { label: '담당자', key: 'manager', placeholder: '홍길동' },
          { label: '연락처', key: 'tel', placeholder: '02-0000-0000' },
          { label: '이메일', key: 'email', placeholder: 'brand@example.com' },
          { label: '도장 문구', key: 'stamp_text', placeholder: '브랜드명 확인' },
        ] as const).map(f => (
          <div key={f.key} style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: SUB_COLOR, marginBottom: 4 }}>{f.label}</div>
            <input
              value={settings[f.key]}
              onChange={e => setSettings(prev => ({ ...prev, [f.key]: e.target.value }))}
              placeholder={f.placeholder}
              style={INPUT_STYLE}
            />
          </div>
        ))}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: SUB_COLOR, marginBottom: 4 }}>인사말</div>
          <textarea
            value={settings.greeting}
            onChange={e => setSettings(prev => ({ ...prev, greeting: e.target.value }))}
            placeholder="원장님께 전할 인사말"
            rows={4}
            style={{ ...INPUT_STYLE, resize: 'none' as const }}
          />
        </div>
        <button type="button" onClick={saveSettings} disabled={saving}
          style={{ width: '100%', padding: '10px', borderRadius: 8, border: 'none', background: saving ? 'rgba(123,94,167,0.4)' : PURPLE, color: '#fff', fontSize: 13, cursor: saving ? 'not-allowed' : 'pointer' }}>
          {saving ? '저장 중...' : '저장하기'}
        </button>
      </div>
      </>
      )}
    </div>
  )
}
