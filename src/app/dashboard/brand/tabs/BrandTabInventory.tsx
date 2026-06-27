'use client'
import { useState } from 'react'
import dynamic from 'next/dynamic'
const BrandInventoryStock = dynamic(() => import('./BrandInventoryStock'), { ssr: false })
const BrandInventoryLots = dynamic(() => import('./BrandInventoryLots'), { ssr: false })
const BrandInventoryScan = dynamic(() => import('./BrandInventoryScan'), { ssr: false })
const BrandInventoryQR = dynamic(() => import('./BrandInventoryQR'), { ssr: false })
const BrandInventoryClose = dynamic(() => import('./BrandInventoryClose'), { ssr: false })
const BrandInventoryStaff = dynamic(() => import('./BrandInventoryStaff'), { ssr: false })
const PURPLE = '#7B5EA7'
const SUB = 'rgba(255,255,255,0.3)'
const SUBTABS = [
  { key: 'stock', label: '재고현황', icon: '📦' },
  { key: 'lots', label: '로트관리', icon: '🏷' },
  { key: 'scan', label: '스캔입출고', icon: '📲' },
  { key: 'qr', label: 'QR발행', icon: '🔲' },
  { key: 'close', label: '월마감', icon: '📊' },
  { key: 'staff', label: '물류직원', icon: '👥' },
] as const
type SubTab = typeof SUBTABS[number]['key']
interface Props {
  brandId: string | null
  brandName: string
  authId: string | null
}
export default function BrandTabInventory({ brandId, brandName, authId }: Props) {
  const [sub, setSub] = useState<SubTab>('stock')
  return (
    <div>
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
      {sub === 'staff' && <BrandInventoryStaff brandId={brandId} />}
    </div>
  )
}
