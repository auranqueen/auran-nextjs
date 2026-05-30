import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/app/admin/_auth'
import TemplatesClient from './TemplatesClient'

export const dynamic = 'force-dynamic'

export default async function MembershipTemplatesPage() {
  const supabase = createClient()
  await requireAdmin(supabase)

  const { data: templates } = await supabase
    .from('bundle_templates')
    .select('id,theme_name,target_phase,product_ids,usage_guide,owner_tip,is_active,display_order')
    .order('display_order', { ascending: true })

  const ids = Array.from(new Set((templates ?? []).flatMap((t: any) => (t.product_ids ?? []) as string[])))
  let productMap: Record<string, string> = {}
  if (ids.length) {
    const { data: prods } = await supabase.from('products').select('id,name').in('id', ids)
    productMap = Object.fromEntries((prods ?? []).map((p: any) => [p.id, p.name]))
  }

  return <TemplatesClient initialTemplates={(templates ?? []) as any} productMap={productMap} />
}
