import { createClient } from '@/lib/supabase/server'
import AdminChrome from '@/components/admin/AdminChrome'
import './admin.css'
import { requireAdmin } from './_auth'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { adminName } = await requireAdmin(supabase as any)

  const [
    { count: customerCount },
    { count: partnerCount },
    { count: ownerCount },
    { count: brandCount },
    { count: pendingShipCount },
  ] = await Promise.all([
    supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'customer'),
    supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'partner'),
    supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'owner'),
    supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'brand'),
    supabase.from('orders').select('*', { count: 'exact', head: true }).in('status', ['주문확인', '발송준비']),
  ])

  return (
    <AdminChrome
      adminName={adminName}
      roleCounts={{
        customer: customerCount || 0,
        partner: partnerCount || 0,
        owner: ownerCount || 0,
        brand: brandCount || 0,
      }}
      pendingShipCount={pendingShipCount || 0}
    >
      {children}
    </AdminChrome>
  )
}

