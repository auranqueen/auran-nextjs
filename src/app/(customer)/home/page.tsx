'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const GOLD = '#C9A96E'
const BG = '#0D0B09'
const CARD_BG = 'rgba(255,255,255,0.03)'
const CARD_BORDER = '1px solid rgba(255,255,255,0.07)'
const TEXT_MUTED = 'rgba(255,255,255,0.4)'
const TEXT_DIM = 'rgba(255,255,255,0.25)'

// Ìè¥Î∞± Îç∞Ïù¥Ì?∞ (Supabase Ï?∞Îè? Ï†?)
const FALLBACK_CONCERNS = [
  { id: 1, name: 'Ï??Î∂?Î∂?Ï°±', icon: '??ß' },
  { id: 2, name: 'ÎØ∏Î∞±¬∑Ì?§Ï??', icon: '‚?®' },
  { id: 3, name: 'Î™®Í≥µ¬∑Í∞ÅÏß?', icon: '??ç' },
  { id: 4, name: 'ÎØºÍ∞ê¬∑Ïß?Ï†?', icon: '??ø' },
  { id: 5, name: 'Ï??Ì?∞Ï?êÏù¥Ïß?', icon: '‚è∞' },
  { id: 6, name: 'Ï?êÏ?∏Ï?†Ï∞®Î?®', icon: '‚??Ô∏è' },
  { id: 7, name: 'Ì??Î†•¬∑Î¶¨Ì??Ì??', icon: '???' },
]

const FALLBACK_PRODUCTS = [
  { id: 1, name: 'MESS CREAM 50ml', brand: 'CIVASAN', price: 58000, badge: 'AIÏ∂?Ï≤?', icon: '?ß¥' },
  { id: 2, name: 'Î∞?Ïù¥Ï?§ Ï?êÏ?ºÏ?§ Ï?∏Î?º', brand: 'GERNETIC', price: 94000, badge: 'Ïù∏Í∏∞', icon: '??ø' },
  { id: 3, name: 'Î?•ÌÅ¥Î†?Ïß? Ìèº', brand: 'SHOPBELLE', price: 32000, badge: '', icon: '?´ß' },
  { id: 4, name: 'ÌÅ¨Î¶¨Ï?§Ì?† Î∞?Ï?§Ï??Ì?∏', brand: 'THALAC', price: 45000, badge: '', icon: '???' },
]

const FALLBACK_SALES = [
  { id: 1, name: 'MESS CREAM 50ml', brand: 'CIVASAN', orig: 58000, sale: 40600, disc: 30, icon: '?ß¥' },
  { id: 2, name: 'Î∞?Ïù¥Ï?§ Ï?êÏ?ºÏ?§ Ï?∏Î?º', brand: 'GERNETIC', orig: 94000, sale: 70500, disc: 25, icon: '??ø' },
  { id: 3, name: 'ÌÅ¨Î¶¨Ï?§Ì?† Îß?Î¶∞ Î∞?Ï?§Ï??Ì?∏', brand: 'THALAC', orig: 45000, sale: 36000, disc: 20, icon: '???' },
]

const FALLBACK_SALONS = [
  { id: 1, name: 'Îç?Ì??Î?∏Ïù¥ Ì??Ï?§Î∞?Î??', rating: 4.9, reviews: 127, area: 'Î??Íµ¨ Î?¨Ï??Íµ¨', dist: '0.3km', open: true, tags: ['Ì??Ïù¥Ï??', 'Î∞?Î??', 'Ï??Î°?Îß?'] },
  { id: 2, name: 'Î∑∞Ì?∞ÌÅ¥Î¶¨Î?? Î??Íµ¨Ï†ê', rating: 4.7, reviews: 89, area: 'Î??Íµ¨ Ï??Ï?±Íµ¨', dist: '1.2km', open: true, tags: ['Î¶¨Ì??Ì??', 'ÌÅ¥Î¶¨Î??'] },
  { id: 3, name: 'Ï?§Ì?®Ï?êÏ?§Ì??Ì?±', rating: 4.5, reviews: 54, area: 'Î??Íµ¨ Ï§?Íµ¨', dist: '2.1km', open: false, tags: ['Ì?ºÎ∂?Í¥?Î¶¨', 'ÎØºÍ∞êÏ?±'] },
]

const FALLBACK_NEW = [
  { id: 1, name: 'ÌçºÌ??Ì?∏ Î??Ïù¥Ì?∏ ÌÅ¨Î¶º', brand: 'CIVASAN', price: 68000, icon: '???' },
  { id: 2, name: 'ÏπºÎ∞ç Ï?êÏ?ºÏ?§ ÎØ∏Ï?§Ì?∏', brand: 'GERNETIC', price: 52000, icon: '?©µ' },
  { id: 3, name: 'Î°?Ï¶? Ì?†Î?ù Ì?®Î??', brand: 'SHOPBELLE', price: 38000, icon: '??∏' },
  { id: 4, name: 'Îß?Î¶∞ Î¶¨Ì??Ï?¥ Ï?∞Ì??', brand: 'THALAC', price: 84000, icon: '???' },
]

const FALLBACK_BRANDS = [
  { id: 1, name: 'CIVASAN', label: 'Ï??Î∞?Ï?∞', color: '#C9A96E', bg: 'rgba(201,169,110,0.1)', border: 'rgba(201,169,110,0.3)' },
  { id: 2, name: 'GERNETIC', label: 'Ï†?Î•¥Î?§Ì?±', color: 'rgba(120,180,240,0.9)', bg: 'rgba(100,160,220,0.1)', border: 'rgba(100,160,220,0.25)' },
  { id: 3, name: 'SHOPBELLE', label: 'Ï?µÎ≤®Î•¥', color: 'rgba(200,150,220,0.9)', bg: 'rgba(180,120,200,0.1)', border: 'rgba(180,120,200,0.25)' },
  { id: 4, name: 'THALAC', label: 'Ì??ÎùΩ', color: 'rgba(80,190,210,0.9)', bg: 'rgba(60,160,180,0.1)', border: 'rgba(60,160,180,0.25)' },
  { id: 5, name: 'SOTHYS', label: 'Ï??Ì?∞Ï?§', color: 'rgba(240,180,100,0.9)', bg: 'rgba(220,160,80,0.1)', border: 'rgba(220,160,80,0.25)' },
  { id: 6, name: 'PHYTO', label: 'Ì?ºÌ?†Î®∏', color: 'rgba(180,220,140,0.9)', bg: 'rgba(160,200,120,0.1)', border: 'rgba(160,200,120,0.25)' },
  { id: 7, name: 'ESTER', label: 'Ï?êÏ?§Ì?∞', color: 'rgba(240,120,140,0.9)', bg: 'rgba(220,100,120,0.1)', border: 'rgba(220,100,120,0.25)' },
]

const FALLBACK_HISTORY = [
  { icon: '?ß¥', date: '03.01', brand: 'CIVASAN', name: 'MESS CREAM' },
  { icon: '??ø', date: '02.15', brand: 'GERNETIC', name: 'Î∞?Ïù¥Ï?§ Ï?∏Î?º' },
  { icon: '?´ß', date: '02.01', brand: 'SHOPBELLE', name: 'Î?•ÌÅ¥Î†?Ïß? Ìèº' },
  { icon: '???', date: '01.20', brand: 'THALAC', name: 'Î∞?Ï?§Ï??Ì?∏' },
]

