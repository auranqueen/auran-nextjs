import type { SupabaseClient } from '@supabase/supabase-js'

/** Active tier_name list for a company, ordered by price (same as Hub 등급관리). */
export async function fetchCompanyTierNames(
  supabase: SupabaseClient,
  companyId: string | null | undefined,
): Promise<string[]> {
  if (!companyId) return []
  const { data, error } = await supabase
    .from('brand_tier_packages')
    .select('tier_name, price')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .order('price', { ascending: true })
  if (error) return []
  const names: string[] = []
  const seen = new Set<string>()
  for (const row of data || []) {
    const name = String((row as { tier_name?: string | null }).tier_name || '').trim()
    if (!name || seen.has(name)) continue
    seen.add(name)
    names.push(name)
  }
  return names
}

export function defaultTierName(tierNames: string[]): string {
  return tierNames[0] || ''
}