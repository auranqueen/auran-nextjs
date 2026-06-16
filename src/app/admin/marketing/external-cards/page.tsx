'use client'

import { createClient } from '@/lib/supabase/client'
import { useEffect, useState, useRef, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

const GIFT_TIERS = [
  { id: 't20', label: '20만원 이상', gold: false },
  { id: 't30', label: '30만원 이상', gold: false },
  { id: 't50', label: '50만원 이상', gold: false },
  { id: 't100', label: '100만원 이상', gold: true },
]

const GIFT_TIERS_RENOBEL = [
  { id: 'r50', label: '50만원 이상', gold: false, brand: '르노벨' },
  { id: 'r70', label: '70만원 이상', gold: false, brand: '르노벨' },
  { id: 'r120', label: '120만원 이상', gold: true, brand: '르노벨' },
]

const DAY_EVENTS: Record<number, { name: string; title: string; sub: string }> = {
  0: { name: '일주일 회복 루틴', title: '오늘은 일요일 — 한 주 마무리 피부 회복의 날이에요', sub: '일주일 동안 고생한 피부에 집중 영양을 채워주세요 💜' },
  1: { name: '먼데이 뷰티 케어', title: '오늘은 월요일 — 새로운 한 주 피부부터 챙겨요', sub: '월요일 아침 루틴으로 한 주를 활기차게 시작해요 💜' },
  2: { name: '수분 충전 데이', title: '오늘은 화요일 — 화사하게 빛나는 피부 만들어요', sub: '브라이트닝 케어 집중일이에요 💜' },
  3: { name: '수분 충전 데이', title: '오늘은 수요일 — 수분 집중 케어의 날이에요 💧', sub: '오늘 수분 루틴 점검해요. 상담톡 QR 스캔하면 맑원장님이 체크해드려요 💜' },
  4: { name: '목표 달성 스킨케어', title: '오늘은 목요일 — 이번 주 피부 목표 점검해요', sub: '이번 주 피부 루틴 잘 지키셨나요? 💜' },
  5: { name: '불금 글로우 케어', title: '오늘은 금요일 — 빛나는 주말을 위한 글로우 케어', sub: '주말 전 피부 집중 케어 타이밍이에요 💜' },
  6: { name: '토닥토닥 진정 케어', title: '오늘은 토요일 — 토닥토닥 피부 진정의 날', sub: '한 주 쌓인 피부 스트레스 진정시켜요 💜' },
}

const ROUTINE_PRESETS = [
  { id: 'glow', tag: '✦ 광채 케어', name: '찬란한 피부결 루틴', desc: '각질 정돈 후 세럼 흡수 극대화' },
  { id: 'moist', tag: '✦ 수분 집중', name: '없던 광도 물광 케어', desc: '수분 베이스 레이어링' },
  { id: 'trouble', tag: '✦ 트러블 케어', name: '여드름·좁쌀 진정 루틴', desc: '피지 조절 + 염증 진정' },
  { id: 'regen', tag: '✦ 시술 후 재생', name: '시술 후 찐 재생 케어', desc: '피부 장벽 즉시 복구' },
  { id: 'heat', tag: '✦ 열감 관리', name: '열감·홍조 진정 루틴', desc: '피부 온도 낮추고 진정' },
  { id: 'barrier', tag: '✦ 장벽 강화', name: '피부 장벽 집중 관리', desc: '손상된 장벽 복구' },
  { id: 'night', tag: '✦ 나이트 케어', name: '수면 중 재생 나이트 루틴', desc: '취침 전 고영양 레이어링' },
  { id: 'bright', tag: '✦ 미백·톤업', name: '칙칙함 탈출 브라이트닝', desc: '색소 침착 케어' },
]

const inp = {
  width: '100%' as const,
  padding: '10px 12px',
  borderRadius: 8,
  background: '#fff',
  border: '0.5px solid #ddd',
  color: '#111',
  fontSize: 13,
  fontWeight: 400,
  boxSizing: 'border-box' as const,
}

const secTitle = { fontSize: 14, color: '#7B5EA7', marginBottom: 10, fontWeight: 400, letterSpacing: '.04em' }
const lbl = { fontSize: 11, color: '#888', marginBottom: 4, fontWeight: 400 }

async function searchProducts(q: string, brandId?: string) {
  const supabase = createClient()
  let query = supabase
    .from('products')
    .select('id, name, thumb_img, storage_thumb_url, brand_id')
    .neq('status', 'deleted')
    .limit(12)
  if (q.trim()) query = query.ilike('name', `%${q}%`)
  if (brandId) query = query.eq('brand_id', brandId)
  const { data } = await query
  return data || []
}

function generateQRDataURL(text: string, _size: number): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(text)}&color=1A1714&bgcolor=ffffff&margin=2`
}

function esc(s: string) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

type PrintPayload = {
  customerName: string
  selProds: any[]
  tipText: string
  cmtText: string
  bundleItems: any[]
  sampleItems: any[]
  routineCards: any[]
  giftTiers: any[]
  giftTiersR: any[]
  showRenobel: boolean
  totosOn: boolean
  totosCard: { ico: string; name: string; tip: string; memo: string }
  groupBuys: any[]
  customEvents: any[]
  selectedDayOn: boolean
  dayEvent: { name: string; title: string; sub: string }
  courier?: string
  trackingNo?: string
  recipientPhone?: string
  recipientAddress?: string
}

function buildPrintHTML(p: PrintPayload): string {
  const qrChat = generateQRDataURL('https://auran.kr/chat?ref=care_card', 80)
  const qrReview = generateQRDataURL('https://auran.kr/review?ref=care_card', 80)
  const prods = p.selProds.map(x => `<tr><td>${esc(x.name)}</td><td style="text-align:center">${x.qty || 1}</td><td style="text-align:right">₩${Number(x.price || 0).toLocaleString()}</td></tr>`).join('')
  const bundle = p.bundleItems.map(x => `<div class="chip">${esc(x.name)}${x.tip ? `<div class="sub">${esc(x.tip)}</div>` : ''}</div>`).join('')
  const samples = p.sampleItems.map(x => `<span class="badge">${esc(x.name)}</span>`).join(' ')
  const routines = (p.routineCards || []).map((x: any) => `
  <div style="border:0.5px solid #e8e0d8;border-radius:10px;overflow:hidden;margin-bottom:10px;">
    <div style="background:#7B5EA7;padding:8px 14px;">
      <span style="font-size:8px;color:rgba(255,255,255,.7);letter-spacing:.12em;">${esc(x.tag || '')}</span>
      <span style="font-family:'Cormorant Garamond',serif;font-style:italic;font-size:13px;color:#fff;margin-left:6px;">${esc(x.name || '')}</span>
    </div>
    <div style="padding:10px 14px;">
      ${x.routineTitle ? `<div style="font-size:12px;color:#333;margin-bottom:6px;font-family:'Cormorant Garamond',serif;font-style:italic;">${esc(x.routineTitle)}</div>` : ''}
      <div style="font-size:9px;color:#534AB7;margin-bottom:8px;font-style:italic;">${esc(x.desc || '')}</div>
      ${(x.prods || []).map((prod: any) => `
        <div style="display:flex;align-items:flex-start;gap:8px;padding:6px 0;border-bottom:0.5px solid #f5efe8;">
          <div style="flex:1;font-size:11px;color:#333;">${esc(prod.name)}</div>
          ${prod.tip ? `<div style="font-size:9px;color:#888;line-height:1.5;">${esc(prod.tip)}</div>` : ''}
        </div>`).join('')}
      ${x.routineMemo ? `
        <div style="margin-top:10px;padding:10px 12px;background:#f9f7fc;border-radius:8px;border-left:2px solid #7B5EA7;">
          <div style="font-size:8px;color:#C9A96E;letter-spacing:.15em;margin-bottom:5px;">✦ 원장님 루틴 멘트</div>
          <div style="font-size:11px;color:#534AB7;line-height:1.8;">${esc(x.routineMemo)}</div>
        </div>` : ''}
    </div>
  </div>`).join('')
  const gifts = [...p.giftTiers, ...(p.showRenobel ? p.giftTiersR : [])].map(x => `<div class="gift"><strong>${esc(x.label)}</strong>${(x.items || []).map((i: any) => esc(i.name)).join(', ')}</div>`).join('')
  const events = [
    p.selectedDayOn ? `<div class="evt"><div class="evt-t">${esc(p.dayEvent.title)}</div><div class="sub">${esc(p.dayEvent.sub)}</div></div>` : '',
    ...p.groupBuys.map(g => `<div class="evt"><div class="evt-t">${esc(g.name)}</div><div class="sub">${esc(g.desc)} ${esc(g.period || '')}</div></div>`),
    ...p.customEvents.map((g: any) => `<div class="evt"><div class="evt-t">${esc(g.name)}</div><div class="sub">${esc(g.desc || '')}</div></div>`),
  ].filter(Boolean).join('')
  const toto = p.totosOn ? `<div class="toto"><div>${esc(p.totosCard.ico)} ${esc(p.totosCard.name)}</div><div class="sub">${esc(p.totosCard.tip)}</div><div class="sub">${esc(p.totosCard.memo)}</div></div>` : ''

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>AURAN 케어카드</title>
<style>
  @media print { @page { margin: 12mm; } .no-print { display: none !important; } }
  body { font-family: 'Noto Serif KR', 'Apple SD Gothic Neo', sans-serif; font-weight: 300; color: #111; font-size: 12px; padding: 20px; }
  h1 { font-size: 16px; color: #7B5EA7; font-weight: 400; letter-spacing: .08em; margin: 0 0 16px; }
  .sec { margin-bottom: 16px; page-break-inside: avoid; }
  .lbl { font-size: 9px; color: #C9A96E; letter-spacing: .12em; margin-bottom: 6px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 6px 8px; border-bottom: 0.5px solid #eee; font-weight: 400; }
  th { color: #999; font-size: 10px; text-align: left; }
  .chip, .box, .gift, .evt, .toto { border: 0.5px solid #e8e0d0; border-radius: 8px; padding: 10px; margin-bottom: 8px; }
  .sub { font-size: 11px; color: #534AB7; line-height: 1.7; margin-top: 4px; }
  .tag { font-size: 9px; color: #C9A96E; margin-bottom: 4px; }
  .badge { display: inline-block; border: 0.5px solid #C9A96E; border-radius: 12px; padding: 3px 8px; margin: 2px; font-size: 10px; }
  .qr-row { display:flex; gap:20px; align-items:center; padding:14px 22px; border-top:0.5px solid #f5efe8; background:#fdf8f2; }
  .qr-item { display:flex; flex-direction:column; align-items:center; gap:5px; }
  .qr-img { width:70px; height:70px; background:#fff; border:0.5px solid #eee; border-radius:6px; padding:3px; }
  .qr-img img { width:100%; height:100%; display:block; }
  .qr-lbl { font-size:10px; text-align:center; }
  .qr-txt { flex:1; padding-left:12px; }
  .qr-txt-main { font-family:'Cormorant Garamond',serif; font-style:italic; font-size:14px; color:#7B5EA7; margin-bottom:4px; }
  .qr-txt-sub { font-size:11px; color:#888; line-height:1.9; }
  .footer { text-align: right; font-size: 9px; color: #bbb; margin-top: 20px; }
</style></head><body>
<div class="no-print" style="margin-bottom:16px;">
  <button onclick="window.print()" style="padding:8px 20px;background:#7B5EA7;color:#fff;border:none;border-radius:7px;font-size:12px;cursor:pointer;">🖨️ 인쇄</button>
  <button onclick="window.close()" style="padding:8px 16px;background:#f5f5f5;color:#666;border:0.5px solid #ddd;border-radius:7px;font-size:12px;cursor:pointer;margin-left:8px;">닫기</button>
</div>
<h1>✦ AURAN 외부고객 케어카드</h1>
<div class="sec"><div class="lbl">고객</div><div>${esc(p.customerName || '고객')}님</div>${p.courier || p.trackingNo ? `<div style="margin-top:6px;font-size:11px;color:#666;">${p.courier ? `${esc(p.courier)} ` : ''}${p.trackingNo ? `송장번호: <strong>${esc(p.trackingNo)}</strong>` : ''}</div>` : ''}${p.recipientPhone ? `<div style="font-size:11px;color:#666;margin-top:3px;">연락처: ${esc(p.recipientPhone)}</div>` : ''}${p.recipientAddress ? `<div style="font-size:11px;color:#666;margin-top:3px;">주소: ${esc(p.recipientAddress)}</div>` : ''}</div>
<div class="sec"><div class="lbl">구매 제품</div><table><thead><tr><th>상품</th><th>수량</th><th>금액</th></tr></thead><tbody>${prods || '<tr><td colspan="3">없음</td></tr>'}</tbody></table></div>
<div class="sec"><div class="lbl">사용법 · 팁</div><div>${esc(p.tipText)}</div></div>
<div class="sec"><div class="lbl">맑원장 코멘트</div><div class="sub">${esc(p.cmtText)}</div></div>
<div class="qr-row">
  <div class="qr-item">
    <div class="qr-img"><img src="${qrChat}" alt="상담톡 QR"></div>
    <span class="qr-lbl" style="color:#7B5EA7;">상담톡 바로가기</span>
  </div>
  <div class="qr-item">
    <div class="qr-img"><img src="${qrReview}" alt="리뷰 QR"></div>
    <span class="qr-lbl" style="color:#C9A96E;">리뷰 바로쓰기</span>
  </div>
  <div class="qr-txt">
    <div class="qr-txt-main">내 피부, 이제 전문가랑 같이 봐요</div>
    <div class="qr-txt-sub">📦 배송 문의도 오랜 상담톡으로 편하게 주세요<br>⭐ 리뷰 남기고 토스트 포인트 받아가세요<br>💜 맑원장님이 직접 답변 드려요</div>
  </div>
</div>
${bundle ? `<div class="sec"><div class="lbl">함께 쓰면 좋은 제품</div>${bundle}</div>` : ''}
${samples ? `<div class="sec"><div class="lbl">동봉 샘플</div>${samples}</div>` : ''}
${routines ? `<div class="sec"><div class="lbl">루틴 케어</div>${routines}</div>` : ''}
${gifts ? `<div class="sec"><div class="lbl">금액별 선물</div>${gifts}</div>` : ''}
${toto}
${events ? `<div class="sec"><div class="lbl">이벤트 안내</div>${events}</div>` : ''}
<div class="footer">auran.kr · 스킨파우더룸 · since 2006</div>
</body></html>`
}

