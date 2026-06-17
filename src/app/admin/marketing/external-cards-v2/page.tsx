'use client'
import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
const COURIERS = ['CJ대한통운','롯데택배','한진택배','우체국택배','로젠택배','직접전달','퀵배송']
const CHANNELS = ['네이버 스마트스토어','더치스 쇼핑몰','블로그 공구','인스타 DM','카카오 문의','기타']
const ALIMTALK_COPIES = [
  (name: string) => `${name}님 💜\n\n이 제품, 제대로 쓰고 계신가요?\n\n바르는 순서 하나만 바꿔도\n효과가 2배 달라져요.\n\n거울 보는 게 설레지는 상담이에요.\n맑원장이 직접 챙겨드릴게요.\n\n지금 가입하면 10,000T 드려요 👉 auran.kr`,
  (name: string) => `${name}님 💜\n\n${name}님이 더 예뻐지는 상담이에요.\n\n좋은 제품도 내 피부 사이클을\n모르면 반만 써요.\n\n맑원장이 직접 챙겨드릴게요.\n가입하면 10,000T도 드려요 👉 auran.kr`,
  (name: string) => `${name}님 💜\n\n"피부 어떻게 관리해요?"\n주변에서 먼저 물어보는 피부,\n만들어드릴게요.\n\n맑원장이 ${name}님 피부만\n직접 챙겨드리는 상담이에요 👉 auran.kr`,
  (name: string) => `${name}님 💜\n\n"이거 어떻게 쓰는 거예요?"\n그 질문, 저한테 해주세요.\n\n이번엔 진짜로 바뀌는 상담이에요.\n20년 노하우로 같이 해결해요 👉 auran.kr`,
  (name: string) => `${name}님 💜\n\n혼자 고민하던 피부,\n이제 맑원장이랑 같이 해결해요.\n\n${name}님 피부가 설레기 시작하는\n상담이에요. 가입 선물 10,000T 👉 auran.kr`,
  (name: string) => `${name}님 💜\n\n내일 아침 거울이 달라 보이는\n상담이에요.\n\n맑원장이 ${name}님 피부만 생각하며\n직접 봐드릴게요 👉 auran.kr`,
]
const C = { purple:'#7B5EA7', gold:'#C9A96E', muted:'#8A7E92', line:'rgba(123,94,167,0.15)', green:'#5B8A6B' }
type ProductRow = { id: string; name: string; brand: string; orig: number; custom: number; usage: string; reviewTextRate: number; reviewPhotoRate: number; reviewVideoRate: number }
type Card = {
  id: string; customer_name: string; phone: string | null; address: string | null
  channel: string; products: ProductRow[]; total_amount: number
  delivery_type: string; tracking_no: string | null; shipped_at: string | null; estimated_arrival: string | null
  am_routine: string | null; pm_routine: string | null; tip: string | null
  status: string; auran_joined: boolean; created_at: string
}
export default function ExternalCardsV2Page() {
  const supabase = createClient()
  const [tab, setTab] = useState<'write'|'history'|'stats'|'customers'|'marketing'>('write')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [channel, setChannel] = useState('네이버 스마트스토어')
  const [products, setProducts] = useState<ProductRow[]>([])
  const [productSearch, setProductSearch] = useState('')
  const [productResults, setProductResults] = useState<any[]>([])
  const [courier, setCourier] = useState('CJ대한통운')
  const [trackingNo, setTrackingNo] = useState('')
  const [shippedAt, setShippedAt] = useState('')
  const [arrivalAt, setArrivalAt] = useState('')
  const [amRoutine, setAmRoutine] = useState('')
  const [pmRoutine, setPmRoutine] = useState('')
  const [tip, setTip] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [cards, setCards] = useState<Card[]>([])
  const [historySearch, setHistorySearch] = useState('')
  const [historyStatus, setHistoryStatus] = useState('전체')
  const [loadingCards, setLoadingCards] = useState(false)
  const [openCardId, setOpenCardId] = useState<string | null>(null)
  const [currentCardId, setCurrentCardId] = useState<string | null>(null)
  const [giftItems, setGiftItems] = useState<{label:string;threshold:number;items:string}[]>([
    {label:'20만원 이상', threshold:200000, items:''},
    {label:'30만원 이상', threshold:300000, items:''},
    {label:'50만원 이상', threshold:500000, items:''},
    {label:'100만원 이상', threshold:1000000, items:''},
  ])
  const [bundleProds, setBundleProds] = useState<{name:string;tip:string}[]>([])
  const [sampleProds, setSampleProds] = useState<{name:string;tip:string}[]>([])
  const [bundleSearch, setBundleSearch] = useState('')
  const [bundleResults, setBundleResults] = useState<any[]>([])
  const [sampleSearch, setSampleSearch] = useState('')
  const [sampleResults, setSampleResults] = useState<any[]>([])
  const [custSearch, setCustSearch] = useState('')
  const [custResults, setCustResults] = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [openCustId, setOpenCustId] = useState<string | null>(null)
  const totalAmount = useMemo(() => products.reduce((s, p) => s + p.custom, 0), [products])
  useEffect(() => {
    if (tab === 'customers' || tab === 'marketing') { fetchCustomers(); fetchCards() }
    if (tab === 'history' || tab === 'stats') fetchCards()
  }, [tab])
  const fetchCards = async () => {
    setLoadingCards(true)
    const { data } = await supabase.from('external_care_cards_v2').select('*').order('created_at', { ascending: false })
    setCards((data || []) as Card[])
    setLoadingCards(false)
  }
  const fetchCustomers = async () => {
    const { data } = await supabase.from('external_customers')
      .select('*')
      .order('total_amount', { ascending: false })
    setCustomers(data || [])
  }
  const searchCustomers = async (q: string) => {
    setCustSearch(q)
    if (q.length < 1) { setCustResults([]); return }
    const { data } = await supabase.from('external_customers')
      .select('id,name,phone,address,channel,total_amount,visit_count,auran_joined')
      .ilike('name', `%${q}%`)
      .limit(5)
    setCustResults(data || [])
  }
  const selectCustomer = (c: any) => {
    setName(c.name); setPhone(c.phone || ''); setAddress(c.address || ''); setChannel(c.channel || '네이버 스마트스토어')
    setCustSearch(''); setCustResults([])
  }
  const searchProducts = async (q: string) => {
    setProductSearch(q)
    if (q.length < 2) { setProductResults([]); return }
    const { data } = await supabase.from('products')
      .select('id,name,retail_price,owner_comment,review_points_text,review_points_photo,review_points_video,brands(name)')
      .ilike('name', `%${q}%`)
      .eq('is_active', true)
      .limit(6)
    setProductResults(data || [])
  }
  const addProduct = (p: any) => {
    if (products.find(x => x.id === p.id)) return
    setProducts(prev => [...prev, { id: p.id, name: p.name, brand: (p.brands as any)?.name || '', orig: p.retail_price || 0, custom: p.retail_price || 0, usage: p.owner_comment || '', reviewTextRate: p.review_points_text || 1, reviewPhotoRate: p.review_points_photo || 2, reviewVideoRate: p.review_points_video || 3 }])
    setProductSearch(''); setProductResults([])
  }
  const updatePrice = (id: string, val: string) => {
    const n = parseInt(val.replace(/[^0-9]/g, '')) || 0
    setProducts(prev => prev.map(p => p.id === id ? { ...p, custom: n } : p))
  }
  const searchBundle = async (q: string) => {
    setBundleSearch(q)
    if (q.length < 2) { setBundleResults([]); return }
    const { data } = await supabase.from('products')
      .select('id,name,owner_comment')
      .ilike('name', `%${q}%`)
      .eq('is_active', true)
      .limit(6)
    setBundleResults(data || [])
  }
  const searchSample = async (q: string) => {
    setSampleSearch(q)
    if (q.length < 2) { setSampleResults([]); return }
    const { data } = await supabase.from('products')
      .select('id,name,owner_comment')
      .ilike('name', `%${q}%`)
      .eq('is_active', true)
      .limit(6)
    setSampleResults(data || [])
  }
  const updateUsage = (id: string, val: string) => {
    setProducts(prev => prev.map(p => p.id === id ? { ...p, usage: val } : p))
  }
  const reset = () => {
    setCurrentCardId(null)
    setGiftItems([
      {label:'20만원 이상', threshold:200000, items:''},
      {label:'30만원 이상', threshold:300000, items:''},
      {label:'50만원 이상', threshold:500000, items:''},
      {label:'100만원 이상', threshold:1000000, items:''},
    ])
    setBundleProds([])
    setSampleProds([])
    setName(''); setPhone(''); setAddress(''); setChannel('네이버 스마트스토어')
    setProducts([]); setCourier('CJ대한통운'); setTrackingNo('')
    setShippedAt(''); setArrivalAt(''); setAmRoutine(''); setPmRoutine(''); setTip('')
  }
  const save = async (andPrint = false) => {
    if (!name.trim()) { setMsg('고객명을 입력해주세요'); return }
    setSaving(true); setMsg('')
    const isEdit = !!currentCardId
    let customerId: string | null = null
    const existCust = await supabase.from('external_customers')
      .select('id,total_amount,visit_count').ilike('name', name.trim()).maybeSingle()
    if ((existCust.data as any)?.id) {
      customerId = (existCust.data as any).id
      await supabase.from('external_customers').update({
        phone: phone || undefined, address: address || undefined, channel,
        total_amount: await (async () => {
          const { data: allCards } = await supabase
            .from('external_care_cards_v2')
            .select('total_amount, id')
            .eq('customer_id', customerId)
          const saved = (allCards || []).reduce((s: number, x: any) => s + (x.total_amount || 0), 0)
          return isEdit ? saved : saved + totalAmount
        })(),
        visit_count: isEdit ? ((existCust.data as any).visit_count || 0) : ((existCust.data as any).visit_count || 0) + 1,
        last_purchase_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }).eq('id', customerId)
    } else {
      const { data: newCust } = await supabase.from('external_customers').insert({
        name: name.trim(), phone: phone || null, address: address || null, channel,
        total_amount: totalAmount, visit_count: 1,
        last_purchase_at: new Date().toISOString(),
      } as any).select('id').single()
      customerId = (newCust as any)?.id || null
    }
    const cardPayload = {
      customer_name: name.trim(), phone, address, channel,
      products, total_amount: totalAmount,
      delivery_type: courier, tracking_no: trackingNo || null,
      shipped_at: shippedAt || null, estimated_arrival: arrivalAt || null,
      am_routine: amRoutine, pm_routine: pmRoutine, tip,
      status: trackingNo ? '발송완료' : '준비중',
      gift_items: giftItems,
      bundle_prods: bundleProds,
      sample_prods: sampleProds,
      customer_id: customerId,
    }
    const { error } = isEdit
      ? await supabase.from('external_care_cards_v2').update(cardPayload as any).eq('id', currentCardId)
      : await supabase.from('external_care_cards_v2').insert(cardPayload as any)
    if (!isEdit) setCurrentCardId(null)
    setSaving(false)
    if (error) { setMsg('저장 실패: ' + error.message); return }
    setMsg('✓ 저장 완료!')
    if (andPrint) printCard()
    reset()
    setTimeout(() => setMsg(''), 3000)
  }
  const sendAlimtalk = async (card: Card) => {
    if (!card.phone) { alert('전화번호가 없어요'); return }
    const copyFn = ALIMTALK_COPIES[Math.floor(Math.random() * ALIMTALK_COPIES.length)]
    const message = copyFn(card.customer_name)
    try {
      const res = await fetch('/api/alimtalk/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: card.phone, message, title: 'AURAN 오랜 · 맑원장' }),
      })
      const json = await res.json()
      if (json.ok) alert('알림톡 발송 완료!')
      else alert('발송 실패: ' + json.error)
    } catch { alert('발송 중 오류가 발생했어요') }
  }
  const markJoined = async (id: string) => {
    const card = cards.find(c => c.id === id)
    if (!card) return
    const custRes = await supabase.from('external_customers').select('id').ilike('name', card.customer_name).maybeSingle()
    const customerId = (custRes.data as any)?.id
    if (customerId) {
      const res = await fetch('/api/admin/external-customers/link', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_id: customerId }),
      })
      const json = await res.json()
      alert(json.message || (json.ok ? '완료!' : '오류: ' + json.error))
    } else {
      await supabase.from('external_care_cards_v2').update({ auran_joined: true }).eq('id', id)
    }
    setCards(prev => prev.map(c => c.id === id ? { ...c, auran_joined: true } : c))
  }
  const printCard = () => {
    const qrBase = 'https://api.qrserver.com/v1/create-qr-code/?size=80x80&data='
    const qrJoin = qrBase + encodeURIComponent('https://auran.kr/join?ref=care_card')
    const qrChat = qrBase + encodeURIComponent('https://auran.kr/chat?ref=care_card')
    const qrReview = qrBase + encodeURIComponent('https://auran.kr/review?ref=care_card')
    const productList = products.map(p => `
      <tr>
        <td>${p.name}${p.usage ? `<div style="font-size:9px;color:#7B5EA7;margin-top:2px;">✦ ${p.usage}</div>` : ''}</td>
        <td style="text-align:right;white-space:nowrap">₩${p.custom.toLocaleString()}</td>
      </tr>`).join('')
    const reviewToastRows = products.length > 0 ? products.map(p => `
      <tr>
        <td style="font-size:10px">${p.name}</td>
        <td style="text-align:center;font-size:10px">${Math.round(p.custom * (p.reviewTextRate || 1) / 100).toLocaleString()}T</td>
        <td style="text-align:center;font-size:10px">${Math.round(p.custom * (p.reviewPhotoRate || 2) / 100).toLocaleString()}T</td>
        <td style="text-align:center;font-size:10px">${Math.round(p.custom * (p.reviewVideoRate || 3) / 100).toLocaleString()}T</td>
      </tr>`).join('') : `<tr><td colspan="4" style="font-size:10px;color:#999">텍스트 1,000T / 사진 3,000T / 영상 5,000T</td></tr>`
    const activeGifts = giftItems.filter(g => g.items.trim() && totalAmount >= g.threshold)
    const giftSection = activeGifts.length > 0 ? `
      <div class="sec">
        <div class="sec-title">💝 금액별 선물</div>
        ${activeGifts.map(g => `<div style="padding:4px 0;font-size:11px;border-bottom:0.5px solid #f5efe8"><span style="color:#C9A96E;font-size:10px">${g.label}</span> ${g.items}</div>`).join('')}
      </div>` : ''
    const bundleSection = bundleProds.length > 0 ? `
      <div class="sec">
        <div class="sec-title">✨ 함께 쓰면 좋은 제품</div>
        ${bundleProds.map(b => `<div style="padding:4px 0;font-size:11px;border-bottom:0.5px solid #f5efe8">${b.name}${b.tip ? `<span style="color:#7B5EA7;font-size:10px;margin-left:6px">${b.tip}</span>` : ''}</div>`).join('')}
      </div>` : ''
    const sampleSection = sampleProds.length > 0 ? `
      <div class="sec">
        <div class="sec-title">🎁 동봉 샘플</div>
        ${sampleProds.map(s => `<div style="padding:4px 0;font-size:11px;border-bottom:0.5px solid #f5efe8">${s.name}${s.tip ? `<span style="color:#7B5EA7;font-size:10px;margin-left:6px">${s.tip}</span>` : ''}</div>`).join('')}
      </div>` : ''
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>AURAN 케어카드</title>
<style>
@media print{@page{size:A4;margin:5mm}.no-print{display:none!important}body{font-size:9.5px!important}.sec{margin-bottom:5px!important}.join,.ot,.review{margin-bottom:5px!important}table th,table td{padding:3px 5px!important}}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Apple SD Gothic Neo','Noto Sans KR',sans-serif;color:#111;font-size:11px;line-height:1.5}
.hdr{text-align:center;padding-bottom:6px;border-bottom:1px solid #C9A96E;margin-bottom:8px}
.logo{font-family:Georgia,serif;font-size:20px;letter-spacing:.35em;color:#7B5EA7;font-style:italic}
.hdr-sub{font-size:10px;color:#999;margin-top:3px}
.greeting{background:#f9f6ff;border-left:3px solid #7B5EA7;padding:10px 14px;border-radius:0 6px 6px 0;margin-bottom:14px;font-size:10px;color:#534AB7;line-height:1.7}
.greeting strong{color:#2a1f3d;font-size:12px}
.sec{margin-bottom:8px}
.sec-title{font-size:10px;letter-spacing:.15em;color:#C9A96E;border-bottom:.5px solid #eee;padding-bottom:5px;margin-bottom:8px}
table{width:100%;border-collapse:collapse;font-size:11px}
th{background:#f9f6ff;color:#7B5EA7;font-weight:400;padding:7px 8px;text-align:left;border-bottom:.5px solid #e0d8f0;font-size:10px}
td{padding:7px 8px;border-bottom:.5px solid #f0edf8}
.total{text-align:right;font-size:12px;color:#7B5EA7;padding-top:8px;border-top:1px solid #C9A96E;margin-top:6px}
.delivery{background:#f9f6ff;border-radius:6px;padding:9px 12px;margin-bottom:14px;display:flex;gap:20px;font-size:11px}
.d-label{font-size:9px;color:#999;margin-bottom:2px}
.routine-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:8px}
.routine-box{background:#f9f6ff;border-radius:6px;padding:8px 10px}
.routine-time{font-size:9px;letter-spacing:.15em;color:#9B7EC8;margin-bottom:4px}
.routine-step{font-size:10px;color:#534AB7;line-height:1.8;white-space:pre-wrap}
.tip-text{font-size:10px;color:#534AB7;line-height:1.7;border-top:.5px solid #eee;padding-top:8px;margin-top:4px}
.join{background:#2D5A3D;color:#fff;border-radius:8px;padding:12px 16px;display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:8px}
.j-eye{font-size:9px;letter-spacing:.12em;color:#C9A96E;margin-bottom:4px}
.j-copy{font-family:Georgia,serif;font-size:12px;color:#fff;font-style:italic;line-height:1.4;margin-bottom:4px}
.j-sub{font-size:9px;color:rgba(255,255,255,.35);margin-bottom:6px}
.j-pill{font-size:9px;color:rgba(255,255,255,.6);display:flex;align-items:center;gap:4px;margin-bottom:3px}
.j-dot{width:2px;height:2px;border-radius:50%;background:#C9A96E;display:inline-block}
.qr{width:54px;height:54px;background:#fff;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:8px;color:#7B5EA7;text-align:center;padding:3px;flex-shrink:0}
.ot{border:.5px solid rgba(123,94,167,.3);border-radius:8px;overflow:hidden;margin-bottom:8px}
.ot-head{background:#7B5EA7;padding:11px 14px;display:flex;justify-content:space-between;align-items:center;gap:10px}
.ot-title{font-family:Georgia,serif;font-size:13px;color:#fff;line-height:1.35}
.ot-title em{font-style:italic;color:#FAE8C0}
.ot-sub{font-size:9px;color:rgba(255,255,255,.5);margin-top:3px}
.bubbles{display:flex;flex-direction:column;gap:4px;align-items:flex-end;flex-shrink:0}
.bq{font-size:9px;padding:4px 8px;border-radius:8px 8px 2px 8px;background:rgba(255,255,255,.15);color:rgba(255,255,255,.85);max-width:100px;line-height:1.4;text-align:right}
.ba{font-size:9px;padding:4px 8px;border-radius:8px 8px 8px 2px;background:#FAE8C0;color:#3d2a00;max-width:100px;line-height:1.4}
.ot-body{background:#f3effa;padding:11px 14px;display:flex;justify-content:space-between;align-items:center;gap:12px}
.steps{display:flex;flex-direction:column;gap:5px}
.step{display:flex;align-items:center;gap:6px;font-size:9px;color:#4a3d6a}
.snum{width:16px;height:16px;border-radius:50%;background:#7B5EA7;color:#fff;font-size:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.ot-hint{font-size:9px;color:#9B7EC8;padding-left:22px;margin-top:2px}
.ot-qr{width:48px;height:48px;background:#fff;border:.5px solid rgba(123,94,167,.2);border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:8px;color:#7B5EA7;text-align:center;padding:3px;flex-shrink:0}
.ot-free{font-size:8px;padding:2px 7px;border-radius:10px;background:rgba(123,94,167,.12);color:#7B5EA7;text-align:center;margin-top:3px}
.review{border:1px solid rgba(201,169,110,.3);border-radius:8px;padding:9px 13px;display:flex;justify-content:space-between;align-items:center;gap:10px}
.rv-title{font-size:10px;color:#2a1f3d;margin-bottom:2px}
.rv-sub{font-size:9px;color:#999;line-height:1.5;margin-bottom:4px}
.rv-pill{font-size:9px;padding:2px 6px;border-radius:8px;background:#f9f6ff;color:#7B5EA7;border:.5px solid rgba(123,94,167,.2);margin-right:4px}
.rv-qr{width:40px;height:40px;background:#f9f6ff;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:8px;color:#7B5EA7;text-align:center;flex-shrink:0}
.footer{text-align:right;font-size:9px;color:#ccc;margin-top:10px}
</style></head><body>
<div style="position:fixed;top:12px;right:16px;z-index:999;display:flex;gap:8px;" class="no-print">
  <button onclick="window.print()" style="padding:8px 20px;background:#7B5EA7;color:#fff;border:none;border-radius:8px;font-size:13px;cursor:pointer;">🖨️ 인쇄하기</button>
  <button onclick="window.close()" style="padding:8px 16px;background:#f5f5f5;color:#666;border:1px solid #ddd;border-radius:8px;font-size:13px;cursor:pointer;">닫기</button>
</div>
<div class="hdr"><div class="logo">A U R A N</div><div class="hdr-sub">스킨파우더룸 · 맑원장 피부 케어 가이드</div></div>
<div class="greeting"><strong>${name}님, 소중한 구매 감사드려요 💜</strong><br>맑원장이 직접 이 제품 쓰는 방법을 알려드릴게요. 쓰다가 모르는 게 생기면 바로 물어봐요.</div>
${products.length ? `<div class="sec"><div class="sec-title">✦ 구매하신 제품</div><table><thead><tr><th>상품명</th><th style="text-align:right">금액</th></tr></thead><tbody>${productList}</tbody></table><div class="total">합계 <strong>₩${totalAmount.toLocaleString()}</strong></div></div>` : ''}
${(courier || trackingNo) ? `<div class="delivery">${courier ? `<div><div class="d-label">택배사</div>${courier}</div>` : ''}${trackingNo ? `<div><div class="d-label">송장번호</div>${trackingNo}</div>` : ''}${shippedAt ? `<div><div class="d-label">발송일</div>${shippedAt}</div>` : ''}${arrivalAt ? `<div><div class="d-label">도착예정</div>${arrivalAt}</div>` : ''}</div>` : ''}
${giftSection}${bundleSection}${sampleSection}
${(amRoutine || pmRoutine || tip) ? `<div class="sec"><div class="sec-title">✦ 맞춤 사용 루틴</div><div class="routine-grid">${amRoutine ? `<div class="routine-box"><div class="routine-time">AM · 아침</div><div class="routine-step">${amRoutine}</div></div>` : ''}${pmRoutine ? `<div class="routine-box"><div class="routine-time">PM · 저녁</div><div class="routine-step">${pmRoutine}</div></div>` : ''}</div>${tip ? `<div class="tip-text">💜 ${tip}</div>` : ''}</div>` : ''}
<div class="join"><div style="font-size:13px;font-weight:600;color:#fff;margin-bottom:8px;line-height:1.6;">생리 10일 전,<br>피부가 가장 뒤집힐 확률 87%</div><div style="font-size:9px;color:rgba(255,255,255,0.85);margin-bottom:10px;line-height:1.8;">같은 제품도 호르몬 주기에 따라 효과가 완전히 달라져요.</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-bottom:10px;"><div style="background:rgba(255,255,255,0.12);border-radius:6px;padding:6px 8px;"><div style="font-size:8px;color:#C9A96E;margin-bottom:2px;">달빛기 · 생리중~직후</div><div style="font-size:9px;color:#fff;">진정 케어</div></div><div style="background:rgba(255,255,255,0.12);border-radius:6px;padding:6px 8px;"><div style="font-size:8px;color:#C9A96E;margin-bottom:2px;">황금기 · 생리후 7~10일</div><div style="font-size:9px;color:#fff;">영양·미백 집중</div></div><div style="background:rgba(255,255,255,0.12);border-radius:6px;padding:6px 8px;"><div style="font-size:8px;color:#C9A96E;margin-bottom:2px;">만개기 · 배란기</div><div style="font-size:9px;color:#fff;">모공·유분 조절</div></div><div style="background:rgba(255,255,255,0.12);border-radius:6px;padding:6px 8px;"><div style="font-size:8px;color:#C9A96E;margin-bottom:2px;">물들기 · 생리전 7~10일</div><div style="font-size:9px;color:#fff;">트러블 예방·항산화</div></div></div><div style="font-size:9px;color:rgba(255,255,255,0.85);margin-bottom:10px;line-height:1.7;">AURAN이 내 호르몬 주기를 읽고<br>오늘 필요한 홈케어를 알려드려요. 💜</div><div style="display:flex;gap:12px;align-items:center;"><div style="text-align:center;"><img src="${qrJoin}" width="54" height="54" style="display:block;border-radius:4px;background:#fff;padding:2px;" /><div style="font-size:8px;color:rgba(255,255,255,0.7);margin-top:3px;">카카오 가입</div></div><div><div style="font-size:11px;color:#fff;margin-bottom:3px;">지금 가입하고</div><div style="font-size:10px;color:#C9A96E;">• 가입 즉시 10,000T 지급</div><div style="font-size:10px;color:rgba(255,255,255,0.8);">• 내 호르몬 주기 분석</div><div style="font-size:10px;color:rgba(255,255,255,0.8);">• 맞춤 홈케어 루틴 제공</div></div></div></div>
<div class="ot"><div class="ot-head"><div><div class="ot-title">제품 쓰다 막히면<br><em>맑원장님께 직접 물어보세요</em></div><div class="ot-sub">오랜톡 · 맑원장 1:1 상담</div></div><div class="bubbles"><div class="bq">세럼이랑 크림<br>순서 맞나요?</div><div class="ba">세럼 먼저요!<br>흡수 후 크림 발라요</div></div></div><div class="ot-body"><div class="steps"><div class="step"><div class="snum">1</div>위 QR 스캔 → AURAN 카카오 가입</div><div class="step"><div class="snum">2</div>앱 하단 채팅 탭 터치</div><div class="step"><div class="snum">3</div>맑원장님께 바로 질문하기</div><div class="ot-hint">맑원장이 직접 챙겨드릴게요 💜</div></div><div style="display:flex;flex-direction:column;align-items:center;gap:3px"><img src="${qrChat}" width="48" height="48" style="display:block;border-radius:4px;" /><div style="font-size:8px;color:#9B7EC8;text-align:center">상담 바로가기</div></div></div></div>
<div class="review"><div><div class="rv-title">솔직한 후기 남기고 토스트 받으세요</div><div class="rv-sub">내 후기 한 줄이 비슷한 피부 고민 가진 분께 큰 도움이 돼요</div><div><table style="width:100%;border-collapse:collapse;margin-top:6px">
  <thead><tr>
    <th style="font-size:9px;color:#999;text-align:left;padding:3px 0">제품</th>
    <th style="font-size:9px;color:#999;text-align:center">텍스트</th>
    <th style="font-size:9px;color:#999;text-align:center">사진</th>
    <th style="font-size:9px;color:#999;text-align:center">영상</th>
  </tr></thead>
  <tbody>${reviewToastRows}</tbody>
</table></div></div><img src="${qrReview}" width="40" height="40" style="display:block;border-radius:4px;" /></div>
<div class="footer">auran.kr · 오랜톡 · 맑원장 · 스킨파우더룸 · ${new Date().toLocaleDateString('ko-KR')}</div>
</body></html>`
    const today = new Date().toLocaleDateString('ko-KR')
    const w = window.open('', '_blank')
    if (w) {
      w.document.write(html)
      w.document.close()
      w.document.body.style.background = '#e8e8e8'
      w.document.body.style.display = 'flex'
      w.document.body.style.justifyContent = 'center'
      w.document.body.style.padding = '20px'
      const wrap = w.document.createElement('div')
      wrap.style.cssText = 'background:#fff;width:210mm;min-height:297mm;padding:15mm;box-shadow:0 2px 16px rgba(0,0,0,0.15);'
      while (w.document.body.firstChild) wrap.appendChild(w.document.body.firstChild)
      w.document.body.appendChild(wrap)
    }
  }
  const filteredCards = useMemo(() => cards.filter(c => {
    const matchSearch = !historySearch || c.customer_name.includes(historySearch) || (c.tracking_no || '').includes(historySearch)
    const matchStatus = historyStatus === '전체' || c.status === historyStatus
    return matchSearch && matchStatus
  }), [cards, historySearch, historyStatus])
  const stats = useMemo(() => {
    const thisMonth = new Date().toISOString().slice(0, 7)
    const monthCards = cards.filter(c => c.created_at.startsWith(thisMonth))
    const joined = cards.filter(c => c.auran_joined).length
    const channelMap: Record<string, number> = {}
    cards.forEach(c => { channelMap[c.channel] = (channelMap[c.channel] || 0) + 1 })
    const topChannel = Object.entries(channelMap).sort((a, b) => b[1] - a[1])
    const prodMap: Record<string, { name: string; cnt: number }> = {}
    cards.forEach(c => { (c.products || []).forEach((p: any) => { if (!prodMap[p.id]) prodMap[p.id] = { name: p.name, cnt: 0 }; prodMap[p.id].cnt++ }) })
    const topProds = Object.values(prodMap).sort((a, b) => b.cnt - a.cnt).slice(0, 5)
    return { monthCount: monthCards.length, totalAmt: monthCards.reduce((s, c) => s + (c.total_amount || 0), 0), joined, topChannel, topProds }
  }, [cards])
  const inp = { width: '100%', padding: '8px 10px', background: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#e8e0f5', fontSize: 12, fontFamily: 'inherit' } as React.CSSProperties
  return (
    <div style={{ padding: '18px 18px 60px', maxWidth: 600, margin: '0 auto', fontFamily: '-apple-system,sans-serif', background: '#0d0d0d', minHeight: '100vh', color: '#e8e0f5' }}>
      <div style={{ fontSize: 15, color: '#F0E8FF', marginBottom: 3 }}>외부고객 케어카드 v2</div>
      <div style={{ fontSize: 10, color: '#444', marginBottom: 14 }}>더치스 · 스마트스토어 · 블로그공구</div>
      <div style={{ display: 'flex', borderBottom: '0.5px solid rgba(255,255,255,0.08)', marginBottom: 18 }}>
        {(['write','customers','marketing','stats'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: '9px 16px', fontSize: 12, cursor: 'pointer', background: 'transparent', border: 'none', color: tab === t ? '#fff' : '#444', borderBottom: tab === t ? '2px solid #7B5EA7' : '2px solid transparent', fontFamily: 'inherit' }}>
            {t === 'write' ? '카드 작성' : t === 'customers' ? '고객 관리' : t === 'marketing' ? '마케팅' : '통계'}
          </button>
        ))}
      </div>
      {tab === 'write' && (
        <div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, letterSpacing: '.15em', color: C.gold, marginBottom: 8 }}>✦ 고객 정보</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <div style={{ fontSize: 10, color: '#555', marginBottom: 4 }}>고객명</div>
                <input style={inp} value={name}
                  onChange={e => { setName(e.target.value); searchCustomers(e.target.value) }}
                  placeholder="예) 김민지 (기존 고객 자동완성)" autoComplete="off" />
                {custResults.length > 0 && (
                  <div style={{ position: 'absolute', top: 'calc(100% + 3px)', left: 0, right: 0, background: '#1a1830', border: '0.5px solid rgba(123,94,167,0.4)', borderRadius: 9, overflow: 'hidden', zIndex: 20 }}>
                    <div style={{ padding: '6px 12px', fontSize: 10, color: '#555', borderBottom: '0.5px solid rgba(255,255,255,0.05)' }}>기존 고객</div>
                    {custResults.map((c: any) => (
                      <div key={c.id} onClick={() => selectCustomer(c)}
                        style={{ padding: '9px 12px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', borderBottom: '0.5px solid rgba(255,255,255,0.05)' }}>
                        <div><div style={{ fontSize: 12, color: '#e8e0f5' }}>{c.name}</div><div style={{ fontSize: 10, color: '#555', marginTop: 1 }}>{c.channel} · {c.visit_count}회 구매</div></div>
                        <div style={{ fontSize: 11, color: '#C9A96E' }}>₩{(c.total_amount || 0).toLocaleString()}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ flex: 1 }}><div style={{ fontSize: 10, color: '#555', marginBottom: 4 }}>연락처</div><input style={inp} value={phone} onChange={e => setPhone(e.target.value)} placeholder="010-0000-0000" /></div>
            </div>
            <div style={{ marginBottom: 8 }}><div style={{ fontSize: 10, color: '#555', marginBottom: 4 }}>배송 주소</div><input style={inp} value={address} onChange={e => setAddress(e.target.value)} placeholder="서울시 강남구..." /></div>
            <div><div style={{ fontSize: 10, color: '#555', marginBottom: 6 }}>구매 채널</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {CHANNELS.map(c => (
                <button key={c} onClick={() => setChannel(c)} style={{ padding: '6px 12px', borderRadius: 20, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', background: channel === c ? '#7B5EA7' : 'transparent', color: channel === c ? '#fff' : '#666', border: `0.5px solid ${channel === c ? '#7B5EA7' : 'rgba(255,255,255,0.15)'}` }}>{c}</button>
              ))}
            </div></div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, letterSpacing: '.15em', color: C.gold, marginBottom: 8 }}>✦ 구매 제품</div>
            <div style={{ position: 'relative', marginBottom: 8 }}>
              <input style={inp} value={productSearch} onChange={e => searchProducts(e.target.value)} placeholder="제품명 검색..." autoComplete="off" />
              {productResults.length > 0 && (
                <div style={{ position: 'absolute', top: 'calc(100% + 3px)', left: 0, right: 0, background: '#1a1830', border: '0.5px solid rgba(123,94,167,0.4)', borderRadius: 9, overflow: 'hidden', zIndex: 20 }}>
                  {productResults.map(p => (
                    <div key={p.id} onClick={() => addProduct(p)} style={{ padding: '9px 12px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', borderBottom: '0.5px solid rgba(255,255,255,0.05)' }}>
                      <div><div style={{ fontSize: 12, color: '#e8e0f5' }}>{p.name}</div><div style={{ fontSize: 10, color: '#555', marginTop: 1 }}>{(p.brands as any)?.name}</div></div>
                      <div style={{ fontSize: 11, color: C.gold }}>₩{(p.retail_price || 0).toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {products.map(p => (
              <div key={p.id} style={{ background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 9, padding: '10px 12px', marginBottom: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div><div style={{ fontSize: 12, color: '#e8e0f5', marginBottom: 2 }}>{p.name}</div><div style={{ fontSize: 10, color: '#555' }}>{p.brand}</div></div>
                  <div style={{ fontSize: 11, color: '#333', cursor: 'pointer', padding: '2px 6px' }} onClick={() => setProducts(prev => prev.filter(x => x.id !== p.id))}>✕</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <div style={{ fontSize: 10, color: '#555', whiteSpace: 'nowrap' }}>판매가</div>
                  <div style={{ fontSize: 10, color: '#333', whiteSpace: 'nowrap' }}>스토어 ₩{p.orig.toLocaleString()}</div>
                  <input style={{ flex: 1, padding: '5px 9px', background: 'rgba(201,169,110,0.08)', border: '0.5px solid rgba(201,169,110,0.25)', borderRadius: 7, color: C.gold, fontSize: 12, textAlign: 'right', minWidth: 0, fontFamily: 'inherit' }}
                    defaultValue={p.custom.toLocaleString()}
                    onChange={e => updatePrice(p.id, e.target.value)}
                  />
                  <div style={{ fontSize: 11, color: C.gold, whiteSpace: 'nowrap' }}>원</div>
                  <div style={{ fontSize: 9, padding: '2px 6px', borderRadius: 10, background: p.custom !== p.orig ? 'rgba(201,169,110,0.15)' : 'rgba(255,255,255,0.04)', color: p.custom !== p.orig ? C.gold : '#333' }}>
                    {p.custom !== p.orig ? '수정됨' : '스토어가'}
                  </div>
                </div>
                <input
                  type="text"
                  placeholder="사용법 간단 메모"
                  value={p.usage}
                  onChange={e => updateUsage(p.id, e.target.value)}
                  style={{fontSize:11,padding:'2px 6px',border:'1px solid #e0d5f0',borderRadius:6,color:'#111',width:'100%',marginTop:4,background:'#fff'}}
                />
              </div>
            ))}
            {products.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 12px', background: 'rgba(123,94,167,0.07)', border: '0.5px solid rgba(123,94,167,0.2)', borderRadius: 8, marginTop: 2 }}>
                <div style={{ fontSize: 11, color: '#9B7EC8' }}>합계</div>
                <div style={{ fontSize: 15, color: C.gold }}>₩{totalAmount.toLocaleString()}</div>
              </div>
            )}
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ background: 'rgba(123,94,167,0.06)', border: '0.5px solid rgba(123,94,167,0.2)', borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 10, letterSpacing: '.12em', color: '#9B7EC8', marginBottom: 10 }}>✦ 배송 정보</div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <div style={{ flex: 1 }}><div style={{ fontSize: 10, color: '#555', marginBottom: 6 }}>택배사</div>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {COURIERS.map(c => (
                    <button key={c} onClick={() => setCourier(c)} style={{ padding: '5px 10px', borderRadius: 20, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', background: courier === c ? '#7B5EA7' : 'transparent', color: courier === c ? '#fff' : '#666', border: `0.5px solid ${courier === c ? '#7B5EA7' : 'rgba(255,255,255,0.15)'}` }}>{c}</button>
                  ))}
                </div></div>
                <div style={{ flex: 1 }}><div style={{ fontSize: 10, color: '#555', marginBottom: 4 }}>송장번호</div><input style={inp} value={trackingNo} onChange={e => setTrackingNo(e.target.value)} placeholder="1234567890" /></div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1 }}><div style={{ fontSize: 10, color: '#555', marginBottom: 4 }}>발송일</div><input style={inp} type="date" value={shippedAt} onChange={e => setShippedAt(e.target.value)} /></div>
                <div style={{ flex: 1 }}><div style={{ fontSize: 10, color: '#555', marginBottom: 4 }}>도착 예정일</div><input style={inp} type="date" value={arrivalAt} onChange={e => setArrivalAt(e.target.value)} /></div>
              </div>
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, letterSpacing: '.15em', color: C.gold, marginBottom: 8 }}>✦ 맞춤 루틴</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: 9 }}>
                <div style={{ fontSize: 9, color: '#9B7EC8', letterSpacing: '.1em', marginBottom: 5 }}>AM · 아침</div>
                <textarea style={{ ...inp, height: 80, resize: 'none' } as React.CSSProperties} value={amRoutine} onChange={e => setAmRoutine(e.target.value)} placeholder={'1. 클렌저\n2. 세럼\n3. 크림\n4. 선크림'} />
              </div>
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: 9 }}>
                <div style={{ fontSize: 9, color: '#9B7EC8', letterSpacing: '.1em', marginBottom: 5 }}>PM · 저녁</div>
                <textarea style={{ ...inp, height: 80, resize: 'none' } as React.CSSProperties} value={pmRoutine} onChange={e => setPmRoutine(e.target.value)} placeholder={'1. 오일클렌징\n2. 폼\n3. 세럼\n4. 크림'} />
              </div>
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, letterSpacing: '.15em', color: C.gold, marginBottom: 8 }}>✦ 원장님 꿀팁</div>
            <textarea style={{ ...inp, height: 80, resize: 'none' } as React.CSSProperties} value={tip} onChange={e => setTip(e.target.value)} placeholder="고객님 피부에 맞는 맞춤 팁 입력..." />
          </div>
          <div style={{marginBottom:12}}>
            <div style={{fontSize:12,color:'#C9A96E',marginBottom:6}}>💝 금액별 선물</div>
            {giftItems.map((g,i) => (
              <div key={i} style={{display:'flex',gap:8,alignItems:'center',marginBottom:4}}>
                <span style={{fontSize:11,color:'#888',width:80,flexShrink:0}}>{g.label}</span>
                <input
                  type="text"
                  placeholder="선물 내용 입력"
                  value={g.items}
                  onChange={e => setGiftItems(prev => prev.map((x,j) => j===i ? {...x,items:e.target.value} : x))}
                  style={{flex:1,fontSize:11,padding:'4px 8px',border:'1px solid #e0d5f0',borderRadius:6,color:'#111',background:'#fff'}}
                />
              </div>
            ))}
          </div>
          <div style={{marginBottom:12}}>
            <div style={{fontSize:12,color:'#C9A96E',marginBottom:6}}>✨ 함께 쓰면 좋은 제품</div>
            <div style={{ position: 'relative', marginBottom: 8 }}>
              <input
                type="text"
                placeholder="제품명 검색 후 추가"
                value={bundleSearch}
                onChange={e => searchBundle(e.target.value)}
                style={{ width: '100%', fontSize: 11, padding: '6px 10px', border: '1px solid #e0d5f0', borderRadius: 8, color: '#111', background: '#fff' }}
              />
              {bundleResults.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #e0d5f0', borderRadius: 8, zIndex: 10, maxHeight: 160, overflowY: 'auto' }}>
                  {bundleResults.map(p => (
                    <div key={p.id} onClick={() => { setBundleProds(prev => [...prev, { name: p.name, tip: p.owner_comment || '' }]); setBundleSearch(''); setBundleResults([]) }}
                      style={{ padding: '7px 12px', fontSize: 11, color: '#111', cursor: 'pointer', borderBottom: '0.5px solid #f0f0f0' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#f9f5ff')}
                      onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
                    >{p.name}</div>
                  ))}
                </div>
              )}
            </div>
            {bundleProds.map((b,i) => (
              <div key={i} style={{display:'flex',gap:6,marginBottom:4}}>
                <input value={b.name} placeholder="제품명" onChange={e => setBundleProds(prev => prev.map((x,j) => j===i?{...x,name:e.target.value}:x))} style={{flex:2,fontSize:11,padding:'4px 8px',border:'1px solid #e0d5f0',borderRadius:6,color:'#111',background:'#fff'}} />
                <input value={b.tip} placeholder="간단 사용법" onChange={e => setBundleProds(prev => prev.map((x,j) => j===i?{...x,tip:e.target.value}:x))} style={{flex:3,fontSize:11,padding:'4px 8px',border:'1px solid #e0d5f0',borderRadius:6,color:'#111',background:'#fff'}} />
                <button onClick={() => setBundleProds(prev => prev.filter((_,j) => j!==i))} style={{fontSize:11,color:'#e57373',background:'none',border:'none',cursor:'pointer'}}>✕</button>
              </div>
            ))}
            <button onClick={() => setBundleProds(prev => [...prev,{name:'',tip:''}])} style={{fontSize:11,color:'#7B5EA7',background:'none',border:'1px dashed #c4b5d4',borderRadius:6,padding:'3px 10px',cursor:'pointer'}}>+ 추가</button>
          </div>
          <div style={{marginBottom:12}}>
            <div style={{fontSize:12,color:'#C9A96E',marginBottom:6}}>🎁 동봉 샘플</div>
            <div style={{ position: 'relative', marginBottom: 8 }}>
              <input
                type="text"
                placeholder="샘플명 검색 후 추가"
                value={sampleSearch}
                onChange={e => searchSample(e.target.value)}
                style={{ width: '100%', fontSize: 11, padding: '6px 10px', border: '1px solid #e0d5f0', borderRadius: 8, color: '#111', background: '#fff' }}
              />
              {sampleResults.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #e0d5f0', borderRadius: 8, zIndex: 10, maxHeight: 160, overflowY: 'auto' }}>
                  {sampleResults.map(p => (
                    <div key={p.id} onClick={() => { setSampleProds(prev => [...prev, { name: p.name, tip: p.owner_comment || '' }]); setSampleSearch(''); setSampleResults([]) }}
                      style={{ padding: '7px 12px', fontSize: 11, color: '#111', cursor: 'pointer', borderBottom: '0.5px solid #f0f0f0' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#f9f5ff')}
                      onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
                    >{p.name}</div>
                  ))}
                </div>
              )}
            </div>
            {sampleProds.map((s,i) => (
              <div key={i} style={{display:'flex',gap:6,marginBottom:4}}>
                <input value={s.name} placeholder="샘플명" onChange={e => setSampleProds(prev => prev.map((x,j) => j===i?{...x,name:e.target.value}:x))} style={{flex:2,fontSize:11,padding:'4px 8px',border:'1px solid #e0d5f0',borderRadius:6,color:'#111',background:'#fff'}} />
                <input value={s.tip} placeholder="간단 사용법" onChange={e => setSampleProds(prev => prev.map((x,j) => j===i?{...x,tip:e.target.value}:x))} style={{flex:3,fontSize:11,padding:'4px 8px',border:'1px solid #e0d5f0',borderRadius:6,color:'#111',background:'#fff'}} />
                <button onClick={() => setSampleProds(prev => prev.filter((_,j) => j!==i))} style={{fontSize:11,color:'#e57373',background:'none',border:'none',cursor:'pointer'}}>✕</button>
              </div>
            ))}
            <button onClick={() => setSampleProds(prev => [...prev,{name:'',tip:''}])} style={{fontSize:11,color:'#7B5EA7',background:'none',border:'1px dashed #c4b5d4',borderRadius:6,padding:'3px 10px',cursor:'pointer'}}>+ 추가</button>
          </div>
          {msg && <div style={{ fontSize: 12, padding: '8px 12px', borderRadius: 8, marginBottom: 10, background: msg.includes('✓') ? 'rgba(91,138,107,0.1)' : 'rgba(220,80,80,0.1)', color: msg.includes('✓') ? C.green : '#dc5050', border: `0.5px solid ${msg.includes('✓') ? 'rgba(91,138,107,0.3)' : 'rgba(220,80,80,0.3)'}` }}>{msg}</div>}
          <div style={{ display: 'flex', gap: 8, paddingTop: 16, borderTop: '0.5px solid rgba(255,255,255,0.06)' }}>
            <button onClick={reset} style={{ flex: 1, padding: 11, borderRadius: 9, fontSize: 12, cursor: 'pointer', background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.12)', color: '#888', fontFamily: 'inherit' }}>초기화</button>
            <button onClick={() => save(false)} disabled={saving} style={{ flex: 1, padding: 11, borderRadius: 9, fontSize: 12, cursor: 'pointer', background: 'rgba(123,94,167,0.2)', border: '0.5px solid rgba(123,94,167,0.4)', color: '#9B7EC8', fontFamily: 'inherit' }}>{saving ? '저장 중...' : '저장만'}</button>
            <button onClick={() => save(true)} disabled={saving} style={{ flex: 1, padding: 11, borderRadius: 9, fontSize: 12, cursor: 'pointer', background: '#7B5EA7', border: 'none', color: '#fff', fontFamily: 'inherit' }}>저장 + 출력 🖨</button>
          </div>
        </div>
      )}
      {tab === 'history' && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <input style={{ ...inp, flex: 1 }} value={historySearch} onChange={e => setHistorySearch(e.target.value)} placeholder="고객명 · 송장번호 검색" />
            <div style={{ display: 'flex', gap: 5 }}>
              {['전체','준비중','발송완료'].map(s => (
                <button key={s} onClick={() => setHistoryStatus(s)} style={{ padding: '7px 12px', borderRadius: 20, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', background: historyStatus === s ? '#7B5EA7' : 'transparent', color: historyStatus === s ? '#fff' : '#666', border: `0.5px solid ${historyStatus === s ? '#7B5EA7' : 'rgba(255,255,255,0.15)'}` }}>{s}</button>
              ))}
            </div>
          </div>
          {loadingCards ? <div style={{ fontSize: 12, color: '#444' }}>불러오는 중...</div> :
            filteredCards.length === 0 ? <div style={{ fontSize: 12, color: '#444' }}>데이터가 없어요</div> :
            filteredCards.map(c => (
              <div key={c.id}>
                <div onClick={() => setOpenCardId(openCardId === c.id ? null : c.id)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'rgba(255,255,255,0.03)', border: `0.5px solid ${openCardId === c.id ? 'rgba(123,94,167,0.4)' : 'rgba(255,255,255,0.07)'}`, borderRadius: 9, marginBottom: 6, cursor: 'pointer' }}>
                  <div>
                    <div style={{ fontSize: 13, color: '#e8e0f5', marginBottom: 2 }}>{c.customer_name}</div>
                    <div style={{ fontSize: 10, color: '#444' }}>{c.delivery_type}{c.tracking_no ? ` · ${c.tracking_no}` : ''} · {c.created_at.slice(0,10)}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                    <div style={{ fontSize: 12, color: C.gold }}>₩{(c.total_amount || 0).toLocaleString()}</div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <div style={{ fontSize: 9, padding: '2px 8px', borderRadius: 20, background: c.status === '발송완료' ? 'rgba(91,138,107,0.2)' : 'rgba(201,169,110,0.12)', color: c.status === '발송완료' ? C.green : C.gold }}>{c.status}</div>
                      {c.auran_joined && <div style={{ fontSize: 9, padding: '2px 8px', borderRadius: 20, background: 'rgba(123,94,167,0.2)', color: '#9B7EC8' }}>가입✓</div>}
                    </div>
                  </div>
                </div>
                {openCardId === c.id && (
                  <div style={{ background: 'rgba(123,94,167,0.07)', border: '0.5px solid rgba(123,94,167,0.25)', borderRadius: 9, padding: 14, marginBottom: 10, marginTop: -4 }}>
                    <div style={{ fontSize: 11, color: '#9B7EC8', marginBottom: 10 }}>{c.customer_name}님 상세</div>
                    {c.phone && <div style={{ fontSize: 11, color: '#555', marginBottom: 4 }}>연락처 <span style={{ color: '#e8e0f5' }}>{c.phone}</span></div>}
                    {c.address && <div style={{ fontSize: 11, color: '#555', marginBottom: 4 }}>주소 <span style={{ color: '#e8e0f5' }}>{c.address}</span></div>}
                    <div style={{ fontSize: 11, color: '#555', marginBottom: 10 }}>채널 <span style={{ color: '#e8e0f5' }}>{c.channel}</span></div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button
                        onClick={() => {
                          setName(c.customer_name || '')
                          setPhone(c.phone || '')
                          setAddress(c.address || '')
                          setChannel(c.channel || '네이버 스마트스토어')
                          setProducts(c.products || [])
                          setCourier(c.delivery_type || 'CJ대한통운')
                          setTrackingNo(c.tracking_no || '')
                          setShippedAt(c.shipped_at || '')
                          setArrivalAt(c.estimated_arrival || '')
                          setAmRoutine(c.am_routine || '')
                          setPmRoutine(c.pm_routine || '')
                          setTip(c.tip || '')
                          if ((c as any).gift_items) setGiftItems((c as any).gift_items)
                          if ((c as any).bundle_prods) setBundleProds((c as any).bundle_prods)
                          if ((c as any).sample_prods) setSampleProds((c as any).sample_prods)
                          setCurrentCardId(c.id)
                          setTab('write')
                        }}
                        style={{ marginRight: 8, padding: '6px 14px', background: '#7B5EA7', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}
                      >
                        ✏️ 카드 수정
                      </button>
                      <button
                        onClick={async () => {
                          if (!confirm(`${c.customer_name}님 카드를 삭제할까요?`)) return
                          await supabase.from('external_care_cards_v2').delete().eq('id', c.id)
                          setCards(prev => prev.filter(x => x.id !== c.id))
                          setOpenCardId(null)
                        }}
                        style={{ marginRight: 8, padding: '6px 14px', background: '#fff', color: '#e57373', border: '1px solid #e57373', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}
                      >
                        🗑️ 삭제
                      </button>
                      {!c.auran_joined && <button onClick={() => markJoined(c.id)} style={{ padding: '6px 12px', borderRadius: 7, fontSize: 11, cursor: 'pointer', background: 'rgba(91,138,107,0.2)', border: '0.5px solid rgba(91,138,107,0.35)', color: C.green, fontFamily: 'inherit' }}>AURAN 가입 확인 ✓</button>}
                      {c.phone && <button onClick={() => sendAlimtalk(c)} style={{ padding: '6px 12px', borderRadius: 7, fontSize: 11, cursor: 'pointer', background: 'rgba(201,169,110,0.15)', border: '0.5px solid rgba(201,169,110,0.35)', color: C.gold, fontFamily: 'inherit' }}>알림톡 재발송</button>}
                    </div>
                  </div>
                )}
              </div>
            ))
          }
        </div>
      )}
      {tab === 'customers' && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <input style={{ ...inp, flex: 1 }} placeholder="고객명 · 전화번호 검색"
              onChange={async e => {
                const q = e.target.value
                if (!q) { fetchCustomers(); return }
                const { data } = await supabase.from('external_customers')
                  .select('*').ilike('name', `%${q}%`).order('total_amount', { ascending: false })
                setCustomers(data || [])
              }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 16 }}>
            {[['전체', customers.length + '명'], ['AURAN 가입', customers.filter(c => c.auran_joined).length + '명'], ['누적 합계', '₩' + Math.round(customers.reduce((s: number, c: any) => s + (c.total_amount || 0), 0) / 10000) + '만']].map(([l, n]) => (
              <div key={l} style={{ background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 12, textAlign: 'center' }}>
                <div style={{ fontSize: 20, color: '#C9A96E', marginBottom: 3 }}>{n}</div>
                <div style={{ fontSize: 10, color: '#444' }}>{l}</div>
              </div>
            ))}
          </div>
          {customers.map((c: any) => (
            <div key={c.id}>
              <div onClick={() => setOpenCustId(openCustId === c.id ? null : c.id)}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '11px 13px', background: 'rgba(255,255,255,0.03)', border: `0.5px solid ${openCustId === c.id ? 'rgba(123,94,167,0.4)' : 'rgba(255,255,255,0.07)'}`, borderRadius: 10, marginBottom: 6, cursor: 'pointer' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 13, color: '#e8e0f5' }}>{c.name}</span>
                    <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 10, background: c.auran_joined ? 'rgba(91,138,107,0.2)' : 'rgba(255,255,255,0.04)', color: c.auran_joined ? '#5B8A6B' : '#555' }}>{c.auran_joined ? 'AURAN가입' : '미가입'}</span>
                  </div>
                  <div style={{ fontSize: 10, color: '#444', display: 'flex', gap: 10 }}>
                    <span>{c.channel}</span>
                    <span>{c.visit_count}회 구매</span>
                    {c.phone && <span>{c.phone}</span>}
                  </div>
                </div>
                <div style={{ fontSize: 13, color: '#C9A96E' }}>₩{(c.total_amount || 0).toLocaleString()}</div>
              </div>
              {openCustId === c.id && (
                <div style={{ background: 'rgba(123,94,167,0.07)', border: '0.5px solid rgba(123,94,167,0.25)', borderRadius: 10, padding: 14, marginBottom: 10, marginTop: -4 }}>
                  <div style={{ fontSize: 11, color: '#9B7EC8', marginBottom: 10 }}>{c.name}님 상세</div>
                  {c.phone && <div style={{ fontSize: 11, color: '#555', marginBottom: 4 }}>연락처 <span style={{ color: '#e8e0f5' }}>{c.phone}</span></div>}
                  {c.address && <div style={{ fontSize: 11, color: '#555', marginBottom: 4 }}>주소 <span style={{ color: '#e8e0f5' }}>{c.address}</span></div>}
                  <div style={{ fontSize: 11, color: '#555', marginBottom: 10 }}>채널 <span style={{ color: '#e8e0f5' }}>{c.channel}</span> · {c.visit_count}회 · 합계 <span style={{ color: '#C9A96E' }}>₩{(c.total_amount || 0).toLocaleString()}</span></div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {!c.auran_joined && (
                      <button onClick={async () => {
                        const res = await fetch('/api/admin/external-customers/link', {
                          method: 'POST', headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ customer_id: c.id }),
                        })
                        const json = await res.json()
                        alert(json.message || (json.ok ? '완료!' : '오류: ' + json.error))
                        fetchCustomers()
                      }}
                        style={{ padding: '6px 12px', borderRadius: 7, fontSize: 11, cursor: 'pointer', background: 'rgba(91,138,107,0.2)', border: '0.5px solid rgba(91,138,107,0.35)', color: '#5B8A6B', fontFamily: 'inherit' }}>AURAN 가입 확인 ✓</button>
                    )}
                    {c.phone && (
                      <button onClick={async () => {
                        const fn = ALIMTALK_COPIES[Math.floor(Math.random() * ALIMTALK_COPIES.length)]
                        const res = await fetch('/api/alimtalk/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: c.phone, message: fn(c.name), title: 'AURAN 오랜 · 맑원장' }) })
                        const json = await res.json()
                        alert(json.ok ? '알림톡 발송 완료!' : '발송 실패: ' + json.error)
                      }} style={{ padding: '6px 12px', borderRadius: 7, fontSize: 11, cursor: 'pointer', background: 'rgba(201,169,110,0.15)', border: '0.5px solid rgba(201,169,110,0.35)', color: '#C9A96E', fontFamily: 'inherit' }}>알림톡 발송</button>
                    )}
                    <button onClick={() => { setTab('write'); setName(c.name); setPhone(c.phone || ''); setAddress(c.address || ''); setChannel(c.channel || '네이버 스마트스토어') }}
                      style={{ padding: '6px 12px', borderRadius: 7, fontSize: 11, cursor: 'pointer', background: 'rgba(123,94,167,0.2)', border: '0.5px solid rgba(123,94,167,0.4)', color: '#9B7EC8', fontFamily: 'inherit' }}>새 케어카드 작성</button>
                    <button
                      onClick={async () => {
                        if (!confirm(`${c.name}님 고객 정보를 삭제할까요?\n케어카드 이력도 함께 삭제됩니다.`)) return
                        await supabase.from('external_care_cards_v2').delete().eq('customer_name', c.name)
                        await supabase.from('external_customers').delete().eq('id', c.id)
                        setCustomers(prev => prev.filter(x => x.id !== c.id))
                        setCards(prev => prev.filter(x => x.customer_name !== c.name))
                        setOpenCustId(null)
                      }}
                      style={{ padding: '6px 12px', borderRadius: 7, fontSize: 11, cursor: 'pointer', background: 'rgba(229,115,115,0.1)', border: '0.5px solid rgba(229,115,115,0.4)', color: '#e57373', fontFamily: 'inherit' }}
                    >🗑️ 고객 삭제</button>
                  </div>
                  {cards.filter(card => card.customer_name === c.name).length > 0 && (
                    <div style={{ marginTop: 10 }}>
                      <div style={{ fontSize: 11, color: '#9B7EC8', marginBottom: 6 }}>케어카드 이력</div>
                      {cards.filter(card => card.customer_name === c.name).map(card => (
                        <div key={card.id} style={{ background: 'rgba(123,94,167,0.05)', border: '0.5px solid rgba(123,94,167,0.15)', borderRadius: 8, padding: '8px 12px', marginBottom: 6 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                            <div style={{ fontSize: 11, color: '#e8e0f5' }}>
                              {new Date(card.created_at).toLocaleDateString('ko-KR')}
                              {card.delivery_type && ` · ${card.delivery_type}`}
                              {card.tracking_no && ` · ${card.tracking_no}`}
                            </div>
                            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                              <span style={{ fontSize: 10, color: card.status === '발송완료' ? '#5B8A6B' : '#C9A96E', background: card.status === '발송완료' ? 'rgba(91,138,107,0.15)' : 'rgba(201,169,110,0.15)', padding: '2px 8px', borderRadius: 10 }}>{card.status}</span>
                              <span style={{ fontSize: 11, color: '#C9A96E' }}>₩{(card.total_amount || 0).toLocaleString()}</span>
                            </div>
                          </div>
                          {(card.products || []).length > 0 && (
                            <div style={{ marginTop: 6, paddingTop: 6, borderTop: '0.5px solid rgba(123,94,167,0.1)' }}>
                              {(card.products || []).map((p: any, i: number) => (
                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#888', padding: '2px 0' }}>
                                  <span>{p.name}{p.usage ? ` · ${p.usage}` : ''}</span>
                                  <span style={{ color: '#C9A96E', whiteSpace: 'nowrap', marginLeft: 8 }}>₩{(p.custom || 0).toLocaleString()}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              onClick={() => {
                                setName(card.customer_name || '')
                                setPhone(card.phone || '')
                                setAddress(card.address || '')
                                setChannel(card.channel || '네이버 스마트스토어')
                                setProducts(card.products || [])
                                setCourier(card.delivery_type || 'CJ대한통운')
                                setTrackingNo(card.tracking_no || '')
                                setShippedAt(card.shipped_at || '')
                                setArrivalAt(card.estimated_arrival || '')
                                setAmRoutine(card.am_routine || '')
                                setPmRoutine(card.pm_routine || '')
                                setTip(card.tip || '')
                                if ((card as any).gift_items) setGiftItems((card as any).gift_items)
                                if ((card as any).bundle_prods) setBundleProds((card as any).bundle_prods)
                                if ((card as any).sample_prods) setSampleProds((card as any).sample_prods)
                                setCurrentCardId(card.id)
                                setTab('write')
                              }}
                              style={{ fontSize: 11, padding: '3px 10px', background: '#7B5EA7', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
                            >✏️ 수정</button>
                            <button
                              onClick={async () => {
                                if (!confirm(`${card.created_at.slice(0,10)} 카드를 삭제할까요?`)) return
                                await supabase.from('external_care_cards_v2').delete().eq('id', card.id)
                                setCards(prev => prev.filter(x => x.id !== card.id))
                              }}
                              style={{ fontSize: 11, padding: '3px 10px', background: 'none', color: '#e57373', border: '1px solid #e57373', borderRadius: 6, cursor: 'pointer' }}
                            >🗑️</button>
                            {card.phone && (
                              <button
                                onClick={() => sendAlimtalk(card)}
                                style={{ fontSize: 11, padding: '3px 10px', background: 'rgba(201,169,110,0.15)', color: '#C9A96E', border: '0.5px solid rgba(201,169,110,0.35)', borderRadius: 6, cursor: 'pointer' }}
                              >알림톡 재발송</button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {tab === 'marketing' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 16 }}>
            {[
              ['미가입', customers.filter(c => !c.auran_joined).length + '명', '#dc5050'],
              ['VIP 30만+', customers.filter(c => (c.total_amount || 0) >= 300000).length + '명', '#C9A96E'],
              ['재구매 2회+', customers.filter(c => (c.visit_count || 0) >= 2).length + '명', '#9B7EC8'],
            ].map(([l, n, color]) => (
              <div key={l} style={{ background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 12, textAlign: 'center' }}>
                <div style={{ fontSize: 20, color, marginBottom: 3 }}>{n}</div>
                <div style={{ fontSize: 10, color: '#444' }}>{l}</div>
              </div>
            ))}
          </div>
          {[
            { title: 'AURAN 미가입 고객', sub: '발송 후 아직 가입 안 한 고객 → 알림톡 재발송 타겟', list: customers.filter(c => !c.auran_joined) },
            { title: 'VIP 고객 (₩30만+)', sub: '누적 구매 30만원 이상 · 멤버십 전환 최우선 타겟', list: customers.filter(c => (c.total_amount || 0) >= 300000) },
            { title: '재구매 고객 (2회+)', sub: '충성 고객 → 오랜톡 상담 유도', list: customers.filter(c => (c.visit_count || 0) >= 2) },
          ].map(seg => (
            <div key={seg.title} style={{ padding: '12px 13px', background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 10, marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 13, color: '#e8e0f5', marginBottom: 2 }}>{seg.title}</div>
                  <div style={{ fontSize: 10, color: '#444' }}>{seg.sub}</div>
                </div>
                <button onClick={async () => {
                  const targets = seg.list.filter(c => c.phone)
                  if (!targets.length) { alert('전화번호 있는 고객이 없어요'); return }
                  if (!confirm(`${targets.length}명에게 알림톡을 발송할까요?`)) return
                  let ok = 0
                  for (const c of targets) {
                    const fn = ALIMTALK_COPIES[Math.floor(Math.random() * ALIMTALK_COPIES.length)]
                    const res = await fetch('/api/alimtalk/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: c.phone, message: fn(c.name), title: 'AURAN 오랜 · 맑원장' }) })
                    const json = await res.json(); if (json.ok) ok++
                  }
                  alert(`${ok}명 발송 완료!`)
                }} style={{ padding: '6px 14px', borderRadius: 7, fontSize: 11, cursor: 'pointer', background: '#7B5EA7', border: 'none', color: '#fff', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                  알림톡 발송 ({seg.list.filter(c => c.phone).length}명)
                </button>
              </div>
              <div style={{ fontSize: 10, color: '#555' }}>
                {seg.list.slice(0, 3).map(c => c.name).join(' · ')}{seg.list.length > 3 ? ` 외 ${seg.list.length - 3}명` : ''}
              </div>
            </div>
          ))}
        </div>
      )}
      {tab === 'stats' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 16 }}>
            {[['이번달 발송', stats.monthCount + '건'], ['이번달 금액', '₩' + Math.round(stats.totalAmt / 10000) + '만'], ['AURAN 가입', stats.joined + '명']].map(([l, n]) => (
              <div key={l} style={{ background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 12, textAlign: 'center' }}>
                <div style={{ fontSize: 20, color: C.gold, marginBottom: 3 }}>{n}</div>
                <div style={{ fontSize: 10, color: '#444' }}>{l}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 10, letterSpacing: '.15em', color: C.gold, marginBottom: 10 }}>✦ 채널별 발송</div>
          {stats.topChannel.slice(0, 5).map(([ch, cnt], i) => (
            <div key={ch} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#555', marginBottom: 4 }}><span>{ch}</span><span>{cnt}건</span></div>
              <div style={{ height: 5, background: 'rgba(255,255,255,0.06)', borderRadius: 3 }}>
                <div style={{ height: 5, borderRadius: 3, background: ['#7B5EA7','#C9A96E','#9B7EC8','#5B8A6B','#555'][i], width: `${Math.round(cnt / Math.max(...stats.topChannel.map(x => x[1] as number)) * 100)}%` }} />
              </div>
            </div>
          ))}
          {stats.topProds.length > 0 && <>
            <div style={{ fontSize: 10, letterSpacing: '.15em', color: C.gold, margin: '16px 0 10px' }}>✦ 많이 보낸 제품 TOP 5</div>
            {stats.topProds.map((p, i) => (
              <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 9, marginBottom: 6 }}>
                <div style={{ fontSize: 13, color: C.gold, minWidth: 20 }}>{i + 1}</div>
                <div style={{ flex: 1, fontSize: 12, color: '#e8e0f5' }}>{p.name}</div>
                <div style={{ fontSize: 12, color: '#555' }}>{p.cnt}건</div>
              </div>
            ))}
          </>}
        </div>
      )}
    </div>
  )
}
