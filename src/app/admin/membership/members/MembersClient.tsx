'use client'

import { useState } from 'react'
import { useMembershipInit } from './useMembershipInit'
import { useTemplates } from './useTemplates'
import { TomorrowPopup } from './TomorrowPopup'
import { ShipHistoryModal } from './ShipHistoryModal'
import { ShipConfirmModal } from './ShipConfirmModal'
import { ManualRegisterPanel } from './ManualRegisterPanel'
import { TemplatePanel } from './TemplatePanel'

const C = {
  purple: '#7B5EA7', purpleSoft: '#F1ECF8', goldDark: '#A07F4A', goldSoft: '#F6EFE3',
  plum: '#2A2433', ink: '#4A4256', muted: '#8A7E92', faint: '#A89CB5',
  line: 'rgba(123,94,167,0.15)', green: '#5B8A6B', greenSoft: '#EAF3EC', gold: '#C9A96E',
}
const SERIF = "'Cormorant Garamond', Georgia, serif"
const PHASES = ['달빛기', '황금기', '만개기', '물들기']
const MALE_PRESETS: Record<string, { theme_name: string; usage_guide: string; owner_tip: string }> = {
  '면도진정': { theme_name: '면도 후 진정 케어', usage_guide: '클렌징(저자극 폼) → 진정 토너(화장솜 습포 1분) → 세라마이드 세럼 → 무향 수분크림\n면도는 샤워 후 모공 열린 상태에서, 결 방향으로. 역방향 면도는 매일 미세 상처를 만들어요.', owner_tip: '면도날 교체 주기 5회 넘기면 피부가 먼저 알아요. 붉음·따가움·트러블 반복된다면 날이 문제예요. 애프터쉐이브 알코올 타입은 장벽을 매일 무너뜨려요. 세라마이드 계열로 바꾸세요.' },
  '피지모공': { theme_name: '피지 조절 · 모공 케어', usage_guide: '이중세안(오일 → 폼) → BHA 토너(주 3회) → 나이아신아마이드 세럼 → 젤크림\nT존 피지는 닦지 말고 흡수시켜요. 과세안은 오히려 피지 과분비를 부릅니다.', owner_tip: '남성 피지 분비량은 여성의 2배예요. 모공이 넓어 보이는 건 피지+각질 콤보 때문이고 BHA가 그 안을 청소해줘요. 체취도 피지 산화와 연결돼 있어요. 피지 관리가 냄새 관리예요.' },
  '체취pH': { theme_name: 'pH 밸런싱 · 체취 케어', usage_guide: '약산성 클렌저(pH 5.5) → 유산균 토너 → 프로바이오틱스 세럼 → 무향 로션\n샤워 후 물기 완전히 제거 후 즉시 적용. 목·귀 뒤·쇄골 라인까지 토너 꼼꼼히.', owner_tip: '체취의 주범은 땀 자체가 아니에요. 피부 상재균이 땀·피지를 분해할 때 냄새가 나요. 약산성 환경을 유지하면 유해균이 줄어들고 체취가 자연스럽게 개선돼요. 향수로 덮는 것보다 피부 자체를 바꾸는 게 진짜 해결책이에요.' },
  '탄력리프팅': { theme_name: '콜라겐 리프팅 케어', usage_guide: '효소 클렌저(주 2회) → 레티놀 세럼(저녁 전용) → 펩타이드 크림 → SPF50 자외선차단(아침 필수)\n레티놀은 처음엔 주 2회, 2주 후 격일, 한 달 후 매일. 서두르면 뒤집어져요.', owner_tip: '콜라겐은 25세부터 줄고 50대엔 30대의 절반이에요. 남성은 피부가 두꺼워 뒤늦게 시작해도 회복이 빨라요. 레티놀+자외선차단 이 2가지만으로 1년 후 피부가 확실히 바뀝니다.' },
  '미백색소': { theme_name: '브라이트닝 · 잡티 케어', usage_guide: '저자극 클렌저 → 비타민C 세럼(아침) → 알부틴·나이아신아마이드 세럼 → 수분크림 → SPF50+(매일)\n비타민C는 공기 노출 시 산화되니 사용 후 즉시 마개. 냉장 보관 권장.', owner_tip: '50대 남성 색소침착의 70%는 자외선 누적이에요. 지금 보이는 잡티는 20-30대에 쌓인 결과예요. 선크림이 제일 비싼 미백 제품이에요. 비타민C + 나이아신아마이드 콤보로 3개월이면 달라져요.' },
}

