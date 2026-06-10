'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

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
  id: string; status: string; shipped_at: string | null; delivery_type: string | null
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
  const supabase = createClient()
  const [memberships, setMemberships] = useState<Membership[]>(initial)
  const [templates, setTemplates] = useState<Tpl[]>(initialTpls)
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
  const [showTplPanel, setShowTplPanel] = useState(false)
  const [editTpl, setEditTpl] = useState<Tpl | null>(null)
  const [tplSearch, setTplSearch] = useState('')
  const [tplSearchResults, setTplSearchResults] = useState<{ id: string; name: string }[]>([])
  const [savingTpl, setSavingTpl] = useState(false)
  const [tplMsg, setTplMsg] = useState('')

  // 수동 등록
  const [showManual, setShowManual] = useState(false)
  const [mSearch, setMSearch] = useState('')
  const [mUsers, setMUsers] = useState<{ id: string; name: string; email: string }[]>([])
  const [mUserId, setMUserId] = useState('')
  const [mUserName, setMUserName] = useState('')
  const [mPlanId, setMPlanId] = useState('')
  const [mShipments, setMShipments] = useState(6)
  const [mDate, setMDate] = useState('')
  const [mMemo, setMMemo] = useState('')
  const [mBusy, setMBusy] = useState(false)
  const [mMsg, setMMsg] = useState('')
  const [showShipmentHistory, setShowShipmentHistory] = useState(false)
  const [shipmentHistory, setShipmentHistory] = useState<ShipmentHistoryRow[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [memberShipments, setMemberShipments] = useState<Record<string, MemberShipment[]>>({})
  const [showTomorrowPopup, setShowTomorrowPopup] = useState(false)
  const [tomorrowNames, setTomorrowNames] = useState<string[]>([])
  const [shipModalId, setShipModalId] = useState<string | null>(null)
  const [shipModalNextDate, setShipModalNextDate] = useState('')
  const [shipModalCycleDates, setShipModalCycleDates] = useState<Record<number, string>>({})

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

  useEffect(() => {
    const run = async () => {
      const mIds = initial.map((m) => m.id)
      if (mIds.length) {
        const { data } = await supabase
          .from('membership_shipments')
          .select('id, user_membership_id, cycle_no, status, shipped_at, scheduled_at')
          .in('user_membership_id', mIds)
          .order('cycle_no', { ascending: true })
        const grouped: Record<string, MemberShipment[]> = {}
        for (const row of (data as MemberShipment[]) || []) {
          const mid = row.user_membership_id
          if (!grouped[mid]) grouped[mid] = []
          grouped[mid].push(row)
        }
        setMemberShipments(grouped)
      }

      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      const tomorrowStr = tomorrow.toISOString().slice(0, 10)
      const dayStart = `${tomorrowStr}T00:00:00.000Z`
      const dayAfter = new Date(tomorrow)
      dayAfter.setDate(dayAfter.getDate() + 1)
      const dayEnd = dayAfter.toISOString().slice(0, 10) + 'T00:00:00.000Z'

      const { data: dueRows } = await supabase
        .from('membership_shipments')
        .select('id, scheduled_at, user_membership_id, users(name)')
        .gte('scheduled_at', dayStart)
        .lt('scheduled_at', dayEnd)

      const { data: firstDue } = await supabase
        .from('user_memberships')
        .select('id, next_shipment_date, shipments_total, shipments_remaining, users(name)')
        .eq('status', 'active')
        .eq('next_shipment_date', tomorrowStr)
        .gt('shipments_remaining', 0)

      const names: string[] = []
      const seen = new Set<string>()
      for (const row of dueRows || []) {
        const name = (Array.isArray((row as any).users) ? (row as any).users[0] : (row as any).users)?.name || '회원'
        const key = `s:${(row as any).user_membership_id}:${name}`
        if (!seen.has(key)) { seen.add(key); names.push(name) }
      }
      for (const row of firstDue || []) {
        const completed = ((row as any).shipments_total || 0) - ((row as any).shipments_remaining || 0)
        if (completed > 0) continue
        const name = (Array.isArray((row as any).users) ? (row as any).users[0] : (row as any).users)?.name || '회원'
        const key = `m:${(row as any).id}:${name}`
        if (!seen.has(key)) { seen.add(key); names.push(name) }
      }
      if (names.length) {
        setTomorrowNames(names)
        setShowTomorrowPopup(true)
      }
    }
    void run()
  }, [])

  const pendingMemberships = memberships.filter(m => m.status === 'active' && m.shipments_remaining > 0)
  const ritualDeliveryLabel = (r: ShipmentHistoryRow) => r.delivery_type === 'direct' ? '직접전달' : r.delivery_type === 'quick' ? `퀵 · ${r.courier || ''}` : `택배 · ${r.courier || ''}`

  const openShipmentHistory = async () => {
    setShowShipmentHistory(true)
    setHistoryLoading(true)
    const { data } = await supabase
      .from('membership_shipments')
      .select('id, status, shipped_at, delivery_type, courier, tracking_no, users(name), bundle_templates(theme_name)')
      .eq('status', '발송완료')
      .order('shipped_at', { ascending: false })
    setShipmentHistory((data as unknown as ShipmentHistoryRow[]) || [])
    setHistoryLoading(false)
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
      const { data: fresh } = await supabase
        .from('membership_shipments')
        .select('id, user_membership_id, cycle_no, status, shipped_at, scheduled_at')
        .eq('user_membership_id', mId)
        .order('cycle_no', { ascending: true })
      setMemberShipments((prev) => ({ ...prev, [mId]: (fresh as MemberShipment[]) || [] }))
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

  // 템플릿 제품 검색
  const searchProducts = async (q: string) => {
    if (q.length < 2) { setTplSearchResults([]); return }
    const { data } = await supabase.from('products').select('id,name').ilike('name', `%${q}%`).limit(8)
    setTplSearchResults((data as any) || [])
  }

  // 템플릿 저장
  const saveTpl = async () => {
    if (!editTpl) return
    setSavingTpl(true); setTplMsg('')
    const { error } = await supabase.from('bundle_templates').update({
      theme_name: editTpl.theme_name,
      target_phase: editTpl.target_phase,
      product_ids: editTpl.product_ids,
      usage_guide: editTpl.usage_guide,
      owner_tip: editTpl.owner_tip,
      is_active: editTpl.is_active,
      target_gender: editTpl.target_gender || 'all',
    }).eq('id', editTpl.id)
    setSavingTpl(false)
    if (error) { setTplMsg('저장 실패: ' + error.message); return }
    setTemplates(ts => ts.map(t => t.id === editTpl.id ? editTpl : t))
    setTplMsg('저장됐어요 ✓'); setEditTpl(null)
  }

  // 템플릿 추가
  const addTpl = async () => {
    const { data, error } = await supabase.from('bundle_templates')
      .insert({ theme_name: '새 리추얼', product_ids: [], is_active: true, display_order: templates.length + 1 } as any)
      .select().single()
    if (!error && data) {
      const newTpl = data as Tpl
      setTemplates(ts => [...ts, newTpl])
      setEditTpl(newTpl)
    }
  }

  const deleteTpl = async (id: string) => {
    if (!confirm('템플릿을 삭제할까요?')) return
    const { error } = await supabase.from('bundle_templates').delete().eq('id', id)
    if (error) { setTplMsg('삭제 실패'); return }
    setTemplates(ts => ts.filter(t => t.id !== id))
    setTplMsg('✓ 삭제됐어요')
  }

  // 수동 등록
  const searchUsers = async (q: string) => {
    if (q.length < 2) { setMUsers([]); return }
    const res = await fetch('/api/admin/membership/manual?q=' + encodeURIComponent(q))
    const json = await res.json()
    setMUsers(json.users || [])
  }

  const registerManual = async () => {
    if (!mUserId || !mPlanId || !mDate) { setMMsg('고객·플랜·배송일을 모두 입력해주세요'); return }
    setMBusy(true); setMMsg('')
    const res = await fetch('/api/admin/membership/manual', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: mUserId, plan_id: mPlanId, shipments_total: mShipments, next_shipment_date: mDate, memo: mMemo || undefined, user_name: mUserName || undefined }),
    })
    const json = await res.json()
    setMBusy(false)
    if (json.ok) { setMMsg('등록 완료! 💜'); setMUserId(''); setMUserName(''); setMPlanId(''); setMDate(''); setMMemo(''); setMSearch(''); setMUsers([]) }
    else { setMMsg(json.error || '실패했어요') }
  }

  const selectedTpl = templates.find(t => t.id === tplId)

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '22px 16px 48px', fontFamily: "'Helvetica Neue', Arial, sans-serif", color: C.plum }}>
      <div style={{ fontFamily: SERIF, fontSize: 20, color: C.ink, marginBottom: 12 }}>멤버 · 큐레이션</div>

      {/* 상단 버튼 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button onClick={() => { setShowManual(!showManual); setShowTplPanel(false); setMMsg('') }}
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
        <div style={{ background: '#fff', border: `1px solid ${C.line}`, borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: C.ink, marginBottom: 12 }}>수동 멤버십 등록</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>고객 검색</div>
              <input value={mSearch} onChange={e => { setMSearch(e.target.value); void searchUsers(e.target.value) }}
                placeholder="이름 또는 이메일 2자 이상"
                style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 8, border: `1px solid ${C.line}`, fontSize: 13, fontFamily: 'inherit', outline: 'none', color: '#111', background: '#fff' }}/>
              {mUsers.length > 0 && (
                <div style={{ border: `1px solid ${C.line}`, borderRadius: 8, marginTop: 4, overflow: 'hidden' }}>
                  {mUsers.map(u => (
                    <div key={u.id} onClick={() => { setMUserId(u.id); setMUserName(u.name || ''); setMSearch(u.email); setMUsers([]) }}
                      style={{ padding: '8px 12px', fontSize: 12, cursor: 'pointer', borderBottom: `0.5px solid ${C.line}`, background: mUserId === u.id ? C.purpleSoft : '#fff', color: '#111' }}>
                      {u.name || '(이름없음)'} · {u.email}
                    </div>
                  ))}
                </div>
              )}
            </div>
            {mUserId && (
              <input value={mUserName} onChange={e => setMUserName(e.target.value)} placeholder="이름 확인/수정"
                style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 8, border: `1px solid ${C.line}`, fontSize: 13, fontFamily: 'inherit', outline: 'none', color: '#111', background: '#fff' }}/>
            )}
            <div>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>플랜</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {plans.map(p => <button key={p.id} onClick={() => setMPlanId(p.id)} style={pill(mPlanId === p.id)}>{p.name} · ₩{p.price.toLocaleString()}</button>)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>배송 횟수</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {[3, 6, 12].map(n => <button key={n} onClick={() => setMShipments(n)} style={pill(mShipments === n)}>{n}회</button>)}
              </div>
            </div>
            <input type="date" value={mDate} onChange={e => setMDate(e.target.value)}
              style={{ padding: '9px 12px', borderRadius: 8, border: `1px solid ${C.line}`, fontSize: 13, fontFamily: 'inherit', outline: 'none', color: '#111', background: '#fff' }}/>
            <input value={mMemo} onChange={e => setMMemo(e.target.value)} placeholder="메모 (예: 300만원 송금 확인)"
              style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 8, border: `1px solid ${C.line}`, fontSize: 13, fontFamily: 'inherit', outline: 'none', color: '#111', background: '#fff' }}/>
            {mMsg && <div style={{ fontSize: 12, color: mMsg.includes('완료') ? C.green : '#A33' }}>{mMsg}</div>}
            <button onClick={registerManual} disabled={mBusy}
              style={{ padding: 12, background: mBusy ? '#C9BFD8' : C.purple, border: 'none', color: '#fff', borderRadius: 9, fontSize: 13, cursor: mBusy ? 'default' : 'pointer', fontFamily: 'inherit' }}>
              {mBusy ? '등록 중...' : '멤버십 등록하기'}
            </button>
          </div>
        </div>
      )}

      {/* 템플릿 관리 패널 */}
      {showTplPanel && (
        <div style={{ background: '#fff', border: `1px solid ${C.line}`, borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 13, color: C.ink }}>리추얼 템플릿 관리</div>
            <button onClick={addTpl} style={{ padding: '5px 12px', background: C.purple, border: 'none', color: '#fff', borderRadius: 8, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>+ 추가</button>
          </div>
          {tplMsg && <div style={{ fontSize: 12, color: tplMsg.includes('✓') ? C.green : '#A33', marginBottom: 8 }}>{tplMsg}</div>}

          {/* 템플릿 목록 */}
          {!editTpl && templates.map(t => (
            <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `0.5px solid ${C.line}` }}>
              <div>
                <div style={{ fontSize: 13, color: C.plum }}>{t.theme_name}</div>
                <div style={{ fontSize: 11, color: C.muted }}>{t.target_phase || '전체 페이즈'} · 제품 {t.product_ids?.length || 0}개 · {t.is_active ? '활성' : '비활성'}</div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => { setEditTpl({ ...t }); setTplMsg('') }}
                  style={{ padding: '5px 10px', background: 'transparent', border: `0.5px solid ${C.line}`, color: C.muted, borderRadius: 7, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>편집</button>
                <button onClick={() => deleteTpl(t.id)}
                  style={{ padding: '5px 10px', background: 'transparent', border: '0.5px solid rgba(163,51,51,0.3)', color: '#A33', borderRadius: 7, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>삭제</button>
              </div>
            </div>
          ))}

          {/* 템플릿 편집 */}
          {editTpl && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input value={editTpl.theme_name} onChange={e => setEditTpl({ ...editTpl, theme_name: e.target.value })}
                placeholder="테마명" style={{ padding: '9px 12px', borderRadius: 8, border: `1px solid ${C.line}`, fontSize: 13, fontFamily: 'inherit', outline: 'none', color: '#111', background: '#fff' }}/>
              <div>
                {(editTpl.target_gender || 'all') !== 'male' && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>호르몬 페이즈</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {PHASES.map(p => <button key={p} onClick={() => setEditTpl({ ...editTpl, target_phase: editTpl.target_phase === p ? null : p })} style={pill(editTpl.target_phase === p)}>{p}</button>)}
                    </div>
                  </div>
                )}
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>대상 성별</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {(['all', 'female', 'male'] as const).map(g => (
                      <button key={g} onClick={() => setEditTpl({ ...editTpl, target_gender: g, target_phase: g === 'male' ? null : editTpl.target_phase })}
                        style={{ padding: '5px 14px', borderRadius: 6, fontSize: 12, cursor: 'pointer', border: '0.5px solid rgba(123,94,167,0.3)', background: (editTpl.target_gender || 'all') === g ? C.purple : 'transparent', color: (editTpl.target_gender || 'all') === g ? '#fff' : C.muted }}>
                        {g === 'all' ? '전체' : g === 'female' ? '여성' : '남성'}
                      </button>
                    ))}
                  </div>
                </div>
              {(editTpl.target_gender || 'all') === 'male' && (
                <div style={{ marginTop: 10, padding: '10px 12px', background: 'rgba(123,94,167,0.05)', borderRadius: 8, border: `0.5px solid ${C.line}` }}>
                  <div style={{ fontSize: 11, color: C.muted, marginBottom: 7 }}>남성 프리셋 불러오기</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {Object.keys(MALE_PRESETS).map(key => (
                      <button key={key} onClick={() => setEditTpl({ ...editTpl, ...MALE_PRESETS[key] })}
                        style={{ padding: '5px 12px', borderRadius: 6, fontSize: 11, cursor: 'pointer', border: `0.5px solid ${C.line}`, background: 'transparent', color: C.ink, fontFamily: 'inherit' }}>
                        {key}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              </div>
              <div>
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>제품 검색</div>
                <input value={tplSearch} onChange={e => { setTplSearch(e.target.value); void searchProducts(e.target.value) }}
                  placeholder="제품명 검색" style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', borderRadius: 8, border: `1px solid ${C.line}`, fontSize: 13, fontFamily: 'inherit', outline: 'none', color: '#111', background: '#fff' }}/>
                {tplSearchResults.length > 0 && (
                  <div style={{ border: `1px solid ${C.line}`, borderRadius: 8, marginTop: 4 }}>
                    {tplSearchResults.map(p => (
                      <div key={p.id} onClick={() => { if (!editTpl.product_ids.includes(p.id)) { setEditTpl({ ...editTpl, product_ids: [...editTpl.product_ids, p.id] }); setLocalProductMap(prev => ({ ...prev, [p.id]: { id: p.id, name: p.name, description: null, key_ingredients: null } })) } setTplSearch(''); setTplSearchResults([]) }}
                        style={{ padding: '8px 12px', fontSize: 12, cursor: 'pointer', color: '#111', borderBottom: `0.5px solid ${C.line}`, background: '#fff' }}>
                        {p.name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>구성 제품 ({editTpl.product_ids.length}개)</div>
                {editTpl.product_ids.map(pid => (
                  <div key={pid} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: `0.5px solid ${C.line}` }}>
                    <div>
                      <div style={{ fontSize: 12, color: C.plum }}>{localProductMap[pid]?.name || pid}</div>
                      {localProductMap[pid]?.key_ingredients && <div style={{ fontSize: 10, color: C.gold }}>성분: {localProductMap[pid].key_ingredients}</div>}
                    </div>
                    <button onClick={() => setEditTpl({ ...editTpl, product_ids: editTpl.product_ids.filter(id => id !== pid) })}
                      style={{ fontSize: 11, color: '#A33', background: 'none', border: 'none', cursor: 'pointer' }}>삭제</button>
                  </div>
                ))}
              </div>
              <div>
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>사용법 안내</div>
                <textarea value={editTpl.usage_guide || ''} onChange={e => setEditTpl({ ...editTpl, usage_guide: e.target.value })} rows={3}
                  placeholder="제품 사용법, 순서 등을 입력하세요"
                  style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 8, border: `1px solid ${C.line}`, fontSize: 13, fontFamily: 'inherit', outline: 'none', color: '#111', background: '#fff', resize: 'vertical' }}/>
              </div>
              <div>
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>원장님 팁</div>
                <textarea value={editTpl.owner_tip || ''} onChange={e => setEditTpl({ ...editTpl, owner_tip: e.target.value })} rows={2}
                  placeholder="원장님만의 특별한 팁을 입력하세요 💜"
                  style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 8, border: `1px solid ${C.line}`, fontSize: 13, fontFamily: 'inherit', outline: 'none', color: '#111', background: '#fff', resize: 'vertical' }}/>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: C.ink, cursor: 'pointer' }}>
                <input type="checkbox" checked={editTpl.is_active} onChange={e => setEditTpl({ ...editTpl, is_active: e.target.checked })} style={{ accentColor: C.purple }}/>
                활성 템플릿
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={saveTpl} disabled={savingTpl}
                  style={{ flex: 1, padding: 11, background: savingTpl ? '#C9BFD8' : C.purple, border: 'none', color: '#fff', borderRadius: 9, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {savingTpl ? '저장 중...' : '저장'}
                </button>
                <button onClick={() => { setEditTpl(null); setTplMsg('') }}
                  style={{ padding: '11px 16px', background: 'transparent', border: `0.5px solid ${C.line}`, color: C.muted, borderRadius: 9, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>취소</button>
              </div>
            </div>
          )}
        </div>
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
                    {Array.from({ length: m.shipments_total }, (_, idx) => idx + 1).map((cycle) => (
                      <div key={`${m.id}-cycle-${cycle}`} style={{ fontSize: 11, color: C.ink, padding: '5px 10px', background: C.purpleSoft, borderRadius: 6 }}>
                        {cycleLabel(m, cycle)}
                      </div>
                    ))}
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
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 55, padding: 16 }} onClick={() => setShowShipmentHistory(false)}>
          <div style={{ width: '100%', maxWidth: 720, maxHeight: '88vh', overflow: 'auto', background: '#fff', borderRadius: 16, padding: 20 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: 15, color: C.plum, fontFamily: SERIF }}>발송 내역</div>
              <button type="button" onClick={() => setShowShipmentHistory(false)} style={{ padding: '5px 12px', background: '#f0f0f0', border: 'none', color: C.muted, borderRadius: 8, fontSize: 12, cursor: 'pointer' }}>✕ 닫기</button>
            </div>
            {historyLoading ? (
              <div style={{ textAlign: 'center', color: C.muted, padding: 32, fontSize: 13 }}>불러오는 중...</div>
            ) : shipmentHistory.length === 0 ? (
              <div style={{ textAlign: 'center', color: C.muted, padding: 32, fontSize: 13 }}>발송 완료 내역이 없어요</div>
            ) : (
              <div style={{ border: `1px solid ${C.line}`, borderRadius: 10, overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
                  <thead>
                    <tr>
                      <th style={histTh}>수령자명</th>
                      <th style={histTh}>리추얼명</th>
                      <th style={histTh}>배송방식</th>
                      <th style={histTh}>운송장</th>
                      <th style={histTh}>배송일시</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shipmentHistory.map(r => (
                      <tr key={r.id}>
                        <td style={histTd}>{(Array.isArray(r.users) ? r.users[0] : r.users)?.name || '-'}</td>
                        <td style={histTd}>{(Array.isArray(r.bundle_templates) ? r.bundle_templates[0] : r.bundle_templates)?.theme_name || '-'}</td>
                        <td style={histTd}>{ritualDeliveryLabel(r)}</td>
                        <td style={histTd}>{r.delivery_type === 'courier' ? (r.tracking_no || '-') : '-'}</td>
                        <td style={histTd}>{r.shipped_at ? new Date(r.shipped_at).toLocaleString('ko-KR') : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {showTomorrowPopup ? (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 56, padding: 16 }} onClick={() => setShowTomorrowPopup(false)}>
          <div style={{ width: '100%', maxWidth: 420, background: '#fff', borderRadius: 16, padding: 20 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 15, color: C.plum, fontFamily: SERIF, marginBottom: 8 }}>내일 발송 예정 리추얼 ({tomorrowNames.length}건)</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
              {tomorrowNames.map((name, i) => (
                <div key={`${name}-${i}`} style={{ fontSize: 13, color: C.ink, padding: '8px 10px', background: C.goldSoft, borderRadius: 8 }}>{name}</div>
              ))}
            </div>
            <button type="button" onClick={() => setShowTomorrowPopup(false)} style={{ width: '100%', padding: 10, background: C.purple, border: 'none', color: '#fff', borderRadius: 9, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>확인</button>
          </div>
        </div>
      ) : null}

      {shipModalId ? (() => {
        const modalM = memberships.find((x) => x.id === shipModalId)
        if (!modalM) return null
        const currentCycle = modalM.shipments_total - modalM.shipments_remaining + 1
        const futureCycles = Array.from({ length: modalM.shipments_total - currentCycle }, (_, i) => currentCycle + 1 + i)
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 57, padding: 16 }} onClick={closeShipModal}>
            <div style={{ width: '100%', maxWidth: 440, maxHeight: '88vh', overflow: 'auto', background: '#fff', borderRadius: 16, padding: 20 }} onClick={(e) => e.stopPropagation()}>
              <div style={{ fontSize: 15, color: C.plum, fontFamily: SERIF, marginBottom: 4 }}>{currentCycle}회차 발송 처리</div>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>{modalM.users?.name || '회원'} · 남은 {modalM.shipments_remaining}회</div>
              {modalM.shipments_remaining > 1 && (
                <>
                  <div style={{ fontSize: 11, color: C.muted, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                    다음 회차 발송일 (next_shipment_date)
                    <button
                      type="button"
                      title="날짜 수정"
                      onClick={() => {
                        const el = document.getElementById('ship-modal-next-date') as HTMLInputElement | null
                        el?.showPicker?.()
                        el?.focus()
                      }}
                      style={{ padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13, lineHeight: 1 }}
                    >✏️</button>
                  </div>
                  <input
                    id="ship-modal-next-date"
                    type="date"
                    value={shipModalNextDate}
                    onChange={(e) => setShipModalNextDate(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 8, border: `1px solid ${C.line}`, fontSize: 13, fontFamily: 'inherit', outline: 'none', color: '#111', background: '#fff', marginBottom: 12 }}
                  />
                  {futureCycles.length > 0 && (
                    <div style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>회차별 예정일 (started_at + 30일 간격, 수정 가능)</div>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                    {futureCycles.map((cycle) => (
                      <div key={`ship-modal-cycle-${cycle}`}>
                        <div style={{ fontSize: 11, color: C.ink, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                          {cycle}회차 예정일
                          <button
                            type="button"
                            title="날짜 수정"
                            onClick={() => {
                              const el = document.getElementById(`ship-modal-cycle-${cycle}`) as HTMLInputElement | null
                              el?.showPicker?.()
                              el?.focus()
                            }}
                            style={{ padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13, lineHeight: 1 }}
                          >✏️</button>
                        </div>
                        <input
                          id={`ship-modal-cycle-${cycle}`}
                          type="date"
                          value={shipModalCycleDates[cycle] || ''}
                          onChange={(e) => setShipModalCycleDates((prev) => ({ ...prev, [cycle]: e.target.value }))}
                          style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 8, border: `1px solid ${C.line}`, fontSize: 13, fontFamily: 'inherit', outline: 'none', color: '#111', background: '#fff' }}
                        />
                      </div>
                    ))}
                  </div>
                </>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={closeShipModal} disabled={busy}
                  style={{ flex: 1, padding: 11, background: 'transparent', border: `1px solid ${C.line}`, color: C.muted, borderRadius: 9, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                  취소
                </button>
                <button type="button" onClick={confirmShipModal} disabled={busy}
                  style={{ flex: 1, padding: 11, background: busy ? '#C9BFD8' : C.purple, border: 'none', color: '#fff', borderRadius: 9, fontSize: 13, cursor: busy ? 'wait' : 'pointer', fontFamily: 'inherit' }}>
                  {busy ? '처리 중...' : '발송 확인'}
                </button>
              </div>
            </div>
          </div>
        )
      })() : null}
    </div>
  )
}

const histTh: React.CSSProperties = { textAlign: 'left', fontSize: 11, color: '#8A7E92', padding: '10px 12px', borderBottom: `1px solid rgba(123,94,167,0.2)`, fontWeight: 500 }
const histTd: React.CSSProperties = { fontSize: 13, color: '#2A2433', padding: '12px', borderBottom: `1px solid rgba(123,94,167,0.15)`, verticalAlign: 'middle' }
