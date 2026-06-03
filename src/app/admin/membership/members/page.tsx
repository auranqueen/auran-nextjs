import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/app/admin/_auth'
import MembersClient from './MembersClient'

export const dynamic = 'force-dynamic'

export default async function MembershipMembersPage() {
  const supabase = createClient()
  await requireAdmin(supabase)

  const [
    { data: memberships },
    { data: templates },
    { data: plans },
  ] = await Promise.all([
    supabase.from('user_memberships')
      .select('id,user_id,status,shipments_total,shipments_remaining,next_shipment_date,plan_id,source_type,users!user_memberships_user_id_fkey(name),membership_plans(name)')
      .order('created_at', { ascending: false }),
    supabase.from('bundle_templates')
      .select('id,theme_name,target_phase,product_ids,usage_guide,owner_tip,is_active,display_order')
      .order('display_order', { ascending: true }),
    supabase.from('membership_plans')
      .select('id,name,price')
      .eq('is_active', true)
      .order('display_order', { ascending: true }),
  ])

  const ids = Array.from(new Set((templates ?? []).flatMap((t: any) => t.product_ids ?? [])))
  let productMap: Record<string, { id: string; name: string; description: string | null; key_ingredients: string | null }> = {}
  if (ids.length) {
    const { data: prods } = await supabase.from('products').select('id,name,description,key_ingredients').in('id', ids as string[])
    productMap = Object.fromEntries((prods ?? []).map((p: any) => [p.id, p]))
  }

  return (
    <MembersClient
      memberships={(memberships ?? []) as any}
      templates={(templates ?? []) as any}
      plans={(plans ?? []) as any}
      productMap={productMap}
    />
  )
}
