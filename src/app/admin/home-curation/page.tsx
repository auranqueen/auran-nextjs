import { createClient } from '@/lib/supabase/server'
import HomeCurationClient from './client'

export default async function HomeCurationPage() {
  const supabase = createClient()

  const [
    { data: mappings },
    { data: issueButtons },
    { data: products },
    { data: concerns },
  ] = await Promise.all([
    supabase.from('season_product_mapping').select('*, products(id,name,thumb_img,storage_thumb_url)').eq('month', new Date().getMonth() + 1).eq('is_active', true).order('priority'),
    supabase.from('admin_settings').select('key,value').eq('category', 'monthly_issue').order('key'),
    supabase.from('products').select('id,name,thumb_img,storage_thumb_url,concern_tags').eq('is_active', true).order('sales_count', { ascending: false }).limit(500),
    supabase.from('admin_settings').select('key,value').eq('category', 'concern_best').order('key'),
  ])

  return (
    <HomeCurationClient
      initialMappings={mappings || []}
      initialIssueButtons={issueButtons || []}
      products={products || []}
      initialConcerns={concerns || []}
    />
  )
}
