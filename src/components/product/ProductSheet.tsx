'use client'

import { useEffect, useState } from 'react'
import SlideUpSheet from '@/components/ui/SlideUpSheet'
import ProductDetailClient from '@/app/(customer)/products/[id]/client'
import { createClient } from '@/lib/supabase/client'

const PRODUCT_SELECT = '*, brands(name, logo_url, origin_country, origin, default_earn_points, access_tier, share_rate), categories(target_tracks)'
const UNLOCK_GRADES = ['LUMIÈRE', 'ESSENCE', 'LÉGENDE', 'CÉLESTE']

type Loaded =
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'ready'; product: any; exclusiveLocked: boolean }

function ProductSheetBody({ productId }: { productId: string }) {
  const [state, setState] = useState<Loaded>({ status: 'loading' })

  useEffect(() => {
    let alive = true
    setState({ status: 'loading' })
    void (async () => {
      const supabase = createClient()
      const { data: product } = await supabase
        .from('products')
        .select(PRODUCT_SELECT)
        .eq('id', productId)
        .maybeSingle()
      if (!product) {
        if (alive) setState({ status: 'missing' })
        return
      }
      let exclusiveLocked = false
      const accessTier = String((product as { brands?: { access_tier?: string | null } | null }).brands?.access_tier ?? 'public')
      if (accessTier === 'consult_required') {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          exclusiveLocked = true
        } else {
          const { data: ur } = await supabase
            .from('users')
            .select('customer_grade, renobel_unlocked')
            .eq('auth_id', user.id)
            .maybeSingle()
          const grade = String((ur as { customer_grade?: string | null } | null)?.customer_grade ?? '')
          const renobelOk = (ur as { renobel_unlocked?: boolean | null } | null)?.renobel_unlocked === true
          exclusiveLocked = !(renobelOk || UNLOCK_GRADES.includes(grade))
        }
      }
      if (alive) setState({ status: 'ready', product, exclusiveLocked })
    })()
    return () => {
      alive = false
    }
  }, [productId])

  if (state.status !== 'ready') {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: 13 }}>
        {state.status === 'loading' ? '불러오는 중...' : '상품을 찾을 수 없어요'}
      </div>
    )
  }

  return (
    <div className="product-sheet-host" style={{ height: '100%' }}>
      <style>{'.product-sheet-host > div { min-height: 100% !important; max-height: 100% !important; }'}</style>
      <ProductDetailClient key={productId} product={state.product} exclusiveLocked={state.exclusiveLocked} />
    </div>
  )
}

export default function ProductSheet({ productId, onClose }: { productId: string | null; onClose: () => void }) {
  return (
    <SlideUpSheet open={!!productId} onClose={onClose}>
      {productId && <ProductSheetBody productId={productId} />}
    </SlideUpSheet>
  )
}
