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
export default function BrandHubContent({
  brandId, brandName, activeBrandId, authId, isCEO, loginRole,
  rows, tab, onTabChange, onEdit, onNew
}: Props) {
  const [mainTab, setMainTab] = useState<MainTab>('home')
  const [systemMode, setSystemMode] = useState<SystemMode>('brand')
  const [logiTab, setLogiTab] = useState<LogiTab>('stock')
  const LOGI_TABS = [
    { key: 'stock',     label: '재고현황',   icon: '📦' },
    { key: 'lots',      label: '로트관리',   icon: '🏷' },
    { key: 'scan',      label: '스캔입출고', icon: '📲' },
    { key: 'qr',        label: 'QR발행',    icon: '🔲' },
    { key: 'emergency', label: '비상출고',   icon: '🚨' },
  ] as const
  const SB_SECTIONS = [
    {
      label: '실시간',
      items: [
        { key: 'home', label: '홈 대시보드', icon: 'ti-home' },
        { key: 'orentalk', label: '오렌상담톡', icon: 'ti-message-circle', alert: true },
        { key: 'orders', label: '주문·정산', icon: 'ti-shopping-cart', alert: true },
        { key: 'inventory', label: '재고·물류', icon: 'ti-box', alert: true },
        { key: 'sample', label: '샘플 발송', icon: 'ti-gift' },
      ],
    },
    {
      label: '마케팅',
      items: [
        { key: 'live', label: '이벤트·라이브', icon: 'ti-speakerphone' },
        { key: 'community', label: '커뮤니티', icon: 'ti-users' },
        { key: 'data', label: '피부 데이터', icon: 'ti-chart-pie' },
      ],
    },
    {
      label: '제품·파트너',
      items: [
        { key: 'products', label: '제품 관리', icon: 'ti-package' },
        { key: 'owners', label: '원장님 현황', icon: 'ti-building-store' },
        { key: 'expand', label: '입점 확장', icon: 'ti-arrow-bar-up' },
      ],
    },
    {
      label: '정산·운영',
      items: [
        { key: 'report', label: '월별 리포트', icon: 'ti-report' },
        { key: 'invoice', label: '세금계산서', icon: 'ti-receipt' },
        { key: 'returns', label: '반품 관리', icon: 'ti-rotate' },
        ...(isCEO ? [{ key: 'settlement', label: '정산', icon: 'ti-coin' }] : []),
      ],
    },
  ] as const
  return (
    <div style={{ display: 'flex', height: '100vh', background: '#0a0908', overflow: 'hidden' }}>
      {/* 사이드바 */}
      <div style={{ width: 188, flexShrink: 0, background: '#0d0b0a', borderRight: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        {/* 브랜드명 */}
        <div style={{ padding: '14px 14px 10px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ fontSize: 10, color: '#C9A96E', letterSpacing: 4, marginBottom: 3 }}>AURAN</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>{brandName}</div>
          {/* 브랜드/물류 모드 전환 — CEO/이사만 */}
          {(isCEO || loginRole === 'director') && (
            <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
              <button type="button" onClick={() => setSystemMode('brand')}
                style={{ flex: 1, padding: '4px 0', fontSize: 10, borderRadius: 5, border: 'none', cursor: 'pointer', background: systemMode === 'brand' ? 'rgba(123,94,167,0.3)' : 'rgba(255,255,255,0.05)', color: systemMode === 'brand' ? '#c4a8f0' : 'rgba(255,255,255,0.3)' }}>
                브랜드
              </button>
              <button type="button" onClick={() => setSystemMode('logi')}
                style={{ flex: 1, padding: '4px 0', fontSize: 10, borderRadius: 5, border: 'none', cursor: 'pointer', background: systemMode === 'logi' ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.05)', color: systemMode === 'logi' ? '#93c5fd' : 'rgba(255,255,255,0.3)' }}>
                물류팀
              </button>
            </div>
          )}
        </div>
        {/* 메뉴 */}
        <div style={{ flex: 1, padding: '6px 0' }}>
          {systemMode === 'brand' ? (
            SB_SECTIONS.map(sec => (
              <div key={sec.label}>
                <div style={{ padding: '8px 12px 3px', fontSize: 9, color: 'rgba(255,255,255,0.18)', letterSpacing: '1.5px' }}>{sec.label.toUpperCase()}</div>
                {sec.items.map((item: { key: string; label: string; icon: string; alert?: boolean }) => (
                  <button key={item.key} type="button" onClick={() => setMainTab(item.key as MainTab)}
                    style={{ display: 'flex', alignItems: 'center', gap: 7, width: '100%', padding: '8px 12px', fontSize: 11, border: 'none', background: mainTab === item.key ? 'rgba(123,94,167,0.12)' : 'transparent', color: mainTab === item.key ? '#C9A96E' : 'rgba(255,255,255,0.4)', borderLeft: mainTab === item.key ? '2px solid #7B5EA7' : '2px solid transparent', cursor: 'pointer', textAlign: 'left' as const }}>
                    <i className={`ti ${item.icon}`} style={{ fontSize: 13, width: 14, flexShrink: 0 }} aria-hidden="true" />
                    <span style={{ flex: 1 }}>{item.label}</span>
                    {item.alert && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#e85555', flexShrink: 0 }} />}
                  </button>
                ))}
              </div>
            ))
          ) : (
            <div>
              <div style={{ padding: '8px 12px 3px', fontSize: 9, color: 'rgba(255,255,255,0.18)', letterSpacing: '1.5px' }}>물류팀</div>
              {LOGI_TABS.map(t => (
                <button key={t.key} type="button" onClick={() => setLogiTab(t.key as LogiTab)}
                  style={{ display: 'flex', alignItems: 'center', gap: 7, width: '100%', padding: '8px 12px', fontSize: 11, border: 'none', background: logiTab === t.key ? 'rgba(59,130,246,0.12)' : 'transparent', color: logiTab === t.key ? '#93c5fd' : 'rgba(255,255,255,0.4)', borderLeft: logiTab === t.key ? '2px solid #3b82f6' : '2px solid transparent', cursor: 'pointer', textAlign: 'left' as const }}>
                  <span>{t.icon}</span>
                  <span>{t.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      {/* 메인 콘텐츠 */}
      <div style={{ flex: 1, overflowY: 'auto', minWidth: 0 }}>
        {systemMode === 'logi' ? (
          <div style={{ padding: 16 }}>
            {logiTab === 'stock' && <BrandInventoryStock brandId={brandId} brandName={brandName} authId={null} />}
            {logiTab === 'lots' && <BrandInventoryLots brandId={brandId} />}
            {logiTab === 'scan' && <BrandInventoryScan brandId={brandId} brandName={brandName} />}
            {logiTab === 'qr' && <BrandInventoryQR brandId={brandId} brandName={brandName} />}
            {logiTab === 'emergency' && <BrandInventoryEmergency brandId={brandId} brandName={brandName} />}
          </div>
        ) : (
          <div style={{ padding: 16 }}>
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
          </div>
        )}
      </div>
    </div>
  )
}
