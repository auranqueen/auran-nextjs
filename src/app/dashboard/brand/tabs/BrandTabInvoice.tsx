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
}
interface Props {
  myBrands: { id: string; name: string }[]
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
}
const PURPLE = '#7B5EA7'
export default function BrandTabInvoice({ myBrands }: Props) {
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null)
  const brandId = selectedBrandId
  const brandName = myBrands.find((b) => b.id === brandId)?.name || ''
  const supabase = createClient()
  const [settings, setSettings] = useState<InvoiceSettings>({ ...DEFAULT_SETTINGS, logo_name: brandName })
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const showToast = (t: string) => { setToast(t); setTimeout(() => setToast(''), 2500) }
  const loadSettings = useCallback(async () => {
    if (!brandId) return
    const { data } = await supabase
      .from('brands')
      .select('invoice_settings, name')
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
      })
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
      <div style={CARD_STYLE}>
        <div style={{ fontSize: 12, color: SUB_COLOR, marginBottom: 14 }}>발행/명세서에 표시될 브랜드 정보 (팝빌 연동 예정)</div>
        {([
          { label: '로고 표시명', key: 'logo_name', placeholder: '예: CIVASAN' },
          { label: '브랜드 소개', key: 'brand_sub', placeholder: '예: 시바산 코리아 · 에스테틱 전문 브랜드' },
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