function ExternalCardsPage() {
  const searchParams = useSearchParams()
  const initMode    = searchParams.get('mode') || ''
  const initName    = searchParams.get('name') ? decodeURIComponent(searchParams.get('name')!) : ''
  const initUserId  = searchParams.get('user_id') || ''
  const initOrderId = searchParams.get('order_id') || ''
  const initProds   = searchParams.get('prods') || ''
  const [customerName, setCustomerName] = useState(initName)
  const [customerHistory, setCustomerHistory] = useState<any>(null)
  const [selProds, setSelProds] = useState<any[]>(() => {
    if (!initProds) return []
    try {
      return initProds.split(',').map((s: string) => {
        const p = JSON.parse(decodeURIComponent(s))
        return { name: p.name, qty: p.qty || 1, price: p.price || 0, id: p.name }
      })
    } catch { return [] }
  })
  const [prodSearch, setProdSearch] = useState('')
  const [prodResults, setProdResults] = useState<any[]>([])
  const [tipText, setTipText] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [cmtText, setCmtText] = useState('')
  const [bundleItems, setBundleItems] = useState<any[]>([])
  const [bundleSearch, setBundleSearch] = useState('')
  const [bundleResults, setBundleResults] = useState<any[]>([])
  const [sampleItems, setSampleItems] = useState<any[]>([])
  const [sampleSearch, setSampleSearch] = useState('')
  const [sampleResults, setSampleResults] = useState<any[]>([])
  const [routineCards, setRoutineCards] = useState<any[]>([])
  const [routineSearch, setRoutineSearch] = useState<Record<string, string>>({})
  const [routineSearchResults, setRoutineSearchResults] = useState<Record<string, any[]>>({})
  const [giftTiers, setGiftTiers] = useState<any[]>([])
  const [giftTiersR, setGiftTiersR] = useState<any[]>([])
  const [showRenobel, setShowRenobel] = useState(false)
  const [totoOn, setTotoOn] = useState(false)
  const [totoCard, setTotoCard] = useState({ ico: '', name: '', tip: '', memo: '' })
  const [totoSearch, setTotoSearch] = useState('')
  const [totoResults, setTotoResults] = useState<any[]>([])
  const [groupBuys, setGroupBuys] = useState<any[]>([])
  const [customEvents, setCustomEvents] = useState<any[]>([])
  const [selectedDayOn, setSelectedDayOn] = useState(true)
  const [selectedDayIdx, setSelectedDayIdx] = useState<number>(new Date().getDay())
  const [loading, setLoading] = useState(false)
  const [giftSearch, setGiftSearch] = useState('')
  const [giftResults, setGiftResults] = useState<any[]>([])
  const [activeGiftTier, setActiveGiftTier] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [brandFilter, setBrandFilter] = useState('')
  const [brandList, setBrandList] = useState<{ id: string; name: string }[]>([])
  const [customerId, setCustomerId] = useState<string | null>(null)
  const [customerResults, setCustomerResults] = useState<any[]>([])
  const [showCustomerDD, setShowCustomerDD] = useState(false)
  const [courier, setCourier] = useState('')
  const [trackingNo, setTrackingNo] = useState('')
  const [recipientPhone, setRecipientPhone] = useState('')
  const [recipientAddress, setRecipientAddress] = useState('')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [routinePresets, setRoutinePresets] = useState<Record<string, { prods: { name: string, tip: string, id?: string }[] }>>({})
  const [presetSaving, setPresetSaving] = useState(false)
  const [presetSettingId, setPresetSettingId] = useState<string | null>(null)
  const [showCardList, setShowCardList] = useState(false)
  const [savedCards, setSavedCards] = useState<any[]>([])
  const prodRef = useRef<HTMLDivElement>(null)

  const dayEvent = DAY_EVENTS[selectedDayIdx]

  useEffect(() => {
    if (!initName && !initProds && !initOrderId) return
    // URL 파라미터로 들어온 경우 임시저장 덮어쓰지 않음
    if (initName) setCustomerName(initName)
    if (initUserId) {
      setCustomerId(initUserId)
      // initUserId로 회원 정보 직접 조회 (이름 검색 우회)
      const supabase2 = createClient()
      supabase2
        .from('users')
        .select('id, name, full_name, phone, email, skin_type, skin_concerns, points, charge_balance')
        .eq('auth_id', initUserId)
        .maybeSingle()
        .then(({ data: userData }) => {
          if (!userData) {
            // auth_id로 안 찾히면 id로 재시도
            supabase2
              .from('users')
              .select('id, name, full_name, phone, email, skin_type, skin_concerns, points, charge_balance')
              .eq('id', initUserId)
              .maybeSingle()
              .then(({ data: userData2 }) => {
                if (userData2) {
                  setCustomerHistory(userData2)
                  if (!initName) setCustomerName(userData2.name || userData2.full_name || '')
                }
              })
            return
          }
          setCustomerHistory(userData)
          if (!initName) setCustomerName(userData.name || userData.full_name || '')
        })
    }
    // order_id로 order_items 직접 조회 (prods URL 파라미터 실패 대비)
    if (initOrderId && initMode === 'member') {
      const supabase = createClient()
      supabase
        .from('order_items')
        .select('product_id, product_name, product_price, quantity')
        .eq('order_id', initOrderId)
        .then(({ data }) => {
          if (data && data.length > 0) {
            setSelProds(data.map((item: any) => ({
              id: item.product_id || item.product_name,
              name: item.product_name || '',
              qty: item.quantity || 1,
              price: item.product_price || 0,
            })))
          }
        })
    }
    if (initProds) {
      try {
        const parsed = initProds.split(',').map((s: string) => {
          const p = JSON.parse(decodeURIComponent(s))
          return { name: p.name, qty: p.qty || 1, price: p.price || 0, id: p.name }
        })
        setSelProds(parsed)
      } catch {}
    }
  }, [])

  useEffect(() => {
    if (initName || initProds) return // URL 파라미터 우선
    const saved = localStorage.getItem('auran_care_card_draft')
    if (!saved) return
    try {
      const d = JSON.parse(saved)
      if (d.customerName) setCustomerName(d.customerName)
      if (d.selProds) setSelProds(d.selProds)
      if (d.tipText) setTipText(d.tipText)
      if (d.cmtText) setCmtText(d.cmtText)
      if (d.bundleItems) setBundleItems(d.bundleItems)
      if (d.sampleItems) setSampleItems(d.sampleItems)
      if (d.routineCards) setRoutineCards(d.routineCards)
      if (d.giftTiers) setGiftTiers(d.giftTiers)
      if (d.giftTiersR) setGiftTiersR(d.giftTiersR)
      if (d.showRenobel !== undefined) setShowRenobel(d.showRenobel)
      if (d.totoOn !== undefined) setTotoOn(d.totoOn)
      if (d.totoCard) setTotoCard(d.totoCard)
      if (d.groupBuys) setGroupBuys(d.groupBuys)
      if (d.customEvents) setCustomEvents(d.customEvents)
      if (d.selectedDayOn !== undefined) setSelectedDayOn(d.selectedDayOn)
      if (d.selectedDayIdx !== undefined) setSelectedDayIdx(d.selectedDayIdx)
    } catch {}
  }, [])

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('group_buys')
      .select('id, ends_at, gift_title, gift_description, product:products(name)')
      .eq('is_active', true)
      .then(({ data }) => {
        if (data?.length) {
          setGroupBuys(data.map((g: any) => ({
            name: g.gift_title || g.product?.name || '공동구매',
            desc: g.gift_description || '',
            period: g.ends_at ? String(g.ends_at).slice(0, 10) + ' 까지' : '',
            fromDB: true,
          })))
        }
      })
  }, [])

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('brands')
      .select('id, name')
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => { if (data) setBrandList(data) })
  }, [])

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('admin_settings')
      .select('id, value')
      .eq('key', 'routine_card_presets')
      .single()
      .then(({ data }) => {
        if (data?.value) {
          try {
            setRoutinePresets(JSON.parse(data.value))
            setPresetSettingId(data.id)
          } catch {}
        }
      })
  }, [])

  async function saveRoutinePresets(presets: Record<string, { prods: { name: string, tip: string, id?: string }[] }>) {
    if (!presetSettingId) return
    setPresetSaving(true)
    const supabase = createClient()
    try {
      await supabase
        .from('admin_settings')
        .update({ value: JSON.stringify(presets), updated_at: new Date().toISOString() })
        .eq('id', presetSettingId)
      setRoutinePresets(presets)
    } catch (e) {
      console.error('프리셋 저장 실패:', e)
    } finally {
      setPresetSaving(false)
    }
  }

  async function searchExternalCustomers(q: string) {
    if (!q.trim()) { setCustomerResults([]); setShowCustomerDD(false); return }
    const supabase = createClient()
    const { data } = await supabase
      .from('external_customers')
      .select('id, name, phone, address, auran_user_id')
      .ilike('name', `%${q}%`)
      .limit(8)
    setCustomerResults(data || [])
    setShowCustomerDD(true)
  }

  function selectExternalCustomer(c: any) {
    setCustomerId(c.id)
    setCustomerName(c.name)
    setRecipientPhone(c.phone || '')
    setRecipientAddress(c.address || '')
    setCustomerResults([])
    setShowCustomerDD(false)
  }

  async function loadSavedCards() {
    const supabase = createClient()
    const { data } = await supabase
      .from('external_care_cards')
      .select('id, customer_name, created_at, card_data, courier, tracking_no, recipient_phone, recipient_address')
      .order('created_at', { ascending: false })
      .limit(50)
    if (data) setSavedCards(data)
    setShowCardList(true)
  }

  function applyCardData(card: any) {
    const d = card.card_data || {}
    setCustomerName(card.customer_name || '')
    setCourier(card.courier || '')
    setTrackingNo(card.tracking_no || '')
    setRecipientPhone(card.recipient_phone || '')
    setRecipientAddress(card.recipient_address || '')
    if (d.selProds) setSelProds(d.selProds)
    if (d.tipText !== undefined) setTipText(d.tipText)
    if (d.cmtText !== undefined) setCmtText(d.cmtText)
    if (d.bundleItems) setBundleItems(d.bundleItems)
    if (d.sampleItems) setSampleItems(d.sampleItems)
    if (d.routineCards) setRoutineCards(d.routineCards)
    if (d.giftTiers) setGiftTiers(d.giftTiers)
    if (d.giftTiersR) setGiftTiersR(d.giftTiersR)
    if (d.showRenobel !== undefined) setShowRenobel(d.showRenobel)
    if (d.totoOn !== undefined) setTotoOn(d.totoOn)
    if (d.totoCard) setTotoCard(d.totoCard)
    if (d.groupBuys) setGroupBuys(d.groupBuys)
    if (d.customEvents) setCustomEvents(d.customEvents)
    if (d.selectedDayOn !== undefined) setSelectedDayOn(d.selectedDayOn)
    if (d.selectedDayIdx !== undefined) setSelectedDayIdx(d.selectedDayIdx)
    setShowCardList(false)
  }

  async function saveCardToDB() {
    if (!customerName.trim()) return
    setSaveStatus('saving')
    const supabase = createClient()
    try {
      let cid = customerId
      // external_customers upsert
      if (!cid) {
        const { data: existing } = await supabase
          .from('external_customers')
          .select('id, auran_user_id')
          .eq('name', customerName.trim())
          .maybeSingle()
        if (existing) {
          cid = existing.id
          await supabase
            .from('external_customers')
            .update({
              phone: recipientPhone || null,
              address: recipientAddress || null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', cid)
        } else {
          const { data: newC } = await supabase
            .from('external_customers')
            .insert({
              name: customerName.trim(),
              phone: recipientPhone || null,
              address: recipientAddress || null,
            })
            .select('id')
            .single()
          if (newC) cid = newC.id
        }
        if (cid) setCustomerId(cid)
      }
      // external_care_cards insert
      const cardData = {
        selProds, tipText, cmtText, bundleItems, sampleItems,
        routineCards, giftTiers, giftTiersR, showRenobel,
        totoOn, totoCard, groupBuys, customEvents,
        selectedDayOn, selectedDayIdx,
      }
      await supabase.from('external_care_cards').upsert({
        customer_id: cid,
        customer_name: customerName.trim(),
        courier: courier || null,
        tracking_no: trackingNo || null,
        recipient_name: customerName.trim(),
        recipient_phone: recipientPhone || null,
        recipient_address: recipientAddress || null,
        card_data: cardData,
      })
      setSaveStatus('saved')
      localStorage.removeItem('auran_care_card_draft')
    } catch (e) {
      console.error('케어카드 저장 실패:', e)
      setSaveStatus('idle')
    }
  }

  useEffect(() => {
    const q = customerName.trim()
    if (q.length < 2) { setCustomerHistory(null); return }
    const t = setTimeout(async () => {
      const supabase = createClient()
      // users 기본 정보 조회
      const { data: userData } = await supabase
        .from('users')
        .select('id, full_name, phone, email, skin_type, skin_concerns')
        .ilike('full_name', `%${q}%`)
        .limit(1)
        .maybeSingle()
      if (!userData) { setCustomerHistory(null); return }
      // mode=member 일 때 orders 누적 조회
      if (initMode === 'member' && userData.id) {
        const { data: ordersData } = await supabase
          .from('orders')
          .select('id, final_amount, ordered_at, recipient_name, recipient_phone, address, order_items(product_name, quantity, product_price)')
          .eq('customer_id', userData.id)
          .order('ordered_at', { ascending: false })
          .limit(20)
        const totalAmt = (ordersData || []).reduce((s: number, o: any) => s + (o.final_amount || 0), 0)
        const latestOrder = ordersData?.[0]
        setCustomerHistory({
          ...userData,
          orders: ordersData || [],
          totalAmt,
          orderCount: (ordersData || []).length,
          // 최근 주문에서 배송정보 자동 채우기
          latestPhone: latestOrder?.recipient_phone || userData.phone || '',
          latestAddress: latestOrder?.address || '',
        })
        // 배송정보 자동 채우기
        if (latestOrder?.recipient_phone) setRecipientPhone(latestOrder.recipient_phone)
        if (latestOrder?.address) setRecipientAddress(latestOrder.address)
      } else {
        setCustomerHistory(userData)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [customerName, initMode])

  useEffect(() => {
    void searchExternalCustomers(customerName)
  }, [customerName])

  useEffect(() => {
    const q = prodSearch.trim()
    if (q.length < 1 && !brandFilter) { setProdResults([]); return }
    const t = setTimeout(() => {
      void searchProducts(q, brandFilter || undefined).then(setProdResults)
    }, 220)
    return () => clearTimeout(t)
  }, [prodSearch, brandFilter])

  useEffect(() => {
    const q = bundleSearch.trim()
    if (q.length < 1 && !brandFilter) { setBundleResults([]); return }
    const t = setTimeout(() => {
      void searchProducts(q, brandFilter || undefined).then(setBundleResults)
    }, 220)
    return () => clearTimeout(t)
  }, [bundleSearch, brandFilter])

  useEffect(() => {
    const q = sampleSearch.trim()
    if (q.length < 1 && !brandFilter) { setSampleResults([]); return }
    const t = setTimeout(() => {
      void searchProducts(q, brandFilter || undefined).then(setSampleResults)
    }, 220)
    return () => clearTimeout(t)
  }, [sampleSearch, brandFilter])

  useEffect(() => {
    const q = giftSearch.trim()
    if (q.length < 1) { setGiftResults([]); return }
    const t = setTimeout(() => { void searchProducts(q).then(setGiftResults) }, 220)
    return () => clearTimeout(t)
  }, [giftSearch])

  const addProd = (p: any) => {
    setSelProds(prev => [...prev, { id: p.id, name: p.name, price: p.sale_price || p.retail_price || 0, qty: 1 }])
    setProdSearch('')
    setProdResults([])
  }

  async function generateAiTip() {
    const prodNames = selProds.map((p: any) => p.name).join(', ')
    if (!prodNames) return
    setAiLoading(true)
    try {
      const res = await fetch('/api/generate-tip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName: prodNames,
          description: '',
          ingredients: '',
        }),
      })
      const data = await res.json()
      if (data.tip) setTipText(data.tip)
    } catch {
      setTipText('소량을 덜어 가볍게 눌러 흡수시켜 주세요 💜 꾸준히 사용하시면 더 좋은 결과를 느끼실 수 있어요.')
    } finally {
      setAiLoading(false)
    }
  }

  const toggleGiftTier = (tier: typeof GIFT_TIERS[0], renobel = false) => {
    const src = renobel ? giftTiersR : giftTiers
    const set = renobel ? setGiftTiersR : setGiftTiers
    const exists = src.find(x => x.id === tier.id)
    if (exists) set(src.filter(x => x.id !== tier.id))
    else set([...src, { ...tier, items: [] }])
  }

  const addGiftItem = (p: any) => {
    if (!activeGiftTier) return
    const upd = (list: any[]) => list.map(t => t.id === activeGiftTier ? { ...t, items: [...(t.items || []), { id: p.id, name: p.name }] } : t)
    if (giftTiers.find(t => t.id === activeGiftTier)) setGiftTiers(upd(giftTiers))
    else setGiftTiersR(upd(giftTiersR))
    setGiftSearch('')
    setGiftResults([])
  }

  async function searchRoutineProd(routineId: string, q: string) {
    setRoutineSearch(prev => ({ ...prev, [routineId]: q }))
    if (!q.trim()) { setRoutineSearchResults(prev => ({ ...prev, [routineId]: [] })); return }
    const results = await searchProducts(q)
    setRoutineSearchResults(prev => ({ ...prev, [routineId]: results }))
  }

  function addRoutineProd(routineId: string, prod: any) {
    setRoutineCards(prev => prev.map(r =>
      r.id === routineId
        ? { ...r, prods: r.prods ? [...r.prods.filter((p: any) => p.id !== prod.id), { ...prod, tip: '' }] : [{ ...prod, tip: '' }] }
        : r
    ))
    setRoutineSearch(prev => ({ ...prev, [routineId]: '' }))
    setRoutineSearchResults(prev => ({ ...prev, [routineId]: [] }))
  }

  function removeRoutineProd(routineId: string, prodId: string) {
    setRoutineCards(prev => prev.map(r =>
      r.id === routineId ? { ...r, prods: (r.prods || []).filter((p: any) => p.id !== prodId) } : r
    ))
  }

  function updateRoutineProdTip(routineId: string, prodId: string, tip: string) {
    setRoutineCards(prev => prev.map(r =>
      r.id === routineId
        ? { ...r, prods: (r.prods || []).map((p: any) => p.id === prodId ? { ...p, tip } : p) }
        : r
    ))
  }

  async function searchTotoProd(q: string) {
    setTotoSearch(q)
    if (!q.trim()) { setTotoResults([]); return }
    const results = await searchProducts(q)
    setTotoResults(results)
  }

  const handlePrint = async () => {
    // 팝업 차단 방지: 클릭 직후 바로 열기
    const w = window.open('', '_blank')
    if (!w) {
      alert('팝업이 차단됐어요. 브라우저 주소창 오른쪽 팝업 허용 후 다시 눌러주세요.')
      return
    }
    setLoading(true)
    try {
      await saveCardToDB()
      const html = buildPrintHTML({
        customerName, selProds, tipText, cmtText, bundleItems, sampleItems, routineCards,
        giftTiers, giftTiersR, showRenobel, totosOn: totoOn, totosCard: totoCard,
        courier, trackingNo, recipientPhone, recipientAddress,
        groupBuys, customEvents, selectedDayOn, dayEvent,
      })
      w.document.write(html)
      w.document.close()
    } catch (e) {
      console.error('인쇄 실패:', e)
      w.close()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ background: '#fff', color: '#111', padding: 20, minHeight: '100vh', fontWeight: 400 }}>
      {showPreview && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 9999,
          display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: '20px 0' }}>
          <div style={{ background: '#fff', borderRadius: 12, width: '90%', maxWidth: 720, margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '14px 20px', borderBottom: '0.5px solid #eee', position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
              <span style={{ fontSize: 14, color: '#7B5EA7' }}>케어카드 미리보기</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={handlePrint}
                  style={{ padding: '8px 18px', background: '#7B5EA7', color: '#fff', border: 'none', borderRadius: 7, fontSize: 12, cursor: 'pointer' }}>
                  🖨️ 인쇄하기
                </button>
                <button type="button" onClick={() => setShowPreview(false)}
                  style={{ padding: '8px 14px', background: '#f5f5f5', color: '#666', border: '0.5px solid #ddd', borderRadius: 7, fontSize: 12, cursor: 'pointer' }}>
                  닫기
                </button>
              </div>
            </div>
            <div style={{ padding: 20 }}>
              <iframe
                srcDoc={buildPrintHTML({
                  customerName, selProds, tipText, cmtText,
                  bundleItems, sampleItems, routineCards,
                  giftTiers, giftTiersR, showRenobel,
                  totosOn: totoOn, totosCard: totoCard,
                  courier, trackingNo, recipientPhone, recipientAddress,
                  groupBuys, customEvents, selectedDayOn, dayEvent,
                })}
                style={{ width: '100%', height: 800, border: 'none', borderRadius: 8 }}
                title="케어카드 미리보기"
              />
            </div>
          </div>
        </div>
      )}
      {showCardList && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 16, width: 480, maxHeight: '70vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 15, color: '#111' }}>저장된 케어카드</span>
              <button onClick={() => setShowCardList(false)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#888' }}>✕</button>
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {savedCards.length === 0 && (
                <div style={{ padding: 32, textAlign: 'center', color: '#aaa', fontSize: 14 }}>저장된 카드가 없어요</div>
              )}
              {savedCards.map((card) => (
                <div
                  key={card.id}
                  onClick={() => applyCardData(card)}
                  style={{ padding: '14px 20px', borderBottom: '1px solid #f0f0f0', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f9f5ff')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
                >
                  <div>
                    <div style={{ fontSize: 14, color: '#111' }}>{card.customer_name}</div>
                    <div style={{ fontSize: 12, color: '#999', marginTop: 3 }}>
                      {new Date(card.created_at).toLocaleDateString('ko-KR')} · 제품 {card.card_data?.selProds?.length || 0}개
                    </div>
                    {card.courier || card.tracking_no ? (
                      <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
                        {card.courier && `${card.courier} `}{card.tracking_no && `송장: ${card.tracking_no}`}
                      </div>
                    ) : null}
                    {card.recipient_phone && (
                      <div style={{ fontSize: 11, color: '#aaa', marginTop: 1 }}>{card.recipient_phone}</div>
                    )}
                  </div>
                  <span style={{ fontSize: 12, color: '#7B5EA7' }}>불러오기 →</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontSize: 16, color: '#7B5EA7', fontWeight: 400 }}>{initMode === 'member' ? '내부고객 케어카드' : '외부고객 케어카드'}</span>
        <button
          type="button"
          onClick={loadSavedCards}
          style={{ fontSize: 13, padding: '4px 12px', background: '#fff', border: '1px solid #c4b5d4', borderRadius: 8, color: '#7B5EA7', cursor: 'pointer', marginLeft: 12 }}
        >
          📋 저장된 카드
        </button>
        <button
          type="button"
          onClick={() => {
            if (window.opener) window.close()
            else window.history.back()
          }}
          style={{
            padding: '6px 14px', borderRadius: 7,
            border: '0.5px solid #ddd', background: '#f5f5f5',
            color: '#666', fontSize: 12, cursor: 'pointer',
          }}
        >
          ✕ 닫기
        </button>
      </div>
      {initMode === 'member' && (
        <div style={{
          display:'inline-flex', alignItems:'center', gap:6,
          padding:'4px 12px', borderRadius:100,
          background:'#f5f0f8', border:'0.5px solid #7B5EA7',
          fontSize:11, color:'#7B5EA7', marginBottom:12
        }}>
          💜 오랜 공식 멤버십 케어카드
          {initOrderId && <span style={{color:'#bbb', fontSize:10}}>· 주문 {initOrderId.slice(0,8)}</span>}
        </div>
      )}
      {initMode === 'external' && (
        <div style={{
          display:'inline-flex', alignItems:'center', gap:6,
          padding:'4px 12px', borderRadius:100,
          background:'#fdf8ee', border:'0.5px solid #C9A96E',
          fontSize:11, color:'#854F0B', marginBottom:12
        }}>
          📦 외부고객 케어카드 모드
          {initOrderId && <span style={{color:'#bbb', fontSize:10}}>· 주문 {initOrderId.slice(0,8)}</span>}
        </div>
      )}

      <div style={{ marginBottom: 16, padding: '12px 16px', background: '#f9f7fc', borderRadius: 10, border: '0.5px solid #e8e0f0' }}>
        <div style={{ fontSize: 10, color: '#7B5EA7', letterSpacing: '.12em', marginBottom: 8 }}>브랜드 필터 — 선택하면 전체 검색창에 적용돼요</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          <button type="button"
            onClick={() => setBrandFilter('')}
            style={{ padding: '4px 12px', borderRadius: 100, border: brandFilter === '' ? '1.5px solid #7B5EA7' : '0.5px solid #ddd',
              background: brandFilter === '' ? '#7B5EA7' : '#fff',
              color: brandFilter === '' ? '#fff' : '#888', fontSize: 11, cursor: 'pointer' }}>
            전체
          </button>
          {brandList.map(b => (
            <button key={b.id} type="button"
              onClick={() => setBrandFilter(brandFilter === b.id ? '' : b.id)}
              style={{ padding: '4px 12px', borderRadius: 100,
                border: brandFilter === b.id ? '1.5px solid #7B5EA7' : '0.5px solid #ddd',
                background: brandFilter === b.id ? '#f5f0f8' : '#fff',
                color: brandFilter === b.id ? '#7B5EA7' : '#888', fontSize: 11, cursor: 'pointer' }}>
              {b.name}
            </button>
          ))}
        </div>
      </div>

      {/* 1. 고객 정보 */}
      <section style={{ marginBottom: 24 }}>
        <div style={secTitle}>1. 고객 정보</div>
        {/* 고객명 검색 */}
        <div style={{ marginBottom: 10 }}>
          <div style={lbl}>고객 이름</div>
          <div style={{ position: 'relative' }}>
            <input
              value={customerName}
              onChange={e => {
                setCustomerName(e.target.value)
                setCustomerId(null)
              }}
              placeholder="이름 입력 또는 기존 고객 검색..."
              style={inp}
            />
            {showCustomerDD && customerResults.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0,
                background: '#fff', border: '0.5px solid #C9A96E', borderRadius: 10,
                zIndex: 40, boxShadow: '0 6px 24px rgba(0,0,0,.1)',
                maxHeight: 220, overflowY: 'auto' as const }}>
                {customerResults.map((c: any) => (
                  <div key={c.id} onClick={() => selectExternalCustomer(c)}
                    style={{ padding: '10px 14px', fontSize: 12, cursor: 'pointer',
                      borderBottom: '0.5px solid #f5efe8', display: 'flex',
                      justifyContent: 'space-between', alignItems: 'center' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#fdf8f2')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ color: '#111' }}>{c.name}</span>
                      {c.auran_user_id && (
                        <span style={{ fontSize: 9, color: '#7B5EA7',
                          background: '#f5f0f8', border: '0.5px solid #7B5EA7',
                          borderRadius: 6, padding: '1px 6px' }}>
                          💜 오랜 공식 멤버
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: 10, color: '#bbb' }}>{c.phone || ''}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        {/* 오랜 공식 멤버 배지 */}
        {customerId && customerResults.find((c: any) => c.id === customerId)?.auran_user_id && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '3px 10px', borderRadius: 100,
            background: '#f5f0f8', border: '0.5px solid #7B5EA7',
            fontSize: 11, color: '#7B5EA7', marginBottom: 10 }}>
            💜 오랜 공식 멤버십 고객
          </div>
        )}
        {customerHistory && initMode === 'member' && (
          <div style={{ marginTop: 10, background: '#f9f7fc',
            border: '0.5px solid #e8e0f0', borderRadius: 10, padding: 14 }}>
            <div style={{ fontSize: 10, color: '#7B5EA7', letterSpacing: '.12em', marginBottom: 10 }}>
              💜 오랜 공식 멤버 정보
            </div>
            {/* 기본 정보 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
              <div>
                <div style={lbl}>이름</div>
                <div style={{ fontSize: 12, color: '#333' }}>{customerHistory.full_name || '-'}</div>
              </div>
              <div>
                <div style={lbl}>연락처</div>
                <div style={{ fontSize: 12, color: '#333' }}>{customerHistory.latestPhone || customerHistory.phone || '-'}</div>
              </div>
              <div>
                <div style={lbl}>피부타입</div>
                <div style={{ fontSize: 12, color: '#333' }}>{customerHistory.skin_type || '-'}</div>
              </div>
              <div>
                <div style={lbl}>피부고민</div>
                <div style={{ fontSize: 12, color: '#333' }}>
                  {Array.isArray(customerHistory.skin_concerns) && customerHistory.skin_concerns.length
                    ? customerHistory.skin_concerns.join(', ') : '-'}
                </div>
              </div>
            </div>
            {/* 구매 누계 */}
            <div style={{ display: 'flex', gap: 12, padding: '10px 0',
              borderTop: '0.5px solid #e8e0f0', borderBottom: '0.5px solid #e8e0f0',
              marginBottom: 10 }}>
              <div style={{ flex: 1, textAlign: 'center' as const }}>
                <div style={{ fontSize: 16, color: '#7B5EA7' }}>
                  ₩{(customerHistory.totalAmt || 0).toLocaleString()}
                </div>
                <div style={{ fontSize: 9, color: '#bbb', marginTop: 2 }}>누적 구매액</div>
              </div>
              <div style={{ flex: 1, textAlign: 'center' as const }}>
                <div style={{ fontSize: 16, color: '#7B5EA7' }}>{customerHistory.orderCount || 0}회</div>
                <div style={{ fontSize: 9, color: '#bbb', marginTop: 2 }}>총 주문 횟수</div>
              </div>
              <div style={{ flex: 1, textAlign: 'center' as const }}>
                <div style={{ fontSize: 16, color: '#7B5EA7' }}>
                  {customerHistory.orders?.[0]
                    ? new Date(customerHistory.orders[0].ordered_at).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })
                    : '-'}
                </div>
                <div style={{ fontSize: 9, color: '#bbb', marginTop: 2 }}>최근 구매</div>
              </div>
            </div>
            {/* 최근 주문 내역 */}
            {(customerHistory.orders || []).slice(0, 5).map((o: any) => (
              <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between',
                padding: '6px 0', borderBottom: '0.5px solid #f5efe8', fontSize: 11 }}>
                <div style={{ color: '#888', fontSize: 10, minWidth: 60 }}>
                  {new Date(o.ordered_at).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })}
                </div>
                <div style={{ flex: 1, color: '#333', lineHeight: 1.5 }}>
                  {(o.order_items || []).map((i: any) => i.product_name).join(', ')}
                </div>
                <div style={{ color: '#7B5EA7', whiteSpace: 'nowrap' as const, marginLeft: 8 }}>
                  ₩{(o.final_amount || 0).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
        {customerHistory && initMode !== 'member' && (
          <div style={{ marginTop: 8, fontSize: 12, color: '#534AB7', lineHeight: 1.6 }}>
            오랜 회원: {customerHistory.full_name || '-'} · 피부타입 {customerHistory.skin_type || '-'}
            {Array.isArray(customerHistory.skin_concerns) && customerHistory.skin_concerns.length
              ? ` · ${customerHistory.skin_concerns.join(', ')}` : ''}
          </div>
        )}
        {/* 배송 정보 */}
        <div style={{ background: '#fafafa', border: '0.5px solid #eee',
          borderRadius: 10, padding: 14, marginTop: 10 }}>
          <div style={{ fontSize: 10, color: '#C9A96E', letterSpacing: '.12em', marginBottom: 10 }}>
            배송 정보 (선택)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
            <div>
              <div style={lbl}>연락처</div>
              <input value={recipientPhone} onChange={e => setRecipientPhone(e.target.value)}
                placeholder="010-0000-0000" style={inp} />
            </div>
            <div>
              <div style={lbl}>택배사</div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' as const }}>
                {['CJ대한통운', '롯데택배', '한진택배', '우체국', '로젠택배'].map(c => (
                  <button key={c} type="button" onClick={() => setCourier(courier === c ? '' : c)}
                    style={{ padding: '4px 8px', borderRadius: 6,
                      border: courier === c ? '1.5px solid #7B5EA7' : '0.5px solid #ddd',
                      background: courier === c ? '#f5f0f8' : '#fff',
                      color: courier === c ? '#7B5EA7' : '#888',
                      fontSize: 10, cursor: 'pointer' }}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div style={lbl}>송장번호</div>
              <input value={trackingNo} onChange={e => setTrackingNo(e.target.value)}
                placeholder="송장번호 직접 입력" style={inp} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <div style={lbl}>주소</div>
              <input value={recipientAddress} onChange={e => setRecipientAddress(e.target.value)}
                placeholder="배송지 주소" style={inp} />
            </div>
          </div>
        </div>
        {saveStatus === 'saved' && (
          <div style={{ marginTop: 8, fontSize: 11, color: '#7B5EA7', textAlign: 'center' as const }}>
            💜 저장됐어요
          </div>
        )}
      </section>

      {/* 2. 구매 제품 */}
      <section style={{ marginBottom: 24 }} ref={prodRef}>
        <div style={secTitle}>2. 구매 제품</div>
        <input value={prodSearch} onChange={e => setProdSearch(e.target.value)} placeholder="제품명 검색" style={inp} />
        {prodResults.length > 0 ? (
          <div style={{ border: '0.5px solid #eee', borderRadius: 8, marginTop: 6, overflow: 'hidden' }}>
            {prodResults.map(p => (
              <button key={p.id} type="button" onClick={() => addProd(p)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none', borderBottom: '0.5px solid #f0f0f0', background: '#fff', color: '#111', fontSize: 12, cursor: 'pointer' }}>
                {p.name}
              </button>
            ))}
          </div>
        ) : null}
        {selProds.map((p, i) => (
          <div key={p.id + i} style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
            <span style={{ flex: 1, fontSize: 12 }}>{p.name}</span>
            <input type="number" value={p.qty} onChange={e => setSelProds(prev => prev.map((x, j) => j === i ? { ...x, qty: Number(e.target.value) } : x))} style={{ ...inp, width: 60 }} />
            <input type="number" value={p.price} onChange={e => setSelProds(prev => prev.map((x, j) => j === i ? { ...x, price: Number(e.target.value) } : x))} style={{ ...inp, width: 100 }} />
            <button type="button" onClick={() => setSelProds(prev => prev.filter((_, j) => j !== i))} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#999' }}>✕</button>
          </div>
        ))}
      </section>

      {/* 3. 사용법/팁 */}
      <section style={{ marginBottom: 24 }}>
        <div style={secTitle}>3. 사용법 · 팁</div>
        <div style={lbl}>사용법 / 팁</div>
        <button
          type="button"
          onClick={generateAiTip}
          disabled={aiLoading || selProds.length === 0}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '7px 16px', marginBottom: 8,
            background: '#f5f0f8', border: '0.5px solid #e0d8f0',
            borderRadius: 100, fontSize: 11, color: '#7B5EA7',
            cursor: selProds.length === 0 ? 'not-allowed' : 'pointer',
            opacity: selProds.length === 0 ? 0.5 : 1,
          }}
        >
          {aiLoading ? '✦ 생성 중...' : '✦ AI 팁 자동생성'}
        </button>
        <textarea value={tipText} onChange={e => setTipText(e.target.value)} rows={3} placeholder="제품 사용법과 팁" style={{ ...inp, resize: 'vertical' }} />
        <div style={{ ...lbl, marginTop: 10 }}>맑원장 코멘트</div>
        <textarea value={cmtText} onChange={e => setCmtText(e.target.value)} rows={2} placeholder="고객에게 전달할 코멘트" style={{ ...inp, resize: 'vertical' }} />
      </section>

      {/* 4. 함께 쓰면 좋은 제품 */}
      <section style={{ marginBottom: 24 }}>
        <div style={secTitle}>4. 함께 쓰면 좋은 제품 (최대 6개)</div>
        <input value={bundleSearch} onChange={e => setBundleSearch(e.target.value)} placeholder="제품 검색" style={inp} disabled={bundleItems.length >= 6} />
        {bundleResults.map(p => (
          <button key={p.id} type="button" disabled={bundleItems.length >= 6} onClick={() => { if (bundleItems.length < 6) { setBundleItems(prev => [...prev, { ...p, tip: '' }]); setBundleSearch(''); setBundleResults([]) } }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 12px', border: 'none', background: '#fafafa', fontSize: 12, cursor: 'pointer' }}>{p.name}</button>
        ))}
        {bundleItems.map((p, i) => (
          <div key={p.id + i} style={{ marginTop: 8 }}>
            <div style={{ fontSize: 12 }}>{p.name}</div>
            <input value={p.tip || ''} onChange={e => setBundleItems(prev => prev.map((x, j) => j === i ? { ...x, tip: e.target.value } : x))} placeholder="제품별 팁" style={{ ...inp, marginTop: 4 }} />
          </div>
        ))}
      </section>

      {/* 5. 동봉 샘플 */}
      <section style={{ marginBottom: 24 }}>
        <div style={secTitle}>5. 동봉 샘플</div>
        <input value={sampleSearch} onChange={e => setSampleSearch(e.target.value)} placeholder="샘플 제품 검색" style={inp} />
        {sampleResults.map(p => (
          <button key={p.id} type="button" onClick={() => { setSampleItems(prev => [...prev, p]); setSampleSearch(''); setSampleResults([]) }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 12px', border: 'none', background: '#fafafa', fontSize: 12, cursor: 'pointer' }}>{p.name}</button>
        ))}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          {sampleItems.map((p, i) => (
            <span key={p.id + i} style={{ fontSize: 11, border: '0.5px solid #C9A96E', borderRadius: 12, padding: '4px 10px' }}>샘플 · {p.name} <button type="button" onClick={() => setSampleItems(prev => prev.filter((_, j) => j !== i))} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}>✕</button></span>
          ))}
        </div>
      </section>

      {/* 6. 루틴 케어 카드 */}
      <section style={{ marginBottom: 24 }}>
        <div style={secTitle}>6. 루틴 케어 카드</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {ROUTINE_PRESETS.map(r => (
            <button key={r.id} type="button"
              onClick={() => setRoutineCards(prev => {
                if (prev.find(x => x.id === r.id)) {
                  return prev.filter(x => x.id !== r.id)
                }
                // 프리셋에서 샘플 자동 세팅
                const preset = routinePresets[r.id]
                const presetProds = preset?.prods || []
                return [...prev, {
                  id: r.id, name: r.name, tag: r.tag, desc: r.desc,
                  prods: presetProds,
                  routineTitle: '', routineMemo: '',
                }]
              })}
              style={{
                padding: '6px 14px', borderRadius: 100,
                border: routineCards.find(x => x.id === r.id) ? '1.5px solid #7B5EA7' : '0.5px solid #ddd',
                background: routineCards.find(x => x.id === r.id) ? '#f5f0f8' : '#fff',
                color: routineCards.find(x => x.id === r.id) ? '#7B5EA7' : '#888',
                fontSize: 12, cursor: 'pointer',
              }}
            >{r.tag} {r.name}</button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setRoutineCards(prev => [
            ...prev,
            {
              id: `custom_${Date.now()}`,
              name: '직접 입력',
              tag: '✦ 커스텀',
              desc: '',
              prods: [],
              routineTitle: '',
              routineMemo: '',
            },
          ])}
          style={{
            marginTop: 10,
            width: '100%',
            padding: '8px 0',
            borderRadius: 8,
            border: '0.5px dashed #7B5EA7',
            background: '#f5f0f8',
            color: '#7B5EA7',
            fontSize: 12,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          + 루틴 카드 직접 추가
        </button>
        {routineCards.map(r => (
          <div key={r.id} style={{ border: '0.5px solid #e8e0d8', borderRadius: 10, padding: 14, marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: '#7B5EA7' }}>{r.tag} {r.name}</span>
              <button type="button" onClick={() => setRoutineCards(prev => prev.filter(x => x.id !== r.id))}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#bbb', fontSize: 16 }}>×</button>
            </div>
            <div style={{ fontSize: 10, color: '#888', marginBottom: 8, fontStyle: 'italic' }}>{r.desc}</div>
            <input
              value={routineSearch[r.id] || ''}
              onChange={e => searchRoutineProd(r.id, e.target.value)}
              placeholder="샘플 제품 검색..."
              style={{ width: '100%', padding: '7px 10px', border: '0.5px solid #eee', borderRadius: 7, fontSize: 12, marginBottom: 6, boxSizing: 'border-box' as const }}
            />
            {(routineSearchResults[r.id] || []).length > 0 && (
              <div style={{ border: '0.5px solid #C9A96E', borderRadius: 8, overflow: 'hidden', marginBottom: 6 }}>
                {(routineSearchResults[r.id] || []).map((p: any) => (
                  <div key={p.id} onClick={() => addRoutineProd(r.id, p)}
                    style={{ padding: '8px 12px', fontSize: 12, cursor: 'pointer', borderBottom: '0.5px solid #f5efe8' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#fdf8f2')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
                  >{p.name}</div>
                ))}
              </div>
            )}
            {(r.prods || []).map((p: any) => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '0.5px solid #f5efe8' }}>
                <span style={{ flex: 1, fontSize: 12, color: '#333' }}>{p.name}</span>
                <input value={p.tip || ''} onChange={e => updateRoutineProdTip(r.id, p.id, e.target.value)}
                  placeholder="사용법 한 줄"
                  style={{ width: 160, padding: '4px 7px', border: '0.5px solid #eee', borderRadius: 5, fontSize: 11 }} />
                <button type="button" onClick={() => removeRoutineProd(r.id, p.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ddd', fontSize: 14 }}>×</button>
              </div>
            ))}
            <div style={{ marginTop: 10, borderTop: '0.5px solid #f5efe8', paddingTop: 10 }}>
              <div style={{ fontSize: 9, color: '#C9A96E', letterSpacing: '.15em', marginBottom: 5 }}>
                ✦ 관리실 루틴 예시 제목
              </div>
              <input
                value={r.routineTitle || ''}
                onChange={e => setRoutineCards(prev => prev.map(x =>
                  x.id === r.id ? { ...x, routineTitle: e.target.value } : x
                ))}
                placeholder="예: 부티나고 찬란하게 빛내줄 황금기 집중 루틴"
                style={{ width: '100%', padding: '7px 10px', border: '0.5px solid #eee',
                  borderRadius: 7, fontSize: 12, marginBottom: 8, boxSizing: 'border-box' as const }}
              />
              <div style={{ fontSize: 9, color: '#C9A96E', letterSpacing: '.15em', marginBottom: 5 }}>
                ✦ 원장님 루틴 멘트
              </div>
              <textarea
                value={r.routineMemo || ''}
                onChange={e => setRoutineCards(prev => prev.map(x =>
                  x.id === r.id ? { ...x, routineMemo: e.target.value } : x
                ))}
                placeholder="이 루틴을 추천하는 이유, 주의점, 함께 쓰는 팁을 자유롭게 적어주세요"
                rows={3}
                style={{ width: '100%', padding: '7px 10px', border: '0.5px solid #eee',
                  borderRadius: 7, fontSize: 12, resize: 'none' as const,
                  lineHeight: 1.7, boxSizing: 'border-box' as const }}
              />
            </div>
          </div>
        ))}
        {routineCards.length > 0 && (
          <div style={{
            marginTop: 12, padding: '10px 14px',
            background: '#f9f7fc', border: '0.5px solid #e8e0f0',
            borderRadius: 8, display: 'flex',
            justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{ fontSize: 11, color: '#888' }}>
              지금 제품 구성을 기본값으로 저장하면 다음에도 자동 세팅돼요
            </span>
            <button
              type="button"
              onClick={async () => {
                // 현재 루틴 카드 구성을 프리셋으로 저장
                const newPresets = { ...routinePresets }
                routineCards.forEach((card: any) => {
                  newPresets[card.id] = { prods: (card.prods || []).map((p: any) => ({
                    name: p.name, tip: p.tip || '', id: p.id || '',
                  })) }
                })
                await saveRoutinePresets(newPresets)
                alert('기본 샘플 세트가 저장됐어요 💜')
              }}
              disabled={presetSaving}
              style={{
                padding: '6px 14px', borderRadius: 7,
                border: '1.5px solid #7B5EA7', background: '#f5f0f8',
                color: '#7B5EA7', fontSize: 11, cursor: 'pointer',
                whiteSpace: 'nowrap' as const, marginLeft: 12,
              }}
            >
              {presetSaving ? '저장 중...' : '💜 기본값으로 저장'}
            </button>
          </div>
        )}
      </section>

      {/* 7. 금액별 선물 */}
      <section style={{ marginBottom: 24 }}>
        <div style={secTitle}>7. 금액별 선물</div>
        {GIFT_TIERS.map(t => (
          <label key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontSize: 12 }}>
            <input type="checkbox" checked={!!giftTiers.find(x => x.id === t.id)} onChange={() => toggleGiftTier(t)} />
            {t.label}
            {giftTiers.find(x => x.id === t.id) ? (
              <button type="button" onClick={() => setActiveGiftTier(t.id)} style={{ marginLeft: 8, fontSize: 10, padding: '2px 8px', border: '0.5px solid #C9A96E', borderRadius: 6, background: activeGiftTier === t.id ? '#fdf8ee' : '#fff', cursor: 'pointer' }}>제품 추가</button>
            ) : null}
          </label>
        ))}
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontSize: 12 }}>
          <input type="checkbox" checked={showRenobel} onChange={e => setShowRenobel(e.target.checked)} />
          르노벨 선물 티어 표시
        </label>
        {showRenobel ? GIFT_TIERS_RENOBEL.map(t => (
          <label key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontSize: 12, marginLeft: 16 }}>
            <input type="checkbox" checked={!!giftTiersR.find(x => x.id === t.id)} onChange={() => toggleGiftTier(t, true)} />
            {t.label}
            {giftTiersR.find(x => x.id === t.id) ? (
              <button type="button" onClick={() => setActiveGiftTier(t.id)} style={{ marginLeft: 8, fontSize: 10, padding: '2px 8px', border: '0.5px solid #C9A96E', borderRadius: 6, background: activeGiftTier === t.id ? '#fdf8ee' : '#fff', cursor: 'pointer' }}>제품 추가</button>
            ) : null}
          </label>
        )) : null}
        {activeGiftTier ? (
          <div style={{ marginTop: 8 }}>
            <input value={giftSearch} onChange={e => setGiftSearch(e.target.value)} placeholder="선물 제품 검색" style={inp} />
            {giftResults.map(p => (
              <button key={p.id} type="button" onClick={() => addGiftItem(p)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 12px', border: 'none', background: '#fafafa', fontSize: 12, cursor: 'pointer' }}>{p.name}</button>
            ))}
          </div>
        ) : null}
      </section>

      {/* 8. 또또복권 */}
      <section style={{ marginBottom: 24 }}>
        <div style={secTitle}>8. 또또복권 당첨</div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, marginBottom: 8 }}>
          <input type="checkbox" checked={totoOn} onChange={e => setTotoOn(e.target.checked)} />
          또또복권 카드 포함
        </label>
        {totoOn ? (
          <div style={{ display: 'grid', gap: 8 }}>
            <input
              value={totoSearch}
              onChange={e => searchTotoProd(e.target.value)}
              placeholder="당첨 선물 제품 검색..."
              style={{ width: '100%', padding: '8px 12px', border: '0.5px solid #F0D878', borderRadius: 8, fontSize: 12, marginBottom: 6, boxSizing: 'border-box' as const, background: '#FFFDF6' }}
            />
            {totoResults.length > 0 && (
              <div style={{ border: '0.5px solid #C9A96E', borderRadius: 8, overflow: 'hidden', marginBottom: 8 }}>
                {totoResults.map((p: any) => (
                  <div key={p.id}
                    onClick={() => {
                      setTotoCard(prev => ({ ...prev, name: p.name, ico: '🎁' }))
                      setTotoSearch(p.name)
                      setTotoResults([])
                    }}
                    style={{ padding: '8px 12px', fontSize: 12, cursor: 'pointer', borderBottom: '0.5px solid #f5efe8' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#fdf8f2')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
                  >{p.name}</div>
                ))}
              </div>
            )}
            <input value={totoCard.ico} onChange={e => setTotoCard({ ...totoCard, ico: e.target.value })} placeholder="아이콘 (이모지)" style={inp} />
            <input value={totoCard.tip} onChange={e => setTotoCard({ ...totoCard, tip: e.target.value })} placeholder="사용 팁" style={inp} />
            <input value={totoCard.memo} onChange={e => setTotoCard({ ...totoCard, memo: e.target.value })} placeholder="메모" style={inp} />
          </div>
        ) : null}
      </section>

      {/* 9. 이벤트 안내 */}
      <section style={{ marginBottom: 24 }}>
        <div style={secTitle}>9. 이벤트 안내</div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, marginBottom: 8 }}>
          <input type="checkbox" checked={selectedDayOn} onChange={e => setSelectedDayOn(e.target.checked)} />
          날마다 행복데이 — {dayEvent.name}
        </label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '8px 0' }}>
          {[0, 1, 2, 3, 4, 5, 6].map(i => (
            <button key={i} type="button"
              onClick={() => setSelectedDayIdx(i)}
              style={{
                padding: '4px 10px', borderRadius: 100, fontSize: 11, cursor: 'pointer',
                border: selectedDayIdx === i ? '1.5px solid #7B5EA7' : '0.5px solid #ddd',
                background: selectedDayIdx === i ? '#f5f0f8' : '#fff',
                color: selectedDayIdx === i ? '#7B5EA7' : '#888',
              }}
            >{['일', '월', '화', '수', '목', '금', '토'][i]}요일</button>
          ))}
        </div>
        {selectedDayOn ? (
          <div style={{ fontSize: 12, color: '#534AB7', lineHeight: 1.7, marginBottom: 12, padding: 10, border: '0.5px solid #eee', borderRadius: 8 }}>
            <div>{dayEvent.title}</div>
            <div style={{ fontSize: 11, marginTop: 4 }}>{dayEvent.sub}</div>
          </div>
        ) : null}
        <div style={{ fontSize: 11, color: '#888', marginBottom: 6 }}>진행중 공구 (자동)</div>
        {groupBuys.map((g, i) => (
          <div key={i} style={{ fontSize: 12, marginBottom: 4 }}>{g.name} — {g.desc} {g.period}</div>
        ))}
        <div style={{ fontSize: 11, color: '#888', margin: '12px 0 6px' }}>직접 입력 이벤트</div>
        {customEvents.map((ev, i) => (
          <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
            <input value={ev.name} onChange={e => setCustomEvents(prev => prev.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} placeholder="이벤트명" style={inp} />
            <input value={ev.desc || ''} onChange={e => setCustomEvents(prev => prev.map((x, j) => j === i ? { ...x, desc: e.target.value } : x))} placeholder="설명" style={inp} />
            <button type="button" onClick={() => setCustomEvents(prev => prev.filter((_, j) => j !== i))} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}>✕</button>
          </div>
        ))}
        <button type="button" onClick={() => setCustomEvents(prev => [...prev, { name: '', desc: '' }])} style={{ padding: '6px 12px', border: '0.5px solid #7B5EA7', borderRadius: 8, background: '#f5f0ff', color: '#534AB7', fontSize: 11, cursor: 'pointer' }}>+ 이벤트 추가</button>
      </section>

      {/* 10. 인쇄 */}
      <button type="button"
        onClick={() => {
          const data = {
            customerName, selProds, tipText, cmtText,
            bundleItems, sampleItems, routineCards,
            giftTiers, giftTiersR, showRenobel,
            totoOn, totoCard, groupBuys, customEvents,
            selectedDayOn, selectedDayIdx,
            courier, trackingNo, recipientPhone, recipientAddress,
          }
          localStorage.setItem('auran_care_card_draft', JSON.stringify(data))
          alert('임시저장 됐어요 💜')
        }}
        style={{ width: '100%', padding: '11px 0', borderRadius: 10, border: '0.5px solid #C9A96E',
          background: '#FFFDF6', color: '#854F0B', fontSize: 13, cursor: 'pointer', marginBottom: 8 }}>
        💾 임시저장
      </button>
      <button type="button"
        onClick={() => setShowPreview(true)}
        style={{ width: '100%', padding: '11px 0', borderRadius: 10, border: '0.5px solid #7B5EA7',
          background: '#f5f0f8', color: '#7B5EA7', fontSize: 13, cursor: 'pointer', marginBottom: 8 }}>
        👁 미리보기
      </button>
      <button type="button" onClick={handlePrint} disabled={loading} style={{ width: '100%', padding: '14px 0', borderRadius: 10, border: 'none', background: '#7B5EA7', color: '#fff', fontSize: 14, fontWeight: 400, cursor: loading ? 'not-allowed' : 'pointer' }}>
        {loading ? '준비 중...' : '🖨️ 케어카드 인쇄하기'}
      </button>
    </div>
  )
}

export default function ExternalCardsPageWrapper() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: 'center', color: '#888' }}>로딩 중...</div>}>
      <ExternalCardsPage />
    </Suspense>
  )
}
