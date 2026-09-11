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

/** Highest-price grade first → first palette color (Civasan 메디슈티컬 = red). */
const TIER_CHIP_COLORS = ['#E53935', '#C9A96E', '#9C7FD4', '#64B5F6', '#81C784', '#FF8A65'] as const

export function companyShowsGradeUi(tierNames: string[]): boolean {
  return tierNames.length > 0
}

export function tierChipColor(
  name: string,
  namesAscendingByPrice: string[],
  fallback = '#7B5EA7',
): string {
  const i = namesAscendingByPrice.indexOf(name)
  if (i < 0) return fallback
  const fromHighest = namesAscendingByPrice.length - 1 - i
  return TIER_CHIP_COLORS[fromHighest % TIER_CHIP_COLORS.length]
}