'use client'

import { createClient } from '@/lib/supabase/client'
import { useEffect, useState, useRef } from 'react'

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

async function searchProducts(q: string) {
  if (!q.trim()) return []
  const supabase = createClient()
  const { data } = await supabase
    .from('products')
    .select('id, name, thumb_img, retail_price, sale_price')
    .ilike('name', `%${q}%`)
    .eq('is_active', true)
    .limit(8)
  return data || []
}

function generateQRMatrix(text: string): boolean[][] {
  const size = 21
  const m: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false))
  let h = 0
  for (let i = 0; i < text.length; i++) h = ((h << 5) - h + text.charCodeAt(i)) | 0
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const v = (x * 7 + y * 11 + h + (x ^ y)) % 17
      m[y][x] = v < 8
    }
  }
  const drawFinder = (fx: number, fy: number) => {
    for (let dy = 0; dy < 7; dy++) {
      for (let dx = 0; dx < 7; dx++) {
        const on = dx === 0 || dx === 6 || dy === 0 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4)
        if (fy + dy < size && fx + dx < size) m[fy + dy][fx + dx] = on
      }
    }
  }
  drawFinder(0, 0)
  drawFinder(size - 7, 0)
  drawFinder(0, size - 7)
  return m
}

function generateQRDataURL(text: string, size: number): string {
  const matrix = generateQRMatrix(text)
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''
  const n = matrix.length
  const cell = size / n
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, size, size)
  ctx.fillStyle = '#111'
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (matrix[y][x]) ctx.fillRect(x * cell, y * cell, cell, cell)
    }
  }
  return canvas.toDataURL('image/png')
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
}

