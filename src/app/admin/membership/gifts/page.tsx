import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/app/admin/_auth'
import GiftsClient from './GiftsClient'

export const dynamic = 'force-dynamic'

export default async function AdminMembershipGiftsPage() {
  const supabase = createClient()
  await requireAdmin(supabase)

  const { data: gifts } = await supabase
    .from('membership_gifts')
    .select('id, sender_name, message, amount, status, shipping_status, shipping_name, shipping_phone, shipping_address, shipping_detail, tracking_no, courier, claim_token, gift_copy, created_at, shipped_at')
    .order('created_at', { ascending: false })

  return <GiftsClient initialGifts={(gifts ?? []) as any} />
}
