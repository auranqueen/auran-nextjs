import type { createClient } from '@/lib/supabase/server'
export async function assertStaffPermission(
  supabase: ReturnType<typeof createClient>,
  staffId: string | null,
  companyId: string,
  module: string
): Promise<boolean> {
  if (!staffId) return false
  const { data: staff } = await supabase
    .from('brand_staff')
    .select('id, role, is_active, company_id')
    .eq('id', staffId)
    .eq('company_id', companyId)
    .maybeSingle()
  if (!staff?.is_active) return false
  if (staff.role === 'ceo') return true
  const { data: perm } = await supabase
    .from('brand_staff_permissions')
    .select('module')
    .eq('staff_id', staffId)
    .eq('company_id', companyId)
    .eq('module', module)
    .maybeSingle()
  return Boolean(perm?.module)
}