export default function CustomerHomePage() {
  const router = useRouter()
  const supabase = createClient()

  const [userName, setUserName] = useState('Ï?†ÎØ∏')
  const [selectedConcern, setSelectedConcern] = useState(0)
  const [saleTab, setSaleTab] = useState<'sale' | 'group'>('sale')
  const [timers, setTimers] = useState([
    { h: 2, m: 34, s: 21 },
    { h: 0, m: 47, s: 55 },
    { h: 5, m: 12, s: 8 },
  ])

  // Supabase Îç∞Ïù¥Ì?∞
  const [concerns, setConcerns] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [timeSales, setTimeSales] = useState<any[]>([])
  const [salons, setSalons] = useState<any[]>([])
  const [newProducts, setNewProducts] = useState<any[]>([])
  const [brands, setBrands] = useState<any[]>([])

  useEffect(() => {
    // TODO: user_daily_tracker Ì??Ïù¥Î∏?Ï?êÏ?? Ï?§Î?? Îç∞Ïù¥Ì?∞ Ï°∞Ì??
    supabase.auth.getUser().then(({ data }) => {
      const name = data.user?.user_metadata?.full_name || data.user?.user_metadata?.name
      if (name) setUserName(name)
    })
    // TODO: skin_concerns Ì??Ïù¥Î∏?
    supabase.from('skin_concerns').select('*').order('sort_order').then(({ data }) => {
      if (data && data.length > 0) setConcerns(data)
    })
    // TODO: products Ì??Ïù¥Î∏? (AI Ï∂?Ï≤? Í∏∞Ï§?)
    supabase.from('products').select('*').eq('is_active', true).limit(8).then(({ data }) => {
      if (data && data.length > 0) setProducts(data)
    })
    // TODO: time_sales Ì??Ïù¥Î∏?
    supabase.from('time_sales').select('*, product:products(*)').eq('is_active', true).then(({ data }) => {
      if (data && data.length > 0) setTimeSales(data)
    })
    // TODO: salons Ì??Ïù¥Î∏? (Ï??Ïπ? Í∏∞Î∞? Ï†?Î†¨)
    supabase.from('salons').select('*').eq('is_active', true).limit(3).then(({ data }) => {
      if (data && data.length > 0) setSalons(data)
    })
    // TODO: products is_new Ïª¨Î?º
    supabase.from('products').select('*').eq('is_new', true).limit(6).then(({ data }) => {
      if (data && data.length > 0) setNewProducts(data)
    })
    // TODO: brands Ì??Ïù¥Î∏?
    supabase.from('brands').select('*').eq('is_active', true).limit(7).then(({ data }) => {
      if (data && data.length > 0) setBrands(data)
    })
  }, [])

  // Ï?§Ï??Í∞? Ì??Ïù¥Î®∏
  useEffect(() => {
    const id = setInterval(() => {
      setTimers(prev =>
        prev.map(t => {
          if (t.s > 0) return { ...t, s: t.s - 1 }
          if (t.m > 0) return { ...t, m: t.m - 1, s: 59 }
          if (t.h > 0) return { ...t, h: t.h - 1, m: 59, s: 59 }
          return t
        })
      )
    }, 1000)
    return () => clearInterval(id)
  }, [])

  const pad = (n: number) => String(n).padStart(2, '0')

  // Ìè¥Î∞± Ï†ÅÏ?©
  const concernList = concerns.length > 0 ? concerns : FALLBACK_CONCERNS
  const productList = products.length > 0 ? products : FALLBACK_PRODUCTS
  const saleList = timeSales.length > 0 ? timeSales : FALLBACK_SALES
  const salonList = salons.length > 0 ? salons : FALLBACK_SALONS
  const newList = newProducts.length > 0 ? newProducts : FALLBACK_NEW
  const brandList = brands.length > 0 ? brands : FALLBACK_BRANDS

  const today = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
  })

  return (
    <div style={{
      background: BG,
      minHeight: '100vh',
      maxWidth: '390px',
      margin: '0 auto',
      fontFamily: "'Noto Sans KR', -apple-system, sans-serif",
      fontWeight: 300,
      color: '#fff',
      paddingBottom: '96px',
    }}>

      {/* ‚??‚?? Ì??Î∞? ‚??‚?? */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 40,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 20px',
        background: 'rgba(13,11,9,0.95)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        backdropFilter: 'blur(12px)',
      }}>
        <span style={{
          fontFamily: 'Georgia, serif',
          fontSize: '22px', fontWeight: 400,
          color: GOLD, letterSpacing: '6px',
        }}>AURAN</span>
        <div style={{ display: 'flex', gap: '10px' }}>
          {['??ç', '???'].map((icon, i) => (
            <button key={i} style={{
              width: '34px', height: '34px', borderRadius: '50%',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '15px', cursor: 'pointer',
            }}>{icon}</button>
          ))}
        </div>
      </header>

      {/* ‚??‚?? Ïù∏Ï?¨Îßê ‚??‚?? */}
      <div style={{
        padding: '14px 20px 0',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontSize: '10px', fontFamily: 'monospace', color: TEXT_MUTED, marginBottom: '4px' }}>
            {today}
          </div>
          <div style={{ fontSize: '16px', fontWeight: 400, marginBottom: '3px' }}>
            Ï??Î??Ì??Ï?∏Ï??, <span style={{ color: GOLD }}>{userName}Î??</span> ???
          </div>
          <div style={{ fontSize: '11px', color: TEXT_MUTED }}>
            Ï?§Î?? Î£®Ì?¥ Ï??Î£? 75% ¬∑ Ï??Î∂? 6/8Ï?? ??ß
          </div>
        </div>
        <div style={{
          width: '40px', height: '40px', borderRadius: '50%',
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '20px',
        }}>??©</div>
      </div>

      {/* ‚??‚?? BEAUTY TRACKER ‚??‚?? */}
      <div style={{
        margin: '12px 16px 0',
        background: CARD_BG, border: CARD_BORDER,
        borderRadius: '18px', padding: '14px 16px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
          <span style={{ fontSize: '10px', fontFamily: 'monospace', letterSpacing: '1.5px', color: TEXT_MUTED }}>
            BEAUTY TRACKER
          </span>
          <span style={{ fontSize: '10px', fontFamily: 'monospace', color: TEXT_DIM }}>
            {new Date().toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {[
            { icon: '??ß', val: '6', unit: '/8', label: 'Ï??Î∂? Ï?≠Ï∑®', pct: 75, color: '#6ab0e0' },
            { icon: '???', val: 'UV', unit: '3', label: 'Ï?êÏ?∏Ï?†', pct: 40, color: '#f0c040' },
            { icon: '??¥', val: '7.5', unit: 'h', label: 'Ï??Î©¥', pct: 80, color: '#a080e0' },
            { icon: '?ß¥', val: '75', unit: '%', label: 'Î£®Ì?¥', pct: 75, color: GOLD },
          ].map((item, i) => (
            <div key={i} style={{
              flex: 1, background: 'rgba(255,255,255,0.03)',
              borderRadius: '12px', padding: '10px 6px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
            }}>
              <span style={{ fontSize: '18px' }}>{item.icon}</span>
              <span style={{ fontSize: '13px', fontWeight: 400 }}>
                {item.val}<span style={{ fontSize: '9px', fontWeight: 300 }}>{item.unit}</span>
              </span>
              <span style={{ fontSize: '9px', color: TEXT_MUTED, textAlign: 'center' }}>{item.label}</span>
              <div style={{ width: '100%', height: '2px', borderRadius: '2px', background: 'rgba(255,255,255,0.08)' }}>
                <div style={{ height: '100%', width: `${item.pct}%`, background: item.color, borderRadius: '2px' }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ‚??‚?? Ì??Ï?¥Î°? Î∞∞Î?? ‚??‚?? */}
      <div style={{
        margin: '12px 16px 0', height: '148px',
        borderRadius: '20px', overflow: 'hidden',
        background: 'linear-gradient(135deg,#1a0a2a,#2d1545)',
        position: 'relative', display: 'flex',
      }}>
        <div style={{
          position: 'relative', zIndex: 2, padding: '18px 20px',
          height: '100%', display: 'flex', flexDirection: 'column',
          justifyContent: 'space-between', flex: 1,
        }}>
          <div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '4px',
              background: 'rgba(255,255,255,0.1)', borderRadius: '20px',
              padding: '3px 10px', fontSize: '10px', fontFamily: 'monospace',
              color: 'rgba(255,255,255,0.7)', marginBottom: '7px',
            }}>‚?¶ 3Ï?? ¬∑ SPRING SKIN</div>
            <div style={{ fontSize: '17px', fontWeight: 300, lineHeight: 1.5 }}>
              Î¥? Ì?ºÎ∂? Î≥?Ì??,<br />
              <em style={{ color: GOLD, fontStyle: 'normal' }}>AIÍ∞? Î®ºÏ†?</em> Ï??Ï??Ï±?Î??Î?§
            </div>
          </div>
          <div style={{ display: 'flex', gap: '4px' }}>
            <div style={{ width: '14px', height: '4px', borderRadius: '2px', background: GOLD }} />
            <div style={{ width: '5px', height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.2)' }} />
            <div style={{ width: '5px', height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.2)' }} />
          </div>
        </div>
        <div style={{
          position: 'absolute', right: '16px', top: '50%',
          transform: 'translateY(-50%)', fontSize: '56px', opacity: 0.85,
        }}>??∏</div>
      </div>

      {/* ‚??‚?? TODAY'S SKIN ‚??‚?? */}
      <div
        onClick={() => router.push('/skin-analysis')}
        style={{
          margin: '12px 16px 0', background: CARD_BG, border: CARD_BORDER,
          borderRadius: '16px', padding: '12px 16px',
          display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer',
        }}
      >
        <span style={{ fontSize: '30px' }}>??ß</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '9px', fontFamily: 'monospace', letterSpacing: '1px', color: TEXT_MUTED, marginBottom: '3px' }}>
            TODAY&apos;S SKIN
          </div>
          <div style={{ fontSize: '14px', fontWeight: 400, marginBottom: '4px' }}>Í±¥Ï?± ¬∑ ÎØºÍ∞ê Î≥µÌ?©</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {[{ label: 'Ï??Î∂?', pct: 62, color: '#6ab0e0' }, { label: 'Ï?†Î∂?', pct: 38, color: GOLD }].map((b, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                <span style={{ fontSize: '9px', color: TEXT_MUTED }}>{b.label}</span>
                <div style={{ width: '44px', height: '2px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px' }}>
                  <div style={{ height: '100%', width: `${b.pct}%`, background: b.color, borderRadius: '2px' }} />
                </div>
                <span style={{ fontSize: '9px', color: TEXT_MUTED }}>{b.pct}%</span>
              </div>
            ))}
          </div>
        </div>
        <span style={{ fontSize: '13px', color: TEXT_MUTED }}>‚?∫</span>
      </div>

      {/* ‚??‚?? 4Î?? Í∏∞Î?• Í∑∏Î¶¨Î?? ‚??‚?? */}
      <div style={{ margin: '14px 16px 0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        {[
          { icon: '??¨', title: 'Ì?ºÎ∂?Î∂?Ï?ù', desc: 'AI Ï†?Î∞? Î∂?Ï?ù', badge: 'AI', path: '/skin-analysis', bg: 'linear-gradient(135deg,rgba(160,80,220,0.15),rgba(120,60,180,0.1))' },
          { icon: '??ç', title: 'MY WORLD', desc: 'Î??Îß?Ïù? ÎØ∏Î??Ì??Ì?º', badge: 'MY', path: '/my-world', bg: 'linear-gradient(135deg,rgba(60,120,220,0.15),rgba(40,80,180,0.1))' },
          { icon: '??¨', title: 'Ïª§ÎÆ§Î??Ì?∞', desc: 'Ì?ºÎ∂? Ì??Ï??Î≥? Ï??Ì?µ', badge: 'NEW', path: '/community', bg: 'linear-gradient(135deg,rgba(220,60,60,0.1),rgba(180,40,40,0.08))', badgeColor: '#E04030' },
          { icon: '???', title: 'Ï?¥Î°±Ï??Ï?Ω', desc: 'Ï†?Î¨∏ Í¥?Î¶¨Ï?µ Ï??Ï?Ω', badge: 'Í∑ºÏ≤?', path: '/salon', bg: 'linear-gradient(135deg,rgba(60,180,120,0.12),rgba(40,140,90,0.08))' },
        ].map((f, i) => (
          <div
            key={i}
            onClick={() => router.push(f.path)}
            style={{
              background: f.bg, border: CARD_BORDER,
              borderRadius: '20px', padding: '16px 14px',
              cursor: 'pointer', position: 'relative',
            }}
          >
            <div style={{
              position: 'absolute', top: '10px', right: '10px',
              background: f.badgeColor || 'rgba(201,169,110,0.2)',
              color: f.badgeColor ? '#fff' : GOLD,
              fontSize: '9px', padding: '2px 7px', borderRadius: '6px',
            }}>{f.badge}</div>
            <span style={{ fontSize: '28px', display: 'block', marginBottom: '8px' }}>{f.icon}</span>
            <div style={{ fontSize: '13px', fontWeight: 400, marginBottom: '3px' }}>{f.title}</div>
            <div style={{ fontSize: '10px', color: TEXT_MUTED }}>{f.desc}</div>
          </div>
        ))}
      </div>

      {/* ‚??‚?? AURAN POINT ‚??‚?? */}
      <div style={{
        margin: '14px 16px 0',
        background: CARD_BG, border: '1px solid rgba(201,169,110,0.2)',
        borderRadius: '14px', padding: '12px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        cursor: 'pointer',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '20px' }}>‚?®</span>
          <div>
            <div style={{ fontSize: '9px', fontFamily: 'monospace', color: TEXT_MUTED, marginBottom: '2px' }}>AURAN POINT</div>
            {/* TODO: user_wallets Ì??Ïù¥Î∏?Ï?êÏ?? Ìè¨Ïù∏Ì?∏ Ï°∞Ì?? */}
            <div style={{ fontSize: '14px', fontWeight: 400 }}>
              <em style={{ color: GOLD, fontStyle: 'normal' }}>8,888P</em>{' '}
              <span style={{ color: TEXT_MUTED, fontSize: '11px' }}>Î≥¥Ï?†Ï§?</span>
            </div>
          </div>
        </div>
        <span style={{ fontSize: '16px', color: 'rgba(201,169,110,0.35)' }}>‚?∫</span>
      </div>

      {/* ‚??‚?? Î?¥ Ì?ºÎ∂? Îß?Ï∂§ Ï∂?Ï≤? ‚??‚?? */}
      <div style={{ padding: '16px 16px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <span style={{ fontSize: '13px', fontWeight: 400, color: 'rgba(255,255,255,0.75)' }}>Î?¥ Ì?ºÎ∂? Îß?Ï∂§ Ï∂?Ï≤?</span>
          <span style={{ fontSize: '11px', color: GOLD, cursor: 'pointer' }}>Îç?Î≥¥Í∏∞ ‚?∫</span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', padding: '0 16px 4px', scrollbarWidth: 'none' }}>
        {productList.slice(0, 4).map((p: any, i: number) => (
          <div
            key={i}
            onClick={() => router.push(`/products/${p.id}`)}
            style={{
              minWidth: '130px', background: CARD_BG, border: CARD_BORDER,
              borderRadius: '14px', overflow: 'hidden', cursor: 'pointer', flexShrink: 0,
            }}
          >
            <div style={{
              height: '90px',
              background: 'linear-gradient(135deg,#1a1510,#2a2015)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '34px', position: 'relative',
            }}>
              {p.icon || '?ß¥'}
              {p.badge && (
                <div style={{
                  position: 'absolute', top: '5px', left: '5px',
                  background: 'rgba(201,169,110,0.85)', color: BG,
                  fontSize: '8px', padding: '2px 5px', borderRadius: '4px',
                }}>{p.badge}</div>
              )}
            </div>
            <div style={{ padding: '8px 10px' }}>
              <div style={{ fontSize: '8px', fontFamily: 'monospace', color: 'rgba(201,169,110,0.6)', marginBottom: '2px' }}>{p.brand}</div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.75)', marginBottom: '4px' }}>{p.name}</div>
              <div style={{ fontSize: '12px', fontWeight: 400 }}>{p.price?.toLocaleString()}Ï?ê</div>
            </div>
          </div>
        ))}
      </div>

      {/* ‚??‚?? DUCHESS.KR Íµ¨Î∂?Ï?† ‚??‚?? */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '20px 16px 0' }}>
        <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.07)' }} />
        <span style={{ fontSize: '9px', fontFamily: 'monospace', letterSpacing: '2px', color: TEXT_DIM }}>DUCHESS.KR STORE</span>
        <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.07)' }} />
      </div>

      {/* ‚??‚?? Ì?ºÎ∂? Í≥†ÎØºÎ≥? ‚??‚?? */}
      <div style={{ padding: '16px 16px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <span style={{ fontSize: '13px', fontWeight: 400, color: 'rgba(255,255,255,0.75)' }}>Ì?ºÎ∂? Í≥†ÎØºÎ≥? Ï??Î£®Ï??</span>
          <span style={{ fontSize: '11px', color: GOLD, cursor: 'pointer' }}>Ï†?Ï≤¥ ‚?∫</span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', padding: '0 16px 4px', scrollbarWidth: 'none' }}>
        {concernList.map((c: any, i: number) => (
          <div
            key={i}
            onClick={() => setSelectedConcern(i)}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', minWidth: '58px', cursor: 'pointer' }}
          >
            <div style={{
              width: '52px', height: '52px', borderRadius: '16px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '22px', flexShrink: 0,
              background: i === selectedConcern ? 'rgba(201,169,110,0.12)' : CARD_BG,
              border: i === selectedConcern ? '1px solid rgba(201,169,110,0.3)' : CARD_BORDER,
            }}>{c.icon || '??ß'}</div>
            <span style={{
              fontSize: '9px', fontWeight: 300, textAlign: 'center', whiteSpace: 'nowrap',
              color: i === selectedConcern ? GOLD : TEXT_MUTED,
            }}>{c.name}</span>
          </div>
        ))}
      </div>

      {/* ‚??‚?? BEST Î?≠Ì?π ‚??‚?? */}
      <div style={{ padding: '16px 16px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <span style={{ fontSize: '13px', fontWeight: 400, color: 'rgba(255,255,255,0.75)' }}>
            ?è? {concernList[selectedConcern]?.name} BEST
          </span>
          <span style={{ fontSize: '11px', color: GOLD, cursor: 'pointer' }}>Îç?Î≥¥Í∏∞ ‚?∫</span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', padding: '0 16px 4px', scrollbarWidth: 'none' }}>
        {productList.slice(0, 4).map((p: any, i: number) => {
          const rankColors = ['#C9A96E', 'rgba(180,180,180,0.8)', 'rgba(180,120,60,0.8)']
          return (
            <div key={i} style={{
              minWidth: '150px', background: CARD_BG, border: CARD_BORDER,
              borderRadius: '16px', overflow: 'hidden', cursor: 'pointer', flexShrink: 0,
            }}>
              <div style={{
                height: '110px',
                background: 'linear-gradient(135deg,#1a1510,#2a2015)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '38px', position: 'relative',
              }}>
                {p.icon || '?ß¥'}
                <div style={{
                  position: 'absolute', top: '7px', left: '7px',
                  width: '22px', height: '22px', borderRadius: '50%',
                  background: rankColors[i] || 'rgba(255,255,255,0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '11px', fontWeight: 400,
                  color: i === 0 ? BG : '#fff',
                }}>{i + 1}</div>
                {i === 0 && (
                  <div style={{
                    position: 'absolute', top: '7px', right: '7px',
                    background: 'rgba(201,169,110,0.85)', color: BG,
                    fontSize: '8px', padding: '2px 5px', borderRadius: '4px',
                  }}>AIÏ∂?Ï≤?</div>
                )}
              </div>
              <div style={{ padding: '9px 11px' }}>
                <div style={{ fontSize: '8px', fontFamily: 'monospace', color: 'rgba(201,169,110,0.6)', marginBottom: '2px' }}>{p.brand}</div>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.75)', marginBottom: '5px' }}>{p.name}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '7px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 400 }}>{p.price?.toLocaleString()}Ï?ê</span>
                  <span style={{ fontSize: '14px', cursor: 'pointer' }}>?§ç</span>
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <div style={{ flex: 1, padding: '7px 0', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '9px', color: 'rgba(255,255,255,0.55)', textAlign: 'center', cursor: 'pointer' }}>??? Î?¥Í∏∞</div>
                  <div style={{ flex: 1, padding: '7px 0', background: 'rgba(180,100,200,0.1)', border: '1px solid rgba(180,100,200,0.25)', borderRadius: '8px', fontSize: '9px', color: 'rgba(200,140,220,0.9)', textAlign: 'center', cursor: 'pointer' }}>??Å Ï?†Î¨º</div>
                  <div style={{ flex: 1.3, padding: '7px 0', background: GOLD, borderRadius: '8px', fontSize: '9px', fontWeight: 400, color: BG, textAlign: 'center', cursor: 'pointer' }}>Î∞?Î°?Íµ¨Îß§</div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* ‚??‚?? Î°§ÎßÅ Î¶¨Î∑∞ ‚??‚?? */}
      <div style={{ margin: '16px 16px 0', background: CARD_BG, border: CARD_BORDER, borderRadius: '14px', padding: '12px 14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <span style={{ fontSize: '9px', fontFamily: 'monospace', letterSpacing: '1.5px', color: TEXT_DIM }}>‚≠ê Ï?§Ï??Í∞? Î¶¨Î∑∞</span>
          <span onClick={() => router.push('/reviews')} style={{ fontSize: '10px', color: GOLD, cursor: 'pointer' }}>Ï†?Ï≤¥Î≥¥Í∏∞ ‚??</span>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <span style={{ fontSize: '20px' }}>?ß¥</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '11px', marginBottom: '3px' }}>‚≠ê‚≠ê‚≠ê‚≠ê‚≠ê</div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', lineHeight: 1.7 }}>
              &quot;Ì??Ï†?Í∏∞Ï?ê Ïù¥ ÌÅ¨Î¶º Îç?Î∂?Ï?ê Ì?ºÎ∂? Ï?? Î??Í≤ºÏ?¥Ï??. ÎØºÍ∞êÌ?? Ì?ºÎ∂?Ï?êÎè? Ï?êÍ∑π Ï??Ïù¥ Ï?∏ Ï?? Ï??Ï?¥Ï?? ??ß&quot;
            </div>
            <div style={{ fontSize: '9px', color: TEXT_DIM, marginTop: '3px' }}>Í±¥Ï?±Ì?ºÎ∂? ¬∑ Ï?†ÎØ∏Î?? ¬∑ CIVASAN MESS CREAM</div>
            <div style={{ display: 'flex', alignItems: 'center', marginTop: '5px', gap: '6px' }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: '3px',
                padding: '3px 8px', background: 'rgba(255,255,255,0.04)',
                border: CARD_BORDER, borderRadius: '6px',
                fontSize: '10px', color: TEXT_MUTED, cursor: 'pointer',
              }}>??ç Îè?Ï??ÎèºÏ?? 24</div>
              <span style={{ fontSize: '9px', color: 'rgba(201,169,110,0.6)' }}>+5P Ï†ÅÎ¶Ω</span>
            </div>
          </div>
        </div>
      </div>

      {/* ‚??‚?? Ì??Ï??Ï?∏Ïùº¬∑Í≥µÍµ¨ ‚??‚?? */}
      <div style={{ padding: '16px 16px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <span style={{ fontSize: '13px', fontWeight: 400, color: 'rgba(255,255,255,0.75)' }}>‚?° Ì??Ï??Ï?∏Ïùº ¬∑ Í≥µÍµ¨</span>
          <span style={{ fontSize: '11px', color: GOLD, cursor: 'pointer' }}>Ï†?Ï≤¥ ‚?∫</span>
        </div>
        {/* Ì?≠ */}
        <div style={{ display: 'flex', border: CARD_BORDER, borderRadius: '12px', overflow: 'hidden', marginBottom: '12px' }}>
          {(['sale', 'group'] as const).map((tab) => (
            <div
              key={tab}
              onClick={() => setSaleTab(tab)}
              style={{
                flex: 1, padding: '9px 0', textAlign: 'center', fontSize: '12px',
                fontWeight: saleTab === tab ? 400 : 300,
                background: saleTab === tab
                  ? (tab === 'sale' ? 'rgba(200,60,40,0.15)' : 'rgba(60,80,200,0.15)')
                  : 'transparent',
                color: saleTab === tab
                  ? (tab === 'sale' ? '#E07060' : 'rgba(120,160,255,0.9)')
                  : TEXT_MUTED,
                cursor: 'pointer',
              }}
            >
              {tab === 'sale' ? '??• Ì??Ï??Ï?∏Ïùº' : '??• Í≥µÎè?Íµ¨Îß§'}
            </div>
          ))}
        </div>

        {/* Ì??Ï??Ï?∏Ïùº */}
        {saleTab === 'sale' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {saleList.map((item: any, i: number) => (
              <div key={i} style={{ background: CARD_BG, border: CARD_BORDER, borderRadius: '14px', overflow: 'hidden' }}>
                <div style={{ display: 'flex', gap: '12px', padding: '12px', alignItems: 'center' }}>
                  <div style={{
                    width: '64px', height: '64px', borderRadius: '12px',
                    background: 'linear-gradient(135deg,#1a1510,#2a2015)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '28px', flexShrink: 0, position: 'relative',
                  }}>
                    {item.icon || '?ß¥'}
                    <div style={{
                      position: 'absolute', top: '-4px', right: '-4px',
                      background: '#E04030', borderRadius: '20px', padding: '2px 6px',
                      fontSize: '9px', color: '#fff', border: `1.5px solid ${BG}`,
                    }}>-{item.disc}%</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '9px', fontFamily: 'monospace', color: 'rgba(201,169,110,0.6)', marginBottom: '2px' }}>
                      {item.brand || item.product?.brand}
                    </div>
                    <div style={{ fontSize: '13px', color: '#fff', marginBottom: '4px' }}>
                      {item.name || item.product?.name}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '5px' }}>
                      <span style={{ fontSize: '11px', color: TEXT_DIM, textDecoration: 'line-through' }}>
                        {(item.orig || item.original_price)?.toLocaleString()}Ï?ê
                      </span>
                      <span style={{ fontSize: '15px', fontWeight: 400, color: '#E07060' }}>
                        {(item.sale || item.sale_price)?.toLocaleString()}Ï?ê
                      </span>
                    </div>
                    {/* Í∞?Î≥? Ì??Ïù¥Î®∏ */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ fontSize: '9px', color: TEXT_DIM }}>‚è± Îß?Í∞ê</span>
                      {[timers[i]?.h, timers[i]?.m, timers[i]?.s].map((v, ti) => (
                        <span key={ti} style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                          {ti > 0 && <span style={{ color: 'rgba(220,60,40,0.4)', fontSize: '11px' }}>:</span>}
                          <span style={{
                            background: 'rgba(220,60,40,0.15)',
                            border: '1px solid rgba(220,60,40,0.28)',
                            borderRadius: '5px', padding: '2px 6px',
                            fontSize: '11px', color: '#E07060', fontFamily: 'monospace',
                          }}>{pad(v || 0)}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '6px', padding: '0 12px 10px' }}>
                  <div style={{ flex: 1, padding: '8px 0', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '11px', color: 'rgba(255,255,255,0.6)', textAlign: 'center', cursor: 'pointer' }}>??? Î?¥Í∏∞</div>
                  <div style={{ flex: 1, padding: '8px 0', background: 'rgba(180,100,200,0.1)', border: '1px solid rgba(180,100,200,0.25)', borderRadius: '8px', fontSize: '11px', color: 'rgba(200,140,220,0.9)', textAlign: 'center', cursor: 'pointer' }}>??Å Ï?†Î¨º</div>
                  <div style={{ flex: 1.3, padding: '8px 0', background: '#C04030', borderRadius: '8px', fontSize: '11px', fontWeight: 400, color: '#fff', textAlign: 'center', cursor: 'pointer' }}>Ïß?Í∏? Íµ¨Îß§</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Í≥µÎè?Íµ¨Îß§ */}
        {saleTab === 'group' && (
          <div style={{ background: CARD_BG, border: '1px solid rgba(80,120,220,0.2)', borderRadius: '14px', overflow: 'hidden' }}>
            <div style={{ background: 'linear-gradient(135deg,rgba(60,80,200,0.15),rgba(80,120,240,0.1))', padding: '10px 12px', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '10px', color: 'rgba(120,160,255,0.9)', fontFamily: 'monospace' }}>??• Í≥µÎè?Íµ¨Îß§ ¬∑ Î™©Ì?? Î?¨Ï?±Ï?? Î∞?Ï?°</span>
              <span style={{ fontSize: '10px', color: TEXT_MUTED }}>127/200Î™?</span>
            </div>
            <div style={{ height: '3px', background: 'rgba(255,255,255,0.08)' }}>
              <div style={{ height: '100%', width: '63%', background: 'linear-gradient(90deg,#4060C0,#8090E0)' }} />
            </div>
            <div style={{ display: 'flex', gap: '12px', padding: '12px', alignItems: 'center' }}>
              <div style={{ width: '60px', height: '60px', borderRadius: '12px', background: 'linear-gradient(135deg,#1a1510,#2a2015)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '26px' }}>?ß¥</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '9px', fontFamily: 'monospace', color: 'rgba(201,169,110,0.6)', marginBottom: '2px' }}>CIVASAN</div>
                <div style={{ fontSize: '13px', color: '#fff', marginBottom: '4px' }}>MESS CREAM Îç?Î∏?Ï?∏Ì?∏</div>
                <div style={{ fontSize: '10px', color: 'rgba(120,160,255,0.8)', marginBottom: '4px' }}>??Ø 200Î™? Î?¨Ï?± Ï?? Î∞?Ï?° ¬∑ 73Î™? Îç? Ì??Ï??</div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', color: TEXT_DIM, textDecoration: 'line-through' }}>116,000Ï?ê</span>
                  <span style={{ fontSize: '15px', color: 'rgba(120,160,255,0.9)' }}>69,600Ï?ê (-40%)</span>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '6px', padding: '0 12px 10px' }}>
              <div style={{ flex: 2, padding: '9px 0', background: 'linear-gradient(135deg,#4060C0,#6080E0)', borderRadius: '8px', fontSize: '11px', color: '#fff', textAlign: 'center', cursor: 'pointer' }}>??• Í≥µÍµ¨ Ï∞∏Ï?¨Ì??Í∏∞</div>
              <div style={{ flex: 1, padding: '9px 0', background: 'rgba(80,120,220,0.1)', border: '1px solid rgba(80,120,220,0.25)', borderRadius: '8px', fontSize: '11px', color: 'rgba(120,160,255,0.8)', textAlign: 'center', cursor: 'pointer' }}>??§ Ïπ?Íµ¨ Ï¥?Î??</div>
            </div>
          </div>
        )}
      </div>

      {/* ‚??‚?? Ï?¥Î°± ‚??‚?? */}
      <div style={{ padding: '16px 16px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <span style={{ fontSize: '13px', fontWeight: 400, color: 'rgba(255,255,255,0.75)' }}>??ç Î?¥ Ï£ºÎ≥? Í¥?Î¶¨Ï?µ</span>
          <span style={{ fontSize: '11px', color: GOLD, cursor: 'pointer' }}>Ïß?Îè?Î≥¥Í∏∞ ‚?∫</span>
        </div>
        <div style={{ display: 'flex', gap: '7px', overflowX: 'auto', paddingBottom: '10px', scrollbarWidth: 'none' }}>
          {['??ç Í±∞Î¶¨Ï??', '??• Ïù∏Í∏∞Ï??', '‚≠ê Î¶¨Î∑∞Ï??', '??? Ì??Ïù¥Ï??', '??ø Î∞?Î??', '‚?® ÌÅ¥Î¶¨Î??'].map((f, i) => (
            <div key={i} style={{
              padding: '5px 12px', whiteSpace: 'nowrap', cursor: 'pointer', fontSize: '10px',
              background: i === 0 ? 'rgba(201,169,110,0.15)' : CARD_BG,
              border: i === 0 ? '1px solid rgba(201,169,110,0.4)' : CARD_BORDER,
              borderRadius: '20px',
              color: i === 0 ? GOLD : TEXT_MUTED,
            }}>{f}</div>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {salonList.map((salon: any, i: number) => (
            <div key={i} style={{ background: CARD_BG, border: CARD_BORDER, borderRadius: '16px', padding: '13px 14px', display: 'flex', gap: '12px', alignItems: 'center', cursor: 'pointer' }}>
              <div style={{ width: '50px', height: '50px', borderRadius: '12px', background: 'linear-gradient(135deg,#1a1520,#2a1a30)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', flexShrink: 0 }}>???</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: 400, marginBottom: '2px' }}>{salon.name}</div>
                <div style={{ fontSize: '10px', color: TEXT_MUTED, marginBottom: '4px' }}>
                  {salon.open && (
                    <span style={{ display: 'inline-block', width: '5px', height: '5px', borderRadius: '50%', background: '#3ab870', marginRight: '4px' }} />
                  )}
                  ‚≠ê {salon.rating} ¬∑ Î¶¨Î∑∞ {salon.reviews} ¬∑ {salon.area}
                </div>
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  {(salon.tags || []).map((tag: string, ti: number) => (
                    <span key={ti} style={{ fontSize: '8px', background: 'rgba(255,255,255,0.05)', color: TEXT_MUTED, borderRadius: '5px', padding: '2px 6px' }}>{tag}</span>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '5px', flexShrink: 0 }}>
                <div style={{
                  fontSize: '9px', padding: '3px 8px', borderRadius: '10px',
                  background: salon.open ? 'rgba(74,200,120,0.15)' : 'rgba(200,80,80,0.1)',
                  color: salon.open ? '#3ab870' : '#c05050',
                }}>{salon.open ? 'Ï?ÅÏ??Ï§?' : 'Ï?ÅÏ??Ï¢?Î£?'}</div>
                <div style={{ fontSize: '9px', color: TEXT_DIM }}>{salon.dist}</div>
                <div style={{ padding: '6px 10px', background: 'rgba(201,169,110,0.15)', border: '1px solid rgba(201,169,110,0.3)', borderRadius: '8px', fontSize: '10px', color: GOLD, cursor: 'pointer' }}>Ï??Ï?ΩÌ??Í∏∞</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ‚??‚?? Ï??Ïß? Ï??Î¶º ‚??‚?? */}
      <div style={{ margin: '16px 16px 0', background: 'rgba(220,100,40,0.08)', border: '1px solid rgba(220,120,60,0.2)', borderRadius: '16px', padding: '14px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
          <span style={{ fontSize: '11px', fontWeight: 400, color: 'rgba(220,150,80,0.9)' }}>??? Ïù¥ Ï†?Ì??Î?§ Í≥ß Î?®Ï?¥Ï†∏Ï??!</span>
          <span style={{ fontSize: '10px', color: 'rgba(201,169,110,0.7)', cursor: 'pointer' }}>Ï?êÎè?Ï??Î¶º Ï?§Ï†? ‚?∫</span>
        </div>
        {/* TODO: refill_alerts Ì??Ïù¥Î∏?Ï?êÏ?? user_id Í∏∞Ï§? Ï°∞Ì?? */}
        {[{ icon: '?ß¥', name: 'CIVASAN MESS CREAM', pct: 20 }, { icon: '??ø', name: 'GERNETIC Î∞?Ïù¥Ï?§ Ï?∏Î?º', pct: 35 }].map((item, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: i === 0 ? '8px' : 0 }}>
            <span style={{ fontSize: '22px' }}>{item.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '12px', fontWeight: 400, marginBottom: '3px' }}>{item.name}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ flex: 1, height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px' }}>
                  <div style={{ height: '100%', width: `${item.pct}%`, background: i === 0 ? 'linear-gradient(90deg,#E07030,#C05020)' : 'linear-gradient(90deg,#E0A030,#C08020)', borderRadius: '2px' }} />
                </div>
                <span style={{ fontSize: '9px', color: TEXT_MUTED }}>{item.pct}% Î?®Ïù?</span>
              </div>
            </div>
            <div style={{ padding: '5px 10px', background: 'rgba(220,150,60,0.15)', border: '1px solid rgba(220,150,60,0.3)', borderRadius: '8px', fontSize: '10px', color: '#E09040', cursor: 'pointer' }}>Ï?¨Íµ¨Îß§</div>
          </div>
        ))}
      </div>

      {/* ‚??‚?? Íµ¨Îß§ Ì??Ï?§Ì?†Î¶¨ ‚??‚?? */}
      <div style={{ padding: '16px 16px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <span style={{ fontSize: '13px', fontWeight: 400, color: 'rgba(255,255,255,0.75)' }}>??? Î?¥ Íµ¨Îß§ Ì??Ï?§Ì?†Î¶¨</span>
          <span style={{ fontSize: '11px', color: GOLD, cursor: 'pointer' }}>Ï†?Ï≤¥Î≥¥Í∏∞ ‚?∫</span>
        </div>
      </div>
      {/* TODO: user_products Ì??Ïù¥Î∏?Ï?êÏ?? Ïµ?Í∑º 4Í∞? Ï°∞Ì?? */}
      <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', padding: '0 16px 4px', scrollbarWidth: 'none' }}>
        {FALLBACK_HISTORY.map((item, i) => (
          <div key={i} style={{ minWidth: '110px', background: CARD_BG, border: CARD_BORDER, borderRadius: '14px', overflow: 'hidden', flexShrink: 0 }}>
            <div style={{ height: '70px', background: 'linear-gradient(135deg,#1a1510,#2a2015)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', position: 'relative' }}>
              {item.icon}
              <span style={{ position: 'absolute', bottom: '4px', right: '6px', fontSize: '8px', fontFamily: 'monospace', color: TEXT_DIM }}>{item.date}</span>
            </div>
            <div style={{ padding: '7px 8px' }}>
              <div style={{ fontSize: '8px', fontFamily: 'monospace', color: 'rgba(201,169,110,0.6)', marginBottom: '1px' }}>{item.brand}</div>
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.7)', marginBottom: '5px' }}>{item.name}</div>
              <div style={{ width: '100%', padding: '4px 0', background: 'rgba(201,169,110,0.08)', border: '1px solid rgba(201,169,110,0.15)', borderRadius: '6px', fontSize: '9px', color: GOLD, textAlign: 'center', cursor: 'pointer' }}>??? Ï?¨Íµ¨Îß§</div>
            </div>
          </div>
        ))}
      </div>

      {/* ‚??‚?? ÏùºÏ¥? Ì?ºÎ?? ‚??‚?? */}
      <div style={{ padding: '16px 16px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <span style={{ fontSize: '13px', fontWeight: 400, color: 'rgba(255,255,255,0.75)' }}>??• ÏùºÏ¥?Î?§Ïù? Ï∂?Ï≤?</span>
          <span style={{ fontSize: '11px', color: GOLD, cursor: 'pointer' }}>Îç?Î≥¥Í∏∞ ‚?∫</span>
        </div>
        {/* TODO: friend_activities Ì??Ïù¥Î∏? Ï?∞Îè? */}
        <div style={{ background: CARD_BG, border: CARD_BORDER, borderRadius: '14px', padding: '12px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'linear-gradient(135deg,#ffd6e8,#e8d6ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>??∫</div>
            <div style={{ flex: 1, fontSize: '11px', fontWeight: 400 }}>Ï??ÎØ∏Î??</div>
            <span style={{ fontSize: '9px', color: TEXT_DIM }}>Î∞©Í∏?</span>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '8px' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'linear-gradient(135deg,#1a1510,#2a2015)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>?ß¥</div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', lineHeight: 1.5, flex: 1 }}>
              &quot;MESS CREAM 3Î≤?Ïß∏ Ï?¨Íµ¨Îß§! Í±¥Ï?± Ì?ºÎ∂?Ï?ê Ïß?Ïß? Ïµ?Í≥† ??ß&quot;
            </div>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <div style={{ flex: 1, padding: '6px 0', background: 'rgba(255,100,100,0.1)', border: '1px solid rgba(255,100,100,0.2)', borderRadius: '8px', fontSize: '10px', color: 'rgba(255,120,120,0.8)', textAlign: 'center', cursor: 'pointer' }}>‚ù§Ô∏è Í≥µÍ∞ê 12</div>
            <div style={{ flex: 1, padding: '6px 0', background: 'rgba(201,169,110,0.1)', border: '1px solid rgba(201,169,110,0.25)', borderRadius: '8px', fontSize: '10px', color: GOLD, textAlign: 'center', cursor: 'pointer' }}>Î??Îè? Íµ¨Îß§</div>
            <div style={{ flex: 1, padding: '6px 0', background: CARD_BG, border: CARD_BORDER, borderRadius: '8px', fontSize: '10px', color: TEXT_MUTED, textAlign: 'center', cursor: 'pointer' }}>Í≥µÏ?†</div>
          </div>
        </div>
      </div>

      {/* ‚??‚?? Ï?†Ï†?Ì?? ‚??‚?? */}
      <div style={{ padding: '16px 16px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <span style={{ fontSize: '13px', fontWeight: 400, color: 'rgba(255,255,255,0.75)' }}>??? Ï??Î°? Î??Ï??Ï?¥Ï??</span>
          <span style={{ fontSize: '11px', color: GOLD, cursor: 'pointer' }}>Ï†?Ï≤¥ ‚?∫</span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', padding: '0 16px 4px', scrollbarWidth: 'none' }}>
        {newList.map((item: any, i: number) => (
          <div key={i} onClick={() => router.push(`/products/${item.id}`)} style={{ minWidth: '130px', background: CARD_BG, border: CARD_BORDER, borderRadius: '14px', overflow: 'hidden', cursor: 'pointer', flexShrink: 0 }}>
            <div style={{ height: '90px', background: 'linear-gradient(135deg,#1a0a2a,#2a1540)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', position: 'relative' }}>
              {item.icon || '???'}
              <div style={{ position: 'absolute', top: '6px', left: '6px', background: 'linear-gradient(90deg,#6040E0,#A040E0)', borderRadius: '5px', padding: '2px 6px', fontSize: '8px', color: '#fff' }}>NEW</div>
            </div>
            <div style={{ padding: '9px 10px' }}>
              <div style={{ fontSize: '8px', fontFamily: 'monospace', color: 'rgba(201,169,110,0.6)', marginBottom: '2px' }}>{item.brand}</div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.75)', lineHeight: 1.4, marginBottom: '4px' }}>{item.name}</div>
              <div style={{ fontSize: '12px', fontWeight: 400 }}>{item.price?.toLocaleString()}Ï?ê</div>
            </div>
          </div>
        ))}
      </div>

      {/* ‚??‚?? Î∏?Î??Î?? Ï?êÌ?? Í∑∏Î¶¨Î?? ‚??‚?? */}
      <div style={{ padding: '16px 16px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <span style={{ fontSize: '13px', fontWeight: 400, color: 'rgba(255,255,255,0.75)' }}>?è∑ Î∏?Î??Î??Î≥? Î≥¥Í∏∞</span>
          <span style={{ fontSize: '11px', color: GOLD, cursor: 'pointer' }}>Ï†?Ï≤¥ Î∏?Î??Î?? ‚?∫</span>
        </div>
        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '12px', scrollbarWidth: 'none' }}>
          {['Ï†?Ï≤¥', '??™??∫ Ï?†Î?Ω', '??∞??∑ Íµ≠Î?¥', '??Ø??µ ÏùºÎ≥∏', 'ÌÅ¥Î¶¨Î??', 'Î∞?Î??'].map((tab, i) => (
            <div key={i} style={{
              padding: '4px 12px', whiteSpace: 'nowrap', cursor: 'pointer', fontSize: '10px',
              background: i === 0 ? GOLD : CARD_BG,
              border: i === 0 ? 'none' : CARD_BORDER,
              borderRadius: '20px',
              color: i === 0 ? BG : TEXT_MUTED,
              fontWeight: i === 0 ? 400 : 300,
            }}>{tab}</div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px' }}>
          {brandList.map((brand: any, i: number) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
              <div style={{
                width: '58px', height: '58px', borderRadius: '50%',
                background: brand.bg || 'rgba(201,169,110,0.1)',
                border: `1.5px solid ${brand.border || 'rgba(201,169,110,0.3)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '10px', fontWeight: 400,
                color: brand.color || GOLD,
                fontFamily: 'monospace', textAlign: 'center', lineHeight: 1.3,
              }}>
                {brand.name?.slice(0, 4)}<br />{brand.name?.slice(4, 8)}
              </div>
              <span style={{ fontSize: '9px', color: TEXT_MUTED, textAlign: 'center' }}>
                {brand.label || brand.name}
              </span>
            </div>
          ))}
          {/* Îç?Î≥¥Í∏∞ */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
            <div style={{
              width: '58px', height: '58px', borderRadius: '50%',
              background: 'rgba(255,255,255,0.04)',
              border: '1.5px dashed rgba(255,255,255,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexDirection: 'column', gap: '2px',
            }}>
              <span style={{ fontSize: '16px', color: 'rgba(255,255,255,0.4)' }}>+</span>
              <span style={{ fontSize: '8px', color: TEXT_DIM }}>23Í∞?</span>
            </div>
            <span style={{ fontSize: '9px', color: TEXT_DIM }}>Ï†?Ï≤¥Î≥¥Í∏∞</span>
          </div>
        </div>
      </div>

      {/* ?? ?? ?? */}
      <div style={{ margin: '20px 16px 0', padding: '20px 0', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ textAlign: 'center', marginBottom: '16px' }}>
          <span style={{ fontFamily: 'Georgia, serif', fontSize: '16px', fontWeight: 400, color: '#C9A96E', letterSpacing: '4px' }}>AURAN</span>
          <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.25)', fontFamily: 'monospace', marginLeft: '8px' }}>∑ DUCHESS.KR</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginBottom: '14px', flexWrap: 'wrap' }}>
          {['????', 'FAQ', '1:1??', '????????', '????'].map((item, i) => (
            <span key={i} style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)', cursor: 'pointer' }}>{item}</span>
          ))}
        </div>
        <div style={{ textAlign: 'center', fontSize: '10px', color: 'rgba(255,255,255,0.2)', lineHeight: 2 }}>
          <div>?? : ??? ∑ ??????? : 197-87-01357</div>
          <div>????? ∑ support@auran.kr</div>
          <div style={{ marginTop: '4px', fontSize: '9px', color: 'rgba(255,255,255,0.15)' }}>© 2026 AURAN. All rights reserved.</div>
        </div>
      </div>
      {/* ?? ?? ????? ?? */}
      <nav style={{
        position: 'fixed', bottom: 0,
        left: '50%', transform: 'translateX(-50%)',
        width: '390px', height: '80px',
        background: 'rgba(13,11,9,0.96)',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-around',
        padding: '0 10px 16px', zIndex: 50,
      }}>
        <div onClick={() => router.push('/home')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', minWidth: '50px', cursor: 'pointer' }}>
          <span style={{ fontSize: '20px' }}>?è†</span>
          <span style={{ fontSize: '9px', fontFamily: 'monospace', color: GOLD }}>HOME</span>
        </div>
        <div onClick={() => router.push('/products')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', minWidth: '50px', cursor: 'pointer' }}>
          <span style={{ fontSize: '20px' }}>??çÔ∏è</span>
          <span style={{ fontSize: '9px', fontFamily: 'monospace', color: TEXT_DIM }}>SHOP</span>
        </div>
        <div
          onClick={() => router.push('/skin-analysis')}
          style={{
            width: '56px', height: '56px', borderRadius: '50%',
            background: 'linear-gradient(135deg,#C9A96E,#E8C88A)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: '2px', boxShadow: '0 4px 20px rgba(201,169,110,0.4)',
            marginTop: '-20px', cursor: 'pointer',
          }}
        >
          <span style={{ fontSize: '20px' }}>??¨</span>
          <span style={{ fontSize: '8px', fontWeight: 400, color: BG, fontFamily: 'monospace' }}>AIÎ∂?Ï?ù</span>
        </div>
        <div onClick={() => router.push('/salon')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', minWidth: '50px', cursor: 'pointer' }}>
          <span style={{ fontSize: '20px' }}>???</span>
          <span style={{ fontSize: '9px', fontFamily: 'monospace', color: TEXT_DIM }}>Ï??Ï?Ω</span>
        </div>
        <div onClick={() => router.push('/my')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', minWidth: '50px', cursor: 'pointer' }}>
          <span style={{ fontSize: '20px' }}>??§</span>
          <span style={{ fontSize: '9px', fontFamily: 'monospace', color: TEXT_DIM }}>MY</span>
        </div>
      </nav>

    </div>
  )
}
