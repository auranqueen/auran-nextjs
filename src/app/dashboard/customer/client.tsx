'use client'

import Image from 'next/image'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import NoticeBell from '@/components/NoticeBell'
import DashboardBottomNav from '@/components/DashboardBottomNav'
import { createClient } from '@/lib/supabase/client'
import { useAdminSettings } from '@/hooks/useAdminSettings'

interface Props {
  profile: any
  notifications: any[]
  recentOrders: any[]
  pointHistory: any[]
  featuredProducts?: any[]
}

const BRAND_TABS = ['전체', 'Civasan', 'Gernetic', 'Shopbelle', '보떼덤', 'Dr.Sante']
const QUICK_MENUS = [
  { icon: '🧬', label: 'AI 피부 분석', href: '/ai-analysis' },
  { icon: '📅', label: '살롱 예약', href: '/booking' },
  { icon: '🌍', label: '마이월드', href: '/myworld' },
  { icon: '📦', label: '구매 내역', href: '/orders' },
]

const DEFAULT_COORDS = { lat: 35.8562, lng: 128.6310 }

function toNum(v: any) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const rad = (deg: number) => (deg * Math.PI) / 180
  const dLat = rad(bLat - aLat)
  const dLng = rad(bLng - aLng)
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

function normalizeBrandName(p: any) {
  return (p.brand_name || p.brands?.name || '').toString()
}

