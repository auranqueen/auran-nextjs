'use client'
import dynamic from 'next/dynamic'
import { useState, useMemo, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
const BrandTabHome = dynamic(() => import('../tabs/BrandTabHome'), { ssr: false })
const BrandTabProducts = dynamic(() => import('../tabs/BrandTabProducts'), { ssr: false })
const BrandTabOwners = dynamic(() => import('../tabs/BrandTabOwners'), { ssr: false })
const BrandTabOrders = dynamic(() => import('../tabs/BrandTabOrders'), { ssr: false })
const BrandTabOrenTalk = dynamic(() => import('../tabs/BrandTabOrenTalk'), { ssr: false })
const BrandTabLive = dynamic(() => import('../tabs/BrandTabLive'), { ssr: false })
const BrandTabSample = dynamic(() => import('../tabs/BrandTabSample'), { ssr: false })
const BrandTabCommunity = dynamic(() => import('../tabs/BrandTabCommunity'), { ssr: false })
const BrandTabExpand = dynamic(() => import('../tabs/BrandTabExpand'), { ssr: false })
const BrandTabInvoice = dynamic(() => import('../tabs/BrandTabInvoice'), { ssr: false })
const BrandTabInventory = dynamic(() => import('../tabs/BrandTabInventory'), { ssr: false })
const BrandTabReport = dynamic(() => import('../tabs/BrandTabReport'), { ssr: false })
const BrandTabTierPackages = dynamic(() => import('../tabs/BrandTabTierPackages'), { ssr: false })
const BrandTabSettlement = dynamic(() => import('../tabs/BrandTabSettlement'), { ssr: false })
const BrandInventoryStaff = dynamic(() => import('../tabs/BrandInventoryStaff'), { ssr: false })
const BrandTabAdminAccount = dynamic(() => import('../tabs/BrandTabAdminAccount'), { ssr: false })
const BrandTabSales = dynamic(() => import('../tabs/BrandTabSales'), { ssr: false })
const BrandTabArete = dynamic(() => import('../tabs/BrandTabArete'), { ssr: false })
const BrandTabArchive = dynamic(() => import('../tabs/BrandTabArchive'), { ssr: false })
type MainTab = 'home' | 'products' | 'owners' | 'orders' | 'orentalk' | 'live' | 'sample' | 'community' | 'expand' | 'invoice' | 'inventory' | 'report' | 'returns' | 'settlement' | 'tierPackages' | 'staff' | 'sales' | 'arete' | 'archive'
type BrandOption = { id: string; name: string; role: string; slug?: string | null }
interface Props {
  brandId: string | null
  brandName: string
  myBrands: BrandOption[]
  onBrandChange: (id: string, name: string) => void
  authId: string | null
  isCEO: boolean
  loginRole: string
  staffRole: string | null
  staffId: string | null
  permissions: string[]
  userRole: string | null
  rows: Array<Record<string, unknown> & { id: string; name?: string | null; status?: string | null; thumb_img?: string | null }>
  tab: 'pending' | 'active' | 'hidden'
  onTabChange: (t: 'pending' | 'active' | 'hidden') => void
  onEdit: (p: Record<string, unknown>) => void
  onNew: () => void
}
export default function BrandHubContent({
  brandId, brandName, myBrands, onBrandChange: _onBrandChange, authId, isCEO, loginRole, staffRole, staffId, permissions, userRole,
  rows, tab, onTabChange, onEdit, onNew
}: Props) {
  const supabase = createClient()
  const [mainTab, setMainTab] = useState<MainTab>('home')
  const [mainSub, setMainSub] = useState<string | undefined>(undefined)
  const [helpOpen, setHelpOpen] = useState(false)
  const [companyId, setCompanyId] = useState<string | null>(null)
  useEffect(() => {
    if (!brandId) { setCompanyId(null); return }
    supabase.from('brands').select('company_id').eq('id', brandId).maybeSingle()
      .then(({ data }) => setCompanyId(data?.company_id ?? null))
  }, [brandId])
  const brandOpts = useMemo(() => myBrands.map(({ id, name, slug }) => ({ id, name, slug })), [myBrands])
  const SB_SECTIONS = [
    {
      label: '실시간',
      items: [
        { key: 'home', label: '홈 대시보드', icon: 'ti-home' },
        { key: 'orentalk', label: '오렌상담톡', icon: 'ti-message-circle', alert: true },
        { key: 'sales', label: '판매관리', icon: 'ti-shopping-cart', alert: true },
        { key: 'inventory', label: '재고·물류', icon: 'ti-box', alert: true },
      ],
    },
    {
      label: '마케팅',
      items: [
        { key: 'live', label: '이벤트·라이브', icon: 'ti-speakerphone' },
        { key: 'community', label: '커뮤니티', icon: 'ti-users' },
        { key: 'archive', label: '에듀케이션/자료관리', icon: 'ti-book' },
      ],
    },
    {
      label: '제품·파트너',
      items: [
        { key: 'products', label: '제품 관리', icon: 'ti-package' },
        { key: 'tierPackages', label: '등급·이벤트 관리', icon: 'ti-medal' },
        { key: 'owners', label: '원장님 현황', icon: 'ti-building-store' },
        { key: 'arete', label: '아레테클럽', icon: 'ti-crown' },
        // { key: 'expand', label: '입점 확장', icon: 'ti-arrow-bar-up' }, // 2026-08-10 숨김: 컴퍼니통합으로 브랜드단위 개념이 의미없어져서 임시숨김. 필요시 이 줄 주석만 해제하면 복구됨
      ],
    },
    {
      label: '정산·운영',
      items: [
        { key: 'report', label: '월별 리포트', icon: 'ti-report' },
        { key: 'invoice', label: '세금계산서', icon: 'ti-receipt' },
        ...(isCEO ? [{ key: 'settlement', label: '정산', icon: 'ti-coin' }] : []),
        { key: 'staff', label: '관리자계정', icon: 'ti-users' },
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>{brandName}</div>
            {(isCEO || staffRole === 'ceo' || permissions?.includes('logi_hub_access') || userRole === 'admin') && (
              <button
                type="button"
                onClick={async () => {
                  if (!brandId) return
                  const { data } = await supabase.from('brands').select('slug').eq('id', brandId).maybeSingle()
                  const slug = data?.slug != null ? String(data.slug) : null
                  const href = slug ? `/dashboard/logi?slug=${encodeURIComponent(slug)}` : '/dashboard/logi'
                  window.open(href, '_blank', 'noopener,noreferrer')
                }}
                style={{ fontSize: 10, padding: '3px 8px', borderRadius: 6, border: '0.5px solid rgba(76,175,80,0.4)', background: 'rgba(76,175,80,0.1)', color: '#81C784', cursor: 'pointer', flexShrink: 0 }}
              >
                🚚 물류허브
              </button>
            )}
          </div>
        </div>
        {/* 메뉴 */}
        <div style={{ flex: 1, padding: '6px 0' }}>
          {SB_SECTIONS.map(sec => (
            <div key={sec.label}>
              <div style={{ padding: '8px 12px 3px', fontSize: 9, color: 'rgba(255,255,255,0.18)', letterSpacing: '1.5px' }}>{sec.label.toUpperCase()}</div>
              {sec.items.map((item: { key: string; label: string; icon: string; alert?: boolean }) => (
                <button key={item.key} type="button" onClick={() => { setMainTab(item.key as MainTab); setMainSub(undefined) }}
                  style={{ display: 'flex', alignItems: 'center', gap: 7, width: '100%', padding: '8px 12px', fontSize: 11, border: 'none', background: mainTab === item.key ? 'rgba(123,94,167,0.12)' : 'transparent', color: mainTab === item.key ? '#C9A96E' : 'rgba(255,255,255,0.4)', borderLeft: mainTab === item.key ? '2px solid #7B5EA7' : '2px solid transparent', cursor: 'pointer', textAlign: 'left' as const }}>
                  <i className={`ti ${item.icon}`} style={{ fontSize: 13, width: 14, flexShrink: 0 }} aria-hidden="true" />
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {item.alert && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#e85555', flexShrink: 0 }} />}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
      {/* 메인 콘텐츠 */}
      <div style={{ flex: 1, overflowY: 'auto', minWidth: 0 }}>
        {/* 도움말 데이터 */}
        {(() => {
          const HELP: Record<string, { title: string; items: { type: 'flow' | 'warn' | 'tip' | 'info'; text: string }[] }> = {
            home: { title: '홈 대시보드', items: [
              { type: 'info', text: '연결 원장님 수·등록 제품·판매중 KPI를 한눈에 볼 수 있어요.' },
              { type: 'tip', text: '소진 임박 재고 알림이 뜨면 바로 마케팅 기획으로 이동하세요.' },
              { type: 'warn', text: '지금 챙겨야 할 것들 카드를 매일 확인하세요.' },
            ]},
            orentalk: { title: '오렌상담톡', items: [
              { type: 'flow', text: '원장님 전체 또는 등급별로 메시지를 보낼 수 있어요.' },
              { type: 'info', text: '발주 접수·30일 미주문·라이브 사전 알림은 자동으로 발송돼요. ON 상태인지 꼭 확인하세요.' },
              { type: 'tip', text: '수동 발송 후 이력 탭에서 발송 결과를 확인할 수 있어요.' },
            ]},
            orders: { title: '발주 관리', items: [
              { type: 'flow', text: '원장님이 발주하면 접수 대기 상태로 들어와요.' },
              { type: 'flow', text: '승인하면 원장님에게 알림이 가고, 발송은 물류 허브(/dashboard/logi) → 발송 처리에서 해요.' },
              { type: 'warn', text: '접수 대기 탭을 매일 확인하세요. 처리 안 하면 원장님이 기다리게 돼요.' },
            ]},
            inventory: { title: '재고·물류', items: [
              { type: 'info', text: '재고현황·로트·스캔입출고·QR·월마감을 관리해요. 발송은 물류 허브에서 처리해요.' },
              { type: 'flow', text: '로트관리에서 로트를 등록하면 스캔입출고에서 바로 사용할 수 있어요.' },
              { type: 'info', text: '로트 상태가 활성이어야 스캔입출고 화면에 표시돼요.' },
              { type: 'tip', text: '유통기한 임박 로트부터 먼저 출고돼요 (FIFO).' },
              { type: 'warn', text: '비상출고는 스캐너 고장·긴급 납품 등 정말 필요할 때만 사용하세요.' },
            ]},
            sample: { title: '샘플 발송', items: [
              { type: 'flow', text: '샘플을 등록하면 원장님이 요청할 수 있어요.' },
              { type: 'flow', text: '대기중 요청을 확인 후 발송 처리하면 원장님에게 자동으로 오렌톡이 발송돼요.' },
              { type: 'warn', text: '발송 처리 전에 재고를 먼저 확인하세요.' },
            ]},
            live: { title: '이벤트·라이브', items: [
              { type: 'flow', text: '라이브 일정을 등록하면 D-3, D-1, 당일 자동으로 원장님에게 알림이 가요.' },
              { type: 'info', text: '플랫폼 URL과 대상 등급을 정확히 입력하세요.' },
              { type: 'tip', text: '완료 후 녹화 URL을 등록하면 원장님이 다시보기 할 수 있어요.' },
            ]},
            community: { title: '커뮤니티', items: [
              { type: 'flow', text: '공지/프로모션/신제품 소식을 작성하면 원장님 대시보드 브랜드 소식에 자동으로 공개돼요.' },
              { type: 'warn', text: '원장님이 댓글을 달 수 없어요. 중요한 내용은 오렌상담톡으로 별도 발송하세요.' },
            ]},
            archive: { title: '에듀케이션/자료관리', items: [
              { type: 'flow', text: '트리트먼트·제품교육 자료를 등록하면 연결 원장님이 볼 수 있어요.' },
              { type: 'flow', text: '에듀케이션 세션을 만들면 원장님이 신청할 수 있어요.' },
              { type: 'warn', text: '아레테전용 자료는 아레테 회원에게만 보여요.' },
            ]},
            products: { title: '제품 관리', items: [
              { type: 'flow', text: '제품을 등록하면 승인 후 원장님들에게 공개돼요.' },
              { type: 'info', text: '대기/활성/숨김 상태로 관리할 수 있어요.' },
              { type: 'warn', text: '삭제 전에 해당 제품 주문 내역을 먼저 확인하세요.' },
            ]},
            owners: { title: '원장님 현황', items: [
              { type: 'flow', text: '등급은 메디슈티컬·프리미엄전문점·전문점·취급점 4단계로 설정할 수 있어요.' },
              { type: 'flow', text: '아레테클럽 ON하면 매월 100만원 결제 + 50만P 지급이 자동으로 시작돼요.' },
              { type: 'warn', text: '아레테 ON 전에 원장님 동의를 꼭 확인하세요.' },
            ]},
            expand: { title: '입점 확장', items: [
              { type: 'flow', text: '레퍼럴 링크를 복사해서 신규 원장님께 공유하세요.' },
              { type: 'tip', text: '링크로 가입한 원장님은 자동으로 연결 원장님 목록에 추가돼요.' },
            ]},
            report: { title: '월별 리포트', items: [
              { type: 'info', text: '실시간 대조 — 주문·재고 수량 일치 여부를 확인해요.' },
              { type: 'info', text: '불일치 감지 — 시스템과 실물 재고 차이를 확인해요.' },
              { type: 'warn', text: '불일치 항목이 있으면 즉시 확인하고 처리하세요.' },
            ]},
            invoice: { title: '세금계산서', items: [
              { type: 'flow', text: '주문 선택 → 미리보기 확인 → 발행 순서예요.' },
              { type: 'tip', text: '설정에서 로고명과 브랜드 정보를 먼저 입력해두면 매번 자동으로 반영돼요.' },
            ]},
            returns: { title: '반품 관리', items: [
              { type: 'flow', text: '신청 목록에서 원장님 반품 요청을 확인해요.' },
              { type: 'flow', text: '실물을 받은 후 수령 처리 탭에서 완료 처리하세요.' },
              { type: 'warn', text: '실물이 돌아온 경우 포인트가 회수돼요. 수령 처리 전에 확인하세요.' },
            ]},
            settlement: { title: '정산', items: [
              { type: 'info', text: '월별 정산 내역을 확인하고 처리할 수 있어요.' },
            ]},
          }
          const activeHelp = HELP[mainTab] || HELP['home']
          return (
            <>
              {helpOpen && (
                <div onClick={() => setHelpOpen(false)}
                  style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div onClick={e => e.stopPropagation()}
                    style={{ background: '#1a1520', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, width: 360, maxHeight: '70vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                      <div style={{ fontSize: 13, color: '#fff', fontWeight: 500 }}>{activeHelp.title} 도움말</div>
                      <button type="button" onClick={() => setHelpOpen(false)}
                        style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 18, cursor: 'pointer', lineHeight: 1 }}>×</button>
                    </div>
                    <div style={{ padding: 16, overflowY: 'auto' }}>
                      {activeHelp.items.map((item, i) => (
                        <div key={i} style={{
                          padding: '8px 12px', borderRadius: 7, marginBottom: 8,
                          background: item.type === 'warn' ? 'rgba(232,85,85,0.08)' : item.type === 'tip' ? 'rgba(60,184,100,0.08)' : item.type === 'flow' ? 'rgba(123,94,167,0.08)' : 'rgba(59,130,246,0.08)',
                          border: `1px solid ${item.type === 'warn' ? 'rgba(232,85,85,0.2)' : item.type === 'tip' ? 'rgba(60,184,100,0.2)' : item.type === 'flow' ? 'rgba(123,94,167,0.2)' : 'rgba(59,130,246,0.2)'}`,
                        }}>
                          <div style={{ display: 'flex', gap: 7, alignItems: 'flex-start' }}>
                            <span style={{ fontSize: 12, flexShrink: 0, marginTop: 1 }}>
                              {item.type === 'warn' ? '⚠️' : item.type === 'tip' ? '💡' : item.type === 'flow' ? '▶' : 'ℹ️'}
                            </span>
                            <span style={{ fontSize: 12, color: item.type === 'warn' ? '#e85555' : item.type === 'tip' ? '#3db864' : item.type === 'flow' ? '#c4a8f0' : '#60a5fa', lineHeight: 1.6 }}>{item.text}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          )
        })()}
        {/* 공통 헤더 — home 제외 전 탭 */}
        {mainTab !== 'home' && (
          <div style={{ position: 'sticky', top: 0, zIndex: 10, background: '#0a0908', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <button type="button" onClick={() => { setMainTab('home'); setMainSub(undefined) }}
              style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 12, cursor: 'pointer', padding: '4px 8px', borderRadius: 6 }}>
              <i className="ti ti-arrow-left" style={{ fontSize: 13 }} aria-hidden="true" />
              홈
            </button>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.15)' }}>›</span>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
              {SB_SECTIONS.flatMap(s => s.items).find(i => i.key === mainTab)?.label ?? mainTab}
            </span>
            <button type="button" onClick={() => setHelpOpen(true)}
              style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(255,255,255,0.4)', fontSize: 11, cursor: 'pointer' }}>
              <i className="ti ti-help-circle" style={{ fontSize: 13 }} aria-hidden="true" />
              도움말
            </button>
          </div>
        )}
        <div style={{ padding: 16 }}>
          {mainTab === 'home' && <BrandTabHome brandName={brandName} brandId={brandId} onTabChange={(t, s) => { setMainTab(t as MainTab); setMainSub(s) }} />}
          {mainTab === 'products' && <BrandTabProducts rows={rows} tab={tab} onTabChange={onTabChange} onEdit={onEdit} onNew={onNew} currentBrandName={brandName} />}
          {mainTab === 'tierPackages' && <BrandTabTierPackages myBrands={brandOpts} staffId={staffId} isCEO={isCEO} />}
          {mainTab === 'owners' && <BrandTabOwners brandId={brandId} brandName={brandName} authId={authId} />}
          {mainTab === 'arete' && <BrandTabArete companyId={companyId} staffId={staffId} />}
          {mainTab === 'sales' && <BrandTabSales myBrands={brandOpts} initialSub={mainSub} brandId={brandId} />}
          {mainTab === 'orentalk' && <BrandTabOrenTalk myBrands={brandOpts} brandId={brandId} />}
          {mainTab === 'live' && <BrandTabLive myBrands={brandOpts} brandId={brandId} />}
          {mainTab === 'community' && <BrandTabCommunity myBrands={brandOpts} brandId={brandId} />}
          {mainTab === 'archive' && <BrandTabArchive brandId={brandId} companyId={companyId} staffId={staffId} />}
          {mainTab === 'expand' && <BrandTabExpand myBrands={brandOpts} brandId={brandId} />}
          {mainTab === 'invoice' && <BrandTabInvoice myBrands={brandOpts} staffRole={staffRole} brandId={brandId} />}
          {mainTab === 'inventory' && <BrandTabInventory myBrands={brandOpts} authId={authId} loginRole={loginRole} initialSub={mainSub} />}
          {mainTab === 'report' && <BrandTabReport myBrands={brandOpts} brandId={brandId} />}
          {mainTab === 'settlement' && isCEO && (
            <BrandTabSettlement brandId={brandId} />
          )}
          {mainTab === 'staff' && (
            <BrandTabAdminAccount brandId={brandId} companyId={companyId} currentUserRole={loginRole === 'ceo' ? 'ceo' : 'director'} />
          )}
        </div>
      </div>
    </div>
  )
}
