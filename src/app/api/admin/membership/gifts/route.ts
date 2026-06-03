import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/app/admin/_auth'

export async function PATCH(req: Request) {
  try {
    const supabase = createClient()
    await requireAdmin(supabase)
    const { id, tracking_no, courier } = await req.json()
    if (!id || !tracking_no || !courier) {
      return Response.json({ error: 'missing fields' }, { status: 400 })
    }
    const { error } = await supabase
      .from('membership_gifts')
      .update({
        shipping_status: 'shipped',
        tracking_no,
        courier,
        shipped_at: new Date().toISOString(),
      })
      .eq('id', id)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ ok: true })
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