export default function CustomerDashboardClient({ profile }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const { getSettingNum, getSetting } = useAdminSettings()
  const [wallet, setWallet] = useState({ points: toNum(profile?.points), balance: toNum(profile?.charge_balance) })
  const [brandTab, setBrandTab] = useState('전체')
  const [categoryTab, setCategoryTab] = useState('전체')
  const [products, setProducts] = useState<any[]>([])
  const [specials, setSpecials] = useState<any[]>([])
  const [stores, setStores] = useState<any[]>([])
  const [specialMeta, setSpecialMeta] = useState<Record<string, { buyers: number; hook: string }>>({})
  const [nowTs, setNowTs] = useState(Date.now())
  const [specialIndex, setSpecialIndex] = useState(0)
  const [coords, setCoords] = useState(DEFAULT_COORDS)
  const specialWrapRef = useRef<HTMLDivElement | null>(null)

  const reviewThreshold = getSettingNum('product_hook', 'review_threshold', 10)
  const aiHookEnabled = getSettingNum('product_hook', 'ai_hook_enabled', 1) === 1
  const buyerBadgeMin = getSettingNum('product_hook', 'buyer_badge_min', 10)

  useEffect(() => {
    const run = async () => {
      const { data: auth } = await supabase.auth.getUser()
      const user = auth?.user
      if (!user) return

      const { data: me } = await supabase.from('users').select('id, points, charge_balance').eq('auth_id', user.id).maybeSingle()
      if (me?.id) {
        const { data: uw } = await supabase.from('user_wallets').select('points, charge_balance, balance').eq('user_id', me.id).maybeSingle()
        if (uw) {
          setWallet({
            points: toNum(uw.points ?? me.points),
            balance: toNum(uw.charge_balance ?? uw.balance ?? me.charge_balance),
          })
        } else {
          setWallet({ points: toNum(me.points), balance: toNum(me.charge_balance) })
        }
      }
    }
    run()
  }, [supabase, profile?.points, profile?.charge_balance])

  useEffect(() => {
    const run = async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id,brand_id,name,description,retail_price,supply_price,stock,thumb_img,detail_imgs,category,status,skin_types,age_groups,sales_count,review_count,avg_rating,created_at,brands(name),is_flash_sale,flash_sale_start,flash_sale_end,flash_sale_price')
        .eq('status', 'active')
        .gt('retail_price', 0)
        .order('sales_count', { ascending: false })
        .limit(200)
      if (error) return
      const list = (data || []).map((p: any) => ({ ...p, brand_name: p.brands?.name || '' }))
      setProducts(list)

      const now = new Date().toISOString()
      const liveFlash = list
        .filter((p: any) => p.is_flash_sale && p.flash_sale_end && p.flash_sale_end > now)
        .sort((a: any, b: any) => new Date(a.flash_sale_end).getTime() - new Date(b.flash_sale_end).getTime())
      const nextSpecials = (liveFlash.length > 0 ? liveFlash : [...list].sort((a: any, b: any) => toNum(b.sales_count) - toNum(a.sales_count))).slice(0, 8)
      setSpecials(nextSpecials)

      const ids = nextSpecials.map((p: any) => p.id)
      if (ids.length > 0) {
        const { data: buyerRows } = await supabase.from('order_items').select('product_id').in('product_id', ids)
        const buyerCountMap: Record<string, number> = {}
        for (const r of buyerRows || []) {
          const id = String((r as any).product_id || '')
          if (!id) continue
          buyerCountMap[id] = (buyerCountMap[id] || 0) + 1
        }
        const { data: reviewRows } = await supabase
          .from('reviews')
          .select('product_id,content,rating')
          .eq('review_type', 'product')
          .eq('status', '게시')
          .gte('rating', 4)
          .in('product_id', ids)
        const map: Record<string, { buyers: number; hook: string }> = {}
        const keywordPool = ['모공', '피지', '보습', '진정', '탄력', '미백', '트러블', '수분', '촉촉', '깨끗', '개선']
        const skinType = String(profile?.skin_type || '')
        const aiMap: Record<string, string> = {
          건성: '당기는 피부에 수분막을 채워줘요 💧',
          지성: '피지·모공 세척으로 맑은 피부 시작 ✨',
          복합성: 'T존 피지 + U존 수분 동시 케어 🌿',
          민감성: '자극 없이 진정시켜주는 성분 확인 🌸',
          트러블성: '트러블 원인 차단, 맑아지는 피부 🔴→⚪',
          안티에이징형: '탄력·주름 집중 케어 라인 👑',
        }
        for (const id of ids) {
          const rows = (reviewRows || []).filter((r: any) => String(r.product_id) === id)
          let hook = aiMap[skinType] || '내 피부타입 맞춤 추천 제품이에요'
          if (aiHookEnabled && rows.length >= reviewThreshold) {
            const counts: Record<string, number> = {}
            for (const r of rows) {
              const c = String(r.content || '')
              for (const k of keywordPool) {
                if (c.includes(k)) counts[k] = (counts[k] || 0) + 1
              }
            }
            const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k]) => k)
            if (top.length >= 2) hook = `${top[0]}·${top[1]} 케어에 효과적이에요 ✨`
            else if (top.length === 1) hook = `${top[0]} 케어에 효과적이에요 ✨`
          }
          map[id] = { buyers: buyerCountMap[id] || 0, hook }
        }
        setSpecialMeta(map)
      }
    }
    run()
  }, [supabase, profile?.skin_type, aiHookEnabled, reviewThreshold])

  useEffect(() => {
    if (!navigator?.geolocation) {
      setCoords(DEFAULT_COORDS)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude })
      },
      () => {
        setCoords(DEFAULT_COORDS)
      },
      { timeout: 5000, maximumAge: 300000 }
    )
  }, [])

  useEffect(() => {
    const run = async () => {
      const { data, error } = await supabase.from('auran_stores').select('*').limit(60)
      if (error || !data) return

      const sorted = data
        .map((s: any) => {
          const lat = toNum(s.lat ?? s.latitude)
          const lng = toNum(s.lng ?? s.longitude)
          return {
            ...s,
            distance_km: lat && lng ? distanceKm(coords.lat, coords.lng, lat, lng) : 9999,
          }
        })
        .sort((a: any, b: any) => a.distance_km - b.distance_km)
        .slice(0, 3)

      setStores(sorted)
    }
    run()
  }, [supabase, coords.lat, coords.lng])

  const filteredProducts = useMemo(() => {
    return products.filter((p: any) => {
      const brandName = normalizeBrandName(p)
      const skinTypes = Array.isArray(p.skin_types) ? p.skin_types : []
      const brandOk = brandTab === '전체' || brandName.toLowerCase() === brandTab.toLowerCase()
      const categoryOk = categoryTab === '전체' || skinTypes.includes(categoryTab)
      return brandOk && categoryOk
    })
  }, [products, brandTab, categoryTab])

  useEffect(() => {
    const t = setInterval(() => setNowTs(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (specials.length <= 1) return
    const t = setInterval(() => {
      setSpecialIndex((prev) => {
        const next = (prev + 1) % specials.length
        const wrap = specialWrapRef.current
        if (wrap) {
          const child = wrap.children[next] as HTMLElement | undefined
          if (child) wrap.scrollTo({ left: child.offsetLeft, behavior: 'smooth' })
        }
        return next
      })
    }, 3000)
    return () => clearInterval(t)
  }, [specials.length])

  const buyerBadge = (n: number) => {
    if (n >= 500) return `👑 ${n}명 구매 · AURAN 베스트`
    if (n >= 100) return `🔥 ${n}명의 선택! 인기 제품`
    if (n >= 50) return `⭐ ${n}명이 만족했어요`
    if (n >= buyerBadgeMin) return `${n}명이 구매했어요`
    return ''
  }

  const skinTypeChips = useMemo(() => {
    const unique: string[] = []
    for (const p of products) {
      const skins = Array.isArray(p.skin_types) ? p.skin_types : []
      for (const s of skins) {
        const label = String(s || '').trim()
        if (!label) continue
        if (!unique.includes(label)) unique.push(label)
      }
    }
    return ['전체', ...unique]
  }, [products])

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', maxWidth: 480, margin: '0 auto', paddingBottom: 120 }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 20, backdropFilter: 'blur(12px)', background: 'rgba(10,12,15,0.92)', borderBottom: '1px solid var(--border)', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontFamily: "'Cinzel Decorative', serif", fontSize: 20, color: '#fff', letterSpacing: 2 }}>AURAN</div>
        <NoticeBell />
      </div>

      <div style={{ padding: 16 }}>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>안녕하세요, {profile?.name || '고객'}님</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>오늘도 아름다운 하루를 시작해요.</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
          <div style={{ border: '1px solid rgba(201,168,76,0.28)', background: 'rgba(201,168,76,0.1)', borderRadius: 14, padding: 12 }}>
            <div style={{ fontSize: 10, color: 'rgba(201,168,76,0.75)' }}>포인트</div>
            <div style={{ marginTop: 6, fontFamily: "'JetBrains Mono', monospace", fontSize: 20, fontWeight: 800, color: 'var(--gold)' }}>{wallet.points.toLocaleString()}P</div>
          </div>
          <div style={{ border: '1px solid rgba(76,173,126,0.28)', background: 'rgba(76,173,126,0.1)', borderRadius: 14, padding: 12 }}>
            <div style={{ fontSize: 10, color: 'rgba(76,173,126,0.75)' }}>충전 잔액</div>
            <div style={{ marginTop: 6, fontFamily: "'JetBrains Mono', monospace", fontSize: 20, fontWeight: 800, color: '#4cad7e' }}>₩{wallet.balance.toLocaleString()}</div>
          </div>
        </div>

        <button onClick={() => router.push('/ai-analysis')} style={{ width: '100%', marginBottom: 14, border: '1px solid rgba(201,168,76,0.35)', background: 'linear-gradient(135deg, rgba(201,168,76,0.2), rgba(201,168,76,0.08))', borderRadius: 14, padding: '14px 12px', color: 'var(--gold)', fontWeight: 800, fontSize: 14, textAlign: 'left' }}>
          🧬 AI 피부분석 시작하기
        </button>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
          {QUICK_MENUS.map((m) => (
            <button key={m.label} onClick={() => router.push(m.href)} style={{ border: '1px solid var(--border)', background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: '14px 12px', textAlign: 'left' }}>
              <div style={{ fontSize: 20 }}>{m.icon}</div>
              <div style={{ marginTop: 6, fontSize: 13, fontWeight: 700, color: '#fff' }}>{m.label}</div>
            </button>
          ))}
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', marginBottom: 10 }}>오늘의 특가</div>
          <div ref={specialWrapRef} style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4, scrollBehavior: 'smooth' }}>
            {specials.map((p: any) => (
              <div key={p.id} style={{ width: 190, flexShrink: 0, border: '1px solid var(--border)', borderRadius: 12, background: 'rgba(255,255,255,0.04)', overflow: 'hidden', cursor: 'pointer' }}>
                <div onClick={() => router.push(`/products/${p.id}`)} style={{ position: 'relative', width: '100%', aspectRatio: '1', background: 'rgba(128,128,128,0.3)' }}>
                  {p.thumb_img ? <Image src={p.thumb_img} alt={p.name} fill style={{ objectFit: 'cover' }} /> : null}
                  {p.is_flash_sale && p.flash_sale_end && new Date(p.flash_sale_end).getTime() > nowTs && (
                    <div style={{ position: 'absolute', top: 8, left: 8, background: '#d94f4f', color: '#fff', borderRadius: 999, padding: '3px 8px', fontSize: 10, fontWeight: 800 }}>
                      ⏱ {new Date(new Date(p.flash_sale_end).getTime() - nowTs).toISOString().slice(11, 19)}
                    </div>
                  )}
                </div>
                <div style={{ padding: 8 }}>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>{normalizeBrandName(p)}</div>
                  <div style={{ fontSize: 12, color: '#fff', fontWeight: 700, lineHeight: 1.3, minHeight: 32, display: '-webkit-box', WebkitLineClamp: 2 as any, WebkitBoxOrient: 'vertical' as any, overflow: 'hidden' }}>{p.name}</div>
                  {p.is_flash_sale && p.flash_sale_price && p.flash_sale_end && new Date(p.flash_sale_end).getTime() > nowTs ? (
                    <div>
                      <span style={{ fontSize: 11, color: 'var(--text3)', textDecoration: 'line-through' }}>₩{toNum(p.retail_price).toLocaleString()}</span>
                      <span style={{ fontSize: 13, color: '#ff6b6b', fontWeight: 900, marginLeft: 6 }}>₩{toNum(p.flash_sale_price).toLocaleString()}</span>
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: 'var(--gold)', fontWeight: 800 }}>₩{toNum(p.retail_price).toLocaleString()}</div>
                  )}
                  <div style={{ marginTop: 6, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 6, fontSize: 11, color: '#ffd98a', minHeight: 28 }}>
                    {`${buyerBadge(specialMeta[p.id]?.buyers || 0)} ${specialMeta[p.id]?.hook || ''}`.trim()}
                  </div>
                  <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    <button style={{ border: '1px solid var(--border)', background: 'rgba(255,255,255,0.04)', borderRadius: 8, color: '#fff', fontSize: 11, padding: '7px 0' }}>담기</button>
                    <button onClick={() => router.push(`/products/${p.id}`)} style={{ border: '1px solid rgba(201,168,76,0.45)', background: 'rgba(201,168,76,0.1)', color: 'var(--gold)', borderRadius: 8, fontSize: 11, padding: '7px 0' }}>구매하기</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 10 }}>
            {specials.map((_, idx) => (
              <span key={idx} style={{ width: 6, height: 6, borderRadius: 999, background: idx === specialIndex ? '#c9a84c' : 'rgba(255,255,255,0.25)' }} />
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', marginBottom: 10 }}>내 지역 인기 관리샵</div>
          <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
            {stores.map((s: any, idx) => (
              <div key={s.id || idx} style={{ width: 180, flexShrink: 0, border: '1px solid var(--border)', borderRadius: 12, background: 'rgba(255,255,255,0.04)', padding: 10 }}>
                <div style={{ fontSize: 13, color: '#fff', fontWeight: 700 }}>{s.name || s.store_name || `스토어 ${idx + 1}`}</div>
                <div style={{ marginTop: 4, fontSize: 11, color: 'var(--text3)' }}>{s.address || s.region || ''}</div>
                <div style={{ marginTop: 6, fontSize: 11, color: 'var(--gold)' }}>
                  {Number.isFinite(s.distance_km) ? `${s.distance_km.toFixed(1)}km` : ''}
                </div>
              </div>
            ))}
            {/* 위치 권한 없을 때도 기본 좌표로 쿼리 실행되므로 텍스트는 노출하지 않습니다. */}
            {stores.length === 0 ? null : null}
          </div>
        </div>

        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', marginBottom: 10 }}>전체 상품</div>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8, marginBottom: 6 }}>
            {BRAND_TABS.map((b) => (
              <button key={b} onClick={() => setBrandTab(b)} style={{ whiteSpace: 'nowrap', borderRadius: 999, border: brandTab === b ? '1px solid rgba(201,168,76,0.55)' : '1px solid var(--border)', background: brandTab === b ? 'rgba(201,168,76,0.12)' : 'rgba(255,255,255,0.04)', color: brandTab === b ? 'var(--gold)' : '#fff', fontSize: 12, padding: '7px 12px' }}>{b}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8, marginBottom: 10 }}>
            {skinTypeChips.map((c) => (
              <button key={c} onClick={() => setCategoryTab(c)} style={{ whiteSpace: 'nowrap', borderRadius: 999, border: categoryTab === c ? '1px solid rgba(74,141,192,0.55)' : '1px solid var(--border)', background: categoryTab === c ? 'rgba(74,141,192,0.15)' : 'rgba(255,255,255,0.04)', color: categoryTab === c ? '#8bb9dc' : '#fff', fontSize: 12, padding: '7px 12px' }}>{c}</button>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {filteredProducts.map((p: any) => (
              <div key={p.id} style={{ border: '1px solid var(--border)', borderRadius: 12, background: 'rgba(255,255,255,0.04)', overflow: 'hidden' }}>
                <div onClick={() => router.push(`/products/${p.id}`)} style={{ cursor: 'pointer' }}>
                  <div style={{ width: '100%', aspectRatio: '1', background: 'rgba(0,0,0,0.2)' }}>
                    {p.thumb_img ? <img src={p.thumb_img} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ height: '100%', display: 'grid', placeItems: 'center' }}>🧴</div>}
                  </div>
                  <div style={{ padding: 10 }}>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>{normalizeBrandName(p)}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', minHeight: 32 }}>{p.name}</div>
                    <div style={{ marginTop: 4, fontSize: 12, color: 'var(--gold)', fontWeight: 800 }}>₩{toNum(p.retail_price).toLocaleString()}</div>
                  </div>
                </div>
                <div style={{ padding: '0 10px 10px' }}>
                  <button onClick={() => router.push(`/products/${p.id}`)} style={{ width: '100%', border: '1px solid rgba(201,168,76,0.45)', background: 'rgba(201,168,76,0.1)', color: 'var(--gold)', borderRadius: 10, padding: '9px 0', fontWeight: 700, fontSize: 12 }}>
                    구매하기
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <DashboardBottomNav role="customer" />
    </div>
  )
}
