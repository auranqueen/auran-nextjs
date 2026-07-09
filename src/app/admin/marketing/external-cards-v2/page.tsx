'use client'
import { useSearchParams } from 'next/navigation'
import { useEffect, useState, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { printCard } from './printCard'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import BuyerBroadcastModal from './_components/BuyerBroadcastModal'
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
  const [tab, setTab] = useState<'write'|'stats'|'customers'|'marketing'>('write')
  const searchParams = useSearchParams()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [channel, setChannel] = useState('네이버 스마트스토어')
  const [products, setProducts] = useState<ProductRow[]>([])
  const phoneRef = useRef<HTMLInputElement>(null)
  const addressRef = useRef<HTMLInputElement>(null)
  const productSearchRef = useRef<HTMLInputElement>(null)
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
  const [loadingCards, setLoadingCards] = useState(false)
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
  const [selectedBuyerIds, setSelectedBuyerIds] = useState<string[]>([])
  const [showBroadcastModal, setShowBroadcastModal] = useState(false)
  const [openCustId, setOpenCustId] = useState<string | null>(null)
  const totalAmount = useMemo(() => products.reduce((s, p) => s + p.custom, 0), [products])
  useEffect(() => {
    const qName = searchParams.get('name')
    if (qName) setName(decodeURIComponent(qName))
  }, [])
  useEffect(() => {
    if (tab === 'customers' || tab === 'marketing') { fetchCustomers(); fetchCards() }
    if (tab === 'stats') { fetchCards(); fetchCustomers() }
  }, [tab])
  useEffect(() => {
    if (typeof window === 'undefined') return
    if ((window as any).daum?.Postcode) return
    const existing = document.querySelector('script[data-daum-postcode="true"]')
    if (existing) return
    const script = document.createElement('script')
    script.src = 'https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js'
    script.async = true
    script.setAttribute('data-daum-postcode', 'true')
    document.body.appendChild(script)
  }, [])
  const openAddressSearch = (onSelect: (addr: string) => void) => {
    if (!(window as any).daum?.Postcode) return
    new (window as any).daum.Postcode({
      oncomplete: (data: any) => onSelect(String(data?.roadAddress || '')),
    }).open()
  }
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
    setTimeout(() => productSearchRef.current?.focus(), 0)
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
    if (andPrint) printCard({ name, products, totalAmount, giftItems, bundleProds, sampleProds, courier, trackingNo, shippedAt, arrivalAt, amRoutine, pmRoutine, tip })
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
        body: JSON.stringify({ phone: card.phone, message, title: 'AURAN 오렌 · 맑원장' }),
      })
      const json = await res.json()
      if (json.ok) alert('알림톡 발송 완료!')
      else alert('발송 실패: ' + json.error)
    } catch { alert('발송 중 오류가 발생했어요') }
  }
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
    const now = new Date()
    const monthlyRevenue: { month: string; amount: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const amount = cards.filter(c => c.created_at.startsWith(month)).reduce((s, c) => s + (c.total_amount || 0), 0)
      monthlyRevenue.push({ month, amount })
    }
    const topBuyers = [...customers]
      .sort((a, b) => (b.total_amount || 0) - (a.total_amount || 0))
      .slice(0, 10)
      .map(c => ({ id: c.id, name: c.name, phone: c.phone, total_amount: c.total_amount || 0, visit_count: c.visit_count || 0 }))
    const prodRevMap: Record<string, { name: string; amount: number }> = {}
    cards.forEach(c => {
      (c.products || []).forEach((p: ProductRow) => {
        const price = p.custom ?? p.orig ?? 0
        if (!prodRevMap[p.id]) prodRevMap[p.id] = { name: p.name, amount: 0 }
        prodRevMap[p.id].amount += price
      })
    })
    const topProductsByRevenue = Object.values(prodRevMap).sort((a, b) => b.amount - a.amount).slice(0, 10)
    const repeatRate = customers.length > 0
      ? Math.round(customers.filter(c => (c.visit_count || 0) >= 2).length / customers.length * 100)
      : 0
    const channelRevenueMap: Record<string, number> = {}
    cards.forEach(c => { channelRevenueMap[c.channel] = (channelRevenueMap[c.channel] || 0) + (c.total_amount || 0) })
    const channelRevenue = Object.entries(channelRevenueMap).sort((a, b) => b[1] - a[1])
    return { monthCount: monthCards.length, totalAmt: monthCards.reduce((s, c) => s + (c.total_amount || 0), 0), joined, topChannel, topProds, monthlyRevenue, topBuyers, topProductsByRevenue, repeatRate, channelRevenue }
  }, [cards, customers])
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
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); phoneRef.current?.focus() } }}
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
              <div style={{ flex: 1 }}><div style={{ fontSize: 10, color: '#555', marginBottom: 4 }}>연락처</div><input ref={phoneRef} style={inp} value={phone} onChange={e => setPhone(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addressRef.current?.focus() } }} placeholder="010-0000-0000" /></div>
            </div>
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 10, color: '#555', marginBottom: 4 }}>배송 주소</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input ref={addressRef} style={{ ...inp, flex: 1, minWidth: 0 }} value={address} onChange={e => setAddress(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); productSearchRef.current?.focus() } }} placeholder="서울시 강남구..." />
                <button type="button" onClick={() => openAddressSearch((addr) => setAddress(addr))} style={{ width: 72, flexShrink: 0, border: 'none', borderRadius: 8, background: '#7B5EA7', color: '#fff', fontSize: 12, cursor: 'pointer' }}>주소 검색</button>
              </div>
            </div>
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
              <input ref={productSearchRef} style={inp} value={productSearch} onChange={e => searchProducts(e.target.value)} placeholder="제품명 검색..." autoComplete="off" />
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
            <a
              href="/admin/products/edit-v2"
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'inline-block', marginBottom: 8, fontSize: 11, color: C.gold, textDecoration: 'none', opacity: 0.85 }}
            >
              + 찾는 제품이 없나요? 새 탭에서 제품 등록하러 가기
            </a>
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
                        const res = await fetch('/api/alimtalk/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: c.phone, message: fn(c.name), title: 'AURAN 오렌 · 맑원장' }) })
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
            { title: '재구매 고객 (2회+)', sub: '충성 고객 → 오렌톡 상담 유도', list: customers.filter(c => (c.visit_count || 0) >= 2) },
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
                    const res = await fetch('/api/alimtalk/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: c.phone, message: fn(c.name), title: 'AURAN 오렌 · 맑원장' }) })
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 16 }}>
            {[['이번달 발송', stats.monthCount + '건'], ['이번달 금액', '₩' + Math.round(stats.totalAmt / 10000) + '만'], ['AURAN 가입', stats.joined + '명'], ['재구매율', stats.repeatRate + '%']].map(([l, n]) => (
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
          {stats.channelRevenue.length > 0 && <>
            <div style={{ fontSize: 10, letterSpacing: '.15em', color: C.gold, margin: '16px 0 10px' }}>✦ 채널별 매출</div>
            {stats.channelRevenue.slice(0, 5).map(([ch, amt], i) => (
              <div key={ch} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#555', marginBottom: 4 }}><span>{ch}</span><span>₩{amt.toLocaleString()}</span></div>
                <div style={{ height: 5, background: 'rgba(255,255,255,0.06)', borderRadius: 3 }}>
                  <div style={{ height: 5, borderRadius: 3, background: ['#7B5EA7','#C9A96E','#9B7EC8','#5B8A6B','#555'][i], width: `${Math.round(amt / Math.max(...stats.channelRevenue.map(x => x[1] as number)) * 100)}%` }} />
                </div>
              </div>
            ))}
          </>}
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
          <div style={{ fontSize: 10, letterSpacing: '.15em', color: C.gold, margin: '16px 0 10px' }}>✦ 월별 매출 추이</div>
          <div style={{ marginBottom: 16 }}>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={stats.monthlyRevenue}>
                <XAxis dataKey="month" tick={{ fill: '#555', fontSize: 10 }} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} tickLine={false} />
                <YAxis tick={{ fill: '#555', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${Math.round(Number(v) / 10000)}만`} />
                <Tooltip contentStyle={{ background: '#1a1830', border: '0.5px solid rgba(123,94,167,0.4)', borderRadius: 8, fontSize: 11, color: '#e8e0f5' }} formatter={(v: number) => [`₩${v.toLocaleString()}`, '매출']} />
                <Line type="monotone" dataKey="amount" stroke={C.gold} strokeWidth={2} dot={{ fill: C.gold, r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          {stats.topBuyers.length > 0 && <>
            <div style={{ fontSize: 10, letterSpacing: '.15em', color: C.gold, margin: '16px 0 10px' }}>✦ 구매자 랭킹 TOP 10</div>
            <button type="button" onClick={() => setShowBroadcastModal(true)} disabled={selectedBuyerIds.length === 0} style={{ width: '100%', marginBottom: 10, padding: '9px', borderRadius: 9, border: 'none', background: selectedBuyerIds.length === 0 ? 'rgba(123,94,167,0.25)' : C.purple, color: '#fff', fontSize: 12, fontWeight: 600, cursor: selectedBuyerIds.length === 0 ? 'default' : 'pointer' }}>선택 고객 발송 ({selectedBuyerIds.length})</button>
            {showBroadcastModal && <BuyerBroadcastModal selectedBuyerIds={selectedBuyerIds} buyers={customers as any} onClose={() => setShowBroadcastModal(false)} />}
            {stats.topBuyers.map((c, i) => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 9, marginBottom: 6 }}>
                <input type="checkbox" checked={selectedBuyerIds.includes(c.id)} onChange={() => setSelectedBuyerIds(prev => prev.includes(c.id) ? prev.filter(id => id !== c.id) : [...prev, c.id])} style={{ accentColor: C.purple, width: 14, height: 14 }} />
                <div style={{ fontSize: 13, color: C.gold, minWidth: 20 }}>{i + 1}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: '#e8e0f5' }}>{c.name}</div>
                  <div style={{ fontSize: 10, color: '#555', marginTop: 1 }}>{c.phone || '-'} · {c.visit_count}회 구매</div>
                </div>
                <div style={{ fontSize: 12, color: C.gold }}>₩{c.total_amount.toLocaleString()}</div>
              </div>
            ))}
          </>}
          {stats.topProductsByRevenue.length > 0 && <>
            <div style={{ fontSize: 10, letterSpacing: '.15em', color: C.gold, margin: '16px 0 10px' }}>✦ 제품 랭킹 TOP 10 (매출)</div>
            {stats.topProductsByRevenue.map((p, i) => (
              <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 9, marginBottom: 6 }}>
                <div style={{ fontSize: 13, color: C.gold, minWidth: 20 }}>{i + 1}</div>
                <div style={{ flex: 1, fontSize: 12, color: '#e8e0f5' }}>{p.name}</div>
                <div style={{ fontSize: 12, color: C.gold }}>₩{p.amount.toLocaleString()}</div>
              </div>
            ))}
          </>}
        </div>
      )}
    </div>
  )
}
