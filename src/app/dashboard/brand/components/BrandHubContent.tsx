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
  const [helpOpen, setHelpOpen] = useState(false)
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
            orders: { title: '주문·정산', items: [
              { type: 'flow', text: '원장님이 발주하면 접수 대기 상태로 들어와요.' },
              { type: 'flow', text: '승인 버튼을 누르면 원장님에게 자동으로 알림이 가고 배송중으로 바뀌어요.' },
              { type: 'flow', text: '배송 완료되면 꼭 완료 처리해주세요.' },
              { type: 'warn', text: '접수 대기 탭을 매일 확인하세요. 처리 안 하면 원장님이 기다리게 돼요.' },
            ]},
            inventory: { title: '재고·물류', items: [
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
            data: { title: '피부 데이터', items: [
              { type: 'info', text: '주문수·원장수·제품수·판매중 KPI와 이달 주문 목록을 볼 수 있어요.' },
              { type: 'tip', text: '원장님별 구매 패턴을 참고해서 맞춤 프로모션을 기획해보세요.' },
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
          const currentHelp = HELP[mainTab] || HELP['home']
          const logiHelp: Record<string, { title: string; items: { type: 'flow' | 'warn' | 'tip' | 'info'; text: string }[] }> = {
            stock: { title: '재고현황', items: [
              { type: 'info', text: '전체 재고·재고 부족·등록 제품 수를 한눈에 볼 수 있어요.' },
              { type: 'warn', text: '재고 부족 항목은 즉시 로트관리에서 보충하세요.' },
            ]},
            lots: { title: '로트관리', items: [
              { type: 'flow', text: '로트를 등록하면 스캔입출고에서 바로 사용할 수 있어요.' },
              { type: 'info', text: '상태가 활성이어야 스캔입출고 목록에 표시돼요.' },
              { type: 'tip', text: '유통기한 임박 로트부터 먼저 출고돼요 (FIFO).' },
              { type: 'warn', text: '로트 등록 후 상태가 활성인지 꼭 확인하세요.' },
            ]},
            scan: { title: '스캔입출고', items: [
              { type: 'flow', text: '로트관리에서 활성 로트 등록이 먼저 필요해요.' },
              { type: 'flow', text: 'QR 스캔 → lot 자동 인식 → 수량 입력 → 출고 완료.' },
              { type: 'info', text: '바코드 스캐너 없어도 lot_number를 직접 입력해도 돼요.' },
            ]},
            qr: { title: 'QR발행', items: [
              { type: 'flow', text: '로트 선택 → QR 자동 생성 → 인쇄 → 제품/박스에 부착.' },
              { type: 'tip', text: '출력 후 코팅하면 창고 환경에서 오래 사용할 수 있어요.' },
            ]},
            emergency: { title: '비상출고', items: [
              { type: 'warn', text: '스캐너 고장·긴급 납품 등 일반 스캔입출고가 불가능할 때만 사용하세요.' },
              { type: 'flow', text: '사유를 반드시 입력하세요. 이력에 기록되고 대조리포트에 표시돼요.' },
            ]},
          }
          const currentLogiHelp = logiHelp[logiTab] || logiHelp['stock']
          const activeHelp = systemMode === 'logi' ? currentLogiHelp : currentHelp
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
        {systemMode === 'brand' && mainTab !== 'home' && (
          <div style={{ position: 'sticky', top: 0, zIndex: 10, background: '#0a0908', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <button type="button" onClick={() => setMainTab('home')}
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
        {systemMode === 'logi' && logiTab !== 'stock' && (
          <div style={{ position: 'sticky', top: 0, zIndex: 10, background: '#0a0908', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <button type="button" onClick={() => setLogiTab('stock')}
              style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 12, cursor: 'pointer', padding: '4px 8px', borderRadius: 6 }}>
              <i className="ti ti-arrow-left" style={{ fontSize: 13 }} aria-hidden="true" />
              재고현황
            </button>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.15)' }}>›</span>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
              {LOGI_TABS.find(t => t.key === logiTab)?.label ?? logiTab}
            </span>
            <button type="button" onClick={() => setHelpOpen(true)}
              style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(255,255,255,0.4)', fontSize: 11, cursor: 'pointer' }}>
              <i className="ti ti-help-circle" style={{ fontSize: 13 }} aria-hidden="true" />
              도움말
            </button>
          </div>
        )}
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
