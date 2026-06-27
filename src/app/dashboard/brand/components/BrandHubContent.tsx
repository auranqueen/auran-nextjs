'use client'
import dynamic from 'next/dynamic'
import { useState } from 'react'
const BrandTabHome = dynamic(() => import('../tabs/BrandTabHome'), { ssr: false })
const BrandTabProducts = dynamic(() => import('../tabs/BrandTabProducts'), { ssr: false })
const BrandTabOwners = dynamic(() => import('../tabs/BrandTabOwners'), { ssr: false })
const BrandTabOrders = dynamic(() => import('../tabs/BrandTabOrders'), { ssr: false })
const BrandTabOrenTalk = dynamic(() => import('../tabs/BrandTabOrenTalk'), { ssr: false })
const BrandTabLive = dynamic(() => import('../tabs/BrandTabLive'), { ssr: false })
const BrandTabSample = dynamic(() => import('../tabs/BrandTabSample'), { ssr: false })
const BrandTabCommunity = dynamic(() => import('../tabs/BrandTabCommunity'), { ssr: false })
const BrandTabExpand = dynamic(() => import('../tabs/BrandTabExpand'), { ssr: false })
const BrandTabData = dynamic(() => import('../tabs/BrandTabData'), { ssr: false })
const BrandTabInvoice = dynamic(() => import('../tabs/BrandTabInvoice'), { ssr: false })
const BrandTabInventory = dynamic(() => import('../tabs/BrandTabInventory'), { ssr: false })
const BrandTabReport = dynamic(() => import('../tabs/BrandTabReport'), { ssr: false })
const BrandTabReturns = dynamic(() => import('../tabs/BrandTabReturns'), { ssr: false })
const BrandInventoryStock = dynamic(() => import('../tabs/BrandInventoryStock'), { ssr: false })
const BrandInventoryLots = dynamic(() => import('../tabs/BrandInventoryLots'), { ssr: false })
const BrandInventoryScan = dynamic(() => import('../tabs/BrandInventoryScan'), { ssr: false })
const BrandInventoryQR = dynamic(() => import('../tabs/BrandInventoryQR'), { ssr: false })
const BrandInventoryEmergency = dynamic(() => import('../tabs/BrandInventoryEmergency'), { ssr: false })
type MainTab = 'home' | 'products' | 'owners' | 'orders' | 'orentalk' | 'live' | 'sample' | 'community' | 'expand' | 'data' | 'invoice' | 'inventory' | 'report' | 'returns' | 'settlement'
type LogiTab = 'stock' | 'lots' | 'scan' | 'qr' | 'emergency'
type SystemMode = 'brand' | 'logi'
interface Props {
  brandId: string | null
  brandName: string
  activeBrandId: string | null
  authId: string | null
  isCEO: boolean
  loginRole: string
  rows: Array<Record<string, unknown> & { id: string; name?: string | null; status?: string | null; thumb_img?: string | null }>
  tab: 'pending' | 'active' | 'hidden'
  onTabChange: (t: 'pending' | 'active' | 'hidden') => void
  onEdit: (p: Record<string, unknown>) => void
  onNew: () => void
}
const BLUE = '#2188ff'
const PURPLE = '#7B5EA7'
const SUB = 'rgba(255,255,255,0.3)'
export default function BrandHubContent({
  brandId, brandName, activeBrandId, authId, isCEO, loginRole,
  rows, tab, onTabChange, onEdit, onNew
}: Props) {
  const [mainTab, setMainTab] = useState<MainTab>('home')
  const [systemMode, setSystemMode] = useState<SystemMode>('brand')
  const [logiTab, setLogiTab] = useState<LogiTab>('stock')
  const MAIN_TABS = [
    { key: 'home',      label: '홈',        icon: '🏠' },
    { key: 'products',  label: '제품 관리', icon: '🧴' },
    { key: 'owners',    label: '원장님 관리', icon: '👥' },
    { key: 'orders',    label: '발주',      icon: '📦' },
    { key: 'orentalk',  label: '오렌톡',    icon: '💜' },
    { key: 'live',      label: '교육라이브', icon: '🎓' },
    { key: 'sample',    label: '샘플',      icon: '🎁' },
    { key: 'community', label: '커뮤니티',  icon: '💬' },
    { key: 'expand',    label: '외연확장',  icon: '🌐' },
    { key: 'data',      label: '데이터',    icon: '📊' },
    { key: 'invoice',   label: '주문내역서', icon: '🖨️' },
    { key: 'inventory', label: '재고·물류', icon: '📦' },
    { key: 'report',    label: '대조리포트', icon: '📋' },
    { key: 'returns',   label: '반품·교환', icon: '↩️' },
    ...(isCEO ? [{ key: 'settlement' as const, label: '정산', icon: '💰' }] : []),
  ] as const
  const LOGI_TABS = [
    { key: 'stock',     label: '재고현황',   icon: '📦' },
    { key: 'lots',      label: '로트관리',   icon: '🏷' },
    { key: 'scan',      label: '스캔입출고', icon: '📲' },
    { key: 'qr',        label: 'QR발행',    icon: '🔲' },
    { key: 'emergency', label: '비상출고',   icon: '🚨' },
  ] as const
  return (
    <div>
      {/* 통합 허브 전환 — CEO/이사만 */}
      {(isCEO || loginRole === 'director') && (
        <div style={{ display: 'flex', gap: 0, background: '#0f0d14', borderBottom: '0.5px solid rgba(255,255,255,0.07)', padding: '0 4px', marginBottom: 0 }}>
          <button type="button" onClick={() => setSystemMode('brand')}
            style={{ padding: '8px 18px', fontSize: 12, border: 'none', background: 'transparent', color: systemMode === 'brand' ? '#c4a7e7' : SUB, borderBottom: systemMode === 'brand' ? `2px solid ${PURPLE}` : '2px solid transparent', cursor: 'pointer' }}>
            🏢 Brand Hub
          </button>
          <button type="button" onClick={() => setSystemMode('logi')}
            style={{ padding: '8px 18px', fontSize: 12, border: 'none', background: 'transparent', color: systemMode === 'logi' ? BLUE : SUB, borderBottom: systemMode === 'logi' ? `2px solid ${BLUE}` : '2px solid transparent', cursor: 'pointer' }}>
            🚛 물류 허브
          </button>
        </div>
      )}
      {/* 물류 허브 뷰 */}
      {systemMode === 'logi' && (
        <div>
          <div style={{ display: 'flex', overflowX: 'auto' as const, borderBottom: '0.5px solid rgba(255,255,255,0.07)', background: '#161b22' }}>
            {LOGI_TABS.map(t => (
              <button key={t.key} type="button" onClick={() => setLogiTab(t.key as LogiTab)}
                style={{ flexShrink: 0, padding: '10px 14px', fontSize: 12, border: 'none', background: 'transparent', color: logiTab === t.key ? '#fff' : SUB, borderBottom: logiTab === t.key ? `2px solid ${BLUE}` : '2px solid transparent', cursor: 'pointer', whiteSpace: 'nowrap' as const }}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>
          <div style={{ padding: 16 }}>
            {logiTab === 'stock'     && <BrandInventoryStock brandId={brandId} brandName={brandName} authId={null} />}
            {logiTab === 'lots'      && <BrandInventoryLots brandId={brandId} />}
            {logiTab === 'scan'      && <BrandInventoryScan brandId={brandId} brandName={brandName} />}
            {logiTab === 'qr'        && <BrandInventoryQR brandId={brandId} brandName={brandName} />}
            {logiTab === 'emergency' && <BrandInventoryEmergency brandId={brandId} brandName={brandName} />}
          </div>
        </div>
      )}
      {/* Brand Hub 탭 네비 */}
      {systemMode === 'brand' && (
        <>
          <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' as const, borderBottom: '0.5px solid rgba(255,255,255,0.07)', paddingBottom: 12 }}>
            {MAIN_TABS.map(t => (
              <button key={t.key} type="button" onClick={() => setMainTab(t.key as MainTab)}
                style={{ fontSize: 12, padding: '5px 14px', borderRadius: 20, border: `0.5px solid ${mainTab === t.key ? PURPLE : 'rgba(255,255,255,0.1)'}`, background: mainTab === t.key ? 'rgba(123,94,167,0.2)' : 'transparent', color: mainTab === t.key ? '#c4a7e7' : SUB, cursor: 'pointer' }}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>
          {/* 탭 콘텐츠 */}
          {mainTab === 'home' && <BrandTabHome brandName={brandName} brandId={brandId} activeBrandId={activeBrandId} onTabChange={(t) => setMainTab(t as MainTab)} />}
          {mainTab === 'products' && <BrandTabProducts rows={rows} tab={tab} onTabChange={onTabChange} onEdit={onEdit} onNew={onNew} />}
          {mainTab === 'owners' && <BrandTabOwners brandId={brandId} brandName={brandName} authId={authId} />}
          {mainTab === 'orders' && <BrandTabOrders brandId={brandId} brandName={brandName} />}
          {mainTab === 'orentalk' && <BrandTabOrenTalk brandName={brandName} brandId={brandId} authId={authId} />}
          {mainTab === 'live' && <BrandTabLive brandId={brandId} brandName={brandName} />}
          {mainTab === 'sample' && <BrandTabSample brandId={brandId} brandName={brandName} />}
          {mainTab === 'community' && <BrandTabCommunity brandId={brandId} brandName={brandName} />}
          {mainTab === 'expand' && <BrandTabExpand brandId={brandId} brandName={brandName} />}
          {mainTab === 'data' && <BrandTabData brandId={brandId} brandName={brandName} />}
          {mainTab === 'invoice' && <BrandTabInvoice brandId={brandId} brandName={brandName} />}
          {mainTab === 'inventory' && <BrandTabInventory brandId={brandId} brandName={brandName} authId={authId} loginRole={loginRole} />}
          {mainTab === 'report' && <BrandTabReport brandId={brandId} brandName={brandName} />}
          {mainTab === 'returns' && <BrandTabReturns brandId={brandId} brandName={brandName} />}
          {mainTab === 'settlement' && isCEO && (
            <div style={{ padding: 20, color: 'rgba(255,255,255,0.3)', textAlign: 'center', fontSize: 13 }}>
              정산 탭 — 준비 중
            </div>
          )}
        </>
      )}
    </div>
  )
}
