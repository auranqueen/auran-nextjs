import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '../_auth'
import MappingClient from './client'

export default async function AdminMappingPage() {
  const supabase = createClient()
  await requireAdmin(supabase as any)

  const { data: rows } = await supabase
    .from('season_product_mapping')
    .select('*, products(name, category)')
    .order('month', { ascending: true })
    .order('priority', { ascending: true })

  const { data: products } = await supabase
    .from('products')
    .select('id, name, category')
    .eq('is_active', true)
    .order('name')

  return <MappingClient rows={rows || []} products={products || []} />
}
