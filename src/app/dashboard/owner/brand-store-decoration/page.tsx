'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import StoryManageSection from './StoryManageSection'
const BORDER = 'rgba(255,255,255,0.08)'
const PURPLE = '#7B5EA7'
const GOLD = '#C9A96E'
const TEXT_SUB = 'rgba(255,255,255,0.55)'
interface ProductRow {
  id: string
  name: string
  thumb_img: string | null
  featured: boolean
}
export default function BrandStoreDecorationPage() {
  const supabaseRef = useRef(createClient())
  const [salonId, setSalonId] = useState<string | null>(null)
  const [products, setProducts] = useState<ProductRow[]>([])
  const [bannerMobile, setBannerMobile] = useState<string | null>(null)
  const [bannerPc, setBannerPc] = useState<string | null>(null)
  const [subscriberCount, setSubscriberCount] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [notifying, setNotifying] = useState(false)
  const [notifyMsg, setNotifyMsg] = useState<string | null>(null)
  const load = useCallback(async () => {
    const supabase = supabaseRef.current
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: me } = await supabase.from('users').select('id').eq('auth_id', user.id).maybeSingle()
    if (!me) return
    const { data: salon } = await supabase.from('salons').select('id').eq('owner_id', me.id).maybeSingle()
    if (!salon) return
    setSalonId(salon.id)
    const { data: banner } = await supabase
      .from('brand_product_salon_banner')
      .select('image_url_mobile, image_url_pc')
      .eq('salon_id', salon.id)
      .maybeSingle()
    if (banner) {
      setBannerMobile(banner.image_url_mobile)
      setBannerPc(banner.image_url_pc)
    }
    const { count } = await supabase
      .from('brand_product_salon_subscribers')
      .select('id', { count: 'exact', head: true })
      .eq('salon_id', salon.id)
    setSubscriberCount(count || 0)
    const { data: links } = await supabase
      .from('brand_owner_links')
      .select('brand_id')
      .eq('owner_id', me.id)
      .eq('status', 'active')
    const brandIds = (links || []).map(l => l.brand_id)
    const { data: allProducts } = brandIds.length > 0
      ? await supabase.from('brand_products').select('id, name, thumb_img').in('brand_id', brandIds).eq('status', 'active').limit(30)
      : { data: [] }
    const { data: featuredRows } = await supabase
      .from('brand_product_salon_display')
      .select('brand_product_id')
      .eq('salon_id', salon.id)
      .eq('is_featured', true)
    const featuredIds = new Set((featuredRows || []).map(r => r.brand_product_id))
    setProducts((allProducts || []).map(p => ({ ...p, featured: featuredIds.has(p.id) })))
  }, [])
  useEffect(() => { load() }, [load])
  const handleBannerUpload = async (file: File, target: 'mobile' | 'pc') => {
    if (!salonId) return
    setUploading(true)
    const supabase = supabaseRef.current
    const path = `salon-banners/${salonId}/${target}-${Date.now()}-${file.name}`
    const { error: upErr } = await supabase.storage.from('product-images').upload(path, file)
    if (upErr) { setUploading(false); alert('업로드에 실패했어요'); return }
    const { data } = supabase.storage.from('product-images').getPublicUrl(path)
    const res = await fetch('/api/brand-product-orders/banner', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_url_mobile: target === 'mobile' ? data.publicUrl : bannerMobile,
        image_url_pc: target === 'pc' ? data.publicUrl : bannerPc,
      }),
    }).then(r => r.json())
    setUploading(false)
    if (res.ok) { setBannerMobile(res.image_url_mobile || data.publicUrl); setBannerPc(res.image_url_pc || data.publicUrl); load() }
  }
  const toggleFeatured = async (productId: string, current: boolean) => {
    const res = await fetch('/api/brand-product-orders/curation-toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brand_product_id: productId, featured: !current }),
    }).then(r => r.json())
    if (!res.ok) {
      alert(res.error === 'curation_limit_reached' ? '추천 제품은 최대 8개까지 가능해요' : '처리에 실패했어요')
      return
    }
    setProducts(prev => prev.map(p => p.id === productId ? { ...p, featured: !current } : p))
  }
  const handleNotify = async () => {
    setNotifying(true)
    setNotifyMsg(null)
    const res = await fetch('/api/brand-product-orders/notify-customers', { method: 'POST' }).then(r => r.json())
    setNotifying(false)
    if (res.ok) setNotifyMsg(`${res.notified}명에게 알림을 보냈어요`)
    else setNotifyMsg(res.error === 'cooldown_active' ? '하루에 한 번만 보낼 수 있어요' : '발송에 실패했어요')
  }
  const featuredCount = products.filter(p => p.featured).length
  return (
    <div style={{ background: '#0a0c0f', minHeight: '100vh', padding: 20, color: '#fff' }}>
      <div style={{ fontSize: 16, marginBottom: 16 }}>브랜드 스토어 꾸미기</div>
      <div style={{ background: 'rgba(255,255,255,0.04)', border: `0.5px solid ${BORDER}`, borderRadius: 12, padding: 16, marginBottom: 12 }}>
        <div style={{ fontSize: 13, marginBottom: 10 }}>배너 이미지</div>
        <div style={{ width: '100%', aspectRatio: '2.7', borderRadius: 10, background: bannerPc ? `url(${bannerPc}) center/cover` : 'rgba(123,94,167,0.15)', marginBottom: 10, position: 'relative' }}>
          <label style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && handleBannerUpload(e.target.files[0], 'pc')} />
            {!bannerPc && <span style={{ fontSize: 12, color: TEXT_SUB }}>PC용 배너 업로드</span>}
          </label>
        </div>
        <label style={{ fontSize: 12, color: PURPLE, cursor: 'pointer' }}>
          <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && handleBannerUpload(e.target.files[0], 'mobile')} />
          모바일용 배너 {bannerMobile ? '변경' : '업로드'}
        </label>
        <div style={{ fontSize: 11, color: TEXT_SUB, lineHeight: 1.6, marginTop: 10 }}>
          PC용 1100×410px · 모바일용 480×180px 권장<br />하나만 올리면 나머지도 자동 적용돼요
        </div>
      </div>
      <div style={{ background: 'rgba(255,255,255,0.04)', border: `0.5px solid ${BORDER}`, borderRadius: 12, padding: 16, marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontSize: 13 }}>추천 제품</span>
          <span style={{ fontSize: 11, color: TEXT_SUB }}>{featuredCount}/8</span>
        </div>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>
          {products.map(p => (
            <div key={p.id} onClick={() => toggleFeatured(p.id, p.featured)} style={{ flexShrink: 0, width: 64, position: 'relative', cursor: 'pointer' }}>
              <div style={{ width: 64, height: 64, borderRadius: 8, background: 'rgba(123,94,167,0.15)', border: p.featured ? `1.5px solid ${PURPLE}` : `0.5px solid ${BORDER}`, backgroundImage: p.thumb_img ? `url(${p.thumb_img})` : undefined, backgroundSize: 'cover' }} />
            </div>
          ))}
        </div>
        <div style={{ fontSize: 11, color: TEXT_SUB, marginTop: 8 }}>제품을 눌러서 추천에 추가/제거해요</div>
      </div>
      {salonId ? <StoryManageSection salonId={salonId} /> : null}
      <div style={{ background: 'rgba(255,255,255,0.04)', border: `0.5px solid ${BORDER}`, borderRadius: 12, padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <span style={{ fontSize: 13 }}>스토어알림받기 고객</span>
          <span style={{ fontSize: 16, color: GOLD }}>{subscriberCount}명</span>
        </div>
        <button
          onClick={handleNotify}
          disabled={notifying}
          style={{ width: '100%', border: 'none', background: PURPLE, color: '#fff', borderRadius: 10, padding: 12, fontSize: 13, marginTop: 8 }}
        >
          {notifying ? '보내는 중...' : '알림받기 고객에게 알리기'}
        </button>
        {notifyMsg && <div style={{ fontSize: 11, color: TEXT_SUB, marginTop: 8 }}>{notifyMsg}</div>}
      </div>
    </div>
  )
}
