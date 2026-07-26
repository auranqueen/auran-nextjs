import type { SupabaseClient } from '@supabase/supabase-js'

/** hub brandId -> all brand ids under the same company (fallback: [brandId]) */
export async function resolveCompanyBrandIds(
  supabase: SupabaseClient,
  brandId: string,
): Promise<string[]> {
  let companyBrandIds = [String(brandId)]
  const { data: hubBrandRow } = await supabase
    .from('brands')
    .select('company_id')
    .eq('id', brandId)
    .maybeSingle()
  const cid = hubBrandRow?.company_id ? String(hubBrandRow.company_id) : null
  if (!cid) return companyBrandIds
  const { data: companyBrandRows } = await supabase
    .from('brands')
    .select('id')
    .eq('company_id', cid)
  const ids = ((companyBrandRows || []) as Array<{ id: string }>).map((b) => String(b.id)).filter(Boolean)
  if (ids.length > 0) companyBrandIds = ids
  return companyBrandIds
}