'use client'
import { useCallback, useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import dynamic from 'next/dynamic'
const BrandPinGate = dynamic(() => import('../brand/components/BrandPinGate'), { ssr: false })
const BrandWatermark = dynamic(() => import('../brand/components/BrandWatermark'), { ssr: false })
const BrandInventoryFulfillment = dynamic(() => import('../brand/components/BrandInventoryFulfillment'), { ssr: false })
const BrandInventoryStock = dynamic(() => import('../brand/tabs/BrandInventoryStock'), { ssr: false })
const BrandInventoryLots = dynamic(() => import('../brand/tabs/BrandInventoryLots'), { ssr: false })
const BrandInventoryScan = dynamic(() => import('../brand/tabs/BrandInventoryScan'), { ssr: false })
const BrandInventoryQR = dynamic(() => import('../brand/tabs/BrandInventoryQR'), { ssr: false })
const BrandInventoryEmergency = dynamic(() => import('../brand/tabs/BrandInventoryEmergency'), { ssr: false })
const BrandTabOrders = dynamic(() => import('../brand/tabs/BrandTabOrders'), { ssr: false })
const BLUE = '#2188ff'
const SUB = 'rgba(255,255,255,0.3)'
const TEXT = 'rgba(255,255,255,0.65)'
const OPS_TABS = [
  { key: 'fulfillment', label: '발송 처리', icon: '🚚' },
  { key: 'stock',     label: '재고현황',   icon: '📦' },
  { key: 'lots',      label: '로트관리',   icon: '🏷' },
  { key: 'scan',      label: '스캔입출고', icon: '📲' },
  { key: 'qr',        label: 'QR발행',    icon: '🔲' },
  { key: 'orders',    label: '오늘출고',   icon: '🚛' },
  { key: 'emergency', label: '비상출고',   icon: '🚨' },
] as const
type OpsTab = typeof OPS_TABS[number]['key']
const ROLE_MAP: Record<string, string> = {
  ops_manager: '물류팀장',
  ops_staff: '물류직원',
  ceo: '대표',
  director: '이사',
}
function LogiDashboardInner() {
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const slug = searchParams.get('slug') || ''
  const [brandId, setBrandId] = useState<string | null>(null)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [brandName, setBrandName] = useState('')
  const [authLoading, setAuthLoading] = useState(true)
  const [tab, setTab] = useState<OpsTab>('fulfillment')
  const [pinAuth, setPinAuth] = useState<{
    id: string; name: string; role: string; permissions: string[]
  } | null>(null)
  const loadBrand = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.replace(`/logi/${slug}`); return }
    const { data: brand } = await supabase
      .from('brands')
      .select('id, name, brand_name_kr, company_id')
      .eq('user_id', user.id)
      .maybeSingle()
    if (!brand) { router.replace(`/logi/${slug || 'civasan'}`); return }
    setBrandId(brand.id)
    setCompanyId(brand.company_id ?? null)
    setBrandName((brand as { brand_name_kr?: string | null }).brand_name_kr || brand.name)
    setAuthLoading(false)
  }, [slug])
  useEffect(() => { void loadBrand() }, [loadBrand])
  if (authLoading) return (
    <div style={{ minHeight: '100vh', background: '#0d1117', display: 'flex', alignItems: 'center', justifyContent: 'center', color: SUB, fontSize: 14 }}>
      로딩 중...
    </div>
  )
  if (!pinAuth && brandId) {
    return (
      <BrandPinGate
        brandId={brandId}
        companyId={companyId}
        brandName={`${brandName} 물류 허브`}
        hub="logi"
        onAuth={(staff) => {
          if (!['ops_manager', 'ops_staff', 'ceo', 'director'].includes(staff.role)) {
            alert('물류 허브 접근 권한이 없어요.\nBrand Hub를 이용해주세요.\nauran.kr/brand/' + slug)
            return
          }
          setPinAuth(staff)
        }}
      />
    )
  }
  return (
    <div style={{ minHeight: '100vh', background: '#0d1117', paddingBottom: 60 }}>
      {pinAuth && <BrandWatermark staffName={pinAuth.name} staffRole={ROLE_MAP[pinAuth.role] || pinAuth.role} />}
      {/* 헤더 */}
      <div style={{ background: '#161b22', borderBottom: '0.5px solid rgba(255,255,255,0.07)', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 500, color: TEXT }}>{brandName} 물류 허브</div>
          <div style={{ fontSize: 11, color: SUB }}>
            {pinAuth?.name} · {ROLE_MAP[pinAuth?.role || ''] || pinAuth?.role}
          </div>
        </div>
        <div style={{ fontSize: 11, padding: '4px 10px', borderRadius: 10, background: `${BLUE}20`, color: BLUE }}>
          🚛 물류 허브
        </div>
      </div>
      {/* 탭 네비 */}
      <div style={{ display: 'flex', overflowX: 'auto' as const, borderBottom: '0.5px solid rgba(255,255,255,0.07)', background: '#161b22', position: 'sticky', top: 49, zIndex: 99 }}>
        {OPS_TABS.map(t => (
          <button key={t.key} type="button" onClick={() => setTab(t.key)}
            style={{ flexShrink: 0, padding: '10px 14px', fontSize: 12, border: 'none', background: 'transparent', color: tab === t.key ? '#fff' : SUB, borderBottom: tab === t.key ? `2px solid ${BLUE}` : '2px solid transparent', cursor: 'pointer', whiteSpace: 'nowrap' as const }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>
      {/* 탭 콘텐츠 */}
      <div style={{ padding: 16 }}>
        {tab === 'fulfillment' && <BrandInventoryFulfillment brandId={brandId} brandName={brandName} />}
        {tab === 'stock'     && <BrandInventoryStock brandId={brandId} brandName={brandName} authId={null} />}
        {tab === 'lots'      && <BrandInventoryLots brandId={brandId} />}
        {tab === 'scan'      && <BrandInventoryScan brandId={brandId} brandName={brandName} />}
        {tab === 'qr'        && <BrandInventoryQR brandId={brandId} brandName={brandName} />}
        {tab === 'orders'    && brandId && (
          <BrandTabOrders myBrands={[{ id: brandId, name: brandName }]} />
        )}
        {tab === 'emergency' && <BrandInventoryEmergency brandId={brandId} brandName={brandName} />}
      </div>
    </div>
  )
}
export default function LogiDashboard() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: '#0d1117', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>
        로딩 중...
      </div>
    }>
      <LogiDashboardInner />
    </Suspense>
  )
}
