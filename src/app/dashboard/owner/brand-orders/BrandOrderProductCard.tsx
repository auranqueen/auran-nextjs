'use client'
import {
  hasValidSupplyPrice,
  promoLabel,
  promosForBrand,
  type SupplyPromoRow,
} from '@/lib/brand/brandOrderPromos'
const PURPLE = '#7B5EA7'
const BORDER = '#ede9f7'
const TEXT = '#1A1A2E'
const SUB = '#888888'
const LIGHT = '#f8f7fc'
export type BrandOrderProduct = {
  id: string
  name: string
  thumb_img: string | null
  brand_name: string
  brand_id: string
  supply_price: number
}
type Props = {
  prod: BrandOrderProduct
  supplyPromos: SupplyPromoRow[]
  setsByPromoId: Record<string, number>
  onChangeSet: (productId: string, promoId: string, delta: number) => void
  stock?: number
}
export default function BrandOrderProductCard({
  prod,
  supplyPromos,
  setsByPromoId,
  onChangeSet,
  stock,
}: Props) {
  const priced = hasValidSupplyPrice(prod.supply_price)
  const outOfStock = stock !== undefined && stock <= 0
  const brandPromos = promosForBrand(supplyPromos, prod.brand_id)
  const inCart = brandPromos.some((p) => (setsByPromoId[p.id] || 0) > 0)
  const interactive = priced && !outOfStock
  return (
    <div style={{
      background: inCart ? `${PURPLE}08` : '#fff',
      border: `1px solid ${inCart ? PURPLE : BORDER}`,
      borderRadius: 10,
      overflow: 'hidden',
      opacity: interactive ? 1 : 0.5,
    }}>
      <div style={{ aspectRatio: '1 / 1', width: '100%', background: LIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        {prod.thumb_img
          ? <img src={prod.thumb_img} alt={prod.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <span style={{ fontSize: 26 }}>🧴</span>}
      </div>
      <div style={{ padding: '8px' }}>
        <div style={{ fontSize: 11, color: TEXT, lineHeight: 1.4, marginBottom: 4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }}>{prod.name}</div>
        {priced
          ? <div style={{ fontSize: 10, color: SUB, marginBottom: 4 }}>₩{prod.supply_price.toLocaleString()}</div>
          : <div style={{ fontSize: 10, color: '#C0392B', marginBottom: 4 }}>가격 미설정</div>}
        {outOfStock ? (
          <div style={{ fontSize: 10, color: '#c9822a', marginBottom: 4 }}>품절, 조금만 기다려주세요 🙏</div>
        ) : stock !== undefined ? (
          <div style={{ fontSize: 10, color: SUB, marginBottom: 4 }}>재고 {stock}개</div>
        ) : null}
        {!priced || outOfStock ? (
          <button type="button" disabled
            style={{ width: '100%', padding: '5px', borderRadius: 6, border: `1px solid ${BORDER}`, background: LIGHT, color: SUB, fontSize: 11, cursor: 'not-allowed' }}>
            {outOfStock ? '품절' : '발주 불가'}
          </button>
        ) : brandPromos.length === 0 ? (
          <div style={{ fontSize: 10, color: SUB }}>옵션 없음</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {brandPromos.map((promo) => {
              const sets = setsByPromoId[promo.id] || 0
              return (
                <div key={promo.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                  <span style={{ fontSize: 10, color: sets > 0 ? PURPLE : SUB, minWidth: 0 }}>{promoLabel(promo)}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                    <button
                      type="button"
                      onClick={() => onChangeSet(prod.id, promo.id, -1)}
                      disabled={sets <= 0}
                      style={{ width: 22, height: 22, borderRadius: 5, border: `1px solid ${BORDER}`, background: LIGHT, fontSize: 13, cursor: sets <= 0 ? 'default' : 'pointer', color: TEXT, lineHeight: 1 }}
                    >−</button>
                    <span style={{ fontSize: 12, fontWeight: 500, color: TEXT, minWidth: 14, textAlign: 'center' }}>{sets}</span>
                    <button
                      type="button"
                      onClick={() => onChangeSet(prod.id, promo.id, 1)}
                      style={{ width: 22, height: 22, borderRadius: 5, border: 'none', background: PURPLE, color: '#fff', fontSize: 13, cursor: 'pointer', lineHeight: 1 }}
                    >+</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