function buildPrintHTML(p: PrintPayload): string {
  const qr = generateQRDataURL('https://www.auran.kr', 120)
  const prods = p.selProds.map(x => `<tr><td>${esc(x.name)}</td><td style="text-align:center">${x.qty || 1}</td><td style="text-align:right">₩${Number(x.price || 0).toLocaleString()}</td></tr>`).join('')
  const bundle = p.bundleItems.map(x => `<div class="chip">${esc(x.name)}${x.tip ? `<div class="sub">${esc(x.tip)}</div>` : ''}</div>`).join('')
  const samples = p.sampleItems.map(x => `<span class="badge">${esc(x.name)}</span>`).join(' ')
  const routines = p.routineCards.map(x => `<div class="box"><div class="tag">${esc(x.tag || '')}</div><div>${esc(x.name)}</div><div class="sub">${esc(x.desc || '')}</div></div>`).join('')
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
  .qr { float: right; width: 80px; }
  .footer { text-align: right; font-size: 9px; color: #bbb; margin-top: 20px; }
</style></head><body>
<div class="no-print" style="margin-bottom:16px;">
  <button onclick="window.print()" style="padding:8px 20px;background:#7B5EA7;color:#fff;border:none;border-radius:7px;font-size:12px;cursor:pointer;">🖨️ 인쇄</button>
  <button onclick="window.close()" style="padding:8px 16px;background:#f5f5f5;color:#666;border:0.5px solid #ddd;border-radius:7px;font-size:12px;cursor:pointer;margin-left:8px;">닫기</button>
</div>
<h1>✦ AURAN 외부고객 케어카드</h1>
<div class="sec"><div class="lbl">고객</div><div>${esc(p.customerName || '고객')}님</div></div>
<div class="sec"><div class="lbl">구매 제품</div><table><thead><tr><th>상품</th><th>수량</th><th>금액</th></tr></thead><tbody>${prods || '<tr><td colspan="3">없음</td></tr>'}</tbody></table></div>
<div class="sec"><div class="lbl">사용법 · 팁</div><div>${esc(p.tipText)}</div></div>
<div class="sec"><div class="lbl">맑원장 코멘트</div><div class="sub">${esc(p.cmtText)}</div><img class="qr" src="${qr}" alt="QR" /></div>
${bundle ? `<div class="sec"><div class="lbl">함께 쓰면 좋은 제품</div>${bundle}</div>` : ''}
${samples ? `<div class="sec"><div class="lbl">동봉 샘플</div>${samples}</div>` : ''}
${routines ? `<div class="sec"><div class="lbl">루틴 케어</div>${routines}</div>` : ''}
${gifts ? `<div class="sec"><div class="lbl">금액별 선물</div>${gifts}</div>` : ''}
${toto}
${events ? `<div class="sec"><div class="lbl">이벤트 안내</div>${events}</div>` : ''}
<div class="footer">auran.kr · 스킨파우더룸 · since 2006</div>
</body></html>`
}

export default function ExternalCardsPage() {
  const [customerName, setCustomerName] = useState('')
  const [customerHistory, setCustomerHistory] = useState<any>(null)
  const [selProds, setSelProds] = useState<any[]>([])
  const [prodSearch, setProdSearch] = useState('')
  const [prodResults, setProdResults] = useState<any[]>([])
  const [tipText, setTipText] = useState('')
  const [cmtText, setCmtText] = useState('')
  const [bundleItems, setBundleItems] = useState<any[]>([])
  const [bundleSearch, setBundleSearch] = useState('')
  const [bundleResults, setBundleResults] = useState<any[]>([])
  const [sampleItems, setSampleItems] = useState<any[]>([])
  const [sampleSearch, setSampleSearch] = useState('')
  const [sampleResults, setSampleResults] = useState<any[]>([])
  const [routineCards, setRoutineCards] = useState<any[]>([])
  const [giftTiers, setGiftTiers] = useState<any[]>([])
  const [giftTiersR, setGiftTiersR] = useState<any[]>([])
  const [showRenobel, setShowRenobel] = useState(false)
  const [totoOn, setTotoOn] = useState(false)
  const [totoCard, setTotoCard] = useState({ ico: '', name: '', tip: '', memo: '' })
  const [groupBuys, setGroupBuys] = useState<any[]>([])
  const [customEvents, setCustomEvents] = useState<any[]>([])
  const [selectedDayOn, setSelectedDayOn] = useState(true)
  const [loading, setLoading] = useState(false)
  const [giftSearch, setGiftSearch] = useState('')
  const [giftResults, setGiftResults] = useState<any[]>([])
  const [activeGiftTier, setActiveGiftTier] = useState<string | null>(null)
  const prodRef = useRef<HTMLDivElement>(null)

  const dayEvent = DAY_EVENTS[new Date().getDay()]

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('group_buys')
      .select('id, ends_at, gift_description, product:products(name)')
      .eq('is_active', true)
      .then(({ data }) => {
        if (data?.length) {
          setGroupBuys(data.map((g: any) => ({
            name: g.product?.name || '공동구매',
            desc: g.gift_description || '',
            period: g.ends_at ? String(g.ends_at).slice(0, 10) + ' 까지' : '',
            fromDB: true,
          })))
        }
      })
  }, [])

  useEffect(() => {
    const q = customerName.trim()
    if (q.length < 2) { setCustomerHistory(null); return }
    const t = setTimeout(async () => {
      const supabase = createClient()
      const { data } = await supabase.from('users').select('id, full_name, skin_type, skin_concerns').ilike('full_name', `%${q}%`).limit(1).maybeSingle()
      setCustomerHistory(data)
    }, 300)
    return () => clearTimeout(t)
  }, [customerName])

  useEffect(() => {
    const q = prodSearch.trim()
    if (q.length < 1) { setProdResults([]); return }
    const t = setTimeout(() => { void searchProducts(q).then(setProdResults) }, 220)
    return () => clearTimeout(t)
  }, [prodSearch])

  useEffect(() => {
    const q = bundleSearch.trim()
    if (q.length < 1) { setBundleResults([]); return }
    const t = setTimeout(() => { void searchProducts(q).then(setBundleResults) }, 220)
    return () => clearTimeout(t)
  }, [bundleSearch])

  useEffect(() => {
    const q = sampleSearch.trim()
    if (q.length < 1) { setSampleResults([]); return }
    const t = setTimeout(() => { void searchProducts(q).then(setSampleResults) }, 220)
    return () => clearTimeout(t)
  }, [sampleSearch])

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

  const handlePrint = () => {
    setLoading(true)
    const html = buildPrintHTML({
      customerName, selProds, tipText, cmtText, bundleItems, sampleItems, routineCards,
      giftTiers, giftTiersR, showRenobel, totosOn: totoOn, totosCard: totoCard,
      groupBuys, customEvents, selectedDayOn, dayEvent,
    })
    const w = window.open('', '_blank')
    if (w) { w.document.write(html); w.document.close() }
    else alert('팝업이 차단됐어요. 브라우저 주소창 오른쪽 팝업 허용 후 다시 눌러주세요.')
    setLoading(false)
  }

  return (
    <div style={{ background: '#fff', color: '#111', padding: 20, minHeight: '100vh', fontWeight: 400 }}>
      <div style={{ fontSize: 16, color: '#7B5EA7', marginBottom: 20, fontWeight: 400 }}>외부고객 케어카드</div>

      {/* 1. 고객 정보 */}
      <section style={{ marginBottom: 24 }}>
        <div style={secTitle}>1. 고객 정보</div>
        <div style={lbl}>고객 이름</div>
        <input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="고객 이름 입력" style={inp} />
        {customerHistory ? (
          <div style={{ marginTop: 8, fontSize: 12, color: '#534AB7', lineHeight: 1.6 }}>
            기존 고객: {customerHistory.full_name || '-'} · 피부타입 {customerHistory.skin_type || '-'}
            {Array.isArray(customerHistory.skin_concerns) && customerHistory.skin_concerns.length ? ` · ${customerHistory.skin_concerns.join(', ')}` : ''}
          </div>
        ) : null}
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
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {ROUTINE_PRESETS.map(r => (
            <button key={r.id} type="button" onClick={() => setRoutineCards(prev => prev.find(x => x.id === r.id) ? prev.filter(x => x.id !== r.id) : [...prev, r])} style={{ padding: '6px 10px', borderRadius: 8, border: routineCards.find(x => x.id === r.id) ? '0.5px solid #7B5EA7' : '0.5px solid #ddd', background: routineCards.find(x => x.id === r.id) ? '#f5f0ff' : '#fff', fontSize: 11, cursor: 'pointer', color: '#111' }}>
              {r.tag} {r.name}
            </button>
          ))}
        </div>
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
            <input value={totoCard.ico} onChange={e => setTotoCard({ ...totoCard, ico: e.target.value })} placeholder="아이콘 (이모지)" style={inp} />
            <input value={totoCard.name} onChange={e => setTotoCard({ ...totoCard, name: e.target.value })} placeholder="당첨 제품명" style={inp} />
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
      <button type="button" onClick={handlePrint} disabled={loading} style={{ width: '100%', padding: '14px 0', borderRadius: 10, border: 'none', background: '#7B5EA7', color: '#fff', fontSize: 14, fontWeight: 400, cursor: loading ? 'not-allowed' : 'pointer' }}>
        {loading ? '준비 중...' : '🖨️ 케어카드 인쇄하기'}
      </button>
    </div>
  )
}
