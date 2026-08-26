import { tryCreateAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import ProductDetailActions from './ProductDetailActions'
import ReviewSection from './ReviewSection'
import { notFound } from 'next/navigation'
const BG = '#0D0B09'
const CARD = 'rgba(255,255,255,0.05)'
const BORDER = 'rgba(255,255,255,0.08)'
const GOLD = '#C9A96E'
const PURPLE = '#7B5EA7'
const PURPLE_LIGHT = 'rgba(123,94,167,0.15)'
const TEXT_SUB = 'rgba(255,255,255,0.55)'
export default async function ProductDetailPage({
  params,
  searchParams,
}: {
  params: { id: string; productId: string }
  searchParams?: { scene_post_id?: string }
}) {
  const scenePostId =
    typeof searchParams?.scene_post_id === 'string' && searchParams.scene_post_id.trim()
      ? searchParams.scene_post_id.trim()
      : null
  const service = tryCreateAdminClient()
  if (!service) return notFound()
  const { data: product } = await service
    .from('brand_products')
    .select('id, brand_id, name, consumer_price, member_price, thumb_img, images, description, detail_content, customer_toast_rate, status, review_count, rating_sum')
    .eq('id', params.productId)
    .eq('status', 'active')
    .maybeSingle()
  if (!product) return notFound()
  const { data: salon } = await service
    .from('salons')
    .select('id, owner_id, name')
    .eq('id', params.id)
    .maybeSingle()
  if (!salon) return notFound()
  type ActiveCampaign = {
    title: string
    badge_text: string | null
    campaign_type: 'bundle' | 'gift' | 'discount'
    buy_qty: number | null
    bonus_qty: number | null
    gift_product_id: string | null
    gift_product_name: string | null
    gift_product_thumb: string | null
    discount_pct: number | null
    apply_to_members: boolean
  }
  let activeCampaign: ActiveCampaign | null = null
  if (salon.owner_id) {
    const { data: ownerUserRow } = await service.from('users').select('auth_id').eq('id', salon.owner_id).maybeSingle()
    if (ownerUserRow?.auth_id) {
      const { data: ownerProfileRow } = await service.from('profiles').select('id').eq('auth_id', ownerUserRow.auth_id).maybeSingle()
      if (ownerProfileRow?.id) {
        const nowIso = new Date().toISOString()
        const { data: campaignRows } = await service
          .from('hq_forced_campaigns')
          .select('title, badge_text, campaign_type, target_product_ids, buy_qty, bonus_qty, gift_product_id, discount_pct, apply_to_members')
          .eq('owner_id', ownerProfileRow.id)
          .eq('is_active', true)
          .lte('start_at', nowIso)
          .gte('end_at', nowIso)
        const match = (campaignRows || []).find(
          (c: any) => Array.isArray(c.target_product_ids) && c.target_product_ids.includes(product.id),
        )
        if (match) {
          let giftName: string | null = null
          let giftThumb: string | null = null
          if (match.gift_product_id) {
            const { data: giftRow } = await service
              .from('brand_products')
              .select('name, thumb_img')
              .eq('id', match.gift_product_id)
              .maybeSingle()
            if (giftRow) {
              giftName = giftRow.name ? String(giftRow.name) : null
              giftThumb = giftRow.thumb_img ? String(giftRow.thumb_img) : null
            }
          }
          activeCampaign = {
            title: String(match.title),
            badge_text: match.badge_text ? String(match.badge_text) : null,
            campaign_type: match.campaign_type,
            buy_qty: match.buy_qty != null ? Math.trunc(Number(match.buy_qty)) : null,
            bonus_qty: match.bonus_qty != null ? Math.trunc(Number(match.bonus_qty)) : null,
            gift_product_id: match.gift_product_id ? String(match.gift_product_id) : null,
            gift_product_name: giftName,
            gift_product_thumb: giftThumb,
            discount_pct: match.discount_pct != null ? Number(match.discount_pct) : null,
            apply_to_members: Boolean(match.apply_to_members),
          }
        }
      }
    }
  }
  const { data: reviews } = await service
    .from('brand_product_reviews')
    .select('id, rating, content, images, video_url, created_at, author_id, users:author_id(name)')
    .eq('brand_product_id', product.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(20)
  const avgRating = product.review_count > 0
    ? product.rating_sum / product.review_count
    : 0
  const galleryImages = (product.images && product.images.length > 0)
    ? product.images
    : (product.thumb_img ? [product.thumb_img] : [])
  // 리뷰 작성 자격 확인 (로그인 + 이 제품 구매 + 아직 리뷰 안 씀)
  let eligibleOrderId: string | null = null
  let isMember = false
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    const { data: me } = await service.from('users').select('id').eq('auth_id', user.id).maybeSingle()
    if (me) {
      const { data: myOrders } = await service
        .from('brand_product_orders')
        .select('id, status')
        .eq('customer_id', me.id)
        .eq('salon_id', salon.id)
        .in('status', ['결제완료', '배송완료'])
      const orderIds = (myOrders || []).map(o => o.id)
      isMember = orderIds.length > 0
      if (orderIds.length > 0) {
        const { data: myItems } = await service
          .from('brand_product_order_items')
          .select('order_id')
          .eq('brand_product_id', product.id)
          .in('order_id', orderIds)
        const candidateOrderIds = (myItems || []).map(i => i.order_id)
        if (candidateOrderIds.length > 0) {
          const { data: existingReviews } = await service
            .from('brand_product_reviews')
            .select('order_id')
            .in('order_id', candidateOrderIds)
          const reviewedSet = new Set((existingReviews || []).map(r => r.order_id))
          eligibleOrderId = candidateOrderIds.find(id => !reviewedSet.has(id)) || null
        }
      }
    }
  }
  const basePrice = isMember && product.member_price ? product.member_price : product.consumer_price
  const effectiveCampaign =
    activeCampaign && (!isMember || activeCampaign.apply_to_members) ? activeCampaign : null
  const displayPrice =
    effectiveCampaign?.campaign_type === 'discount' && effectiveCampaign.discount_pct
      ? Math.round(basePrice * (1 - effectiveCampaign.discount_pct / 100))
      : basePrice
  return (
    <div style={{ color: '#fff', background: BG, minHeight: '100vh', maxWidth: 480, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: `1px solid ${BORDER}` }}>
        <a href={`/salons/${params.id}/products`} style={{ color: '#fff', textDecoration: 'none', fontSize: 18 }}>←</a>
        <span style={{ fontSize: 14, color: '#fff' }}>{salon.name}</span>
      </div>
      <div style={{ width: '100%', aspectRatio: '1', background: PURPLE_LIGHT, overflow: 'hidden' }}>
        {galleryImages[0] && (
          <img src={galleryImages[0]} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        )}
      </div>
      {galleryImages.length > 1 && (
        <div style={{ display: 'flex', gap: 8, padding: '10px 16px', overflowX: 'auto' }}>
          {galleryImages.map((img: string, i: number) => (
            <img key={i} src={img} alt="" style={{ width: 56, height: 56, borderRadius: 8, objectFit: 'cover', border: `1px solid ${BORDER}` }} />
          ))}
        </div>
      )}
      <div style={{ padding: '16px' }}>
        <div style={{ fontSize: 16, color: '#fff', marginBottom: 6 }}>{product.name}</div>
        <div style={{ fontSize: 20, color: '#fff', fontWeight: 500, marginBottom: 8 }}>{displayPrice.toLocaleString()}원</div>
        {effectiveCampaign && (
          <div style={{ display: 'inline-block', background: 'rgba(229,57,53,0.15)', color: '#ff8a80', fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 8, marginBottom: 8 }}>
            🎉 {effectiveCampaign.badge_text || effectiveCampaign.title}
          </div>
        )}
        <br />
        <div style={{ display: 'inline-block', background: PURPLE_LIGHT, color: '#C9BEDD', fontSize: 12, padding: '4px 10px', borderRadius: 8 }}>
          구매 시 {product.customer_toast_rate}% 토스트 적립
        </div>
        {product.review_count > 0 && (
          <div style={{ fontSize: 12, color: TEXT_SUB, marginTop: 8 }}>
            ★ {avgRating.toFixed(1)} · 리뷰 {product.review_count}개
          </div>
        )}
      </div>
      <div style={{ padding: '0 16px 16px' }}>
        <ProductDetailActions
          product={{
            brand_product_id: product.id,
            brand_id: product.brand_id,
            salon_id: salon.id,
            salon_name: salon.name,
            name: product.name,
            price: displayPrice,
            thumb_img: product.thumb_img,
            customer_toast_rate: product.customer_toast_rate,
            scene_post_id: scenePostId,
          }}
          campaign={effectiveCampaign}
        />
      </div>
      {(product.description || product.detail_content) && (
        <div style={{ padding: '16px', borderTop: `8px solid ${CARD}` }}>
          {product.description && (
            <p style={{ fontSize: 13, color: TEXT_SUB, lineHeight: 1.6, marginBottom: 12 }}>{product.description}</p>
          )}
          {product.detail_content && (
            <div style={{ fontSize: 13, color: TEXT_SUB, lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: product.detail_content }} />
          )}
        </div>
      )}
      <section style={{ padding: '16px', borderTop: `8px solid ${CARD}` }}>
        <div style={{ fontSize: 14, color: '#fff', marginBottom: 12 }}>
          리뷰 {product.review_count || 0} · 평균 {avgRating.toFixed(1)}점
        </div>
        <ReviewSection eligibleOrderId={eligibleOrderId} brandProductId={product.id} />
        {(!reviews || reviews.length === 0) && (
          <div style={{ fontSize: 13, color: TEXT_SUB }}>아직 리뷰가 없어요</div>
        )}
        {reviews?.map(r => (
          <div key={r.id} style={{ padding: '12px 0', borderBottom: `1px solid ${BORDER}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ color: GOLD, fontSize: 12 }}>{'★'.repeat(r.rating)}</span>
              <span style={{ color: TEXT_SUB, fontSize: 12 }}>{(r as any).users?.name || '고객'}</span>
            </div>
            <p style={{ fontSize: 13, color: '#fff', margin: '0 0 8px' }}>{r.content}</p>
            {r.images && r.images.length > 0 && (
              <div style={{ display: 'flex', gap: 6, marginBottom: r.video_url ? 6 : 0 }}>
                {r.images.map((img: string, i: number) => (
                  <img key={i} src={img} alt="" style={{ width: 64, height: 64, borderRadius: 8, objectFit: 'cover' }} />
                ))}
              </div>
            )}
            {r.video_url && (
              <video src={r.video_url} controls style={{ width: '100%', maxWidth: 240, borderRadius: 8 }} />
            )}
          </div>
        ))}
      </section>
    </div>
  )
}