type Membership = {
  id: string; user_id: string; status: string; shipments_total: number; shipments_remaining: number
  next_shipment_date: string | null; scheduled_at?: string | null; started_at?: string | null; source_type?: string | null
  users: { name: string } | null; membership_plans: { name: string } | null
}
type MemberShipment = {
  id: string; user_membership_id: string; cycle_no: number
  status: string; shipped_at: string | null; scheduled_at: string | null
}
type Tpl = {
  id: string; theme_name: string; target_phase: string | null
  product_ids: string[]; usage_guide: string | null; owner_tip: string | null
  is_active: boolean; display_order: number; target_gender?: string | null
}
type Plan = { id: string; name: string; price: number }
type ShipmentHistoryRow = {
  id: string; cycle_no?: number | null; status: string; shipped_at: string | null; delivery_type: string | null
  courier: string | null; tracking_no: string | null
  users: { name: string } | null; bundle_templates: { theme_name: string } | null
}
type ProductInfo = { id: string; name: string; description: string | null; key_ingredients: string | null }
type Scored = { id: string; name: string; retail_price: number | null; _score: number; _reasons: string[] }

export default function MembersClient({
  memberships: initial, templates: initialTpls, plans, productMap, genderMap = {},
}: {
  memberships: Membership[]; templates: Tpl[]; plans: Plan[]; productMap: Record<string, ProductInfo>; genderMap?: Record<string, string>
}) {
  const [memberships, setMemberships] = useState<Membership[]>(initial)
  const [openId, setOpenId] = useState<string | null>(null)
  const [localProductMap, setLocalProductMap] = useState<Record<string, ProductInfo>>(productMap)
  const [deliveryTypes, setDeliveryTypes] = useState<Record<string, string>>({})
  const [couriers, setCouriers] = useState<Record<string, string>>({})
  const [trackingNos, setTrackingNos] = useState<Record<string, string>>({})
  const [quickCompanies, setQuickCompanies] = useState<Record<string, string>>({})
  const [tplId, setTplId] = useState<string | null>(null)
  const [preview, setPreview] = useState<{ theme: string; phase: string | null; products: Scored[] } | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  // 템플릿 관리
  const tpl = useTemplates(initialTpls)
  const { templates, showTplPanel, setShowTplPanel, setEditTpl, setTplMsg } = tpl

  // 수동 등록
  const [showManual, setShowManual] = useState(false)
  const [showShipmentHistory, setShowShipmentHistory] = useState(false)
  const [shipmentHistory, setShipmentHistory] = useState<ShipmentHistoryRow[]>([])
  const [historySummary, setHistorySummary] = useState({ total: 0, monthCount: 0 })
  const [historyLoading, setHistoryLoading] = useState(false)
  const [memberShipments, setMemberShipments] = useState<Record<string, MemberShipment[]>>({})
  const [showTomorrowPopup, setShowTomorrowPopup] = useState(false)
  const [tomorrowNames, setTomorrowNames] = useState<string[]>([])
  const [shipModalId, setShipModalId] = useState<string | null>(null)
  const [shipModalNextDate, setShipModalNextDate] = useState('')
  const [shipModalCycleDates, setShipModalCycleDates] = useState<Record<number, string>>({})
  const [editCycleKey, setEditCycleKey] = useState<string | null>(null)
  const [editCycleDate, setEditCycleDate] = useState('')
  const [scheduleBusy, setScheduleBusy] = useState<string | null>(null)

  const fmtScheduleDate = (iso: string | null | undefined) => {
    if (!iso) return ''
    const d = iso.length === 10 ? new Date(`${iso}T12:00:00`) : new Date(iso)
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('ko-KR')
  }

  const calcCycleDate = (startedAt: string | null | undefined, cycle: number) => {
    if (!startedAt || cycle < 1) return ''
    const raw = String(startedAt)
    const base = new Date(raw.length >= 10 ? `${raw.slice(0, 10)}T12:00:00` : raw)
    if (Number.isNaN(base.getTime())) return ''
    const d = new Date(base)
    d.setDate(d.getDate() + (cycle - 1) * 30)
    return d.toISOString().slice(0, 10)
  }

  const cycleLabel = (m: Membership, cycle: number) => {
    const rows = memberShipments[m.id] || []
    const shipped = rows.find((r) => r.cycle_no === cycle && r.status === '발송완료')
    const planned = rows.find((r) => r.cycle_no === cycle && r.status !== '발송완료')
    const completed = m.shipments_total - m.shipments_remaining
    if (shipped?.shipped_at) {
      return `${cycle}회차 ✅ 발송완료 (${fmtScheduleDate(shipped.shipped_at)})`
    }
    if (planned?.scheduled_at) {
      return `${cycle}회차 📅 예정 (${fmtScheduleDate(planned.scheduled_at)})`
    }
    if (cycle === completed + 1) {
      const sched = m.next_shipment_date || m.scheduled_at || calcCycleDate(m.started_at, cycle)
      if (sched) return `${cycle}회차 📅 예정 (${fmtScheduleDate(sched)})`
    }
    const autoSched = calcCycleDate(m.started_at, cycle)
    if (autoSched && cycle > completed) {
      return `${cycle}회차 📅 예정 (${fmtScheduleDate(autoSched)})`
    }
    return `${cycle}회차 ⏳ 예정일 미정`
  }

  const cycleScheduleDate = (m: Membership, cycle: number) => {
    const rows = memberShipments[m.id] || []
    const shipped = rows.find((r) => r.cycle_no === cycle && r.status === '발송완료')
    if (shipped) return null
    const planned = rows.find((r) => r.cycle_no === cycle && r.status !== '발송완료')
    if (planned?.scheduled_at) return String(planned.scheduled_at).slice(0, 10)
    const completed = m.shipments_total - m.shipments_remaining
    if (cycle <= completed) return null
    if (cycle === completed + 1) {
      const sched = m.next_shipment_date || m.scheduled_at || calcCycleDate(m.started_at, cycle)
      return sched ? String(sched).slice(0, 10) : null
    }
    const autoSched = calcCycleDate(m.started_at, cycle)
    return autoSched || null
  }

  const saveCycleSchedule = async (mId: string, cycleNo: number, dateStr: string) => {
    if (!dateStr) { setMsg('날짜를 입력해주세요'); return }
    const busyKey = `${mId}-${cycleNo}`
    setScheduleBusy(busyKey)
    setMsg(null)
    const res = await fetch('/api/admin/membership/curate', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'update_schedule',
        user_membership_id: mId,
        cycle_no: cycleNo,
        scheduled_at: dateStr,
      }),
    })
    const json = await res.json().catch(() => ({}))
    setScheduleBusy(null)
    if (!json.ok) { setMsg(json.error || '예정일 저장 실패'); return }
    setMemberships((ms) => ms.map((m) => m.id === mId ? {
      ...m,
      next_shipment_date: json.next_shipment_date ?? m.next_shipment_date,
      scheduled_at: json.scheduled_at ?? m.scheduled_at,
    } : m))
    setMemberShipments((prev) => ({ ...prev, [mId]: (json.shipments as MemberShipment[]) || [] }))
    setEditCycleKey(null)
    setEditCycleDate('')
    setMsg(`${cycleNo}회차 예정일 저장 완료`)
  }

  const openShipModal = (m: Membership) => {
    if (!tplId) { setMsg('리추얼을 먼저 선택하세요'); return }
    const currentCycle = m.shipments_total - m.shipments_remaining + 1
    const rows = memberShipments[m.id] || []
    const cycleDates: Record<number, string> = {}
    for (let c = currentCycle + 1; c <= m.shipments_total; c++) {
      const row = rows.find((r) => r.cycle_no === c)
      cycleDates[c] = row?.scheduled_at
        ? String(row.scheduled_at).slice(0, 10)
        : calcCycleDate(m.started_at, c)
    }
    setShipModalNextDate(m.next_shipment_date || calcCycleDate(m.started_at, currentCycle + 1))
    setShipModalCycleDates(cycleDates)
    setShipModalId(m.id)
  }

  const closeShipModal = () => {
    setShipModalId(null)
    setShipModalNextDate('')
    setShipModalCycleDates({})
  }

  useMembershipInit(initial, setMemberShipments, setTomorrowNames, setShowTomorrowPopup)

  const pendingMemberships = memberships.filter(m => m.status === 'active' && m.shipments_remaining > 0)

  const openShipmentHistory = async () => {
    setShowShipmentHistory(true)
    setHistoryLoading(true)
    const res = await fetch('/api/admin/membership/curate?type=history')
    const json = await res.json().catch(() => ({}))
    setHistoryLoading(false)
    if (!json.ok) {
      setShipmentHistory([])
      setHistorySummary({ total: 0, monthCount: 0 })
      return
    }
    setShipmentHistory((json.rows as ShipmentHistoryRow[]) || [])
    setHistorySummary({ total: json.total ?? 0, monthCount: json.month_count ?? 0 })
  }

  const open = (id: string) => { setOpenId(openId === id ? null : id); setTplId(null); setPreview(null); setMsg(null) }

  const pill = (active: boolean): React.CSSProperties => ({
    fontSize: 12, cursor: 'pointer', color: active ? '#fff' : C.muted,
    background: active ? C.purple : '#fff', border: active ? 'none' : `0.5px solid rgba(123,94,167,0.22)`,
    borderRadius: 17, padding: '6px 13px', fontFamily: 'inherit',
  })

  // 큐레이션
  const call = async (
    mId: string,
    action: 'preview' | 'ship',
    shipPayload?: { next_shipment_date: string; scheduled_dates: { cycle_no: number; date: string }[] },
  ) => {
    if (!tplId) { setMsg('리추얼을 먼저 선택하세요'); return }
    setBusy(true); setMsg(null)
    const res = await fetch('/api/admin/membership/curate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_membership_id: mId,
        bundle_template_id: tplId,
        action,
        delivery_type: deliveryTypes[mId] || 'courier',
        courier: couriers[mId] || 'CJ대한통운',
        tracking_no: trackingNos[mId] || undefined,
        quick_company: quickCompanies[mId] || undefined,
        ...(action === 'ship' && shipPayload ? {
          next_shipment_date: shipPayload.next_shipment_date || undefined,
          scheduled_dates: shipPayload.scheduled_dates,
        } : {}),
      }),
    })
    const json = await res.json().catch(() => ({}))
    setBusy(false)
    if (!json.ok) { setMsg(json.error || '실패했어요'); return }
    if (action === 'preview') {
      setPreview({ theme: json.theme, phase: json.phase, products: json.products })
    } else {
      setMemberships(ms => ms.map(m => m.id === mId ? {
        ...m,
        shipments_remaining: json.remaining,
        status: json.remaining > 0 ? 'active' : 'expired',
        next_shipment_date: json.next_shipment_date ?? m.next_shipment_date,
        scheduled_at: json.scheduled_at ?? m.scheduled_at,
      } : m))
      setMemberShipments((prev) => ({ ...prev, [mId]: (json.shipments as MemberShipment[]) || [] }))
      setMsg(`${json.cycle_no}회차 발송 완료 · 남은 ${json.remaining}회`)
      setPreview(null)
      closeShipModal()
    }
  }

  const confirmShipModal = () => {
    if (!shipModalId) return
    const m = memberships.find((x) => x.id === shipModalId)
    if (!m) return
    const currentCycle = m.shipments_total - m.shipments_remaining + 1
    const scheduled_dates = Object.entries(shipModalCycleDates)
      .map(([c, d]) => ({ cycle_no: Number(c), date: d }))
      .filter((x) => x.cycle_no > currentCycle && x.date)
    if (m.shipments_remaining > 1 && !shipModalNextDate) {
      setMsg('다음 회차 발송일을 입력해주세요')
      return
    }
    void call(shipModalId, 'ship', {
      next_shipment_date: shipModalNextDate,
      scheduled_dates,
    })
  }

  const selectedTpl = templates.find(t => t.id === tplId)

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '22px 16px 48px', fontFamily: "'Helvetica Neue', Arial, sans-serif", color: C.plum }}>
      <div style={{ fontFamily: SERIF, fontSize: 20, color: C.ink, marginBottom: 12 }}>멤버 · 큐레이션</div>

      {/* 상단 버튼 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button onClick={() => { setShowManual(!showManual); setShowTplPanel(false) }}
          style={{ padding: '7px 14px', background: showManual ? C.purple : 'transparent', border: `1px solid ${C.purple}`, color: showManual ? '#fff' : C.purple, borderRadius: 9, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
          {showManual ? '닫기' : '+ 수동 등록'}
        </button>
        <button onClick={() => { setShowTplPanel(!showTplPanel); setShowManual(false); setEditTpl(null); setTplMsg('') }}
          style={{ padding: '7px 14px', background: showTplPanel ? C.purple : 'transparent', border: `1px solid ${C.purple}`, color: showTplPanel ? '#fff' : C.purple, borderRadius: 9, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
          {showTplPanel ? '닫기' : '📋 템플릿 관리'}
        </button>
        <button onClick={() => void openShipmentHistory()}
          style={{ padding: '7px 14px', background: 'transparent', border: `1px solid ${C.green}`, color: C.green, borderRadius: 9, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
          발송 내역
        </button>
      </div>

      {/* 수동 등록 패널 */}
      {showManual && (
        <ManualRegisterPanel plans={plans} onClose={() => setShowManual(false)} />
      )}

      {/* 템플릿 관리 패널 */}
      {showTplPanel && (
        <TemplatePanel {...tpl} productMap={localProductMap} setProductMap={setLocalProductMap} />
      )}

      {/* 멤버 목록 — 배송 대기(active·잔여회차)만 */}
      {pendingMemberships.length === 0 && <div style={{ fontSize: 13, color: C.muted }}>배송 대기 중인 멤버가 없어요.</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {pendingMemberships.map(m => {
          const opened = openId === m.id
          const isMale = (genderMap[m.user_id] === 'M' || genderMap[m.user_id] === 'Trans_FtM')
          return (
            <div key={m.id} style={{ background: '#fff', border: `0.5px solid ${opened ? C.purple : C.line}`, borderRadius: 12, padding: 15 }}>
              <div
                role="button"
                tabIndex={0}
                onClick={() => open(m.id)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(m.id) } }}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, flex: 1 }}>
                  <span style={{ fontSize: 15, color: C.plum }}>{m.users?.name || '회원'}</span>
                  {m.source_type === 'membership_gift' && (
                    <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 10, background: 'rgba(201,169,110,0.15)', color: C.gold }}>선물수령</span>
                  )}
                  {m.source_type === 'manual' && (
                    <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 10, background: 'rgba(123,94,167,0.1)', color: C.purple }}>수동등록</span>
                  )}
                  <span style={{ fontSize: 11, color: C.goldDark, background: C.goldSoft, borderRadius: 5, padding: '2px 8px' }}>{m.membership_plans?.name || '멤버'}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 12, color: C.muted }}>{m.shipments_total - m.shipments_remaining}/{m.shipments_total}회</span>
                  <span style={{ fontSize: 11, color: m.status === 'active' ? C.green : C.faint, background: m.status === 'active' ? C.greenSoft : 'transparent', borderRadius: 5, padding: '2px 7px' }}>
                    {m.status === 'active' ? '활성' : m.status === 'expired' ? '소진' : m.status}
                  </span>
                  {opened && (
                    <button onClick={e => { e.stopPropagation(); open(m.id) }}
                      style={{ padding: '4px 12px', background: 'transparent', border: `0.5px solid ${C.line}`, color: C.muted, borderRadius: 6, fontSize: 11, cursor: 'pointer', marginLeft: 8, flexShrink: 0 }}>
                      닫기
                    </button>
                  )}
                </div>
              </div>
              {opened && (
                <div style={{ marginTop: 14, borderTop: `0.5px solid ${C.line}`, paddingTop: 14 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 14 }}>
                    {Array.from({ length: m.shipments_total }, (_, idx) => idx + 1).map((cycle) => {
                      const schedDate = cycleScheduleDate(m, cycle)
                      const editKey = `${m.id}-${cycle}`
                      const isEditing = editCycleKey === editKey
                      const busyThis = scheduleBusy === editKey
                      return (
                        <div key={`${m.id}-cycle-${cycle}`} style={{ fontSize: 11, color: C.ink, padding: '5px 10px', background: C.purpleSoft, borderRadius: 6 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                            <span style={{ flex: 1 }}>{cycleLabel(m, cycle)}</span>
                            {schedDate && !isEditing && (
                              <button
                                type="button"
                                title="예정일 수정"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setEditCycleKey(editKey)
                                  setEditCycleDate(schedDate)
                                }}
                                style={{ padding: '2px 6px', border: `0.5px solid ${C.line}`, background: '#fff', borderRadius: 5, cursor: 'pointer', fontSize: 11, lineHeight: 1.2, flexShrink: 0 }}
                              >
                                ✏️
                              </button>
                            )}
                          </div>
                          {isEditing && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }} onClick={(e) => e.stopPropagation()}>
                              <input
                                type="date"
                                value={editCycleDate}
                                onChange={(e) => setEditCycleDate(e.target.value)}
                                style={{ flex: 1, boxSizing: 'border-box', padding: '6px 8px', borderRadius: 6, border: `1px solid ${C.line}`, fontSize: 11, fontFamily: 'inherit', color: '#111', background: '#fff' }}
                              />
                              <button
                                type="button"
                                disabled={busyThis}
                                onClick={() => void saveCycleSchedule(m.id, cycle, editCycleDate)}
                                style={{ padding: '6px 10px', background: busyThis ? '#C9BFD8' : C.purple, border: 'none', color: '#fff', borderRadius: 6, fontSize: 11, cursor: busyThis ? 'wait' : 'pointer', fontFamily: 'inherit', flexShrink: 0 }}
                              >
                                {busyThis ? '...' : '저장'}
                              </button>
                              <button
                                type="button"
                                disabled={busyThis}
                                onClick={() => { setEditCycleKey(null); setEditCycleDate('') }}
                                style={{ padding: '6px 8px', background: 'transparent', border: `0.5px solid ${C.line}`, color: C.muted, borderRadius: 6, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}
                              >
                                취소
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                  <div style={{ fontSize: 12, color: C.muted, marginBottom: 10 }}>
                    남은 {m.shipments_remaining}회 · {m.next_shipment_date ? `다음 ${m.next_shipment_date}` : '예정일 없음'}
                  </div>
                  <div style={{ fontSize: 11, color: C.faint, marginBottom: 7 }}>이번 회차 리추얼 선택</div>
                  <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 12 }}>
                    {(() => {
                      const isMale = (genderMap[m.user_id] === 'M' || genderMap[m.user_id] === 'Trans_FtM')
                      return templates.filter(t => {
                        if (!t.is_active) return false
                        const g = genderMap[m.user_id] || null
                        const tg = t.target_gender || 'all'
                        if (!g || g === 'other' || tg === 'all') return true
                        if ((g === 'F' || g === 'Trans_MtF') && tg === 'female') return true
                        if ((g === 'M' || g === 'Trans_FtM') && tg === 'male') return true
                        return false
                      }).map(t => (
                        <button key={t.id} onClick={() => { setTplId(t.id); setPreview(null) }} style={pill(tplId === t.id)}>
                          {t.theme_name}{!isMale && t.target_phase ? ` · ${t.target_phase}` : ''}
                        </button>
                      ))
                    })()}
                  </div>

                  {/* 선택된 템플릿 상세 인라인 */}
                  {selectedTpl && tplId && (
                    <div style={{ background: C.purpleSoft, borderRadius: 10, padding: '12px 14px', marginBottom: 12 }}>
                      <div style={{ fontSize: 11, color: C.purple, marginBottom: 8 }}>
                        {selectedTpl.theme_name}{(!isMale && selectedTpl.target_phase) ? ` · ${selectedTpl.target_phase}` : ''}
                      </div>
                      {selectedTpl.product_ids.length > 0 && (
                        <div style={{ marginBottom: 8 }}>
                          <div style={{ fontSize: 10, color: C.muted, marginBottom: 4 }}>구성 제품</div>
                          {selectedTpl.product_ids.map(pid => (
                            <div key={pid} style={{ fontSize: 12, color: C.plum, padding: '4px 0', borderBottom: `0.5px solid rgba(123,94,167,0.1)` }}>
                              {localProductMap[pid]?.name || pid}
                              {localProductMap[pid]?.description && <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{localProductMap[pid].description}</div>}
                            </div>
                          ))}
                        </div>
                      )}
                      {selectedTpl.usage_guide && (
                        <div style={{ marginBottom: 6 }}>
                          <div style={{ fontSize: 10, color: C.muted, marginBottom: 2 }}>사용법</div>
                          <div style={{ fontSize: 12, color: C.ink, lineHeight: 1.6, whiteSpace: 'pre-line' }}>{selectedTpl.usage_guide}</div>
                        </div>
                      )}
                      {selectedTpl.owner_tip && (
                        <div>
                          <div style={{ fontSize: 10, color: C.gold, marginBottom: 2 }}>원장님 팁 💜</div>
                          <div style={{ fontSize: 12, color: C.ink, lineHeight: 1.6, whiteSpace: 'pre-line' }}>{selectedTpl.owner_tip}</div>
                        </div>
                      )}
                    </div>
                  )}

                  {preview && (
                    <div style={{ background: '#F5F0FF', borderRadius: 10, padding: '12px 14px', marginBottom: 12 }}>
                      <div style={{ fontSize: 12, color: C.purple, marginBottom: 10 }}>{preview.theme}{preview.phase ? ` · ${preview.phase}` : ''} · AI 큐레이션</div>
                      {preview.products.length === 0 && <div style={{ fontSize: 12, color: C.muted }}>템플릿에 제품을 먼저 추가해주세요</div>}
                      {preview.products.map(p => (
                        <div key={p.id} style={{ paddingBottom: 9, marginBottom: 9, borderBottom: `0.5px solid rgba(123,94,167,0.1)` }}>
                          <div style={{ fontSize: 13, color: C.plum }}>{p.name}</div>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 5 }}>
                            {p._reasons.map((r, i) => <span key={i} style={{ fontSize: 11, color: C.purple, background: '#fff', borderRadius: 5, padding: '2px 7px' }}>{r}</span>)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {msg && (
                    <div style={{ fontSize: 12, marginBottom: 10, padding: '8px 12px', borderRadius: 8,
                      background: msg.includes('완료') ? 'rgba(91,138,107,0.1)' : 'rgba(201,169,110,0.1)',
                      color: msg.includes('완료') ? C.green : C.gold,
                      border: `0.5px solid ${msg.includes('완료') ? 'rgba(91,138,107,0.3)' : 'rgba(201,169,110,0.3)'}` }}>
                      {msg.includes('완료') ? '✓ ' : '⚠ '}{msg}
                    </div>
                  )}
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 11, color: C.faint, marginBottom: 6 }}>배송 방법</div>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                      {(['courier', 'quick', 'direct'] as const).map(dt => (
                        <button key={dt} onClick={() => setDeliveryTypes(prev => ({ ...prev, [m.id]: dt }))}
                          style={{ padding: '5px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer', border: '0.5px solid rgba(123,94,167,0.3)', background: (deliveryTypes[m.id] || 'courier') === dt ? C.purple : 'transparent', color: (deliveryTypes[m.id] || 'courier') === dt ? '#fff' : C.muted }}>
                          {dt === 'courier' ? '📦 택배' : dt === 'quick' ? '🛵 퀵' : '🤝 직접전달'}
                        </button>
                      ))}
                    </div>
                    {(deliveryTypes[m.id] || 'courier') === 'courier' && (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <select value={couriers[m.id] || 'CJ대한통운'} onChange={e => setCouriers(prev => ({ ...prev, [m.id]: e.target.value }))}
                          style={{ padding: '7px 10px', background: '#fff', border: `0.5px solid ${C.line}`, borderRadius: 8, fontSize: 12, color: '#111', cursor: 'pointer' }}>
                          {['CJ대한통운','롯데택배','한진택배','우체국택배','로젠택배'].map(c => <option key={c}>{c}</option>)}
                        </select>
                        <input value={trackingNos[m.id] || ''} onChange={e => setTrackingNos(prev => ({ ...prev, [m.id]: e.target.value }))}
                          placeholder="운송장 번호" style={{ flex: 1, padding: '7px 10px', background: '#fff', border: `0.5px solid ${C.line}`, borderRadius: 8, fontSize: 12, color: '#111' }} />
                      </div>
                    )}
                    {(deliveryTypes[m.id] || 'courier') === 'quick' && (
                      <input value={quickCompanies[m.id] || ''} onChange={e => setQuickCompanies(prev => ({ ...prev, [m.id]: e.target.value }))}
                        placeholder="퀵 업체명" style={{ width: '100%', padding: '7px 10px', background: '#fff', border: `0.5px solid ${C.line}`, borderRadius: 8, fontSize: 12, color: '#111' }} />
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => call(m.id, 'preview')} disabled={busy}
                      style={{ flex: 1, background: 'transparent', border: `0.5px solid rgba(123,94,167,0.3)`, color: C.muted, borderRadius: 8, padding: 10, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer' }}>
                      {busy ? '...' : '미리보기'}
                    </button>
                    <button onClick={() => openShipModal(m)} disabled={busy || m.shipments_remaining <= 0}
                      style={{ flex: 1, background: m.shipments_remaining <= 0 ? '#C9BFD8' : C.purple, border: 'none', color: '#fff', borderRadius: 8, padding: 10, fontSize: 13, fontFamily: 'inherit', cursor: m.shipments_remaining <= 0 ? 'default' : 'pointer' }}>
                      발송 처리
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {showShipmentHistory ? (
        <ShipHistoryModal loading={historyLoading} rows={shipmentHistory} summary={historySummary} onClose={() => setShowShipmentHistory(false)} />
      ) : null}

      {showTomorrowPopup ? (
        <TomorrowPopup names={tomorrowNames} onClose={() => setShowTomorrowPopup(false)} />
      ) : null}

      {shipModalId ? (() => {
        const modalM = memberships.find((x) => x.id === shipModalId)
        if (!modalM) return null
        return (
          <ShipConfirmModal
            membership={modalM}
            busy={busy}
            nextDate={shipModalNextDate}
            setNextDate={setShipModalNextDate}
            cycleDates={shipModalCycleDates}
            setCycleDates={setShipModalCycleDates}
            onClose={closeShipModal}
            onConfirm={confirmShipModal}
          />
        )
      })() : null}
    </div>
  )
}

const histTh: React.CSSProperties = { textAlign: 'left', fontSize: 11, color: '#8A7E92', padding: '10px 12px', borderBottom: `1px solid rgba(123,94,167,0.2)`, fontWeight: 500 }
const histTd: React.CSSProperties = { fontSize: 13, color: '#2A2433', padding: '12px', borderBottom: `1px solid rgba(123,94,167,0.15)`, verticalAlign: 'middle' }
