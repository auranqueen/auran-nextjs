import type { SupabaseClient } from '@supabase/supabase-js'
import { getOwnerLinkedBrandIds } from '@/lib/brand/getOwnerLinkedBrandIds'

/** 원장 연결 브랜드들의 company_id 목록 (중복 제거). */
export async function getOwnerCompanyIds(
  supabase: SupabaseClient,
  authId: string,
): Promise<string[]> {
  const brandIds = await getOwnerLinkedBrandIds(supabase, authId)
  if (brandIds.length === 0) return []

  const { data: rows } = await supabase
    .from('brands')
    .select('company_id')
    .in('id', brandIds)

  const ids = new Set<string>()
  for (const r of rows || []) {
    const cid = String((r as { company_id?: string | null }).company_id || '').trim()
    if (cid) ids.add(cid)
  }
  return Array.from(ids)
}