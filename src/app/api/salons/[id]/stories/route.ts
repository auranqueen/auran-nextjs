import { NextResponse } from 'next/server'
import { tryCreateAdminClient } from '@/lib/supabase/admin'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const service = tryCreateAdminClient()
  if (!service) return NextResponse.json({ ok: false, error: 'service_unavailable' }, { status: 500 })

  const { data, error } = await service
    .from('brand_product_salon_story')
    .select('id, story_type, title, banner_image_url_pc, banner_image_url_mobile, created_at')
    .eq('salon_id', params.id)
    .eq('is_published', true)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ ok: false, error: 'list_failed' }, { status: 500 })
  return NextResponse.json({ ok: true, stories: data || [] })
}
