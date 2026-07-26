'use client'
import { useState } from 'react'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import TabBrandSelector from '../components/TabBrandSelector'
const BrandInventoryStock = dynamic(() => import('./BrandInventoryStock'), { ssr: false })
const BrandInventoryLots = dynamic(() => import('./BrandInventoryLots'), { ssr: false })
const BrandInventoryScan = dynamic(() => import('./BrandInventoryScan'), { ssr: false })
const BrandInventoryQR = dynamic(() => import('./BrandInventoryQR'), { ssr: false })
const BrandInventoryClose = dynamic(() => import('./BrandInventoryClose'), { ssr: false })
const BrandInventoryStaff = dynamic(() => import('./BrandInventoryStaff'), { ssr: false })
const BrandInventoryEmergency = dynamic(() => import('./BrandInventoryEmergency'), { ssr: false })
const BrandInventoryMarketing = dynamic(() => import('./BrandInventoryMarketing'), { ssr: false })
const PURPLE = '#7B5EA7'
const SUB = 'rgba(255,255,255,0.3)'
const SUBTABS = [
  { key: 'stock', label: '재고현황', icon: '📦' },
  { key: 'lots', label: '로트관리', icon: '🏷' },
  { key: 'scan', label: '스캔입출고', icon: '📲' },
  { key: 'qr', label: 'QR발행', icon: '🔲' },
  { key: 'close', label: '월마감', icon: '📊' },
  { key: 'staff', label: '물류직원', icon: '👥' },
  { key: 'emergency', label: '비상출고', icon: '🚨' },
  { key: 'marketing', label: '마케팅기획', icon: '🎯' },
] as const
type SubTab = typeof SUBTABS[number]['key']
interface Props {
  myBrands: { id: string; name: string; slug?: string | null }[]
  authId: string | null
  loginRole?: string
}
export default function BrandTabInventory({ myBrands, authId, loginRole = 'director' }: Props) {
  const supabase = createClient()
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null)
  const [logiOpening, setLogiOpening] = useState(false)
  const brandId = selectedBrandId
  const brandName = myBrands.find((b) => b.id === brandId)?.name || ''

  const openLogiHub = async () => {
    if (!brandId || logiOpening) return
    setLogiOpening(true)
    try {
      let slug = myBrands.find((b) => b.id === brandId)?.slug
      if (!slug) {
        const { data } = await supabase
          .from('brands')
          .select('slug')
          .eq('id', brandId)
          .maybeSingle()
        slug = data?.slug != null ? String(data.slug) : null
      }
      const href = slug
        ? `/dashboard/logi?slug=${encodeURIComponent(slug)}`
        : '/dashboard/logi'
      window.open(href, '_blank', 'noopener,noreferrer')
    } finally {
      setLogiOpening(false)
    }
  }
  const [sub, setSub] = useState<SubTab>('stock')
  return (
    <div>
      <TabBrandSelector myBrands={myBrands} storageKey="brand-tab-selection" onSelect={setSelectedBrandId} />
      {!selectedBrandId ? (
        <div style={{ textAlign: 'center', padding: 24, color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>브랜드 선택 중…</div>
      ) : (
      <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginBottom: 10 }}>
        <button
          type="button"
          onClick={() => { void openLogiHub() }}
          disabled={logiOpening}
          style={{
            padding: '7px 12px',
            fontSize: 12,
            fontWeight: 600,
            borderRadius: 8,
            border: '1px solid rgba(123,94,167,0.55)',
            background: 'rgba(123,94,167,0.18)',
            color: '#e9e4f1',
            cursor: logiOpening ? 'wait' : 'pointer',
            opacity: logiOpening ? 0.7 : 1,
            whiteSpace: 'nowrap' as const,
          }}
        >
          🚚 물류허브 열기
        </button>
      </div>
      <div style={{ display: 'flex', gap: 0, overflowX: 'auto' as const, marginBottom: 14, borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
        {SUBTABS.map(t => (
          <button key={t.key} type="button" onClick={() => setSub(t.key)}
            style={{ flexShrink: 0, padding: '8px 12px', fontSize: 12, border: 'none', background: 'transparent', color: sub === t.key ? '#c4a7e7' : SUB, borderBottom: sub === t.key ? `2px solid ${PURPLE}` : '2px solid transparent', cursor: 'pointer', whiteSpace: 'nowrap' as const }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>
      {sub === 'stock' && <BrandInventoryStock brandId={brandId} brandName={brandName} authId={authId} />}
      {sub === 'lots' && <BrandInventoryLots brandId={brandId} />}
      {sub === 'scan' && <BrandInventoryScan brandId={brandId} brandName={brandName} />}
      {sub === 'qr' && <BrandInventoryQR brandId={brandId} brandName={brandName} />}
      {sub === 'close' && <BrandInventoryClose brandId={brandId} />}
      {sub === 'staff' && <BrandInventoryStaff brandId={brandId} currentUserRole={loginRole === 'ceo' ? 'ceo' : 'director'} />}
      {sub === 'emergency' && <BrandInventoryEmergency brandId={brandId} brandName={brandName} />}
      {sub === 'marketing' && <BrandInventoryMarketing brandId={brandId} brandName={brandName} />}
      </>
      )}
    </div>
  )
}
