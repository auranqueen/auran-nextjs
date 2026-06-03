import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/app/admin/_auth'
import MembersClient from './MembersClient'

export const dynamic = 'force-dynamic'

export default async function MembershipMembersPage() {
  const supabase = createClient()
  await requireAdmin(supabase)

  const { data: memberships } = await supabase
    .from('user_memberships')
    .select(
      'id,user_id,status,shipments_total,shipments_remaining,next_shipment_date,plan_id,source_type,users!user_memberships_user_id_fkey(name),membership_plans(name)'
    )
    .order('created_at', { ascending: false })

  const { data: templates } = await supabase
    .from('bundle_templates')
    .select('id,theme_name,target_phase')
    .eq('is_active', true)
    .order('display_order', { ascending: true })

  return <MembersClient memberships={(memberships ?? []) as any} templates={(templates ?? []) as any} />
}
