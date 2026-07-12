'use client'

import {
  buildOrderLineItem,
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
  qty: number
  activePromoId: string | undefined
  onApplyPromo: (prod: BrandOrderProduct, promo: SupplyPromoRow) => void
  onAdd: (prod: BrandOrderProduct) => void
  onChangeQty: (id: string, delta: number) => void
}

export default function BrandOrderProductCard({
  prod,
  supplyPromos,
  qty,
  activePromoId,
  onApplyPromo,
  onAdd,
  onChangeQty,
}: Props) {
  const priced = hasValidSupplyPrice(prod.supply_price)
  const brandPromos = promosForBrand(supplyPromos, prod.brand_id)
  const selectedPromo = activePromoId ? brandPromos.find((p) => p.id === activePromoId) ?? null : null
  const line = qty > 0 ? buildOrderLineItem(prod, qty, supplyPromos, selectedPromo) : null

  return (
    <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 10, overflow: 'hidden', opacity: priced ? 1 : 0.55 }}>
      <div style={{ height: 80, background: LIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        {prod.thumb_img
          ? <img src={prod.thumb_img} alt={prod.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <span style={{ fontSize: 26 }}>🧴</span>}
      </div>
      <div style={{ padding: '8px' }}>
        <div style={{ fontSize: 11, color: TEXT, lineHeight: 1.4, marginBottom: 4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }}>{prod.name}</div>
        {priced
          ? <div style={{ fontSize: 10, color: SUB, marginBottom: 4 }}>₩{prod.supply_price.toLocaleString()}</div>
          : <div style={{ fontSize: 10, color: '#C0392B', marginBottom: 4 }}>가격 미설정</div>}
        {priced && brandPromos.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
            {brandPromos.map((promo) => (
              <button
                key={promo.id}
                type="button"
                onClick={() => onApplyPromo(prod, promo)}
                style={{
                  fontSize: 10,
                  padding: '3px 8px',
                  borderRadius: 6,
                  border: `1px solid ${activePromoId === promo.id ? PURPLE : BORDER}`,
                  background: activePromoId === promo.id ? `${PURPLE}18` : LIGHT,
                  color: activePromoId === promo.id ? PURPLE : SUB,
                  cursor: 'pointer',
                }}
              >
                {promoLabel(promo)}
              </button>
            ))}
          </div>
        )}
        {line?.promo && (
          <div style={{ fontSize: 10, color: PURPLE, marginBottom: 4 }}>
            {line.promo}{line.bonus > 0 ? ` (+${line.bonus})` : ''}
          </div>
        )}
        {!priced ? (
          <button type="button" disabled
            style={{ width: '100%', padding: '5px', borderRadius: 6, border: `1px solid ${BORDER}`, background: LIGHT, color: SUB, fontSize: 11, cursor: 'not-allowed' }}>
            발주 불가
          </button>
        ) : qty === 0 ? (
          <button type="button" onClick={() => onAdd(prod)}
            style={{ width: '100%', padding: '5px', borderRadius: 6, border: `1px solid ${PURPLE}`, background: `${PURPLE}15`, color: PURPLE, fontSize: 11, cursor: 'pointer' }}>
            + 담기
          </button>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <button type="button" onClick={() => onChangeQty(prod.id, -1)}
              style={{ width: 26, height: 26, borderRadius: 6, border: `1px solid ${BORDER}`, background: LIGHT, fontSize: 14, cursor: 'pointer', color: TEXT }}>−</button>
            <span style={{ fontSize: 13, fontWeight: 500, color: TEXT }}>{qty}</span>
            <button type="button" onClick={() => onChangeQty(prod.id, 1)}
              style={{ width: 26, height: 26, borderRadius: 6, border: 'none', background: PURPLE, color: '#fff', fontSize: 14, cursor: 'pointer' }}>+</button>
          </div>
        )}
      </div>
    </div>
  )
}
