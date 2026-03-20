'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import NoticeBell from '@/components/NoticeBell'
import DashboardBottomNav from '@/components/DashboardBottomNav'
import { createClient } from '@/lib/supabase/client'

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
  const [wallet, setWallet] = useState({ points: toNum(profile?.points), balance: toNum(profile?.charge_balance) })
  const [brandTab, setBrandTab] = useState('전체')
  const [categoryTab, setCategoryTab] = useState('전체')
  const [products, setProducts] = useState<any[]>([])
  const [specials, setSpecials] = useState<any[]>([])
  const [stores, setStores] = useState<any[]>([])
  const [coords, setCoords] = useState(DEFAULT_COORDS)
  const [storesFallback, setStoresFallback] = useState(false)

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
        .select('id,brand_id,name,description,retail_price,supply_price,stock,thumb_img,detail_imgs,category,status,skin_types,age_groups,sales_count,review_count,avg_rating,created_at,brands(name)')
        .eq('status', 'active')
        .order('sales_count', { ascending: false })
        .limit(200)
      if (error) return
      const list = (data || []).map((p: any) => ({ ...p, brand_name: p.brands?.name || '' }))
      setProducts(list)

      const nextSpecials = [...list]
        .sort((a: any, b: any) => toNum(b.retail_price) - toNum(a.retail_price))
        .slice(0, 4)
      setSpecials(nextSpecials)
    }
    run()
  }, [supabase])

  useEffect(() => {
    if (!navigator?.geolocation) {
      setStoresFallback(true)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude })
      },
      () => {
        setStoresFallback(true)
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
          <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
            {specials.map((p: any) => (
              <div key={p.id} onClick={() => router.push(`/products/${p.id}`)} style={{ width: 150, flexShrink: 0, border: '1px solid var(--border)', borderRadius: 12, background: 'rgba(255,255,255,0.04)', overflow: 'hidden', cursor: 'pointer' }}>
                <div style={{ width: '100%', aspectRatio: '1', background: 'rgba(0,0,0,0.2)' }}>
                  {p.thumb_img ? <img src={p.thumb_img} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ height: '100%', display: 'grid', placeItems: 'center' }}>🧴</div>}
                </div>
                <div style={{ padding: 8 }}>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>{normalizeBrandName(p)}</div>
                  <div style={{ fontSize: 12, color: '#fff', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--gold)', fontWeight: 800 }}>₩{toNum(p.retail_price).toLocaleString()}</div>
                </div>
              </div>
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
            {stores.length === 0 && <div style={{ fontSize: 12, color: 'var(--text3)' }}>{storesFallback ? '위치 권한 없이 기본 지역 기준으로 로딩 중입니다.' : '스토어 데이터가 없습니다.'}</div>}
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
