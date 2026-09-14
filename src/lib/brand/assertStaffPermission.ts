import type { createClient } from '@/lib/supabase/server'
import type { PinSessionOk } from '@/lib/brand/verifyPinSession'

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

/** PIN 세션에서 꺼낸 staff_id만 사용. 클라이언트가 보낸 staff_id는 호출부가 무시해야 한다. */
export async function assertStaffPermissionFromSession(
  supabase: ReturnType<typeof createClient>,
  session: PinSessionOk,
  companyId: string,
  module: string,
): Promise<boolean> {
  if (session.skipped || session.userRole === 'admin') return true
  return assertStaffPermission(supabase, session.staffId, companyId, module)
}
