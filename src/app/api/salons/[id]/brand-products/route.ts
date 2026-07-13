import { NextRequest, NextResponse } from 'next/server'
import { tryCreateAdminClient } from '@/lib/supabase/admin'
import type { SalonBrandProductItem, SalonBrandProductsResponse } from '@/types/salonBrandProducts'

const NO_STORE_HEADERS = { 'Cache-Control': 'private, no-store' }

function emptyResponse(salonId: string): NextResponse<SalonBrandProductsResponse> {
  return NextResponse.json(
    { salon_id: salonId, locked: false, lock_reason: null, products: [] },
    { headers: NO_STORE_HEADERS },
  )
}

function lockedTrackAResponse(salonId: string): NextResponse<SalonBrandProductsResponse> {
  return NextResponse.json(
    {
      salon_id: salonId,
      locked: true,
      lock_reason: 'track_a_subscription',
      products: [],
    },
    { headers: NO_STORE_HEADERS },
  )
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const salonId = typeof params?.id === 'string' ? params.id.trim() : ''
  if (!salonId) return emptyResponse('')

  const svc = tryCreateAdminClient()
  if (!svc) return emptyResponse(salonId)

  const { data: salon, error: salonError } = await svc
    .from('salons')
    .select('id, owner_id')
    .eq('id', salonId)
    .eq('status', 'active')
    .maybeSingle()

  if (salonError || !salon?.owner_id) return emptyResponse(salonId)

  const ownerUserId = String(salon.owner_id)

  const { data: ownerRow, error: ownerError } = await svc
    .from('users')
    .select('origin_track')
    .eq('id', ownerUserId)
    .maybeSingle()

  if (ownerError) return emptyResponse(salonId)

  const originTrack = String((ownerRow as { origin_track?: string } | null)?.origin_track || 'B')
  if (originTrack === 'A') return lockedTrackAResponse(salonId)

  const { data: linkRows, error: linkError } = await svc
    .from('brand_owner_links')
    .select('brand_id')
    .eq('owner_id', ownerUserId)
    .eq('status', 'active')

  if (linkError) return emptyResponse(salonId)

  const brandIds = Array.from(
    new Set(
      (linkRows || [])
        .map((row) => String((row as { brand_id?: string }).brand_id || '').trim())
        .filter(Boolean),
    ),
  )

  if (brandIds.length === 0) return emptyResponse(salonId)

  const { data: productRows, error: productError } = await svc
    .from('brand_products')
    .select('id, name, thumb_img, brand_id, brands(name)')
    .in('brand_id', brandIds)
    .eq('status', 'active')
    .order('name', { ascending: true })

  if (productError) return emptyResponse(salonId)

  const products: SalonBrandProductItem[] = (productRows || []).map((row) => {
    const r = row as {
      id: string
      name: string
      thumb_img: string | null
      brand_id: string
      brands: { name: string } | { name: string }[] | null
    }
    const brandRef = r.brands
    const brandName = Array.isArray(brandRef) ? brandRef[0]?.name : brandRef?.name

    return {
      id: String(r.id),
      name: String(r.name || ''),
      thumb_img: r.thumb_img ? String(r.thumb_img) : null,
      brand_id: String(r.brand_id),
      brand_name: brandName ? String(brandName) : null,
      consumer_price: null,
    }
  })

  return NextResponse.json(
    {
      salon_id: salonId,
      locked: false,
      lock_reason: null,
      products,
    } satisfies SalonBrandProductsResponse,
    { headers: NO_STORE_HEADERS },
  )
}
